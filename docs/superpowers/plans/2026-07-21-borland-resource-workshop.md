# Borland Resources Workshop (Web) Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local-first Win95-style SPA that opens/edits Windows dialogs via a visual editor and round-trips them through `.rc`/`.h` and Win32 `.res` (RT_DIALOG).

**Architecture:** Three layers — Engine (RC lexer/parser/compiler, DLGTEMPLATE, RES I/O), State (ProjectModel, identifiers, undo), UI (MDI WindowManager, Project/Identifiers windows, Dialog Editor, BWCC palette). Vanilla ES modules, no bundler, no npm.

**Tech Stack:** HTML5, CSS3, JavaScript ES2020 modules, ArrayBuffer/DataView for binaries, `localStorage` for desktop state, optional File System Access API for save.

**Spec:** `docs/superpowers/specs/2026-07-21-borland-resource-workshop-design.md`

**How to run the app (after scaffolding):**

```bash
# From repo root (Python)
python -m http.server 8080
# Open http://localhost:8080/
# Smoke tests: http://localhost:8080/tests/engine-smoke.html
```

---

## File map (create during tasks)

| Path | Responsibility |
|------|----------------|
| `index.html` | Shell DOM: desktop, menu host, speedbar host |
| `css/theme-win95.css` | Colors, fonts, bevels, buttons, menus |
| `css/windows.css` | MDI frames, title bar, resize, task strip |
| `css/editors.css` | Project tree, dialog canvas, palette, grids |
| `js/main.js` | Boot: construct layers, wire menus, restore desktop |
| `js/core/constants.js` | WS_*, DS_*, BS_*, ES_*, SS_*, RT_*, atoms, standard IDs |
| `js/core/undo-stack.js` | Command stack, limit 10–99 |
| `js/core/identifiers.js` | IdentifierStore + usage + rename cascade helpers |
| `js/core/project-model.js` | Project state, resources, file list, mutations+undo |
| `js/core/app-state.js` | localStorage desktop prefs |
| `js/engine/rc-lexer.js` | Tokenize RC / headers |
| `js/engine/rc-expr.js` | Constant expression evaluator (octal/hex/\|) |
| `js/engine/rc-parser.js` | Parse DIALOG + #define/#include + opaque blocks |
| `js/engine/rc-compiler.js` | Project → `.rc` / `.h` text |
| `js/engine/dlg-template.js` | Pack/unpack DLGTEMPLATE(EX) |
| `js/engine/res-reader.js` | Win32 `.res` → resources |
| `js/engine/res-writer.js` | Resources → Win32 `.res` |
| `js/ui/window-manager.js` | Draggable/resizable MDI windows |
| `js/ui/menubar.js` | Classic menu bar |
| `js/ui/speedbar.js` | Toolbar buttons |
| `js/ui/desktop.js` | Desktop host + task strip |
| `js/ui/file-io.js` | Open (input/DnD), save download / FS Access |
| `js/windows/project-window.js` | Tree By Type/File, filters, preview |
| `js/windows/identifiers-window.js` | Name/value/usage editor |
| `js/editors/dialog-renderer.js` | Paint dialog+controls (shared editor/preview/test) |
| `js/editors/dialog-editor.js` | Tools, hit-test, drag/resize, selection |
| `js/editors/control-palette.js` | Floating palette |
| `js/editors/dialog-styles.js` | Window Style modal |
| `js/editors/bwcc-renderer.js` | bordlg grid + BorBtn glyphs |
| `samples/resource.h` | Sample identifiers |
| `samples/about.rc` | Sample BWCC-ish dialog |
| `tests/assert.js` | Tiny assert helpers |
| `tests/engine-smoke.html` | Engine unit smoke tests in browser |

---

### Task 1: Scaffold + constants + test harness

**Files:**
- Create: `index.html`, `js/main.js`, `js/core/constants.js`, `tests/assert.js`, `tests/engine-smoke.html`, `css/theme-win95.css` (minimal stub)

- [ ] **Step 1: Create `js/core/constants.js`**

```js
/** @typedef {number} WinStyle */

export const RT = {
  CURSOR: 1, BITMAP: 2, ICON: 3, MENU: 4, DIALOG: 5,
  STRING: 6, FONTDIR: 7, FONT: 8, ACCELERATOR: 9,
  RCDATA: 10, MESSAGETABLE: 11, GROUP_CURSOR: 12, GROUP_ICON: 14, VERSION: 16,
};

export const CTL_ATOM = {
  BUTTON: 0x0080, EDIT: 0x0081, STATIC: 0x0082,
  LISTBOX: 0x0083, SCROLLBAR: 0x0084, COMBOBOX: 0x0085,
};

export const STD_ID = {
  IDOK: 1, IDCANCEL: 2, IDABORT: 3, IDRETRY: 4,
  IDIGNORE: 5, IDYES: 6, IDNO: 7, IDHELP: 998,
};

export const WS = {
  OVERLAPPED: 0x00000000, POPUP: 0x80000000, CHILD: 0x40000000,
  VISIBLE: 0x10000000, DISABLED: 0x08000000, CLIPSIBLINGS: 0x04000000,
  CLIPCHILDREN: 0x02000000, BORDER: 0x00800000, DLGFRAME: 0x00400000,
  VSCROLL: 0x00200000, HSCROLL: 0x00100000, SYSMENU: 0x00080000,
  THICKFRAME: 0x00040000, GROUP: 0x00020000, TABSTOP: 0x00010000,
  CAPTION: 0x00C00000, // BORDER|DLGFRAME
};

export const DS = {
  ABSALIGN: 0x0001, SYSMODAL: 0x0002, LOCALEDIT: 0x0020,
  SETFONT: 0x0040, MODALFRAME: 0x0080, NOIDLEMSG: 0x0100,
  SETFOREGROUND: 0x0200, CONTROL: 0x0400, CENTER: 0x0800,
  CENTERMOUSE: 0x1000, CONTEXTHELP: 0x2000,
};

export const BS = {
  PUSHBUTTON: 0x00000000, DEFPUSHBUTTON: 0x00000001, CHECKBOX: 0x00000002,
  AUTOCHECKBOX: 0x00000003, RADIOBUTTON: 0x00000004, "3STATE": 0x00000005,
  AUTO3STATE: 0x00000006, GROUPBOX: 0x00000007, USERBUTTON: 0x00000008,
  AUTORADIOBUTTON: 0x00000009, OWNERDRAW: 0x0000000B, LEFTTEXT: 0x00000020,
  TEXT: 0x00000000, ICON: 0x00000040, BITMAP: 0x00000080,
  LEFT: 0x00000100, RIGHT: 0x00000200, CENTER: 0x00000300,
};

export const ES = {
  LEFT: 0x0000, CENTER: 0x0001, RIGHT: 0x0002, MULTILINE: 0x0004,
  UPPERCASE: 0x0008, LOWERCASE: 0x0010, PASSWORD: 0x0020,
  AUTOVSCROLL: 0x0040, AUTOHSCROLL: 0x0080, NOHIDESEL: 0x0100,
  READONLY: 0x0800, WANTRETURN: 0x1000, NUMBER: 0x2000,
};

export const SS = {
  LEFT: 0x0000, CENTER: 0x0001, RIGHT: 0x0002, ICON: 0x0003,
  BLACKRECT: 0x0004, GRAYRECT: 0x0005, WHITERECT: 0x0006,
  BLACKFRAME: 0x0007, GRAYFRAME: 0x0008, WHITEFRAME: 0x0009,
  ETCHEDHORZ: 0x0010, ETCHEDVERT: 0x0011, ETCHEDFRAME: 0x0012,
  NOPREFIX: 0x0080, NOTIFY: 0x0100, CENTERIMAGE: 0x0200,
};

export const CBS = {
  SIMPLE: 0x0001, DROPDOWN: 0x0002, DROPDOWNLIST: 0x0003,
  AUTOHSCROLL: 0x0040, DISABLENOSCROLL: 0x0800,
};

export const LBS = {
  NOTIFY: 0x0001, SORT: 0x0002, NOREDRAW: 0x0004, MULTIPLESEL: 0x0008,
  HASSTRINGS: 0x0040, USETABSTOPS: 0x0080, NOINTEGRALHEIGHT: 0x0100,
  MULTICOLUMN: 0x0200, WANTKEYBOARDINPUT: 0x0400, EXTENDEDSEL: 0x0800,
  DISABLENOSCROLL: 0x1000,
};

/** Named style lookup for RC parser/compiler */
export const STYLE_NAMES = { ...flatten("WS", WS), ...flatten("DS", DS), ...flatten("BS", BS),
  ...flatten("ES", ES), ...flatten("SS", SS), ...flatten("CBS", CBS), ...flatten("LBS", LBS) };

function flatten(prefix, obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[`${prefix}_${k}`] = v;
  return out;
}

export const DEFAULT_DIALOG_STYLE =
  WS.POPUP | WS.CAPTION | WS.SYSMENU | WS.VISIBLE | DS.MODALFRAME | DS.SETFONT;

export const DEFAULT_LANG = 0x0409;
```

