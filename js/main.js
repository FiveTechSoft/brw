// js/main.js — Phase 1 full boot
import { ProjectModel } from "./core/project-model.js";
import { saveDesktop, loadDesktop } from "./core/app-state.js";
import { WindowManager } from "./ui/window-manager.js";
import { createMenubar } from "./ui/menubar.js";
import { createSpeedbar } from "./ui/speedbar.js";
import { setupDesktop } from "./ui/desktop.js";
import { openFilesDialog, downloadBlob } from "./ui/file-io.js";
import { parseRc, applyParseToProject } from "./engine/rc-parser.js";
import { compileRc, compileHeader } from "./engine/rc-compiler.js";
import { readRes } from "./engine/res-reader.js";
import { writeRes } from "./engine/res-writer.js";
import { openProjectWindow } from "./windows/project-window.js";
import { openIdentifiersWindow } from "./windows/identifiers-window.js";
import { openControlPalette } from "./editors/control-palette.js";
import { openDialogEditor } from "./editors/dialog-editor.js";

const project = new ProjectModel();
const desktopEl = setupDesktop(document.getElementById("desktop"));
const wm = new WindowManager(desktopEl, document.getElementById("taskstrip"));

/** @type {"dialog"|"screen"} */
let unitMode = "dialog";
/** @type {object|null} */
let placeDef = null;

function onNewProject() {
  project.clear();
  project.name = "Untitled";
}

function onUndo() {
  if (project.undo.canUndo) project.undo.undo();
}

function onRedo() {
  if (project.undo.canRedo) project.undo.redo();
}

function onNewDialog() {
  const dlg = project.createDialog();
  openDialogEditor(wm, project, dlg, editorOpts());
}

function editorOpts() {
  return {
    unitMode,
    onUnitMode: (m) => {
      unitMode = m;
    },
    getPlaceDef: () => placeDef,
    clearPlaceDef: () => {
      placeDef = null;
    },
  };
}

function onOpenResource(r) {
  if (r.type === "DIALOG" || r.type === "DIALOGEX") {
    openDialogEditor(wm, project, r, editorOpts());
  } else {
    console.log("Not editable in Phase 1:", r.type, r.id ?? r.nameId);
  }
}

/**
 * Load dropped/opened files into the project.
 * @param {{name:string, kind:string, text?:string, buffer?:ArrayBuffer}[]} files
 */
export async function loadProjectFiles(files) {
  if (!files?.length) return;

  /** @type {Map<string, string>} */
  const textMap = new Map();
  const headers = [];
  const rcs = [];
  const resFiles = [];

  for (const f of files) {
    const base = f.name.split(/[/\\]/).pop();
    const lower = base.toLowerCase();
    project.files.push({
      path: base,
      kind: f.kind,
      content: f.text ?? f.buffer,
    });
    if (f.text != null) {
      textMap.set(base, f.text);
      textMap.set(base.toLowerCase(), f.text);
    }
    if (lower.endsWith(".h") || lower.endsWith(".rh") || f.kind === "h" || f.kind === "rh") {
      headers.push({ name: base, text: f.text || "" });
    } else if (lower.endsWith(".rc") || lower.endsWith(".dlg") || f.kind === "rc" || f.kind === "dlg") {
      rcs.push({ name: base, text: f.text || "" });
    } else if (lower.endsWith(".res") || f.kind === "res") {
      resFiles.push({ name: base, buffer: f.buffer });
    }
  }

  // Derive project name from first rc
  if (rcs[0]) {
    project.name = rcs[0].name.replace(/\.rc$/i, "");
  } else if (resFiles[0]) {
    project.name = resFiles[0].name.replace(/\.res$/i, "");
  }

  const resolveInclude = (path) => {
    const clean = String(path).replace(/^[<"]|[>"]$/g, "").split(/[/\\]/).pop();
    return (
      textMap.get(clean) ||
      textMap.get(clean.toLowerCase()) ||
      textMap.get("resource.h") ||
      null
    );
  };

  // Parse headers first (standalone #defines)
  for (const h of headers) {
    const parsed = parseRc(h.text, { resolveInclude });
    for (const id of parsed.identifiers) {
      project.identifiers.define(id.name, id.value, h.name);
    }
  }

  // Parse RC files
  for (const rc of rcs) {
    const parsed = parseRc(rc.text, {
      resolveInclude,
      symbols: Object.fromEntries(project.identifiers.list().map((i) => [i.name, i.value])),
    });
    if (parsed.errors.length) {
      console.warn("RC parse errors:", parsed.errors);
    }
    applyParseToProject(project, parsed, rc.name);
  }

  // Binary .res
  for (const rf of resFiles) {
    if (!rf.buffer) continue;
    const { resources, errors } = readRes(rf.buffer);
    if (errors.length) console.warn("RES errors:", errors);
    for (const r of resources) {
      r.sourceFile = rf.name;
      project.resources.push(r);
    }
    project._emit();
  }

  project._emit();
}

