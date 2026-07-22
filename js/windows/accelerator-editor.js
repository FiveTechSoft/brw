/**
 * Accelerator Editor — view/edit ACCELERATORS resources.
 */

/**
 * @param {import("../ui/window-manager.js").WindowManager} wm
 * @param {import("../core/project-model.js").ProjectModel} project
 * @param {object} resource
 */
export function openAcceleratorEditor(wm, project, resource) {
  const winId = "accel-" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const win = wm.createWindow({
    id: winId,
    title: "Accelerators: " + resource.id,
    x: 120, y: 80, w: 500, h: 380,
    modal: true,
  });

  const entries = parseAccelerators(resource.rawText || "");

  const root = document.createElement("div");
  root.className = "accel-editor";
  root.innerHTML = \`
    <div style="padding:4px;display:flex;flex-direction:column;height:100%;gap:4px;">
      <div style="display:flex;gap:4px;align-items:center;font-weight:bold;font-size:11px;">
        <span style="width:180px">Key</span>
        <span style="flex:1">Command ID</span>
        <span style="width:80px">Flags</span>
      </div>
      <div class="ac-rows" style="flex:1;overflow-y:auto;border:1px solid var(--shadow);"></div>
      <div style="display:flex;gap:4px;justify-content:flex-end;">
        <button type="button" class="win-btn ac-add">+ Add</button>
        <button type="button" class="win-btn ac-save">Save</button>
        <button type="button" class="win-btn ac-cancel">Cancel</button>
      </div>
    </div>
  \`;

  const rowsEl = root.querySelector(".ac-rows");

  function render() {
    rowsEl.innerHTML = "";
    for (let i = 0; i < entries.length; i++) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:4px;padding:2px 0;border-bottom:1px solid var(--shadow);";
      row.innerHTML = \`
        <input type="text" class="ac-key" value="\${entries[i].key}" style="width:180px;font-size:11px" />
        <input type="text" class="ac-cmd" value="\${entries[i].cmd}" style="flex:1;font-size:11px" />
        <input type="text" class="ac-flags" value="\${entries[i].flags}" style="width:80px;font-size:11px" />
        <button type="button" class="win-btn ac-del" style="min-width:30px;padding:0 6px;">X</button>
      \`;
      row.querySelector(".ac-del").onclick = () => { entries.splice(i, 1); render(); };
      row.querySelector(".ac-key").onchange = (e) => { entries[i].key = e.target.value; };
      row.querySelector(".ac-cmd").onchange = (e) => { entries[i].cmd = e.target.value; };
      row.querySelector(".ac-flags").onchange = (e) => { entries[i].flags = e.target.value; };
      rowsEl.appendChild(row);
    }
  }

  root.querySelector(".ac-add").onclick = () => {
    entries.push({ key: '\"Ctrl+K\"', cmd: "ID_COMMAND", flags: "" });
    render();
  };

  root.querySelector(".ac-save").onclick = () => {
    resource.rawText = buildAccelerators(resource.id, entries);
    project._emit();
    win.close();
  };

  root.querySelector(".ac-cancel").onclick = () => win.close();

  render();
  win.content.innerHTML = "";
  win.content.appendChild(root);
}

function parseAccelerators(raw) {
  const entries = [];
  const m = raw.match(/BEGIN\s*([\s\S]*?)\s*END/i);
  if (!m) return entries;
  const body = m[1].replace(/\\/g, "\\");
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match: "key", id, flags  or  VK_KEY, id, flags
    const parts = trimmed.split(",");
    if (parts.length < 2) continue;
    const key = parts[0].trim();
    const cmd = parts[1].trim().split(/\s+/)[0];
    const flags = parts.slice(2).join(",").trim();
    entries.push({ key, cmd, flags });
  }
  return entries;
}

function buildAccelerators(id, entries) {
  let s = id + " ACCELERATORS\nBEGIN\n";
  for (const e of entries) {
    s += "  " + e.key + ", " + e.cmd;
    if (e.flags) s += ", " + e.flags;
    s += "\n";
  }
  s += "END\n";
  return s;
}
