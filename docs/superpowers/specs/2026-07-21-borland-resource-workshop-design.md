# Borland Resources Workshop (Web) — Design Spec (Phase 1)

**Date:** 2026-07-21  
**Status:** Approved for implementation planning  
**Source requirements:** `prompt-borland-resource-workshop.md`  
**Stack:** HTML5 / CSS3 / JavaScript (ES modules), local-first, zero backend  

---

## 1. Goal

Build a browser-based clone of classic **Borland Resource Workshop** (aesthetic and workflow of v5.02 / OS/2 1.5 era): a single-page IDE for Windows resource scripts and binary `.RES` files, with a retro chiseled-steel UI.

Phase 1 delivers a **usable MVP** focused on:

- Win95/OS2-style shell (MDI windows, menus, speedbar)
- Project Window + Identifiers Window
- Visual **Dialog Editor** (standard controls + BWCC subset)
- **RC text** parser/compiler (DIALOG subset + `#define` / `#include`)
- **Win32 `.RES`** read/write for `RT_DIALOG`

Later phases (out of scope for this document’s implementation plan): Menu/Accelerator/String editors, bitmap/icon/cursor/font paint, EXE/DLL/NE/PE, full C preprocessor, RWP cache.

---

## 2. Architecture

### 2.1 Layers

```
UI Layer        WindowManager, Menubar, Speedbar, ProjectWindow,
                IdentifiersWindow, DialogEditor, ControlPalette
       ↓↑
State Layer     ProjectModel, IdentifierStore, UndoStack, AppState
       ↓↑
Engine Layer    RcLexer, RcParser, RcCompiler, ResReader, ResWriter,
                DlgTemplate, Constants (WS_*, RT_*, control atoms)
```

**Data flow**

1. **Open** `.rc` / `.h` / `.res` → Engine parse → `ProjectModel`
2. **Edit** via UI → model mutations only through ProjectModel APIs → `UndoStack`
3. **Save** → Engine serialize → `.rc` + `.h` and/or `.res` (download or File System Access API)

### 2.2 Module layout (ES modules, no bundler in Phase 1)

```
index.html
css/
  theme-win95.css
  windows.css
  editors.css
js/
  main.js
  core/
    constants.js
    project-model.js
    identifiers.js
    undo-stack.js
    app-state.js
  engine/
    rc-lexer.js
    rc-parser.js
    rc-compiler.js
    res-reader.js
    res-writer.js
    dlg-template.js
  ui/
    window-manager.js
    menubar.js
    speedbar.js
    desktop.js
  windows/
    project-window.js
    identifiers-window.js
  editors/
    dialog-editor.js
    control-palette.js
    dialog-styles.js
    bwcc-renderer.js
```

- Entry: `index.html` loads `js/main.js` as `type="module"`.
- No npm dependencies required for Phase 1.
- Serve via any static HTTP server (ES modules need non-`file://` origins for broad browser support).

### 2.3 Cross-layer contracts

| From → To | Contract |
|-----------|----------|
| Engine → State | Plain objects: `DialogResource`, `Control`, `Identifier`, `OpaqueResource` |
| State → UI | ProjectModel is source of truth; UI subscribes via `subscribe(listener)` / change events |
| UI → State | Mutations only through model methods (`addControl`, `setDialogProps`, …) that push undo commands |

**Editor registry (light plugin hook):** `openEditor(resource)` maps `DIALOG` / `DIALOGEX` → DialogEditor. Other types show “not editable in Phase 1” or raw placeholder.

---

## 3. Data model

### 3.1 Identifier

```
Identifier {
  name: string           // e.g. IDD_ABOUT, IDC_OK
  value: number
  usage: string[]        // e.g. ["DIALOG:IDD_ABOUT"] or ["(unused)"]
  sourceFile: string     // e.g. resource.h
}
```

**Auto-prefix rules (create):**

| Kind | Prefix |
|------|--------|
| Dialog | `IDD_` |
| Control | `IDC_` |
| String (reserved later) | `IDS_` |
| Menu/Accel (reserved later) | `CM_` |

**Rename cascade:** changing `name` or `value` updates all in-memory references (dialog id, control ids, usage lists). Header text is regenerated on save from IdentifierStore.

### 3.2 Project

```
Project {
  name: string
  files: ProjectFile[]
  identifiers: Identifier[]
  resources: Resource[]
  sortMode: "byType" | "byFile"
  filters: {
    showResources: boolean
    showIdentifiers: boolean
    showItems: boolean      // outline of dialog controls in tree
    showUnusedTypes: boolean
  }
}

ProjectFile {
  path: string
  kind: "rc" | "h" | "res" | "bmp" | "ico" | "cur" | "other"
  content?: string | ArrayBuffer
}
```