function onOpen() {
  openFilesDialog(".rc,.h,.rh,.res,.dlg", true).then((files) => loadProjectFiles(files));
}

function onSaveProject() {
  const base = project.name || "project";
  const h = compileHeader(project.identifiers);
  const rc = compileRc(project);
  const res = writeRes(project);
  downloadBlob("resource.h", new Blob([h], { type: "text/plain" }));
  downloadBlob(`${base}.rc`, new Blob([rc], { type: "text/plain" }));
  downloadBlob(`${base}.res`, new Blob([res], { type: "application/octet-stream" }));
}

function onAbout() {
  alert(
    "Borland Resource Workshop (Web)\nPhase 1 — Dialog Editor, RC & RES\n\nClassic chiseled-steel IDE for Windows resources."
  );
}

function onCascade() {
  let i = 0;
  for (const w of wm.windows.values()) {
    if (w.state === "min") continue;
    w.root.style.left = 20 + i * 24 + "px";
    w.root.style.top = 20 + i * 24 + "px";
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

function persistDesktop() {
  saveDesktop({
    windows: wm.getLayout(),
    undoLimit: project.undo.limit,
    unitMode,
    sortMode: project.sortMode,
    filters: { ...project.filters },
  });
}

// Menus
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
    label: "Window",
    items: [
      { label: "Cascade", action: onCascade },
      { label: "Tile", action: onTile },
      { label: "Control Palette", action: () => openControlPalette(wm, (def) => { placeDef = def; }) },
    ],
  },
  {
    label: "Help",
    items: [{ label: "About", action: onAbout }],
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
  { label: "New Dialog", title: "New Dialog", action: onNewDialog },
]);

// Restore desktop prefs
const desk = loadDesktop();
if (desk) {
  if (desk.unitMode) unitMode = desk.unitMode;
  if (desk.sortMode) project.sortMode = desk.sortMode;
  if (desk.filters) Object.assign(project.filters, desk.filters);
  if (desk.undoLimit) project.undo.limit = desk.undoLimit;
}

// Core windows
openProjectWindow(wm, project, {
  onOpenResource,
  onSelection: () => {},
  loadProjectFiles,
});

openControlPalette(wm, (def) => {
  placeDef = def;
});

if (desk?.windows) {
  // allow windows to finish mounting
  requestAnimationFrame(() => wm.applyLayout(desk.windows));
}

window.addEventListener("beforeunload", persistDesktop);

// Global Ctrl+Z / Ctrl+Y when not typing
window.addEventListener("keydown", (ev) => {
  const tag = (ev.target && ev.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || ev.target?.isContentEditable) {
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
    ev.preventDefault();
    onUndo();
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
    ev.preventDefault();
    onRedo();
  }
});

// Optional auto-load sample when served over HTTP
async function tryLoadSample() {
  try {
    const [hRes, rcRes] = await Promise.all([
      fetch("samples/resource.h"),
      fetch("samples/about.rc"),
    ]);
    if (!hRes.ok || !rcRes.ok) return;
    const hText = await hRes.text();
    const rcText = await rcRes.text();
    // Only auto-load if project empty
    if (project.resources.length || project.identifiers.list().length) return;
    await loadProjectFiles([
      { name: "resource.h", kind: "h", text: hText },
      { name: "about.rc", kind: "rc", text: rcText },
    ]);
    console.log("Loaded sample about.rc");
  } catch {
    // file:// or offline — ignore
  }
}

// Auto-load sample for convenience when empty
tryLoadSample();

window.__brw = { project, wm, loadProjectFiles, placeDef: () => placeDef };
console.log("Borland Resource Workshop Phase 1 boot complete");
