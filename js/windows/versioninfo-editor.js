/**
 * Version Info Editor — view/edit VERSIONINFO resources.
 */

/**
 * @param {import("../ui/window-manager.js").WindowManager} wm
 * @param {import("../core/project-model.js").ProjectModel} project
 * @param {object} resource
 */
export function openVersionInfoEditor(wm, project, resource) {
  const winId = "versioninfo-" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const win = wm.createWindow({
    id: winId,
    title: "Version Info: " + resource.id,
    x: 120, y: 80, w: 500, h: 450,
    modal: true,
  });

  const data = parseVersionInfo(resource.rawText || "");

  const root = document.createElement("div");
  root.className = "versioninfo-editor";
  root.innerHTML = `
    <div style="padding:4px;display:flex;flex-direction:column;height:100%;gap:4px;">
      <div class="vi-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <div><label style="font-size:10px">FILEVERSION</label><input type="text" class="vi-fv" value="${data.fileVersion}" style="width:100%;font-size:11px" /></div>
        <div><label style="font-size:10px">PRODUCTVERSION</label><input type="text" class="vi-pv" value="${data.productVersion}" style="width:100%;font-size:11px" /></div>
        <div><label style="font-size:10px">FILEOS</label><input type="text" class="vi-fos" value="${data.fileOs}" style="width:100%;font-size:11px" /></div>
        <div><label style="font-size:10px">FILETYPE</label><input type="text" class="vi-ft" value="${data.fileType}" style="width:100%;font-size:11px" /></div>
        <div><label style="font-size:10px">FILEFLAGS</label><input type="text" class="vi-ff" value="${data.fileFlags}" style="width:100%;font-size:11px" /></div>
        <div><label style="font-size:10px">FILEFLAGSMASK</label><input type="text" class="vi-ffm" value="${data.fileFlagsMask}" style="width:100%;font-size:11px" /></div>
      </div>
      <div style="font-weight:bold;font-size:11px;margin-top:4px;">StringFileInfo</div>
      <div class="vi-strings" style="flex:1;overflow-y:auto;border:1px solid var(--shadow);padding:2px;"></div>
      <div style="display:flex;gap:4px;justify-content:flex-end;">
        <button type="button" class="win-btn vi-save">Save</button>
        <button type="button" class="win-btn vi-cancel">Cancel</button>
      </div>
    </div>
  `;

  const stringsEl = root.querySelector(".vi-strings");

  function renderStrings() {
    stringsEl.innerHTML = "";
    for (let i = 0; i < data.strings.length; i++) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:4px;padding:2px 0;border-bottom:1px solid var(--shadow);";
      row.innerHTML = `
        <input type="text" class="vi-sk" value="${data.strings[i].key}" style="width:160px;font-size:11px" placeholder="Key" />
        <input type="text" class="vi-sv" value="${data.strings[i].val}" style="flex:1;font-size:11px" placeholder="Value" />
        <button type="button" class="win-btn vi-del" style="min-width:30px;padding:0 6px;">X</button>
      `;
      row.querySelector(".vi-del").onclick = () => { data.strings.splice(i, 1); renderStrings(); };
      row.querySelector(".vi-sk").onchange = (e) => { data.strings[i].key = e.target.value; };
      row.querySelector(".vi-sv").onchange = (e) => { data.strings[i].val = e.target.value; };
      stringsEl.appendChild(row);
    }
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "win-btn";
    addBtn.textContent = "+ Add";
    addBtn.style.cssText = "margin-top:4px;min-width:unset;padding:2px 8px;font-size:11px;";
    addBtn.onclick = () => { data.strings.push({ key: "NewKey", val: "value" }); renderStrings(); };
    stringsEl.appendChild(addBtn);
  }

  root.querySelector(".vi-save").onclick = () => {
    data.fileVersion = root.querySelector(".vi-fv").value;
    data.productVersion = root.querySelector(".vi-pv").value;
    data.fileOs = root.querySelector(".vi-fos").value;
    data.fileType = root.querySelector(".vi-ft").value;
    data.fileFlags = root.querySelector(".vi-ff").value;
    data.fileFlagsMask = root.querySelector(".vi-ffm").value;
    resource.rawText = buildVersionInfo(resource.id, data);
    project._emit();
    win.close();
  };

  root.querySelector(".vi-cancel").onclick = () => win.close();

  renderStrings();
  win.content.innerHTML = "";
  win.content.appendChild(root);
}

function parseVersionInfo(raw) {
  const d = { fileVersion: "", productVersion: "", fileOs: "VOS_NT_WINDOWS32", fileType: "VFT_APP", fileFlags: "0x0L", fileFlagsMask: "0x3fL", strings: [] };
  const fv = raw.match(/FILEVERSION\s+([^\n]+)/i);
  if (fv) d.fileVersion = fv[1].trim();
  const pv = raw.match(/PRODUCTVERSION\s+([^\n]+)/i);
  if (pv) d.productVersion = pv[1].trim();
  const fos = raw.match(/FILEOS\s+([^\n]+)/i);
  if (fos) d.fileOs = fos[1].trim();
  const ft = raw.match(/FILETYPE\s+([^\n]+)/i);
  if (ft) d.fileType = ft[1].trim();
  const ff = raw.match(/FILEFLAGS\s+([^\n]+)/i);
  if (ff) d.fileFlags = ff[1].trim();
  const ffm = raw.match(/FILEFLAGSMASK\s+([^\n]+)/i);
  if (ffm) d.fileFlagsMask = ffm[1].trim();

  // Extract VALUE entries from StringFileInfo
  const re = /VALUE\s+"([^"]+)",\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    d.strings.push({ key: m[1], val: m[2] });
  }
  return d;
}

function buildVersionInfo(id, data) {
  let s = id + " VERSIONINFO\n";
  if (data.fileVersion) s += " FILEVERSION " + data.fileVersion + "\n";
  if (data.productVersion) s += " PRODUCTVERSION " + data.productVersion + "\n";
  if (data.fileFlagsMask) s += " FILEFLAGSMASK " + data.fileFlagsMask + "\n";
  if (data.fileFlags) s += " FILEFLAGS " + data.fileFlags + "\n";
  if (data.fileOs) s += " FILEOS " + data.fileOs + "\n";
  if (data.fileType) s += " FILETYPE " + data.fileType + "\n";
  s += "BEGIN\n";
  s += "  BLOCK \"StringFileInfo\"\n";
  s += "  BEGIN\n";
  s += "    BLOCK \"040904E4\"\n";
  s += "    BEGIN\n";
  for (const e of data.strings) {
    s += '      VALUE "' + e.key + '", "' + e.val.replace(/"/g, '\\"') + '\0"\n';
  }
  s += "    END\n";
  s += "  END\n";
  s += "  BLOCK \"VarFileInfo\"\n";
  s += "  BEGIN\n";
  s += '    VALUE "Translation", 0x0409 0x04E4\n';
  s += "  END\n";
  s += "END\n";
  return s;
}
