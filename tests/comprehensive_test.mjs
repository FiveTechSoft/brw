import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { WS, BS, STD_ID, DS } from "../js/core/constants.js";
import { ProjectModel, defaultControl } from "../js/core/project-model.js";
import { parseRc, applyParseToProject } from "../js/engine/rc-parser.js";
import { compileRc, compileHeader } from "../js/engine/rc-compiler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===== Step 1: Generate a rich RC =====
console.log("=== Step 1: Generate test RC ===\n");

const rcSource = `#include "resource.h"

#define IDD_MAIN     100
#define IDD_OPTIONS  101
#define IDD_ABOUT    102
#define IDC_OK         1
#define IDC_CANCEL     2
#define IDC_NAME      10
#define IDC_ENABLE    11
#define IDC_COLOR     12
#define IDC_RED       20
#define IDC_GREEN     21
#define IDC_BLUE      22
#define IDC_SAVE      30
#define IDC_LOAD      31
#define IDC_HELP      40

IDD_MAIN DIALOG 10, 10, 300, 200
STYLE DS_MODALFRAME | WS_CAPTION | WS_SYSMENU | WS_POPUP
CAPTION "Main Window"
FONT 8, "MS Sans Serif"
BEGIN
    GROUPBOX "User Info", -1, 10, 10, 280, 50
    LTEXT "Name:", -1, 20, 28, 30, 10
    EDITTEXT IDC_NAME, 55, 25, 100, 14
    CONTROL "Enabled", IDC_ENABLE, "BUTTON", BS_AUTOCHECKBOX | WS_CHILD | WS_VISIBLE | WS_TABSTOP, 170, 26, 60, 12
    GROUPBOX "Colors", -1, 10, 65, 280, 70
    CONTROL "Red", IDC_RED, "BUTTON", BS_AUTORADIOBUTTON | WS_CHILD | WS_VISIBLE | WS_GROUP | WS_TABSTOP, 20, 80, 60, 12
    CONTROL "Green", IDC_GREEN, "BUTTON", BS_AUTORADIOBUTTON | WS_CHILD | WS_VISIBLE | WS_TABSTOP, 20, 95, 60, 12
    CONTROL "Blue", IDC_BLUE, "BUTTON", BS_AUTORADIOBUTTON | WS_CHILD | WS_VISIBLE | WS_TABSTOP, 20, 110, 60, 12
    PUSHBUTTON "OK", IDC_OK, 50, 155, 50, 14
    PUSHBUTTON "Cancel", IDC_CANCEL, 120, 155, 50, 14
    PUSHBUTTON "Help", IDC_HELP, 190, 155, 50, 14
END

IDD_OPTIONS DIALOG 30, 30, 220, 160
STYLE WS_CAPTION | WS_POPUP | WS_SYSMENU | DS_MODALFRAME
CAPTION "Options"
FONT 8, "MS Sans Serif"
BEGIN
    GROUPBOX "Behaviour", -1, 10, 10, 200, 60
    CONTROL "Save on exit", IDC_SAVE, "BUTTON", BS_AUTOCHECKBOX | WS_CHILD | WS_VISIBLE | WS_TABSTOP, 20, 25, 100, 12
    CONTROL "Load last file", IDC_LOAD, "BUTTON", BS_AUTOCHECKBOX | WS_CHILD | WS_VISIBLE | WS_TABSTOP, 20, 42, 100, 12
    GROUPBOX "Appearance", -1, 10, 75, 200, 50
    LTEXT "Theme:", -1, 20, 92, 35, 10
    COMBOBOX IDC_COLOR, 60, 90, 120, 80, CBS_DROPDOWNLIST | WS_CHILD | WS_VISIBLE | WS_TABSTOP
    PUSHBUTTON "OK", IDC_OK, 60, 135, 50, 14
    PUSHBUTTON "Cancel", IDC_CANCEL, 130, 135, 50, 14
END

IDD_ABOUT DIALOG 50, 50, 200, 100
STYLE DS_MODALFRAME | WS_CAPTION | WS_SYSMENU | WS_POPUP
CAPTION "About"
FONT 8, "MS Sans Serif"
BEGIN
    ICON "", -1, 10, 10, 16, 16
    LTEXT "My App v1.0", -1, 35, 15, 130, 10
    LTEXT "Copyright (c) 2026", -1, 35, 30, 130, 10
    DEFPUSHBUTTON "OK", IDC_OK, 75, 75, 50, 14
END

IDR_MENU1 MENU
BEGIN
    POPUP "&File"
    BEGIN
        MENUITEM "&New", 100
        MENUITEM "&Open...", 101
        MENUITEM "&Save", 102
        MENUITEM SEPARATOR
        MENUITEM "E&xit", 103
    END
    POPUP "&Edit"
    BEGIN
        MENUITEM "Cu&t", 200
        MENUITEM "&Copy", 201
        MENUITEM "&Paste", 202
    END
    POPUP "&Help"
    BEGIN
        MENUITEM "&About...", 400
    END
END

STRINGTABLE
BEGIN
    1, "Application title"
    2, "Error: file not found"
    3, "Are you sure you want to exit?"
    4, "Settings saved"
END
`;

