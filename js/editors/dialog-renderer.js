/**
 * Dialog canvas renderer (DOM approximation of Win controls + BWCC).
 */
import { WS, BS, SS, ES } from "../core/constants.js";
import { paintBorControl, applyBordlgCanvas } from "./bwcc-renderer.js";

/**
 * @param {{name?:string,size?:number}|null|undefined} font
 */
export function fontMetrics(font) {
  const size = font?.size || 8;
  return {
    avgCharWidth: Math.max(4, Math.round(size * 0.875)),
    fontHeight: Math.max(8, Math.round(size * 2)),
  };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} cx
 * @param {number} cy
 * @param {{name?:string,size?:number}|null} font
 */
export function duToPx(x, y, cx, cy, font) {
  const m = fontMetrics(font);
  return {
    x: Math.round((x * m.avgCharWidth) / 4),
    y: Math.round((y * m.fontHeight) / 8),
    cx: Math.round((cx * m.avgCharWidth) / 4),
    cy: Math.round((cy * m.fontHeight) / 8),
  };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} cx
 * @param {number} cy
 * @param {{name?:string,size?:number}|null} font
 */
export function pxToDu(x, y, cx, cy, font) {
  const m = fontMetrics(font);
  return {
    x: Math.round((x * 4) / m.avgCharWidth),
    y: Math.round((y * 8) / m.fontHeight),
    cx: Math.max(1, Math.round((cx * 4) / m.avgCharWidth)),
    cy: Math.max(1, Math.round((cy * 8) / m.fontHeight)),
  };
}

/**
 * @typedef {object} RenderOpts
 * @property {boolean} [interactive]
 * @property {Set<any>} [selectedIds]
 * @property {number} [scale]
 * @property {"dialog"|"screen"} [unitMode]
 * @property {(ctl: object, ev: MouseEvent) => void} [onControlClick]
 * @property {boolean} [showIds]
 * @property {import('../core/project-model.js').ProjectModel|null} [project]
 * @property {boolean} [showTabOrder]
 * @property {boolean} [showHandles]
 */

/**
 * Render dialog into container (clears container first).
 * @param {HTMLElement} container
 * @param {import('../core/project-model.js').DialogResource} dialog
 * @param {RenderOpts} [opts]
 * @returns {{ frame: HTMLElement, controlEls: Map<object, HTMLElement> }}
 */
export function renderDialog(container, dialog, opts = {}) {
  const scale = opts.scale ?? 1;
  const selectedIds = opts.selectedIds || new Set();
  const project = opts.project || null;
  const font = dialog.font || { name: "MS Sans Serif", size: 8 };

  container.innerHTML = "";
  container.classList.add("dialog-render-host");

  const outer = document.createElement("div");
  outer.className = "dialog-frame";
  const hasCaption = (dialog.style & WS.CAPTION) === WS.CAPTION || (dialog.style & WS.DLGFRAME) !== 0;

  const client = duToPx(0, 0, dialog.cx, dialog.cy, font);
  const captionH = hasCaption ? 18 : 0;
  const border = 3;

  outer.style.width = Math.round((client.cx + border * 2) * scale) + "px";
  outer.style.height = Math.round((client.cy + captionH + border * 2) * scale) + "px";
  outer.style.transformOrigin = "top left";
  if (scale !== 1) {
    // size already scaled above for layout simplicity
  }

  if (hasCaption) {
    const cap = document.createElement("div");
    cap.className = "dialog-caption";
    cap.textContent = dialog.title || "";
    outer.appendChild(cap);
  }

  const canvas = document.createElement("div");
  canvas.className = "dialog-canvas";
  canvas.style.width = Math.round(client.cx * scale) + "px";
  canvas.style.height = Math.round(client.cy * scale) + "px";
  applyBordlgCanvas(canvas, dialog);
  outer.appendChild(canvas);

  /** @type {Map<object, HTMLElement>} */
  const controlEls = new Map();

  // Paint in reverse tab/z order so first controls are under later ones (Win paints in array order;
  // last control is topmost for hit-testing).
  const controls = dialog.controls || [];
  for (let i = 0; i < controls.length; i++) {
    const c = controls[i];
    const el = document.createElement("div");
    const cls = String(c.className || "BUTTON");
    el.className = `dialog-control control-${cssSafe(cls)}`;
    el.dataset.ctlIndex = String(i);
    el.dataset.ctlId = String(c.id);

    const rect = duToPx(c.x, c.y, c.cx, c.cy, font);
    el.style.left = Math.round(rect.x * scale) + "px";
    el.style.top = Math.round(rect.y * scale) + "px";
    el.style.width = Math.round(rect.cx * scale) + "px";
    el.style.height = Math.round(rect.cy * scale) + "px";

    if ((c.style & WS.DISABLED) === WS.DISABLED) el.classList.add("ctl-disabled");
    if ((c.style & WS.VISIBLE) === 0 && (c.style & WS.CHILD)) {
      // still show in editor
    }

    const isSelected =
      selectedIds.has(c) || selectedIds.has(c.id) || selectedIds.has(String(c.id));
    if (isSelected) el.classList.add("selected");

    paintControlContent(el, c, project);

    if (opts.showIds) {
      const badge = document.createElement("span");
      badge.className = "ctl-id-badge";
      badge.textContent = String(c.id);
      el.appendChild(badge);
    }
    if (opts.showTabOrder) {
      const badge = document.createElement("span");
      badge.className = "ctl-tab-badge";
      badge.textContent = String(c.tabIndex ?? i);
      el.appendChild(badge);
    }

    if (opts.interactive || opts.onControlClick) {
      el.addEventListener("mousedown", (ev) => {
        ev.stopPropagation();
        opts.onControlClick?.(c, ev);
      });
    }

    if (isSelected && opts.showHandles !== false && !opts.interactive) {
      for (const h of ["nw", "n", "ne", "e", "se", "s", "sw", "w"]) {
        const handle = document.createElement("div");
        handle.className = `resize-handle handle-${h}`;
        handle.dataset.handle = h;
        el.appendChild(handle);
      }
    }

    canvas.appendChild(el);
    controlEls.set(c, el);
  }

  container.appendChild(outer);
  return { frame: outer, canvas, controlEls };
}

