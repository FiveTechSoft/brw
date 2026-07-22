// js/ui/speedbar.js — toolbar with mode support (Off/Popup/Horizontal/Vertical)

/**
 * @param {HTMLElement} host
 * @param {(string|{label:string, title?:string, action?:()=>void})[]} buttons
 * @param {object} [opts]
 * @param {string} [opts.mode] - "off"|"popup"|"horizontal"|"vertical"
 * @param {(mode:string)=>void} [opts.onModeChange]
 * @returns {{ setMode: (m:string)=>void, getMode: ()=>string, el: HTMLElement }}
 */
const ICONS = {
  new: `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 1v14h10V5l-3-4H3z" fill="#fff" stroke="#000" stroke-width=".8"/><path d="M10 1v4h4" fill="none" stroke="#000" stroke-width=".8"/></svg>`,
  open: `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M1 4h5l2-2h7v10H1V4z" fill="#ffd700" stroke="#000" stroke-width=".7"/><path d="M1 8l2-3h12v7H1V8z" fill="#ffd700" stroke="#000" stroke-width=".7"/></svg>`,
  save: `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 1v14h12V5l-3-4H2z" fill="#fff" stroke="#000" stroke-width=".8"/><rect x="4" y="9" width="8" height="5" fill="#888" stroke="#000" stroke-width=".6"/><rect x="5" y="3" width="2" height="3" fill="none" stroke="#000" stroke-width=".6"/></svg>`,
  undo: `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M5 2L1 6l4 4" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 6h9c3 0 5 2 5 5v3" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  redo: `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M11 2l4 4-4 4" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6H6c-3 0-5 2-5 5v3" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  dialog: `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1" y="2" width="14" height="12" rx="1" fill="#c0c0c0" stroke="#000" stroke-width=".8"/><rect x="1" y="2" width="14" height="3" rx="1" fill="#000080" stroke="#000" stroke-width=".8"/><rect x="3" y="7" width="4" height="2" rx=".5" fill="#e0e0e0" stroke="#000" stroke-width=".5"/><rect x="3" y="10" width="4" height="2" rx=".5" fill="#e0e0e0" stroke="#000" stroke-width=".5"/><rect x="9" y="7" width="5" height="1.5" rx=".5" fill="#808080" stroke="#000" stroke-width=".5"/><rect x="9" y="10" width="5" height="1.5" rx=".5" fill="#808080" stroke="#000" stroke-width=".5"/></svg>`,
  ids: `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="1" width="12" height="14" rx="1" fill="#fff" stroke="#000" stroke-width=".8"/><rect x="4" y="3" width="8" height="2" fill="#000080" rx=".3"/><rect x="4" y="6" width="6" height="1.5" fill="#000080" rx=".3"/><rect x="4" y="8.5" width="7" height="1.5" fill="#000080" rx=".3"/><rect x="4" y="11" width="5" height="1.5" fill="#000080" rx=".3"/></svg>`,
};

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
      if (btn.icon) el.classList.add("sb-icon-" + btn.icon);
      if (btn.icon && mode !== "vertical") {
        el.title = btn.label + (btn.title ? " - " + btn.title : "");
        el.innerHTML = `<span class="sb-icon">${ICONS[btn.icon] || ""}</span><span class="sb-label">${btn.label}</span>`;
      } else {
        el.textContent = btn.label;
        if (btn.title) el.title = btn.title;
      }
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
