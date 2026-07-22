/**
 * Align / Size modal dialogs for selected controls.
 */

/**
 * Open the Align dialog.
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {Set<object>} selection
 * @param {object} dialog
 * @param {import('../core/project-model.js').ProjectModel} project
 * @param {()=>void} repaint
 */
export function openAlignDialog(wm, selection, dialog, project, repaint) {
  const winId = "align-dialog";
  if (wm.windows.has(winId)) wm.close(winId);
  if (!selection || selection.size < 2) return;

  const win = wm.createWindow({
    id: winId,
    title: "Align Controls",
    x: 200, y: 120, w: 300, h: 340,
    modal: true,
  });

  const root = document.createElement("div");
  root.className = "align-dialog";
  root.innerHTML = 
    <fieldset>
      <legend>Horizontal</legend>
      <label><input type="radio" name="align-h" value="left" checked /> Align Left Edges</label>
      <label><input type="radio" name="align-h" value="center" /> Align Center Horizontally</label>
      <label><input type="radio" name="align-h" value="right" /> Align Right Edges</label>
      <label><input type="radio" name="align-h" value="none" /> No Change</label>
    </fieldset>
    <fieldset>
      <legend>Vertical</legend>
      <label><input type="radio" name="align-v" value="top" checked /> Align Top Edges</label>
      <label><input type="radio" name="align-v" value="middle" /> Align Middle Vertically</label>
      <label><input type="radio" name="align-v" value="bottom" /> Align Bottom Edges</label>
      <label><input type="radio" name="align-v" value="none" /> No Change</label>
    </fieldset>
    <div class="align-actions">
      <button type="button" class="win-btn btn-ok">OK</button>
      <button type="button" class="win-btn btn-cancel">Cancel</button>
    </div>
  ;

  root.querySelector(".btn-cancel").onclick = () => win.close();
  root.querySelector(".btn-ok").onclick = () => {
    const sel = [...selection];
    const ref = sel[0];
    const hMode = root.querySelector('input[name="align-h"]:checked').value;
    const vMode = root.querySelector('input[name="align-v"]:checked').value;

    const before = sel.map((c) => ({ c, x: c.x, y: c.y, cx: c.cx, cy: c.cy }));

    for (let i = 1; i < sel.length; i++) {
      const c = sel[i];
      let props = {};
      if (hMode === "left") props.x = ref.x;
      else if (hMode === "right") props.x = ref.x + ref.cx - c.cx;
      else if (hMode === "center") props.x = ref.x + Math.round((ref.cx - c.cx) / 2);

      if (vMode === "top") props.y = ref.y;
      else if (vMode === "bottom") props.y = ref.y + ref.cy - c.cy;
      else if (vMode === "middle") props.y = ref.y + Math.round((ref.cy - c.cy) / 2);

      if (Object.keys(props).length) project.moveResizeControl(c, props);
    }

    const after = sel.map((c) => ({ c, x: c.x, y: c.y, cx: c.cx, cy: c.cy }));
    project.undo.push({
      label: "Align",
      undo: () => { before.forEach((o) => { o.c.x = o.x; o.c.y = o.y; o.c.cx = o.cx; o.c.cy = o.cy; }); project._emit(); },
      redo: () => { after.forEach((o) => { o.c.x = o.x; o.c.y = o.y; o.c.cx = o.cx; o.c.cy = o.cy; }); project._emit(); },
    });

    repaint();
    win.close();
  };

  win.content.innerHTML = "";
  win.content.appendChild(root);
}

/**
 * Open the Size dialog.
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {Set<object>} selection
 * @param {object} dialog
 * @param {import('../core/project-model.js').ProjectModel} project
 * @param {()=>void} repaint
 */
export function openSizeDialog(wm, selection, dialog, project, repaint) {
  const winId = "size-dialog";
  if (wm.windows.has(winId)) wm.close(winId);
  if (!selection || selection.size < 2) return;

  const win = wm.createWindow({
    id: winId,
    title: "Size Controls",
    x: 200, y: 120, w: 280, h: 260,
    modal: true,
  });

  const root = document.createElement("div");
  root.className = "size-dialog";
  root.innerHTML = 
    <fieldset>
      <legend>Set size of selected to match first selected</legend>
      <label><input type="radio" name="size-mode" value="width" checked /> Same Width</label>
      <label><input type="radio" name="size-mode" value="height" /> Same Height</label>
      <label><input type="radio" name="size-mode" value="both" /> Same Width &amp; Height</label>
    </fieldset>
    <div class="align-actions">
      <button type="button" class="win-btn btn-ok">OK</button>
      <button type="button" class="win-btn btn-cancel">Cancel</button>
    </div>
  ;

  root.querySelector(".btn-cancel").onclick = () => win.close();
  root.querySelector(".btn-ok").onclick = () => {
    const sel = [...selection];
    const ref = sel[0];
    const mode = root.querySelector('input[name="size-mode"]:checked').value;

    const before = sel.map((c) => ({ c, x: c.x, y: c.y, cx: c.cx, cy: c.cy }));

    for (let i = 1; i < sel.length; i++) {
      const c = sel[i];
      let props = {};
      if (mode === "width" || mode === "both") props.cx = ref.cx;
      if (mode === "height" || mode === "both") props.cy = ref.cy;
      if (Object.keys(props).length) project.moveResizeControl(c, props);
    }

    const after = sel.map((c) => ({ c, x: c.x, y: c.y, cx: c.cx, cy: c.cy }));
    project.undo.push({
      label: "Size",
      undo: () => { before.forEach((o) => { o.c.x = o.x; o.c.y = o.y; o.c.cx = o.cx; o.c.cy = o.cy; }); project._emit(); },
      redo: () => { after.forEach((o) => { o.c.x = o.x; o.c.y = o.y; o.c.cx = o.cx; o.c.cy = o.cy; }); project._emit(); },
    });

    repaint();
    win.close();
  };

  win.content.innerHTML = "";
  win.content.appendChild(root);
}