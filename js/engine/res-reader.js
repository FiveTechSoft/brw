/**
 * Win32 32-bit .res reader.
 */
import { RT, DEFAULT_LANG } from "../core/constants.js";
import { unpackDialog } from "./dlg-template.js";

/**
 * @param {ArrayBuffer} buffer
 * @returns {{ resources: object[], errors: string[] }}
 */
export function readRes(buffer) {
  /** @type {object[]} */
  const resources = [];
  /** @type {string[]} */
  const errors = [];
  const view = new DataView(buffer);
  let pos = 0;

  function align4() {
    const rem = pos % 4;
    if (rem) pos += 4 - rem;
  }

  /**
   * @returns {string|number}
   */
  function readNameInfo() {
    if (pos + 2 > buffer.byteLength) throw new Error("truncated nameinfo");
    const first = view.getUint16(pos, true);
    if (first === 0xffff) {
      pos += 2;
      if (pos + 2 > buffer.byteLength) throw new Error("truncated ordinal");
      const id = view.getUint16(pos, true);
      pos += 2;
      return id;
    }
    let s = "";
    while (pos + 1 < buffer.byteLength) {
      const c = view.getUint16(pos, true);
      pos += 2;
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  try {
    while (pos + 8 <= buffer.byteLength) {
      const start = pos;
      const dataSize = view.getUint32(pos, true);
      pos += 4;
      const headerSize = view.getUint32(pos, true);
      pos += 4;

      if (headerSize < 16) {
        if (dataSize === 0 && headerSize === 0) break;
        errors.push(`invalid headerSize ${headerSize} at 0x${start.toString(16)}`);
        break;
      }
      if (start + headerSize + dataSize > buffer.byteLength) {
        errors.push(`truncated resource at 0x${start.toString(16)}`);
        break;
      }

      let typeId;
      let nameId;
      try {
        typeId = readNameInfo();
        nameId = readNameInfo();
      } catch (e) {
        errors.push(String(e.message || e));
        break;
      }

      align4();

      // Fixed trailer of header
      let language = DEFAULT_LANG;
      if (pos + 16 <= start + headerSize) {
        pos += 4; // DataVersion
        pos += 2; // MemoryFlags
        language = view.getUint16(pos, true);
        pos += 2;
        pos += 4; // Version
        pos += 4; // Characteristics
      }
      pos = start + headerSize;

      // Empty null resource marker
      if (dataSize === 0 && (typeId === 0 || typeId === "0") && (nameId === 0 || nameId === "0")) {
        align4();
        continue;
      }

      const data = buffer.slice(start + headerSize, start + headerSize + dataSize);
      pos = start + headerSize + dataSize;
      align4();

      const typeNum = typeof typeId === "number" ? typeId : null;
      const isDialog =
        typeNum === RT.DIALOG ||
        typeId === 5 ||
        (typeof typeId === "string" && typeId.toUpperCase() === "DIALOG");

      if (isDialog) {
        try {
          const dlg = unpackDialog(data, nameId);
          dlg.sourceFile = null;
          resources.push(dlg);
        } catch (e) {
          errors.push(`dialog ${nameId}: ${e.message || e}`);
          resources.push({
            type: "BINARY",
            typeId,
            nameId,
            language,
            data,
          });
        }
      } else {
        resources.push({
          type: "BINARY",
          typeId,
          nameId,
          language,
          data,
        });
      }
    }
  } catch (e) {
    errors.push(String(e.message || e));
  }

  return { resources, errors };
}
