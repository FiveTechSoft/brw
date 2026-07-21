/**
 * RC resource-script parser (DIALOG subset + defines + opaque blocks).
 */
import { lex } from "./rc-lexer.js";
import { evalExpr, parseNumberLexeme } from "./rc-expr.js";
import { WS, BS, ES, SS, CBS, LBS, STYLE_NAMES } from "../core/constants.js";

const CONTROL_KEYWORDS = new Set([
  "CONTROL", "PUSHBUTTON", "DEFPUSHBUTTON", "EDITTEXT", "LTEXT", "RTEXT", "CTEXT",
  "LISTBOX", "COMBOBOX", "GROUPBOX", "CHECKBOX", "AUTOCHECKBOX", "RADIOBUTTON",
  "AUTORADIOBUTTON", "ICON",
]);

const DIALOG_ATTRS = new Set([
  "STYLE", "EXSTYLE", "CAPTION", "FONT", "CLASS", "MENU", "LANGUAGE",
]);

const OPAQUE_TYPES = new Set([
  "MENU", "ACCELERATORS", "STRINGTABLE", "BITMAP", "ICON", "CURSOR", "RCDATA",
  "VERSIONINFO", "DLGINIT", "TOOLBAR", "FONT", "MESSAGETABLE",
]);

const MEMORY_FLAGS = new Set([
  "MOVEABLE", "FIXED", "PURE", "IMPURE", "PRELOAD", "LOADONCALL", "DISCARDABLE",
]);

/**
 * @param {string} text
 * @param {{ resolveInclude?: (path: string) => string|null, symbols?: Record<string, number> }} [opts]
 * @returns {{ identifiers: {name:string,value:number}[], resources: object[], errors: string[] }}
 */
