# Borland Resources Workshop (Web)

**Clon web idéntico** del clásico **Borland Resource Workshop** (Windows / OS/2 era).  
100% cliente — HTML5, CSS3, JavaScript ES modules. Sin backend, sin npm obligatorio.

## 🌐 Live Demo

**https://fivetechsoft.github.io/brw/**

## 🎯 Objetivo

Recrear la experiencia completa del Resource Workshop de Borland en el navegador:
- Editor visual de diálogos (Dialog Editor)
- Soporte **BWCC** (Borland Windows Custom Controls): `bordlg`, BorBtn, BorCheck, BorRadio, BorShade, BorStatic
- Paletas flotantes Tools y Alignment
- Project Window con árbol By Type / By File
- Identifiers Window para gestión de `#define`
- Round-trip `.rc` / `.h` / `.res` (Win32 DLGTEMPLATE)
- Tema Win95 clásico (gris `#c0c0c0`, caption azul, bevels, MS Sans Serif)

## 🚀 Cómo usar

```bash
python -m http.server 8080
# Abrir http://localhost:8080/
```

O simplemente abre el [Live Demo](https://fivetechsoft.github.io/brw/).

## 📁 Estructura del proyecto

```
index.html              # SPA shell
css/
  theme-win95.css       # Win95 colores, fuentes, bevels
  windows.css           # MDI window chrome
  editors.css           # Dialog editor, paletas, project tree
js/
  main.js               # Entry point, menús, wiring
  core/                 # Modelo de datos, undo, identifiers
  engine/               # RC parser/compiler, DLGTEMPLATE, RES
  ui/                   # WindowManager, menubar, speedbar, desktop
  windows/              # Project window, Identifiers window
  editors/              # Dialog editor, renderer, paletas, BWCC
samples/                # about.rc, bordlg-demo.rc
tests/                  # Smoke tests (19/19 PASS)
```

## ✅ Estado actual (Fase 1)

| Feature | Estado |
|---------|--------|
| Menú clásico completo | ✅ |
| Project Window (By Type/File, DnD) | ✅ |
| Identifiers Window | ✅ |
| Dialog Editor (select/move/resize/tools) | ✅ |
| Tools + Alignment palettes | ✅ |
| BWCC (BorBtn, BorCheck, BorRadio, BorShade, BorStatic) | ✅ |
| DLGTEMPLATE pack/unpack | ✅ |
| .RES Win32 R/W | ✅ |
| Save Project (.rc + .h + .res) | ✅ |
| Desktop state (localStorage) | ✅ |
| Preferences dialog | ✅ |
| SpeedBar modes (Off/Popup/H/V) | ✅ |
| Grid snap | ✅ |
| Dialog templates | ✅ |
| Multi-selection alignment | ✅ |

## 📦 Roadmap

Ver [`ROADMAP.md`](ROADMAP.md) para el plan completo hacia 1.0 (clon idéntico).

## 📄 Licencia

Proyecto educativo sin fines comerciales.
