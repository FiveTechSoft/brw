/**
 * Script editor — text editor for opaque resources (MENU, RCDATA, etc.)
 * Provides syntax-highlighted RC text editing with save-back to project.
 */

/**
 * Open a script/text editor for any resource with rawText.
 */
export function openScriptEditor(wm, project, resource) {
  const winId = "script-editor:" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const win = wm.createWindow({
    id: winId,
    title: resource.type + " (text) : " + resource.id,
    x: 160, y: 80, w: 520, h: 400,
  });

  const root = document.createElement("div");
  root.className = "script-editor";

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";
  const btnSave = document.createElement("button");
  btnSave.type = "button"; btnSave.className = "win-btn"; btnSave.textContent = "Save";
  const btnRevert = document.createElement("button");
  btnRevert.type = "button"; btnRevert.className = "win-btn"; btnRevert.textContent = "Revert";
  toolbar.append(btnSave, btnRevert);

  // Textarea
  const ta = document.createElement("textarea");
  ta.className = "script-textarea";
  ta.value = resource.rawText || "";
  ta.spellcheck = false;

  // Status
  const status = document.createElement("div");
  status.className = "editor-status";
  function updateStatus() {
    const lines = ta.value.split("\\n").length;
    status.textContent = lines + " lines | " + ta.value.length + " chars";
  }
  updateStatus();
  ta.addEventListener("input", updateStatus);

  let dirty = false;
  ta.addEventListener("input", () => { dirty = true; });

  btnSave.onclick = () => {
    resource.rawText = ta.value;
    project._emit();
    dirty = false;
    status.textContent = "Saved";
  };

  btnRevert.onclick = () => {
    ta.value = resource.rawText || "";
    dirty = false;
    updateStatus();
  };

  root.appendChild(toolbar);
  root.appendChild(ta);
  root.appendChild(status);
  win.content.innerHTML = "";
  win.content.appendChild(root);
}

