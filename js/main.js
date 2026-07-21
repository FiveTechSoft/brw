// js/main.js — full shell boot
import { ProjectModel } from "./core/project-model.js";
import { WindowManager } from "./ui/window-manager.js";
import { createMenubar } from "./ui/menubar.js";
import { createSpeedbar } from "./ui/speedbar.js";
import { setupDesktop } from "./ui/desktop.js";

const project = new ProjectModel();
const desktopEl = setupDesktop(document.getElementById("desktop"));
const wm = new WindowManager(desktopEl, document.getElementById("taskstrip"));

function stub(name) {
  return () => console.log(`[stub] ${name}`);
}

function onNewProject() {
  project.clear();
  console.log("New Project — cleared");
}

function onUndo() {
  if (project.undo.canUndo) {
    project.undo.undo();
    console.log("Undo:", project.undo.redoLabel || "done");
  } else {
    console.log("Nothing to undo");
  }
}

function onRedo() {
  if (project.undo.canRedo) {
    project.undo.redo();
    console.log("Redo:", project.undo.undoLabel || "done");
  } else {
    console.log("Nothing to redo");
  }
}

function onNewDialog() {
  const dlg = project.createDialog();
  console.log("New Dialog:", dlg.id, dlg);
}

function onAbout() {
  alert("Borland Resource Workshop\nPhase 1 — Win95 shell");
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

createMenubar(document.getElementById("menubar"), [
  {
    label: "File",
    items: [
      { label: "New Project", action: onNewProject },
      { label: "Open…", action: stub("Open") },
      { label: "Save Project", action: stub("Save Project") },
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
      { label: "Identifiers…", action: stub("Identifiers") },
    ],
  },
  {
    label: "Window",
    items: [
      { label: "Cascade", action: onCascade },
      { label: "Tile", action: onTile },
    ],
  },
  {
    label: "Help",
    items: [{ label: "About", action: onAbout }],
  },
]);

createSpeedbar(document.getElementById("speedbar"), [
  { label: "New", title: "New Project", action: onNewProject },
  { label: "Open", title: "Open", action: stub("Open") },
  { label: "Save", title: "Save Project", action: stub("Save Project") },
  "-",
  { label: "Undo", title: "Undo", action: onUndo },
  { label: "Redo", title: "Redo", action: onRedo },
  "-",
  { label: "New Dialog", title: "New Dialog", action: onNewDialog },
]);

// Create initial Project window (empty content — Task 10 will fill tree)
const projWin = wm.createWindow({
  id: "project",
  title: "Project",
  x: 20,
  y: 20,
  w: 360,
  h: 400,
});
projWin.content.innerHTML =
  "<div style='padding:8px'>Project window (tree in Task 10)</div>";

// Export for debugging
window.__brw = { project, wm };

console.log("Borland Resource Workshop boot complete");
