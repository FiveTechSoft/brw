/**
 * Node ESM runner mirroring engine-smoke.html
 */
import { test } from "./assert.js";
import { WS, RT, STD_ID, STYLE_NAMES, BS, DS, DEFAULT_DIALOG_STYLE } from "../js/core/constants.js";
import { UndoStack } from "../js/core/undo-stack.js";
import { IdentifierStore } from "../js/core/identifiers.js";
import { ProjectModel, defaultControl } from "../js/core/project-model.js";
import { evalExpr } from "../js/engine/rc-expr.js";
import { lex } from "../js/engine/rc-lexer.js";
import { parseRc, applyParseToProject } from "../js/engine/rc-parser.js";
import { compileRc, compileHeader } from "../js/engine/rc-compiler.js";
import { packDialog, unpackDialog } from "../js/engine/dlg-template.js";
import { readRes } from "../js/engine/res-reader.js";
import { writeRes } from "../js/engine/res-writer.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samples = join(__dirname, "..", "samples");

const HEADER = readFileSync(join(samples, "resource.h"), "utf8");
const ABOUT_RC = readFileSync(join(samples, "about.rc"), "utf8");

const results = [];

results.push(test("constants IDOK", () => {
  if (STD_ID.IDOK !== 1) throw new Error("IDOK");
  if (RT.DIALOG !== 5) throw new Error("RT.DIALOG");
  if ((WS.CHILD | WS.VISIBLE) === 0) throw new Error("styles");
}));

results.push(test("UndoStack undo/redo", () => {
  const stack = new UndoStack(2);
  let n = 0;
  const inc = () => {
    n += 1;
    stack.push({ label: "inc", undo: () => { n -= 1; }, redo: () => { n += 1; } });
  };
  inc(); inc(); inc();
  if (n !== 3) throw new Error("n");
  stack.undo(); if (n !== 2) throw new Error("undo1");
  stack.undo(); if (n !== 1) throw new Error("undo2");
  if (stack.canUndo) throw new Error("no more undo after trim");
  stack.redo(); if (n !== 2) throw new Error("redo");
}));

results.push(test("IdentifierStore define and rename cascade", () => {
  const ids = new IdentifierStore();
  ids.define("IDC_FOO", 100, "resource.h");
  ids.define("IDD_MAIN", 200, "resource.h");
  if (ids.getValue("IDC_FOO") !== 100) throw new Error("get");
  ids.rename("IDC_FOO", "IDC_BAR");
  if (ids.getByName("IDC_FOO")) throw new Error("old");
  if (ids.getByName("IDC_BAR").value !== 100) throw new Error("new");
  ids.setValue("IDC_BAR", 101);
  if (ids.getValue("IDC_BAR") !== 101) throw new Error("set");
  const text = ids.toHeaderText();
  if (!text.includes("#define IDC_BAR 101")) throw new Error("header");
}));

results.push(test("ProjectModel dialog undo", () => {
  const p = new ProjectModel();
  p.createDialog();
  if (p.dialogs().length !== 1) throw new Error("dlg");
  p.undo.undo();
  if (p.dialogs().length !== 0) throw new Error("undo new");
  p.undo.redo();
  if (p.dialogs().length !== 1) throw new Error("redo");
}));

results.push(test("ProjectModel rename cascade + control", () => {
  const p = new ProjectModel();
  const d = p.createDialog();
  const ctl = defaultControl({ id: "IDC_BTN", text: "OK" });
  p.addControl(d, ctl);
  p.renameIdentifier(d.id, "IDD_RENAMED");
  if (d.id !== "IDD_RENAMED") throw new Error("dlg id");
  if (!p.identifiers.getByName("IDD_RENAMED")) throw new Error("id store");
  if (p.findDialog("IDD_RENAMED") !== d) throw new Error("find");
  const usage = p.recomputeUsage();
  if (!usage.get("IDD_RENAMED")?.some((t) => t.startsWith("DIALOG:"))) throw new Error("usage dlg");
  if (!usage.get("IDC_BTN")?.some((t) => t.includes("CONTROL:"))) throw new Error("usage ctl");
  p.setIdentifierValue("IDD_RENAMED", 999);
  if (p.identifiers.getValue("IDD_RENAMED") !== 999) throw new Error("set val");
  p.undo.undo();
  if (p.identifiers.getValue("IDD_RENAMED") === 999) throw new Error("undo val");
}));

