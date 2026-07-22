/**
 * Align / Size modal dialogs for selected controls.
 */

/**
 * Open the Align dialog.
 * @param {import("../ui/window-manager.js").WindowManager} wm
 * @param {Set<object>} selection
 * @param {object} dialog
 * @param {import("../core/project-model.js").ProjectModel} project
 * @param {()=>void} repaint
 */
export function openAlignDialog(wm, selection, dialog, project, repaint) {
  const winId = "align-dialog";
  if (wm.windows.has(winId)) wm.close(winId);
  if (!selection || selection.size < 2) return;

  const sel = [...selection];
  const ref = sel[0];

  const win = wm.createWindow({
    id: winId,
    title: "Align controls",
    x: 200, y: 120, w: 340, h: 210,
    modal: true,
  });

  const root = document.createElement("div");
  root.className = "align-dialog";
  root.innerHTML = `
    <div class="size-panels">
      <fieldset class="size-panel">
        <legend>Horizontal alignment</legend>
        <label><input type="radio" name="align-h" value="none" checked /> No change</label>
        <label><input type="radio" name="align-h" value="left" /> Left sides</label>
        <label><input type="radio" name="align-h" value="center" /> Centers</label>
        <label><input type="radio" name="align-h" value="right" /> Right sides</label>
        <label><input type="radio" name="align-h" value="space" /> Space equally</label>
        <label><input type="radio" name="align-h" value="dialog" /> Center in dialog</label>
      </fieldset>
      <fieldset class="size-panel">
        <legend>Vertical alignment</legend>
        <label><input type="radio" name="align-v" value="none" checked /> No change</label>
        <label><input type="radio" name="align-v" value="top" /> Tops</label>
        <label><input type="radio" name="align-v" value="middle" /> Centers</label>
        <label><input type="radio" name="align-v" value="bottom" /> Bottoms</label>
        <label><input type="radio" name="align-v" value="space" /> Space equally</label>
        <label><input type="radio" name="align-v" value="dialog" /> Center in dialog</label>
      </fieldset>
    </div>
    <div class="align-actions">
      <button type="button" class="win-btn btn-ok">OK</button>
      <button type="button" class="win-btn btn-cancel">Cancel</button>
    </div>
  `;

  root.querySelector(".btn-cancel").onclick = () => win.close();
  root.querySelector(".btn-ok").onclick = () => {
    const hMode = root.querySelector('input[name="align-h"]:checked').value;
    const vMode = root.querySelector('input[name="align-v"]:checked').value;

    const before = sel.map((c) => ({ c, x: c.x, y: c.y, cx: c.cx, cy: c.cy }));

    // --- Horizontal ---
    if (hMode === "left") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { x: ref.x });
      }
    } else if (hMode === "center") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { x: ref.x + Math.round((ref.cx - sel[i].cx) / 2) });
      }
    } else if (hMode === "right") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { x: ref.x + ref.cx - sel[i].cx });
      }
    } else if (hMode === "space") {
      if (sel.length >= 3) {
        const sorted = [...sel].sort((a, b) => a.x - b.x);
        const totalW = sorted.reduce((s, c) => s + c.cx, 0);
        const minX = sorted[0].x;
        const maxX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].cx;
        const space = Math.round((maxX - minX - totalW) / (sel.length - 1));
        let curX = minX;
        for (const c of sorted) {
          project.moveResizeControl(c, { x: curX });
          curX += c.cx + space;
        }
      }
    } else if (hMode === "dialog") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { x: Math.round((dialog.cx - sel[i].cx) / 2) });
      }
    }

    // --- Vertical ---
    if (vMode === "top") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { y: ref.y });
      }
    } else if (vMode === "middle") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { y: ref.y + Math.round((ref.cy - sel[i].cy) / 2) });
      }
    } else if (vMode === "bottom") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { y: ref.y + ref.cy - sel[i].cy });
      }
    } else if (vMode === "space") {
      if (sel.length >= 3) {
        const sorted = [...sel].sort((a, b) => a.y - b.y);
        const totalH = sorted.reduce((s, c) => s + c.cy, 0);
        const minY = sorted[0].y;
        const maxY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].cy;
        const space = Math.round((maxY - minY - totalH) / (sel.length - 1));
        let curY = minY;
        for (const c of sorted) {
          project.moveResizeControl(c, { y: curY });
          curY += c.cy + space;
        }
      }
    } else if (vMode === "dialog") {
      for (let i = 1; i < sel.length; i++) {
        project.moveResizeControl(sel[i], { y: Math.round((dialog.cy - sel[i].cy) / 2) });
      }
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
export function openSizeDialog(wm, selection, dialog, project, repaint) {
  const winId = "size-dialog";
  if (wm.windows.has(winId)) wm.close(winId);
  if (!selection || selection.size < 2) return;

  const sel = [...selection];
  const ref = sel[0];

  // Calculate min/max/diag values
  const widths = sel.map((c) => c.cx);
  const heights = sel.map((c) => c.cy);
  const smallestW = Math.min(...widths);
  const largestW = Math.max(...widths);
  const smallestH = Math.min(...heights);
  const largestH = Math.max(...heights);

  const win = wm.createWindow({
    id: winId,
    title: "Size controls",
    x: 200, y: 120, w: 340, h: 210,
    modal: true,
  });

  const root = document.createElement("div");
  root.className = "size-dialog";
  root.innerHTML = `
    <div class="size-panels">
      <fieldset class="size-panel">
        <legend>Horizontal size</legend>
        <label><input type="radio" name="size-h" value="none" checked /> No change</label>
        <label><input type="radio" name="size-h" value="shrink" /> Shrink to smallest</label>
        <label><input type="radio" name="size-h" value="grow" /> Grow to largest</label>
        <label><input type="radio" name="size-h" value="diag" /> Width of dialog</label>
        <label><input type="radio" name="size-h" value="custom" /> Enter values</label>
        <div class="size-custom-fields size-custom-h" style="display:none">
          <label>X <input type="number" class="size-field-x" value="" /></label>
          <label>CX <input type="number" class="size-field-cx" value="" /></label>
        </div>
      </fieldset>
      <fieldset class="size-panel">
        <legend>Vertical size</legend>
        <label><input type="radio" name="size-v" value="none" checked /> No change</label>
        <label><input type="radio" name="size-v" value="shrink" /> Shrink to smallest</label>
        <label><input type="radio" name="size-v" value="grow" /> Grow to largest</label>
        <label><input type="radio" name="size-v" value="diag" /> Height of dialog</label>
        <label><input type="radio" name="size-v" value="custom" /> Enter values</label>
        <div class="size-custom-fields size-custom-v" style="display:none">
          <label>Y <input type="number" class="size-field-y" value="" /></label>
          <label>CY <input type="number" class="size-field-cy" value="" /></label>
        </div>
      </fieldset>
    </div>
    <div class="align-actions">
      <button type="button" class="win-btn btn-ok">OK</button>
      <button type="button" class="win-btn btn-cancel">Cancel</button>
    </div>
  `;

  // Set initial values from reference control
  root.querySelector(".size-field-x").value = ref.x;
  root.querySelector(".size-field-cx").value = ref.cx;
  root.querySelector(".size-field-y").value = ref.y;
  root.querySelector(".size-field-cy").value = ref.cy;

  // Show/hide custom fields
  for (const radio of root.querySelectorAll('input[name="size-h"]')) {
    radio.addEventListener("change", () => {
      root.querySelector(".size-custom-h").style.display =
        radio.value === "custom" && radio.checked ? "" : "none";
    });
  }
  for (const radio of root.querySelectorAll('input[name="size-v"]')) {
    radio.addEventListener("change", () => {
      root.querySelector(".size-custom-v").style.display =
        radio.value === "custom" && radio.checked ? "" : "none";
    });
  }

  root.querySelector(".btn-cancel").onclick = () => win.close();
  root.querySelector(".btn-ok").onclick = () => {
    const hMode = root.querySelector('input[name="size-h"]:checked').value;
    const vMode = root.querySelector('input[name="size-v"]:checked').value;

    const before = sel.map((c) => ({ c, x: c.x, y: c.y, cx: c.cx, cy: c.cy }));

    for (let i = 0; i < sel.length; i++) {
      const c = sel[i];
      let props = {};

      // Horizontal
      if (hMode === "shrink") props.cx = smallestW;
      else if (hMode === "grow") props.cx = largestW;
      else if (hMode === "diag") props.cx = dialog.cx;
      else if (hMode === "custom") {
        const newCx = parseInt(root.querySelector(".size-field-cx").value, 10);
        if (!isNaN(newCx)) props.cx = newCx;
      }

      // Vertical
      if (vMode === "shrink") props.cy = smallestH;
      else if (vMode === "grow") props.cy = largestH;
      else if (vMode === "diag") props.cy = dialog.cy;
      else if (vMode === "custom") {
        const newCy = parseInt(root.querySelector(".size-field-cy").value, 10);
        if (!isNaN(newCy)) props.cy = newCy;
      }

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
