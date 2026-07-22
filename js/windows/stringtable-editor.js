/**
 * String Table Editor — view/edit STRINGTABLE resources.
 */

/**
 * @param {import("../ui/window-manager.js").WindowManager} wm
 * @param {import("../core/project-model.js").ProjectModel} project
 * @param {object} resource — the OpaqueResource with type STRINGTABLE
 */
export function openStringTableEditor(wm, project, resource) {
  const winId = "stringtable-" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const win = wm.createWindow({
    id: winId,
    title: "String Table: " + resource.id,
    x: 120, y: 80, w: 500, h: 400,
    modal: true,
  });

  const root = document.createElement("div");
  root.className = "stringtable-editor";
  root.innerHTML = \`
    <div style="padding:4px;display:flex;flex-direction:column;height:100%;gap:4px;">
      <div style="display:flex;gap:4px;align-items:center;">
        <span style="font-weight:bold;font-size:11px">ID</span>
        <span style="font-weight:bold;font-size:11px;flex:1">String</span>
      </div>
      <div class="st-rows" style="flex:1;overflow-y:auto;border:1px solid var(--shadow);"></div>
      <div style="display:flex;gap:4px;justify-content:flex-end;">
        <button type="button" class="win-btn st-add">+ Add</button>
        <button type="button" class="win-btn st-save">Save</button>
        <button type="button" class="win-btn st-cancel">Cancel</button>
      </div>
    </div>
  \`;

  const rowsEl = root.querySelector(".st-rows");
  const entries = parseStringTable(resource.rawText || "");

  function render() {
    rowsEl.innerHTML = "";
    for (let i = 0; i < entries.length; i++) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:4px;padding:2px 0;border-bottom:1px solid var(--shadow);";
      row.innerHTML = \`
        <input type="text" class="st-id" value="\${entries[i].id}" style="width:120px;font-size:11px" />
        <input type="text" class="st-val" value="\${entries[i].value}" style="flex:1;font-size:11px" />
        <button type="button" class="win-btn st-del" style="min-width:30px;padding:0 6px;">X</button>
      \`;
      row.querySelector(".st-del").onclick = () => { entries.splice(i, 1); render(); };
      row.querySelector(".st-id").onchange = (e) => { entries[i].id = e.target.value; };
      row.querySelector(".st-val").onchange = (e) => { entries[i].value = e.target.value; };
      rowsEl.appendChild(row);
    }
  }

  root.querySelector(".st-add").onclick = () => {
    entries.push({ id: "IDS_NEW", value: "string" });
    render();
  };

  root.querySelector(".st-save").onclick = () => {
    resource.rawText = buildStringTable(resource.id, entries);
    project._emit();
    win.close();
  };

  root.querySelector(".st-cancel").onclick = () => win.close();

  render();
  win.content.innerHTML = "";
  win.content.appendChild(root);
}

function parseStringTable(raw) {
  const entries = [];
  const m = raw.match(/BEGIN\s*([\s\S]*?)\s*END/i);
  if (!m) return entries;
  const body = m[1];
  const re = /(\S+)\s+"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    entries.push({ id: match[1], value: match[2] });
  }
  return entries;
}

function buildStringTable(id, entries) {
  let s = id + " STRINGTABLE\nBEGIN\n";
  for (const e of entries) {
    s += "    " + e.id + ' "' + e.value.replace(/"/g, '\\"') + '"\n';
  }
  s += "END\n";
  return s;
}