### 3.3 Resources

```
Resource (base) {
  id: string | number
  type: string              // "DIALOG" | "DIALOGEX" | "MENU" | ...
  memoryFlags: string[]     // MOVEABLE, DISCARDABLE, LOADONCALL, …
  sourceFile?: string
}

DialogResource extends Resource {
  type: "DIALOG" | "DIALOGEX"
  x, y, cx, cy: number      // dialog units
  style: number
  exStyle: number
  title: string
  font?: { name: string, size: number, weight?: number, italic?: boolean }
  className?: string        // "bordlg" enables BWCC canvas chrome
  menu?: string | number
  controls: Control[]
}

Control {
  id: string | number
  className: string         // BUTTON, EDIT, STATIC, LISTBOX, COMBOBOX,
                            // BorBtn, BorRadio, BorCheck, BorShade, BorStatic
  text: string
  x, y, cx, cy: number
  style: number
  exStyle: number
  tabIndex: number
  groupStart: boolean       // WS_GROUP
}

OpaqueResource extends Resource {
  rawText: string           // unparsed RC block for round-trip
}
```

Non-dialog resource types found in `.rc` are stored as `OpaqueResource` so save does not destroy them. They are not visually editable in Phase 1.

### 3.4 Undo

```
UndoStack {
  limit: number             // default 10, max 99
  push(command: { undo(), redo(), label: string })
  undo(), redo()
  canUndo, canRedo
}
```

Atomic commands include: `AddControl`, `RemoveControl`, `MoveResizeControl`, `SetControlProps`, `SetDialogProps`, `AddIdentifier`, `RenameIdentifier`, `SetIdentifierValue`.

---

## 4. Dialog Editor

### 4.1 Window chrome

- Title: `Dialog - <id>`
- Toolbar: Select, Tab Set, Set Groups, Set Order, Test Dialog, Duplicate, Undo
- Canvas: dialog frame + controls
- Status line: unit mode (Dialog | Screen), position/size, selected id

### 4.2 Tools

| Tool | Behavior |
|------|----------|
| Select | Click select; drag move; handles resize; Shift multi-select |
| Tab Set | Sequential clicks assign `tabIndex` |
| Set Groups | Click marks control `groupStart` / `WS_GROUP` |
| Set Order | Show order indices; reorder `controls[]` |
| Test | Live modal test of dialog; basic focus/keyboard; log BWCC notify stubs (`BBN_SETFOCUS`, `BBN_SETFOCUSMOUSE`, `BBN_GOTATAB`, `BBN_GOTABTAB`) when applicable |
| Duplicate | Clone selection with pixel/DU offset |
| Undo | UndoStack |

**Units:** toggle Dialog units ↔ Screen pixels.

Approximate conversion (System font metrics of dialog font, default ~8pt):

- `pxX ≈ duX * (avgCharWidth / 4)`
- `pxY ≈ duY * (fontHeight / 8)`

### 4.3 Control palette

**Standard:** Push button, Default push button, Radio, Check, Group box, Combo, List, Edit, Static (text, icon frame, black/gray/etched rects).

**BWCC:** BorShade, BorBtn, BorRadio, BorCheck, BorStatic.  
When dialog `className === "bordlg"`, canvas background uses classic chiseled-steel fine grid (light lines on gray).

**BorBtn glyphs by numeric control ID** (when no project bitmap):

| ID | Constant | Glyph |
|----|----------|--------|
| 1 | IDOK | Green check |
| 2 | IDCANCEL | Red X |
| 3 | IDABORT | Panic |
| 4 | IDRETRY | Slot machine |
| 5 | IDIGNORE | 55 mph sign |
| 6 | IDYES | Green check |
| 7 | IDNO | Red circle/slash |
| 998 | IDHELP | Blue question mark |

Bitmap ID offset scheme (+1000 VGA standard, +2000 EGA, +3000 pressed, etc.) is **stubbed**: if matching bitmap resource exists later, use it; Phase 1 falls back to glyphs.

### 4.4 Window Style dialog

Opened by double-click on dialog chrome or control. Modal form:

- ID (symbolic or numeric)
- Caption / text
- Class
- Checkboxes for relevant `WS_*`, `DS_*`, `BS_*`, `ES_*`, `SS_*`, `CBS_*`, `LBS_*` flags
- Apply writes through ProjectModel + undo

### 4.5 Project preview

Selecting a dialog in the Project tree paints a read-only scaled preview in the right split pane using the same control renderer as the editor.

---

## 5. RC engine

### 5.1 Lexer

