// js/main.js ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Resources Workshop shell (classic menu + Project + Dialog Editor)
import { ProjectModel } from "./core/project-model.js";
import { saveDesktop, loadDesktop } from "./core/app-state.js";
import { WindowManager } from "./ui/window-manager.js";
import { createMenubar } from "./ui/menubar.js";
import { createSpeedbar } from "./ui/speedbar.js";
import { setupDesktop } from "./ui/desktop.js";
import { openFilesDialog, downloadBlob } from "./ui/file-io.js";
import { openProjectWindow } from "./windows/project-window.js";
import { openIdentifiersWindow } from "./windows/identifiers-window.js";
import { openDialogEditor } from "./editors/dialog-editor.js";
import { openControlPalette } from "./editors/control-palette.js";
import { openAlignPalette } from "./editors/align-palette.js";
import { openPropertyInspector } from "./windows/property-inspector.js";
import { openStringTableEditor } from "./windows/stringtable-editor.js";
import { openVersionInfoEditor } from "./windows/versioninfo-editor.js";
import { openAcceleratorEditor } from "./windows/accelerator-editor.js";
import { openPreferencesDialog } from "./ui/preferences-dialog.js";
import { parseRc, applyParseToProject } from "./engine/rc-parser.js";
import { openRcTextViewer } from "./ui/rc-text-viewer.js";
import { compileRc, compileHeader } from "./engine/rc-compiler.js";
import { readRes } from "./engine/res-reader.js";
import { writeRes } from "./engine/res-writer.js";
import { WS, BS } from "./core/constants.js";

const project = new ProjectModel();
const desktopEl = setupDesktop(document.getElementById("desktop"));
const wm = new WindowManager(desktopEl, document.getElementById("taskstrip"));
wm.onLayoutChange = () => saveDesktop({
  windows: wm.getLayout(),
  undoLimit: project.undo.limit,
  unitMode,
  sortMode: project.sortMode,
  filters: { ...project.filters },
  speedBarMode,
  gridSnap,
});

/** @type {object|null} */
let placeDef = null;
/** @type {"dialog"|"screen"} */
let unitMode = "dialog";
/** @type {object|null} */
let activeDialog = null;
/** @type {Set<object>|null} */
let activeSelection = null;
/** @type {string} */
let speedBarMode = "horizontal";
/** @type {boolean} */
let gridSnap = true;

const fileMap = new Map(); // basename -> text content

function setStatus(ready, detail = "") {
  const r = document.getElementById("sb-ready");
  const d = document.getElementById("sb-detail");
  if (r) r.textContent = ready;
  if (d) d.textContent = detail;
}

function setAppTitle() {
  const name = project.name && project.name !== "Untitled" ? project.name : "Untitled";
  document.title = `Resources Workshop - ${name}`;
}

function openResource(r) {
  if (!r) return;
  if (r.type === "DIALOG" || r.type === "DIALOGEX") {
    activeDialog = r;
    const editorWin = openDialogEditor(wm, project, r, {
      unitMode,
      onUnitMode: (m) => { unitMode = m; },
      getPlaceDef: () => placeDef,
      clearPlaceDef: () => { placeDef = null; },
      onSelectionChange: (sel) => { activeSelection = sel; },
      gridSnap,
    });
    setStatus("Ready", `DIALOG : ${r.id}`);
  } else if (r.type === "STRINGTABLE") {
    openStringTableEditor(wm, project, r);
    setStatus("Ready", `String Table : ${r.id}`);
  } else if (r.type === "VERSIONINFO") {
    openVersionInfoEditor(wm, project, r);
    setStatus("Ready", `Version Info : ${r.id}`);
  } else if (r.type === "ACCELERATORS") {
    openAcceleratorEditor(wm, project, r);
    setStatus("Ready", `Accelerators : ${r.id}`);
  } else {
    setStatus("Ready", `${r.type} (not editable in Phase 1)`);
  }
}

