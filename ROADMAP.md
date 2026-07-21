# Roadmap — Borland Resources Workshop (Web)

Clon web **local-first** del clásico Borland Resource Workshop (estética Win95 / OS/2, flujos del manual OS/2 1.5 y del prompt maestro).  
Stack: HTML5 · CSS3 · JavaScript ES modules · sin backend.

**Documentos base**

| Doc | Ruta |
|-----|------|
| Prompt maestro | `prompt-borland-resource-workshop.md` |
| Design Fase 1 | `docs/superpowers/specs/2026-07-21-borland-resource-workshop-design.md` |
| Plan de implementación | `docs/superpowers/plans/2026-07-21-borland-resource-workshop.md` |
| Dominio UI | `docs/domain/brw-ui-reference.md` |
| Mapeo manual OS/2 1.5 | `docs/domain/os2-ug-1.5-mapping.md` |

**Rama de desarrollo:** `feature/brw-phase1` (worktree `.worktrees/brw-phase1`)

---

## Visión

Un IDE en el navegador donde se diseñan, editan y compilan recursos Windows (diálogos, menús, bitmaps, etc.) **sin mezclar la UI con el código de la aplicación**, con parse/compile/decompilación en el cliente (`ArrayBuffer`, parsers JS).

---

## Fase 0 — Fundación *(completa)*

- [x] Spec y plan de implementación
- [x] Scaffold SPA (`index.html`, tema stub, smoke tests)
- [x] Constantes Win32 (`WS_*`, `RT_*`, IDs estándar)
- [x] `UndoStack` (1–99, default 10)
- [x] `IdentifierStore` (`#define`, rename, header text)
- [x] `ProjectModel` (diálogos, controles, mutaciones + undo)
- [x] Shell MDI Win95 (`WindowManager`, menú, speedbar)
- [x] Motor RC: lexer, expresiones (octal/hex/`|`), parser DIALOG, compiler, round-trip
- [x] Samples `about.rc`, `bordlg-demo.rc`, `resource.h`
- [x] Documentación de dominio (UI + OS/2 UG)

**Criterio de salida:** 17+ tests de motor en verde; shell arrancable por HTTP estático.

---

## Fase 1 — MVP Dialog + RC + RES *(en curso)*

Objetivo: **editar diálogos de verdad** y guardar `.rc` / `.h` / `.res`.

### 1.1 Project & I/O
- [ ] Project Window: By Type / By File, filtros (Resources, Identifiers, Items, Unused Types)
- [ ] Panel **Show Preview** (miniatura del diálogo)
- [ ] Open / drag-and-drop (`.rc`, `.h`, `.res`, listado de imágenes)
- [ ] Identifiers Window (name / value / usage + rename cascade)
- [ ] File I/O: download Blob; File System Access API si existe

### 1.2 Dialog Editor + BWCC
- [ ] Canvas DU/px, Select / move / resize
- [ ] Paleta: controles estándar + BorShade / BorBtn / BorRadio / BorCheck / BorStatic
- [ ] `CLASS "bordlg"` (rejilla chiseled-steel)
- [ ] Glifos BorBtn por ID (`IDOK`…`IDHELP`)
- [ ] Tools: Tab Set, Set Groups, Set Order, Duplicate, Undo
- [ ] Window Style (doble clic)
- [ ] **Test Dialog** (foco, Tab; log `BBN_*` stub)
- [ ] Preferencias editor: units Dialog|Screen; selection surrounds (manual OS/2)

### 1.3 Binario
- [ ] `DLGTEMPLATE` pack/unpack
- [ ] Win32 `.RES` reader/writer (`RT_DIALOG` + pass-through de otros tipos)
- [ ] Save Project → `.rc` + `.h` + `.res`

### 1.4 Desktop
- [ ] `localStorage` (posiciones de ventanas, filtros, undo limit) ~ `.DSK`
- [ ] About + sample BORDLG cargable
- [ ] Checklist de aceptación del design §10

**Criterio de salida:** abrir `samples/bordlg-demo.rc`, editar, Test Dialog, Save Project y reabrir `.res` con el mismo diálogo.

---

## Fase 2 — Menús, strings, accelerators