Tokens: identifiers, numbers (decimal, `0x` hex, **leading-zero octal in numeric expressions**), strings with `\"`, `\\`, `\t`, operators `| + - * / ( )`, punctuation `,`, keywords (`DIALOG`, `DIALOGEX`, `BEGIN`, `END`, `{`, `}`, `CONTROL`, `STYLE`, `CAPTION`, `FONT`, `CLASS`, `MENU`, `LANGUAGE`, `PUSHBUTTON`, `DEFPUSHBUTTON`, `EDITTEXT`, `LTEXT`, `RTEXT`, `CTEXT`, `LISTBOX`, `COMBOBOX`, `GROUPBOX`, `AUTOCHECKBOX`, `AUTORADIOBUTTON`, …), preprocessor lines starting with `#`.

Comments `//` and `/* */` are stripped and **not** re-emitted on compile (classic RW-like behavior).

### 5.2 Preprocessor (Phase 1)

| Directive | Support |
|-----------|---------|
| `#define NAME value` | Yes → IdentifierStore |
| `#include "file"` | Yes if file is in project or resolvable from user-provided file map |
| `#undef NAME` | Yes only if identifier has no usage |
| `#ifdef` / `#ifndef` / `#if` / `#elif` / `#else` / `#endif` | Simple: defined() and integer constants; nested best-effort |

**Constant expressions:** allowed wherever a number is expected. Trailing/floating operators (e.g. `WS_CHILD |`) are syntax errors.

**Octal note:** In preprocessor/expression math, `010 + 1` → `9`. String-table IDs (future) use decimal for leading zeros; Phase 1 has no string table editor.

### 5.3 DIALOG grammar (supported subset)

```
<id> DIALOG[EX] <x>, <y>, <cx>, <cy>
[STYLE <expr>]
[EXSTYLE <expr>]
[CAPTION "<text>"]
[FONT <size>, "<name>" [, <weight>, <italic>]]
[CLASS "<name>"]
[MENU <id>]
BEGIN
  <control-line>...
END
```

Control lines: full `CONTROL` form and common shortcuts (`PUSHBUTTON`, `EDITTEXT`, `LTEXT`, …). Shortcuts normalize to internal `Control` with appropriate class/style.

### 5.4 Opaque resources

`MENU`, `ACCELERATORS`, `STRINGTABLE`, `BITMAP`, `ICON`, `CURSOR`, `RCDATA`, custom types: parse as brace-matched (or BEGIN/END) blocks into `OpaqueResource.rawText` for re-emit.

### 5.5 RC compiler output

- Emit `#define` block from IdentifierStore (stable sort by name or value — **by name** for Phase 1)
- Emit each `DialogResource` in canonical form
- Re-emit `OpaqueResource` blocks unchanged
- No comment preservation

---

## 6. Binary .RES (Win32)

### 6.1 Reader

- Parse aligned resource headers (`DataSize`, `HeaderSize`, type, name, `MemoryFlags`, `LanguageId`, data blob)
- Type/name: numeric id or Unicode string
- For type `RT_DIALOG` (5): `DlgTemplate.parse(data)`

### 6.2 DLGTEMPLATE

- Detect `DLGTEMPLATEEX` vs `DLGTEMPLATE` (EX signature / version field)
- Map menu, class, title, font
- Each item: styles, id, class atom (`0x0080` button … `0x0085` combo) or string class (BWCC names), title, optional creation data
- Produce `DialogResource` + `Control[]`

### 6.3 Writer

- Emit 32-bit `.res` with 4-byte alignment
- At least all project dialogs as `RT_DIALOG`
- Default language `0x0409` if unspecified
- Optional: pass-through of non-dialog resources read from an input `.res` if retained in model as binary blobs (recommended: `BinaryResource { typeId, nameId, language, data: ArrayBuffer }` for round-trip fidelity)

### 6.4 Explicit non-goals (Phase 1)

- NE/PE/EXE/DLL extraction
- Editing RT_MENU / RT_ACCELERATOR / RT_STRING in binary (except pass-through)
- 16-bit SEGEXE resource formats

---

## 7. UI shell

### 7.1 Theme

- Desktop background: classic gray `#808080` (optional teal `#008080` later)
- Face: `#c0c0c0`
- Bevels: 1–2px light (`#ffffff`) / dark (`#808080`, `#000000`) borders
- Font: `"MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif`, ~11–12px
- Speedbar icons: simple 16×16 CSS or inline SVG

### 7.2 WindowManager

Each window: `id`, `title`, `x`, `y`, `w`, `h`, `zIndex`, `state: "normal" | "min" | "max"`.

- Drag title bar; resize edges/corners
- Double-click title toggles maximize
- Click focuses and raises z-order
- Minimize docks to a simple bottom task strip
- Modal windows block interaction underneath

