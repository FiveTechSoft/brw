// js/main.js — Task 5 temporary boot (demo Project window)
import { WindowManager } from "./ui/window-manager.js";

const wm = new WindowManager(
  document.getElementById("desktop"),
  document.getElementById("taskstrip")
);

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

window.__brw = { wm };
console.log("Borland Resource Workshop — WindowManager ready");