async function loadProjectFiles(files) {
  if (!files?.length) return;

  for (const f of files) {
    if (f.text != null) {
      fileMap.set(f.name, f.text);
      fileMap.set(f.name.toLowerCase(), f.text);
      const base = f.name.split(/[/\\]/).pop();
      fileMap.set(base, f.text);
      fileMap.set(base.toLowerCase(), f.text);
    }
  }

  const resolveInclude = (path) => {
    const clean = path.replace(/["'"<>]/g, "").trim();
    const base = clean.split(/[/\\]/).pop();
    return fileMap.get(clean) || fileMap.get(clean.toLowerCase()) ||
      fileMap.get(base) || fileMap.get(base.toLowerCase()) || null;
  };

  for (const f of files) {
    if (f.kind === "h" || f.kind === "rh" || f.kind === "inc") {
      const parsed = parseRc(f.text || "", { resolveInclude });
      for (const id of parsed.identifiers) {
        project.identifiers.define(id.name, id.value, f.name);
      }
      project.files.push({ path: f.name, kind: f.kind, content: f.text });
    }
  }

  for (const f of files) {
    if (f.kind === "rc" || f.kind === "dlg") {
      const symbols = {};
      for (const id of project.identifiers.list()) symbols[id.name] = id.value;
      const parsed = parseRc(f.text || "", { resolveInclude, symbols });
      if (parsed.errors?.length) {
        console.warn("RC errors", parsed.errors);
        setStatus("Error", parsed.errors[0]);
      }
      applyParseToProject(project, parsed, f.name);
      project.files.push({ path: f.name, kind: f.kind, content: f.text });
      if (project.name === "Untitled") {
        project.name = f.name.replace(/\.(rc|dlg)$/i, "");
      }
    }
  }

  for (const f of files) {
    if (f.kind === "res" && f.buffer) {
      const { resources, errors } = readRes(f.buffer);
      if (errors?.length) console.warn("RES errors", errors);
      for (const r of resources) {
        r.sourceFile = f.name;
        project.resources.push(r);
      }
      project.files.push({ path: f.name, kind: "res", content: f.buffer });
      project._emit();
      if (project.name === "Untitled") {
        project.name = f.name.replace(/\.res$/i, "");
      }
    }
  }

  for (const f of files) {
    if (["bmp", "ico", "cur", "ptr"].includes(f.kind)) {
      project.files.push({ path: f.name, kind: f.kind, content: f.buffer || f.text });
    }
  }

  // Global button press visual feedback
document.addEventListener("mousedown", (e) => {
  const btn = e.target.closest(".win-btn");
  if (btn && !btn.disabled) btn.classList.add("btn-pressed");
});
document.addEventListener("mouseup", () => {
  document.querySelectorAll(".btn-pressed").forEach((b) => b.classList.remove("btn-pressed"));
});
document.addEventListener("mouseout", (e) => {
  // When mouse leaves any button while pressed, release it
  const btn = e.target.closest?.(".btn-pressed");
  if (btn && !btn.contains(e.relatedTarget)) {
    btn.classList.remove("btn-pressed");
  }
});

setAppTitle();
  setStatus("Ready", `Loaded ${files.map((x) => x.name).join(", ")}`);
  project._emit();
}

async function onOpen() {
  const files = await openFilesDialog(".rc,.h,.rh,.res,.dlg,.bmp,.ico,.cur", true);
  if (files.length) await loadProjectFiles(files);
}

function onNewProject() {
  project.clear();
  fileMap.clear();
  placeDef = null;
  activeDialog = null;
  activeSelection = null;
  // Global button press visual feedback
document.addEventListener("mousedown", (e) => {
  const btn = e.target.closest(".win-btn");
  if (btn && !btn.disabled) btn.classList.add("btn-pressed");
});
document.addEventListener("mouseup", () => {
  document.querySelectorAll(".btn-pressed").forEach((b) => b.classList.remove("btn-pressed"));
});
document.addEventListener("mouseout", (e) => {
  // When mouse leaves any button while pressed, release it
  const btn = e.target.closest?.(".btn-pressed");
  if (btn && !btn.contains(e.relatedTarget)) {
    btn.classList.remove("btn-pressed");
  }
});

setAppTitle();
  setStatus("Ready", "New project");
}