const header = `#define IDD_MAIN     100
#define IDD_OPTIONS  101
#define IDD_ABOUT    102
#define IDC_OK         1
#define IDC_CANCEL     2
#define IDC_NAME      10
#define IDC_ENABLE    11
#define IDC_COLOR     12
#define IDC_RED       20
#define IDC_GREEN     21
#define IDC_BLUE      22
#define IDC_SAVE      30
#define IDC_LOAD      31
#define IDC_HELP      40
`;

console.log("Generated RC source (" + rcSource.length + " chars) with:");
console.log("  - 3 dialogs (MAIN, OPTIONS, ABOUT)");
console.log("  - 1 MENU (IDR_MENU1)");
console.log("  - 1 STRINGTABLE");

// ===== Step 2: Parse =====
console.log("\n=== Step 2: Parse RC ===");
const parsed = parseRc(rcSource, {
  resolveInclude: (p) => (p === "resource.h" || p.endsWith("resource.h") ? header : null),
});
if (parsed.errors.length) {
  console.log("Parse errors:", parsed.errors);
  process.exit(1);
}
console.log("Resources:", parsed.resources.length);
console.log("Identifiers:", parsed.identifiers.length);
for (const r of parsed.resources) {
  const ctl = r.controls ? r.controls.length : (r.rawText ? "raw" : "?");
  console.log("  " + r.type + " " + r.id + " (" + ctl + ")");
}

// ===== Step 3: Apply to project =====
console.log("\n=== Step 3: Apply to project ===");
const project = new ProjectModel();
applyParseToProject(project, parsed, "test.rc");
const dialogs = project.dialogs();
const menus = project.resources.filter((r) => r.type === "MENU");
const strings = project.resources.filter((r) => r.type === "STRINGTABLE");
console.log("Dialogs:", dialogs.length);
console.log("Menus:", menus.length);
console.log("Stringtables:", strings.length);

// ===== Step 4: Make modifications =====
console.log("\n=== Step 4: Modify ===");

// 4a. Change MAIN dialog title and size
const mainDlg = dialogs.find((d) => d.id === "IDD_MAIN");
mainDlg.title = "Main Window - Modified";
mainDlg.cx = 350;
mainDlg.cy = 250;
console.log("  Modified IDD_MAIN: title, size -> 350x250");

// 4b. Add a new control to MAIN
const { name: newId, value: newVal } = project.identifiers.nextId("IDC_NOTES");
project.identifiers.define(newId, newVal);
const notes = defaultControl({
  id: newId, className: "EDIT", text: "Notes here",
  x: 20, y: 135, cx: 150, cy: 40,
  style: WS.CHILD | WS.VISIBLE | WS.TABSTOP | 0x0800 /* ES_MULTILINE? */,
});
project.addControl(mainDlg, notes);
console.log("  Added control " + newId + " (EDIT) to IDD_MAIN");

// 4c. Remove Help button from MAIN (last control)
const helpBtn = mainDlg.controls.find((c) => c.id === "IDC_HELP");
if (helpBtn) {
  project.removeControls(mainDlg, [helpBtn]);
  console.log("  Removed IDC_HELP from IDD_MAIN");
}

// 4d. Change OPTIONS dialog caption
const optDlg = dialogs.find((d) => d.id === "IDD_OPTIONS");
if (optDlg) {
  optDlg.title = "Preferences";
  optDlg.exStyle = 0x10000; // WS_EX_TOOLWINDOW
  console.log("  Modified IDD_OPTIONS: title, exStyle");
}

