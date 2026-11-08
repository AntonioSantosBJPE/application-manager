/**
 * Gives the focus to an element once the confirmation dialog that was open is gone. The control that
 * opened the dialog may have left the page with the action (the "Promover" button, the "Remover" of an
 * alias), and a focus set while the dialog still holds it is taken back, so this waits for the dialog
 * to unmount and then looks the target up.
 */
export function focusWhenConfirmationClosed(find: () => HTMLElement | null | undefined): void {
  let attempts = 0;
  const focus = () => {
    if (document.querySelector('[role="alertdialog"]') !== null && attempts++ < 50) {
      setTimeout(focus, 0);
      return;
    }
    find()?.focus();
  };
  setTimeout(focus, 0);
}