function createDialogFromTemplate(template) {
  const dlg = project.createDialog();
  dlg.className = template.className || null;
  dlg.title = template.title || "Dialog";
  dlg.cx = template.cx || 200;
  dlg.cy = template.cy || 100;

  if (!project.identifiers.getByName("IDOK")) project.identifiers.define("IDOK", 1);
  if (!project.identifiers.getByName("IDCANCEL")) project.identifiers.define("IDCANCEL", 2);
  if (!project.identifiers.getByName("IDHELP")) project.identifiers.define("IDHELP", 998);

  for (const cdef of template.controls || []) {
    project.addControl(dlg, { ...cdef });
  }

  openResource(dlg);
  return dlg;
}

function onNewDialog() {
  // Default: Borland BWCC dialog with OK/Cancel/Help
  const dlg = project.createDialog();
  dlg.className = "bordlg";
  dlg.title = "Dialog";
  if (!project.identifiers.getByName("IDOK")) project.identifiers.define("IDOK", 1);
  if (!project.identifiers.getByName("IDCANCEL")) project.identifiers.define("IDCANCEL", 2);
  if (!project.identifiers.getByName("IDHELP")) project.identifiers.define("IDHELP", 998);
  // BorBtn OK Cancel Help (right edge, bottom)
  const right = dlg.cx - 40;
  project.addControl(dlg, { id: "IDOK", className: "BorBtn", text: "", x: right - 96, y: dlg.cy - 30, cx: 32, cy: 20, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP | WS.GROUP, exStyle: 0, tabIndex: 0, groupStart: true });
  project.addControl(dlg, { id: "IDCANCEL", className: "BorBtn", text: "", x: right - 56, y: dlg.cy - 30, cx: 32, cy: 20, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP, exStyle: 0, tabIndex: 1, groupStart: false });
  project.addControl(dlg, { id: "IDHELP", className: "BorBtn", text: "", x: right - 16, y: dlg.cy - 30, cx: 32, cy: 20, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP, exStyle: 0, tabIndex: 2, groupStart: false });
  openResource(dlg);
}

// Template definitions
const DIALOG_TEMPLATES = {
  "borland-bwcc": {
    title: "Dialog",
    className: "bordlg",
    cx: 200, cy: 100,
    controls: [
      { id: "IDOK", className: "BorBtn", text: "", x: 80, y: 70, cx: 32, cy: 20, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP | WS.GROUP, exStyle: 0, tabIndex: 0, groupStart: true },
      { id: "IDCANCEL", className: "BorBtn", text: "", x: 120, y: 70, cx: 32, cy: 20, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP, exStyle: 0, tabIndex: 1, groupStart: false },
      { id: "IDHELP", className: "BorBtn", text: "", x: 160, y: 70, cx: 32, cy: 20, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP, exStyle: 0, tabIndex: 2, groupStart: false },
    ],
  },
  "standalone-windows": {
    title: "Dialog",
    className: null,
    cx: 200, cy: 100,
    controls: [
      { id: "IDOK", className: "BUTTON", text: "OK", x: 60, y: 70, cx: 50, cy: 14, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP | WS.GROUP | BS.DEFPUSHBUTTON, exStyle: 0, tabIndex: 0, groupStart: true },
      { id: "IDCANCEL", className: "BUTTON", text: "Cancel", x: 120, y: 70, cx: 50, cy: 14, style: WS.CHILD | WS.VISIBLE | WS.TABSTOP | BS.PUSHBUTTON, exStyle: 0, tabIndex: 1, groupStart: false },
    ],
  },
  "empty": {
    title: "Dialog",
    className: null,
    cx: 200, cy: 100,
    controls: [],
  },
};

function onSaveProject() {
  const base = project.name || "project";
  const h = compileHeader(project.identifiers);
  const rc = compileRc(project);
  const res = writeRes(project);
  downloadBlob("resource.h", new Blob([h], { type: "text/plain" }));
  downloadBlob(`${base}.rc`, new Blob([rc], { type: "text/plain" }));
  downloadBlob(`${base}.res`, new Blob([res], { type: "application/octet-stream" }));
  setStatus("Ready", `Saved ${base}.rc / resource.h / ${base}.res`);
}

function onUndo() {
  if (project.undo.canUndo) project.undo.undo();
}
function onRedo() {
  if (project.undo.canRedo) project.undo.redo();
}

