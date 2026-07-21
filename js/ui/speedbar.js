// js/ui/speedbar.js

/**
 * Build a simple labeled speedbar (toolbar).
 * @param {HTMLElement} host
 * @param {(string|{label:string, title?:string, action?:()=>void})[]} buttons
 *   Use button === "-" for a separator.
 */
export function createSpeedbar(host, buttons) {
  host.classList.add("speedbar");
  host.innerHTML = "";

  for (const btn of buttons) {
    if (btn === "-") {
      const sep = document.createElement("div");
      sep.className = "speedbar-sep";
      host.appendChild(sep);
      continue;
    }
    const el = document.createElement("button");
    el.type = "button";
    el.className = "speedbar-btn";
    el.textContent = btn.label;
    if (btn.title) el.title = btn.title;
    el.addEventListener("click", () => btn.action?.());
    host.appendChild(el);
  }
}
