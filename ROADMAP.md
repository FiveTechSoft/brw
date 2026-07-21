# Roadmap — Borland Resources Workshop (Web)

## Objetivo de producto

**Clon idéntico en web** del clásico **Borland Resource Workshop** (Windows / OS/2 era: v5.x · OS/2 1.5), no un “inspirado en” ni un MVP genérico de recursos.

| Dimensión | Significado de *idéntico* |
|-----------|---------------------------|
| **Aspecto** | Tema chiseled-steel Win3.1/95: face `#c0c0c0`, caption azul, bevels, fuentes System/MS Sans Serif, speedbar, status bar |
| **Comportamiento** | Mismos menús, ventanas modeless, paletas flotantes, Project tree, editores, Test Dialog, undo 10–99 |
| **Datos** | Mismos flujos `.RC` / `.H` / `.RES` / bind a binarios; `#define`; memory flags; round-trip fiel |
| **BWCC** | `CLASS "bordlg"`, BorBtn/BorCheck/BorRadio/BorShade/BorStatic, glifos por ID (OK/Cancel/Help…) |
| **Local-first** | 100 % cliente (HTML5/CSS3/JS), sin backend |

**Referencias de verdad (gold standard)**

| Fuente | Uso |
|--------|-----|
| Captura real `workshop.png` (RW editando `DIALOG : 2100` / Preferences) | Layout Dialog Editor, menús, Tools/Align, status line, BorBtn |
| `prompt-borland-resource-workshop.md` | Spec funcional + binario |
| Manual *RW for OS/2 1.5 User’s Guide* (1994) | Project window, Dialog tools, compiler rules, BPMCC→BWCC |
| Manual FiveWin / Workshop (Bingen) | Workflow Win práctico (no controles FiveWin en el clon) |

Stack: **HTML5 · CSS3 · JavaScript ES modules · ArrayBuffer · sin npm obligatorio · sin servidor de app**.

**Rama activa:** `feature/brw-phase1` (worktree `.worktrees/brw-phase1`)

---

## Definición de “clon idéntico” (Definition of Done global)

El producto se considera **1.0.0 / parity** solo cuando:

1. Un usuario de RW clásico reconoce la app en &lt; 5 s (chrome + menús + Project).
2. Puede abrir un `.rc` + `.h` de un proyecto real de diálogos BWCC y editarlos visualmente.
3. **Test Dialog** se comporta como el original (foco, Tab, botones, cierre OK/Cancel).
4. Save genera `.rc` / `.h` / `.res` reutilizables (y, en fases finales, reescribe EXE/DLL).
5. La captura de referencia (`DIALOG : 2100` + paletas Tools/Align + status `Modify, Absolute Grid…`) se puede **recrear en el browser** con diferencias solo por limitaciones de OS (no hay HWND nativos; WYSIWYG ≈ DOM fiel).

**Limitaciones honestas del medio web** (no son “recortes de producto”, son techo técnico):

- Controles dibujados en DOM/canvas, no ventanas hijo Win32 reales → **WYSIWYG visual al 95 %+**, no bit-identical con GDI.
- No se emula el binario de `bpw.exe` ni se enlaza con el linker de Borland C++.
- PE/NE se editan en fases finales; el resto del EXE no se recompila.

Fuera del clon (explícito): controles **FiveWin/FWCTRLS**, IDE de C++, debugger.

---

## Gold standard visual — Dialog Editor (desde `workshop.png`)

La UI del clon **debe** reproducir este layout al editar un diálogo:

```
┌─ Resource Workshop - <proyecto> ─────────────────────────[–][□][×]─┐
│ File  Edit  Resource  Control  Align  Options  Window  Help        │  ← menú idéntico
├────────────────────────────────────────────────────────────────────┤
│ [speedbar 16×16 — opcional Popup / Horizontal / Vertical]          │
├─ DIALOG : <id|nombre> ─────────────────────────────────────────────┤
│  ┌─ canvas del diálogo ──────────┐  ┌ Alignment ┐ ┌ Tools ──────┐ │
│  │ caption del recurso           │  │ ← → ═ ↕   │  │ Select      │ │
│  │ groupboxes, radios, combos…   │  │ ↑ ↓ ║ …   │  │ Tab / Group │ │
│  │ [✓ OK] [✗ Cancel] [? Help]    │  └───────────┘  │ Order/Test  │ │
│  │        ↑ BorBtn glifos        │  ┌ Caption ──┐  │ controls…   │ │
│  └───────────────────────────────┘  │ props     │  │ Undo        │ │
│                                     └───────────┘  └─────────────┘ │
├─ Ready │ Modify , Absolute Grid  x: y: cx: cy:  Order: ID: ────────┤
└────────────────────────────────────────────────────────────────────┘
```