function onCascade() {
  let i = 0;
  for (const w of wm.windows.values()) {
    if (w.state === "min") continue;
    w.root.style.left = 16 + i * 22 + "px";
    w.root.style.top = 16 + i * 22 + "px";
    if (w.state === "max") {
      w.state = "normal";
      if (w.restore) {
        w.root.style.width = w.restore.width;
        w.root.style.height = w.restore.height;
      }
    }
    i += 1;
  }
}

function onTile() {
  const list = [...wm.windows.values()].filter((w) => w.state !== "min");
  if (!list.length) return;
  const cols = Math.ceil(Math.sqrt(list.length));
  const rows = Math.ceil(list.length / cols);
  const dw = desktopEl.clientWidth;
  const dh = desktopEl.clientHeight;
  const cw = Math.floor(dw / cols);
  const ch = Math.floor(dh / rows);
  list.forEach((w, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    w.state = "normal";
    w.root.style.left = col * cw + "px";
    w.root.style.top = row * ch + "px";
    w.root.style.width = cw + "px";
    w.root.style.height = ch + "px";
  });
}

/** Align controls using active selection or all controls */
function onAlign(cmd) {
  const dlg = activeDialog || project.dialogs()[0];
  if (!dlg || !dlg.controls?.length) return;

  // Use activeSelection if available, otherwise all controls
  let sel;
  if (activeSelection && activeSelection.size > 0) {
    sel = [...activeSelection].filter((c) => dlg.controls.includes(c));
  } else {
    sel = dlg.controls;
  }
  if (sel.length < 2 && !cmd.startsWith("cdlg")) return;

  const xs = sel.map((c) => c.x);
  const ys = sel.map((c) => c.y);
  const rights = sel.map((c) => c.x + c.cx);
  const bottoms = sel.map((c) => c.y + c.cy);
  const minX = Math.min(...xs);
  const maxR = Math.max(...rights);
  const minY = Math.min(...ys);
  const maxB = Math.max(...bottoms);
  const midX = (minX + maxR) / 2;
  const midY = (minY + maxB) / 2;

  for (const c of sel) {
    const before = { x: c.x, y: c.y, cx: c.cx, cy: c.cy };
    let { x, y, cx, cy } = before;
    switch (cmd) {
      case "left": x = minX; break;
      case "right": x = maxR - cx; break;
      case "hcenter": x = Math.round(midX - cx / 2); break;
      case "top": y = minY; break;
      case "bottom": y = maxB - cy; break;
      case "vcenter": y = Math.round(midY - cy / 2); break;
      case "cdlg-h": x = Math.round((dlg.cx - cx) / 2); break;
      case "cdlg-v": y = Math.round((dlg.cy - cy) / 2); break;
      default: break;
    }
    if (x !== before.x || y !== before.y) {
      project.moveResizeControl(c, { x, y, cx, cy });
    }
  }

  if (cmd === "hspace" && sel.length >= 2) {
    const sorted = [...sel].sort((a, b) => a.x - b.x);
    const left = sorted[0].x;
    const right = sorted[sorted.length - 1].x + sorted[sorted.length - 1].cx;
    const totalW = sorted.reduce((s, c) => s + c.cx, 0);
    const gap = (right - left - totalW) / (sorted.length - 1);
    let cursor = left;
    for (const c of sorted) {
      project.moveResizeControl(c, { x: Math.round(cursor), y: c.y, cx: c.cx, cy: c.cy });
      cursor += c.cx + gap;
    }
  }
  if (cmd === "vspace" && sel.length >= 2) {
    const sorted = [...sel].sort((a, b) => a.y - b.y);
    const top = sorted[0].y;
    const bot = sorted[sorted.length - 1].y + sorted[sorted.length - 1].cy;
    const totalH = sorted.reduce((s, c) => s + c.cy, 0);
    const gap = (bot - top - totalH) / (sorted.length - 1);
    let cursor = top;
    for (const c of sorted) {
      project.moveResizeControl(c, { x: c.x, y: Math.round(cursor), cx: c.cx, cy: c.cy });
      cursor += c.cy + gap;
    }
  }
}