// 4e. Rename identifier
project.renameIdentifier("IDD_ABOUT", "IDD_ABOUT_BOX");
console.log("  Renamed IDD_ABOUT -> IDD_ABOUT_BOX");

// ===== Step 5: Save (compile) =====
console.log("\n=== Step 5: Save RC ===");
const rcOut = compileRc(project);
const hdrOut = compileHeader(project.identifiers);
console.log("RC output:", rcOut.length, "chars");
console.log("Header output:", hdrOut.length, "chars");

// Show first 1200 chars
console.log("\n--- RC output (first 1200 chars) ---");
console.log(rcOut.substring(0, 1200));
console.log("...");

// ===== Step 6: Verify (re-parse saved output) =====
console.log("\n=== Step 6: Verify by re-parsing ===");
const parsed2 = parseRc(rcOut, {
  resolveInclude: (p) => (p === "resource.h" || p.endsWith("resource.h") ? hdrOut : null),
  symbols: Object.fromEntries(project.identifiers.list().map((i) => [i.name, i.value])),
});
if (parsed2.errors.length) {
  console.log("Re-parse errors:", parsed2.errors);
  process.exit(1);
}
console.log("Resources after re-parse:", parsed2.resources.length);

// Verify dialogs
const dlg2 = parsed2.resources.filter((r) => r.type === "DIALOG" || r.type === "DIALOGEX");
console.log("Dialogs:", dlg2.length);

for (const d of dlg2) {
  console.log("  " + d.id + " (" + d.title + ") " + d.cx + "x" + d.cy + " controls:" + d.controls.length);
  for (const c of d.controls) {
    console.log("    " + c.className + " " + c.id + " '" + (c.text || "") + "'");
  }
}

// Checks
const main2 = dlg2.find((d) => d.id === "IDD_MAIN");
if (!main2) { console.log("ERROR: IDD_MAIN not found!"); process.exit(1); }
if (main2.title !== "Main Window - Modified") { console.log("ERROR: title mismatch"); process.exit(1); }
if (main2.cx !== 350 || main2.cy !== 250) { console.log("ERROR: size mismatch"); process.exit(1); }
if (main2.controls.length !== 11) { console.log("ERROR: expected 11 controls, got " + main2.controls.length); process.exit(1); }
const hasNotes = main2.controls.some((c) => String(c.id) === String(newVal) || String(c.id) === newId);
if (!hasNotes) { console.log("ERROR: new control " + newId + " not found!"); process.exit(1); }
const hasHelp = main2.controls.some((c) => String(c.id) === "IDC_HELP");
if (hasHelp) { console.log("ERROR: IDC_HELP should have been removed!"); process.exit(1); }

const opt2 = dlg2.find((d) => d.id === "IDD_OPTIONS");
if (!opt2) { console.log("ERROR: IDD_OPTIONS not found!"); process.exit(1); }
if (opt2.title !== "Preferences") { console.log("ERROR: Options title mismatch"); process.exit(1); }

const about2 = dlg2.find((d) => d.id === "IDD_ABOUT_BOX");
if (!about2) { console.log("ERROR: IDD_ABOUT_BOX not found!"); process.exit(1); }

// Verify menu preserved
const menu2 = parsed2.resources.filter((r) => r.type === "MENU");
if (menu2.length !== 1) { console.log("ERROR: expected 1 menu"); process.exit(1); }
if (!menu2[0].rawText.includes("POPUP")) { console.log("ERROR: menu raw text lost"); process.exit(1); }
console.log("Menu preserved: OK");

// Verify stringtable preserved
const str2 = parsed2.resources.filter((r) => r.type === "STRINGTABLE");
if (str2.length !== 1) { console.log("ERROR: expected 1 stringtable"); process.exit(1); }
if (!str2[0].rawText.includes("Application title")) { console.log("ERROR: string table text lost"); process.exit(1); }
console.log("Stringtable preserved: OK");

console.log("\n=== ALL CHECKS PASSED ===");

// Save files
const outDir = join(__dirname, "_test_output");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "generated_test.rc"), rcOut, "utf8");
writeFileSync(join(outDir, "generated_test.h"), hdrOut, "utf8");
console.log("Saved to", outDir);