### Checklist de parity UI (Dialog)

| Elemento en captura | Requisito clon |
|---------------------|----------------|
| Título app `Resource Workshop - …` | Sí |
| Menú: File, Edit, Resource, **Control**, **Align**, Options, Window, Help | Orden y comandos equivalentes |
| Ventana MDI `DIALOG : 2100` | Título `DIALOG : <id>` |
| Diálogo con caption, group boxes, radios, combo, BorBtn OK/Cancel/Help | Renderer + BWCC |
| Paleta **Tools** flotante (select, tab, group, order, test, undo, controles) | Iconos 16×16 estilo RW |
| Paleta **Alignment** flotante | Align + Space equally |
| Sidebar/Caption de propiedades | Panel o flotante acoplable |
| Status: `Modify`, **Absolute Grid**, `x y cx cy`, `Order`, `ID` | Status line dual (editor) |
| Desktop gris, ventana minimizada/iconos | Desktop + taskstrip |

---

## Arquitectura (invariable)

```
UI Layer        WindowManager · Menubar · Speedbar · Project · Identifiers
                DialogEditor · Tools/Align palettes · Bitmap · Menu · Script
State Layer     ProjectModel · IdentifierStore · UndoStack · AppState (.DSK)
Engine Layer    RC lexer/parser/compiler · DLGTEMPLATE · RES · (PE/NE) · bitmaps
```

Todo en el cliente. Sin backend.

---

## Fases de entrega

Las fases son **cortes de ingeniería** hacia el mismo objetivo de clon idéntico.  
Ninguna fase “redefine” el producto a un subset permanente: lo no hecho queda **pendiente de parity**, no descartado.

---

### Fase 0 — Fundación *(completa)*

Base sobre la que se construye la parity.

- [x] Spec, plan, dominio (UI + OS/2 UG)
- [x] Scaffold SPA, constantes Win32, smoke tests
- [x] UndoStack, IdentifierStore, ProjectModel
- [x] Shell MDI (drag/resize/min/max) — *refinar hasta match de captura*
- [x] Motor RC (DIALOG, `#define`/`#include`, opacos, round-trip)
- [x] Samples BORDLG (`about.rc`, `bordlg-demo.rc`)

**Estado:** hecho · **Parity UI shell:** ~40 % (falta menú Control/Align, status clásico, look de captura).

---

### Fase 1 — Parity Dialog + Project + RC/RES *(en curso · bloque crítico)*

Objetivo de fase: **recrear la sesión de la captura** + guardar proyecto real.

#### 1.1 Shell idéntico
- [ ] Menú principal en orden clásico: File · Edit · Resource · **Control** · **Align** · Options · Window · Help
- [ ] SpeedBar: Off / Popup / Horizontal / Vertical (como Preferences de la captura)
- [ ] Status bar global (Ready + contexto)
- [ ] Title `Resource Workshop - <file>`
- [ ] Bevels, caption azul activo, sysmenu/min/max/close pixel-faithful
- [ ] Desktop gris + taskstrip de ventanas minimizadas

#### 1.2 Project Window (eje del IDE)
- [ ] By Type / By File
- [ ] Show Preview, Identifiers, Resources, Items, Unused Types
- [ ] Embedded vs linked; Rename, Edit, Edit as Text, Duplicate, Memory Options
- [ ] DnD / Open `.rc` `.h` `.res` `.bmp` `.ico` `.cur`
- [ ] Doble clic → editor correcto

#### 1.3 Identifiers Window
- [ ] Name, Value, Usage; sync `#define`; cascade rename; auto IDC_/IDD_/CM_/IDS_

