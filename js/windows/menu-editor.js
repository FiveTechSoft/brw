/**
 * Menu resource editor — visual tree editor for MENU resources.
 * Parses rawText into tree, provides add/remove/reorder/edit, and regenerates RC text.
 * Supports: POPUP, MENUITEM, SEPARATOR, accelerator keys (\t), flags (MF_GRAYED, MF_CHECKED).
 */

/**
 * Parse a MENU rawText into a tree of items.
 * Each node: { type:"popup"|"menuitem"|"separator", label?, accelKey?, id?, flags:[], children? }
 */
function parseMenuText(raw) {
  const lines = raw.split(/\r?\n/);
  const root = { type: "root", children: [] };
  const stack = [root];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.toUpperCase() === "BEGIN" || t.toUpperCase() === "END") continue;
    const upper = t.toUpperCase();
    if (upper.startsWith("POPUP")) {
      const m = t.match(/POPUP\s+"([^"]*)"(?:\s*,\s*([\w|]+))?/i);
      if (m) {
        const flags = m[2] ? m[2].split("|").map(s => s.trim().toUpperCase()) : [];
        const node = { type: "popup", label: m[1], flags, children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
      }
    } else if (upper.startsWith("MENUITEM") && upper.includes("SEPARATOR")) {
      stack[stack.length - 1].children.push({ type: "separator", flags: [] });
    } else if (upper.startsWith("MENUITEM")) {
      const m = t.match(/MENUITEM\s+"([^"]*)"\s*,\s*(\S+)(?:\s*,\s*([\w|]+))?/i);
      if (m) {
        const label = m[1];
        const tabIdx = label.indexOf("\t");
        const mainLabel = tabIdx >= 0 ? label.substring(0, tabIdx) : label;
        const accelKey = tabIdx >= 0 ? label.substring(tabIdx + 1) : "";
        const flags = m[3] ? m[3].split("|").map(s => s.trim().toUpperCase()) : [];
        stack[stack.length - 1].children.push({ type: "menuitem", label: mainLabel, accelKey, id: m[2], flags });
      }
    } else if (upper === "END") {
      if (stack.length > 1) stack.pop();
    }
  }
  return root;
}

/**
 * Regenerate MENU RC text from tree.
 */
function generateMenuText(node, indent) {
  indent = indent || "";
  let out = "";
  const q = String.fromCharCode(34);
  if (node.type === "root") {
    for (const child of node.children) out += generateMenuText(child, indent);
  } else if (node.type === "popup") {
    let line = indent + "POPUP " + q + node.label + q;
    const activeFlags = (node.flags || []).filter(f => f !== "GRAYED" && f !== "INACTIVE");
    if (activeFlags.length) line += ", " + activeFlags.join(" | ");
    out += line + "\n";
    out += indent + "BEGIN\n";
    for (const child of (node.children || [])) out += generateMenuText(child, indent + "    ");
    out += indent + "END\n";
  } else if (node.type === "menuitem") {
    let menuItemLabel = node.label || "";
    if (node.accelKey) menuItemLabel += "\t" + node.accelKey;
    let line = indent + "MENUITEM " + q + menuItemLabel + q + ", " + (node.id || "0");
    const activeFlags = (node.flags || []);
    if (activeFlags.length) line += ", " + activeFlags.join(" | ");
    out += line + "\n";
  } else if (node.type === "separator") {
    out += indent + "MENUITEM SEPARATOR\n";
  }
  return out;
}

/** Find a node in the tree by reference, return { parent, index } or null */
function findInTree(root, node) {
  function search(parent) {
    if (!parent.children) return null;
    const idx = parent.children.indexOf(node);
    if (idx >= 0) return { parent, index: idx };
    for (const ch of parent.children) {
      const r = search(ch);
      if (r) return r;
    }
    return null;
  }
  return search(root);
}

function countMenuItems(n) {
  let c = 0;
  if (n.type === "menuitem" || n.type === "separator") c = 1;
  if (n.children) for (const ch of n.children) c += countMenuItems(ch);
  return c;
}