results.push(test("octal expr", () => {
  if (evalExpr("010 + 1", {}) !== 9) throw new Error("octal got " + evalExpr("010 + 1", {}));
}));
results.push(test("hex and or", () => {
  const v = evalExpr("0x40000000 | 0x10000000", {});
  if (v !== (0x40000000 | 0x10000000)) throw new Error("or");
}));
results.push(test("style names", () => {
  const v = evalExpr("WS_CHILD | WS_VISIBLE", STYLE_NAMES);
  if (v !== (0x40000000 | 0x10000000)) throw new Error("styles " + v);
}));
results.push(test("floating or throws", () => {
  let threw = false;
  try { evalExpr("WS_CHILD |", STYLE_NAMES); } catch { threw = true; }
  if (!threw) throw new Error("expected throw");
}));
results.push(test("mul/add/parens", () => {
  if (evalExpr("(1 + 2) * 3", {}) !== 9) throw new Error("paren");
  if (evalExpr("10 - 3 - 2", {}) !== 5) throw new Error("sub assoc");
  if (evalExpr("0x10 + 010", {}) !== 24) throw new Error("hex+oct");
}));
results.push(test("lexer strips comments", () => {
  const toks = lex("IDD DIALOG /*c*/ 0,0,10,10 //x\nBEGIN\nEND");
  if (!toks.some((t) => t.type === "IDENT" && t.value === "IDD")) throw new Error("id");
  if (!toks.some((t) => t.type === "NUMBER")) throw new Error("num");
  if (!toks.some((t) => t.type === "BEGIN")) throw new Error("begin");
  if (!toks.some((t) => t.type === "END")) throw new Error("end");
  if (toks.some((t) => t.type === "IDENT" && t.value === "DIALOG") === false) throw new Error("DIALOG kw");
}));
results.push(test("lexer directive", () => {
  const toks = lex("#define FOO 1\nBAR DIALOG 0,0,1,1\nBEGIN\nEND\n");
  const d = toks.find((t) => t.type === "DIRECTIVE");
  if (!d || !d.value.includes("define")) throw new Error("dir " + JSON.stringify(d));
}));

results.push(test("parse about.rc dialog", () => {
  const parsed = parseRc(ABOUT_RC, {
    resolveInclude: (p) => (p === "resource.h" || p.endsWith("resource.h") ? HEADER : null),
  });
  if (parsed.errors.length) throw new Error("errors: " + parsed.errors.join("; "));
  if (parsed.identifiers.length < 4) throw new Error("ids " + parsed.identifiers.length);
  const dlgs = parsed.resources.filter((r) => r.type === "DIALOG" || r.type === "DIALOGEX");
  if (dlgs.length !== 1) throw new Error("dlg count " + dlgs.length);
  const d = dlgs[0];
  if (d.id !== "IDD_ABOUT") throw new Error("id " + d.id);
  if (d.controls.length !== 3) throw new Error("controls " + d.controls.length);
  if (d.className !== "bordlg") throw new Error("class " + d.className);
  if (d.title !== "About") throw new Error("title");
  if (d.x !== 20 || d.cy !== 80) throw new Error("geom");
  if (d.font?.name !== "MS Sans Serif" || d.font?.size !== 8) throw new Error("font");
  const expectedStyle = STYLE_NAMES.DS_MODALFRAME | STYLE_NAMES.WS_POPUP | STYLE_NAMES.WS_CAPTION | STYLE_NAMES.WS_SYSMENU;
  if ((d.style | 0) !== (expectedStyle | 0)) throw new Error("style " + (d.style >>> 0).toString(16));
  if (d.controls[0].className !== "STATIC") throw new Error("ltext class");
  if (d.controls[1].className !== "BUTTON") throw new Error("btn class");
  if (d.controls[1].text !== "OK") throw new Error("btn text");
}));

results.push(test("parse #ifdef skip", () => {
  const src = `
#define A 1
#ifdef A
#define B 2
#endif
#ifdef Z
#define C 3
#endif
#ifndef Z
#define D 4
#endif
`;
  const parsed = parseRc(src);
  const names = parsed.identifiers.map((i) => i.name).sort();
  if (!names.includes("A") || !names.includes("B") || !names.includes("D")) throw new Error("names " + names);
  if (names.includes("C")) throw new Error("C should be skipped");
}));

results.push(test("opaque MENU preserved", () => {
  const src = `
IDR_MENU MENU
BEGIN
  POPUP "&File"
  BEGIN
    MENUITEM "E&xit", 100
  END
END
`;
  const parsed = parseRc(src);
  if (parsed.errors.length) throw new Error(parsed.errors.join("; "));
  if (parsed.resources.length !== 1) throw new Error("count");
  if (parsed.resources[0].type !== "MENU") throw new Error("type");
  if (!parsed.resources[0].rawText.includes("MENUITEM")) throw new Error("raw");
}));

results.push(test("compileHeader", () => {
  const ids = new IdentifierStore();
  ids.define("IDC_A", 1);
  ids.define("IDD_B", 100);
  const h = compileHeader(ids);
  if (!h.includes("#define IDC_A 1")) throw new Error("h");
}));

