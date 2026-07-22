/**
 * Floating Control Palette (Standard + BWCC).
 */
import { WS, BS, SS, ES, CBS, LBS } from "../core/constants.js";

const CHILD = WS.CHILD | WS.VISIBLE;
const TAB = WS.TABSTOP;

/** @type {object[]} */
export const PALETTE_STANDARD = [
  { label: "Push Button", className: "BUTTON", text: "Button", style: CHILD | TAB | BS.PUSHBUTTON, cx: 50, cy: 14 },
  { label: "Def Push Button", className: "BUTTON", text: "OK", style: CHILD | TAB | BS.DEFPUSHBUTTON, cx: 50, cy: 14 },
  { label: "Check Box", className: "BUTTON", text: "Check", style: CHILD | TAB | BS.AUTOCHECKBOX, cx: 60, cy: 12 },
  { label: "Radio Button", className: "BUTTON", text: "Radio", style: CHILD | TAB | BS.AUTORADIOBUTTON, cx: 60, cy: 12 },
  { label: "Group Box", className: "BUTTON", text: "Group", style: CHILD | BS.GROUPBOX, cx: 80, cy: 50 },
  { label: "Edit Text", className: "EDIT", text: "", style: CHILD | TAB | WS.BORDER | ES.AUTOHSCROLL, cx: 80, cy: 14 },
  { label: "LTEXT", className: "STATIC", text: "Static", style: CHILD | SS.LEFT, cx: 60, cy: 10 },
  { label: "CTEXT", className: "STATIC", text: "Static", style: CHILD | SS.CENTER, cx: 60, cy: 10 },
  { label: "RTEXT", className: "STATIC", text: "Static", style: CHILD | SS.RIGHT, cx: 60, cy: 10 },
  { label: "List Box", className: "LISTBOX", text: "", style: CHILD | TAB | WS.BORDER | WS.VSCROLL | LBS.NOTIFY, cx: 80, cy: 40 },
  { label: "Combo Box", className: "COMBOBOX", text: "", style: CHILD | TAB | CBS.DROPDOWNLIST | WS.VSCROLL, cx: 80, cy: 60 },
  { label: "Icon", className: "STATIC", text: "", style: CHILD | SS.ICON, cx: 20, cy: 20 },
];

/** @type {object[]} */
export const PALETTE_BWCC = [
  { label: "BorBtn", className: "BorBtn", text: "", style: CHILD | TAB, cx: 32, cy: 20 },
  { label: "BorCheck", className: "BorCheck", text: "Check", style: CHILD | TAB, cx: 80, cy: 12 },
  { label: "BorRadio", className: "BorRadio", text: "Radio", style: CHILD | TAB, cx: 80, cy: 12 },
  { label: "BorShade", className: "BorShade", text: "", style: CHILD, cx: 100, cy: 60 },
  { label: "BorStatic", className: "BorStatic", text: "Text", style: CHILD, cx: 60, cy: 10 },
];

/**
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {(def: object) => void} onPick
 */
export function openControlPalette(wm, onPick) {
  const win = wm.createWindow({
    id: "palette",
    title: "Tools",
    x: 640,
    y: 40,
    w: 168,
    h: 440,
  });

  const root = document.createElement("div");
  root.className = "control-palette";

  function section(title, items) {
    const h = document.createElement("div");
    h.className = "palette-section-title";
    h.textContent = title;
    root.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "palette-grid";
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn win-btn";
      btn.textContent = item.label;
      btn.title = item.className;
      btn.addEventListener("click", () => {
        root.querySelectorAll(".palette-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        onPick({ ...item });
      });
      grid.appendChild(btn);
    }
    root.appendChild(grid);
  }

  section("Standard", PALETTE_STANDARD);
  section("BWCC", PALETTE_BWCC);

  // User-defined control
  const userSection = document.createElement("div");
  userSection.className = "palette-section-title";
  userSection.textContent = "User";
  root.appendChild(userSection);
  const userGrid = document.createElement("div");
  userGrid.className = "palette-grid";
  userGrid.style.gridTemplateColumns = "1fr";
  userGrid.innerHTML = `
    <div style="display:grid;gap:2px;padding:2px">
      <input type="text" class="user-class" placeholder="ClassName (e.g. MyCtrl)" style="width:100%" />
      <input type="text" class="user-text" placeholder="Text" style="width:100%" />
      <div style="display:flex;gap:2px">
        <input type="number" class="user-cx" placeholder="W" value="50" style="width:50%" />
        <input type="number" class="user-cy" placeholder="H" value="14" style="width:50%" />
      </div>
      <input type="text" class="user-style" placeholder="Style (hex, e.g. 50010000)" style="width:100%" />
      <button type="button" class="win-btn palette-btn user-place">Place</button>
    </div>
  `;
  root.appendChild(userGrid);
  userGrid.querySelector(".user-place").addEventListener("click", () => {
    const cls = userGrid.querySelector(".user-class").value.trim();
    if (!cls) { alert("Enter a ClassName"); return; }
    const text = userGrid.querySelector(".user-text").value;
    const cx = parseInt(userGrid.querySelector(".user-cx").value, 10) || 50;
    const cy = parseInt(userGrid.querySelector(".user-cy").value, 10) || 14;
    const style = parseInt(userGrid.querySelector(".user-style").value, 16) || (WS.CHILD | WS.VISIBLE);
    root.querySelectorAll(".palette-btn").forEach((b) => b.classList.remove("active"));
    userGrid.querySelector(".user-place").classList.add("active");
    onPick({ label: cls, className: cls, text, style, cx, cy });
  });

  win.content.innerHTML = "";
  win.content.appendChild(root);
  return win;
}