- [ ] **Step 2: Create `tests/assert.js` and smoke page**

```js
// tests/assert.js
export function assertEqual(actual, expected, msg = "") {
  if (actual !== expected) {
    throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
export function assertDeepEqual(a, b, msg = "") {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg} expected ${sb}, got ${sa}`);
}
export function assertThrows(fn, msg = "") {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(`${msg} expected throw`);
}
export function test(name, fn) {
  try {
    fn();
    console.log("%cPASS", "color:green", name);
    return true;
  } catch (e) {
    console.error("FAIL", name, e);
    return false;
  }
}
```

```html
<!-- tests/engine-smoke.html -->
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>BRW Engine Smoke</title></head>
<body>
<h1>Engine smoke tests</h1>
<pre id="out"></pre>
<script type="module">
  import { test } from "./assert.js";
  import { WS, RT, STD_ID } from "../js/core/constants.js";
  const results = [];
  results.push(test("constants IDOK", () => {
    if (STD_ID.IDOK !== 1) throw new Error("IDOK");
    if (RT.DIALOG !== 5) throw new Error("RT.DIALOG");
    if ((WS.CHILD | WS.VISIBLE) === 0) throw new Error("styles");
  }));
  document.getElementById("out").textContent =
    results.every(Boolean) ? "ALL PASS" : "SOME FAILED — see console";
</script>
</body></html>
```

- [ ] **Step 3: Create minimal `index.html` + `js/main.js` + theme stub**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Borland Resource Workshop</title>
  <link rel="stylesheet" href="css/theme-win95.css" />
  <link rel="stylesheet" href="css/windows.css" />
  <link rel="stylesheet" href="css/editors.css" />
</head>
<body>
  <div id="app">
    <div id="menubar"></div>
    <div id="speedbar"></div>
    <div id="desktop"></div>
    <div id="taskstrip"></div>
  </div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

```js
// js/main.js
console.log("Borland Resource Workshop boot");
document.getElementById("desktop").textContent = "Desktop ready";
```

```css
/* css/theme-win95.css — expand in Task 5 */
* { box-sizing: border-box; }
html, body, #app { margin: 0; height: 100%; overflow: hidden; }
body {
  font: 11px "MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif;
  background: #008080;
  color: #000;
}
#menubar, #speedbar { background: #c0c0c0; border-bottom: 1px solid #808080; }
#desktop { position: absolute; inset: 48px 0 28px 0; background: #008080; }
#taskstrip { position: absolute; left: 0; right: 0; bottom: 0; height: 28px; background: #c0c0c0; }
```

Empty stubs for later CSS:

```css
/* css/windows.css */
/* css/editors.css */
```

- [ ] **Step 4: Verify smoke test**

Run: `python -m http.server 8080` then open `http://localhost:8080/tests/engine-smoke.html`  
Expected: page shows `ALL PASS`

- [ ] **Step 5: Commit**

```bash
git add index.html css js tests
git commit -m "chore: scaffold SPA shell, constants, and engine smoke harness"
```

---

### Task 2: UndoStack

**Files:**
- Create: `js/core/undo-stack.js`
- Modify: `tests/engine-smoke.html`

- [ ] **Step 1: Add failing tests to `tests/engine-smoke.html`**

```js
import { UndoStack } from "../js/core/undo-stack.js";

results.push(test("undo stack basic", () => {
  const s = new UndoStack(10);
  let v = 0;
  s.push({
    label: "inc",
    undo: () => { v -= 1; },
    redo: () => { v += 1; },
  });
  s.undoStack[s.undoStack.length - 1].redo(); // simulate apply already done by caller
  // Caller applies change then push inverse-capable command already applied:
}));
```

Use the API below instead — tests assume **caller applies change, then pushes command whose undo reverses it**:

```js
results.push(test("UndoStack undo/redo", () => {
  const stack = new UndoStack(2);
  let n = 0;
  const inc = () => {
    n += 1;
    stack.push({ label: "inc", undo: () => { n -= 1; }, redo: () => { n += 1; } });
  };
  inc(); inc(); inc(); // limit 2 → only last 2 kept after third push trims
  if (n !== 3) throw new Error("n");
  stack.undo(); if (n !== 2) throw new Error("undo1");
  stack.undo(); if (n !== 1) throw new Error("undo2");
  if (stack.canUndo) throw new Error("no more undo after trim? check limit semantics");
  // With limit 2 and 3 pushes: first command dropped; only 2 undos available from n=3 → n=1
  stack.redo(); if (n !== 2) throw new Error("redo");
}));
```

- [ ] **Step 2: Implement `js/core/undo-stack.js`**

```js
export class UndoStack {
  /**
   * @param {number} [limit=10]
   */
  constructor(limit = 10) {
    this.limit = Math.min(99, Math.max(1, limit));
    /** @type {{label:string, undo:()=>void, redo:()=>void}[]} */
    this._undo = [];
    /** @type {{label:string, undo:()=>void, redo:()=>void}[]} */
    this._redo = [];
  }

  get canUndo() { return this._undo.length > 0; }
  get canRedo() { return this._redo.length > 0; }
  get undoLabel() { return this.canUndo ? this._undo[this._undo.length - 1].label : ""; }
  get redoLabel() { return this.canRedo ? this._redo[this._redo.length - 1].label : ""; }

  setLimit(n) {
    this.limit = Math.min(99, Math.max(1, n | 0));
    while (this._undo.length > this.limit) this._undo.shift();
  }

  /** Call AFTER applying the forward change. */
  push(command) {
    this._undo.push(command);
    while (this._undo.length > this.limit) this._undo.shift();
    this._redo.length = 0;
  }

  undo() {
    if (!this.canUndo) return;
    const cmd = this._undo.pop();
    cmd.undo();
    this._redo.push(cmd);
  }

  redo() {
    if (!this.canRedo) return;
    const cmd = this._redo.pop();
    cmd.redo();
    this._undo.push(cmd);
    while (this._undo.length > this.limit) this._undo.shift();
  }

  clear() {
    this._undo.length = 0;
    this._redo.length = 0;
  }
}
```