results.push(test("parse→project→compileRc→parse round-trip", () => {
  const parsed = parseRc(ABOUT_RC, {
    resolveInclude: (p) => (p === "resource.h" || p.endsWith("resource.h") ? HEADER : null),
  });
  if (parsed.errors.length) throw new Error("parse1: " + parsed.errors.join("; "));
  const p = new ProjectModel();
  applyParseToProject(p, parsed, "about.rc");
  if (p.dialogs().length !== 1) throw new Error("model dlg");
  if (p.dialogs()[0].controls.length !== 3) throw new Error("model ctl");
  const rc = compileRc(p);
  console.log("--- compiled RC ---\n" + rc + "\n---");
  if (!rc.includes("IDD_ABOUT")) throw new Error("emit id");
  if (!rc.includes("DIALOG")) throw new Error("emit dialog");
  const parsed2 = parseRc(rc, {
    resolveInclude: (path) => {
      if (path === "resource.h" || path.endsWith("resource.h")) {
        return compileHeader(p.identifiers);
      }
      return null;
    },
    symbols: Object.fromEntries(p.identifiers.list().map((i) => [i.name, i.value])),
  });
  if (parsed2.errors.length) throw new Error("parse2: " + parsed2.errors.join("; ") + "\n" + rc);
  const d2 = parsed2.resources.filter((r) => r.type === "DIALOG" || r.type === "DIALOGEX");
  if (d2.length !== 1) throw new Error("rt dlg " + d2.length);
  if (String(d2[0].id) !== "IDD_ABOUT") throw new Error("rt id " + d2[0].id);
  if (d2[0].controls.length !== 3) throw new Error("rt ctl " + d2[0].controls.length);
  if (d2[0].className !== "bordlg") throw new Error("rt class");
}));

results.push(test("pack/unpack dialog round-trip", () => {
  const dlg = {
    type: "DIALOG",
    id: "IDD_ABOUT",
    x: 20, y: 20, cx: 180, cy: 80,
    style: DEFAULT_DIALOG_STYLE,
    exStyle: 0,
    title: "About",
    font: { name: "MS Sans Serif", size: 8 },
    className: "bordlg",
    menu: null,
    memoryFlags: [],
    sourceFile: null,
    controls: [
      defaultControl({
        id: 101,
        className: "STATIC",
        text: "Hello",
        x: 10, y: 10, cx: 100, cy: 12,
        style: WS.CHILD | WS.VISIBLE,
      }),
      defaultControl({
        id: 1,
        className: "BUTTON",
        text: "OK",
        x: 30, y: 50, cx: 50, cy: 14,
        style: WS.CHILD | WS.VISIBLE | WS.TABSTOP | BS.DEFPUSHBUTTON,
      }),
    ],
  };
  const buf = packDialog(dlg, (id) => (typeof id === "number" ? id : null));
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 32) throw new Error("pack size " + buf.byteLength);
  const out = unpackDialog(buf, "IDD_ABOUT");
  if (out.title !== "About") throw new Error("title " + out.title);
  if (out.controls.length !== 2) throw new Error("ctl count " + out.controls.length);
  if (out.className !== "bordlg") throw new Error("class " + out.className);
  if (out.cx !== 180 || out.cy !== 80) throw new Error("geom");
  if (out.font?.name !== "MS Sans Serif") throw new Error("font");
  if (out.controls[1].text !== "OK") throw new Error("btn text " + out.controls[1].text);
  if ((out.style & DS.SETFONT) === 0) throw new Error("DS_SETFONT missing");
}));

results.push(test("writeRes/readRes round-trip one dialog", () => {
  const p = new ProjectModel();
  p.identifiers.define("IDD_TEST", 200);
  p.identifiers.define("IDC_OK", 1);
  const d = p.createDialog("IDD_TEST");
  d.title = "RoundTrip";
  d.cx = 120;
  d.cy = 60;
  p.addControl(d, defaultControl({
    id: "IDC_OK",
    className: "BUTTON",
    text: "OK",
    x: 10, y: 20, cx: 40, cy: 14,
    style: WS.CHILD | WS.VISIBLE | WS.TABSTOP,
  }));
  const resBuf = writeRes(p);
  if (!(resBuf instanceof ArrayBuffer) || resBuf.byteLength < 40) throw new Error("res size");
  const { resources, errors } = readRes(resBuf);
  if (errors.length) throw new Error("read errors: " + errors.join("; "));
  const dlgs = resources.filter((r) => r.type === "DIALOG" || r.type === "DIALOGEX");
  if (dlgs.length !== 1) throw new Error("dlg count " + dlgs.length + " total " + resources.length);
  if (dlgs[0].title !== "RoundTrip") throw new Error("title " + dlgs[0].title);
  if (dlgs[0].controls.length !== 1) throw new Error("controls " + dlgs[0].controls.length);
  // name may be numeric id from RES
  const nameOk = String(dlgs[0].id) === "200" || String(dlgs[0].id) === "IDD_TEST";
  if (!nameOk) throw new Error("id " + dlgs[0].id);
}));

const pass = results.every(Boolean);
console.log(pass ? "\nALL PASS (" + results.length + " tests)" : "\nSOME FAILED");
process.exit(pass ? 0 : 1);
