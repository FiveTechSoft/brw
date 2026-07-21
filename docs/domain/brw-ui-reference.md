# Borland Resource Workshop — UI & Domain Reference

Captured from product documentation for the web port. Phase 1 implements a subset; later phases expand.

## Philosophy

- **Visual UI separated from app source** — resources live in `.RC` / `.RES` / headers, not hardcoded in C/Pascal UI code.
- **Text + binary** — edit `.RC`/`.DLG` and compiled `.RES`.
- **Decompile binaries** — classic RW opens `.EXE`/`.DLL`/`.DRV` and rewrites resources in place (Phase 1: deferred; design lists NE/PE later).
- **Identifier headers** — `#define` / Pascal constants in `.H`, `.RH`, `.PAS`, `.INC`.

## Project Window

| Feature | Phase 1 | Notes |
|---------|---------|--------|
| By Type / By File | Planned | Mutually exclusive sort |
| Preview pane | Planned | Live dialog/bitmap preview |
| Filters: Identifiers, Resources, Items | Planned | View menu / checkboxes |
| DnD import | Planned | `.rc`, `.res`, `.h`, images |

## Dialog Editor + BWCC

| Feature | Phase 1 | Notes |
|---------|---------|--------|
| Tools: Select, Tab, Group, Order, Test | Planned | |
| Standard controls | Planned | Button, edit, static, list, combo, group, radio, check |
| Draft / Normal / WYSIWYG draw modes | Partial | Start with Normal-like DOM renderer; Draft optional; true WYSIWYG OS child windows not available in browser — approximate |
| CLASS `"bordlg"` chiseled steel | Planned | CSS grid chrome |
| BorShade, BorBtn, BorRadio, BorCheck, BorStatic | Planned | Glyphs by ID for BorBtn |
| BBN_* notify in Test | Planned | Console/log stubs |
| New dialog templates (buttons right/bottom) | Later | Can add as presets |

## Bitmap / Paint Editor

Deferred (Phase 2+): pel grid, FG/BG mouse buttons, dual pane zoom, transparent/inverted, cursor hotspot, fonts.

## Menu Editor

Deferred: Outline + Test Menu + Attribute panes, `&` mnemonics, `\t` / `\a`.

## String / Accelerator / Script

Deferred: 16-string segments, duplicate accel check, internal script editor that strips comments on save (RC compiler already strips comments on rewrite).

## Sample scripts

- `samples/resource.h` — IDs
- `samples/about.rc` — small BORDLG About
- `samples/bordlg-demo.rc` — full BWCC + mixed standard controls + opaque MENU stub