/**
 * Open a Menu Editor MDI window for the given MENU resource.
 */
export function openMenuEditor(wm, project, resource) {
  const winId = "menu-editor:" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const tree = parseMenuText(resource.rawText || "");
  let selectedNode = null;

  // Undo / redo
  const undoStack = [];
  const redoStack = [];
  function cloneTree() { return JSON.parse(JSON.stringify(tree)); }
  function pushUndo() {
    undoStack.push(cloneTree());
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(cloneTree());
    const prev = undoStack.pop();
    tree.children.length = 0;
    tree.children.push(...prev.children);
    selectedNode = null;
    renderTree();
    updateUndoButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(cloneTree());
    const next = redoStack.pop();
    tree.children.length = 0;
    tree.children.push(...next.children);
    selectedNode = null;
    renderTree();
    updateUndoButtons();
  }

  const win = wm.createWindow({
    id: winId,
    title: "MENU : " + resource.id,
    x: 100, y: 60, w: 640, h: 480,
  });

  const root = document.createElement("div");
  root.className = "menu-editor";

  // ── Toolbar ──
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";

  const btnUndo = mkBtn("Undo", () => undo());
  const btnRedo = mkBtn("Redo", () => redo());
  const btnSep1 = mkSep();
  const btnAdd = mkBtn("Add Item", () => addItem());
  const btnAddPopup = mkBtn("Add Popup", () => addPopup());
  const btnSep = mkBtn("Separator", () => addSeparator());
  const btnDel = mkBtn("Delete", () => deleteSelected());
  const btnSep2 = mkSep();
  const btnUp = mkBtn("Move Up", () => moveSelected(-1));
  const btnDown = mkBtn("Move Down", () => moveSelected(1));
  toolbar.append(btnUndo, btnRedo, btnSep1, btnAdd, btnAddPopup, btnSep, btnDel, btnSep2, btnUp, btnDown);

  function updateUndoButtons() {
    btnUndo.disabled = undoStack.length === 0;
    btnRedo.disabled = redoStack.length === 0;
  }
  updateUndoButtons();

  function mkBtn(label, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "win-btn"; b.textContent = label;
    b.onclick = fn;
    return b;
  }
  function mkSep() {
    const s = document.createElement("span");
    s.style.cssText = "display:inline-block;width:1px;height:20px;background:var(--shadow);margin:0 4px;vertical-align:middle;";
    return s;
  }

  // ── Split layout ──
  const split = document.createElement("div");
  split.className = "menu-editor-split";

  // Tree panel
  const treePanel = document.createElement("div");
  treePanel.className = "menu-tree-panel";
  const treeEl = document.createElement("div");
  treeEl.className = "menu-tree";
  treePanel.appendChild(treeEl);

  // Preview panel
  const previewPanel = document.createElement("div");
  previewPanel.className = "menu-preview-panel";
  const previewLabel = document.createElement("div");
  previewLabel.className = "menu-preview-label";
  previewLabel.textContent = "Menu Bar Preview";
  const previewBar = document.createElement("div");
  previewBar.className = "menu-preview-bar";
  previewPanel.append(previewLabel, previewBar);

  // Properties panel
  const propsPanel = document.createElement("div");
  propsPanel.className = "menu-props-panel";
  const propsTitle = document.createElement("div");
  propsTitle.className = "menu-props-title";
  propsTitle.textContent = "Properties";

  // Caption input
  const lblCaption = document.createElement("label");
  lblCaption.textContent = "Caption:";
  const propsInput = document.createElement("input");
  propsInput.type = "text"; propsInput.className = "win-input"; propsInput.placeholder = "Menu label";

  // ID input
  const lblId = document.createElement("label");
  lblId.textContent = "ID:";
  const propsIdInput = document.createElement("input");
  propsIdInput.type = "text"; propsIdInput.className = "win-input"; propsIdInput.placeholder = "e.g. IDM_OPEN";

  // Accelerator key input
  const lblAccel = document.createElement("label");
  lblAccel.textContent = "Shortcut:";
  const propsAccelInput = document.createElement("input");
  propsAccelInput.type = "text"; propsAccelInput.className = "win-input"; propsAccelInput.placeholder = "e.g. Ctrl+O";

  // Flags
  const lblFlags = document.createElement("label");
  lblFlags.textContent = "Flags:";
  const flagsWrap = document.createElement("div");
  flagsWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
  const flagChecks = {};
  for (const f of ["GRAYED", "INACTIVE", "CHECKED", "MENUBREAK", "MENUBARBREAK"]) {
    const cb = document.createElement("label");
    cb.style.cssText = "font-size:10px;display:flex;align-items:center;gap:2px;cursor:pointer;";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.addEventListener("change", () => {
      if (!selectedNode) return;
      pushUndo();
      if (!selectedNode.flags) selectedNode.flags = [];
      if (inp.checked) { if (!selectedNode.flags.includes(f)) selectedNode.flags.push(f); }
      else { selectedNode.flags = selectedNode.flags.filter(x => x !== f); }
      renderTree();
    });
    cb.append(inp, document.createTextNode(f));
    flagsWrap.appendChild(cb);
    flagChecks[f] = inp;
  }

  propsPanel.append(propsTitle, lblCaption, propsInput, lblId, propsIdInput, lblAccel, propsAccelInput, lblFlags, flagsWrap);

  split.append(treePanel, previewPanel, propsPanel);

  // ── Status bar ──
  const status = document.createElement("div");
  status.className = "editor-status";
  status.textContent = "Menu items: " + countMenuItems(tree);

  // ── Props wiring ──
  propsInput.addEventListener("input", () => {
    if (selectedNode && selectedNode.type !== "separator") {
      pushUndo();
      selectedNode.label = propsInput.value;
      renderTree();
    }
  });

  propsIdInput.addEventListener("input", () => {
    if (selectedNode && selectedNode.type === "menuitem") {
      pushUndo();
      selectedNode.id = propsIdInput.value;
      renderTree();
    }
  });

  propsAccelInput.addEventListener("input", () => {
    if (selectedNode && selectedNode.type === "menuitem") {
      pushUndo();
      selectedNode.accelKey = propsAccelInput.value;
      renderTree();
    }
  });

  function showProps(node) {
    if (!node || node.type === "root") {
      propsInput.value = ""; propsInput.disabled = true;
      propsIdInput.value = ""; propsIdInput.disabled = true;
      propsAccelInput.value = ""; propsAccelInput.disabled = true;
      for (const f in flagChecks) { flagChecks[f].checked = false; flagChecks[f].disabled = true; }
      return;
    }
    propsInput.disabled = (node.type === "separator");
    propsInput.value = node.label || "";
    propsIdInput.disabled = (node.type !== "menuitem");
    propsIdInput.value = node.id || "";
    propsAccelInput.disabled = (node.type !== "menuitem");
    propsAccelInput.value = node.accelKey || "";
    for (const f in flagChecks) {
      flagChecks[f].disabled = false;
      flagChecks[f].checked = (node.flags || []).includes(f);
    }
  }

  // ── Render ──
  function renderTree() {
    treeEl.innerHTML = "";
    renderNode(tree, treeEl, 0);
    renderPreview();
    status.textContent = "Menu items: " + countMenuItems(tree);
    showProps(selectedNode);
  }

  function renderNode(node, container, depth) {
    if (node.type === "root") {
      for (const ch of node.children) renderNode(ch, container, depth);
      return;
    }
    const row = document.createElement("div");
    row.className = "menu-tree-row";
    if (node === selectedNode) row.classList.add("selected");
    row.style.paddingLeft = (depth * 16 + 4) + "px";

    const icon = document.createElement("span");
    icon.className = "menu-tree-icon";
    if (node.type === "popup") icon.textContent = "\u25B6 ";
    else if (node.type === "separator") icon.textContent = "\u2500\u2500\u2500 ";
    else icon.textContent = "    ";

    const label = document.createElement("span");
    label.className = "menu-tree-label";
    label.textContent = node.label || node.type;

    row.append(icon, label);

    if (node.type === "menuitem") {
      const idSpan = document.createElement("span");
      idSpan.className = "menu-tree-id";
      idSpan.textContent = " [" + node.id + "]";
      row.appendChild(idSpan);
      if (node.accelKey) {
        const accelSpan = document.createElement("span");
        accelSpan.className = "menu-tree-id";
        accelSpan.style.color = "#008000";
        accelSpan.textContent = "  " + node.accelKey;
        row.appendChild(accelSpan);
      }
    }

    // Flags badge
    if (node.flags && node.flags.length) {
      const badge = document.createElement("span");
      badge.className = "menu-tree-id";
      badge.style.color = "#800080";
      badge.textContent = "  {" + node.flags.join(",") + "}";
      row.appendChild(badge);
    }

    row.addEventListener("click", (ev) => {
      ev.stopPropagation();
      selectedNode = node;
      renderTree();
    });

    container.appendChild(row);
    if (node.children) {
      for (const ch of node.children) renderNode(ch, container, depth + 1);
    }
  }

  function renderPreview() {
    previewBar.innerHTML = "";
    if (!tree.children) return;
    for (const popup of tree.children) {
      if (popup.type !== "popup") continue;
      const item = document.createElement("div");
      item.className = "menu-preview-top";
      if ((popup.flags || []).includes("GRAYED")) item.style.color = "#808080";
      item.textContent = popup.label.replace(/&/g, "");
      previewBar.appendChild(item);
    }
  }

  // ── Actions ──
  function addItem() {
    pushUndo();
    const target = selectedNode && selectedNode.type === "popup" ? selectedNode : tree;
    target.children = target.children || [];
    const { name } = project.identifiers.nextId("IDM_");
    project.identifiers.define(name, 0);
    target.children.push({ type: "menuitem", label: "New &Item", accelKey: "", id: name, flags: [] });
    renderTree();
  }

  function addPopup() {
    pushUndo();
    tree.children.push({ type: "popup", label: "New &Menu", flags: [], children: [] });
    renderTree();
  }

  function addSeparator() {
    pushUndo();
    const target = selectedNode && selectedNode.type === "popup" ? selectedNode : tree;
    target.children = target.children || [];
    target.children.push({ type: "separator", flags: [] });
    renderTree();
  }

  function deleteSelected() {
    if (!selectedNode || selectedNode.type === "root") return;
    pushUndo();
    const loc = findInTree(tree, selectedNode);
    if (loc) {
      loc.parent.children.splice(loc.index, 1);
      selectedNode = null;
      renderTree();
    }
  }

  function moveSelected(dir) {
    if (!selectedNode) return;
    const loc = findInTree(tree, selectedNode);
    if (!loc) return;
    const newIdx = loc.index + dir;
    if (newIdx < 0 || newIdx >= loc.parent.children.length) return;
    pushUndo();
    const arr = loc.parent.children;
    [arr[loc.index], arr[newIdx]] = [arr[newIdx], arr[loc.index]];
    renderTree();
  }

  // ── Keyboard shortcuts ──
  function onKeyDown(ev) {
    if (ev.target.tagName === "INPUT") return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "z" && !ev.shiftKey) { ev.preventDefault(); undo(); }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "y" || (ev.key === "z" && ev.shiftKey))) { ev.preventDefault(); redo(); }
    if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); deleteSelected(); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "ArrowUp") { ev.preventDefault(); moveSelected(-1); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "ArrowDown") { ev.preventDefault(); moveSelected(1); }
  }
  document.addEventListener("keydown", onKeyDown);
  win.onDestroy = () => {
    document.removeEventListener("keydown", onKeyDown);
    // Save back to resource
    resource.rawText = generateMenuText(tree);
    project._emit();
  };

  root.append(toolbar, split, status);
  win.content.innerHTML = "";
  win.content.appendChild(root);
  renderTree();
}