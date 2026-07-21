/**
 * Identifiers Window — list/edit #define names and values.
 */

/**
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {import('../core/project-model.js').ProjectModel} project
 */
export function openIdentifiersWindow(wm, project) {
  const winId = "identifiers";
  if (wm.windows.has(winId)) {
    wm.focus(winId);
    return wm.windows.get(winId).api;
  }

  let unsub = null;
  /** @type {string|null} */
  let selectedName = null;

  const win = wm.createWindow({
    id: winId,
    title: "Identifiers",
    x: 400,
    y: 60,
    w: 420,
    h: 360,
    onClose: () => {
      if (unsub) unsub();
    },
  });

  const root = document.createElement("div");
  root.className = "identifiers-window";
  root.innerHTML = `
    <div class="id-list-wrap">
      <table class="id-table">
        <thead><tr><th>Name</th><th>Value</th><th>Usage</th></tr></thead>
        <tbody class="id-tbody"></tbody>
      </table>
    </div>
    <div class="id-detail">
      <div class="style-row"><label>Name</label><input type="text" class="fld-name" /></div>
      <div class="style-row"><label>Value</label><input type="number" class="fld-value" /></div>
      <div class="style-row"><label>Usage</label><input type="text" class="fld-usage" readonly /></div>
      <div class="id-actions">
        <button type="button" class="win-btn btn-apply">Apply</button>
        <button type="button" class="win-btn btn-new">New</button>
      </div>
    </div>
  `;

  const tbody = root.querySelector(".id-tbody");
  const fldName = root.querySelector(".fld-name");
  const fldValue = root.querySelector(".fld-value");
  const fldUsage = root.querySelector(".fld-usage");

  function refresh() {
    const usage = project.recomputeUsage();
    const list = project.identifiers.list();
    tbody.innerHTML = "";
    for (const id of list) {
      const tr = document.createElement("tr");
      tr.dataset.name = id.name;
      if (id.name === selectedName) tr.classList.add("selected");
      const u = usage.get(id.name);
      const usageText = u && u.length ? u.join(", ") : "(unused)";
      tr.innerHTML = `<td>${escapeHtml(id.name)}</td><td>${id.value}</td><td>${escapeHtml(usageText)}</td>`;
      tr.addEventListener("click", () => {
        selectedName = id.name;
        fldName.value = id.name;
        fldValue.value = String(id.value);
        fldUsage.value = usageText;
        refresh();
      });
      tbody.appendChild(tr);
    }
    if (selectedName) {
      const id = project.identifiers.getByName(selectedName);
      if (id) {
        fldName.value = id.name;
        fldValue.value = String(id.value);
        const u = usage.get(id.name);
        fldUsage.value = u && u.length ? u.join(", ") : "(unused)";
      } else {
        selectedName = null;
      }
    }
  }

  root.querySelector(".btn-apply").onclick = () => {
    if (!selectedName) return;
    const newName = fldName.value.trim();
    const newVal = parseInt(fldValue.value, 10);
    if (!newName) return;
    if (newName !== selectedName) {
      try {
        project.renameIdentifier(selectedName, newName);
        selectedName = newName;
      } catch (e) {
        alert(String(e.message || e));
        return;
      }
    }
    if (!Number.isNaN(newVal)) {
      project.setIdentifierValue(selectedName, newVal);
    }
    refresh();
  };

  root.querySelector(".btn-new").onclick = () => {
    const { name, value } = project.identifiers.nextId("IDC_");
    project.identifiers.define(name, value);
    project.undo.push({
      label: "New id",
      undo: () => {
        project.identifiers.remove(name);
        project._emit();
      },
      redo: () => {
        project.identifiers.define(name, value);
        project._emit();
      },
    });
    project._emit();
    selectedName = name;
    refresh();
  };

  unsub = project.subscribe(refresh);
  win.content.innerHTML = "";
  win.content.appendChild(root);
  refresh();
  return win;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
