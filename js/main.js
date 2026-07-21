// js/main.js — Resource Workshop shell (classic menu + Project + Dialog Editor)
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
import { parseRc, applyParseToProject } from "./engine/rc-parser.js";
import { compileRc, compileHeader } from "./engine/rc-compiler.js";
import { readRes } from "./engine/res-reader.js";
import { writeRes } from "./engine/res-writer.js";
import { WS } from "./core/constants.js";

const project = new ProjectModel();
const desktopEl = setupDesktop(document.getElementById("desktop"));
const wm = new WindowManager(desktopEl, document.getElementById("taskstrip"));

/** @type {object|null} */
let placeDef = null;
/** @type {"dialog"|"screen"} */
let unitMode = "dialog";
/** @type {object|null} */
let activeDialog = null;

const fileMap = new Map(); // basename -> text content

function setStatus(ready, detail = "") {
  const r = document.getElementById("sb-ready");
  const d = document.getElementById("sb-detail");
  if (r) r.textContent = ready;
  if (d) d.textContent = detail;
}

function setAppTitle() {
  const name = project.name && project.name !== "Untitled" ? project.name : "Untitled";
  document.title = `Resource Workshop - ${name}`;
}

function openResource(r) {
  if (!r) return;
  if (r.type === "DIALOG" || r.type === "DIALOGEX") {
    activeDialog = r;
    openDialogEditor(wm, project, r, {
      unitMode,
      onUnitMode: (m) => { unitMode = m; },
      getPlaceDef: () => placeDef,
      clearPlaceDef: () => { placeDef = null; },
    });
    setStatus("Ready", `DIALOG : ${r.id}`);
  } else {
    setStatus("Ready", `${r.type} (not editable in Phase 1)`);
  }
}

/**
 * @param {{name:string, kind:string, text?:string, buffer?:ArrayBuffer}[]} files
 */
async function loadProjectFiles(files) {
  if (!files?.length) return;

  // Index text files for #include
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
    const clean = path.replace(/["'<>]/g, "").trim();
    const base = clean.split(/[/\\]/).pop();
    return fileMap.get(clean) || fileMap.get(clean.toLowerCase()) ||
      fileMap.get(base) || fileMap.get(base.toLowerCase()) || null;
  };

  // Headers first
  for (const f of files) {
    if (f.kind === "h" || f.kind === "rh" || f.kind === "inc") {
      const parsed = parseRc(f.text || "", { resolveInclude });
      for (const id of parsed.identifiers) {
        project.identifiers.define(id.name, id.value, f.name);
      }
      project.files.push({ path: f.name, kind: f.kind, content: f.text });
    }
  }

  // RC / DLG
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

  // RES
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

  // Other files listed only
  for (const f of files) {
    if (["bmp", "ico", "cur", "ptr"].includes(f.kind)) {
      project.files.push({ path: f.name, kind: f.kind, content: f.buffer || f.text });
    }
  }

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
  setAppTitle();
  setStatus("Ready", "New project");
}

function onNewDialog() {
  const dlg = project.createDialog();
  dlg.className = "bordlg";
  dlg.title = "Dialog";
  // starter BWCC buttons like classic Preferences sample
  const ok = project.identifiers.getByName("IDOK") || { name: "IDOK", value: 1 };
  if (!project.identifiers.getByName("IDOK")) project.identifiers.define("IDOK", 1);
  if (!project.identifiers.getByName("IDCANCEL")) project.identifiers.define("IDCANCEL", 2);
  if (!project.identifiers.getByName("IDHELP")) project.identifiers.define("IDHELP", 998);
  project.addControl(dlg, {
    id: "IDOK",
    className: "BorBtn",
    text: "",
    x: 40, y: 70, cx: 32, cy: 20,
    style: WS.CHILD | WS.VISIBLE | WS.TABSTOP | WS.GROUP,
    exStyle: 0,
    tabIndex: 0,
    groupStart: true,
  });
  project.addControl(dlg, {
    id: "IDCANCEL",
    className: "BorBtn",
    text: "",
    x: 84, y: 70, cx: 32, cy: 20,
    style: WS.CHILD | WS.VISIBLE | WS.TABSTOP,
    exStyle: 0,
    tabIndex: 1,
    groupStart: false,
  });
  project.addControl(dlg, {
    id: "IDHELP",
    className: "BorBtn",
    text: "",
    x: 128, y: 70, cx: 32, cy: 20,
    style: WS.CHILD | WS.VISIBLE | WS.TABSTOP,
    exStyle: 0,
    tabIndex: 2,
    groupStart: false,
  });
  openResource(dlg);
}

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

/** Align selected controls in the focused dialog editor — uses last active dialog */
function onAlign(cmd) {
  const dlg = activeDialog || project.dialogs()[0];
  if (!dlg || !dlg.controls?.length) return;
  // Align all controls if multi-select not tracked globally — use all for demo of hspace
  const sel = dlg.controls;
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
  alert(
    "Borland Resource Workshop (Web)\n" +
    "Identical-clone target — Phase 1 Dialog Editor\n\n" +
    "Local-first · HTML5/CSS3/JS\n" +
    "Gold standard: classic RW Dialog Tools / Align / BWCC"
  );
}

// ——— Menus (classic order) ———
createMenubar(document.getElementById("menubar"), [
  {
    label: "File",
    items: [
      { label: "New Project", action: onNewProject },
      { label: "Open…", action: onOpen },
      { label: "Save Project", action: onSaveProject },
      "-",
      { label: "Exit", action: onNewProject },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Undo", action: onUndo },
      { label: "Redo", action: onRedo },
    ],
  },
  {
    label: "Resource",
    items: [
      { label: "New Dialog", action: onNewDialog },
      { label: "Identifiers…", action: () => openIdentifiersWindow(wm, project) },
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
      { label: "Space equally H", action: () => onAlign("hspace") },
      { label: "Center in dialog H", action: () => onAlign("cdlg-h") },
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
          });
          // trigger test via keyboard path — open editor then user clicks Test
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
    ],
  },
  {
    label: "Help",
    items: [{ label: "About Resource Workshop", action: onAbout }],
  },
]);

createSpeedbar(document.getElementById("speedbar"), [
  { label: "New", title: "New Project", action: onNewProject },
  { label: "Open", title: "Open", action: onOpen },
  { label: "Save", title: "Save Project", action: onSaveProject },
  "-",
  { label: "Undo", title: "Undo", action: onUndo },
  { label: "Redo", title: "Redo", action: onRedo },
  "-",
  { label: "Dialog", title: "New Dialog", action: onNewDialog },
  { label: "IDs", title: "Identifiers", action: () => openIdentifiersWindow(wm, project) },
]);

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

openProjectWindow(wm, project, hooks);
openControlPalette(wm, (def) => {
  placeDef = def;
  setStatus("Ready", `Place: ${def.label || def.className} — click dialog canvas`);
});
openAlignPalette(wm, onAlign);

if (desk?.windows) {
  // apply after windows created
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

setAppTitle();
window.__brw = { project, wm, loadProjectFiles, openResource };
console.log("Borland Resource Workshop boot complete");