- [ ] **Step 3: Fix test expectations to match limit=2 with 3 incs**

After 3 pushes with limit 2: undo stack has cmds 2 and 3. From n=3: undo→2, undo→1, canUndo false. redo→2.

- [ ] **Step 4: Run smoke tests — ALL PASS**

- [ ] **Step 5: Commit**

```bash
git add js/core/undo-stack.js tests/engine-smoke.html
git commit -m "feat: add UndoStack with configurable limit"
```

---

### Task 3: IdentifierStore

**Files:**
- Create: `js/core/identifiers.js`
- Modify: `tests/engine-smoke.html`

- [ ] **Step 1: Write tests**

```js
import { IdentifierStore } from "../js/core/identifiers.js";

results.push(test("IdentifierStore define and rename cascade", () => {
  const ids = new IdentifierStore();
  ids.define("IDC_FOO", 100, "resource.h");
  ids.define("IDD_MAIN", 200, "resource.h");
  const refs = [{ kind: "control", get: () => "IDC_FOO", set: (n) => { refs[0]._n = n; }, _n: "IDC_FOO" }];
  // simpler API: rename returns list; ProjectModel applies — test store only:
  if (ids.getValue("IDC_FOO") !== 100) throw new Error("get");
  ids.rename("IDC_FOO", "IDC_BAR");
  if (ids.getByName("IDC_FOO")) throw new Error("old");
  if (ids.getByName("IDC_BAR").value !== 100) throw new Error("new");
  ids.setValue("IDC_BAR", 101);
  if (ids.getValue("IDC_BAR") !== 101) throw new Error("set");
  const text = ids.toHeaderText();
  if (!text.includes("#define IDC_BAR 101")) throw new Error("header");
}));
```

- [ ] **Step 2: Implement `js/core/identifiers.js`**

```js
/**
 * @typedef {{ name: string, value: number, sourceFile: string }} Identifier
 */

export class IdentifierStore {
  constructor() {
    /** @type {Map<string, Identifier>} */
    this._byName = new Map();
  }

  /** @returns {Identifier[]} */
  list() {
    return [...this._byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  getByName(name) { return this._byName.get(name) || null; }

  getValue(name) {
    const id = this._byName.get(name);
    return id ? id.value : null;
  }

  /** Resolve symbolic or numeric id to number; unknown symbols → null */
  resolve(idOrName) {
    if (typeof idOrName === "number") return idOrName;
    if (/^-?\d+$/.test(idOrName)) return parseInt(idOrName, 10);
    if (/^0x[0-9a-fA-F]+$/.test(idOrName)) return parseInt(idOrName, 16);
    return this.getValue(idOrName);
  }

  define(name, value, sourceFile = "resource.h") {
    this._byName.set(name, { name, value: value | 0, sourceFile });
  }

  remove(name) { this._byName.delete(name); }

  rename(oldName, newName) {
    const id = this._byName.get(oldName);
    if (!id) return false;
    if (oldName !== newName && this._byName.has(newName)) {
      throw new Error(`Identifier ${newName} already exists`);
    }
    this._byName.delete(oldName);
    id.name = newName;
    this._byName.set(newName, id);
    return true;
  }

  setValue(name, value) {
    const id = this._byName.get(name);
    if (!id) return false;
    id.value = value | 0;
    return true;
  }

  nextId(prefix, start = 100) {
    let n = start;
    const used = new Set(this.list().map((i) => i.value));
    while (used.has(n)) n++;
    let i = 1;
    let name = `${prefix}${i}`;
    while (this._byName.has(name)) { i++; name = `${prefix}${i}`; }
    return { name, value: n };
  }

  toHeaderText() {
    return this.list()
      .map((id) => `#define ${id.name} ${id.value}`)
      .join("\n") + (this._byName.size ? "\n" : "");
  }

  clear() { this._byName.clear(); }
}
```

- [ ] **Step 3: Run tests — PASS**

- [ ] **Step 4: Commit**

```bash
git add js/core/identifiers.js tests/engine-smoke.html
git commit -m "feat: add IdentifierStore for #define management"
```

---

### Task 4: ProjectModel

**Files:**
- Create: `js/core/project-model.js`
- Modify: `tests/engine-smoke.html`

- [ ] **Step 1: Implement model (source of truth)**

```js
// js/core/project-model.js
import { UndoStack } from "./undo-stack.js";
import { IdentifierStore } from "./identifiers.js";
import { DEFAULT_DIALOG_STYLE, WS, DS } from "./constants.js";

/**
 * @typedef {object} Control
 * @property {string|number} id
 * @property {string} className
 * @property {string} text
 * @property {number} x
 * @property {number} y
 * @property {number} cx
 * @property {number} cy
 * @property {number} style
 * @property {number} exStyle
 * @property {number} tabIndex
 * @property {boolean} groupStart
 */

/**
 * @typedef {object} DialogResource
 * @property {"DIALOG"|"DIALOGEX"} type
 * @property {string|number} id
 * @property {number} x
 * @property {number} y
 * @property {number} cx
 * @property {number} cy
 * @property {number} style
 * @property {number} exStyle
 * @property {string} title
 * @property {{name:string,size:number,weight?:number,italic?:boolean}|null} font
 * @property {string|null} className
 * @property {string|number|null} menu
 * @property {string[]} memoryFlags
 * @property {string|null} sourceFile
 * @property {Control[]} controls
 */

/**
 * @typedef {object} OpaqueResource
 * @property {string} type
 * @property {string|number} id
 * @property {string} rawText
 * @property {string[]} memoryFlags
 * @property {string|null} sourceFile
 */

/**
 * @typedef {object} BinaryResource
 * @property {"BINARY"} type
 * @property {number|string} typeId
 * @property {number|string} nameId
 * @property {number} language
 * @property {ArrayBuffer} data
 */

