# ESPECIFICACIÓN TÉCNICA Y PROMPT MAESTRO PARA CLONAR BORLAND RESOURCE WORKSHOP EN HTML5, CSS3 Y JAVASCRIPT

Este documento contiene un prompt altamente estructurado, optimizado para ser procesado por modelos de lenguaje avanzados (como Claude 3.5 Sonnet o GPT-4o), con el fin de generar el código fuente completo de una aplicación web interactiva que replique al 100% la funcionalidad, el comportamiento binario y la estética retro del clásico **Borland Resource Workshop (v5.02 / versión OS/2 1.5)**.

---

```markdown
Role: Principal Frontend Engineer & Compiler Systems Expert
Task: Build a 100% functionally identical, web-based (HTML5/CSS3/JavaScript) clone of the classic Borland Resource Workshop (v5.02 / OS/2 1.5).
User Interface Style: Retro 16-bit / 32-bit Windows (Windows 95/98/OS/2) chiseled-steel theme with fully functional nested windows, floating palettes, menu bars, and speedbars.
Architecture: Local-first, client-side execution. Zero-backend dependency. File parsing, compilation, and decompilation must occur entirely in-browser using ArrayBuffers, regular expressions, and custom JS parser engines.

=========================================
1. CORE ARCHITECTURE & SYSTEM DESIGN
=========================================
You must build a complete Single Page Application (SPA) that acts as an IDE. The system has 3 layers:
- Parse/Binary Engine (JS Core): Handlers for ArrayBuffer/File objects to decompile and compile:
  * Resource Scripts (.RC, .DLG)
  * C/Pascal Headers (.H, .RH, .PAS, .INC)
  * Binary Resource Files (.RES)
  * Win32/16 Executabes/DLLs (.EXE, .DLL, .DRV, .NE, .PE)
  * Bitmapped files (.BMP, .ICO, .CUR / .PTR, .FNT)
- Project & Identifier Manager (State Manager): A modeless state system managing global identifiers (#defines), linked/embedded files, and a unified undo/redo stack (up to 99 levels, default 10).
- Visual Editors (UI Layer): Custom interactive canvas and DOM-based workspace editors for Dialogs, Menus, Accelerators, String Tables, Bitmaps/Icons, and Custom RCDATA.

=========================================
2. DETAILED MODULE SPECIFICATIONS
=========================================

--- MODULE 2.1: THE PROJECT WINDOW (IDE AXIS) ---
- Maintain a modeless nested tree window showing project components sorted "By Type" (default) or "By File".
- Must support:
  * Drag-and-drop file import (.rc, .res, .ico, .bmp, .cur, .h).
  * Checkbox filters: "Show Resources", "Show Identifiers", "Show Items" (renders outline preview), and "Show Unused Types".
  * Split-pane Preview: A real-time visual canvas renderer on the right side of the project tree showing a live render of the selected Dialog, Bitmap, Icon, or Cursor.
  * Save Engine: Support "Save Project" (compiles to .RES and saves .RC + .H), "Save File As", and "Resource Save As" (exports single resource to standalone file). Save pre-compiled .RWP speed-cache.

--- MODULE 2.2: IDENTIFIERS & HEADER MANAGER ---
- Implement a modeless "Identifiers Window" containing:
  * "Name" field, "Value" field, "Usage" status box showing which resource type uses it (or "(unused)" if orphaned).
  * Header Sync: Automatically write `#define <name> <value>` macros to the active C/Pascal header file (.H/.RH).
  * Auto-Generation: Automatically assign prefix rules and incremental IDs:
    * String table: `IDS_`
    * Menu / Accelerator: `CM_`
    * Dialog / Controls: `IDC_` or `IDD_`
  * Support rename cascades: changing an identifier's name or value automatically updates all reference nodes in the binary, visual dialogs, menus, and text scripts.