- [ ] Menu Editor (Outline + Test Menu + Attributes; `&`, `\t`, `\a`)
- [ ] Accelerator Editor (VK/ASCII, modificadores, duplicate-key check)
- [ ] String Table Editor (segmentos de 16, máx. 255 chars)
- [ ] Compile/decompile `RT_MENU`, `RT_ACCELERATOR`, `RT_STRING`
- [ ] Edit as Text por recurso (script editor interno; strip de comentarios al reescribir)

**Criterio de salida:** round-trip de un proyecto con menú + accel + strings en `.rc` y `.res`.

---

## Fase 3 — Paint (bitmap / icon / cursor / font)

- [ ] Launch window multi-imagen (tamaños / bpp)
- [ ] Canvas pel: pen, brush, eraser, flood-fill, line, shapes, text
- [ ] Dual pane (1:1 + zoom); FG/BG click izq/der
- [ ] Transparent / inverted (icon/cursor)
- [ ] Cursor hot spot
- [ ] Font raster editor (índice 0–255, anchos variables)
- [ ] I/O `.BMP` / `.ICO` / `.CUR` / `.PTR` / `.FNT`

**Criterio de salida:** editar y reexportar un icono 32×32 16 colores y un cursor con hot spot.

---

## Fase 4 — Contenedores binarios y toolchain

- [ ] Extraer/actualizar recursos en **PE** (`.EXE` / `.DLL`) y, si procede, **NE**
- [ ] Multi-Save preferences (como File \| Preferences del manual)
- [ ] Caché **`.RWP`** (abrir proyecto más rápido)
- [ ] Backups al guardar (`~` en extensión)
- [ ] Preprocesador RC más completo (`#if` anidados, límites documentados)
- [ ] hexstring / RCDATA con ficheros externos
- [ ] Validadores: IDs duplicados, operadores flotantes, informe de errores tipo Compile Status

**Criterio de salida:** decompilar una DLL de recursos, cambiar un diálogo, regrabar sin romper el resto.

---

## Fase 5 — Fidelity UX & polish

- [ ] Align palette completa (Space Equally, Center in Dialog, Array)
- [ ] Grid + Snap To Grid + Force Alignment
- [ ] Draft / Normal / WYSIWYG aproximado (DOM; no HWND reales)
- [ ] Plantillas New Dialog (botones derecha/abajo; Borland vs Windows)
- [ ] Desktop cascade/tile refinados; task strip clásico
- [ ] Context menus en Project tree (Rename, Duplicate, Memory Options, Save Resource As)
- [ ] Help/About estilo BWCC; teclas de menú
- [ ] Tests de regresión ampliados + fixtures binarios golden
- [ ] Build opcional a un solo `index.html` portable

**Criterio de salida:** flujo “siente RW” en una sesión de 15 min sin tocar código de app.

---

## Fuera de alcance (explícito)

| Ítem | Motivo |
|------|--------|
| Controles **FiveWin** (`FWCTRLS`, TWBrowse, TFolder…) | No son Resource Workshop; otro producto |
| **BPMCC** API completa OS/2 | Port web = **BWCC** Windows |
| Servidor / multi-usuario | Local-first |
| Compilar PE desde cero | Solo editar recursos embebidos |
| WYSIWYG con controles OS nativos | Limitación del navegador |

---

## Prioridad sugerida (si hay que recortar)

1. **Fase 1.1–1.3** (sin esto no hay producto usable)  
2. Fase 2 menús (muy usados en apps Win)  
3. Fase 3 paint  
4. Fase 4 PE/DLL  
5. Fase 5 polish  

---

## Hitos de versión (propuesta)

| Versión | Contenido |
|---------|-----------|
| **0.1.0** | Shell + ProjectModel + motor RC (actual) |
| **0.2.0** | Project Window + Identifiers + open files |
| **0.3.0** | Dialog Editor + BWCC + Test Dialog |
| **0.4.0** | `.RES` + Save Project + desktop state → **Fase 1 done** |
| **0.5.0** | Menu / Accel / String editors |
| **0.6.0** | Paint suite |
| **1.0.0** | PE/DLL round-trip + polish UX suficiente |

---

## Cómo probar el estado actual

```bash
cd .worktrees/brw-phase1   # o raíz del worktree de feature
python -m http.server 8080
# App:   http://localhost:8080/
# Tests: http://localhost:8080/tests/engine-smoke.html
# Node:  node tests/engine-smoke.mjs
```

---

*Última actualización: 2026-07-21 — alineado con design Fase 1 y rama `feature/brw-phase1`.*
