/**
 * Classic Win32 DLGTEMPLATE pack/unpack (Phase 1 writer: classic only).
 */
import { DS, WS, DEFAULT_DIALOG_STYLE } from "../core/constants.js";

const ATOM_TO_CLASS = {
  0x0080: "BUTTON",
  0x0081: "EDIT",
  0x0082: "STATIC",
  0x0083: "LISTBOX",
  0x0084: "SCROLLBAR",
  0x0085: "COMBOBOX",
};

const CLASS_TO_ATOM = {
  BUTTON: 0x0080,
  EDIT: 0x0081,
  STATIC: 0x0082,
  LISTBOX: 0x0083,
  SCROLLBAR: 0x0084,
  COMBOBOX: 0x0085,
};

/**
 * @param {string|number|null|undefined} id
 * @param {(id: string|number) => number|null} resolveId
 */
function resolveNumericId(id, resolveId) {
  if (id == null || id === -1 || id === "-1" || id === "") return 0xffff;
  if (typeof id === "number") return id & 0xffff;
  if (/^-?\d+$/.test(String(id))) return parseInt(String(id), 10) & 0xffff;
  const v = resolveId ? resolveId(id) : null;
  if (v == null) {
    console.warn("dlg-template: unresolved id", id);
    return 0;
  }
  return v & 0xffff;
}

/** Growable little-endian buffer writer. */
class BinWriter {
  constructor(cap = 4096) {
    this.buf = new ArrayBuffer(cap);
    this.view = new DataView(this.buf);
    this.u8 = new Uint8Array(this.buf);
    this.pos = 0;
  }

  ensure(n) {
    if (this.pos + n <= this.buf.byteLength) return;
    let size = this.buf.byteLength;
    while (this.pos + n > size) size *= 2;
    const next = new ArrayBuffer(size);
    new Uint8Array(next).set(this.u8);
    this.buf = next;
    this.view = new DataView(this.buf);
    this.u8 = new Uint8Array(this.buf);
  }

  align(n = 4) {
    const rem = this.pos % n;
    if (rem) {
      const pad = n - rem;
      this.ensure(pad);
      this.u8.fill(0, this.pos, this.pos + pad);
      this.pos += pad;
    }
  }

  writeU16(v) {
    this.ensure(2);
    this.view.setUint16(this.pos, v & 0xffff, true);
    this.pos += 2;
  }

  writeI16(v) {
    this.ensure(2);
    this.view.setInt16(this.pos, v | 0, true);
    this.pos += 2;
  }

  writeU32(v) {
    this.ensure(4);
    this.view.setUint32(this.pos, v >>> 0, true);
    this.pos += 4;
  }

  writeSz(str) {
    const s = str == null ? "" : String(str);
    this.ensure((s.length + 1) * 2);
    for (let i = 0; i < s.length; i++) {
      this.view.setUint16(this.pos, s.charCodeAt(i), true);
      this.pos += 2;
    }
    this.view.setUint16(this.pos, 0, true);
    this.pos += 2;
  }

  writeSzOrOrd(value) {
    if (value == null || value === "" || value === 0) {
      this.writeU16(0);
      return;
    }
    if (typeof value === "number") {
      this.writeU16(0xffff);
      this.writeU16(value & 0xffff);
      return;
    }
    const s = String(value);
    if (/^\d+$/.test(s)) {
      this.writeU16(0xffff);
      this.writeU16(parseInt(s, 10) & 0xffff);
      return;
    }
    this.writeSz(s);
  }

  toArrayBuffer() {
    return this.buf.slice(0, this.pos);
  }
}

class BinReader {
  /** @param {ArrayBuffer} buffer @param {number} [offset] */
  constructor(buffer, offset = 0) {
    this.buf = buffer;
    this.view = new DataView(buffer);
    this.pos = offset;
  }

  align(n = 4) {
    const rem = this.pos % n;
    if (rem) this.pos += n - rem;
  }

  remaining() {
    return this.buf.byteLength - this.pos;
  }

