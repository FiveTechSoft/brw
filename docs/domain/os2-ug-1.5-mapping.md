# Official mapping: Resource Workshop for OS/2 1.5 User’s Guide (1994)

Source: `Borland_Resource_Workshop_for_OS2_Version_1.5_Users_Guide_1994.pdf`

## Product features (Introduction)

| Manual feature | Web Phase 1 |
|----------------|-------------|
| Manage many resources/files | ProjectModel + Project Window |
| Auto-open correct editor | Editor registry (DIALOG → DialogEditor) |
| #defines in headers | IdentifierStore + compileHeader |
| Multilevel Undo/Redo (10–99) | UndoStack |
| Compile on demand | RcCompiler + ResWriter |
| Decompile binary | ResReader (EXE/DLL later) |
| Error / duplicate checks | Parser errors[]; accel later |

## File types (Ch. 2)

| Extension | Manual | Phase 1 |
|-----------|--------|---------|
| .RC | Primary project | Yes |
| .DLG | Script (often dialogs) | Treat as .RC |
| .RES | Compiled binary | Yes (RT_DIALOG) |
| .EXE/.DLL | Bind/decompile | Deferred |
| .BMP/.ICO/.PTR | Bitmapped | List only / paint later |
| .H | Identifiers | Yes |
| .RWP | Compiled RC cache | Optional later |

## Preferences (Ch. 2)

| Pref | Manual default | Phase 1 |
|------|----------------|---------|
| Undo Levels | 10 (max 99) | Yes |
| Include Path | WORKSHOP.INI | File map on open |
| Multi-Save .RES/.EXE | On Save Project | .RES yes; .EXE later |
| Make Backups (~ext) | Optional | Deferred |

## Project window (Ch. 3)

| UI | Manual | Phase 1 |
|----|--------|---------|
| By Type / By File | Mutually exclusive | Yes |
| Show Preview | Split pane | Yes |
| Show Identifiers | View filter | Yes |
| Show Resources | View filter | Yes |
| Show Items | Outline items | Yes |
| Show Unused Types | Empty type stubs | Yes |
| Embedded vs linked | By File | Partial (sourceFile) |
| Save Project / File As / Resource As | File/Resource menus | Yes |
| Context Edit / Edit as Text / Rename | Context menu | Edit + Rename; Edit as Text later |
| Memory options | Preload/Moveable/Discardable | Stored on resource |

## Dialog editor (Ch. 4)

| Tool / option | Phase 1 |
|---------------|---------|
| Selector, Tab Set, Set Order, Set Groups, Test | Yes |
| Duplicate | Yes |
| Align palette / Space Equally | Basic align later; Duplicate yes |
| Array layout | Deferred |
| Grid / Snap | Visual grid; snap optional |
| Units Dialog \| Screen | Yes |
| Selection Near Border / Surrounds | Default surrounds-like |
| Control tools (Win standard + BWCC) | Yes (Win32 mapping, not PM Notebook/Container) |
| Style dialog (basic attrs + styles) | Yes |
| Presentation parameters (PM) | N/A for Win port |

## Bitmap editor (Ch. 5)

Deferred: pels, FG/BG, multi-image, transparent/inverted, hot spot.

## Script / compiler (Ch. 6 + App A)

Implemented in `js/engine/*` (octal, complex expr, floating `|` error, hexstring planned, #undef limited).

## BPMCC (App B)

OS/2 custom controls. Web port uses **Windows BWCC** (`bordlg`, BorBtn, …) as the Win equivalent.

## Manuals cross-ref

| Doc | Role |
|-----|------|
| OS/2 1.5 UG | Official product behavior |
| WorkShop+Manual.pdf (FiveWin) | Win workflow + FWCTRLS (out of Phase 1) |
| prompt-borland-resource-workshop.md | Master engineering prompt |
