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

# write_file <path> <mode>: installs stdin at <path> when its content or mode differs; prints
# `changed`/`unchanged` through the caller's report. Returns 0 when it changed something.
write_file() {
  local path="$1" mode="$2" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  if [ -f "$path" ] && cmp -s "$tmp" "$path" && [ "$(stat -c '%a' "$path")" = "$mode" ]; then
    rm -f "$tmp"
    return 1
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "+ write $path (mode $mode)"
  else
    install -m "$mode" "$tmp" "$path"
  fi
  rm -f "$tmp"
  return 0
}

apt_updated=0
# ensure_packages <name>...: installs the missing ones.
ensure_packages() {
  local missing=() pkg
  for pkg in "$@"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done
  [ "${#missing[@]}" -eq 0 ] && return 1
  if [ "$apt_updated" -eq 0 ]; then
    run env DEBIAN_FRONTEND=noninteractive apt-get update -qq
    apt_updated=1
  fi
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}"
  return 0
}

# Services are managed only where systemd runs (not in the container the script is rehearsed in).
# HARDEN_FORCE_SYSTEMD=1 makes --dry-run print the service commands there too.
have_systemd() { [ -d /run/systemd/system ] || [ "${HARDEN_FORCE_SYSTEMD:-0}" = "1" ]; }

# ---------------------------------------------------------------------------------------------------
# Inputs are checked before anything is touched.

validate_inputs() {
  local errors=()
  if ! [[ "$ADMIN_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || [ "$ADMIN_USER" = "root" ]; then
    errors+=("ADMIN_USER must be a lowercase account name other than root")
  fi
  if [ -z "$ADMIN_SSH_PUBLIC_KEY" ]; then
    errors+=("ADMIN_SSH_PUBLIC_KEY is empty: without a key the server would be locked out once password login is off")
  elif ! [[ "$ADMIN_SSH_PUBLIC_KEY" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com)\ [A-Za-z0-9+/]+=*(\ .*)?$ ]]; then
    errors+=("ADMIN_SSH_PUBLIC_KEY is not a valid public key line")
  fi
  if ! [[ "$SSH_PORT" =~ ^[0-9]+$ ]] || [ "$SSH_PORT" -lt 1 ] || [ "$SSH_PORT" -gt 65535 ]; then
    errors+=("SSH_PORT must be a port number")
  fi
  if [ -n "$EXTRA_ALLOW_TCP" ] && ! [[ "$EXTRA_ALLOW_TCP" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
    errors+=("EXTRA_ALLOW_TCP must be comma-separated port numbers")
  fi
  if [ "$DRY_RUN" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
    errors+=("run as root (sudo -E), or pass --dry-run")
  fi
  if [ "${#errors[@]}" -gt 0 ]; then
    printf 'harden: %s\n' "${errors[@]}" >&2
    exit 2
  fi
}

# ---------------------------------------------------------------------------------------------------
# Steps

step_user() {
  local changed=0 groups
  ensure_packages sudo && changed=1
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
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$ADMIN_USER" | write_file "/etc/sudoers.d/90-$ADMIN_USER" 440 && changed=1
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
  ensure_packages openssh-server && changed=1
  run mkdir -p /etc/ssh/sshd_config.d /run/sshd
  if [ -f "$file" ]; then
    previous="$(cat "$file")"
    had_previous=1
  fi
  if printf '%s\n' 'PermitRootLogin no' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PubkeyAuthentication yes' \
    | write_file "$file" 644; then
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
  ensure_packages unattended-upgrades && changed=1
  printf '%s\n' 'APT::Periodic::Update-Package-Lists "1";' 'APT::Periodic::Unattended-Upgrade "1";' \
    | write_file /etc/apt/apt.conf.d/20auto-upgrades 644 && changed=1
  if have_systemd; then
    run systemctl enable --now apt-daily.timer apt-daily-upgrade.timer
  fi
  report updates "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

# Bans addresses that keep failing to log in over SSH.
step_fail2ban() {
  local changed=0
  ensure_packages fail2ban && changed=1
  printf '%s\n' '[sshd]' 'enabled = true' "port = $SSH_PORT" 'maxretry = 5' 'findtime = 10m' 'bantime = 1h' \
    | write_file /etc/fail2ban/jail.d/sshd.local 644 && changed=1 && reload_fail2ban=1
  if have_systemd; then
    run systemctl enable --now fail2ban
    if [ "${reload_fail2ban:-0}" -eq 1 ]; then
      run systemctl reload fail2ban
    fi
  fi
  report fail2ban "$([ "$changed" -eq 1 ] && echo changed || echo unchanged)"
}

# ---------------------------------------------------------------------------------------------------

validate_inputs
step_user
step_key
step_ssh
step_updates
step_fail2ban
