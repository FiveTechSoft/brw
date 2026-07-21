/**
 * RC constant-expression evaluator.
 * Supports | + - * / ( ) numbers and symbol identifiers.
 */

/**
 * Parse a numeric lexeme (hex / octal / decimal).
 * @param {string} lexeme
 * @returns {number}
 */
export function parseNumberLexeme(lexeme) {
  if (!lexeme) throw new Error("empty number");
  if (/^0[xX][0-9a-fA-F]+$/.test(lexeme)) return parseInt(lexeme, 16) | 0;
  // Leading-zero octal only when length > 1 and all digits are octal
  if (lexeme.length > 1 && lexeme[0] === "0" && /^[0-7]+$/.test(lexeme)) {
    return parseInt(lexeme, 8) | 0;
  }
  if (/^-?\d+$/.test(lexeme)) return parseInt(lexeme, 10) | 0;
  throw new Error(`invalid number: ${lexeme}`);
}

/**
 * @param {string} source
 * @param {Record<string, number>} [symbols]
 * @returns {number}
 */
export function evalExpr(source, symbols = {}) {
  const s = String(source ?? "").trim();
  if (!s) throw new Error("empty expression");

  let i = 0;
  const len = s.length;

  function skipWs() {
    while (i < len && /\s/.test(s[i])) i++;
  }

  function peek() {
    skipWs();
    return i < len ? s[i] : "";
  }

  function expect(ch) {
    skipWs();
    if (s[i] !== ch) throw new Error(`expected '${ch}' at ${i}`);
    i++;
  }

  function parsePrimary() {
    skipWs();
    if (i >= len) throw new Error("unexpected end of expression");

    if (s[i] === "(") {
      i++;
      const v = parseOr();
      expect(")");
      return v;
    }

    // number: 0x..., 0..., decimal
    if (/[0-9]/.test(s[i])) {
      const start = i;
      if (s[i] === "0" && i + 1 < len && (s[i + 1] === "x" || s[i + 1] === "X")) {
        i += 2;
        while (i < len && /[0-9a-fA-F]/.test(s[i])) i++;
      } else {
        while (i < len && /[0-9]/.test(s[i])) i++;
      }
      return parseNumberLexeme(s.slice(start, i));
    }

    // identifier
    if (/[A-Za-z_]/.test(s[i])) {
      const start = i;
      i++;
      while (i < len && /[A-Za-z0-9_]/.test(s[i])) i++;
      const name = s.slice(start, i);
      if (!(name in symbols)) throw new Error(`unknown identifier: ${name}`);
      return symbols[name] | 0;
    }

    throw new Error(`unexpected character '${s[i]}' in expression`);
  }

  function parseUnary() {
    skipWs();
    if (peek() === "+") {
      i++;
      return parseUnary() | 0;
    }
    if (peek() === "-") {
      i++;
      return (-parseUnary()) | 0;
    }
    return parsePrimary();
  }

  function parseMul() {
    let v = parseUnary();
    for (;;) {
      skipWs();
      if (s[i] === "*") {
        i++;
        v = (v * parseUnary()) | 0;
      } else if (s[i] === "/") {
        i++;
        const d = parseUnary();
        if (d === 0) throw new Error("division by zero");
        v = (v / d) | 0;
      } else break;
    }
    return v;
  }

  function parseAdd() {
    let v = parseMul();
    for (;;) {
      skipWs();
      if (s[i] === "+") {
        i++;
        v = (v + parseMul()) | 0;
      } else if (s[i] === "-") {
        i++;
        v = (v - parseMul()) | 0;
      } else break;
    }
    return v;
  }

  // "and" layer reserved; Phase 1 has no &
  function parseAnd() {
    return parseAdd();
  }

  function parseOr() {
    let v = parseAnd();
    for (;;) {
      skipWs();
      if (s[i] === "|") {
        i++;
        skipWs();
        if (i >= len) throw new Error("floating operator '|'");
        v = (v | parseAnd()) | 0;
      } else break;
    }
    return v;
  }

  const result = parseOr();
  skipWs();
  if (i < len) throw new Error(`trailing garbage in expression: ${s.slice(i)}`);
  return result | 0;
}
