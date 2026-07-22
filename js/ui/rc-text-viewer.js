// js/ui/rc-text-viewer.js — Modal window that displays RC source as read-only text
import { compileRc, compileHeader } from "../engine/rc-compiler.js";

/**
 * Open a modal window showing the compiled RC text.
 * @param {import("./window-manager.js").WindowManager} wm
 * @param {import("../core/project-model.js").ProjectModel} project
 */
export function openRcTextViewer(wm, project) {
  const winId = "rc-text-viewer";
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const win = wm.createWindow({
    id: winId,
    title: "RC Text",
    x: 120, y: 60, w: 640, h: 480,
    modal: true,
  });

  const root = document.createElement("div");
  root.style.cssText = "display:flex;flex-direction:column;height:100%;padding:4px;gap:4px;";

  const tabBar = document.createElement("div");
  tabBar.style.cssText = "display:flex;gap:2px;";
  const btnRc = document.createElement("button");
  btnRc.type = "button";
  btnRc.className = "win-btn";
  btnRc.textContent = "resource.rc";
  btnRc.style.fontWeight = "bold";
  const btnH = document.createElement("button");
  btnH.type = "button";
  btnH.className = "win-btn";
  btnH.textContent = "resource.h";
  tabBar.appendChild(btnRc);
  tabBar.appendChild(btnH);
  root.appendChild(tabBar);

  const textarea = document.createElement("textarea");
  textarea.style.cssText = "flex:1;font-family:Consolas,'Courier New',monospace;font-size:12px;resize:none;width:100%;";
  textarea.readOnly = true;
  textarea.spellcheck = false;
  root.appendChild(textarea);

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;justify-content:flex-end;gap:4px;";
  const btnClose = document.createElement("button");
  btnClose.type = "button";
  btnClose.className = "win-btn";
  btnClose.textContent = "Close";
  btnClose.onclick = () => win.close();
  const btnCopy = document.createElement("button");
  btnCopy.type = "button";
  btnCopy.className = "win-btn";
  btnCopy.textContent = "Copy";
  btnCopy.onclick = () => {
    textarea.select();
    document.execCommand("copy");
  };
  btnRow.appendChild(btnCopy);
  btnRow.appendChild(btnClose);
  root.appendChild(btnRow);

  function showRc() {
    btnRc.style.fontWeight = "bold";
    btnH.style.fontWeight = "normal";
    textarea.value = compileRc(project);
  }
  function showH() {
    btnRc.style.fontWeight = "normal";
    btnH.style.fontWeight = "bold";
    textarea.value = compileHeader(project.identifiers);
  }
  btnRc.onclick = showRc;
  btnH.onclick = showH;

  showRc();

  win.content.innerHTML = "";
  win.content.appendChild(root);
}
