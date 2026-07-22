/**
 * Font resource editor — visual bitmap font editor.
 * Parses FONT rawText (RC format), renders character grid, allows pixel editing of glyphs.
 * Supports: FONT 4/5/6/7/8 resource types, character grid, per-glyph pixel editing, undo/redo.
 */

const FONT_RANGES = {
  ascii: { start: 32, end: 126, label: "ASCII 32-126" },
  extended: { start: 128, end: 255, label: "Extended 128-255" },
  full: { start: 0, end: 255, label: "Full 0-255" },
};

/**
 * Parse FONT rawText into a structure.
 * FONT resources can be:
 *   - Binary .fnt files loaded as ArrayBuffer
 *   - RC text referencing a .fnt file
 *   - Structured font definition
 */
function parseFontData(raw, data) {
  const result = {
    height: 16,
    width: 0, // 0 = variable width
    firstChar: 32,
    lastChar: 126,
    chars: {},
  };

  // Try to parse from binary .fnt data (Windows FNT format)
  if (data && data.byteLength > 0) {
    try {
      const dv = new DataView(data);
      // Windows 3.x FNT header
      const dfVersion = dv.getUint16(0, true);
      const dfSize = dv.getUint32(2, true);
      result.height = dv.getInt16(6, true);
      const dfWeight = dv.getInt16(8, true);
      result.firstChar = dv.getUint8(22);
      result.lastChar = dv.getUint8(23);
      const dfWidthBytes = dv.getUint8(65);
      const dfBits = dv.getUint8(66);

      // Calculate glyph size
      const glyphBytes = Math.ceil(result.height * dfBits / 8);
      const totalGlyphs = result.lastChar - result.firstChar + 1;

      for (let i = 0; i < totalGlyphs; i++) {
        const offset = 0x76 + i * glyphBytes; // FNT header is 0x76 bytes
        if (offset + glyphBytes > data.byteLength) break;

        const charCode = result.firstChar + i;
        const charW = dfWidthBytes;
        const charH = result.height;
        const pixels = Array.from({ length: charH }, () => Array(charW).fill(null));

        for (let y = 0; y < charH; y++) {
          const rowOff = offset + y * dfWidthBytes;
          for (let bit = 0; bit < dfBits; bit++) {
            const byteOff = rowOff + Math.floor(bit / 8);
            const bitOff = 7 - (bit % 8);
            if (byteOff < data.byteLength) {
              const val = dv.getUint8(byteOff);
              if (val & (1 << bitOff)) {
                pixels[y][bit] = "#000000";
              }
            }
          }
        }

        result.chars[charCode] = {
          pixels,
          width: charW,
          height: charH,
        };
      }
      return result;
    } catch (e) {
      console.warn("Could not parse FNT binary:", e);
    }
  }

  // Create default empty character set
  const h = result.height;
  const w = 8;
  for (let c = result.firstChar; c <= result.lastChar; c++) {
    result.chars[c] = {
      pixels: Array.from({ length: h }, () => Array(w).fill(null)),
      width: w,
      height: h,
    };
  }
  return result;
}

/**
 * Open a Font Editor MDI window.
 */
