/**
 * Dialog Editor â€” select/move/resize, tools, test mode.
 */
import { WS, STD_ID } from "../core/constants.js";
import { defaultControl } from "../core/project-model.js";
import { renderDialog, duToPx, pxToDu, fontMetrics } from "./dialog-renderer.js";
import { openStyleDialog } from "./dialog-styles.js";

/**
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {import('../core/project-model.js').ProjectModel} project
 * @param {import('../core/project-model.js').DialogResource} dialog
 * @param {{ unitMode?: "dialog"|"screen", onUnitMode?: (m:string)=>void, getPlaceDef?: () => object|null, clearPlaceDef?: () => void, onSelectionChange?: (sel: Set<object>) => void, gridSnap?: boolean }} [opts]
 */
export function openDialogEditor(wm, project, dialog, opts = {}) {
  const winId = `dialog-editor:${dialog.id}`;
  if (wm.windows.has(winId)) {
    wm.focus(winId);
    return wm.windows.get(winId).api;
  }

  /** @type {"select"|"tab"|"group"|"order"} */
  let tool = "select";
  let unitMode = opts.unitMode || "dialog";
  const gridSnap = opts.gridSnap !== false;
  /** @type {Set<object>} */
  let selection = new Set();
  let tabAssign = 0;
  let orderAssign = 0;
  let unsub = null;

  const win = wm.createWindow({
    id: winId,
    title: `DIALOG : ${dialog.id}`,
    x: 180,
    y: 30,
    w: 560,
    h: 460,
    onClose: () => {
      if (unsub) unsub();
      window.removeEventListener("keydown", onKey);
    },
  });

  const root = document.createElement("div");
  root.className = "dialog-editor";
  root.tabIndex = 0;

  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";
  const tools = [
    ["select", "Select"],
    ["tab", "Tab"],
    ["group", "Group"],
    ["order", "Order"],
    ["test", "Test"],
    ["dup", "Duplicate"],
    ["undo", "Undo"],
  ];
  /** @type {Record<string, HTMLButtonElement>} */
  const toolBtns = {};
  for (const [id, label] of tools) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "win-btn tool-btn";
    b.dataset.tool = id;
    b.textContent = label;
    toolbar.appendChild(b);
    toolBtns[id] = b;
  }

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "editor-canvas-wrap";

  const status = document.createElement("div");
  status.className = "editor-status";
  status.innerHTML = `<button type="button" class="unit-toggle win-btn">Dialog</button> <span class="status-info"></span>`;

  root.appendChild(toolbar);
  root.appendChild(canvasWrap);
  root.appendChild(status);
  win.content.innerHTML = "";
  win.content.appendChild(root);

  function setTool(t) {
    tool = t;
    for (const [id, b] of Object.entries(toolBtns)) {
      b.classList.toggle("active", id === t);
    }
    if (t === "tab") tabAssign = 0;
    if (t === "order") orderAssign = 0;
    repaint();
  }

  toolBtns.select.onclick = () => setTool("select");
  toolBtns.tab.onclick = () => setTool("tab");
  toolBtns.group.onclick = () => setTool("group");
  toolBtns.order.onclick = () => setTool("order");
  toolBtns.test.onclick = () => openTestDialog(wm, project, dialog);
  toolBtns.dup.onclick = () => duplicateSelection();
  toolBtns.undo.onclick = () => {
    if (project.undo.canUndo) project.undo.undo();
  };

  status.querySelector(".unit-toggle").onclick = () => {
    unitMode = unitMode === "dialog" ? "screen" : "dialog";
    status.querySelector(".unit-toggle").textContent =
      unitMode === "dialog" ? "Dialog" : "Screen";
    opts.onUnitMode?.(unitMode);
    updateStatus();
  };

  function updateStatus() {
    const info = status.querySelector(".status-info");
    const gridLabel = unitMode === "screen" ? "Screen" : "Absolute Grid";
    if (!selection.size) {
      info.textContent = `Modify , ${gridLabel}  x: ${dialog.x} y: ${dialog.y} cx: ${dialog.cx} cy: ${dialog.cy}  ID: ${dialog.id}`;
      // global status bar if present
      const sb = document.getElementById("sb-detail");
      if (sb) sb.textContent = info.textContent;
      return;
    }
    const c = [...selection][0];
    const order = dialog.controls.indexOf(c);
    const font = dialog.font;
    let x = c.x, y = c.y, cx = c.cx, cy = c.cy;
    if (unitMode === "screen") {
      const r = duToPx(c.x, c.y, c.cx, c.cy, font);
      x = r.x; y = r.y; cx = r.cx; cy = r.cy;
    }
    info.textContent = `Modify , ${gridLabel}  x: ${x} y: ${y} cx: ${cx} cy: ${cy}  Order: ${order >= 0 ? order : 0} ID: ${c.id}`;
    const sb = document.getElementById("sb-detail");
    if (sb) sb.textContent = info.textContent;
  }

  function repaint() {
    win.setTitle(`DIALOG : ${dialog.id}`);
    const placeDef = opts.getPlaceDef?.() || null;
    canvasWrap.style.cursor = placeDef ? "crosshair" : "default";

    renderDialog(canvasWrap, dialog, {
      interactive: false,
      selectedIds: selection,
      scale: 1,
      unitMode,
      project,
      showTabOrder: tool === "tab" || tool === "order",
      showHandles: tool === "select",
      onControlClick: (ctl, ev) => onControlMouseDown(ctl, ev),
    });

    // Canvas background click for place / clear selection
    const canvas = canvasWrap.querySelector(".dialog-canvas");
    if (canvas) {
      canvas.addEventListener("mousedown", (ev) => {
        if (ev.target !== canvas && !ev.target.classList.contains("dialog-canvas")) return;
        const place = opts.getPlaceDef?.();
        if (place) {
          placeControl(place, ev, canvas);
          return;
        }
        if (tool === "select" && !ev.shiftKey) {
          selection = new Set();
          repaint();
        }
      });
    }

    // Wire resize handles / drag on selected
    wireManipulation();
    updateStatus();
  }

  /**
   * @param {object} ctl
   * @param {MouseEvent} ev
   */
  function onControlMouseDown(ctl, ev) {
    if (tool === "tab") {
      project.setControlProps(ctl, { tabIndex: tabAssign++ });
      // also reorder visual hint only
      repaint();
      return;
    }
    if (tool === "group") {
      const next = !ctl.groupStart;
      const style = next ? (ctl.style | WS.GROUP) : (ctl.style & ~WS.GROUP);
      project.setControlProps(ctl, { groupStart: next, style: style | 0 });
      return;
    }
    if (tool === "order") {
      const arr = dialog.controls;
      const before = arr.slice();
      const from = arr.indexOf(ctl);
      if (from < 0) return;
      arr.splice(from, 1);
      const to = Math.min(orderAssign, arr.length);
      arr.splice(to, 0, ctl);
      orderAssign++;
      arr.forEach((c, i) => {
        c.tabIndex = i;
      });
      const after = arr.slice();
      project.undo.push({
        label: "Reorder",
        undo: () => {
          dialog.controls.length = 0;
          dialog.controls.push(...before);
          before.forEach((c, i) => {
            c.tabIndex = i;
          });
          project._emit();
        },
        redo: () => {
          dialog.controls.length = 0;
          dialog.controls.push(...after);
          after.forEach((c, i) => {
            c.tabIndex = i;
          });
          project._emit();
        },
      });
      project._emit();
      repaint();
      return;
    }

    // select tool
    if (ev.detail === 2) {
      openStyleDialog(wm, ctl, "control", (props) => {
        // id rename via identifiers if string changes
        if (props.id != null && props.id !== ctl.id && typeof ctl.id === "string" && typeof props.id === "string") {
          try {
            project.renameIdentifier(ctl.id, props.id);
          } catch {
            project.setControlProps(ctl, props);
            return;
          }
          const { id, ...rest } = props;
          if (Object.keys(rest).length) project.setControlProps(ctl, rest);
          return;
        }
        project.setControlProps(ctl, props);
      });
      return;
    }

    if (ev.shiftKey) {
      if (selection.has(ctl)) selection.delete(ctl);
      else selection.add(ctl);
    } else if (!selection.has(ctl)) {
      selection = new Set([ctl]);
    }
    repaint();

    // begin drag move
    if (tool === "select" && !(ev.target && ev.target.classList?.contains("resize-handle"))) {
      beginMove(ctl, ev);
    }
  }

  /**
   * @param {object} place
   * @param {MouseEvent} ev
   * @param {HTMLElement} canvas
   */
  function placeControl(place, ev, canvas) {
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const du = pxToDu(px, py, place.cx || 50, place.cy || 14, dialog.font);
    const { name, value } = project.identifiers.nextId("IDC_");
    project.identifiers.define(name, value);
    const ctl = defaultControl({
      id: name,
      className: place.className,
      text: place.text ?? "",
      style: place.style,
      x: du.x,
      y: du.y,
      cx: place.cx || 50,
      cy: place.cy || 14,
    });
    project.addControl(dialog, ctl);
    selection = new Set([ctl]);
    opts.clearPlaceDef?.();
    repaint();
  }

  function beginMove(ctl, ev) {
    const startX = ev.clientX;
    const startY = ev.clientY;
    const font = dialog.font;
    const m = fontMetrics(font);
    const originals = [...selection].map((c) => ({
      c,
      x: c.x,
      y: c.y,
      cx: c.cx,
      cy: c.cy,
    }));

    const move = (e) => {
      const dxPx = e.clientX - startX;
      const dyPx = e.clientY - startY;
      const dx = Math.round((dxPx * 4) / m.avgCharWidth);
      const dy = Math.round((dyPx * 8) / m.fontHeight);
      for (const o of originals) {
        o.c.x = o.x + dx;
        o.c.y = o.y + dy;
      }
      // live paint without undo
      renderLive();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      // commit via moveResizeControl for first; batch manually
      for (const o of originals) {
        const after = { x: o.c.x, y: o.c.y, cx: o.c.cx, cy: o.c.cy };
        // restore before for undo snapshot
        o.c.x = o.x;
        o.c.y = o.y;
        if (after.x !== o.x || after.y !== o.y) {
          project.moveResizeControl(o.c, after);
        }
      }
      repaint();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function wireManipulation() {
    for (const ctl of selection) {
      const el = canvasWrap.querySelector(`[data-ctl-id="${cssEscape(String(ctl.id))}"]`);
      if (!el) continue;
      for (const handle of el.querySelectorAll(".resize-handle")) {
        handle.addEventListener("mousedown", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          beginResize(ctl, handle.dataset.handle, ev);
        });
      }
    }

    // Double-click caption â†’ dialog styles
    const cap = canvasWrap.querySelector(".dialog-caption");
    if (cap) {
      cap.addEventListener("dblclick", () => {
        openStyleDialog(wm, dialog, "dialog", (props) => {
          if (props.id != null && props.id !== dialog.id && typeof dialog.id === "string" && typeof props.id === "string") {
            try {
              project.renameIdentifier(dialog.id, props.id);
            } catch {
              /* ignore */
            }
            const { id, ...rest } = props;
            if (Object.keys(rest).length) project.setDialogProps(dialog, rest);
            return;
          }
          project.setDialogProps(dialog, props);
        });
      });
    }
  }

  function beginResize(ctl, handle, ev) {
    const startX = ev.clientX;
    const startY = ev.clientY;
    const before = { x: ctl.x, y: ctl.y, cx: ctl.cx, cy: ctl.cy };
    const m = fontMetrics(dialog.font);

    const move = (e) => {
      const dx = Math.round(((e.clientX - startX) * 4) / m.avgCharWidth);
      const dy = Math.round(((e.clientY - startY) * 8) / m.fontHeight);
      let { x, y, cx, cy } = before;
      if (handle.includes("e")) cx = Math.max(1, before.cx + dx);
      if (handle.includes("s")) cy = Math.max(1, before.cy + dy);
      if (handle.includes("w")) {
        x = before.x + dx;
        cx = Math.max(1, before.cx - dx);
      }
      if (handle.includes("n")) {
        y = before.y + dy;
        cy = Math.max(1, before.cy - dy);
      }
      ctl.x = x;
      ctl.y = y;
      ctl.cx = cx;
      ctl.cy = cy;
      renderLive();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const after = { x: ctl.x, y: ctl.y, cx: ctl.cx, cy: ctl.cy };
      Object.assign(ctl, before);
      if (after.x !== before.x || after.y !== before.y || after.cx !== before.cx || after.cy !== before.cy) {
        project.moveResizeControl(ctl, after);
      }
      repaint();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function renderLive() {
    renderDialog(canvasWrap, dialog, {
      interactive: false,
      selectedIds: selection,
      scale: 1,
      project,
      showTabOrder: tool === "tab" || tool === "order",
      showHandles: false,
      onControlClick: () => {},
    });
  }

  function duplicateSelection() {
    if (!selection.size) return;
    const created = [];
    for (const c of selection) {
      const { name, value } = project.identifiers.nextId("IDC_");
      project.identifiers.define(name, value);
      const clone = defaultControl({
        ...c,
        id: name,
        x: c.x + 8,
        y: c.y + 8,
        text: c.text,
        className: c.className,
        style: c.style,
        exStyle: c.exStyle,
      });
      project.addControl(dialog, clone);
      created.push(clone);
    }
    selection = new Set(created);
    repaint();
  }

  function onKey(ev) {
    // only when this window focused
    if (!win.root.classList.contains("focused")) return;
    const tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (ev.key === "Delete" || ev.key === "Backspace") {
      if (selection.size) {
        ev.preventDefault();
        project.removeControls(dialog, [...selection]);
        selection = new Set();
        repaint();
      }
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      if (project.undo.canUndo) project.undo.undo();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
      ev.preventDefault();
      if (project.undo.canRedo) project.undo.redo();
    }
  }
  window.addEventListener("keydown", onKey);

  unsub = project.subscribe(() => {
    // drop selection refs removed
    selection = new Set([...selection].filter((c) => dialog.controls.includes(c)));
    if (!project.resources.includes(dialog) && !project.dialogs().includes(dialog)) {
      win.close();
      return;
    }
    repaint();
  });

  setTool("select");
  repaint();
  root.focus();
  return win;
}

/**
 * Live Test Dialog modal.
 * @param {import('../ui/window-manager.js').WindowManager} wm
 * @param {import('../core/project-model.js').ProjectModel} project
 * @param {import('../core/project-model.js').DialogResource} dialog
 */
export function openTestDialog(wm, project, dialog) {
  const winId = `test-dialog:${dialog.id}`;
  if (wm.windows.has(winId)) {
    wm.focus(winId);
    return wm.windows.get(winId).api;
  }

  const win = wm.createWindow({
    id: winId,
    title: `Test - ${dialog.title || dialog.id}`,
    x: 220,
    y: 80,
    w: 400,
    h: 300,
    modal: true,
  });

  const host = document.createElement("div");
  host.className = "test-dialog-host";
  win.content.innerHTML = "";
  win.content.appendChild(host);

  const { controlEls } = renderDialog(host, dialog, {
    interactive: true,
    scale: 1,
    project,
    showHandles: false,
    onControlClick: (ctl) => {
      // click activates buttons
      const num = project.identifiers.resolve(ctl.id);
      if (num === STD_ID.IDOK || num === STD_ID.IDCANCEL || String(ctl.id) === "IDOK" || String(ctl.id) === "IDCANCEL" || String(ctl.id) === "IDC_OK" || String(ctl.id) === "IDC_CANCEL") {
        win.close();
      }
    },
  });

  // Make focusable controls
  const focusable = [];
  for (const [ctl, el] of controlEls) {
    if ((ctl.style & WS.TABSTOP) === WS.TABSTOP || /BorBtn|BUTTON|EDIT|BorCheck|BorRadio/i.test(String(ctl.className))) {
      el.tabIndex = ctl.tabIndex ?? 0;
      el.classList.add("test-focusable");
      if (/^BorBtn$/i.test(String(ctl.className))) {
        el.addEventListener("focus", () => {
          console.debug("BBN_SETFOCUS", ctl.id);
        });
        el.addEventListener("mousedown", () => {
          console.debug("BBN_SETFOCUSMOUSE", ctl.id);
        });
      }
      // IDOK / IDCANCEL via keyboard-like click
      el.addEventListener("click", () => {
        const num = project.identifiers.resolve(ctl.id);
        const sid = String(ctl.id);
        if (
          num === STD_ID.IDOK ||
          num === STD_ID.IDCANCEL ||
          sid === "IDOK" ||
          sid === "IDCANCEL" ||
          sid === "IDC_OK" ||
          sid === "IDC_CANCEL"
        ) {
          win.close();
        }
      });
      // make real buttons keyboard accessible
      if (!/EDIT/i.test(String(ctl.className))) {
        el.setAttribute("role", "button");
      } else {
        el.contentEditable = "true";
      }
      focusable.push({ ctl, el });
    }
  }

  focusable.sort((a, b) => (a.ctl.tabIndex ?? 0) - (b.ctl.tabIndex ?? 0));
  if (focusable[0]) focusable[0].el.focus();

  host.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      win.close();
      return;
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      const list = focusable.map((f) => f.el);
      if (!list.length) return;
      const idx = list.indexOf(document.activeElement);
      let next = ev.shiftKey ? idx - 1 : idx + 1;
      if (next < 0) next = list.length - 1;
      if (next >= list.length) next = 0;
      list[next].focus();
      const f = focusable[next];
      if (f && /^BorBtn$/i.test(String(f.ctl.className))) {
        console.debug("BBN_GOTATAB", f.ctl.id);
      }
    }
    if (ev.key === "Enter") {
      // default button
      const def = dialog.controls.find((c) => (c.style & 0x0f) === 1);
      if (def) {
        const num = project.identifiers.resolve(def.id);
        if (num === STD_ID.IDOK || String(def.id).includes("OK")) win.close();
      }
    }
  });

  return win;
}

function cssEscape(s) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return String(s).replace(/"/g, '\\"');
}