  readU16() {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  readI16() {
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }

  readU32() {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readSz() {
    let s = "";
    while (this.pos + 1 < this.buf.byteLength) {
      const c = this.view.getUint16(this.pos, true);
      this.pos += 2;
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  readSzOrOrd() {
    if (this.remaining() < 2) return null;
    const first = this.view.getUint16(this.pos, true);
    if (first === 0) {
      this.pos += 2;
      return null;
    }
    if (first === 0xffff) {
      this.pos += 2;
      return this.readU16();
    }
    return this.readSz();
  }
}

/**
 * Pack DialogResource into classic DLGTEMPLATE bytes.
 * @param {import('../core/project-model.js').DialogResource} dialog
 * @param {(id: string|number) => number|null} [resolveId]
 * @returns {ArrayBuffer}
 */
export function packDialog(dialog, resolveId = null) {
  const w = new BinWriter();
  let style = (dialog.style ?? DEFAULT_DIALOG_STYLE) >>> 0;
  if (dialog.font) style = (style | DS.SETFONT) >>> 0;

  const controls = dialog.controls || [];
  w.writeU32(style);
  w.writeU32((dialog.exStyle || 0) >>> 0);
  w.writeU16(controls.length);
  w.writeI16(dialog.x | 0);
  w.writeI16(dialog.y | 0);
  w.writeI16(dialog.cx | 0);
  w.writeI16(dialog.cy | 0);

  w.writeSzOrOrd(dialog.menu);
  if (dialog.className) w.writeSzOrOrd(dialog.className);
  else w.writeU16(0);
  w.writeSz(dialog.title || "");

  if (style & DS.SETFONT) {
    const font = dialog.font || { name: "MS Sans Serif", size: 8 };
    w.writeU16(font.size || 8);
    w.writeSz(font.name || "MS Sans Serif");
  }

  for (const c of controls) {
    w.align(4);
    w.writeU32((c.style || 0) >>> 0);
    w.writeU32((c.exStyle || 0) >>> 0);
    w.writeI16(c.x | 0);
    w.writeI16(c.y | 0);
    w.writeI16(c.cx | 0);
    w.writeI16(c.cy | 0);
    w.writeU16(resolveNumericId(c.id, resolveId));

    const cls = String(c.className || "BUTTON");
    const atom = CLASS_TO_ATOM[cls.toUpperCase()];
    if (atom != null) {
      w.writeU16(0xffff);
      w.writeU16(atom);
    } else {
      w.writeSz(cls);
    }

    w.writeSz(c.text != null ? String(c.text) : "");
    w.writeU16(0); // no creation data
  }

  return w.toArrayBuffer();
}

/**
 * Unpack DLGTEMPLATE or DLGTEMPLATEEX buffer into DialogResource-like object.
 * @param {ArrayBuffer|ArrayBufferView} buffer
 * @param {string|number} [nameHint]
 * @returns {import('../core/project-model.js').DialogResource}
 */
export function unpackDialog(buffer, nameHint = "IDD_DIALOG") {
  const ab =
    buffer instanceof ArrayBuffer
      ? buffer
      : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  if (ab.byteLength >= 4) {
    const dv = new DataView(ab);
    const w0 = dv.getUint16(0, true);
    const w1 = dv.getUint16(2, true);
    if (w0 === 1 && w1 === 0xffff) {
      return unpackDialogEx(ab, nameHint);
    }
  }
  return unpackClassicDialog(ab, nameHint);
}

/**
 * @param {ArrayBuffer} ab
 * @param {string|number} nameHint
 */
function unpackClassicDialog(ab, nameHint) {
  const r = new BinReader(ab);
  const style = r.readU32();
  const exStyle = r.readU32();
  const cdit = r.readU16();
  const x = r.readI16();
  const y = r.readI16();
  const cx = r.readI16();
  const cy = r.readI16();

  const menu = r.readSzOrOrd();
  const dlgClassRaw = r.readSzOrOrd();
  const title = r.readSz() || "";

  let font = null;
  if (style & DS.SETFONT) {
    const size = r.readU16();
    const name = r.readSz();
    font = { name, size };
  }

  const className =
    dlgClassRaw == null
      ? null
      : typeof dlgClassRaw === "number"
        ? null
        : String(dlgClassRaw);

  /** @type {import('../core/project-model.js').Control[]} */
  const controls = [];
  for (let i = 0; i < cdit; i++) {
    r.align(4);
    if (r.remaining() < 18) break;
    const cStyle = r.readU32();
    const cEx = r.readU32();
    const cxPos = r.readI16();
    const cyPos = r.readI16();
    const cCx = r.readI16();
    const cCy = r.readI16();
    let id = r.readU16();
    if (id === 0xffff) id = -1;

    const clsRaw = r.readSzOrOrd();
    let classNameCtl = "BUTTON";
    if (typeof clsRaw === "number") {
      classNameCtl = ATOM_TO_CLASS[clsRaw] || `ATOM_${clsRaw}`;
    } else if (typeof clsRaw === "string") {
      classNameCtl = clsRaw;
    }

    const text = r.readSz() || "";
    const cb = r.readU16();
    if (cb > 0) {
      r.pos += cb;
      // creation data WORD-aligned; next item DWORD-aligns
      if (cb & 1) r.pos += 1;
    }

    controls.push({
      id,
      className: classNameCtl,
      text,
      x: cxPos,
      y: cyPos,
      cx: cCx,
      cy: cCy,
      style: cStyle | 0,
      exStyle: cEx | 0,
      tabIndex: i,
      groupStart: !!(cStyle & WS.GROUP),
    });
  }

  return {
    type: "DIALOG",
    id: nameHint,
    x,
    y,
    cx,
    cy,
    style: style | 0,
    exStyle: exStyle | 0,
    title,
    font,
    className,
    menu: menu == null ? null : menu,
    memoryFlags: ["MOVEABLE", "DISCARDABLE"],
    sourceFile: null,
    controls,
  };
}

/**
 * @param {ArrayBuffer} ab
 * @param {string|number} nameHint
 */
function unpackDialogEx(ab, nameHint) {
  const r = new BinReader(ab);
  r.readU16(); // dlgVer
  r.readU16(); // signature
  r.readU32(); // helpID
  const exStyle = r.readU32();
  const style = r.readU32();
  const cdit = r.readU16();
  const x = r.readI16();
  const y = r.readI16();
  const cx = r.readI16();
  const cy = r.readI16();
  const menu = r.readSzOrOrd();
  const dlgClassRaw = r.readSzOrOrd();
  const title = r.readSz() || "";

  let font = null;
  if (style & DS.SETFONT) {
    const size = r.readU16();
    const weight = r.readU16();
    const italic = r.view.getUint8(r.pos);
    const charset = r.view.getUint8(r.pos + 1);
    r.pos += 2;
    const name = r.readSz();
    font = { name, size, weight, italic: !!italic };
    void charset;
  }

  const className =
    dlgClassRaw == null
      ? null
      : typeof dlgClassRaw === "number"
        ? null
        : String(dlgClassRaw);

  /** @type {import('../core/project-model.js').Control[]} */
  const controls = [];
  for (let i = 0; i < cdit; i++) {
    r.align(4);
    if (r.remaining() < 24) break;
    r.readU32(); // helpID
    const cEx = r.readU32();
    const cStyle = r.readU32();
    const cxPos = r.readI16();
    const cyPos = r.readI16();
    const cCx = r.readI16();
    const cCy = r.readI16();
    let id = r.readU32();
    if (id === 0xffffffff) id = -1;

    const clsRaw = r.readSzOrOrd();
    let classNameCtl = "BUTTON";
    if (typeof clsRaw === "number") {
      classNameCtl = ATOM_TO_CLASS[clsRaw] || `ATOM_${clsRaw}`;
    } else if (typeof clsRaw === "string") {
      classNameCtl = clsRaw;
    }

    const t = r.readSzOrOrd();
    const text = t == null ? "" : String(t);
    const cb = r.readU16();
    if (cb > 0) {
      r.pos += cb;
      if (cb & 1) r.pos += 1;
    }

    controls.push({
      id,
      className: classNameCtl,
      text,
      x: cxPos,
      y: cyPos,
      cx: cCx,
      cy: cCy,
      style: cStyle | 0,
      exStyle: cEx | 0,
      tabIndex: i,
      groupStart: !!(cStyle & WS.GROUP),
    });
  }

  return {
    type: "DIALOGEX",
    id: nameHint,
    x,
    y,
    cx,
    cy,
    style: style | 0,
    exStyle: exStyle | 0,
    title,
    font,
    className,
    menu: menu == null ? null : menu,
    memoryFlags: ["MOVEABLE", "DISCARDABLE"],
    sourceFile: null,
    controls,
  };
}