export class ProjectModel {
  constructor() {
    this.name = "Untitled";
    /** @type {{path:string, kind:string, content?: string|ArrayBuffer}[]} */
    this.files = [];
    this.identifiers = new IdentifierStore();
    /** @type {(DialogResource|OpaqueResource|BinaryResource)[]} */
    this.resources = [];
    this.sortMode = "byType";
    this.filters = {
      showResources: true,
      showIdentifiers: true,
      showItems: false,
      showUnusedTypes: false,
    };
    this.undo = new UndoStack(10);
    /** @type {Set<() => void>} */
    this._listeners = new Set();
  }

  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(); }

  clear() {
    this.name = "Untitled";
    this.files = [];
    this.identifiers.clear();
    this.resources = [];
    this.undo.clear();
    this._emit();
  }

  /** @returns {DialogResource[]} */
  dialogs() {
    return this.resources.filter((r) => r.type === "DIALOG" || r.type === "DIALOGEX");
  }

  findDialog(id) {
    return this.dialogs().find((d) => String(d.id) === String(id)) || null;
  }

  createDialog(idName = null) {
    const { name, value } = idName
      ? { name: idName, value: this.identifiers.getValue(idName) ?? this.identifiers.nextId("IDD_").value }
      : this.identifiers.nextId("IDD_");
    if (!this.identifiers.getByName(name)) this.identifiers.define(name, value);
    /** @type {DialogResource} */
    const dlg = {
      type: "DIALOG",
      id: name,
      x: 0, y: 0, cx: 200, cy: 100,
      style: DEFAULT_DIALOG_STYLE,
      exStyle: 0,
      title: name,
      font: { name: "MS Sans Serif", size: 8 },
      className: null,
      menu: null,
      memoryFlags: ["DISCARDABLE", "MOVEABLE"],
      sourceFile: null,
      controls: [],
    };
    const idx = this.resources.length;
    this.resources.push(dlg);
    this.undo.push({
      label: "New Dialog",
      undo: () => { this.resources.splice(idx, 1); this._emit(); },
      redo: () => { this.resources.splice(idx, 0, dlg); this._emit(); },
    });
    this._emit();
    return dlg;
  }

  /**
   * Replace all dialog fields (shallow assign). Pushes undo.
   * @param {DialogResource} dialog
   * @param {Partial<DialogResource>} props
   */
  setDialogProps(dialog, props) {
    const prev = { ...props };
    const before = {};
    for (const k of Object.keys(props)) before[k] = dialog[k];
    Object.assign(dialog, props);
    this.undo.push({
      label: "Dialog props",
      undo: () => { Object.assign(dialog, before); this._emit(); },
      redo: () => { Object.assign(dialog, prev); this._emit(); },
    });
    this._emit();
  }

  addControl(dialog, control) {
    if (control.tabIndex == null) control.tabIndex = dialog.controls.length;
    if (control.groupStart == null) control.groupStart = false;
    if (control.exStyle == null) control.exStyle = 0;
    dialog.controls.push(control);
    this.undo.push({
      label: "Add control",
      undo: () => { dialog.controls.pop(); this._emit(); },
      redo: () => { dialog.controls.push(control); this._emit(); },
    });
    this._emit();
  }

  removeControls(dialog, controls) {
    const snapshot = controls.map((c) => ({ c, i: dialog.controls.indexOf(c) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i);
    for (let i = snapshot.length - 1; i >= 0; i--) {
      dialog.controls.splice(snapshot[i].i, 1);
    }
    this.undo.push({
      label: "Delete controls",
      undo: () => {
        for (const { c, i } of snapshot) dialog.controls.splice(i, 0, c);
        this._emit();
      },
      redo: () => {
        for (let i = snapshot.length - 1; i >= 0; i--) {
          dialog.controls.splice(snapshot[i].i, 1);
        }
        this._emit();
      },
    });
    this._emit();
  }

  setControlProps(control, props) {
    const before = {};
    for (const k of Object.keys(props)) before[k] = control[k];
    const after = { ...props };
    Object.assign(control, props);
    this.undo.push({
      label: "Control props",
      undo: () => { Object.assign(control, before); this._emit(); },
      redo: () => { Object.assign(control, after); this._emit(); },
    });
    this._emit();
  }

  moveResizeControl(control, rect) {
    const before = { x: control.x, y: control.y, cx: control.cx, cy: control.cy };
    Object.assign(control, rect);
    this.undo.push({
      label: "Move/resize",
      undo: () => { Object.assign(control, before); this._emit(); },
      redo: () => { Object.assign(control, rect); this._emit(); },
    });
    this._emit();
  }

  /** Rename identifier and cascade into dialog/control ids */
  renameIdentifier(oldName, newName) {
    if (!this.identifiers.rename(oldName, newName)) return;
    for (const r of this.resources) {
      if ((r.type === "DIALOG" || r.type === "DIALOGEX")) {
        if (String(r.id) === oldName) r.id = newName;
        for (const c of r.controls) {
          if (String(c.id) === oldName) c.id = newName;
        }
      }
    }
    this.undo.push({
      label: "Rename id",
      undo: () => {
        this.identifiers.rename(newName, oldName);
        for (const r of this.resources) {
          if ((r.type === "DIALOG" || r.type === "DIALOGEX")) {
            if (String(r.id) === newName) r.id = oldName;
            for (const c of r.controls) if (String(c.id) === newName) c.id = oldName;
          }
        }
        this._emit();
      },
      redo: () => {
        this.identifiers.rename(oldName, newName);
        for (const r of this.resources) {
          if ((r.type === "DIALOG" || r.type === "DIALOGEX")) {
            if (String(r.id) === oldName) r.id = newName;
            for (const c of r.controls) if (String(c.id) === oldName) c.id = newName;
          }
        }
        this._emit();
      },
    });
    this._emit();
  }

  recomputeUsage() {
    /** @type {Map<string, string[]>} */
    const usage = new Map();
    const add = (name, tag) => {
      if (typeof name !== "string") return;
      if (!usage.has(name)) usage.set(name, []);
      usage.get(name).push(tag);
    };
    for (const r of this.resources) {
      if (r.type === "DIALOG" || r.type === "DIALOGEX") {
        add(r.id, `DIALOG:${r.id}`);
        for (const c of r.controls) add(c.id, `CONTROL:${r.id}/${c.id}`);
      }
    }
    return usage;
  }
}

export function defaultControl(partial) {
  return {
    id: -1,
    className: "BUTTON",
    text: "",
    x: 10, y: 10, cx: 50, cy: 14,
    style: WS.CHILD | WS.VISIBLE | WS.TABSTOP,
    exStyle: 0,
    tabIndex: 0,
    groupStart: false,
    ...partial,
  };
}
```

- [ ] **Step 2: Smoke test createDialog + undo**

```js
import { ProjectModel } from "../js/core/project-model.js";
results.push(test("ProjectModel dialog undo", () => {
  const p = new ProjectModel();
  const d = p.createDialog();
  if (p.dialogs().length !== 1) throw new Error("dlg");
  p.undo.undo();
  if (p.dialogs().length !== 0) throw new Error("undo new");
  p.undo.redo();
  if (p.dialogs().length !== 1) throw new Error("redo");
}));
```

- [ ] **Step 3: Run tests — PASS, commit**

```bash
git add js/core/project-model.js tests/engine-smoke.html
git commit -m "feat: add ProjectModel with dialog mutations and undo"
```

---

### Task 5: Win95 theme + WindowManager

**Files:**
- Create: `js/ui/window-manager.js`
- Modify: `css/theme-win95.css`, `css/windows.css`, `js/main.js`

- [ ] **Step 1: Expand theme CSS** — bevel utilities, button face, menu, caption colors:

```css
:root {
  --face: #c0c0c0;
  --highlight: #ffffff;
  --shadow: #808080;
  --dkshadow: #000000;
  --active-caption: #000080;
  --caption-text: #ffffff;
  --desktop: #008080;
  --window: #ffffff;
  --hot-track: #000080;
}
.bevel-out {
  border-top: 1px solid var(--highlight);
  border-left: 1px solid var(--highlight);
  border-right: 1px solid var(--dkshadow);
  border-bottom: 1px solid var(--dkshadow);
  box-shadow: inset -1px -1px 0 var(--shadow), inset 1px 1px 0 var(--face);
}
.bevel-in {
  border-top: 1px solid var(--shadow);
  border-left: 1px solid var(--shadow);
  border-right: 1px solid var(--highlight);
  border-bottom: 1px solid var(--highlight);
}
.win-btn {
  background: var(--face);
  border-top: 1px solid var(--highlight);
  border-left: 1px solid var(--highlight);
  border-right: 1px solid var(--dkshadow);
  border-bottom: 1px solid var(--dkshadow);
  padding: 2px 8px;
  font: inherit;
  min-width: 75px;
  min-height: 23px;
}
.win-btn:active {
  border-top: 1px solid var(--dkshadow);
  border-left: 1px solid var(--dkshadow);
  border-right: 1px solid var(--highlight);
  border-bottom: 1px solid var(--highlight);
}
```

- [ ] **Step 2: Implement WindowManager**

```js
// js/ui/window-manager.js
let zCounter = 100;

export class WindowManager {
  /**
   * @param {HTMLElement} desktopEl
   * @param {HTMLElement} taskstripEl
   */
  constructor(desktopEl, taskstripEl) {
    this.desktop = desktopEl;
    this.taskstrip = taskstripEl;
    /** @type {Map<string, object>} */
    this.windows = new Map();
  }

  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.title
   * @param {number} [opts.x]
   * @param {number} [opts.y]
   * @param {number} [opts.w]
   * @param {number} [opts.h]
   * @param {boolean} [opts.modal]
   * @param {() => void} [opts.onClose]
   * @returns {{ root: HTMLElement, content: HTMLElement, setTitle: (t:string)=>void, close: ()=>void, focus: ()=>void }}
   */
  createWindow(opts) {
    const id = opts.id;
    if (this.windows.has(id)) {
      this.focus(id);
      return this.windows.get(id).api;
    }
    const root = document.createElement("div");
    root.className = "mdi-window" + (opts.modal ? " modal" : "");
    root.dataset.winId = id;
    root.style.left = (opts.x ?? 40) + "px";
    root.style.top = (opts.y ?? 40) + "px";
    root.style.width = (opts.w ?? 400) + "px";
    root.style.height = (opts.h ?? 300) + "px";
    root.style.zIndex = String(++zCounter);

    root.innerHTML = `
      <div class="mdi-titlebar">
        <span class="mdi-title"></span>
        <div class="mdi-sysbtns">
          <button type="button" data-act="min" title="Minimize">_</button>
          <button type="button" data-act="max" title="Maximize">□</button>
          <button type="button" data-act="close" title="Close">×</button>
        </div>
      </div>
      <div class="mdi-content"></div>
      <div class="mdi-resize" data-dir="e"></div>
      <div class="mdi-resize" data-dir="s"></div>
      <div class="mdi-resize" data-dir="se"></div>
    `;
    const titleEl = root.querySelector(".mdi-title");
    titleEl.textContent = opts.title;
    const content = root.querySelector(".mdi-content");

    const state = { id, root, content, titleEl, opts, state: "normal", restore: null, api: null };
    this.windows.set(id, state);
    this.desktop.appendChild(root);
    this._wire(state);
    this._addTaskButton(state);

    const api = {
      root,
      content,
      setTitle: (t) => { titleEl.textContent = t; opts.title = t; },
      close: () => this.close(id),
      focus: () => this.focus(id),
    };
    state.api = api;
    this.focus(id);
    return api;
  }

  focus(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.root.style.zIndex = String(++zCounter);
    w.root.classList.add("focused");
    for (const [oid, ow] of this.windows) {
      if (oid !== id) ow.root.classList.remove("focused");
    }
  }

  close(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.root.remove();
    w.taskBtn?.remove();
    this.windows.delete(id);
    w.opts.onClose?.();
  }

  getLayout() {
    return [...this.windows.values()].map((w) => ({
      id: w.id,
      x: parseInt(w.root.style.left, 10) || 0,
      y: parseInt(w.root.style.top, 10) || 0,
      w: w.root.offsetWidth,
      h: w.root.offsetHeight,
      state: w.state,
    }));
  }

  applyLayout(list) {
    for (const L of list || []) {
      const w = this.windows.get(L.id);
      if (!w) continue;
      w.root.style.left = L.x + "px";
      w.root.style.top = L.y + "px";
      w.root.style.width = L.w + "px";
      w.root.style.height = L.h + "px";
      w.state = L.state || "normal";
    }
  }

  _addTaskButton(state) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task-btn";
    btn.textContent = state.opts.title;
    btn.addEventListener("click", () => {
      if (state.state === "min") {
        state.root.style.display = "";
        state.state = "normal";
      }
      this.focus(state.id);
    });
    this.taskstrip.appendChild(btn);
    state.taskBtn = btn;
  }

  _wire(state) {
    const { root } = state;
    const bar = root.querySelector(".mdi-titlebar");
    root.addEventListener("mousedown", () => this.focus(state.id));

    // drag
    bar.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      if (state.state === "max") return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const sl = root.offsetLeft, st = root.offsetTop;
      const move = (ev) => {
        root.style.left = sl + ev.clientX - sx + "px";
        root.style.top = st + ev.clientY - sy + "px";
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    });

    bar.addEventListener("dblclick", () => this._toggleMax(state));

    root.querySelector('[data-act="close"]').onclick = () => this.close(state.id);
    root.querySelector('[data-act="min"]').onclick = () => {
      root.style.display = "none";
      state.state = "min";
    };
    root.querySelector('[data-act="max"]').onclick = () => this._toggleMax(state);

    // resize se/e/s
    for (const handle of root.querySelectorAll(".mdi-resize")) {
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dir = handle.dataset.dir;
        const sx = e.clientX, sy = e.clientY;
        const sw = root.offsetWidth, sh = root.offsetHeight;
        const move = (ev) => {
          if (dir.includes("e")) root.style.width = Math.max(200, sw + ev.clientX - sx) + "px";
          if (dir.includes("s")) root.style.height = Math.max(120, sh + ev.clientY - sy) + "px";
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      });
    }
  }

  _toggleMax(state) {
    const { root } = state;
    if (state.state === "max") {
      const r = state.restore;
      root.style.left = r.left; root.style.top = r.top;
      root.style.width = r.width; root.style.height = r.height;
      state.state = "normal";
    } else {
      state.restore = {
        left: root.style.left, top: root.style.top,
        width: root.style.width, height: root.style.height,
      };
      root.style.left = "0"; root.style.top = "0";
      root.style.width = "100%"; root.style.height = "100%";
      state.state = "max";
    }
  }
}
```

- [ ] **Step 3: `css/windows.css`** — position absolute, title bar blue when focused, resize handles 6px.

```css
.mdi-window {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: var(--face);
  border-top: 2px solid var(--highlight);
  border-left: 2px solid var(--highlight);
  border-right: 2px solid var(--dkshadow);
  border-bottom: 2px solid var(--dkshadow);
  min-width: 200px;
  min-height: 120px;
}
.mdi-titlebar {
  display: flex;
  align-items: center;
  background: var(--shadow);
  color: #c0c0c0;
  height: 18px;
  padding: 0 2px;
  user-select: none;
  cursor: default;
}
.mdi-window.focused .mdi-titlebar {
  background: var(--active-caption);
  color: var(--caption-text);
}
.mdi-title { flex: 1; overflow: hidden; white-space: nowrap; font-weight: bold; padding-left: 2px; }
.mdi-sysbtns button {
  width: 16px; height: 14px; padding: 0; margin-left: 2px;
  font-size: 10px; line-height: 12px;
  background: var(--face); border: 1px solid; border-color: var(--highlight) var(--dkshadow) var(--dkshadow) var(--highlight);
}
.mdi-content { flex: 1; position: relative; overflow: auto; background: var(--face); min-height: 0; }
.mdi-resize { position: absolute; z-index: 5; }
.mdi-resize[data-dir="e"] { top: 0; right: 0; width: 6px; height: 100%; cursor: ew-resize; }
.mdi-resize[data-dir="s"] { left: 0; bottom: 0; width: 100%; height: 6px; cursor: ns-resize; }
.mdi-resize[data-dir="se"] { right: 0; bottom: 0; width: 12px; height: 12px; cursor: nwse-resize; }
.task-btn {
  margin: 2px; height: 22px; min-width: 80px;
  background: var(--face);
  border: 1px solid; border-color: var(--highlight) var(--dkshadow) var(--dkshadow) var(--highlight);
  font: inherit;
}
```

- [ ] **Step 4: Wire in `main.js`** — create one demo window titled "Project" to verify drag/resize.

- [ ] **Step 5: Manual check in browser, commit**

```bash
git add css js/ui/window-manager.js js/main.js
git commit -m "feat: Win95 theme and MDI WindowManager"
```

---

### Task 6: Menubar, speedbar, desktop boot

**Files:**
- Create: `js/ui/menubar.js`, `js/ui/speedbar.js`, `js/ui/desktop.js`
- Modify: `js/main.js`, `css/theme-win95.css`

- [ ] **Step 1: Menubar** — build nested menus from config; callbacks for File/Edit/Resource/Window/Help.

```js
// js/ui/menubar.js
export function createMenubar(host, menus) {
  host.classList.add("menubar");
  host.innerHTML = "";
  for (const menu of menus) {
    const top = document.createElement("div");
    top.className = "menu-top";
    top.textContent = menu.label;
    const drop = document.createElement("div");
    drop.className = "menu-dropdown";
    for (const item of menu.items) {
      if (item === "-") {
        const sep = document.createElement("div");
        sep.className = "menu-sep";
        drop.appendChild(sep);
        continue;
      }
      const row = document.createElement("div");
      row.className = "menu-item";
      row.textContent = item.label;
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
        item.action?.();
      });
      drop.appendChild(row);
    }
    top.appendChild(drop);
    top.addEventListener("click", (e) => {
      e.stopPropagation();
      const was = drop.classList.contains("open");
      host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
      if (!was) drop.classList.add("open");
    });
    host.appendChild(top);
  }
  document.addEventListener("click", () => {
    host.querySelectorAll(".menu-dropdown.open").forEach((d) => d.classList.remove("open"));
  });
}
```

- [ ] **Step 2: Speedbar** — buttons: New, Open, Save, Undo, Redo, New Dialog (icons as text or SVG later).

- [ ] **Step 3: `main.js` builds ProjectModel + WindowManager + menus with stub actions (`console.log` or alert for unimplemented).**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: menubar and speedbar shell wiring"
```