--- MODULE 2.3: VISUAL DIALOG EDITOR (DLGTEMPLATE) ---
- Core UI Layout: An empty grid editor canvas supporting double click to open the "Window Style" dialog.
- Status Line units: Toggle between "Dialog" units (Y = 1/8 of font height, X = 1/4 of font width) and "Screen" units (Pixels).
- Toolbar & Mode Tools: Selector (mouse pointer arrow), Tab Set (click controls sequentially to map tab stops), Set Groups (defines arrow-key navigation borders), Set Order (numerical layout ordering), Test Dialog (runs a "live" test mode of the dialog box), Duplicate, Undo.
- Drag-and-Drop Control Palette:
  * Standard Windows controls: Push button, Radio button, Check box, Group box, Combo box, List box, Edit text control, Static controls (text, icon frame, rect, black frame, gray frame).
  * Borland Windows Custom Controls (BWCC / BPMCC):
    * Dialog Class: "bordlg". When active, paint the canvas background with a custom 2D grid canvas pattern mimicking the classic "chiseled steel" look (fine grid of perpendicular white lines on gray background).
    * Predefined custom components: BorShade, BorBtn, BorRadio, BorCheck, BorStatic.
    * Predefined BWCC Button IDs: Support visual rendering of standard graphics based on assigned numerical Control ID:
      * IDOK (1) -> Green check mark
      * IDCANCEL (2) -> Red X
      * IDABORT (3) -> Panic button
      * IDRETRY (4) -> Slot machine
      * IDIGNORE (5) -> 55 mph speed-limit sign
      * IDYES (6) -> Green check mark
      * IDNO (7) -> Red circle/slash
      * IDHELP (998) -> Blue question mark
    * Bitmap offset rendering on buttons: If control type is "Bitmap", render associated project bitmap by checking Control ID + Offset state: Standard (+1000 VGA / +2000 EGA), Pressed (+3000 VGA / +4000 EGA), Focus (+5000 VGA / +6000 EGA).
    * Custom control focus events support: Implement and log virtual parent-notify messages: `BBN_SETFOCUS`, `BBN_SETFOCUSMOUSE`, `BBN_GOTATAB`, and `BBN_GOTABTAB` during Test Dialog mode.

--- MODULE 2.4: MENU EDITOR (MENU) ---
- Split-pane layout:
  * Outline Pane (Left): Interactive text-outline list representing parent-child menu trees. Let user drag-and-drop items to restructure. Support inline text keys like `&` for underlined mnemonics (e.g. `&File` -> F underlined).
  * Attribute Pane (Right): Controls to edit properties of the selected menu item: Item Text, Item help string, Item ID, Item Type (Popup, Menuitem, Separator), Break Before (No Break, Menu Bar Break, Menu Break, Help Break), Initial State (Enabled, Disabled, Grayed, Checked).
  * Test Menu Pane (Top): Interactive real-time rendering of the menu bar inside the editor window. Clicking items must open fully functional drop-down submenus.
- Special string escapes parsing: Support `\t` to align accelerators to the right (e.g. `&List\tCtrl+L`) and `\a` to right-align text.
- Compile format: Decompile and compile MENU scripts correctly using the typical block structure:
  ```rc
  <MENU_ID> MENU [LOADONCALL] [MOVEABLE] [DISCARDABLE]
  BEGIN
      POPUP "&Widgets"
      BEGIN
          MENUITEM "&List\tCtrl+L", CM_WIDGET_LIST, MIA_CHECKED
          MENUITEM SEPARATOR
          POPUP "A&rrange"
          BEGIN
              MENUITEM "Ascending", CM_ARRANGE_ASC
          END
      END
  END
  ```

--- MODULE 2.5: ACCELERATOR EDITOR (ACCELTABLE) ---
- Interface: Grid table of accelerator keys (ASCII or Virtual Keys VK_xxx) linked to Command IDs.
- Double-pane layout: Outline Pane and Attribute Pane.
- Modifiers checkboxes: Shift, Ctrl, Alt.
- Dual input modes:
  * Key Value Mode: Capture live keypresses from the user and automatically select the key type (ASCII vs Virtual) and check appropriate modifier flags.
  * Manual Mode: Allow manual entry of VK_xxx constants or ASCII characters.
- Invert Menu Item: Toggle flag (MIA_HILITED) to temporarily flash the menu bar item when the hotkey is triggered in Test mode.
- Check Duplicate Keys: An automated validator action that scans the active table, flags duplicate key binds, and highlights the conflicting rows.

--- MODULE 2.6: STRING TABLE EDITOR (STRINGTABLE) ---
- Render an editable grid with columns: ID Source (Symbolic name), ID Value (Integer), and String Content.
- Segments logic: Automatically group and compile strings into segments of 16 strings each. The segment ID represents the starting block in memory. Limit string content length to 255 characters.