export function openFontEditor(wm, project, resource) {
  const winId = "font-editor:" + resource.id;
  if (wm.windows.has(winId)) { wm.focus(winId); return; }

  const fontData = parseFontData(resource.rawText || "", resource.data);
  let tool = "pencil";
  let fgColor = "#000000";
  let currentCharCode = 32; // Space by default
  let charZoom = 6;
  const range = FONT_RANGES.ascii;

  // Undo/redo
  const undoStack = [];
  const redoStack = [];
  function cloneChars() { return JSON.parse(JSON.stringify(fontData.chars)); }
  function pushUndo() {
    undoStack.push(cloneChars());
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(cloneChars());
    fontData.chars = undoStack.pop();
    repaintGlyph();
    renderGrid();
    updateUndoButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(cloneChars());
    fontData.chars = redoStack.pop();
    repaintGlyph();
    renderGrid();
    updateUndoButtons();
  }
  function updateUndoButtons() {
    btnUndo.disabled = undoStack.length === 0;
    btnRedo.disabled = redoStack.length === 0;
  }

  const win = wm.createWindow({
    id: winId,
    title: "FONT : " + resource.id,
    x: 100, y: 50, w: 700, h: 520,
  });

  const root = document.createElement("div");
  root.className = "font-editor";

  // ── Toolbar ──
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";

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

  const btnUndo = mkBtn("Undo", undo);
  const btnRedo = mkBtn("Redo", redo);

  // Tools
  const tools = [["pencil","Pen"],["eraser","Eraser"],["picker","Picker"],["fill","Fill"]];
  const toolBtns = {};
  for (const [id, label] of tools) {
    const b = mkBtn(label, () => { tool = id; for (const [tid, tb] of Object.entries(toolBtns)) tb.classList.toggle("active", tid === id); });
    b.className = "win-btn tool-btn"; b.dataset.tool = id;
    toolbar.appendChild(b); toolBtns[id] = b;
  }
  toolBtns["pencil"].classList.add("active");

  // Colors
  const fgSwatch = document.createElement("input");
  fgSwatch.type = "color"; fgSwatch.value = fgColor; fgSwatch.title = "Foreground";
  fgSwatch.addEventListener("input", () => { fgColor = fgSwatch.value; });

  // Zoom
  const zoomIn = mkBtn("+", () => { charZoom = Math.min(16, charZoom + 1); resizeGlyphCanvas(); });
  const zoomOut = mkBtn("-", () => { charZoom = Math.max(2, charZoom - 1); resizeGlyphCanvas(); });
  const zoomLabel = document.createElement("span");
  zoomLabel.style.cssText = "font-size:11px;min-width:40px;text-align:center;";
  zoomLabel.textContent = charZoom + "x";

  toolbar.append(btnUndo, btnRedo, mkSep(), fgSwatch, mkSep(), zoomOut, zoomLabel, zoomIn);
  updateUndoButtons();

  // ── Main layout: left = character grid, right = glyph editor ──
  const split = document.createElement("div");
  split.style.cssText = "flex:1;display:flex;overflow:hidden;";

  // Character grid panel
  const gridPanel = document.createElement("div");
  gridPanel.style.cssText = "flex:1;overflow:auto;background:#fff;border-right:1px solid var(--shadow);padding:4px;";
  const gridEl = document.createElement("div");
  gridEl.style.cssText = "display:grid;grid-template-columns:repeat(16,1fr);gap:1px;";
  gridPanel.appendChild(gridEl);

  // Glyph editor panel
  const glyphPanel = document.createElement("div");
  glyphPanel.style.cssText = "width:340px;display:flex;flex-direction:column;overflow:hidden;";

  const glyphLabel = document.createElement("div");
  glyphLabel.style.cssText = "padding:4px 6px;font-weight:bold;border-bottom:1px solid var(--shadow);background:var(--face);font-size:11px;";
  glyphLabel.textContent = "Character: 32 (0x20) ' '";

  const glyphWrap = document.createElement("div");
  glyphWrap.style.cssText = "flex:1;overflow:auto;background:#808080;padding:8px;display:flex;align-items:flex-start;justify-content:flex-start;";
  const glyphCanvas = document.createElement("canvas");
  glyphCanvas.style.cssText = "image-rendering:pixelated;border:1px solid var(--shadow);cursor:crosshair;background:#fff;";
  glyphCanvas.width = 8 * charZoom;
  glyphCanvas.height = fontData.height * charZoom;
  const glyphCtx = glyphCanvas.getContext("2d");
  glyphWrap.appendChild(glyphCanvas);

  glyphPanel.append(glyphLabel, glyphWrap);

  split.append(gridPanel, glyphPanel);

  // ── Status ──
  const status = document.createElement("div");
  status.className = "editor-status";
  status.textContent = "Font: " + fontData.height + "px height, " + (fontData.lastChar - fontData.firstChar + 1) + " characters";

  // ── Character grid ──
  function renderGrid() {
    gridEl.innerHTML = "";
    for (let c = range.start; c <= range.end; c++) {
      const cell = document.createElement("div");
      cell.style.cssText = "width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border:1px solid #ccc;cursor:pointer;font-size:9px;font-family:monospace;position:relative;";
      if (c === currentCharCode) {
        cell.style.background = "var(--active-caption)";
        cell.style.color = "var(--caption-text)";
      }

      // Mini preview of the glyph
      const miniCanvas = document.createElement("canvas");
      const gw = fontData.chars[c] ? fontData.chars[c].width : 8;
      const gh = fontData.height;
      const miniScale = Math.max(1, Math.floor(20 / Math.max(gw, gh)));
      miniCanvas.width = gw * miniScale;
      miniCanvas.height = gh * miniScale;
      miniCanvas.style.cssText = "image-rendering:pixelated;display:block;";
      const mctx = miniCanvas.getContext("2d");
      if (fontData.chars[c]) {
        for (let y = 0; y < gh; y++) {
          for (let x = 0; x < gw; x++) {
            if (fontData.chars[c].pixels[y] && fontData.chars[c].pixels[y][x]) {
              mctx.fillStyle = fontData.chars[c].pixels[y][x];
              mctx.fillRect(x * miniScale, y * miniScale, miniScale, miniScale);
            }
          }
        }
      }

      const charLabel = document.createElement("div");
      charLabel.style.cssText = "position:absolute;bottom:0;right:1px;font-size:7px;color:#888;";
      charLabel.textContent = c < 32 ? "" : String.fromCharCode(c);

      cell.append(miniCanvas, charLabel);
      cell.addEventListener("click", () => {
        currentCharCode = c;
        repaintGlyph();
        renderGrid();
        updateGlyphLabel();
      });
      gridEl.appendChild(cell);
    }
  }

  function updateGlyphLabel() {
    const c = currentCharCode;
    const display = c >= 32 && c < 127 ? String.fromCharCode(c) : "\\x" + c.toString(16).toUpperCase();
    glyphLabel.textContent = "Character: " + c + " (0x" + c.toString(16).toUpperCase() + ") '" + display + "'";
  }

  // ── Glyph canvas editing ──
  function resizeGlyphCanvas() {
    const ch = fontData.chars[currentCharCode];
    const gw = ch ? ch.width : 8;
    glyphCanvas.width = gw * charZoom;
    glyphCanvas.height = fontData.height * charZoom;
    zoomLabel.textContent = charZoom + "x";
    repaintGlyph();
  }

  function repaintGlyph() {
    const ch = fontData.chars[currentCharCode];
    if (!ch) return;
    const gw = ch.width;
    const gh = ch.height;
    glyphCtx.clearRect(0, 0, glyphCanvas.width, glyphCanvas.height);

    // Checkerboard
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const isLight = (x + y) % 2 === 0;
        glyphCtx.fillStyle = ch.pixels[y][x] || (isLight ? "#ffffff" : "#e0e0e0");
        glyphCtx.fillRect(x * charZoom, y * charZoom, charZoom, charZoom);
      }
    }
    // Grid
    glyphCtx.strokeStyle = "rgba(0,0,0,0.15)";
    glyphCtx.lineWidth = 0.5;
    for (let x = 0; x <= gw; x++) {
      glyphCtx.beginPath();
      glyphCtx.moveTo(x * charZoom + 0.5, 0);
      glyphCtx.lineTo(x * charZoom + 0.5, gh * charZoom);
      glyphCtx.stroke();
    }
    for (let y = 0; y <= gh; y++) {
      glyphCtx.beginPath();
      glyphCtx.moveTo(0, y * charZoom + 0.5);
      glyphCtx.lineTo(gw * charZoom, y * charZoom + 0.5);
      glyphCtx.stroke();
    }
  }

  function getGlyphPixel(ev) {
    const rect = glyphCanvas.getBoundingClientRect();
    const px = Math.floor((ev.clientX - rect.left) / charZoom);
    const py = Math.floor((ev.clientY - rect.top) / charZoom);
    const ch = fontData.chars[currentCharCode];
    if (!ch || px < 0 || px >= ch.width || py < 0 || py >= ch.height) return null;
    return { x: px, y: py };
  }

  function floodFillGlyph(sx, sy, fillColor) {
    const ch = fontData.chars[currentCharCode];
    if (!ch) return;
    const target = ch.pixels[sy][sx];
    if (target === fillColor) return;
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= ch.width || y < 0 || y >= ch.height) continue;
      if (ch.pixels[y][x] !== target) continue;
      ch.pixels[y][x] = fillColor;
      stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
    }
  }

  glyphCanvas.addEventListener("mousedown", (ev) => {
    const p = getGlyphPixel(ev); if (!p) return;
    pushUndo();
    const ch = fontData.chars[currentCharCode];
    if (tool === "pencil") { ch.pixels[p.y][p.x] = fgColor; repaintGlyph(); }
    else if (tool === "eraser") { ch.pixels[p.y][p.x] = null; repaintGlyph(); }
    else if (tool === "fill") { floodFillGlyph(p.x, p.y, fgColor); repaintGlyph(); }
    else if (tool === "picker") {
      const c = ch.pixels[p.y][p.x] || "#ffffff";
      fgColor = c; fgSwatch.value = c;
      undoStack.pop(); // Don't record picker action
    }
    renderGrid();
  });

  glyphCanvas.addEventListener("mousemove", (ev) => {
    if (ev.buttons !== 1) return;
    const p = getGlyphPixel(ev); if (!p) return;
    const ch = fontData.chars[currentCharCode];
    if (tool === "pencil") { ch.pixels[p.y][p.x] = fgColor; repaintGlyph(); }
    else if (tool === "eraser") { ch.pixels[p.y][p.x] = null; repaintGlyph(); }
    renderGrid();
  });

  // ── Keyboard shortcuts ──
  function onKeyDown(ev) {
    if (ev.target.tagName === "INPUT") return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "z" && !ev.shiftKey) { ev.preventDefault(); undo(); }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "y" || (ev.key === "z" && ev.shiftKey))) { ev.preventDefault(); redo(); }
    // Arrow keys to navigate characters
    if (ev.key === "ArrowRight" && currentCharCode < range.end) { currentCharCode++; repaintGlyph(); renderGrid(); updateGlyphLabel(); }
    if (ev.key === "ArrowLeft" && currentCharCode > range.start) { currentCharCode--; repaintGlyph(); renderGrid(); updateGlyphLabel(); }
  }
  document.addEventListener("keydown", onKeyDown);
  win.onDestroy = () => {
    document.removeEventListener("keydown", onKeyDown);
    // Save back to resource as raw text representation
    resource.rawText = generateFontText(fontData);
    project._emit();
  };

  function generateFontText(fd) {
    let out = resource.id + " FONT " + fd.height + "\n";
    out += "  FIRST " + fd.firstChar + "\n";
    out += "  LAST " + fd.lastChar + "\n";
    return out;
  }

  root.append(toolbar, split, status);
  win.content.innerHTML = "";
  win.content.appendChild(root);

  updateGlyphLabel();
  resizeGlyphCanvas();
  renderGrid();
}