function onAbout() {
  const win = wm.createWindow({
    id: "about",
    title: "About Resources Workshop",
    x: 200, y: 120, w: 360, h: 200,
    modal: true,
  });
  const root = document.createElement("div");
  root.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:16px;text-align:center;gap:4px;";
  root.innerHTML = "<div style='font-size:16px;font-weight:bold;margin-bottom:8px'>Resources Workshop (Web)</div>" +
    "<div style='font-size:11px;color:var(--dkshadow)'>Identical-clone target</div>" +
    "<div style='font-size:11px;color:var(--dkshadow)'>Phase 1 &mdash; Dialog Editor</div>" +
    "<div style='margin-top:8px;font-size:11px'>Local-first &middot; HTML5/CSS3/JS</div>" +
    "<div style='font-size:11px'>Gold standard: classic RW Dialog Tools / Align / BWCC</div>" +
    "<button type='button' class='win-btn' style='margin-top:12px;min-width:60px'>OK</button>";
  root.querySelector("button").onclick = () => win.close();
  win.content.innerHTML = "";
  win.content.appendChild(root);
}

function onViewRc() {
  openRcTextViewer(wm, project);
  setStatus("Ready", "RC Text viewer opened");
}

let currentTheme = localStorage.getItem("brw-theme") || "win95";

function setTheme(name) {
  currentTheme = name;
  document.documentElement.dataset.theme = name;
  localStorage.setItem("brw-theme", name);
  setStatus("Ready", "Theme: " + name);
  createMenubar(document.getElementById("menubar"), menuDef);
}

// Apply saved theme on load
document.documentElement.dataset.theme = currentTheme;

function onPreferences() {
  openPreferencesDialog(wm, project, {
    speedBarMode: speedBarMode,
    gridSnap: gridSnap,
    onApply: (prefs) => {
      speedBarMode = prefs.speedBarMode;
      gridSnap = prefs.gridSnap;
      speedbar.setMode(prefs.speedBarMode);
      setStatus("Ready", `Preferences: Undo=${prefs.undoLimit}, SpeedBar=${prefs.speedBarMode}, GridSnap=${prefs.gridSnap}`);
    },
  });
}

