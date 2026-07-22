import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { WS, BS, STD_ID } from "../js/core/constants.js";
import { ProjectModel, defaultControl } from "../js/core/project-model.js";
import { parseRc, applyParseToProject } from "../js/engine/rc-parser.js";
import { compileRc, compileHeader } from "../js/engine/rc-compiler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samples = join(__dirname, "..", "samples");

const header = readFileSync(join(samples, "resource.h"), "utf8");
const demoRc = readFileSync(join(samples, "bordlg-demo.rc"), "utf8");

console.log("=== Step 1: Load RC ===");
const parsed = parseRc(demoRc, {
  resolveInclude: (p) => (p === "resource.h" || p.endsWith("resource.h") ? header : null),
});
if (parsed.errors.length) { console.log("Parse errors:", parsed.errors); process.exit(1); }
console.log("  Parsed OK:", parsed.resources.length, "resources");

const project = new ProjectModel();
applyParseToProject(project, parsed, "bordlg-demo.rc");
const dialogs = project.dialogs();
console.log("  Dialogs:", dialogs.length);
for (const d of dialogs) {
  console.log("   ", d.id, "controls:", d.controls.length);
}

console.log("\n=== Step 2: Modify (add control) ===");
const dlg = dialogs[0];
const { name, value } = project.identifiers.nextId("IDC_NEWBTN");
project.identifiers.define(name, value);
const ctl = defaultControl({
  id: name, className: "BUTTON", text: "Test Button",
  x: 10, y: dlg.cy - 20, cx: 60, cy: 14,
  style: WS.CHILD | WS.VISIBLE | WS.TABSTOP,
});
project.addControl(dlg, ctl);
console.log("  Added:", name, "=", value);

console.log("\n=== Step 3: Save RC ===");
const rcOut = compileRc(project);
const hdrOut = compileHeader(project.identifiers);
console.log("  RC length:", rcOut.length);
console.log("  First 600 chars:");
console.log(rcOut.substring(0, 600));

console.log("\n=== Step 4: Verify (re-parse saved) ===");
const parsed2 = parseRc(rcOut, {
  resolveInclude: (p) => (p === "resource.h" || p.endsWith("resource.h") ? hdrOut : null),
  symbols: Object.fromEntries(project.identifiers.list().map((i) => [i.name, i.value])),
});
if (parsed2.errors.length) { console.log("  Re-parse errors:", parsed2.errors); process.exit(1); }
const dlg2 = parsed2.resources.filter((r) => r.type === "DIALOG" || r.type === "DIALOGEX");
if (dlg2.length !== dialogs.length) { console.log("  ERROR: dialog count mismatch"); process.exit(1); }
console.log("  Dialogs:", dlg2.length);
for (const d of dlg2) {
  console.log("   ", d.id, "controls:", d.controls.length);
  let found = false;
  for (const c of d.controls) {
    if (String(c.id) === name || String(c.id) === String(value)) {
      console.log("    Found new control:", c.id, "text:", c.text);
      found = true;
    }
  }
  if (!found) console.log("    WARNING: new control not found!");
}
if (dlg2[0].controls.length < dlg.controls.length) {
  console.log("  ERROR: control count decreased!");
  process.exit(1);
}

console.log("\n=== ALL CHECKS PASSED ===");
const outDir = join(__dirname, "_test_output");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "test_output.rc"), rcOut, "utf8");
writeFileSync(join(outDir, "test_resource.h"), hdrOut, "utf8");
console.log("  Saved to", outDir);
