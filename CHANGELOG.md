# Changelog

Todos los cambios notables del proyecto **Borland Resources Workshop (Web)** se documentan aqui.

---

## [Unreleased]

### Added (0.5.0-pre — Icon/Cursor + Menu + Script Editors)

#### Icon/Cursor Editor
- **Icon Editor** (ICON/CURSOR): Canvas dual-pane 1:1 + zoom x8
- Tamanos predefinidos: 16x16, 32x32 con selector de tamano
- Herramientas: Pen, Eraser, Fill, Picker, Rect, Line
- Pickers de color FG/BG
- Hotspot editor para cursores (crosshair visual rojo)
- Checkerboard transparent background

#### Menu Editor
- **Menu Editor** (MENU): Editor visual con arbol de items
- Agregar/popup, menu items, separators
- Mover arriba/abajo, eliminar items
- Preview de barra de menu en vivo
- Panel de propiedades (caption + ID)
- Regeneracion de texto RC desde el arbol

#### Script Editor
- **Script Editor**: Editor de texto para cualquier recurso opaco
- Textarea monoespaciado (Consolas) con line numbers
- Save y Revert al resource.rawText
- Fallback automatico para tipos no editables visualmente

#### Resource Menu - New Items
- **New Bitmap**: Crea BITMAP con prefijo IDB_
- **New Menu**: Crea MENU con prefijo IDR_
- **New Icon**: Crea ICON con prefijo IDI_
- **New Cursor**: Crea CURSOR con prefijo IDC_

#### Bitmap Editor
- Canvas 32x32 con zoom x10, grid overlay
- Herramientas: Pencil, Eraser, Fill, Picker, Rect, Line
- Pickers de color FG/BG, flood fill, Bresenham lines

#### Resource Editors (Phase 2)
- String Table, Version Info, Accelerators editors

#### Context Menus + Align/Size
- Menu contextual en controles de dialogo
- Align/Size dialogs (classic Borland layout)

#### Browse Control
- TWBrowse/TXBrowse/TSBrowse rendering

#### Theme Improvements
- Win11 Mica/Fluent, button press feedback, theme checked state

#### Layout Persistence
- wm.onLayoutChange, localStorage, beforeunload

#### Deployment
- GitHub Actions Pages deploy

---

## [0.1.0] — 2026-07-21

Primera entrega tecnica: fundacion + shell + motor RC.

---

*Actualizado: 2026-07-22 — Icon/Cursor + Menu + Script editors; Resource menu completo.*