// -- Menus (classic order) --
const menuDef = [
  {
    label: "File",
    items: [
      { label: "New Project", action: onNewProject },
      { label: "Open...", action: onOpen },
      "-",
      { label: "Save Project", action: onSaveProject },
      { label: "Save File As...", action: () => { setStatus("Ready", "Save File As not implemented in Phase 1"); } },
      "-",
      { label: "Preferences...", action: onPreferences },
      "-",
      { label: "Exit", action: onNewProject },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", action: onUndo },
      { label: "Redo", action: onRedo },
      "-",
      { label: "Cut", action: () => setStatus("Ready", "Cut not implemented") },
      { label: "Copy", action: () => setStatus("Ready", "Copy not implemented") },
      { label: "Paste", action: () => setStatus("Ready", "Paste not implemented") },
      { label: "Delete", action: () => setStatus("Ready", "Delete via Dialog Editor") },
      { label: "Duplicate", action: () => setStatus("Ready", "Duplicate via Dialog Editor") },
    ],
  },
  {
    label: "Resource",
    items: [
      { label: "New Borland BWCC Dialog", action: () => createDialogFromTemplate(DIALOG_TEMPLATES["borland-bwcc"]) },
      { label: "New Standard Dialog", action: () => createDialogFromTemplate(DIALOG_TEMPLATES["standalone-windows"]) },
      { label: "New Empty Dialog", action: () => createDialogFromTemplate(DIALOG_TEMPLATES["empty"]) },
      { label: "New Dialog (BorBtn)", action: onNewDialog },
      { label: "Identifiers...", action: () => openIdentifiersWindow(wm, project) },
      "-",
      { label: "New String Table", action: () => {
        const { name, value } = project.identifiers.nextId("ST_");
        project.identifiers.define(name, value);
        project.resources.push({ type: "STRINGTABLE", id: name, rawText: name + " STRINGTABLE\nBEGIN\nEND\n", memoryFlags: [], sourceFile: null });
        project._emit();
        setStatus("Ready", "String Table created: " + name);
      } },
      { label: "New Version Info", action: () => {
        const { name, value } = project.identifiers.nextId("VS_");
        project.identifiers.define(name, value);
        project.resources.push({ type: "VERSIONINFO", id: name, rawText: name + " VERSIONINFO\n FILEVERSION 1,0,0,0\n PRODUCTVERSION 1,0,0,0\n FILEOS VOS_NT_WINDOWS32\n FILETYPE VFT_APP\nBEGIN\n  BLOCK \"StringFileInfo\"\n  BEGIN\n    BLOCK \"040904E4\"\n    BEGIN\n      VALUE \"CompanyName\", \"My Company\\0\"\n      VALUE \"FileDescription\", \"My App\\0\"\n      VALUE \"FileVersion\", \"1.0.0.0\\0\"\n    END\n  END\n  BLOCK \"VarFileInfo\"\n  BEGIN\n    VALUE \"Translation\", 0x0409 0x04E4\n  END\nEND\n", memoryFlags: [], sourceFile: null });
        project._emit();
        setStatus("Ready", "Version Info created: " + name);
      } },
      { label: "New Accelerators", action: () => {
        const { name, value } = project.identifiers.nextId("ACC_");
        project.identifiers.define(name, value);
        project.resources.push({ type: "ACCELERATORS", id: name, rawText: name + " ACCELERATORS\nBEGIN\nEND\n", memoryFlags: [], sourceFile: null });
        project._emit();
        setStatus("Ready", "Accelerators created: " + name);
      } },
      "-",
      { label: "Add to Project...", action: onOpen },
    ],
  },
  {
    label: "Control",
    items: [
      { label: "Tools Palette", action: () => openControlPalette(wm, (def) => { placeDef = def; setStatus("Ready", `Place: ${def.label}`); }) },
    ],
  },
  {
    label: "Align",
    items: [
      { label: "Alignment Palette", action: () => openAlignPalette(wm, onAlign) },
      "-",
      { label: "Left sides", action: () => onAlign("left") },
      { label: "Right sides", action: () => onAlign("right") },
      { label: "Tops", action: () => onAlign("top") },
      { label: "Bottoms", action: () => onAlign("bottom") },
      { label: "Horizontal centers", action: () => onAlign("hcenter") },
      { label: "Vertical centers", action: () => onAlign("vcenter") },
      { label: "Space equally H", action: () => onAlign("hspace") },
      { label: "Space equally V", action: () => onAlign("vspace") },
      { label: "Center in dialog H", action: () => onAlign("cdlg-h") },
      { label: "Center in dialog V", action: () => onAlign("cdlg-v") },
    ],
  },
  {
    label: "Options",
    items: [
      {
        label: "Test Dialog",
        action: () => {
          const d = activeDialog || project.dialogs()[0];
          if (d) openDialogEditor(wm, project, d, {
            unitMode,
            getPlaceDef: () => placeDef,
            clearPlaceDef: () => { placeDef = null; },
            onSelectionChange: (sel) => { activeSelection = sel; },
            gridSnap,
          });
          setStatus("Ready", "Open dialog editor and click Test");
        },
      },
      {
        label: "Units: Dialog / Screen",
        action: () => {
          unitMode = unitMode === "dialog" ? "screen" : "dialog";
          setStatus("Ready", `Units: ${unitMode}`);
        },
      },
    ],
  },
  {
    label: "Window",
    items: [
      { label: "Cascade", action: onCascade },
      { label: "Tile", action: onTile },
      { label: "Project", action: () => openProjectWindow(wm, project, hooks) },
      { label: "Tools", action: () => openControlPalette(wm, (def) => { placeDef = def; }) },
      { label: "Alignment", action: () => openAlignPalette(wm, onAlign) },
      "-",
      { label: "Theme", items: [
        { label: "Classic (Win95)", action: () => setTheme("win95"), get checked() { return currentTheme === "win95"; } },
        { label: "macOS", action: () => setTheme("macos"), get checked() { return currentTheme === "macos"; } },
        { label: "Windows 11", action: () => setTheme("win11"), get checked() { return currentTheme === "win11"; } },
      ]},
    ],
  },
  {
    label: "Help",
    items: [{ label: "About Resources Workshop", action: onAbout }],
  },
];

