/**
 * RC / header compiler — emit resource scripts from ProjectModel.
 */
import { BS, SS, STYLE_NAMES } from "../core/constants.js";

/**
 * @param {import('../core/identifiers.js').IdentifierStore} identifierStore
 * @returns {string}
 */
export function compileHeader(identifierStore) {
  return identifierStore.toHeaderText();
}

/**
 * @param {import('../core/project-model.js').ProjectModel} project
 * @returns {string}
 */
export function compileRc(project) {
  const lines = ['#include "resource.h"', ""];
  for (const r of project.resources) {
    if (r.type === "DIALOG" || r.type === "DIALOGEX") {
      lines.push(emitDialog(r), "");
    } else if (r.rawText) {
      lines.push(String(r.rawText).trim(), "");
    }
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}

/**
 * Format a style value as symbolic OR of known flags, or hex.
 * @param {number} style
 * @param {string[]} [preferredPrefixes]
 */
export function formatStyle(style, preferredPrefixes = null) {
  const styleU = style >>> 0;
  if (styleU === 0) return "0";

  // Greedy decompose using known flags (most bits first)
  const entries = Object.entries(STYLE_NAMES)
    .map(([n, v]) => [n, v >>> 0])
    .filter(([, v]) => v !== 0)
    .filter(([n]) => {
      if (!preferredPrefixes) return true;
      return preferredPrefixes.some((p) => n.startsWith(p));
    })
    .sort((a, b) => {
      const ba = bitCount(a[1]);
      const bb = bitCount(b[1]);
      if (bb !== ba) return bb - ba;
      return b[1] - a[1];
    });

  const parts = [];
  let remain = styleU;
  for (const [name, u] of entries) {
    // unsigned compare — JS & is int32, so normalize with >>> 0
    if (u !== 0 && ((remain & u) >>> 0) === u) {
      parts.push(name);
      remain = (remain & ~u) >>> 0;
    }
  }

  if (remain === 0 && parts.length > 0) {
    return parts.join(" | ");
  }

  if (parts.length === 0) {
    return "0x" + styleU.toString(16).toUpperCase();
  }
  if (remain !== 0) {
    parts.push("0x" + remain.toString(16).toUpperCase());
  }
  return parts.join(" | ");
}

function bitCount(n) {
  n = n >>> 0;
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

/**
 * @param {string|number} id
 */
function emitId(id) {
  return String(id);
}

/**
 * @param {string} s
 */
function emitString(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * @param {import('../core/project-model.js').DialogResource} dlg
 */
function emitDialog(dlg) {
  const kind = dlg.type === "DIALOGEX" ? "DIALOGEX" : "DIALOG";
  const head = `${emitId(dlg.id)} ${kind} ${dlg.x}, ${dlg.y}, ${dlg.cx}, ${dlg.cy}`;
  const lines = [head];

  if (dlg.memoryFlags && dlg.memoryFlags.length) {
    // memory flags go before type in classic RC; we emit as comment-free post-id form skipped
  }

  if (dlg.style != null) {
    lines.push(`STYLE ${formatStyle(dlg.style)}`);
  }
  if (dlg.exStyle) {
    lines.push(`EXSTYLE ${formatStyle(dlg.exStyle)}`);
  }
  if (dlg.title != null && dlg.title !== "") {
    lines.push(`CAPTION ${emitString(dlg.title)}`);
  }
  if (dlg.font) {
    let f = `FONT ${dlg.font.size}, ${emitString(dlg.font.name)}`;
    if (dlg.font.weight != null) f += `, ${dlg.font.weight}`;
    if (dlg.font.italic != null) f += `, ${dlg.font.italic ? 1 : 0}`;
    lines.push(f);
  }
  if (dlg.className) {
    lines.push(`CLASS ${emitString(dlg.className)}`);
  }
  if (dlg.menu != null && dlg.menu !== "") {
    if (typeof dlg.menu === "string" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(dlg.menu) && !/^\d+$/.test(dlg.menu)) {
      lines.push(`MENU ${emitString(dlg.menu)}`);
    } else {
      lines.push(`MENU ${emitId(dlg.menu)}`);
    }
  }

  lines.push("BEGIN");
  for (const c of dlg.controls || []) {
    lines.push("    " + emitControl(c));
  }
  lines.push("END");
  return lines.join("\n");
}

/**
 * Prefer shortcut keywords when class/style match defaults; else CONTROL.
 * @param {import('../core/project-model.js').Control} c
 */
function emitControl(c) {
  const cls = String(c.className || "").toUpperCase();
  const style = c.style | 0;
  const id = emitId(c.id);
  const geom = `${c.x}, ${c.y}, ${c.cx}, ${c.cy}`;
  const text = c.text != null ? c.text : "";

  const lowByte = style & 0xff;
  // strip common window bits for button type compare
  const has = (bit) => (style & bit) === bit;

  if (cls === "BUTTON") {
    if (lowByte === BS.DEFPUSHBUTTON) {
      return `DEFPUSHBUTTON ${emitString(text)}, ${id}, ${geom}`;
    }
    if (lowByte === BS.PUSHBUTTON) {
      return `PUSHBUTTON ${emitString(text)}, ${id}, ${geom}`;
    }
    if (lowByte === BS.GROUPBOX) {
      return `GROUPBOX ${emitString(text)}, ${id}, ${geom}`;
    }
    if (lowByte === BS.AUTOCHECKBOX) {
      return `AUTOCHECKBOX ${emitString(text)}, ${id}, ${geom}`;
    }
    if (lowByte === BS.CHECKBOX) {
      return `CHECKBOX ${emitString(text)}, ${id}, ${geom}`;
    }
    if (lowByte === BS.AUTORADIOBUTTON) {
      return `AUTORADIOBUTTON ${emitString(text)}, ${id}, ${geom}`;
    }
    if (lowByte === BS.RADIOBUTTON) {
      return `RADIOBUTTON ${emitString(text)}, ${id}, ${geom}`;
    }
  }

  if (cls === "STATIC") {
    if ((style & 0x1f) === SS.LEFT && !has(SS.ICON)) {
      return `LTEXT ${emitString(text)}, ${id}, ${geom}`;
    }
    if ((style & 0x1f) === SS.CENTER) {
      return `CTEXT ${emitString(text)}, ${id}, ${geom}`;
    }
    if ((style & 0x1f) === SS.RIGHT) {
      return `RTEXT ${emitString(text)}, ${id}, ${geom}`;
    }
    if ((style & 0x1f) === SS.ICON) {
      return `ICON ${emitString(text)}, ${id}, ${c.x}, ${c.y}`;
    }
  }

  if (cls === "EDIT") {
    return `EDITTEXT ${id}, ${geom}`;
  }
  if (cls === "LISTBOX") {
    return `LISTBOX ${id}, ${geom}`;
  }
  if (cls === "COMBOBOX") {
    return `COMBOBOX ${id}, ${geom}`;
  }

  // Full CONTROL form
  let line = `CONTROL ${emitString(text)}, ${id}, ${emitString(c.className)}, ${formatStyle(style)}, ${geom}`;
  if (c.exStyle) line += `, ${formatStyle(c.exStyle)}`;
  return line;
}


