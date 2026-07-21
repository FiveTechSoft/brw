/**
 * Project Window — tree + preview, filters, DnD import.
 */
import { wireDrop } from "../ui/file-io.js";
import { renderDialog } from "../editors/dialog-renderer.js";

/**
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {import('../core/project-model.js').ProjectModel} project
 * @param {{
 *   onOpenResource?: (r: object) => void,
 *   onSelection?: (r: object|null) => void,
 *   loadProjectFiles?: (files: object[]) => void|Promise<void>
 * }} [hooks]
 */
export function openProjectWindow(wm, project, hooks = {}) {
  const winId = "project";
  if (wm.windows.has(winId)) {
    wm.focus(winId);
    return wm.windows.get(winId).api;
  }

  let unsub = null;
  /** @type {object|null} */
  let selected = null;

  const win = wm.createWindow({
    id: winId,
    title: "Project",
    x: 20,
    y: 20,
    w: 400,
    h: 440,
    onClose: () => {
      if (unsub) unsub();
    },
  });

  const root = document.createElement("div");
  root.className = "project-window";
  root.innerHTML = `
    <div class="project-toolbar">
      <label class="proj-filter"><input type="checkbox" data-f="showResources" /> Resources</label>
      <label class="proj-filter"><input type="checkbox" data-f="showIdentifiers" /> Identifiers</label>
      <label class="proj-filter"><input type="checkbox" data-f="showItems" /> Items</label>
      <label class="proj-filter"><input type="checkbox" data-f="showUnusedTypes" /> Unused Types</label>
      <select class="sort-mode">
        <option value="byType">By Type</option>
        <option value="byFile">By File</option>
      </select>
    </div>
    <div class="project-split">
      <div class="project-tree" tabindex="0"></div>
      <div class="project-preview"><div class="preview-label">Preview</div><div class="preview-body"></div></div>
    </div>
  `;

  const treeEl = root.querySelector(".project-tree");
  const previewBody = root.querySelector(".preview-body");
  const sortSel = root.querySelector(".sort-mode");

  // init filter checkboxes
  for (const cb of root.querySelectorAll(".proj-filter input")) {
    const key = cb.dataset.f;
    cb.checked = !!project.filters[key];
    cb.addEventListener("change", () => {
      project.filters[key] = cb.checked;
      project._emit();
    });
  }
  sortSel.value = project.sortMode || "byType";
  sortSel.addEventListener("change", () => {
    project.sortMode = sortSel.value;
    project._emit();
  });

  function rebuildTree() {
    treeEl.innerHTML = "";
    const f = project.filters;

    if (project.sortMode === "byFile") {
      buildByFile(treeEl, f);
    } else {
      buildByType(treeEl, f);
    }

    if (!project.resources.length && !project.identifiers.list().length) {
      const empty = document.createElement("div");
      empty.className = "tree-empty";
      empty.textContent = "Drop .rc / .h / .res files here";
      treeEl.appendChild(empty);
    }
  }

  function buildByType(parent, f) {
    if (f.showResources) {
      const dialogs = project.dialogs();
      if (dialogs.length || f.showUnusedTypes) {
        const node = typeNode("Dialog", dialogs.length);
        parent.appendChild(node.el);
        for (const d of dialogs) {
          node.children.appendChild(resourceNode(d, f));
        }
      }
      // other types
      const groups = new Map();
      for (const r of project.resources) {
        if (r.type === "DIALOG" || r.type === "DIALOGEX") continue;
        const t = r.type === "BINARY" ? `BINARY(${r.typeId})` : r.type;
        if (!groups.has(t)) groups.set(t, []);
        groups.get(t).push(r);
      }
      for (const [t, list] of groups) {
        const node = typeNode(t, list.length);
        parent.appendChild(node.el);
        for (const r of list) {
          node.children.appendChild(resourceNode(r, f));
        }
      }
      if (f.showUnusedTypes) {
        for (const t of ["Menu", "Accelerator", "String Table", "Bitmap", "Icon"]) {
          if (![...groups.keys()].some((k) => k.toUpperCase().includes(t.split(" ")[0].toUpperCase()))) {
            const node = typeNode(t + " (none)", 0);
            parent.appendChild(node.el);
          }
        }
      }
    }
    if (f.showIdentifiers) {
      const ids = project.identifiers.list();
      const node = typeNode("Identifiers", ids.length);
      parent.appendChild(node.el);
      for (const id of ids) {
        const el = document.createElement("div");
        el.className = "tree-item tree-id";
        el.textContent = `${id.name} = ${id.value}`;
        el.addEventListener("click", () => {
          selected = null;
          hooks.onSelection?.(null);
          highlight(el);
          previewBody.innerHTML = `<div class="preview-meta">${escapeHtml(id.name)} = ${id.value}</div>`;
        });
        node.children.appendChild(el);
      }
    }
  }

  function buildByFile(parent, f) {
    const byFile = new Map();
    for (const file of project.files) {
      if (!byFile.has(file.path)) byFile.set(file.path, []);
    }
    for (const r of project.resources) {
      const key = r.sourceFile || "(memory)";
      if (!byFile.has(key)) byFile.set(key, []);
      byFile.get(key).push(r);
    }
    // identifiers under resource.h
    if (f.showIdentifiers) {
      const hkey = "resource.h";
      if (!byFile.has(hkey)) byFile.set(hkey, []);
    }

    for (const [path, list] of byFile) {
      const node = typeNode(path, list.length);
      parent.appendChild(node.el);
      if (f.showResources) {
        for (const r of list) {
          node.children.appendChild(resourceNode(r, f));
        }
      }
      if (f.showIdentifiers && (path.endsWith(".h") || path === "resource.h")) {
        for (const id of project.identifiers.list()) {
          const el = document.createElement("div");
          el.className = "tree-item tree-id";
          el.textContent = `${id.name} = ${id.value}`;
          node.children.appendChild(el);
        }
      }
    }
  }

  function typeNode(label, count) {
    const el = document.createElement("div");
    el.className = "tree-type";
    const head = document.createElement("div");
    head.className = "tree-type-head";
    head.textContent = `${label}`;
    const children = document.createElement("div");
    children.className = "tree-children";
    el.appendChild(head);
    el.appendChild(children);
    head.addEventListener("click", () => {
      el.classList.toggle("collapsed");
    });
    void count;
    return { el, children };
  }

  function resourceNode(r, f) {
    const el = document.createElement("div");
    el.className = "tree-item tree-resource";
    const isDlg = r.type === "DIALOG" || r.type === "DIALOGEX";
    el.textContent = isDlg ? String(r.id) : `${r.type} ${r.id ?? r.nameId ?? ""}`;
    if (selected === r) el.classList.add("selected");

    el.addEventListener("click", () => {
      selected = r;
      highlight(el);
      hooks.onSelection?.(r);
      updatePreview(r);
    });
    el.addEventListener("dblclick", () => {
      selected = r;
      hooks.onOpenResource?.(r);
    });

    if (isDlg && f.showItems && r.controls) {
      const kids = document.createElement("div");
      kids.className = "tree-children";
      for (const c of r.controls) {
        const ci = document.createElement("div");
        ci.className = "tree-item tree-control";
        ci.textContent = `${c.id} (${c.className})`;
        kids.appendChild(ci);
      }
      const wrap = document.createElement("div");
      wrap.appendChild(el);
      wrap.appendChild(kids);
      return wrap;
    }
    return el;
  }

  function highlight(el) {
    treeEl.querySelectorAll(".tree-item.selected").forEach((n) => n.classList.remove("selected"));
    el.classList.add("selected");
  }

  function updatePreview(r) {
    previewBody.innerHTML = "";
    if (!r) return;
    if (r.type === "DIALOG" || r.type === "DIALOGEX") {
      const host = document.createElement("div");
      host.className = "preview-dialog";
      previewBody.appendChild(host);
      renderDialog(host, r, {
        interactive: false,
        scale: 0.75,
        project,
        showHandles: false,
      });
    } else if (r.type === "BINARY") {
      previewBody.innerHTML = `<div class="preview-meta">Binary type=${r.typeId} name=${r.nameId}<br/>${r.data?.byteLength || 0} bytes</div>`;
    } else {
      previewBody.innerHTML = `<div class="preview-meta"><pre>${escapeHtml((r.rawText || "").slice(0, 500))}</pre></div>`;
    }
  }

  wireDrop(root, (files) => {
    hooks.loadProjectFiles?.(files);
  });

  unsub = project.subscribe(() => {
    // sync filter UI
    for (const cb of root.querySelectorAll(".proj-filter input")) {
      cb.checked = !!project.filters[cb.dataset.f];
    }
    sortSel.value = project.sortMode || "byType";
    rebuildTree();
    if (selected && (selected.type === "DIALOG" || selected.type === "DIALOGEX")) {
      updatePreview(selected);
    }
    win.setTitle(project.name && project.name !== "Untitled" ? `Project - ${project.name}` : "Project");
  });

  win.content.innerHTML = "";
  win.content.appendChild(root);
  rebuildTree();
  return win;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