export function parseRc(text, opts = {}) {
  const symbols = { ...STYLE_NAMES, ...(opts.symbols || {}) };
  /** @type {{name:string,value:number}[]} */
  const identifiers = [];
  /** @type {object[]} */
  const resources = [];
  /** @type {string[]} */
  const errors = [];
  const resolveInclude = opts.resolveInclude || (() => null);
  const includeStack = new Set();

  /**
   * @param {string} src
   * @param {string} [fromFile]
   */
  function parseSource(src, fromFile = "") {
    let tokens;
    try {
      tokens = lex(src);
    } catch (e) {
      errors.push(`${fromFile}: lex error: ${e.message || e}`);
      return;
    }

    let pos = 0;
    /** @type {{active: boolean, seenElse: boolean}[]} */
    const condStack = [];

    function active() {
      return condStack.every((c) => c.active);
    }

    function peek(offset = 0) {
      return tokens[pos + offset] || null;
    }

    function at(type, value) {
      const t = peek();
      if (!t || t.type !== type) return false;
      if (value != null && t.value !== value) return false;
      return true;
    }

    function advance() {
      return tokens[pos++] || null;
    }

    function match(type, value) {
      if (at(type, value)) return advance();
      return null;
    }

    function expect(type, value) {
      const t = peek();
      if (!t || t.type !== type || (value != null && t.value !== value)) {
        const got = t ? `${t.type}:${t.value}` : "EOF";
        throw new Error(`expected ${type}${value != null ? " " + value : ""}, got ${got}`);
      }
      return advance();
    }

    /**
     * Collect tokens that form an expression until a stopper punctuation/keyword.
     * @param {Set<string>|string[]} stopPunct
     */
    function collectExprTokens(stopPunct = [",", "\n"]) {
      const stops = stopPunct instanceof Set ? stopPunct : new Set(stopPunct);
      const parts = [];
      let depth = 0;
      while (pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.type === "BEGIN" || t.type === "END" || t.type === "DIRECTIVE") break;
        if (t.type === "IDENT" && DIALOG_ATTRS.has(t.value) && depth === 0 && parts.length > 0) break;
        if (t.type === "IDENT" && CONTROL_KEYWORDS.has(t.value) && depth === 0 && parts.length > 0) break;
        if (t.type === "PUNC" && t.value === "," && depth === 0 && stops.has(",")) break;
        if (t.type === "PUNC" && stops.has(t.value) && depth === 0) break;
        if (t.type === "PUNC" && t.value === "(") depth++;
        if (t.type === "PUNC" && t.value === ")") {
          if (depth === 0 && stops.has(")")) break;
          depth--;
        }
        parts.push(advance());
      }
      return parts;
    }

    function exprFromTokens(toks) {
      if (!toks.length) throw new Error("empty expression");
      const textExpr = toks.map((t) => {
        if (t.type === "STRING") return `"${t.value}"`;
        return t.value;
      }).join(" ");
      // NOT flag: RC allows "NOT WS_VISIBLE" — treat NOT as bitwise complement of next primary via symbols.
      // Simple rewrite: NOT X → (~X) using eval with unary we already support only +/-, so expand here.
      const rewritten = rewriteNot(textExpr);
      return evalExpr(rewritten, symbols);
    }

    function rewriteNot(exprText) {
      // Replace NOT IDENT / NOT 0x.. with (~val) using symbols where possible is hard mid-string.
      // Token-level: if we see NOT before a name/number, replace with bitwise not of that value.
      // For simplicity, handle via regex on tokenized form: "NOT NAME" or "NOT number"
      return exprText.replace(/\bNOT\s+([A-Za-z_][A-Za-z0-9_]*|0[xX][0-9a-fA-F]+|\d+)/g, (_, tok) => {
        let v;
        if (/^0[xX]/.test(tok) || /^\d+$/.test(tok)) v = parseNumberLexeme(tok);
        else if (tok in symbols) v = symbols[tok];
        else throw new Error(`unknown identifier after NOT: ${tok}`);
        return String((~v) | 0);
      });
    }

    function parseExpr(stopPunct) {
      const toks = collectExprTokens(stopPunct);
      return exprFromTokens(toks);
    }

    function parseIdOrExpr() {
      const t = peek();
      if (!t) throw new Error("expected id");
      if (t.type === "IDENT") {
        const name = advance().value;
        if (name in symbols) return name; // keep symbolic
        // unknown id — still keep as name (forward ref)
        return name;
      }
      if (t.type === "NUMBER") {
        return parseNumberLexeme(advance().value);
      }
      return parseExpr([","]);
    }

    function handleDirective(raw) {
      const line = raw.trim();
      if (!line) return;
      const m = line.match(/^(\w+)\b\s*(.*)$/);
      if (!m) return;
      const dir = m[1].toLowerCase();
      const rest = m[2].trim();

      if (dir === "define") {
        if (!active()) return;
        const dm = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/);
        if (!dm) {
          errors.push(`#define: bad syntax: ${line}`);
          return;
        }
        const name = dm[1];
        const valueSrc = dm[2].trim();
        let value = 0;
        if (valueSrc) {
          try {
            // strip trailing comments already gone; allow empty → 0
            value = evalExpr(rewriteNot(valueSrc), symbols);
          } catch (e) {
            errors.push(`#define ${name}: ${e.message || e}`);
            return;
          }
        }
        symbols[name] = value | 0;
        identifiers.push({ name, value: value | 0 });
        return;
      }

      if (dir === "undef") {
        if (!active()) return;
        const name = rest.split(/\s+/)[0];
        if (name) delete symbols[name];
        return;
      }

      if (dir === "include") {
        if (!active()) return;
        const im = rest.match(/^["<]([^">]+)[">]/);
        if (!im) {
          errors.push(`#include: bad syntax: ${line}`);
          return;
        }
        const path = im[1];
        if (includeStack.has(path)) {
          errors.push(`#include: circular include ${path}`);
          return;
        }
        let body = null;
        try {
          body = resolveInclude(path);
        } catch (e) {
          errors.push(`#include ${path}: ${e.message || e}`);
          return;
        }
        if (body == null) {
          errors.push(`#include: unresolved ${path}`);
          return;
        }
        includeStack.add(path);
        parseSource(body, path);
        includeStack.delete(path);
        return;
      }

      if (dir === "ifdef") {
        const name = rest.split(/\s+/)[0];
        const on = active() && Object.prototype.hasOwnProperty.call(symbols, name);
        condStack.push({ active: on, seenElse: false });
        return;
      }

      if (dir === "ifndef") {
        const name = rest.split(/\s+/)[0];
        const on = active() && !Object.prototype.hasOwnProperty.call(symbols, name);
        condStack.push({ active: on, seenElse: false });
        return;
      }

      if (dir === "else") {
        if (!condStack.length) {
          errors.push("#else without #if");
          return;
        }
        const top = condStack[condStack.length - 1];
        if (top.seenElse) {
          errors.push("duplicate #else");
          return;
        }
        top.seenElse = true;
        // parent must be active for else branch to matter
        const parentActive = condStack.slice(0, -1).every((c) => c.active);
        top.active = parentActive && !top.active;
        // Wait: if we entered with active=true, else should be false.
        // If we entered with active=false because parent was inactive, stay false.
        // Actually when we pushed, `on` already AND'd with active(). So if parent inactive, top.active is false.
        // On else: if parent inactive, stay false; if parent active, flip.
        // Reconstruct:
        const parentOk = condStack.slice(0, -1).every((c) => c.active);
        // We need the original condition. Store it.
        // Simpler approach: store `cond` separately.
        return;
      }

      if (dir === "endif") {
        if (!condStack.length) {
          errors.push("#endif without #if");
          return;
        }
        condStack.pop();
        return;
      }

      // #if / #elif: best-effort integer / defined()
      if (dir === "if") {
        let on = false;
        if (active()) {
          try {
            on = evalIfCondition(rest, symbols) !== 0;
          } catch (e) {
            errors.push(`#if: ${e.message || e}`);
            on = false;
          }
        }
        condStack.push({ active: on, seenElse: false, condValue: on });
        return;
      }

      if (dir === "elif") {
        if (!condStack.length) {
          errors.push("#elif without #if");
          return;
        }
        const top = condStack[condStack.length - 1];
        const parentOk = condStack.slice(0, -1).every((c) => c.active);
        if (top.seenElse) {
          top.active = false;
          return;
        }
        if (top.condValue) {
          top.active = false;
          return;
        }
        let on = false;
        if (parentOk) {
          try {
            on = evalIfCondition(rest, symbols) !== 0;
          } catch (e) {
            errors.push(`#elif: ${e.message || e}`);
          }
        }
        top.active = on;
        top.condValue = on;
        return;
      }

      // ignore other directives when inactive or unknown
    }

    // Fix #else to properly flip using condValue
    // We'll store original: when pushing ifdef, set condValue to the condition result.
    // Redefine handle for else properly by patching after push sites — do it inline above next.

    function parseDialog(idTok, kind) {
      // id already consumed; kind is DIALOG or DIALOGEX token consumed
      // optional memory flags already skipped by caller
      const x = parseExpr([","]);
      expect("PUNC", ",");
      const y = parseExpr([","]);
      expect("PUNC", ",");
      const cx = parseExpr([","]);
      expect("PUNC", ",");
      const cy = parseExpr([",", "IDENT", "BEGIN"]);

      /** @type {import('../core/project-model.js').DialogResource} */
      const dlg = {
        type: kind,
        id: idTok,
        x, y, cx, cy,
        style: WS.POPUP | WS.CAPTION | WS.SYSMENU | WS.VISIBLE | 0x80 | 0x40, // MODALFRAME|SETFONT defaults later
        exStyle: 0,
        title: "",
        font: null,
        className: null,
        menu: null,
        memoryFlags: [],
        sourceFile: null,
        controls: [],
      };
      // Reset to 0 until STYLE seen — classic RC defaults differ; use common shell default if no STYLE
      dlg.style = 0;

      // attributes until BEGIN
      while (pos < tokens.length && !at("BEGIN")) {
        const t = peek();
        if (!t) break;
        if (t.type === "DIRECTIVE") break;
        if (t.type === "IDENT" && t.value === "STYLE") {
          advance();
          dlg.style = parseExpr([","]);
          continue;
        }
        if (t.type === "IDENT" && t.value === "EXSTYLE") {
          advance();
          dlg.exStyle = parseExpr([","]);
          continue;
        }
        if (t.type === "IDENT" && t.value === "CAPTION") {
          advance();
          const s = expect("STRING");
          dlg.title = s.value;
          continue;
        }
        if (t.type === "IDENT" && t.value === "FONT") {
          advance();
          const size = parseExpr([","]);
          expect("PUNC", ",");
          const nameTok = expect("STRING");
          let weight;
          let italic;
          if (match("PUNC", ",")) {
            weight = parseExpr([","]);
            if (match("PUNC", ",")) {
              italic = parseExpr([","]);
            }
          }
          dlg.font = { name: nameTok.value, size, weight, italic: italic ? !!italic : undefined };
          continue;
        }
        if (t.type === "IDENT" && t.value === "CLASS") {
          advance();
          if (at("STRING")) dlg.className = advance().value;
          else if (at("IDENT") || at("NUMBER")) dlg.className = String(advance().value);
          else throw new Error("CLASS expects string or id");
          continue;
        }
        if (t.type === "IDENT" && t.value === "MENU") {
          advance();
          if (at("STRING")) dlg.menu = advance().value;
          else dlg.menu = parseIdOrExpr();
          continue;
        }
        if (t.type === "IDENT" && t.value === "LANGUAGE") {
          advance();
          parseExpr([","]);
          if (match("PUNC", ",")) parseExpr([","]);
          continue;
        }
        // skip unknown attribute-looking idents to avoid infinite loop
        errors.push(`dialog ${idTok}: unexpected token ${t.type}:${t.value} before BEGIN`);
        advance();
      }

      expect("BEGIN");
      let tab = 0;
      while (pos < tokens.length && !at("END")) {
        const t = peek();
        if (!t) break;
        if (t.type === "DIRECTIVE") {
          advance();
          continue;
        }
        if (t.type === "IDENT" && CONTROL_KEYWORDS.has(t.value)) {
          try {
            const ctl = parseControl();
            ctl.tabIndex = tab++;
            dlg.controls.push(ctl);
          } catch (e) {
            errors.push(`dialog ${idTok} control: ${e.message || e}`);
            // resync: skip to next control keyword or END
            while (pos < tokens.length && !at("END") &&
              !(at("IDENT") && CONTROL_KEYWORDS.has(peek().value))) {
              advance();
            }
          }
          continue;
        }
        // unknown line inside dialog — skip token
        errors.push(`dialog ${idTok}: unexpected ${t.type}:${t.value} in controls`);
        advance();
      }
      expect("END");

      if (dlg.style === 0) {
        // match project default-ish if STYLE omitted
        dlg.style = WS.POPUP | WS.CAPTION | WS.SYSMENU | WS.VISIBLE | 0x80 | 0x40;
      }
      resources.push(dlg);
      return dlg;
    }

    function baseStyle(extra = 0) {
      return (WS.CHILD | WS.VISIBLE | extra) | 0;
    }

    function parseControl() {
      const kw = expect("IDENT").value;

      if (kw === "CONTROL") {
        // CONTROL text, id, class, style, x, y, cx, cy [, exstyle]
        const text = at("STRING") ? advance().value : "";
        if (!at("STRING") && text === "" && (at("IDENT") || at("NUMBER"))) {
          // rare: numeric text
        }
        expect("PUNC", ",");
        const id = parseIdOrExpr();
        expect("PUNC", ",");
        let className;
        if (at("STRING")) className = advance().value;
        else if (at("IDENT")) className = advance().value;
        else if (at("NUMBER")) className = String(advance().value);
        else throw new Error("CONTROL class expected");
        expect("PUNC", ",");
        const style = parseExpr([","]);
        expect("PUNC", ",");
        const x = parseExpr([","]);
        expect("PUNC", ",");
        const y = parseExpr([","]);
        expect("PUNC", ",");
        const cx = parseExpr([","]);
        expect("PUNC", ",");
        const cy = parseExpr([","]);
        let exStyle = 0;
        if (match("PUNC", ",")) {
          exStyle = parseExpr([","]);
        }
        return {
          id, className, text, x, y, cx, cy, style, exStyle,
          tabIndex: 0, groupStart: false,
        };
      }

      // Shortcut forms: KW [text,] id, x, y, cx, cy [, style [, exstyle]]
      let text = "";
      const hasText = !["EDITTEXT", "LISTBOX", "COMBOBOX", "ICON"].includes(kw) || at("STRING");
      // ICON is special: ICON name-id, id, x, y [, style] — name is first
      if (kw === "ICON") {
        // ICON text(id of icon), id, x, y, cx, cy optional styles — Borland often: ICON id, ctlId, x, y
        if (at("STRING")) text = advance().value;
        else if (at("IDENT") || at("NUMBER")) text = String(advance().value);
        expect("PUNC", ",");
        const id = parseIdOrExpr();
        expect("PUNC", ",");
        const x = parseExpr([","]);
        expect("PUNC", ",");
        const y = parseExpr([","]);
        let cx = 0, cy = 0, style = baseStyle() | SS.ICON;
        if (match("PUNC", ",")) {
          cx = parseExpr([","]);
          if (match("PUNC", ",")) {
            cy = parseExpr([","]);
            if (match("PUNC", ",")) style = parseExpr([","]);
          }
        }
        let exStyle = 0;
        if (match("PUNC", ",")) exStyle = parseExpr([","]);
        return {
          id, className: "STATIC", text, x, y, cx, cy, style, exStyle,
          tabIndex: 0, groupStart: false,
        };
      }

      if (at("STRING")) {
        text = advance().value;
        expect("PUNC", ",");
      } else if (hasText && ["PUSHBUTTON", "DEFPUSHBUTTON", "LTEXT", "RTEXT", "CTEXT",
        "GROUPBOX", "CHECKBOX", "AUTOCHECKBOX", "RADIOBUTTON", "AUTORADIOBUTTON"].includes(kw)) {
        // text required-ish but allow missing
      }

      const id = parseIdOrExpr();
      expect("PUNC", ",");
      const x = parseExpr([","]);
      expect("PUNC", ",");
      const y = parseExpr([","]);
      expect("PUNC", ",");
      const cx = parseExpr([","]);
      expect("PUNC", ",");
      const cy = parseExpr([","]);

      let style = defaultStyleFor(kw);
      let exStyle = 0;
      if (match("PUNC", ",")) {
        style = parseExpr([","]);
        if (match("PUNC", ",")) {
          exStyle = parseExpr([","]);
        }
      }

      const className = classNameFor(kw);
      return {
        id, className, text, x, y, cx, cy, style, exStyle,
        tabIndex: 0, groupStart: false,
      };
    }

    function classNameFor(kw) {
      switch (kw) {
        case "PUSHBUTTON":
        case "DEFPUSHBUTTON":
        case "GROUPBOX":
        case "CHECKBOX":
        case "AUTOCHECKBOX":
        case "RADIOBUTTON":
        case "AUTORADIOBUTTON":
          return "BUTTON";
        case "EDITTEXT":
          return "EDIT";
        case "LTEXT":
        case "RTEXT":
        case "CTEXT":
          return "STATIC";
        case "LISTBOX":
          return "LISTBOX";
        case "COMBOBOX":
          return "COMBOBOX";
        default:
          return kw;
      }
    }

    function defaultStyleFor(kw) {
      switch (kw) {
        case "PUSHBUTTON":
          return baseStyle(WS.TABSTOP) | BS.PUSHBUTTON;
        case "DEFPUSHBUTTON":
          return baseStyle(WS.TABSTOP) | BS.DEFPUSHBUTTON;
        case "CHECKBOX":
          return baseStyle(WS.TABSTOP) | BS.CHECKBOX;
        case "AUTOCHECKBOX":
          return baseStyle(WS.TABSTOP) | BS.AUTOCHECKBOX;
        case "RADIOBUTTON":
          return baseStyle(WS.TABSTOP) | BS.RADIOBUTTON;
        case "AUTORADIOBUTTON":
          return baseStyle(WS.TABSTOP) | BS.AUTORADIOBUTTON;
        case "GROUPBOX":
          return baseStyle(WS.GROUP) | BS.GROUPBOX;
        case "EDITTEXT":
          return baseStyle(WS.TABSTOP | WS.BORDER) | ES.LEFT;
        case "LTEXT":
          return baseStyle(WS.GROUP) | SS.LEFT;
        case "RTEXT":
          return baseStyle(WS.GROUP) | SS.RIGHT;
        case "CTEXT":
          return baseStyle(WS.GROUP) | SS.CENTER;
        case "LISTBOX":
          return baseStyle(WS.BORDER | WS.VSCROLL) | LBS.NOTIFY;
        case "COMBOBOX":
          return baseStyle(WS.TABSTOP) | CBS.DROPDOWN;
        default:
          return baseStyle();
      }
    }

    /**
     * Capture opaque resource raw text from startIdx in source through matching END or end of line resource.
     * @param {number} startTok
     * @param {string|number} id
     * @param {string} typeName
     */
    function parseOpaque(startTok, id, typeName) {
      // Consume until we have either a BEGIN/END block or a simple statement ending before next resource
      let depth = 0;
      let sawBegin = false;
      const startPos = tokens[startTok].start;
      let endPos = tokens[startTok].end;

      while (pos < tokens.length) {
        const t = peek();
        if (!t) break;
        if (t.type === "DIRECTIVE" && !sawBegin) break;
        if (t.type === "BEGIN") {
          sawBegin = true;
          depth++;
          endPos = advance().end;
          continue;
        }
        if (t.type === "END") {
          endPos = advance().end;
          depth--;
          if (depth <= 0 && sawBegin) break;
          continue;
        }
        // Without BEGIN: stop before next top-level resource pattern
        if (!sawBegin && depth === 0) {
          // line-oriented: consume idents/strings/numbers/punc until we hit something that looks like next resource
          // Heuristic: if we see IDENT that is a known type after an IDENT id — hard.
          // Consume until newline-equivalent: next DIRECTIVE or pattern IDENT+TYPE or TYPE at start.
          endPos = advance().end;
          // stop if next tokens look like start of new resource
          if (looksLikeResourceStart()) break;
          continue;
        }
        endPos = advance().end;
      }

      const rawText = src.slice(startPos, endPos);
      resources.push({
        type: typeName,
        id,
        rawText,
        memoryFlags: [],
        sourceFile: null,
      });
    }

    function looksLikeResourceStart() {
      const t0 = peek(0);
      const t1 = peek(1);
      if (!t0) return false;
      if (t0.type === "DIRECTIVE") return true;
      if (t0.type === "IDENT" && (t0.value === "STRINGTABLE" || t0.value === "LANGUAGE")) return true;
      if (t0.type === "IDENT" && t1 && t1.type === "IDENT" &&
        (t1.value === "DIALOG" || t1.value === "DIALOGEX" || OPAQUE_TYPES.has(t1.value))) {
        return true;
      }
      // name TYPE after memory flags skipped
      if (t0.type === "IDENT" && t1 && t1.type === "IDENT" && MEMORY_FLAGS.has(t1.value)) return true;
      return false;
    }

    function skipMemoryFlags() {
      const flags = [];
      while (at("IDENT") && MEMORY_FLAGS.has(peek().value)) {
        flags.push(advance().value);
      }
      return flags;
    }

    // Main loop
    while (pos < tokens.length) {
      const t = peek();
      if (!t) break;

      if (t.type === "DIRECTIVE") {
        const raw = advance().value;
        // special-case #else flip with stored condValue
        const m = raw.trim().match(/^(\w+)/);
        const dir = m ? m[1].toLowerCase() : "";
        if (dir === "ifdef" || dir === "ifndef" || dir === "if") {
          handleDirective(raw);
          // ensure condValue stored
          const top = condStack[condStack.length - 1];
          if (top && top.condValue === undefined) top.condValue = top.active;
        } else if (dir === "else") {
          if (!condStack.length) {
            errors.push("#else without #if");
          } else {
            const top = condStack[condStack.length - 1];
            if (top.seenElse) errors.push("duplicate #else");
            else {
              top.seenElse = true;
              const parentOk = condStack.slice(0, -1).every((c) => c.active);
              top.active = parentOk && !top.condValue;
            }
          }
        } else {
          handleDirective(raw);
        }
        continue;
      }

      if (!active()) {
        advance();
        continue;
      }

      // STRINGTABLE / LANGUAGE / bare type
      if (t.type === "IDENT" && t.value === "STRINGTABLE") {
        const startTok = pos;
        advance();
        skipMemoryFlags();
        parseOpaque(startTok, "", "STRINGTABLE");
        continue;
      }

      if (t.type === "IDENT" && t.value === "LANGUAGE") {
        // top-level LANGUAGE — skip
        advance();
        try {
          parseExpr([","]);
          if (match("PUNC", ",")) parseExpr([","]);
        } catch (e) {
          errors.push(`LANGUAGE: ${e.message || e}`);
        }
        continue;
      }

      // id TYPE ...
      if (t.type === "IDENT" || t.type === "NUMBER") {
        const startTok = pos;
        let id;
        if (t.type === "NUMBER") id = parseNumberLexeme(advance().value);
        else id = advance().value;

        const flags = skipMemoryFlags();

        const typeTok = peek();
        if (!typeTok || typeTok.type !== "IDENT") {
          errors.push(`expected resource type after id ${id}`);
          continue;
        }

        const typeName = typeTok.value;
        if (typeName === "DIALOG" || typeName === "DIALOGEX") {
          advance();
          try {
            const dlg = parseDialog(id, typeName);
            if (flags.length) dlg.memoryFlags = flags;
          } catch (e) {
            errors.push(`parse dialog ${id}: ${e.message || e}`);
            // resync to END
            let depth = 0;
            let saw = false;
            while (pos < tokens.length) {
              const x = advance();
              if (x.type === "BEGIN") { saw = true; depth++; }
              else if (x.type === "END") {
                depth--;
                if (saw && depth <= 0) break;
              }
            }
          }
          continue;
        }

        if (OPAQUE_TYPES.has(typeName)) {
          advance(); // type
          try {
            parseOpaque(startTok, id, typeName);
          } catch (e) {
            errors.push(`opaque ${typeName} ${id}: ${e.message || e}`);
          }
          continue;
        }

        // Unknown type — try opaque capture
        advance();
        try {
          parseOpaque(startTok, id, typeName);
        } catch (e) {
          errors.push(`resource ${typeName} ${id}: ${e.message || e}`);
        }
        continue;
      }

      // skip unknown
      errors.push(`unexpected token at top level: ${t.type}:${t.value}`);
      advance();
    }

    if (condStack.length) {
      errors.push("unclosed #if/#ifdef block");
    }
  }

  try {
    parseSource(text, "");
  } catch (e) {
    errors.push(String(e.message || e));
  }

  return { identifiers, resources, errors };
}

