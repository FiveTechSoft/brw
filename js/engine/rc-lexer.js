/**
 * RC resource-script lexer.
 * @typedef {{ type: string, value: string, start: number, end: number, line: number }} Token
 */

/**
 * Lex RC source into tokens.
 * Types: IDENT, NUMBER, STRING, PUNC, BEGIN, END, DIRECTIVE
 * @param {string} text
 * @returns {Token[]}
 */
export function lex(text) {
  const src = String(text ?? "");
  /** @type {Token[]} */
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = src.length;

  function push(type, value, start, end, tokLine = line) {
    tokens.push({ type, value, start, end, line: tokLine });
  }

  while (i < n) {
    const c = src[i];

    // whitespace
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      line++;
      i++;
      continue;
    }

    // // line comment
    if (c === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    // /* block comment */
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      if (i < n) i += 2; // consume */
      continue;
    }

    // preprocessor directive: rest of physical line after #
    if (c === "#") {
      const start = i;
      const tokLine = line;
      i++; // skip #
      while (i < n && src[i] !== "\n") i++;
      const raw = src.slice(start + 1, i).replace(/\r$/, "");
      push("DIRECTIVE", raw.trim(), start, i, tokLine);
      continue;
    }

    // string
    if (c === '"') {
      const start = i;
      const tokLine = line;
      i++; // opening quote
      let value = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < n) {
          const esc = src[i + 1];
          if (esc === "n") value += "\n";
          else if (esc === "t") value += "\t";
          else if (esc === "r") value += "\r";
          else if (esc === '"' || esc === "\\") value += esc;
          else value += esc;
          i += 2;
        } else {
          if (src[i] === "\n") line++;
          value += src[i];
          i++;
        }
      }
      if (i < n && src[i] === '"') i++;
      push("STRING", value, start, i, tokLine);
      continue;
    }

    // number (keep raw lexeme)
    if (/[0-9]/.test(c)) {
      const start = i;
      if (c === "0" && i + 1 < n && (src[i + 1] === "x" || src[i + 1] === "X")) {
        i += 2;
        while (i < n && /[0-9a-fA-F]/.test(src[i])) i++;
      } else {
        while (i < n && /[0-9]/.test(src[i])) i++;
      }
      // optional trailing L/U suffixes common in headers
      while (i < n && /[lLuU]/.test(src[i])) i++;
      push("NUMBER", src.slice(start, i), start, i);
      continue;
    }

    // identifier / keyword
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      i++;
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) i++;
      const raw = src.slice(start, i);
      const upper = raw.toUpperCase();
      if (upper === "BEGIN") {
        push("BEGIN", "BEGIN", start, i);
      } else if (upper === "END") {
        push("END", "END", start, i);
      } else {
        // Keywords and names as uppercased IDENT for case-insensitive RC keywords
        push("IDENT", upper === raw ? upper : raw, start, i);
      }
      // Note: keep mixed-case identifiers as written; pure-alpha keywords often uppercase.
      // For DIALOG etc. RC is case-insensitive — normalize known keywords to UPPER.
      const last = tokens[tokens.length - 1];
      if (last.type === "IDENT") {
        const kw = last.value.toUpperCase();
        const KEYWORDS = new Set([
          "DIALOG", "DIALOGEX", "STYLE", "EXSTYLE", "CAPTION", "FONT", "CLASS",
          "MENU", "CONTROL", "LANGUAGE", "PUSHBUTTON", "DEFPUSHBUTTON", "EDITTEXT",
          "LTEXT", "RTEXT", "CTEXT", "LISTBOX", "COMBOBOX", "GROUPBOX",
          "CHECKBOX", "AUTOCHECKBOX", "RADIOBUTTON", "AUTORADIOBUTTON",
          "ICON", "BITMAP", "CURSOR", "ACCELERATORS", "STRINGTABLE", "RCDATA",
          "VERSIONINFO", "DLGINIT", "TOOLBAR", "MOVEABLE", "PURE", "IMPURE",
          "PRELOAD", "LOADONCALL", "DISCARDABLE", "FIXED", "NOT",
        ]);
        if (KEYWORDS.has(kw)) last.value = kw;
      }
      continue;
    }

    // braces as BEGIN/END
    if (c === "{") {
      push("BEGIN", "{", i, i + 1);
      i++;
      continue;
    }
    if (c === "}") {
      push("END", "}", i, i + 1);
      i++;
      continue;
    }

    // single-char punctuation / operators
    push("PUNC", c, i, i + 1);
    i++;
  }

  return tokens;
}