--- MODULE 2.7: BITMAP, ICON, CURSOR & FONT PAINT EDITOR ---
- Canvas Engine: A pixel-art canvas grid.
- Launch Window: When starting, open an image-management launch window displaying all sub-images (device-dependent resolutions/color depths: 32x32 16-colors, 32x32 2-colors, 64x64, 40x40, etc.). Let the user add, delete, or create custom image specs (Device size, color planes, bits per pixel).
- Painting Palette: Pick Rectangle, Zoom (double-click to zoom in, Shift+double-click to zoom out), Pen, Brush (with shape and custom pattern selector), Eraser, Paint Can (reliable custom flood-fill algorithm that handles display boundary tolerances), Line, Text (font type, alignment, size), shapes (empty and filled rects, rounded rects, ellipses).
- Dual-pane layout: Show actual size on one pane and zoomed editable pixel-grid on the other. Support "Draw on Both Images" option to render live pixel changes.
- Dual-color assignment: Paint foreground color with left-click, paint background color with right-click.
- Transparent & Inverted layers: Essential for Icons and Cursors. Provide dedicated palette swatches for "Transparent" (maps to active system window background) and "Inverted" (invert under-pixel color).
- Cursor Hot Spot: Dedicated crosshair tool to select the active hot spot pixel (X, Y) coordinates.
- Font Editor extras: Display character array index (0-255). Custom Font Size dialog (Width, Height, Maximum Width). Character Width setting for variable-width raster fonts.

=========================================
3. COMPILER & RESOURCE SCRIPT PARSER SPECIFICATIONS
=========================================
Write a custom lexical analyzer and parser in JS to handle both reading and compiling of resource files. It must adhere to these precise rules:
- Preprocessor Directives: Support `#include`, `#define`, `#undef` (only for unreferenced identifiers), `#ifdef`, `#ifndef`, `#if`, `#elif`, `#else`, `#endif`.
- Constant Expressions: Support parsing of complex constant mathematical expressions anywhere a number is allowed (e.g. `BITMAP 101 + 1000 vga.bmp` or `3 * (1 + 2) - 1`). Flag "floating" operators like `WS_SYSMENU | WS_CAPTION |` as syntax errors.
- Numbers with Leading Zeros: Preprocessor math must interpret leading zeros as octal numbers (e.g., `010` is parsed as 8, so `010 + 1 = 9`). In string table text identifiers, parse them as decimal numbers.
- Strip comments: The compiler must reformat scripts and strip out C-style (`/* ... */`) and C++ style (`// ...`) comments upon opening/saving, matching classic Borland Resource Workshop behavior.
- RCDATA & Custom resources: Support user-defined types. Allow custom data definition in HEX (preceded by `0x` or `$`), octal, decimal, or as text. Implement the custom `hexstring` data type: strings of hexadecimal digits enclosed in single quotes (e.g., `'01 OA OB 0C 0E'`). Support direct references to external files inside RCDATA definitions.

=========================================
4. FRONTEND THEME & UX IMPLEMENTATION
=========================================
- Look and Feel: Gray 3D panels, chiseled borders (inner-bevel/outer-bevel shadows), classic Microsoft Sans Serif or System retro fonts.
- Multi-Window Manager: An internal system within the webpage that supports overlapping draggable, resizable, minimizable, and maximizable windows. Draggable by title bars, resizable by corners. Double-clicking title bars toggles zoom.
- Floating Palettes: Palette controls, color swatches, and tools windows must hover on top of the workspace and can be dragged around independently.
- Desktop State: Implement save/restore of open windows, active paths, and window positions using local storage, mimicking the `.DSK` files.

Begin generating the complete SPA index.html, styles.css, and app.js. Output robust, structured, clean, and highly optimized code. Focus on creating fully realized visual editors and parsing pipelines.
```
---

### Cómo utilizar este Prompt:
1. **Copia todo el contenido dentro del bloque de código markdown superior.**
2. Pégalo en tu asistente de desarrollo de IA preferido (Claude 3.5 Sonnet, GPT-4o, etc.).
3. Puedes complementarlo con instrucciones adicionales como: *"Genera la estructura de archivos en un único archivo index.html embebiendo todo el CSS y JavaScript para que sea un ejecutable portable autónomo"* o *"Desglosa el desarrollo de la aplicación web en módulos incrementales y comienza por escribir el núcleo del motor binario y el parseador de scripts de recursos (.rc)"*.