---

### Task 7: RC expression evaluator + lexer

**Files:**
- Create: `js/engine/rc-expr.js`, `js/engine/rc-lexer.js`
- Modify: `tests/engine-smoke.html`

- [ ] **Step 1: Tests**

```js
import { evalExpr } from "../js/engine/rc-expr.js";
import { lex } from "../js/engine/rc-lexer.js";
import { STYLE_NAMES } from "../js/core/constants.js";

results.push(test("octal expr", () => {
  if (evalExpr("010 + 1", {}) !== 9) throw new Error("octal");
}));
results.push(test("hex and or", () => {
  const v = evalExpr("0x40000000 | 0x10000000", {});
  if (v !== (0x40000000 | 0x10000000)) throw new Error("or");
}));
results.push(test("style names", () => {
  const v = evalExpr("WS_CHILD | WS_VISIBLE", STYLE_NAMES);
  if (v !== (0x40000000 | 0x10000000)) throw new Error("styles");
}));
results.push(test("floating or throws", () => {
  let threw = false;
  try { evalExpr("WS_CHILD |", STYLE_NAMES); } catch { threw = true; }
  if (!threw) throw new Error("expected throw");
}));
results.push(test("lexer strips comments", () => {
  const toks = lex("IDD DIALOG /*c*/ 0,0,10,10 //x\nBEGIN\nEND");
  if (!toks.some((t) => t.type === "IDENT" && t.value === "IDD")) throw new Error("id");
  if (!toks.some((t) => t.type === "NUMBER")) throw new Error("num");
}));
```

