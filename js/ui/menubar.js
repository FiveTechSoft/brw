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
      if (item.checked) row.classList.add("checked");
      if (item.items) row.classList.add("has-submenu");
      row.textContent = item.label;
      if (item.checked) {
        row.textContent = "✓ " + item.label;
      }
      if (item.items && !item.disabled) {
        // Nested submenu
        const subDrop = document.createElement("div");
        subDrop.className = "menu-dropdown submenu";
        for (const sub of item.items) {
          if (sub === "-") {
            const sep = document.createElement("div"); sep.className = "menu-sep"; subDrop.appendChild(sep);
            continue;
          }
          const subRow = document.createElement("div");
          subRow.className = "menu-item" + (sub.disabled ? " disabled" : "");
          if (sub.checked) subRow.classList.add("checked");
          if (sub.checked) subRow.textContent = "✓ " + sub.label;
          else subRow.textContent = sub.label;
          if (!sub.disabled) {
            subRow.addEventListener("click", (e) => {
              e.stopPropagation();
              host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
              host.querySelectorAll(".menu-top.open").forEach((t) => t.classList.remove("open"));
              sub.action?.();
            });
          }
          subDrop.appendChild(subRow);
        }
        row.appendChild(subDrop);
        row.addEventListener("mouseenter", () => {
          host.querySelectorAll(".submenu.open").forEach((d) => d.classList.remove("open"));
          subDrop.classList.add("open");
        });
      }
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
