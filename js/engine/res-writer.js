/**
 * Win32 32-bit .res writer.
 */
import { RT, DEFAULT_LANG } from "../core/constants.js";
import { packDialog } from "./dlg-template.js";

/**
 * @param {import('../core/project-model.js').ProjectModel | object[]} projectOrList
 * @param {{ resolveId?: (id: string|number) => number|null, language?: number }} [opts]
 * @returns {ArrayBuffer}
 */
export function writeRes(projectOrList, opts = {}) {
  const language = opts.language ?? DEFAULT_LANG;
  /** @type {object[]} */
  let list;
  /** @type {(id: string|number) => number|null} */
  let resolveId = opts.resolveId || null;

  if (Array.isArray(projectOrList)) {
    list = projectOrList;
  } else {
    list = projectOrList.resources || [];
    if (!resolveId && projectOrList.identifiers) {
      resolveId = (id) => projectOrList.identifiers.resolve(id);
    }
  }

  const chunks = [];

  // Optional empty marker resource (common in MSVC .res)
  chunks.push(encodeResource(0, 0, new ArrayBuffer(0), language, 0x0030));

  for (const r of list) {
    if (r.type === "DIALOG" || r.type === "DIALOGEX") {
      const nameId = resolveResourceName(r.id, resolveId);
      const data = packDialog(r, resolveId);
      chunks.push(encodeResource(RT.DIALOG, nameId, data, language, 0x1030));
    } else if (r.type === "BINARY") {
      chunks.push(
        encodeResource(
          r.typeId,
          r.nameId,
          r.data instanceof ArrayBuffer ? r.data : toArrayBuffer(r.data),
          r.language ?? language,
          0x0030
        )
      );
    }
    // Opaque RC resources are text-only; not emitted into .res in Phase 1
  }

  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c), off);
    off += c.byteLength;
  }
  return out.buffer;
}

/**
 * @param {string|number} id
 * @param {(id: string|number) => number|null} resolveId
 */
function resolveResourceName(id, resolveId) {
  if (typeof id === "number") return id;
  if (/^\d+$/.test(String(id))) return parseInt(String(id), 10);
  if (resolveId) {
    const v = resolveId(id);
    if (v != null) return v;
  }
  // keep as string name in RES
  return String(id);
}

/**
 * @param {string|number} typeId
 * @param {string|number} nameId
 * @param {ArrayBuffer} data
 * @param {number} language
 * @param {number} memoryFlags
 */
function encodeResource(typeId, nameId, data, language, memoryFlags) {
  // Build header body after DataSize/HeaderSize placeholders
  const body = new BinWriter();
  writeNameInfo(body, typeId);
  writeNameInfo(body, nameId);
  body.align(4);
  body.writeU32(0); // DataVersion
  body.writeU16(memoryFlags);
  body.writeU16(language);
  body.writeU32(0); // Version
  body.writeU32(0); // Characteristics

  const headerSize = 8 + body.pos; // include DataSize + HeaderSize fields
  const dataSize = data.byteLength;

  const w = new BinWriter(headerSize + dataSize + 8);
  w.writeU32(dataSize);
  w.writeU32(headerSize);
  // copy body
  w.ensure(body.pos);
  new Uint8Array(w.buf, w.pos, body.pos).set(new Uint8Array(body.buf, 0, body.pos));
  w.pos += body.pos;

  // ensure header pad (body already aligned + fixed fields sized so headerSize matches)
  // data
  w.ensure(dataSize);
  new Uint8Array(w.buf, w.pos, dataSize).set(new Uint8Array(data));
  w.pos += dataSize;
  w.align(4);
  return w.toArrayBuffer();
}

function writeNameInfo(w, id) {
  if (typeof id === "number") {
    w.writeU16(0xffff);
    w.writeU16(id & 0xffff);
  } else {
    w.writeSz(String(id).toUpperCase());
  }
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return new ArrayBuffer(0);
}

class BinWriter {
  constructor(cap = 256) {
    this.buf = new ArrayBuffer(Math.max(cap, 64));
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

  toArrayBuffer() {
    return this.buf.slice(0, this.pos);
  }
}