/**
 * @param {HTMLElement} el
 * @param {import('../core/project-model.js').Control} c
 * @param {import('../core/project-model.js').ProjectModel|null} project
 */
function paintControlContent(el, c, project) {
  const cls = String(c.className || "");
  if (/^Bor/i.test(cls)) {
    paintBorControl(el, c, project);
    return;
  }

  const upper = cls.toUpperCase();
  const style = c.style | 0;
  const low = style & 0xff;

  if (upper === "BUTTON") {
    if (low === BS.GROUPBOX) {
      el.classList.add("ctl-groupbox");
      el.innerHTML = `<span class="groupbox-caption"></span>`;
      el.querySelector(".groupbox-caption").textContent = c.text || "";
    } else if (low === BS.CHECKBOX || low === BS.AUTOCHECKBOX || low === BS.AUTO3STATE || low === BS["3STATE"]) {
      el.classList.add("ctl-check");
      el.innerHTML = `<span class="check-box"></span><span class="check-label"></span>`;
      el.querySelector(".check-label").textContent = c.text || "";
    } else if (low === BS.RADIOBUTTON || low === BS.AUTORADIOBUTTON) {
      el.classList.add("ctl-radio");
      el.innerHTML = `<span class="radio-dot"></span><span class="radio-label"></span>`;
      el.querySelector(".radio-label").textContent = c.text || "";
    } else {
      el.classList.add("ctl-button");
      if (low === BS.DEFPUSHBUTTON) el.classList.add("ctl-defbutton");
      el.textContent = c.text || "";
    }
    return;
  }

  if (upper === "EDIT") {
    el.classList.add("ctl-edit");
    el.textContent = c.text || "";
    return;
  }

  if (upper === "STATIC") {
    const st = style & 0x1f;
    if (st === SS.BLACKRECT || st === SS.GRAYRECT || st === SS.WHITERECT) {
      el.classList.add("ctl-static-rect", `static-${st}`);
    } else if (st === SS.BLACKFRAME || st === SS.GRAYFRAME || st === SS.WHITEFRAME || st === SS.ETCHEDFRAME) {
      el.classList.add("ctl-static-frame");
    } else if (st === SS.ETCHEDHORZ || st === SS.ETCHEDVERT) {
      el.classList.add("ctl-static-etched");
    } else if (st === SS.ICON) {
      el.classList.add("ctl-static-icon");
      el.textContent = "ICO";
    } else {
      el.classList.add("ctl-static");
      if (st === SS.CENTER) el.style.textAlign = "center";
      if (st === SS.RIGHT) el.style.textAlign = "right";
      el.textContent = c.text || "";
    }
    return;
  }

  if (upper === "LISTBOX") {
    el.classList.add("ctl-listbox");
    el.innerHTML = "<div class='list-item'>Item 1</div><div class='list-item'>Item 2</div>";
    return;
  }

  if (upper === "COMBOBOX") {
    el.classList.add("ctl-combobox");
    el.innerHTML = `<span class="combo-text"></span><span class="combo-arrow">▼</span>`;
    el.querySelector(".combo-text").textContent = c.text || "";
    return;
  }

  if (upper === "SCROLLBAR") {
    el.classList.add("ctl-scrollbar");
    return;
  }

  el.classList.add("ctl-unknown");
  el.textContent = c.text || cls;
}

function cssSafe(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "_");
}
