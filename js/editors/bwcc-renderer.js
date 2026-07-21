/**
 * BWCC (Borland Windows Custom Controls) paint helpers.
 */
import { STD_ID } from "../core/constants.js";

/** Glyph art by resolved numeric control ID */
const BORBTN_GLYPHS = {
  [STD_ID.IDOK]: { symbol: "✓", color: "#008000", title: "OK" },
  [STD_ID.IDCANCEL]: { symbol: "✗", color: "#c00000", title: "Cancel" },
  [STD_ID.IDABORT]: { symbol: "⛔", color: "#800000", title: "Abort" },
  [STD_ID.IDRETRY]: { symbol: "↻", color: "#000080", title: "Retry" },
  [STD_ID.IDIGNORE]: { symbol: "55", color: "#808000", title: "Ignore" },
  [STD_ID.IDYES]: { symbol: "✓", color: "#008000", title: "Yes" },
  [STD_ID.IDNO]: { symbol: "⊘", color: "#c00000", title: "No" },
  [STD_ID.IDHELP]: { symbol: "?", color: "#0000c0", title: "Help" },
};

/**
 * @param {HTMLElement} el
 * @param {import('../core/project-model.js').Control} control
 * @param {import('../core/project-model.js').ProjectModel|null} [project]
 */
export function paintBorControl(el, control, project = null) {
  const cls = String(control.className || "");
  el.classList.add("bwcc-ctl", `bwcc-${cls}`);

  if (cls === "BorBtn" || cls === "borbtn") {
    paintBorBtn(el, control, project);
    return;
  }
  if (cls === "BorCheck" || cls === "borcheck") {
    el.classList.add("bor-check");
    el.innerHTML = `<span class="bor-check-box"></span><span class="bor-check-label"></span>`;
    el.querySelector(".bor-check-label").textContent = control.text || "";
    return;
  }
  if (cls === "BorRadio" || cls === "borradio") {
    el.classList.add("bor-radio");
    el.innerHTML = `<span class="bor-radio-dot"></span><span class="bor-radio-label"></span>`;
    el.querySelector(".bor-radio-label").textContent = control.text || "";
    return;
  }
  if (cls === "BorShade" || cls === "borshade") {
    el.classList.add("bor-shade");
    el.textContent = "";
    return;
  }
  if (cls === "BorStatic" || cls === "borstatic") {
    el.classList.add("bor-static");
    el.textContent = control.text || "";
    return;
  }
  // fallback
  el.textContent = control.text || cls;
}

/**
 * @param {HTMLElement} el
 * @param {import('../core/project-model.js').Control} control
 * @param {import('../core/project-model.js').ProjectModel|null} project
 */
function paintBorBtn(el, control, project) {
  el.classList.add("bor-btn");
  let numId = null;
  if (typeof control.id === "number") numId = control.id;
  else if (project?.identifiers) numId = project.identifiers.resolve(control.id);
  else if (/^\d+$/.test(String(control.id))) numId = parseInt(String(control.id), 10);

  const glyph = numId != null ? BORBTN_GLYPHS[numId] : null;
  if (glyph) {
    el.innerHTML = `<span class="bor-btn-glyph" style="color:${glyph.color}">${glyph.symbol}</span>`;
    el.title = glyph.title;
  } else {
    el.innerHTML = `<span class="bor-btn-glyph">•</span>`;
    el.title = String(control.id);
  }
}

/**
 * Apply bordlg canvas chrome class if needed.
 * @param {HTMLElement} canvas
 * @param {import('../core/project-model.js').DialogResource} dialog
 */
export function applyBordlgCanvas(canvas, dialog) {
  const cn = dialog.className ? String(dialog.className).toLowerCase() : "";
  if (cn === "bordlg") canvas.classList.add("bwcc-canvas");
  else canvas.classList.remove("bwcc-canvas");
}
