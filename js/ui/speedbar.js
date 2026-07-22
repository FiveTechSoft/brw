// js/ui/speedbar.js — toolbar with mode support (Off/Popup/Horizontal/Vertical)

/**
 * @param {HTMLElement} host
 * @param {(string|{label:string, title?:string, action?:()=>void})[]} buttons
 * @param {object} [opts]
 * @param {string} [opts.mode] - "off"|"popup"|"horizontal"|"vertical"
 * @param {(mode:string)=>void} [opts.onModeChange]
 * @returns {{ setMode: (m:string)=>void, getMode: ()=>string, el: HTMLElement }}
 */
export function createSpeedbar(host, buttons, opts = {}) {
  host.classList.add("speedbar");
  let mode = opts.mode || "horizontal";

  function render() {
    host.innerHTML = "";
    if (mode === "off") {
      host.style.display = "none";
      return;
    }
    host.style.display = "";
    host.classList.toggle("speedbar-vertical", mode === "vertical");
    host.classList.toggle("speedbar-popup", mode === "popup");

    if (mode === "vertical") {
      host.style.flexDirection = "column";
      host.style.height = "auto";
      host.style.width = "32px";
    } else {
      host.style.flexDirection = "row";
      host.style.height = "";
      host.style.width = "";
    }

    for (const btn of buttons) {
      if (btn === "-") {
        const sep = document.createElement("div");
        sep.className = "speedbar-sep";
        if (mode === "vertical") sep.style.cssText = "width:24px;height:0;border-left:none;border-top:1px solid var(--shadow);margin:4px 0;";
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

    if (mode === "popup") {
      host.style.position = "absolute";
      host.style.left = "4px";
      host.style.top = "24px";
      host.style.zIndex = "2000";
      host.style.border = "1px solid var(--shadow)";
      host.style.boxShadow = "2px 2px 0 rgba(0,0,0,0.25)";
    } else {
      host.style.position = "";
      host.style.border = "";
      host.style.boxShadow = "";
    }
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    render();
    opts.onModeChange?.(mode);
  }

  function getMode() { return mode; }

  render();
  return { setMode, getMode, el: host };
}