#### 1.4 Dialog Editor = gold standard `workshop.png`
- [ ] Ventana `DIALOG : <id>`
- [ ] Canvas en dialog units; **Absolute Grid** en status
- [ ] Select, move, resize (handles)
- [ ] Tools palette completa (mode + action + controls)
- [ ] Align palette (Left/Right/Tops/Bottoms/Centers/Space equally/Center in dialog)
- [ ] Caption/Properties flotante o acoplada
- [ ] BWCC: `bordlg`, BorShade, BorBtn (glifos ✓ ✗ ?), BorRadio, BorCheck, BorStatic
- [ ] Controles estándar: button, radio, check, group, edit, list, combo, static frames…
- [ ] Tab Set (T), Set Groups (G), Set Order, Test Dialog, Duplicate, Undo
- [ ] Status: `Modify | Absolute Grid | x: y: cx: cy: | Order: | ID:`
- [ ] Units Dialog ↔ Screen; grid snap; selection surrounds
- [ ] Style dialog (doble clic) — estilos WS/DS/BS/ES/SS…
- [ ] Plantillas New Dialog (buttons right/bottom, Borland/Windows)

#### 1.5 Compilar / binario
- [ ] DLGTEMPLATE pack/unpack
- [ ] `.RES` Win32 R/W (`RT_DIALOG` + pass-through)
- [ ] Save Project → `.rc` + `.h` + `.res` (+ Multi-Save prefs)
- [ ] `.RWP` cache (opcional en 1.x si acelera open)

#### 1.6 Desktop state
- [ ] Posiciones de ventanas y paletas (`localStorage` ≈ `.DSK`)
- [ ] Preferences: Undo levels, speedbar mode, multi-save, backups `~`

**Criterio de salida Fase 1 (parity parcial):**  
Screenshot A/B: la escena Preferences + Tools + Align + BorBtn es **indistinguible a ojo** en el browser; round-trip `.rc`/`.res` del sample BORDLG.

---

### Fase 2 — Parity Menu · Accelerator · String · Script

- [ ] **Menu Editor** idéntico: Outline + Test Menu bar + Attributes (`&`, `\t`, `\a`, Popup/Item/Separator, MIA_*)
- [ ] **Accelerator Editor**: grid VK/ASCII, Shift/Ctrl/Alt, live capture, duplicate-key check, Invert menu item
- [ ] **String Table Editor**: ID name/value/string, segmentos de 16, límite 255
- [ ] Script editor interno; strip comments al guardar (comportamiento RW)
- [ ] Compile `RT_MENU` / `RT_ACCELERATOR` / `RT_STRING`
- [ ] Recursos opacos ya no: edición real

**Criterio:** proyecto con menú + accel + strings editable y recompilable como en RW.

---

### Fase 3 — Parity Paint (Bitmap · Icon · Cursor · Font)

- [ ] Launch multi-image (device size, planes, bpp)
- [ ] Dual pane 1:1 + zoom; tools Pick/Zoom/Pen/Brush/Eraser/Fill/Line/Text/shapes
- [ ] FG/BG botón izq/der; transparent / inverted
- [ ] Cursor hot spot; test pointer
- [ ] Font raster 0–255, anchos variables
- [ ] I/O `.BMP` `.ICO` `.CUR`/`.PTR` `.FNT`

**Criterio:** icono y cursor editados se ven iguales al reabrir en RW clásico (o visualmente en el clon).

---

### Fase 4 — Parity binarios ejecutables y toolchain

- [ ] Decompilar / reescribir recursos en **PE** (`.EXE` `.DLL`) y **NE** si aplica
- [ ] RCDATA + custom types + hexstring + file refs
- [ ] Preprocesador RC al nivel del compilador RW (límites documentados vs IBM RC)
- [ ] Validación: IDs duplicados, floating operators, Compile Status dialog
- [ ] Backups, Multi-Save EXE/RES, Include path

**Criterio:** abrir DLL de recursos, cambiar un diálogo BWCC, regrabar y usar en app real.

---

### Fase 5 — Parity total / 1.0

- [ ] Array layout, Force Alignment, Draft/Normal/WYSIWYG modes
- [ ] Context menus y atajos de teclado clásicos
- [ ] Help contextual / status help text en menús
- [ ] Suite de regresión + fixtures golden (RC + RES + capturas de UI)
- [ ] Diff visual opcional vs capturas de referencia (`workshop.png` y más)
- [ ] Distribución: módulos ES + build a **un solo HTML portable**
- [ ] Checklist “usuario RW no nota que es web” en sesión de 30 min

**Criterio 1.0:** DoD global de arriba = ✅

