// js/ui/menubar.js

/**
 * Build a classic Win95-style menu bar.
 * @param {HTMLElement} host
 * @param {{ label: string, items: (string|{label:string, action?:()=>void, disabled?:boolean})[] }[]} menus
 *   Use item === "-" for a separator.
 */
export function createMenubar(host, menus) {
  host.classList.add("menubar");
  host.innerHTML = "";

  for (const menu of menus) {
    const top = document.createElement("div");
    top.className = "menu-top";
    top.textContent = menu.label;

    const drop = document.createElement("div");
    drop.className = "menu-dropdown";

    for (const item of menu.items) {
      if (item === "-") {
        const sep = document.createElement("div");
        sep.className = "menu-sep";
        drop.appendChild(sep);
        continue;
      }
      const row = document.createElement("div");
      row.className = "menu-item" + (item.disabled ? " disabled" : "");
      row.textContent = item.label;
      if (!item.disabled) {
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
          host.querySelectorAll(".menu-top.open").forEach((t) => t.classList.remove("open"));
          item.action?.();
        });
      }
      drop.appendChild(row);
    }

    top.appendChild(drop);
    top.addEventListener("click", (e) => {
      e.stopPropagation();
      const was = drop.classList.contains("open");
      host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
      host.querySelectorAll(".menu-top.open").forEach((t) => t.classList.remove("open"));
      if (!was) {
        drop.classList.add("open");
        top.classList.add("open");
      }
    });

    // Hover-switch between menus when one is already open
    top.addEventListener("mouseenter", () => {
      const anyOpen = host.querySelector(".menu-dropdown.open");
      if (anyOpen && !drop.classList.contains("open")) {
        host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
        host.querySelectorAll(".menu-top.open").forEach((t) => t.classList.remove("open"));
        drop.classList.add("open");
        top.classList.add("open");
      }
    });

    host.appendChild(top);
  }

  document.addEventListener("click", () => {
    host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
    host.querySelectorAll(".menu-top.open").forEach((t) => t.classList.remove("open"));
  });
}
