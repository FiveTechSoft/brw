/**
 * Floating Alignment palette (classic RW).
 */

/**
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {(cmd: string) => void} onAlign
 */
export function openAlignPalette(wm, onAlign) {
  const win = wm.createWindow({
    id: "align-palette",
    title: "Alignment",
    x: 560,
    y: 40,
    w: 160,
    h: 140,
  });

  const root = document.createElement("div");
  root.className = "align-palette";
  const grid = document.createElement("div");
  grid.className = "align-grid";

  const buttons = [
    ["left", "⫷", "Left sides"],
    ["hcenter", "≡", "Horizontal centers"],
    ["right", "⫸", "Right sides"],
    ["hspace", "⟷", "Space equally horizontal"],
    ["top", "⬆", "Tops"],
    ["vcenter", "⋮", "Vertical centers"],
    ["bottom", "⬇", "Bottoms"],
    ["vspace", "↕", "Space equally vertical"],
    ["cdlg-h", "▣", "Center in dialog H"],
    ["cdlg-v", "▤", "Center in dialog V"],
  ];

  for (const [cmd, label, title] of buttons) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "win-btn";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", () => onAlign(cmd));
    grid.appendChild(b);
  }
  root.appendChild(grid);
  win.content.innerHTML = "";
  win.content.appendChild(root);
  return win;
}
