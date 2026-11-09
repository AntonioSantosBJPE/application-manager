#!/usr/bin/env bash
# Hardens a fresh Ubuntu/Debian server. Idempotent: running it twice with the same values changes
# nothing the second time, and every step says `changed` or `unchanged`.
#
#   ADMIN_USER=<name> ADMIN_SSH_PUBLIC_KEY='<public key>' sudo -E ./harden.sh [--dry-run]
#
# Values come from the environment, never from this file:
#   ADMIN_USER            the non-root account that will administer the server (required)
#   ADMIN_SSH_PUBLIC_KEY  its public key, one line (required)
#   SSH_PORT              the SSH port the firewall keeps open (default 22)
#   EXTRA_ALLOW_TCP       comma-separated TCP ports to keep open besides SSH (default none)
#   HARDEN_CF_IPS_FILE    optional file with the Cloudflare ranges, one CIDR per line; without it the
#                         lists published at https://www.cloudflare.com/ips-v4 and /ips-v6 are fetched
#   HARDEN_PUBLIC_IFACE   optional name of the public network interface (default: the default route's)
#
# --dry-run prints every command that would run (prefixed with `+`) and changes nothing.
# Read docs/runbooks/production-deploy.md before running it on a server you reach over SSH: keep your
# current session open until a new one works with the account created here.
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "usage: harden.sh [--dry-run]" >&2; exit 2 ;;
  esac
done

ADMIN_USER="${ADMIN_USER:-}"
ADMIN_SSH_PUBLIC_KEY="${ADMIN_SSH_PUBLIC_KEY:-}"
SSH_PORT="${SSH_PORT:-22}"
EXTRA_ALLOW_TCP="${EXTRA_ALLOW_TCP:-}"

# ---------------------------------------------------------------------------------------------------
# Helpers

report() { echo "[$1] $2"; }

# Runs a command, or only prints it under --dry-run.
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "+ $*"
  else
    "$@"
  fi
}

# The helpers below report what they did in a variable instead of their exit status: a function on the
# left of `&&` or in an `if` runs with `set -e` off, which would hide a failed install or apt-get.
# Call them as plain statements, then read the variable.

write_changed=0
# write_file <path> <mode> <content>: installs <content> at <path> when the content or the mode differs
# and sets write_changed to 1 (0 when the file was already right). A failure aborts the script.
write_file() {
  local path="$1" mode="$2" tmp
  tmp="$(mktemp)"
  printf '%s\n' "$3" >"$tmp"
  write_changed=0
  if [ -f "$path" ] && cmp -s "$tmp" "$path" && [ "$(stat -c '%a' "$path")" = "$mode" ]; then
    rm -f "$tmp"
    return 0
  fi
  write_changed=1
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "+ write $path (mode $mode)"
  else
    install -m "$mode" "$tmp" "$path"
  fi
  rm -f "$tmp"
}

apt_updated=0
pkg_changed=0
# ensure_packages <name>...: installs the missing ones and sets pkg_changed to 1 when it had to. A
# failure (no network, a missing package) aborts the script.
ensure_packages() {
  local missing=() pkg
  pkg_changed=0
  for pkg in "$@"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done
  if [ "${#missing[@]}" -eq 0 ]; then
    return 0
  fi
  if [ "$apt_updated" -eq 0 ]; then
    run env DEBIAN_FRONTEND=noninteractive apt-get update -qq
    apt_updated=1
  fi
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}"
  pkg_changed=1
}

# Services are managed only where systemd runs (not in the container the script is rehearsed in).
# HARDEN_FORCE_SYSTEMD=1 makes --dry-run print the service commands there too.
have_systemd() { [ -d /run/systemd/system ] || [ "${HARDEN_FORCE_SYSTEMD:-0}" = "1" ]; }

# ---------------------------------------------------------------------------------------------------
# Inputs are checked before anything is touched.

# A port number, 1 to 65535, in at most five digits.
valid_port() { [[ "$1" =~ ^[0-9]{1,5}$ ]] && [ "$((10#$1))" -ge 1 ] && [ "$((10#$1))" -le 65535 ]; }

