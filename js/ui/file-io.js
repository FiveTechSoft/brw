// js/ui/file-io.js — open, drop, download helpers

const BINARY_EXTS = new Set(["res", "bmp", "ico", "cur", "exe", "dll"]);

/**
 * @param {File} f
 * @returns {Promise<{name:string, kind:string, text?:string, buffer?:ArrayBuffer}>}
 */
async function mapFile(f) {
  const name = f.name;
  const ext = (name.split(".").pop() || "").toLowerCase();
  const kind = ext || "other";
  if (BINARY_EXTS.has(ext)) {
    return { name, kind, buffer: await f.arrayBuffer() };
  }
  return { name, kind, text: await f.text() };
}

/**
 * @param {string} [accept]
 * @param {boolean} [multiple]
 * @returns {Promise<{name:string, kind:string, text?:string, buffer?:ArrayBuffer}[]>}
 */
export function openFilesDialog(accept = ".rc,.h,.rh,.res,.dlg", multiple = true) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    if (accept) input.accept = accept;
    input.onchange = async () => {
      const files = [...(input.files || [])];
      const out = [];
      for (const f of files) out.push(await mapFile(f));
      resolve(out);
    };
    // cancel path
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

/**
 * @param {FileList|File[]} fileList
 * @returns {Promise<{name:string, kind:string, text?:string, buffer?:ArrayBuffer}[]>}
 */
export async function readDroppedFiles(fileList) {
  const files = [...(fileList || [])];
  const out = [];
  for (const f of files) out.push(await mapFile(f));
  return out;
}

/**
 * @param {string} filename
 * @param {Blob} blob
 */
export function downloadBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/**
 * @param {HTMLElement} el
 * @param {(files: {name:string, kind:string, text?:string, buffer?:ArrayBuffer}[]) => void} onFiles
 */
export function wireDrop(el, onFiles) {
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.classList.add("drop-target");
  });
  el.addEventListener("dragleave", (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove("drop-target");
  });
  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    el.classList.remove("drop-target");
    const mapped = await readDroppedFiles(e.dataTransfer?.files || []);
    if (mapped.length) onFiles(mapped);
  });
}
