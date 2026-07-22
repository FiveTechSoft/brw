/**
 * Bitmap resource editor with pixel drawing tools and undo/redo.
 * Supports custom canvas sizes, export BMP, flood fill, Bresenham lines.
 */

export function openBitmapEditor(wm, project, resource) {
  const winId = "bitmap-editor:" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  // Default size; will be overridden if loading from binary
  let W = 32, H = 32;
  const scale = 10;
  let tool = "pencil";
  let fgColor = "#000000";
  let bgColor = "#ffffff";
  let pixels = Array.from({ length: H }, () => Array(W).fill(null));

  // Try to load from binary resource data if available
  if (resource.data && resource.data.byteLength) {
    try {
      const dv = new DataView(resource.data);
      // BMP: offset 18 = width, offset 22 = height (can be negative = top-down)
      if (dv.getUint8(0) === 0x42 && dv.getUint8(1) === 0x4D) {
        W = dv.getInt32(18, true);
        const rawH = dv.getInt32(22, true);
        const topDown = rawH < 0;
        H = Math.abs(rawH);
        const bpp = dv.getUint16(28, true);
        const rowBytes = Math.ceil((W * (bpp / 8)) / 4) * 4;
        pixels = Array.from({ length: H }, () => Array(W).fill(null));
        if (bpp === 24) {
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const srcY = topDown ? y : (H - 1 - y);
              const off = 54 + srcY * rowBytes + x * 3;
              if (off + 2 < resource.data.byteLength) {
                const b = dv.getUint8(off);
                const g = dv.getUint8(off + 1);
                const r = dv.getUint8(off + 2);
                if (r !== 0 || g !== 0 || b !== 0) {
                  pixels[y][x] = "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
                }
              }
            }
          }
        } else if (bpp === 32) {
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const srcY = topDown ? y : (H - 1 - y);
              const off = 54 + srcY * rowBytes + x * 4;
              if (off + 3 < resource.data.byteLength) {
                const b = dv.getUint8(off);
                const g = dv.getUint8(off + 1);
                const r = dv.getUint8(off + 2);
                const a = dv.getUint8(off + 3);
                if (a > 0) {
                  pixels[y][x] = "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not parse bitmap data:", e);
    }
  }

  // Undo/redo stack
  const undoStack = [];
  const redoStack = [];
  function clonePixels() { return pixels.map(row => [...row]); }
  function pushUndo() {
    undoStack.push(clonePixels());
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    updateButtons();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(clonePixels());
    const prev = undoStack.pop();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pixels[y][x] = prev[y][x];
    repaint(); updateButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(clonePixels());
    const next = redoStack.pop();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pixels[y][x] = next[y][x];
    repaint(); updateButtons();
  }

  const win = wm.createWindow({
    id: winId,
    title: "BITMAP : " + resource.id,
    x: 120, y: 60, w: 520, h: 480,
  });

  const root = document.createElement("div");
  root.className = "bitmap-editor";

  // -- Toolbar --
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";

  const btnUndo = mkBtn("Undo", undo);
  const btnRedo = mkBtn("Redo", redo);
  toolbar.append(btnUndo, btnRedo);

  // Size controls
  const sep1 = mkSep();
  const lblW = document.createElement("label");
  lblW.textContent = "W:"; lblW.style.fontSize = "11px";
  const inpW = document.createElement("input");
  inpW.type = "number"; inpW.value = W; inpW.min = 1; inpW.max = 256;
  inpW.style.cssText = "width:48px;font-size:11px;";
  const lblH = document.createElement("label");
  lblH.textContent = "H:"; lblH.style.fontSize = "11px";
  const inpH = document.createElement("input");
  inpH.type = "number"; inpH.value = H; inpH.min = 1; inpH.max = 256;
  inpH.style.cssText = "width:48px;font-size:11px;";
  const btnResize = mkBtn("Resize", () => resizeCanvas());
  toolbar.append(sep1, lblW, inpW, lblH, inpH, btnResize);

  // Export
  const sep2 = mkSep();
  const btnExport = mkBtn("Export .bmp", () => exportBMP());
  toolbar.append(sep2, btnExport);

  function mkBtn(label, fn) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "win-btn"; b.textContent = label;
    b.onclick = fn; return b;
  }
  function mkSep() {
    const s = document.createElement("span");
    s.style.cssText = "display:inline-block;width:1px;height:20px;background:var(--shadow);margin:0 4px;vertical-align:middle;";
    return s;
  }

  function updateButtons() {
    btnUndo.disabled = undoStack.length === 0;
    btnRedo.disabled = redoStack.length === 0;
  }
  updateButtons();

  function resizeCanvas() {
    const newW = Math.max(1, Math.min(256, parseInt(inpW.value) || 32));
    const newH = Math.max(1, Math.min(256, parseInt(inpH.value) || 32));
    if (newW === W && newH === H) return;
    pushUndo();
    const newPixels = Array.from({ length: newH }, (_, y) =>
      Array.from({ length: newW }, (_, x) => y < H && x < W ? pixels[y][x] : null)
    );
    pixels = newPixels;
    W = newW; H = newH;
    canvas.width = W * scale;
    canvas.height = H * scale;
    repaint();
    status.textContent = W + " x " + H + " pixels";
  }

  // -- Drawing tools --
  const tools = [["pencil","Pen"],["eraser","Eraser"],["fill","Fill"],["picker","Picker"],["rect","Rect"],["line","Line"]];
  const toolBtns = {};
  for (const [id, label] of tools) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "win-btn tool-btn"; b.dataset.tool = id; b.textContent = label;
    toolbar.appendChild(b); toolBtns[id] = b;
  }
  function setTool(t) { tool = t; for (const [id, b] of Object.entries(toolBtns)) b.classList.toggle("active", id === t); }
  setTool("pencil");
  for (const [id] of tools) toolBtns[id].onclick = () => setTool(id);

  // -- Colors --
  const colorBar = document.createElement("div");
  colorBar.className = "bitmap-colorbar";
  const fgSwatch = document.createElement("input");
  fgSwatch.type = "color"; fgSwatch.value = fgColor; fgSwatch.title = "Foreground";
  fgSwatch.addEventListener("input", () => { fgColor = fgSwatch.value; });
  const bgSwatch = document.createElement("input");
  bgSwatch.type = "color"; bgSwatch.value = bgColor; bgSwatch.title = "Background";
  bgSwatch.addEventListener("input", () => { bgColor = bgSwatch.value; });
  colorBar.append(fgSwatch, bgSwatch);

  // -- Canvas --
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "bitmap-canvas-wrap";
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.className = "bitmap-canvas";
  const ctx = canvas.getContext("2d");
  canvasWrap.appendChild(canvas);

  // -- Status --
  const status = document.createElement("div");
  status.className = "editor-status";
  status.textContent = W + " x " + H + " pixels";

  function repaint() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Checkerboard background for transparency
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isLight = (x + y) % 2 === 0;
        ctx.fillStyle = pixels[y][x] || (isLight ? "#ffffff" : "#e0e0e0");
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    // Grid
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x * scale + 0.5, 0); ctx.lineTo(x * scale + 0.5, H * scale); ctx.stroke(); }
    for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0, y * scale + 0.5); ctx.lineTo(W * scale, y * scale + 0.5); ctx.stroke(); }
  }

  function getPixelFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor((ev.clientX - rect.left) / scale);
    const py = Math.floor((ev.clientY - rect.top) / scale);
    if (px < 0 || px >= W || py < 0 || py >= H) return null;
    return { x: px, y: py };
  }

  function floodFill(sx, sy, fillColor) {
    const target = pixels[sy][sx];
    if (target === fillColor) return;
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if (pixels[y][x] !== target) continue;
      pixels[y][x] = fillColor;
      stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
    }
  }

  let drawing = false;
  let drawStart = null;

  canvas.addEventListener("mousedown", (ev) => {
    const p = getPixelFromEvent(ev); if (!p) return;
    pushUndo(); drawing = true; drawStart = p;
    if (tool === "pencil") { pixels[p.y][p.x] = fgColor; repaint(); }
    else if (tool === "eraser") { pixels[p.y][p.x] = null; repaint(); }
    else if (tool === "fill") { floodFill(p.x, p.y, fgColor); repaint(); }
    else if (tool === "picker") { const c = pixels[p.y][p.x] || bgColor; fgColor = c; fgSwatch.value = c; undoStack.pop(); }
    updateButtons();
  });

  canvas.addEventListener("mousemove", (ev) => {
    if (!drawing) return;
    const p = getPixelFromEvent(ev); if (!p) return;
    if (tool === "pencil") { pixels[p.y][p.x] = fgColor; repaint(); }
    else if (tool === "eraser") { pixels[p.y][p.x] = null; repaint(); }
  });

  window.addEventListener("mouseup", (ev) => {
    if (!drawing) return;
    if (tool === "rect" && drawStart) {
      const p = getPixelFromEvent(ev);
      if (p) {
        const x1 = Math.min(drawStart.x, p.x), x2 = Math.max(drawStart.x, p.x);
        const y1 = Math.min(drawStart.y, p.y), y2 = Math.max(drawStart.y, p.y);
        for (let x = x1; x <= x2; x++) { pixels[y1][x] = fgColor; pixels[y2][x] = fgColor; }
        for (let y = y1; y <= y2; y++) { pixels[y][x1] = fgColor; pixels[y][x2] = fgColor; }
        repaint();
      }
    } else if (tool === "line" && drawStart) {
      const p = getPixelFromEvent(ev);
      if (p) {
        // Bresenham
        const dx = Math.abs(p.x - drawStart.x), dy = Math.abs(p.y - drawStart.y);
        const sx = drawStart.x < p.x ? 1 : -1, sy = drawStart.y < p.y ? 1 : -1;
        let err = dx - dy, cx = drawStart.x, cy = drawStart.y;
        while (true) {
          if (cx >= 0 && cx < W && cy >= 0 && cy < H) pixels[cy][cx] = fgColor;
          if (cx === p.x && cy === p.y) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; cx += sx; }
          if (e2 < dx) { err += dx; cy += sy; }
        }
        repaint();
      }
    }
    drawing = false; drawStart = null;
  });

  // -- Export BMP --
  function exportBMP() {
    const rowBytes = Math.ceil((W * 3) / 4) * 4;
    const pixelSize = rowBytes * H;
    const fileSize = 14 + 40 + pixelSize;
    const buf = new ArrayBuffer(fileSize);
    const dv = new DataView(buf);
    dv.setUint8(0, 0x42); dv.setUint8(1, 0x4D);
    dv.setUint32(2, fileSize, true);
    dv.setUint32(10, 14 + 40, true);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, W, true);
    dv.setInt32(22, H, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(34, pixelSize, true);
    for (let y = H - 1; y >= 0; y--) {
      for (let x = 0; x < W; x++) {
        const off = 54 + (H - 1 - y) * rowBytes + x * 3;
        const c = pixels[y][x] || bgColor;
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        dv.setUint8(off, b); dv.setUint8(off + 1, g); dv.setUint8(off + 2, r);
      }
    }
    const blob = new Blob([buf], { type: "image/bmp" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = resource.id + ".bmp";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // -- Keyboard shortcuts --
  function onKeyDown(ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "z" && !ev.shiftKey) { ev.preventDefault(); undo(); }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "y" || (ev.key === "z" && ev.shiftKey))) { ev.preventDefault(); redo(); }
  }
  document.addEventListener("keydown", onKeyDown);
  win.onDestroy = () => document.removeEventListener("keydown", onKeyDown);

  root.append(toolbar, colorBar, canvasWrap, status);
  win.content.innerHTML = "";
  win.content.appendChild(root);
  repaint();
}