validate_inputs() {
  local errors=() port
  if ! [[ "$ADMIN_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || [ "$ADMIN_USER" = "root" ]; then
    errors+=("ADMIN_USER must be a lowercase account name other than root")
  fi
  if [ -z "$ADMIN_SSH_PUBLIC_KEY" ]; then
    errors+=("ADMIN_SSH_PUBLIC_KEY is empty: without a key the server would be locked out once password login is off")
  elif ! [[ "$ADMIN_SSH_PUBLIC_KEY" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com)\ [A-Za-z0-9+/]+=*(\ .*)?$ ]]; then
    errors+=("ADMIN_SSH_PUBLIC_KEY is not a valid public key line")
  fi
  if ! valid_port "$SSH_PORT"; then
    errors+=("SSH_PORT must be a port number from 1 to 65535")
  fi
  if [ -n "$EXTRA_ALLOW_TCP" ]; then
    if ! [[ "$EXTRA_ALLOW_TCP" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
      errors+=("EXTRA_ALLOW_TCP must be comma-separated port numbers")
    else
      for port in ${EXTRA_ALLOW_TCP//,/ }; do
        if ! valid_port "$port"; then
          errors+=("EXTRA_ALLOW_TCP has $port, which is not a port from 1 to 65535")
        elif [ "$((10#$port))" -eq 80 ] || [ "$((10#$port))" -eq 443 ]; then
          errors+=("EXTRA_ALLOW_TCP must not open 80 or 443: they stay reachable only from Cloudflare")
        fi
      done
    fi
  fi
  if [ "$DRY_RUN" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
    errors+=("run as root (sudo -E), or pass --dry-run")
  fi
  if [ "${#errors[@]}" -gt 0 ]; then
    printf 'harden: %s\n' "${errors[@]}" >&2
    exit 2
  fi
  # Ports are written without leading zeros, so 0022 and 22 are the same rule.
  SSH_PORT=$((10#$SSH_PORT))
  if [ -n "$EXTRA_ALLOW_TCP" ]; then
    local normalized=()
    for port in ${EXTRA_ALLOW_TCP//,/ }; do normalized+=("$((10#$port))"); done
    EXTRA_ALLOW_TCP="$(IFS=,; echo "${normalized[*]}")"
  fi
}

# ---------------------------------------------------------------------------------------------------
# Steps

step_user() {
  local changed=0 groups
  ensure_packages sudo
  if [ "$pkg_changed" -eq 1 ]; then changed=1; fi
  if ! getent group docker >/dev/null; then
    run groupadd docker
    changed=1
  fi
  if ! id "$ADMIN_USER" >/dev/null 2>&1; then
    run useradd --create-home --shell /bin/bash --groups sudo,docker "$ADMIN_USER"
    changed=1
  else
    groups=" $(id -nG "$ADMIN_USER") "
    for group in sudo docker; do
      if [[ "$groups" != *" $group "* ]]; then
        run usermod --append --groups "$group" "$ADMIN_USER"
        changed=1
      fi
    done
  fi
  # No password: the account is reached by key only. `*` blocks password login but, unlike `!`, still
  # lets sshd accept the key on every distribution.
  if [ "$DRY_RUN" -eq 0 ] && [ "$(getent shadow "$ADMIN_USER" | cut -d: -f2)" != "*" ]; then
    run usermod --password '*' "$ADMIN_USER"
    changed=1
  fi
  write_file "/etc/sudoers.d/90-$ADMIN_USER" 440 "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL"
  if [ "$write_changed" -eq 1 ]; then changed=1; fi
  report user "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

step_key() {
  local changed=0 home ssh_dir keys
  if [ "$DRY_RUN" -eq 1 ] && ! id "$ADMIN_USER" >/dev/null 2>&1; then
    echo "+ install the public key in the home of $ADMIN_USER (mode 600)"
    report key changed
    return
  fi
  home="$(getent passwd "$ADMIN_USER" | cut -d: -f6)"
  ssh_dir="$home/.ssh"
  keys="$ssh_dir/authorized_keys"
  if [ ! -d "$ssh_dir" ]; then
    run install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "$ssh_dir"
    changed=1
  fi
  if [ ! -f "$keys" ] || ! grep -qxF "$ADMIN_SSH_PUBLIC_KEY" "$keys"; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "+ append the public key to $keys"
    else
      printf '%s\n' "$ADMIN_SSH_PUBLIC_KEY" >>"$keys"
    fi
    changed=1
  fi
  if [ "$DRY_RUN" -eq 0 ]; then
    if [ "$(stat -c '%a %U' "$keys")" != "600 $ADMIN_USER" ]; then
      chown "$ADMIN_USER:$ADMIN_USER" "$keys"
      chmod 600 "$keys"
      changed=1
    fi
  fi
  report key "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

# sshd: no root login, no passwords, keys only. The file is named 00- because sshd keeps the first
# value it reads, and cloud images ship 50-cloud-init.conf with PasswordAuthentication yes.
step_ssh() {
  local file=/etc/ssh/sshd_config.d/00-hardening.conf previous="" had_previous=0 changed=0
  ensure_packages openssh-server
  if [ "$pkg_changed" -eq 1 ]; then changed=1; fi
  run mkdir -p /etc/ssh/sshd_config.d /run/sshd
  if [ -f "$file" ]; then
    previous="$(cat "$file")"
    had_previous=1
  fi
  write_file "$file" 644 "$(printf '%s\n' 'PermitRootLogin no' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PubkeyAuthentication yes')"
  if [ "$write_changed" -eq 1 ]; then
    changed=1
    # A configuration sshd rejects is rolled back before sshd ever reloads it.
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "+ sshd -t"
    elif ! sshd -t 2>/tmp/harden-sshd-test.err; then
      if [ "$had_previous" -eq 1 ]; then
        printf '%s\n' "$previous" >"$file"
      else
        rm -f "$file"
      fi
      echo "harden: sshd rejected the new configuration, the previous one was restored: $(head -n 1 /tmp/harden-sshd-test.err)" >&2
      exit 1
    fi
    if have_systemd; then
      if [ "$DRY_RUN" -eq 1 ]; then
        echo "+ systemctl reload ssh"
      else
        systemctl reload ssh 2>/dev/null || systemctl reload sshd
      fi
    fi
  fi
  report ssh "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

# Automatic security updates (the package's default origins are the security pockets).
step_updates() {
  local changed=0
  ensure_packages unattended-upgrades
  if [ "$pkg_changed" -eq 1 ]; then changed=1; fi
  write_file /etc/apt/apt.conf.d/20auto-upgrades 644 "$(printf '%s\n' 'APT::Periodic::Update-Package-Lists "1";' 'APT::Periodic::Unattended-Upgrade "1";')"
  if [ "$write_changed" -eq 1 ]; then changed=1; fi
  if have_systemd; then
    run systemctl enable --now apt-daily.timer apt-daily-upgrade.timer
  fi
  report updates "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

# Bans addresses that keep failing to log in over SSH.
step_fail2ban() {
  local changed=0 reload=0
  ensure_packages fail2ban
  if [ "$pkg_changed" -eq 1 ]; then changed=1; fi
  write_file /etc/fail2ban/jail.d/sshd.local 644 "$(printf '%s\n' '[sshd]' 'enabled = true' "port = $SSH_PORT" 'maxretry = 5' 'findtime = 10m' 'bantime = 1h')"
  if [ "$write_changed" -eq 1 ]; then changed=1; reload=1; fi
  if have_systemd; then
    run systemctl enable --now fail2ban
    if [ "$reload" -eq 1 ]; then
      run systemctl reload fail2ban
    fi
  fi
  report fail2ban "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

# Cloudflare's published ranges, validated: a broken list must never turn into "open to everyone".
cf_v4=()
cf_v6=()
read_cloudflare_ranges() {
  local raw cidr
  if [ -n "${HARDEN_CF_IPS_FILE:-}" ]; then
    raw="$(cat "$HARDEN_CF_IPS_FILE")" || { echo "harden: cannot read $HARDEN_CF_IPS_FILE" >&2; exit 1; }
  else
    raw="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4; echo; curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)" \
      || { echo "harden: cannot fetch the Cloudflare ranges; the firewall was not touched" >&2; exit 1; }
  fi
  while IFS= read -r cidr; do
    cidr="${cidr//[$'\r ']/}"
    [ -z "$cidr" ] && continue
    if ! [[ "$cidr" =~ ^[0-9a-fA-F:.]+/[0-9]{1,3}$ ]] || [[ "$cidr" =~ /0$ ]]; then
      echo "harden: refusing the Cloudflare range '$cidr' (not a CIDR, or it covers every address)" >&2
      exit 1
    fi
    if [[ "$cidr" == *:* ]]; then cf_v6+=("$cidr"); else cf_v4+=("$cidr"); fi
  done <<<"$raw"
  if [ "${#cf_v4[@]}" -eq 0 ] || [ "${#cf_v6[@]}" -eq 0 ]; then
    echo "harden: the Cloudflare list has no IPv4 or no IPv6 range; the firewall was not touched" >&2
    exit 1
  fi
}

# The ufw commands: deny by default, SSH and the extra ports open, 80/443 only from Cloudflare.
ufw_rule_lines() {
  local port cidr
  echo "ufw default deny incoming"
  echo "ufw default allow outgoing"
  echo "ufw allow ${SSH_PORT}/tcp"
  if [ -n "$EXTRA_ALLOW_TCP" ]; then
    for port in ${EXTRA_ALLOW_TCP//,/ }; do echo "ufw allow ${port}/tcp"; done
  fi
  for cidr in "${cf_v4[@]}" "${cf_v6[@]}"; do
    for port in 80 443; do echo "ufw allow from ${cidr} to any port ${port} proto tcp"; done
  done
  echo "ufw --force enable"
}

# Docker publishes ports through its own iptables rules, ahead of ufw, so ufw alone leaves 80, 443 and
# the Coolify ports open to the world. DOCKER-USER runs before Docker's rules: a chain of ours, jumped
# to from it for traffic arriving on the public interface, lets through only answers to connections the
# containers started, Cloudflare on 80/443 and the extra ports, and drops every other new connection.
docker_user_rule_lines() {
  local iface="$1" tool cidr port
  local -a cidrs
  for tool in iptables ip6tables; do
    if [ "$tool" = iptables ]; then cidrs=("${cf_v4[@]}"); else cidrs=("${cf_v6[@]}"); fi
    echo "$tool -w -N DOCKER-USER 2>/dev/null || true"
    echo "$tool -w -N HARDEN-WEB 2>/dev/null || true"
    echo "$tool -w -F HARDEN-WEB"
    echo "$tool -w -A HARDEN-WEB -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN"
    for cidr in "${cidrs[@]}"; do
      for port in 80 443; do
        echo "$tool -w -A HARDEN-WEB -s ${cidr} -p tcp -m conntrack --ctorigdstport ${port} -j RETURN"
      done
    done
    if [ -n "$EXTRA_ALLOW_TCP" ]; then
      for port in ${EXTRA_ALLOW_TCP//,/ }; do
        echo "$tool -w -A HARDEN-WEB -p tcp -m conntrack --ctorigdstport ${port} -j RETURN"
      done
    fi
    echo "$tool -w -A HARDEN-WEB -j DROP"
    echo "$tool -w -C DOCKER-USER -i ${iface} -j HARDEN-WEB 2>/dev/null || $tool -w -I DOCKER-USER 1 -i ${iface} -j HARDEN-WEB"
  done
}

step_firewall() {
  local changed=0 iface applied=0 line ufw_script docker_script script_changed=0
  local -a parts
  read_cloudflare_ranges
  ensure_packages ufw iptables curl ca-certificates
  if [ "$pkg_changed" -eq 1 ]; then changed=1; fi

  if ! have_systemd && [ "$DRY_RUN" -eq 0 ]; then
    echo "harden: no systemd here (a container?): ufw and iptables were not touched"
    report firewall "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
    return
  fi

  iface="${HARDEN_PUBLIC_IFACE:-}"
  if [ -z "$iface" ]; then
    iface="$(ip route show default 2>/dev/null | awk '/^default/ {print $5; exit}' || true)"
  fi
  if [ -z "$iface" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      iface="<public-interface>"
    else
      echo "harden: cannot tell the public network interface; set HARDEN_PUBLIC_IFACE" >&2
      exit 1
    fi
  fi

  ufw_script="$(ufw_rule_lines)"
  docker_script="$(docker_user_rule_lines "$iface")"

  run mkdir -p /etc/harden
  write_file /etc/harden/ufw.rules 600 "$ufw_script"
  if [ "$write_changed" -eq 1 ]; then
    changed=1
    applied=1
  fi
  if [ "$applied" -eq 1 ] || { [ "$DRY_RUN" -eq 0 ] && ! ufw status 2>/dev/null | grep -q '^Status: active'; }; then
    while IFS= read -r line; do
      read -ra parts <<<"$line"
      run "${parts[@]}"
    done <<<"$ufw_script"
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    while IFS= read -r line; do echo "+ $line"; done <<<"$docker_script"
  fi
  write_file /usr/local/sbin/harden-docker-user.sh 750 "$(printf '#!/bin/sh\n# Written by harden.sh: the DOCKER-USER rules, reapplied by harden-docker-user.service.\nset -e\n%s' "$docker_script")"
  if [ "$write_changed" -eq 1 ]; then
    script_changed=1
    changed=1
  fi
  write_file /etc/systemd/system/harden-docker-user.service 644 "$(printf '%s\n' '[Unit]' 'Description=Restrict published container ports to Cloudflare (DOCKER-USER)' \
    'After=docker.service' 'PartOf=docker.service' '' '[Service]' 'Type=oneshot' 'RemainAfterExit=yes' \
    'ExecStart=/usr/local/sbin/harden-docker-user.sh' '' '[Install]' 'WantedBy=multi-user.target')"
  if [ "$write_changed" -eq 1 ]; then
    changed=1
    script_changed=1
    run systemctl daemon-reload
  fi
  run systemctl enable harden-docker-user.service
  if [ "$script_changed" -eq 1 ]; then
    # Docker may not be installed yet: the unit then runs when it is.
    if [ "$DRY_RUN" -eq 1 ]; then echo "+ systemctl restart harden-docker-user.service"; else systemctl restart harden-docker-user.service || true; fi
  fi
  report firewall "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

# ---------------------------------------------------------------------------------------------------

validate_inputs
step_user
step_key
step_ssh
step_updates
step_fail2ban
step_firewall