createMenubar(document.getElementById("menubar"), menuDef);

const speedbar = createSpeedbar(document.getElementById("speedbar"), [
  { label: "New", icon: "new", title: "New Project", action: onNewProject },
  { label: "Open", icon: "open", title: "Open", action: onOpen },
  { label: "Save", icon: "save", title: "Save Project", action: onSaveProject },
  "-",
  { label: "Undo", icon: "undo", title: "Undo", action: onUndo },
  { label: "Redo", icon: "redo", title: "Redo", action: onRedo },
  "-",
  { label: "Dialog", icon: "dialog", title: "New Dialog", action: onNewDialog },
  { label: "IDs", icon: "ids", title: "Identifiers", action: () => openIdentifiersWindow(wm, project) },
], {
  mode: speedBarMode,
  onModeChange: (m) => { speedBarMode = m; },
});

const hooks = {
  onOpenResource: openResource,
  onSelection: (r) => {
    if (r && (r.type === "DIALOG" || r.type === "DIALOGEX")) activeDialog = r;
  },
  loadProjectFiles,
};

// Restore desktop prefs
const desk = loadDesktop();
if (desk?.undoLimit) project.undo.setLimit(desk.undoLimit);
if (desk?.unitMode) unitMode = desk.unitMode;
if (desk?.sortMode) project.sortMode = desk.sortMode;
if (desk?.filters) Object.assign(project.filters, desk.filters);
if (desk?.speedBarMode) { speedBarMode = desk.speedBarMode; speedbar.setMode(desk.speedBarMode); }
if (desk?.gridSnap != null) gridSnap = desk.gridSnap;

openProjectWindow(wm, project, hooks);
openControlPalette(wm, (def) => {
  placeDef = def;
  setStatus("Ready", `Place: ${def.label || def.className} -- click dialog canvas`);
});
openAlignPalette(wm, onAlign);

if (desk?.windows) {
  setTimeout(() => wm.applyLayout(desk.windows), 0);
}

// Load sample project over HTTP
(async () => {
  try {
    const [h, rc] = await Promise.all([
      fetch("samples/resource.h").then((r) => (r.ok ? r.text() : null)),
      fetch("samples/about.rc").then((r) => (r.ok ? r.text() : null)),
    ]);
    if (h && rc) {
      await loadProjectFiles([
        { name: "resource.h", kind: "h", text: h },
        { name: "about.rc", kind: "rc", text: rc },
      ]);
      const d = project.findDialog("IDD_ABOUT") || project.dialogs()[0];
      if (d) openResource(d);
      setStatus("Ready", "Sample about.rc loaded");
    }
  } catch (e) {
    console.warn("Sample load skipped", e);
    setStatus("Ready", "Drop .rc/.h files on Project window");
  }
})();

window.addEventListener("beforeunload", () => {
  saveDesktop({
    windows: wm.getLayout(),
    undoLimit: project.undo.limit,
    unitMode,
    sortMode: project.sortMode,
    filters: { ...project.filters },
    speedBarMode,
    gridSnap,
  });
});

window.addEventListener("keydown", (ev) => {
  const tag = (ev.target && ev.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
    ev.preventDefault();
    onUndo();
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
    ev.preventDefault();
    onRedo();
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "o") {
    ev.preventDefault();
    onOpen();
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
    ev.preventDefault();
    onSaveProject();
  }
});

// Global button press visual feedback
document.addEventListener("mousedown", (e) => {
  const btn = e.target.closest(".win-btn");
  if (btn && !btn.disabled) btn.classList.add("btn-pressed");
});
document.addEventListener("mouseup", () => {
  document.querySelectorAll(".btn-pressed").forEach((b) => b.classList.remove("btn-pressed"));
});
document.addEventListener("mouseout", (e) => {
  // When mouse leaves any button while pressed, release it
  const btn = e.target.closest?.(".btn-pressed");
  if (btn && !btn.contains(e.relatedTarget)) {
    btn.classList.remove("btn-pressed");
  }
});

setAppTitle();
window.__brw = { project, wm, loadProjectFiles, openResource };
console.log("Borland Resources Workshop boot complete");