/**
 * Evaluate simple #if conditions: defined(X), integers, | & ! comparisons loosely.
 * @param {string} rest
 * @param {Record<string, number>} symbols
 */
function evalIfCondition(rest, symbols) {
  let s = rest.trim();
  // defined(NAME) or defined NAME
  s = s.replace(/defined\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g, (_, n) =>
    Object.prototype.hasOwnProperty.call(symbols, n) ? "1" : "0");
  s = s.replace(/defined\s+([A-Za-z_][A-Za-z0-9_]*)/g, (_, n) =>
    Object.prototype.hasOwnProperty.call(symbols, n) ? "1" : "0");
  // logical operators → arithmetic-ish
  s = s.replace(/&&/g, "&"); // not accurate but phase1
  s = s.replace(/\|\|/g, "|");
  s = s.replace(/!/g, "");
  try {
    return evalExpr(s, symbols);
  } catch {
    // if identifiers missing, treat as 0
    return 0;
  }
}

/**
 * Apply parse result into a ProjectModel.
 * @param {import('../core/project-model.js').ProjectModel} project
 * @param {{ identifiers: {name:string,value:number}[], resources: object[] }} parsed
 * @param {string|null} sourceFile
 */
export function applyParseToProject(project, parsed, sourceFile) {
  for (const id of parsed.identifiers) {
    project.identifiers.define(id.name, id.value, "resource.h");
  }
  for (const r of parsed.resources) {
    r.sourceFile = sourceFile;
    project.resources.push(r);
  }
  project._emit();
}
