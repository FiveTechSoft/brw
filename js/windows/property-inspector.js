/**
 * Property Inspector â€” view/edit properties of the selected control.
 */
import { compileHeader } from "../engine/rc-compiler.js";
import { WS, BS, SS, ES } from "../core/constants.js";

/**
 * @param {import("../ui/window-manager.js").WindowManager} wm
 * @param {import("../core/project-model.js").ProjectModel} project
 * @param {{ getSelection: () => Set<object>, getDialog: () => object|null }} state
 */
export function openPropertyInspector(wm, project, state) {
  const winId = "property-inspector";
  if (wm.windows.has(winId)) {
    wm.focus(winId);
    return wm.windows.get(winId).api;
  }

  let unsub = null;

  const win = wm.createWindow({
    id: winId,
    title: "Properties",
    x: 60, y: 100, w: 300, h: 400,
    onClose: () => {
      if (unsub) unsub();
    },
  });

  const root = document.createElement("div");
  root.className = "property-inspector";
  root.innerHTML = `
    <div class="pi-no-sel" style="padding:8px;color:var(--dkshadow);">No control selected</div>
    <div class="pi-form" style="display:none;padding:4px;">
      <div class="style-row"><label>ID</label><input type="text" class="pi-id" /></div>
      <div class="style-row"><label>Class</label><input type="text" class="pi-class" /></div>
      <div class="style-row"><label>Text</label><input type="text" class="pi-text" /></div>
      <div class="style-row"><label>X</label><input type="number" class="pi-x" /></div>
      <div class="style-row"><label>Y</label><input type="number" class="pi-y" /></div>
      <div class="style-row"><label>Width</label><input type="number" class="pi-cx" /></div>
      <div class="style-row"><label>Height</label><input type="number" class="pi-cy" /></div>
      <div class="style-row"><label>Style</label><input type="text" class="pi-style" /></div>
      <div class="style-row"><label>ExStyle</label><input type="text" class="pi-exstyle" /></div>
      <div class="style-row"><label>TabIndex</label><input type="number" class="pi-tabindex" /></div>
      <div class="style-row" style="padding-top:8px">
        <button type="button" class="win-btn pi-apply">Apply</button>
      </div>
    </div>
  `;

  const noSel = root.querySelector(".pi-no-sel");
  const form = root.querySelector(".pi-form");
  const fldId = root.querySelector(".pi-id");
  const fldClass = root.querySelector(".pi-class");
  const fldText = root.querySelector(".pi-text");
  const fldX = root.querySelector(".pi-x");
  const fldY = root.querySelector(".pi-y");
  const fldCx = root.querySelector(".pi-cx");
  const fldCy = root.querySelector(".pi-cy");
  const fldStyle = root.querySelector(".pi-style");
  const fldExStyle = root.querySelector(".pi-exstyle");
  const fldTabIndex = root.querySelector(".pi-tabindex");

  function refresh() {
    const sel = state.getSelection();
    const dlg = state.getDialog();
    if (!sel || sel.size !== 1 || !dlg) {
      noSel.style.display = "";
      form.style.display = "none";
      return;
    }
    const c = [...sel][0];
    noSel.style.display = "none";
    form.style.display = "";
    fldId.value = String(c.id);
    // className dropdown
    const clsOpt = fldClass.querySelector(`option[value="${String(c.className)}"]`);
    if (clsOpt) fldClass.value = String(c.className);
    else fldClass.value = "BUTTON";
    fldText.value = String(c.text);
    fldX.value = String(c.x);
    fldY.value = String(c.y);
    fldCx.value = String(c.cx);
    fldCy.value = String(c.cy);
    fldStyle.value = "0x" + (c.style >>> 0).toString(16).padStart(8, "0");
    fldExStyle.value = "0x" + (c.exStyle >>> 0).toString(16).padStart(8, "0");
    fldTabIndex.value = String(c.tabIndex ?? 0);
    // WS checkboxes
    const wsMap = { VISIBLE: WS.VISIBLE, TABSTOP: WS.TABSTOP, DISABLED: WS.DISABLED, BORDER: WS.BORDER, VSCROLL: WS.VSCROLL, HSCROLL: WS.HSCROLL, GROUP: WS.GROUP };
    for (const [name, bit] of Object.entries(wsMap)) {
      const cb = root.querySelector(".pi-ws-" + name);
      if (cb) cb.checked = (c.style & bit) === bit;
    }
    // BS dropdown (low byte)
    const bsLow = c.style & 0xff;
    const bsOpt = root.querySelector(`.pi-bs option[value="${bsLow}"]`);
    if (bsOpt) root.querySelector(".pi-bs").value = String(bsLow);
  }

  root.querySelector(".pi-apply").onclick = () => {
    const sel = state.getSelection();
    const dlg = state.getDialog();
    if (!sel || sel.size !== 1 || !dlg) return;
    const c = [...sel][0];
    const id = fldId.value.trim();
    const cls = fldClass.value;
    const text = fldText.value;
    const x = parseInt(fldX.value, 10);
    const y = parseInt(fldY.value, 10);
    const cx = parseInt(fldCx.value, 10);
    const cy = parseInt(fldCy.value, 10);
    const tabIndex = parseInt(fldTabIndex.value, 10);

    if (!id || !cls) return;

    // Build style from WS checkboxes + BS dropdown + hex field
    const wsMap = { VISIBLE: WS.VISIBLE, TABSTOP: WS.TABSTOP, DISABLED: WS.DISABLED, BORDER: WS.BORDER, VSCROLL: WS.VSCROLL, HSCROLL: WS.HSCROLL, GROUP: WS.GROUP };
    let style = WS.CHILD;  // always set
    for (const [name, bit] of Object.entries(wsMap)) {
      const cb = root.querySelector(".pi-ws-" + name);
      if (cb && cb.checked) style |= bit;
    }
    // BS low byte from dropdown
    const bsVal = parseInt(root.querySelector(".pi-bs").value, 10) || 0;
    style = (style & ~0xff) | bsVal;
    // Override with hex field if user typed something custom
    const hexVal = parseInt(fldStyle.value, 16) || parseInt(fldStyle.value, 10);
    if (hexVal) style = hexVal;

    const exStyle = parseInt(fldExStyle.value, 16) || parseInt(fldExStyle.value, 10) || 0;

    // ID rename if changed
    if (id !== String(c.id) && typeof c.id === "string") {
      try {
        project.renameIdentifier(c.id, id);
      } catch (e) {
        // keep old id
      }
    }

    project.setControlProps(c, {
      className: cls,
      text,
      x, y, cx, cy,
      style, exStyle,
      tabIndex,
    });
  };

  unsub = project.subscribe(refresh);
  win.content.innerHTML = "";
  win.content.appendChild(root);
  refresh();
  return win;
}