**Default open windows:** Project, Identifiers (optional toggle), Control Palette, plus Dialog Editor instances and Style modal as needed.

### 7.3 Menus (Phase 1 subset)

- **File:** New Project, Open…, Save Project, Save File As, Resource Save As, Exit (reset/clear)
- **Edit:** Undo, Redo, Cut, Copy, Paste (controls when Dialog Editor focused)
- **Resource:** New Dialog, Identifiers…
- **Window:** Cascade, Tile, list of open windows
- **Help:** About

### 7.4 Desktop persistence (`localStorage`)

```
{
  windows: [{ id, x, y, w, h, state }],
  lastPaths: string[],
  undoLimit: 10,
  unitMode: "dialog" | "screen",
  projectSortMode: "byType" | "byFile",
  filters: { … }
}
```

Mimics classic `.DSK` restore at a basic level (no full file path rehydrate without user re-open of files).

### 7.5 File I/O

- Open: `<input type="file" multiple>` and drag-and-drop onto Project Window
- Save: `Blob` download; use **File System Access API** when available to write in place
- **Save Project:** write `.rc` + companion `.h` + compiled `.res`
- **Resource Save As:** single selected resource to standalone file (`.dlg` text or single-resource conventions as appropriate — Phase 1: export one dialog as mini `.rc` fragment and/or contribute to `.res`)

---

## 8. Project Window

- Modeless tree sorted **By Type** (default) or **By File**
- Filters: Show Resources, Show Identifiers, Show Items, Show Unused Types
- Split pane: tree left, live preview right
- Drag-and-drop import: `.rc`, `.res`, `.h`, `.rh`, `.bmp`, `.ico`, `.cur` (images stored as files for future; Phase 1 may only list them)

---

## 9. Identifiers Window

- Fields: Name, Value, Usage
- Sync to header on save (`#define`)
- Create/delete/rename with cascade
- Usage recomputed when resources change

---

## 10. Phase 1 acceptance criteria

1. SPA loads with Win95-style desktop, menu, speedbar, Project window, Control palette.
2. Open or drop sample `.rc` + `.h` populates project tree By Type.
3. Double-click dialog opens Dialog Editor; move/resize controls; add from palette (standard + BWCC).
4. `CLASS "bordlg"` shows chiseled grid; BorBtn IDs 1/2 show check/X glyphs.
5. Identifiers window lists defines; rename updates control references.
6. Save Project produces coherent `.rc` + `.h` (DIALOG round-trip for supported subset).
7. Save/Open `.res` preserves editable dialogs (`RT_DIALOG`).
8. Undo/Redo works for dialog edits with default 10 levels.
9. Test Dialog shows a basically interactive dialog.
10. Window positions restore after reload (localStorage).

---

## 11. Testing strategy

- **Unit tests (optional lightweight):** pure functions in engine — lexer tokens, expression eval (incl. octal), DLGTEMPLATE pack/unpack round-trip — runnable in browser console or small HTML test page `tests/engine-smoke.html`.
- **Manual fixtures:** `samples/about.rc` + `samples/resource.h` with a BWCC-style dialog and standard controls.
- **Manual QA checklist:** maps 1:1 to acceptance criteria §10.

No CI requirement in Phase 1.

---

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| DLGTEMPLATEEX edge cases / alignment bugs | Golden binary fixtures; compare sizes and re-open in editor |
| Font metrics mismatch vs real Windows DU | Document approximation; allow Screen unit editing |
| Large RC files with heavy preprocessor | Fail soft with parse error panel; preserve raw file in ProjectFile |
| Scope creep into paint/menus | Hard deferral list in §1 and §6.4 |

---

## 13. Implementation order (high level)

1. Shell: theme + WindowManager + desktop + menus  
2. ProjectModel + UndoStack + Identifiers  
3. Project Window + file open/drag-drop  
4. RC lexer/parser/compiler (DIALOG + defines) + sample  
5. Dialog Editor + palette + styles dialog  
6. BWCC renderer subset  
7. DlgTemplate + ResReader/ResWriter  
8. Save Project wiring + localStorage desktop  
9. Test Dialog mode + polish acceptance checklist  

Detailed task breakdown belongs in the implementation plan (next artifact).

---

## 14. Decisions log

| Decision | Choice |
|----------|--------|
| Phase 1 scope | Shell + Project + Dialog Editor + RC + .RES dialogs |
| Packaging | Separate ES modules (not single-file HTML) |
| Architecture | Classic 3 layers + light editor registry |
| Opaque non-dialog RC | Preserve raw text for round-trip |
| Dependencies | None (vanilla JS) |
| Binary scope | Win32 `.res` RT_DIALOG; no PE/NE |

---

*End of Phase 1 design spec.*
