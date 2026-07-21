# Changelog

Todos los cambios notables del proyecto **Borland Resources Workshop (Web)** se documentan aquí.

El formato se inspira en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).  
Versionado: [Semantic Versioning](https://semver.org/lang/es/) (pre-1.0 = API inestable).

---

## [Unreleased]

### Changed

- **Objetivo de producto:** clon web **idéntico** a Resource Workshop (no “inspirado en”).  
  `ROADMAP.md` reescrito con Definition of Done global, gold standard visual desde captura `workshop.png` (DIALOG editor + Tools/Align + BorBtn + status Absolute Grid), menús clásicos File…Help, y fases orientadas a **parity** hasta 1.0.0.

### Planned (hacia clon idéntico)

- Shell y menús pixel-faithful (Control, Align, Options; SpeedBar modes)
- Project Window + Identifiers (parity manual)
- Dialog Editor = escena captura (Tools, Align, Caption, BWCC, status line)
- `DLGTEMPLATE` + `.RES` + Save Project + desktop `.DSK`
- Menu / Accel / String / Paint / PE·DLL (fases 2–4)
- 1.0.0 solo con DoD de parity global

### Documentation

- Mapeo del manual oficial *Resource Workshop for OS/2 1.5 User’s Guide* (1994)
- Referencia de dominio UI (Project / Dialog / BWCC / diferidos)
- Roadmap de clon idéntico + checklist UI desde `workshop.png`

---

## [0.1.0] — 2026-07-21

Primera entrega técnica en rama `feature/brw-phase1`: **fundación + shell + motor RC**.

### Added

#### Documentación y proceso
- Prompt maestro de especificación (`prompt-borland-resource-workshop.md`)
- Design spec Fase 1 (`docs/superpowers/specs/2026-07-21-borland-resource-workshop-design.md`)
- Plan de implementación en 18 tareas (`docs/superpowers/plans/2026-07-21-borland-resource-workshop.md`)
- `docs/domain/brw-ui-reference.md` — filosofía y editores clásicos
- `docs/domain/os2-ug-1.5-mapping.md` — checklist manual OS/2 → web
- Worktree git aislado (`.worktrees/`, ignorado en `.gitignore`)

#### Scaffold y núcleo de estado
- SPA `index.html` + CSS tema Win95 (stub ampliable)
- `js/core/constants.js` — `RT_*`, átomos de control, `WS`/`DS`/`BS`/`ES`/`SS`/`CBS`/`LBS`, `STYLE_NAMES`, IDs estándar
- `js/core/undo-stack.js` — pila de comandos, límite 1–99 (default 10)
- `js/core/identifiers.js` — `#define`, rename, `nextId`, `toHeaderText`, `resolve`
- `js/core/project-model.js` — proyecto, diálogos, controles, mutaciones con undo, rename cascade, usage

#### UI shell
- `js/ui/window-manager.js` — ventanas MDI (drag, resize, min/max, z-order, task strip)
- `js/ui/menubar.js` / `speedbar.js` / `desktop.js`
- `js/main.js` — boot: ProjectModel + menús File/Edit/Resource/Window/Help + ventana Project placeholder
- Estilos `css/theme-win95.css`, `css/windows.css`

#### Motor de scripts de recursos
- `js/engine/rc-expr.js` — expresiones constantes (decimal, hex, **octal** con ceros a la izquierda, `| + - * / ( )`, símbolos de estilo)
- `js/engine/rc-lexer.js` — tokens; elimina `//` y `/* */`
- `js/engine/rc-parser.js` — `#define`, `#include`, `#ifdef`/`#else`/`#endif` simple; **DIALOG/DIALOGEX** + controles (CONTROL y atajos); bloques opacos (MENU, etc.)
- `js/engine/rc-compiler.js` — `compileHeader` / `compileRc`; round-trip de diálogos

#### Samples y tests
- `samples/resource.h`, `samples/about.rc` (About mínimo `CLASS "bordlg"`)
- `samples/bordlg-demo.rc` — plantilla BWCC + diálogo Options + MENU stub
- `tests/assert.js`, `tests/engine-smoke.html`, `tests/engine-smoke.mjs`
- **17 tests Node ESM en verde** (constantes, undo, identifiers, ProjectModel, lexer/expr, parse About, #ifdef, opacos, compiler round-trip)

### Architecture notes

```
UI (shell) → ProjectModel / Identifiers / Undo → RC engine
```

Sin dependencias npm; servir con `python -m http.server` (o similar).

### Not included in 0.1.0

- Editores visuales de diálogo / menú / paint
- Lectura/escritura `.RES` o PE
- Project tree funcional y Save real (solo stubs de menú)

---

## Historial de commits (0.1.0)

Orden aproximado en `feature/brw-phase1`:

| Commit (mensaje) | Área |
|------------------|------|
| docs: design spec + implementation plan | Proceso |
| chore: ignore .worktrees | Repo |
| chore: scaffold SPA shell, constants, smoke harness | Scaffold |
| feat: UndoStack | Core |
| feat: IdentifierStore | Core |
| feat: ProjectModel | Core |
| feat: Win95 theme and MDI WindowManager | UI |
| feat: menubar and speedbar shell wiring | UI |
| feat: RC lexer and constant expression evaluator | Engine |
| feat: RC parser for DIALOG, defines, opaque blocks | Engine |
| feat: RC compiler and parse→project round-trip | Engine |
| feat: RC engine polish + BORDLG sample templates | Samples |
| docs: map OS/2 1.5 User Guide | Docs |

---

## Enlaces

- Design: `docs/superpowers/specs/2026-07-21-borland-resource-workshop-design.md`
- Plan: `docs/superpowers/plans/2026-07-21-borland-resource-workshop.md`
- Roadmap: `ROADMAP.md`

---

## [0.0.0] — 2026-07-21

- Inicio del repositorio con prompt de especificación técnica para clonar Borland Resource Workshop en HTML5/CSS3/JS.
