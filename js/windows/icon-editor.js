/**
 * Icon/Cursor editor — dual-pane 1:1 + zoom, pixel drawing tools.
 * Supports ICO and CUR resource types.
 * */

const ICON_SIZES = [
  { w: 16, h: 16, label: "16x16" },
  { w: 32, h: 32, label: "32x32" },
];

const TOOLS = [
  ["pencil", "Pen"],
  ["eraser", "Eraser"],
  ["fill", "Fill"],
  ["picker", "Picker"],
  ["rect", "Rect"],
  ["line", "Line"],
];

export function openIconEditor(wm, project, resource) {
  const winId = "icon-editor:" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const isCursor = resource.type === "CURSOR";
  const zoom = 8;
  let tool = "pencil";
  let fgColor = "#000000";
  let bgColor = "#ffffff";
  let hotspotX = 0, hotspotY = 0;

  // Store pixels for each image size
  const images = {};
  for (const sz of ICON_SIZES) {
    images[sz.label] = {
      pixels: Array.from({ length: sz.h }, () => Array(sz.w).fill(null)),
      w: sz.w,
      h: sz.h,
    };
  }
  let currentSize = "32x32";

  // Undo/redo stack
  const undoStack = [];
  const redoStack = [];
  function cloneImages() {
    const snap = {};
    for (const [k, v] of Object.entries(images)) {
      snap[k] = { pixels: v.pixels.map(row => [...row]), w: v.w, h: v.h };
    }
    return snap;
  }
  function pushUndo() {
    undoStack.push(cloneImages());
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(cloneImages());
    const prev = undoStack.pop();
    for (const [k, v] of Object.entries(images)) {
      if (prev[k]) { for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) v.pixels[y][x] = prev[k].pixels[y][x]; }
    }
    renderAll(); updateUndoButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(cloneImages());
    const next = redoStack.pop();
    for (const [k, v] of Object.entries(images)) {
      if (next[k]) { for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) v.pixels[y][x] = next[k].pixels[y][x]; }
    }
    renderAll(); updateUndoButtons();
  }

  const win = wm.createWindow({
    id: winId,
    title: (isCursor ? "CURSOR" : "ICON") + " : " + resource.id,
    x: 140, y: 80, w: 620, h: 500,
  });

  const root = document.createElement("div");
  root.className = "icon-editor";

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";

  const toolBtns = {};
  for (const [id, label] of TOOLS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "win-btn tool-btn"; b.dataset.tool = id; b.textContent = label;
    toolbar.appendChild(b); toolBtns[id] = b;
  }
  function setTool(t) { tool = t; for (const [id, b] of Object.entries(toolBtns)) b.classList.toggle("active", id === t); }
  setTool("pencil");
  for (const [id] of TOOLS) toolBtns[id].onclick = () => setTool(id);

  const btnUndo = document.createElement("button");
  btnUndo.type = "button"; btnUndo.className = "win-btn"; btnUndo.textContent = "Undo";
  btnUndo.onclick = undo;
  const btnRedo = document.createElement("button");
  btnRedo.type = "button"; btnRedo.className = "win-btn"; btnRedo.textContent = "Redo";
  btnRedo.onclick = redo;
  function updateUndoButtons() {
    btnUndo.disabled = undoStack.length === 0;
    btnRedo.disabled = redoStack.length === 0;
  }
  updateUndoButtons();
  toolbar.append(btnUndo, btnRedo);

  // Export ICO/CUR
  function buildICO() {
    const entries = ICON_SIZES.map(sz => {
      const img = images[sz.label];
      const rowBytes = Math.ceil((sz.w * 3) / 4) * 4;
      const maskRowBytes = Math.ceil(sz.w / 8 / 4) * 4;
      const bmpSize = 40 + rowBytes * sz.h + maskRowBytes * sz.h;
      return { sz, img, rowBytes, maskRowBytes, bmpSize };
    });
    const dataOffset = 6 + entries.length * 16;
    let totalSize = dataOffset;
    for (const e of entries) totalSize += e.bmpSize;
    const buf = new ArrayBuffer(totalSize);
    const dv = new DataView(buf);
    // ICONDIR
    dv.setUint16(0, 0, true);  // reserved
    dv.setUint16(2, isCursor ? 2 : 1, true);  // type: 1=ICO, 2=CUR
    dv.setUint16(4, entries.length, true);
    // ICONDIRENTRY per image
    let offset = dataOffset;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const base = 6 + i * 16;
      dv.setUint8(base, e.sz.w === 256 ? 0 : e.sz.w);
      dv.setUint8(base + 1, e.sz.h === 256 ? 0 : e.sz.h);
      dv.setUint8(base + 2, 0);  // color count
      dv.setUint8(base + 3, 0);  // reserved
      dv.setUint16(base + 4, isCursor ? hotspotX : 0, true);
      dv.setUint16(base + 6, isCursor ? hotspotY : 0, true)
      dv.setUint32(base + 8, e.bmpSize, true);
      dv.setUint32(base + 12, offset, true);
      offset += e.bmpSize;
    }
    // BMP data for each image
    offset = dataOffset;
    for (const e of entries) {
      const { sz, img, rowBytes, maskRowBytes } = e;
      const bmpH = sz.h * 2;  // XOR + AND mask
      dv.setUint32(offset, 40, true);
      dv.setInt32(offset + 4, sz.w, true);
      dv.setInt32(offset + 8, bmpH, true);
      dv.setUint16(offset + 12, 1, true);
      dv.setUint16(offset + 14, 24, true);
      dv.setUint32(offset + 20, rowBytes * sz.h, true);
      // XOR pixels (bottom-up BGR)
      for (let y = sz.h - 1; y >= 0; y--) {
        for (let x = 0; x < sz.w; x++) {
          const c = img.pixels[y][x] || bgColor;
          const r = parseInt(c.slice(1, 3), 16);
          const g = parseInt(c.slice(3, 5), 16);
          const b = parseInt(c.slice(5, 7), 16);
          const pixOff = offset + 40 + (sz.h - 1 - y) * rowBytes + x * 3;
          dv.setUint8(pixOff, b);
          dv.setUint8(pixOff + 1, g);
          dv.setUint8(pixOff + 2, r);
        }
      }
      // AND mask (all zeros = fully opaque)
      const maskStart = offset + 40 + rowBytes * sz.h;
      for (let y = sz.h - 1; y >= 0; y--) {
        for (let x = 0; x < sz.w; x++) {
          const transparent = img.pixels[y][x] === null;
          if (transparent) {
            const byteIdx = maskStart + (sz.h - 1 - y) * maskRowBytes + Math.floor(x / 8);
            dv.setUint8(byteIdx, dv.getUint8(byteIdx) | (0x80 >> (x % 8)));
          }
        }
      }
      offset += e.bmpSize;
    }
    return new Blob([buf], { type: isCursor ? "image/x-icon" : "image/x-icon" });
  }

  const btnExport = document.createElement("button");
  btnExport.type = "button"; btnExport.className = "win-btn"; btnExport.textContent = "Export ." + (isCursor ? "cur" : "ico");
  btnExport.onclick = () => {
    const blob = buildICO();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = resource.id + "." + (isCursor ? "cur" : "ico");
    a.click();
    URL.revokeObjectURL(a.href);
  };
  toolbar.append(btnExport);

  // Separator
  const sep1 = document.createElement("span");
  sep1.className = "toolbar-separator";
  toolbar.appendChild(sep1);

  // Size selector
  for (const sz of ICON_SIZES) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "win-btn tool-btn"; b.textContent = sz.label;
    if (sz.label === currentSize) b.classList.add("active");
    b.onclick = () => {
      currentSize = sz.label;
      for (const [k, btn] of Object.entries(sizeBtns)) btn.classList.toggle("active", k === sz.label);
      renderAll();
    };
    toolbar.appendChild(b);
    if (!sizeBtns) var sizeBtns = {};
    sizeBtns[sz.label] = b;
  }

  // Color bar
  const colorBar = document.createElement("div");
  colorBar.className = "bitmap-colorbar";
  const fgSwatch = document.createElement("input");
  fgSwatch.type = "color"; fgSwatch.value = fgColor; fgSwatch.title = "Foreground";
  fgSwatch.oninput = () => { fgColor = fgSwatch.value; };
  const bgSwatch = document.createElement("input");
  bgSwatch.type = "color"; bgSwatch.value = bgColor; bgSwatch.title = "Background (transparent)";
  bgSwatch.oninput = () => { bgColor = bgSwatch.value; };
  const transpLabel = document.createElement("span");
  transpLabel.textContent = "BG = Transparent";
  transpLabel.className = "icon-transp-label";
  colorBar.append(fgSwatch, bgSwatch, transpLabel);

  // Hotspot (cursor only)
  const hotspotBar = document.createElement("div");
  hotspotBar.className = "icon-hotspot-bar";
  hotspotBar.style.display = isCursor ? "flex" : "none";
  const hsXLabel = document.createElement("label");
  hsXLabel.textContent = "Hotspot X:";
  const hsXInput = document.createElement("input");
  hsXInput.type = "number"; hsXInput.min = "0"; hsXInput.value = String(hotspotX);
  hsXInput.className = "win-input";
  hsXInput.style.width = "40px";
  hsXInput.oninput = () => { hotspotX = parseInt(hsXInput.value) || 0; };
  const hsYLabel = document.createElement("label");
  hsYLabel.textContent = "Y:";
  const hsYInput = document.createElement("input");
  hsYInput.type = "number"; hsYInput.min = "0"; hsYInput.value = String(hotspotY);
  hsYInput.className = "win-input";
  hsYInput.style.width = "40px";
  hsYInput.oninput = () => { hotspotY = parseInt(hsYInput.value) || 0; };
  hotspotBar.append(hsXLabel, hsXInput, hsYLabel, hsYInput);

  // Canvas area
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "icon-canvas-wrap";
  const canvas = document.createElement("canvas");
  canvas.className = "icon-canvas";
  const ctx = canvas.getContext("2d");
  canvasWrap.appendChild(canvas);

  // Status
  const status = document.createElement("div");
  status.className = "editor-status";

  function getCurrentPixels() { return images[currentSize].pixels; }
  function getCurrentW() { return images[currentSize].w; }
  function getCurrentH() { return images[currentSize].h; }

  function renderAll() {
    const w = getCurrentW();
    const h = getCurrentH();
    canvas.width = w * zoom;
    canvas.height = h * zoom;
    const pix = getCurrentPixels();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Checkerboard background for transparent
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const checker = (x + y) % 2 === 0 ? "#ffffff" : "#cccccc";
        ctx.fillStyle = pix[y][x] || checker;
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }
    // Grid
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x * zoom, 0); ctx.lineTo(x * zoom, h * zoom); ctx.stroke(); }
    for (let y = 0; y <= h; y++) { ctx.beginPath(); ctx.moveTo(0, y * zoom); ctx.lineTo(w * zoom, y * zoom); ctx.stroke(); }
    // Hotspot crosshair for cursors
    if (isCursor) {
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hotspotX * zoom + zoom / 2, 0);
      ctx.lineTo(hotspotX * zoom + zoom / 2, h * zoom);
      ctx.moveTo(0, hotspotY * zoom + zoom / 2);
      ctx.lineTo(w * zoom, hotspotY * zoom + zoom / 2);
      ctx.stroke();
    }
    status.textContent = currentSize + " | " + w + "x" + h + " pixels" + (isCursor ? " | Hotspot: " + hotspotX + "," + hotspotY : "");
  }

  function getPixelFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor((ev.clientX - rect.left) / zoom);
    const py = Math.floor((ev.clientY - rect.top) / zoom);
    if (px < 0 || px >= getCurrentW() || py < 0 || py >= getCurrentH()) return null;
    return { x: px, y: py };
  }

  function floodFill(sx, sy, fillColor) {
    const pix = getCurrentPixels();
    const target = pix[sy][sx];
    if (target === fillColor) return;
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= getCurrentW() || y < 0 || y >= getCurrentH()) continue;
      if (pix[y][x] !== target) continue;
      pix[y][x] = fillColor;
      stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
  }

  let drawing = false;
  let drawStart = null;

  canvas.addEventListener("mousedown", (ev) => {
    const p = getPixelFromEvent(ev); if (!p) return;
    pushUndo(); drawing = true; drawStart = p;
    const pix = getCurrentPixels();
    if (tool === "pencil") { pix[p.y][p.x] = fgColor; renderAll(); }
    else if (tool === "eraser") { pix[p.y][p.x] = null; renderAll(); }
    else if (tool === "fill") { floodFill(p.x, p.y, fgColor); renderAll(); }
    else if (tool === "picker") { const c = pix[p.y][p.x]; if (c) { fgColor = c; fgSwatch.value = c; } }
  });

  canvas.addEventListener("mousemove", (ev) => {
    if (!drawing) return;
    const p = getPixelFromEvent(ev); if (!p) return;
    const pix = getCurrentPixels();
    if (tool === "pencil") { pix[p.y][p.x] = fgColor; renderAll(); }
    else if (tool === "eraser") { pix[p.y][p.x] = null; renderAll(); }
  });

  window.addEventListener("mouseup", (ev) => {
    if (!drawing) return;
    const pix = getCurrentPixels();
    if (tool === "rect" && drawStart) {
      const p = getPixelFromEvent(ev);
      if (p) {
        const x1 = Math.min(drawStart.x, p.x), x2 = Math.max(drawStart.x, p.x);
        const y1 = Math.min(drawStart.y, p.y), y2 = Math.max(drawStart.y, p.y);
        for (let x = x1; x <= x2; x++) { pix[y1][x] = fgColor; pix[y2][x] = fgColor; }
        for (let y = y1; y <= y2; y++) { pix[y][x1] = fgColor; pix[y][x2] = fgColor; }
        renderAll();
      }
    } else if (tool === "line" && drawStart) {
      const p = getPixelFromEvent(ev);
      if (p) {
        const dx = Math.abs(p.x - drawStart.x), dy = Math.abs(p.y - drawStart.y);
        const sx = drawStart.x < p.x ? 1 : -1, sy = drawStart.y < p.y ? 1 : -1;
        let err = dx - dy, cx = drawStart.x, cy = drawStart.y;
        while (true) {
          if (cx >= 0 && cx < getCurrentW() && cy >= 0 && cy < getCurrentH()) pix[cy][cx] = fgColor;
          if (cx === p.x && cy === p.y) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; cx += sx; }
          if (e2 < dx) { err += dx; cy += sy; }
        }
        renderAll();
      }
    }
    drawing = false; drawStart = null;
  });

  root.appendChild(toolbar);
  root.appendChild(colorBar);
  root.appendChild(hotspotBar);
  root.appendChild(canvasWrap);
  root.appendChild(status);
  win.content.innerHTML = "";
  win.content.appendChild(root);
  renderAll();

  // Keyboard shortcuts
  function onKeyDown(ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "z" && !ev.shiftKey) { ev.preventDefault(); undo(); }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "y" || (ev.key === "z" && ev.shiftKey))) { ev.preventDefault(); redo(); }
  }
  document.addEventListener("keydown", onKeyDown);
  win.onDestroy = () => document.removeEventListener("keydown", onKeyDown);
}