---

## Mapa menú clásico (parity)

| Menú | Comandos objetivo (clon) |
|------|---------------------------|
| **File** | New/Open Project, Save Project, Save File As, Save All, Close All, Preferences, Exit |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Delete, Duplicate |
| **Resource** | New…, Add to Project, Save Resource As, Identifiers… |
| **Control** | New control types, attributes (activo en Dialog Editor) |
| **Align** | Left/Right/Tops/Bottoms/Centers/Space equally/Center in dialog/Array |
| **Options** | Test Dialog, grid, units, selection prefs, drawing type |
| **Window** | Cascade, Tile, lista de ventanas, close |
| **Help** | Index, About Resource Workshop |

---

## Estado actual vs clon idéntico

| Área | ~% hacia idéntico | Notas |
|------|-------------------|--------|
| Motor RC (DIALOG) | 75 % | Preprocesador parcial; RCDATA hexstring pendiente |
| Modelo de proyecto | 70 % | Core + tree + I/O + RES |
| Shell MDI / tema | 65 % | Menú clásico + status; refinar iconos speedbar |
| Dialog Editor visual | 55 % | Select/move/resize, Tools/Align, Test, BWCC base |
| BWCC rendering | 50 % | bordlg grid + BorBtn/Check/Radio/Shade |
| Project / Identifiers UI | 60 % | Tree, preview, IDs window |
| .RES / PE | 40 % | RT_DIALOG R/W; PE pendiente |
| Menu/Accel/String/Paint | 0 % | |

**Versión actual de ingeniería:** `0.3.0-pre` (Dialog Editor + Project + RES base).  
**Siguiente hito:** refinar A/B vs `workshop.png` → **0.3.0** parity visual; Save/prefs → **0.4.0**.  
**Parity producto:** `1.0.0`.

---

## Hitos de versión

| Versión | Hito de clon |
|---------|----------------|
| **0.1.0** | Fundación: modelo + RC + shell base *(actual)* |
| **0.2.0** | Project + Identifiers + open/save texto + menú clásico |
| **0.3.0** | **Dialog Editor + Tools/Align + BWCC + status = match captura** |
| **0.4.0** | `.RES` + Save Project completo + desktop `.DSK` → **Fase 1 cerrada** |
| **0.5.0** | Menu + Accel + String editors |
| **0.6.0** | Paint suite |
| **0.8.0** | PE/DLL decompile/bind |
| **1.0.0** | **Clon idéntico** (DoD global) |

---

## Prioridad absoluta (orden de trabajo)

1. Shell + menús **idénticos a la captura**  
2. Dialog Editor + Tools + Align + status + **BorBtn**  
3. Project Window + open/save `.rc`/`.h`  
4. `.RES` + DLGTEMPLATE  
5. Resto de editores y PE  

Si hay que paralelizar: **nunca** sacrificar fidelity visual del Dialog Editor por features secundarias.

---

## Cómo validar “idéntico”

1. **Manual A/B:** ventana del browser al lado de RW o de `workshop.png`.  
2. **Fixtures:** `samples/bordlg-demo.rc` + diálogos reales del usuario.  
3. **Round-trip:** parse → edit → compile → parse (y RES → unpack → pack).  
4. **Tests automatizados** del engine + smoke UI checklist.  
5. Lista de menús/comandos del manual OS/2 + captura Windows tachada ítem a ítem.

```bash
cd .worktrees/brw-phase1
python -m http.server 8080
# http://localhost:8080/
# node tests/engine-smoke.mjs
```

---

## Documentos relacionados

| Doc | Ruta |
|-----|------|
| Prompt maestro | `prompt-borland-resource-workshop.md` |
| Design Fase 1 | `docs/superpowers/specs/2026-07-21-borland-resource-workshop-design.md` |
| Plan tareas | `docs/superpowers/plans/2026-07-21-borland-resource-workshop.md` |
| Dominio UI | `docs/domain/brw-ui-reference.md` |
| Mapeo OS/2 UG | `docs/domain/os2-ug-1.5-mapping.md` |
| Changelog | `CHANGELOG.md` |
| Captura referencia | `c:\users\anto\downloads\workshop.png` (local) |

---

*Actualizado: 2026-07-21 — objetivo de producto elevado a **clon web idéntico**; gold standard UI = captura Resource Workshop Dialog Editor.*
