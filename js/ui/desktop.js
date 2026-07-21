// js/ui/desktop.js — desktop is the host element for WindowManager

/**
 * Optional helper: clear and style the desktop host.
 * @param {HTMLElement} desktopEl
 * @returns {HTMLElement}
 */
export function setupDesktop(desktopEl) {
  desktopEl.classList.add("desktop");
  // Desktop content is managed by WindowManager windows.
  return desktopEl;
}