- [ ] **Step 2: Implement `rc-expr.js`**

Recursive descent: `expr = or`, `or = and (| and)*`, `and = add`, `add = mul (+|- mul)*`, `mul = unary (*|/ unary)*`, `unary = primary`, `primary = number | ident | (expr)`.

Number rules:
- `0x...` hex
- `0[0-7]+` octal if length>1 and only octal digits
- else decimal

- [ ] **Step 3: Implement `rc-lexer.js`**

Yield tokens: `IDENT`, `NUMBER` (raw lexeme), `STRING`, `PUNC` (single chars), `BEGIN`, `END`, keywords uppercased optional, `#` directive lines as `DIRECTIVE` with full line text after `#`.

Skip `//` and `/* */`.

- [ ] **Step 4: Tests PASS, commit**

```bash
git add js/engine/rc-expr.js js/engine/rc-lexer.js tests/engine-smoke.html
git commit -m "feat: RC lexer and constant expression evaluator"
```

---

### Task 8: RC parser (DIALOG + defines + opaque)

**Files:**
- Create: `js/engine/rc-parser.js`
- Modify: `tests/engine-smoke.html`
- Create: `samples/resource.h`, `samples/about.rc`

- [ ] **Step 1: Sample files**

```c
/* samples/resource.h */
#define IDD_ABOUT 100
#define IDC_OK 1
#define IDC_CANCEL 2
#define IDC_BLURB 101
```

```rc
#include "resource.h"

IDD_ABOUT DIALOG 20, 20, 180, 80
STYLE DS_MODALFRAME | WS_POPUP | WS_CAPTION | WS_SYSMENU
CAPTION "About"
FONT 8, "MS Sans Serif"
CLASS "bordlg"
BEGIN
  LTEXT "Borland Resource Workshop", IDC_BLURB, 10, 10, 160, 12
  PUSHBUTTON "OK", IDC_OK, 30, 55, 50, 14
  PUSHBUTTON "Cancel", IDC_CANCEL, 100, 55, 50, 14
END
```

- [ ] **Step 2: Parser API**

```js
/**
 * @param {string} text
 * @param {{ resolveInclude?: (path:string)=>string|null, symbols?: Record<string,number> }} [opts]
 * @returns {{ identifiers: {name:string,value:number}[], resources: object[], errors: string[] }}
 */
export function parseRc(text, opts = {}) { ... }
```

Behavior:
- Process `#define` into identifiers / symbols map
- `#include "x"` via `opts.resolveInclude`
- On `IDENT DIALOG|DIALOGEX numbers` parse dialog + controls until END
- Map shortcuts: `PUSHBUTTON` → BUTTON + BS_PUSHBUTTON, `DEFPUSHBUTTON`, `LTEXT`/`CTEXT`/`RTEXT` → STATIC, `EDITTEXT` → EDIT, `LISTBOX`, `COMBOBOX`, `GROUPBOX`, `CONTROL` full form
- Unknown top-level resource: capture from type keyword through matching END as `OpaqueResource`

- [ ] **Step 3: Tests** — parse `about.rc` text (inline string) with symbols from header; expect 1 dialog, 3 controls, class `bordlg`.

- [ ] **Step 4: Commit**

```bash
git add js/engine/rc-parser.js samples tests/engine-smoke.html
git commit -m "feat: RC parser for DIALOG, defines, and opaque blocks"
```

---

### Task 9: RC compiler

**Files:**
- Create: `js/engine/rc-compiler.js`
- Modify: `tests/engine-smoke.html`

- [ ] **Step 1: API**

