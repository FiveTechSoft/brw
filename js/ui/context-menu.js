/**
 * Context menu utility — show/popup a classic Win95-style context menu.
 */

let activeMenu = null;

/**
 * @param {{label?:string, action?:()=>void, disabled?:boolean, separator?:boolean}[]} items
 * @param {number} x
 * @param {number} y
 * @param {HTMLElement} [anchor]
 */
export function showContextMenu(items, x, y, anchor) {
  hideContextMenu();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.left = x + "px";
  menu.style.top = y + "px";

  for (const item of items) {
    if (item.separator || item.label === "-") {
      const sep = document.createElement("div");
      sep.className = "context-menu-sep";
      menu.appendChild(sep);
      continue;
    }
    const row = document.createElement("div");
    row.className = "context-menu-item" + (item.disabled ? " disabled" : "");
    const parts = (item.label || "").split("\t");
    const lbl = document.createElement("span");
    lbl.textContent = parts[0];
    row.appendChild(lbl);
    if (parts[1]) {
      const sc = document.createElement("span");
      sc.className = "context-menu-shortcut";
      sc.textContent = parts[1];
      row.appendChild(sc);
    }
    if (!item.disabled && item.action) {
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        hideContextMenu();
        item.action();
      });
    }
    menu.appendChild(row);
  }

  // Keep menu inside viewport
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + "px";
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + "px";
  });

  document.body.appendChild(menu);
  activeMenu = menu;

  // Close on mousedown outside
  const onDown = (e) => {
    if (!menu.contains(e.target)) {
      hideContextMenu();
      document.removeEventListener("mousedown", onDown, true);
    }
  };
  setTimeout(() => {
    document.addEventListener("mousedown", onDown, true);
  }, 0);
}

export function hideContextMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}
