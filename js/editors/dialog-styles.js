/**
 * Window / Control Style modal dialog.
 */
import { WS, DS, BS, ES, SS, CBS, LBS } from "../core/constants.js";

/**
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {object} target — dialog or control
 * @param {"dialog"|"control"} kind
 * @param {(props: object) => void} onApply
 */
export function openStyleDialog(wm, target, kind, onApply) {
  const winId = "style-dialog";
  // close existing
  if (wm.windows.has(winId)) wm.close(winId);

  const win = wm.createWindow({
    id: winId,
    title: kind === "dialog" ? "Dialog Styles" : "Control Styles",
    x: 160,
    y: 80,
    w: 360,
    h: 420,
    modal: true,
  });

  const root = document.createElement("div");
  root.className = "style-dialog";

  const idVal = target.id != null ? String(target.id) : "";
  const captionVal =
    kind === "dialog"
      ? target.title ?? ""
      : target.text ?? "";
  const classVal = target.className != null ? String(target.className) : "";

  root.innerHTML = `
    <div class="style-row">
      <label>ID</label>
      <input type="text" class="fld-id" value="${escapeAttr(idVal)}" />
    </div>
    <div class="style-row">
      <label>${kind === "dialog" ? "Caption" : "Text"}</label>
      <input type="text" class="fld-caption" value="${escapeAttr(captionVal)}" />
    </div>
    <div class="style-row">
      <label>Class</label>
      <input type="text" class="fld-class" value="${escapeAttr(classVal)}" />
    </div>
    <div class="style-flags"></div>
    <div class="style-actions">
      <button type="button" class="win-btn btn-ok">OK</button>
      <button type="button" class="win-btn btn-cancel">Cancel</button>
    </div>
  `;

  const flagsEl = root.querySelector(".style-flags");
  const style = (target.style || 0) >>> 0;

  /** @type {{name:string, bit:number}[]} */
  const flags = [];
  flags.push(
    { name: "WS_VISIBLE", bit: WS.VISIBLE },
    { name: "WS_DISABLED", bit: WS.DISABLED },
    { name: "WS_TABSTOP", bit: WS.TABSTOP },
    { name: "WS_GROUP", bit: WS.GROUP },
    { name: "WS_BORDER", bit: WS.BORDER },
    { name: "WS_VSCROLL", bit: WS.VSCROLL },
    { name: "WS_HSCROLL", bit: WS.HSCROLL }
  );

  if (kind === "dialog") {
    flags.push(
      { name: "WS_CAPTION", bit: WS.CAPTION },
      { name: "WS_SYSMENU", bit: WS.SYSMENU },
      { name: "WS_POPUP", bit: WS.POPUP },
      { name: "WS_THICKFRAME", bit: WS.THICKFRAME },
      { name: "DS_MODALFRAME", bit: DS.MODALFRAME },
      { name: "DS_SETFONT", bit: DS.SETFONT },
      { name: "DS_CENTER", bit: DS.CENTER }
    );
  } else {
    const cls = String(target.className || "").toUpperCase();
    if (cls === "BUTTON") {
      flags.push(
        { name: "BS_PUSHBUTTON", bit: BS.PUSHBUTTON },
        { name: "BS_DEFPUSHBUTTON", bit: BS.DEFPUSHBUTTON },
        { name: "BS_CHECKBOX", bit: BS.CHECKBOX },
        { name: "BS_AUTOCHECKBOX", bit: BS.AUTOCHECKBOX },
        { name: "BS_RADIOBUTTON", bit: BS.RADIOBUTTON },
        { name: "BS_AUTORADIOBUTTON", bit: BS.AUTORADIOBUTTON },
        { name: "BS_GROUPBOX", bit: BS.GROUPBOX }
      );
    } else if (cls === "EDIT") {
      flags.push(
        { name: "ES_LEFT", bit: ES.LEFT },
        { name: "ES_CENTER", bit: ES.CENTER },
        { name: "ES_RIGHT", bit: ES.RIGHT },
        { name: "ES_MULTILINE", bit: ES.MULTILINE },
        { name: "ES_PASSWORD", bit: ES.PASSWORD },
        { name: "ES_READONLY", bit: ES.READONLY },
        { name: "ES_AUTOHSCROLL", bit: ES.AUTOHSCROLL }
      );
    } else if (cls === "STATIC") {
      flags.push(
        { name: "SS_LEFT", bit: SS.LEFT },
        { name: "SS_CENTER", bit: SS.CENTER },
        { name: "SS_RIGHT", bit: SS.RIGHT },
        { name: "SS_ICON", bit: SS.ICON },
        { name: "SS_ETCHEDFRAME", bit: SS.ETCHEDFRAME },
        { name: "SS_NOPREFIX", bit: SS.NOPREFIX }
      );
    } else if (cls === "COMBOBOX") {
      flags.push(
        { name: "CBS_SIMPLE", bit: CBS.SIMPLE },
        { name: "CBS_DROPDOWN", bit: CBS.DROPDOWN },
        { name: "CBS_DROPDOWNLIST", bit: CBS.DROPDOWNLIST }
      );
    } else if (cls === "LISTBOX") {
      flags.push(
        { name: "LBS_NOTIFY", bit: LBS.NOTIFY },
        { name: "LBS_SORT", bit: LBS.SORT },
        { name: "LBS_MULTIPLESEL", bit: LBS.MULTIPLESEL }
      );
    }
  }

  // Deduplicate by name
  const seen = new Set();
  for (const f of flags) {
    if (seen.has(f.name)) continue;
    seen.add(f.name);
    const lab = document.createElement("label");
    lab.className = "flag-check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.bit = String(f.bit >>> 0);
    cb.dataset.name = f.name;
    // For low-byte exclusive styles (BS_*), check equality on low byte when bit < 0x20
    if (f.bit < 0x20 && (f.name.startsWith("BS_") || f.name.startsWith("SS_") || f.name.startsWith("ES_") || f.name.startsWith("CBS_"))) {
      if (f.name.startsWith("BS_")) cb.checked = (style & 0x0f) === f.bit;
      else if (f.name.startsWith("SS_")) cb.checked = (style & 0x1f) === f.bit;
      else if (f.name.startsWith("ES_")) cb.checked = (style & 0x03) === f.bit || (style & f.bit) === f.bit;
      else if (f.name.startsWith("CBS_")) cb.checked = (style & 0x03) === f.bit;
    } else {
      cb.checked = f.bit !== 0 && (style & f.bit) === f.bit;
    }
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(" " + f.name));
    flagsEl.appendChild(lab);
  }

  root.querySelector(".btn-cancel").onclick = () => win.close();
  root.querySelector(".btn-ok").onclick = () => {
    const newId = root.querySelector(".fld-id").value.trim();
    const caption = root.querySelector(".fld-caption").value;
    const className = root.querySelector(".fld-class").value.trim();

    let newStyle = style;
    // Apply WS_/DS_ bit flags first
    for (const cb of flagsEl.querySelectorAll("input[type=checkbox]")) {
      const bit = parseInt(cb.dataset.bit, 10) >>> 0;
      const name = cb.dataset.name;
      const exclusive =
        (name.startsWith("BS_") && bit <= 0x0f) ||
        (name.startsWith("SS_") && bit <= 0x1f) ||
        (name.startsWith("CBS_") && bit <= 0x03);

      if (exclusive) {
        if (cb.checked) {
          if (name.startsWith("BS_")) newStyle = (newStyle & ~0x0f) | bit;
          else if (name.startsWith("SS_")) newStyle = (newStyle & ~0x1f) | bit;
          else if (name.startsWith("CBS_")) newStyle = (newStyle & ~0x03) | bit;
        }
      } else {
        if (cb.checked) newStyle = (newStyle | bit) >>> 0;
        else newStyle = (newStyle & ~bit) >>> 0;
      }
    }

    /** @type {object} */
    const props = { style: newStyle | 0 };
    if (kind === "dialog") {
      props.title = caption;
      props.className = className || null;
      if (newId) props.id = /^\d+$/.test(newId) ? parseInt(newId, 10) : newId;
    } else {
      props.text = caption;
      props.className = className || target.className;
      if (newId) props.id = /^\d+$/.test(newId) ? parseInt(newId, 10) : newId;
      props.groupStart = !!(newStyle & WS.GROUP);
    }
    onApply(props);
    win.close();
  };

  win.content.innerHTML = "";
  win.content.appendChild(root);
  return win;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