```js
export function compileHeader(identifierStore) {
  return identifierStore.toHeaderText();
}

/** @param {import('../core/project-model.js').ProjectModel} project */
export function compileRc(project) {
  const lines = ['#include "resource.h"', ""];
  for (const r of project.resources) {
    if (r.type === "DIALOG" || r.type === "DIALOGEX") lines.push(emitDialog(r), "");
    else if (r.rawText) lines.push(r.rawText.trim(), "");
  }
  return lines.join("\n");
}
```

Emit dialog with STYLE as hex or symbolic OR of known flags; controls as CONTROL lines or shortcuts when class/style match.

- [ ] **Step 2: Round-trip test** — parse sample → ProjectModel fill → compileRc → parse again → same control count and dialog id.

Helper to load parse result into model:

```js
export function applyParseToProject(project, parsed, sourceFile) {
  for (const id of parsed.identifiers) project.identifiers.define(id.name, id.value, "resource.h");
  for (const r of parsed.resources) {
    r.sourceFile = sourceFile;
    project.resources.push(r);
  }
  project._emit();
}
```

(Place `applyParseToProject` in `rc-parser.js` or `project-model.js`.)

- [ ] **Step 3: Commit**

```bash
git add js/engine/rc-compiler.js js/engine/rc-parser.js tests/engine-smoke.html
git commit -m "feat: RC compiler and parse→project round-trip"
```

---

### Task 10: Project Window + file open / drag-drop

**Files:**
- Create: `js/windows/project-window.js`, `js/ui/file-io.js`
- Modify: `js/main.js`, `css/editors.css`

- [ ] **Step 1: `file-io.js`**

```js
export function openFilesDialog(accept, multiple = true) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.accept = accept;
    input.onchange = async () => {
      const files = [...(input.files || [])];
      const out = [];
      for (const f of files) {
        const ext = f.name.split(".").pop().toLowerCase();
        if (["res", "bmp", "ico", "cur", "exe", "dll"].includes(ext)) {
          out.push({ name: f.name, kind: ext, buffer: await f.arrayBuffer() });
        } else {
          out.push({ name: f.name, kind: ext, text: await f.text() });
        }
      }
      resolve(out);
    };
    input.click();
  });
}

export function downloadBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function wireDrop(el, onFiles) {
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drop-target"); });
  el.addEventListener("dragleave", () => el.classList.remove("drop-target"));
  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    el.classList.remove("drop-target");
    const files = [...e.dataTransfer.files];
    // same read logic as openFilesDialog
    onFiles(/* mapped */);
  });
}
```

- [ ] **Step 2: Project window UI** — split tree + preview; rebuild tree on `project.subscribe`; double-click dialog → callback `onOpenResource(r)`.

Tree structure By Type:
```
Dialog
  IDD_ABOUT
    [items if filter] IDC_OK ...
Identifiers
  IDC_OK = 1
```

- [ ] **Step 3: Open pipeline in main** — read `.h` first into symbols, parse `.rc` with `resolveInclude` from loaded file map; push files onto `project.files`.

- [ ] **Step 4: Manual: drop samples, see tree. Commit.**

```bash
git commit -am "feat: Project Window with open and drag-drop import"
```

---

### Task 11: Identifiers Window

**Files:**
- Create: `js/windows/identifiers-window.js`
- Modify: `js/main.js`

- [ ] **Step 1: List + detail fields Name, Value, Usage (from `project.recomputeUsage()`).**

- [ ] **Step 2: Edit name → `project.renameIdentifier`; edit value → `identifiers.setValue` + undo command via thin model method `setIdentifierValue`.**

Add to ProjectModel if missing:

```js
setIdentifierValue(name, value) {
  const id = this.identifiers.getByName(name);
  if (!id) return;
  const prev = id.value;
  this.identifiers.setValue(name, value);
  this.undo.push({
    label: "Id value",
    undo: () => { this.identifiers.setValue(name, prev); this._emit(); },
    redo: () => { this.identifiers.setValue(name, value); this._emit(); },
  });
  this._emit();
}
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: Identifiers Window with rename cascade"
```

---

### Task 12: Dialog renderer + control palette

**Files:**
- Create: `js/editors/dialog-renderer.js`, `js/editors/control-palette.js`, `js/editors/bwcc-renderer.js`
- Modify: `css/editors.css`

- [ ] **Step 1: Unit conversion helpers in `dialog-renderer.js`**

```js
export function fontMetrics(font) {
  // approximate System/MS Sans Serif 8 → avgCharW=7, height=16 (tunable)
  const size = font?.size || 8;
  return { avgCharWidth: Math.max(4, Math.round(size * 0.85)), fontHeight: Math.round(size * 2) };
}
export function duToPx(x, y, cx, cy, font) {
  const m = fontMetrics(font);
  return {
    x: Math.round(x * m.avgCharWidth / 4),
    y: Math.round(y * m.fontHeight / 8),
    cx: Math.round(cx * m.avgCharWidth / 4),
    cy: Math.round(cy * m.fontHeight / 8),
  };
}
```

- [ ] **Step 2: `renderDialog(container, dialog, opts)`** — builds DOM for frame + controls; `opts = { interactive:false, selectedIds:Set, scale:1 }`.

Standard control look: gray buttons, sunken edit, groupbox fieldset-like border.

- [ ] **Step 3: BWCC** — if `dialog.className === "bordlg"`, background grid via CSS class `bwcc-canvas`. BorBtn/BorCheck etc. call `paintBorBtn(el, numericId)`.

Glyphs: CSS/Unicode/SVG for check, X, ?, etc. keyed by `STD_ID`.

- [ ] **Step 4: Palette window** — buttons that call `onPickTool(type)` / `onPickControl(def)`.

Control defs:

```js
export const PALETTE = [
  { label: "Push Button", className: "BUTTON", style: WS.CHILD|WS.VISIBLE|WS.TABSTOP, text: "Button", cx: 50, cy: 14 },
  { label: "Edit", className: "EDIT", style: WS.CHILD|WS.VISIBLE|WS.TABSTOP|WS.BORDER, text: "", cx: 80, cy: 14 },
  // ... LTEXT static, checkbox, radio, listbox, combobox, groupbox
  { label: "BorBtn", className: "BorBtn", style: WS.CHILD|WS.VISIBLE|WS.TABSTOP, text: "", cx: 32, cy: 32 },
  // BorRadio, BorCheck, BorShade, BorStatic
];
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: dialog renderer, BWCC chrome, control palette"
```

---

### Task 13: Dialog Editor (select, move, resize, add)

**Files:**
- Create: `js/editors/dialog-editor.js`
- Modify: `js/main.js`, `js/windows/project-window.js` (open editor on double-click)

- [ ] **Step 1: Editor window** — toolbar + canvas host + status line.

- [ ] **Step 2: Tools state** — `select | tab | group | order | test`.

- [ ] **Step 3: Select tool** — mousedown hit-test controls (topmost); drag moves (DU-snapped); handles on selection for resize; commit `moveResizeControl` on mouseup if changed.

- [ ] **Step 4: Adding controls** — when palette selection active, click on canvas places control with new `IDC_*` from `identifiers.nextId("IDC_")`, `project.addControl`.

- [ ] **Step 5: Status** — show DU/px toggle, selection id and rect.

- [ ] **Step 6: Manual QA with sample dialog. Commit.**

```bash
git commit -am "feat: Dialog Editor select/move/resize/add controls"
```

---

### Task 14: Dialog tools + Window Style modal

