// js/ui/preferences-dialog.js — Preferences modal (Undo, SpeedBar, Grid, Backups)
import { saveDesktop } from "../core/app-state.js";

/**
 * @param {import('./window-manager.js').WindowManager} wm
 * @param {import('../core/project-model.js').ProjectModel} project
 * @param {{
 *   speedBarMode?: string,
 *   gridSnap?: boolean,
 *   onApply?: (prefs: object) => void
 * }} [opts]
 */
export function openPreferencesDialog(wm, project, opts = {}) {
  const winId = "preferences";
  if (wm.windows.has(winId)) { wm.focus(winId); return wm.windows.get(winId).api; }

  const win = wm.createWindow({
    id: winId,
    title: "Preferences",
    x: 200, y: 80, w: 380, h: 320,
    modal: true,
  });

  const root = document.createElement("div");
  root.className = "style-dialog";

  const undoLimit = project.undo.limit;
  const sbMode = opts.speedBarMode || "horizontal";
  const gridSnap = opts.gridSnap !== false;

  root.innerHTML = `
    <fieldset style="margin-bottom:8px">
      <legend>Undo</legend>
      <div class="style-row">
        <label>Undo levels</label>
        <input type="range" class="fld-undo" min="1" max="99" value="${undoLimit}" style="flex:1" />
        <span class="undo-val">${undoLimit}</span>
      </div>
    </fieldset>
    <fieldset style="margin-bottom:8px">
      <legend>SpeedBar</legend>
      <div class="style-row">
        <label>Mode</label>
        <select class="fld-sbmode">
          <option value="off" ${sbMode==="off"?"selected":""}>Off</option>
          <option value="popup" ${sbMode==="popup"?"selected":""}>Popup</option>
          <option value="horizontal" ${sbMode==="horizontal"?"selected":""}>Horizontal</option>
          <option value="vertical" ${sbMode==="vertical"?"selected":""}>Vertical</option>
        </select>
      </div>
    </fieldset>
    <fieldset style="margin-bottom:8px">
      <legend>Grid</legend>
      <div class="style-row">
        <label>Snap to grid</label>
        <input type="checkbox" class="fld-gridsnap" ${gridSnap?"checked":""} />
      </div>
    </fieldset>
    <fieldset style="margin-bottom:8px">
      <legend>Save</legend>
      <div class="style-row">
        <label>Backup (~)</label>
        <input type="checkbox" class="fld-backup" />
      </div>
    </fieldset>
    <div class="style-actions">
      <button type="button" class="win-btn btn-ok">OK</button>
      <button type="button" class="win-btn btn-cancel">Cancel</button>
    </div>
  `;

  // live undo value display
  const undoRange = root.querySelector(".fld-undo");
  const undoVal = root.querySelector(".undo-val");
  undoRange.addEventListener("input", () => { undoVal.textContent = undoRange.value; });

  root.querySelector(".btn-cancel").onclick = () => win.close();
  root.querySelector(".btn-ok").onclick = () => {
    const levels = parseInt(undoRange.value, 10) || 10;
    const mode = root.querySelector(".fld-sbmode").value;
    const snap = root.querySelector(".fld-gridsnap").checked;
    const backup = root.querySelector(".fld-backup").checked;

    project.undo.setLimit(levels);
    opts.onApply?.({ speedBarMode: mode, gridSnap: snap, undoLimit: levels, backup });
    win.close();
  };

  win.content.innerHTML = "";
  win.content.appendChild(root);
  return win;
}