**Files:**
- Create: `js/editors/dialog-styles.js`
- Modify: `js/editors/dialog-editor.js`

- [ ] **Step 1: Tab Set** — click assigns increasing tabIndex; visual numbers overlay.

- [ ] **Step 2: Set Groups** — toggle `groupStart` + OR/clear `WS.GROUP` on style.

- [ ] **Step 3: Set Order** — click reorders array (bring to index sequence).

- [ ] **Step 4: Duplicate** — clone selected with +8,+8 DU offset, new ids.

- [ ] **Step 5: Style dialog** — modal via WindowManager; fields for id, text, className, checkboxes for common styles; OK applies `setControlProps` / `setDialogProps`.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: dialog tab/group/order tools and style dialog"
```

---

### Task 15: DLGTEMPLATE pack/unpack

**Files:**
- Create: `js/engine/dlg-template.js`
- Modify: `tests/engine-smoke.html`

- [ ] **Step 1: Tests** — build a minimal dialog with 1 button; `pack` → `unpack` → equal id, title, control count, styles.

- [ ] **Step 2: Implement binary layout** (little-endian DataView):

**DLGTEMPLATE (simplified classic):**
- DWORD style, DWORD exStyle, WORD cdit, short x,y,cx,cy
- sz_Or_Ord menu, class, title (Unicode strings: WORD length encoding — use Windows resource string format: if 0x0000 empty; if 0xFFFF next WORD is ordinal; else UTF-16Z)
- if DS_SETFONT: WORD pointsize, Unicode face name
- align each item to DWORD
- **DLGITEMTEMPLATE:** DWORD style, DWORD exStyle, short x,y,cx,cy, WORD id, class, title, WORD cbCreationData

Class atoms for standard controls; string for `BorBtn` etc.

- [ ] **Step 3: Prefer packing classic DLGTEMPLATE (not EX) in Phase 1 for simpler writer; reader supports both if signature indicates EX.**

Detection EX: first WORD == 1 and second WORD == 0xFFFF is common pattern for DLGTEMPLATEEX — implement reader branch; writer can emit classic only.

- [ ] **Step 4: Commit**

```bash
git add js/engine/dlg-template.js tests/engine-smoke.html
git commit -m "feat: DLGTEMPLATE pack/unpack for dialogs"
```

---

### Task 16: ResReader + ResWriter

**Files:**
- Create: `js/engine/res-reader.js`, `js/engine/res-writer.js`
- Modify: `tests/engine-smoke.html`, `js/ui/file-io.js`, `js/main.js`

- [ ] **Step 1: RES format notes (32-bit)**

Each resource:
```
DWORD DataSize
DWORD HeaderSize
[ type: NAMEINFO — ord or string ]
[ name: NAMEINFO ]
DWORD DataVersion (0)
WORD MemoryFlags
WORD LanguageId
DWORD Version (0)
DWORD Characteristics (0)
byte data[DataSize] // padded to DWORD
```

HeaderSize includes from DataSize through end of header. Type/name: if WORD==0xFFFF, next WORD is id; else Unicode Z string.

- [ ] **Step 2: Reader** — iterate; for type 5 parse dlg-template; else store BinaryResource.

- [ ] **Step 3: Writer** — emit all dialogs + binary pass-throughs; optional empty marker resource at start (some tools use 0-size null resource — skip unless needed).

- [ ] **Step 4: Round-trip test** pack dialog → write res → read res → one dialog.

- [ ] **Step 5: Wire Open `.res` in main. Commit.**

```bash
git commit -am "feat: Win32 .res reader and writer for RT_DIALOG"
```

---

### Task 17: Save Project + app-state

**Files:**
- Create: `js/core/app-state.js`
- Modify: `js/main.js`, `js/ui/file-io.js`

- [ ] **Step 1: Save Project**

```js
async function saveProject(project) {
  const h = compileHeader(project.identifiers);
  const rc = compileRc(project);
  const res = writeRes(project); // ArrayBuffer
  downloadBlob("resource.h", new Blob([h], { type: "text/plain" }));
  downloadBlob(`${project.name || "project"}.rc`, new Blob([rc], { type: "text/plain" }));
  downloadBlob(`${project.name || "project"}.res`, new Blob([res], { type: "application/octet-stream" }));
}
```

- [ ] **Step 2: Save File As / Resource Save As** — single download of current focus file or selected resource as mini RC fragment.

- [ ] **Step 3: `app-state.js`**

```js
const KEY = "brw.desktop.v1";
export function saveDesktop(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
export function loadDesktop() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
  catch { return null; }
}
```

Persist: window layout, undoLimit, unitMode, sortMode, filters. On boot apply layout after creating known windows (project, identifiers, palette).

- [ ] **Step 4: beforeunload save desktop. Commit.**

```bash
git commit -am "feat: Save Project (.rc/.h/.res) and desktop localStorage"
```

---

### Task 18: Test Dialog mode + About + acceptance polish

**Files:**
- Modify: `js/editors/dialog-editor.js`, `js/main.js`
- Create: help About dialog resource in-memory or use sample

- [ ] **Step 1: Test mode** — open modal window rendering dialog with `interactive:true`; buttons close test on IDOK/IDCANCEL; focus cycle Tab; for BorBtn log `console.debug("BBN_SETFOCUS", id)` on focus.

- [ ] **Step 2: Help → About** — open sample `IDD_ABOUT` style dialog via Test renderer or real modal.

- [ ] **Step 3: Keyboard shortcuts** — Ctrl+Z undo, Ctrl+Y redo, Delete remove controls when editor focused.

- [ ] **Step 4: Walk acceptance criteria §10 in design spec; fix blockers.**

Checklist:
1. Desktop + menu + project + palette  
2. Open sample rc/h → tree  
3. Dialog editor edit controls  
4. bordlg + BorBtn glyphs  
5. Identifier rename  
6. Save rc/h  
7. Save/open res  
8. Undo 10  
9. Test dialog  
10. Window positions after F5  

- [ ] **Step 5: Final commit**

```bash
git commit -am "feat: Test Dialog mode and Phase 1 acceptance polish"
```

---

## Self-review (plan vs spec)

| Spec area | Tasks |
|-----------|-------|
| 3-layer architecture + file map | Tasks 1–4, 5–6 structure |
| IdentifierStore + cascade | 3, 11 |
| UndoStack 10–99 | 2, 4 |
| Project Window filters/preview | 10 (filters UI), 12 (preview uses renderer) |
| Dialog Editor tools | 13–14, 18 |
| BWCC bordlg + glyphs | 12 |
| RC lexer/parser/compiler | 7–9 |
| Preprocessor basic | 8 (`#define`, `#include`; simple ifdef if time — implement `#ifdef` skip blocks in parser) |
| .RES RT_DIALOG | 15–16 |
| WindowManager MDI | 5 |
| localStorage desktop | 17 |
| Save Project | 17 |
| Test Dialog + BBN log | 18 |
| Opaque RC preserve | 8–9 |
| Binary pass-through | 16 |
| Samples | 8 |

**Gaps closed in plan:** `#ifdef` simple support noted in Task 8 — implement as: when condition false, skip tokens until matching `#endif` (no nested elif required for Phase 1 samples).

**Type consistency:** `DialogResource`, `Control`, `ProjectModel` methods named as in Task 4 used throughout later tasks.

**Placeholders:** none intentional; implementers must expand CSS/menu labels fully but APIs are specified.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-07-21-borland-resource-workshop.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with checkpoints  

Which approach?
