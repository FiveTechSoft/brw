import { UndoStack } from "./undo-stack.js";
import { IdentifierStore } from "./identifiers.js";
import { DEFAULT_DIALOG_STYLE, WS } from "./constants.js";

/**
 * @typedef {object} Control
 * @property {string|number} id
 * @property {string} className
 * @property {string} text
 * @property {number} x
 * @property {number} y
 * @property {number} cx
 * @property {number} cy
 * @property {number} style
 * @property {number} exStyle
 * @property {number} tabIndex
 * @property {boolean} groupStart
 */

/**
 * @typedef {object} DialogResource
 * @property {"DIALOG"|"DIALOGEX"} type
 * @property {string|number} id
 * @property {number} x
 * @property {number} y
 * @property {number} cx
 * @property {number} cy
 * @property {number} style
 * @property {number} exStyle
 * @property {string} title
 * @property {{name:string,size:number,weight?:number,italic?:boolean}|null} font
 * @property {string|null} className
 * @property {string|number|null} menu
 * @property {string[]} memoryFlags
 * @property {string|null} sourceFile
 * @property {Control[]} controls
 */

/**
 * @typedef {object} OpaqueResource
 * @property {string} type
 * @property {string|number} id
 * @property {string} rawText
 * @property {string[]} memoryFlags
 * @property {string|null} sourceFile
 */

/**
 * @typedef {object} BinaryResource
 * @property {"BINARY"} type
 * @property {number|string} typeId
 * @property {number|string} nameId
 * @property {number} language
 * @property {ArrayBuffer} data
 */

export class ProjectModel {
  constructor() {
    this.name = "Untitled";
    /** @type {{path:string, kind:string, content?: string|ArrayBuffer}[]} */
    this.files = [];
    this.identifiers = new IdentifierStore();
    /** @type {(DialogResource|OpaqueResource|BinaryResource)[]} */
    this.resources = [];
    this.sortMode = "byType";
    this.filters = {
      showResources: true,
      showIdentifiers: true,
      showItems: false,
      showUnusedTypes: false,
    };
    this.undo = new UndoStack(10);
    /** @type {Set<() => void>} */
    this._listeners = new Set();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) fn();
  }

  clear() {
    this.name = "Untitled";
    this.files = [];
    this.identifiers.clear();
    this.resources = [];
    this.undo.clear();
    this._emit();
  }

  /** @returns {DialogResource[]} */
  dialogs() {
    return this.resources.filter((r) => r.type === "DIALOG" || r.type === "DIALOGEX");
  }

  findDialog(id) {
    return this.dialogs().find((d) => String(d.id) === String(id)) || null;
  }

  createDialog(idName = null) {
    const { name, value } = idName
      ? { name: idName, value: this.identifiers.getValue(idName) ?? this.identifiers.nextId("IDD_").value }
      : this.identifiers.nextId("IDD_");
    if (!this.identifiers.getByName(name)) this.identifiers.define(name, value);
    /** @type {DialogResource} */
    const dlg = {
      type: "DIALOG",
      id: name,
      x: 0, y: 0, cx: 200, cy: 100,
      style: DEFAULT_DIALOG_STYLE,
      exStyle: 0,
      title: name,
      font: { name: "MS Sans Serif", size: 8 },
      className: null,
      menu: null,
      memoryFlags: ["DISCARDABLE", "MOVEABLE"],
      sourceFile: null,
      controls: [],
    };
    const idx = this.resources.length;
    this.resources.push(dlg);
    this.undo.push({
      label: "New Dialog",
      undo: () => { this.resources.splice(idx, 1); this._emit(); },
      redo: () => { this.resources.splice(idx, 0, dlg); this._emit(); },
    });
    this._emit();
    return dlg;
  }

  /**
   * Replace dialog fields (shallow assign). Pushes undo.
   * @param {DialogResource} dialog
   * @param {Partial<DialogResource>} props
   */
  setDialogProps(dialog, props) {
    const after = { ...props };
    const before = {};
    for (const k of Object.keys(props)) before[k] = dialog[k];
    Object.assign(dialog, props);
    this.undo.push({
      label: "Dialog props",
      undo: () => { Object.assign(dialog, before); this._emit(); },
      redo: () => { Object.assign(dialog, after); this._emit(); },
    });
    this._emit();
  }

  addControl(dialog, control) {
    if (control.tabIndex == null) control.tabIndex = dialog.controls.length;
    if (control.groupStart == null) control.groupStart = false;
    if (control.exStyle == null) control.exStyle = 0;
    dialog.controls.push(control);
    this.undo.push({
      label: "Add control",
      undo: () => { dialog.controls.pop(); this._emit(); },
      redo: () => { dialog.controls.push(control); this._emit(); },
    });
    this._emit();
  }

  removeControls(dialog, controls) {
    const snapshot = controls.map((c) => ({ c, i: dialog.controls.indexOf(c) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i);
    for (let i = snapshot.length - 1; i >= 0; i--) {
      dialog.controls.splice(snapshot[i].i, 1);
    }
    this.undo.push({
      label: "Delete controls",
      undo: () => {
        for (const { c, i } of snapshot) dialog.controls.splice(i, 0, c);
        this._emit();
      },
      redo: () => {
        for (let i = snapshot.length - 1; i >= 0; i--) {
          dialog.controls.splice(snapshot[i].i, 1);
        }
        this._emit();
      },
    });
    this._emit();
  }

  setControlProps(control, props) {
    const before = {};
    for (const k of Object.keys(props)) before[k] = control[k];
    const after = { ...props };
    Object.assign(control, props);
    this.undo.push({
      label: "Control props",
      undo: () => { Object.assign(control, before); this._emit(); },
      redo: () => { Object.assign(control, after); this._emit(); },
    });
    this._emit();
  }

  moveResizeControl(control, rect) {
    const before = { x: control.x, y: control.y, cx: control.cx, cy: control.cy };
    Object.assign(control, rect);
    this.undo.push({
      label: "Move/resize",
      undo: () => { Object.assign(control, before); this._emit(); },
      redo: () => { Object.assign(control, rect); this._emit(); },
    });
    this._emit();
  }

  /** Rename identifier and cascade into dialog/control ids */
  renameIdentifier(oldName, newName) {
    if (!this.identifiers.rename(oldName, newName)) return;
    for (const r of this.resources) {
      if (r.type === "DIALOG" || r.type === "DIALOGEX") {
        if (String(r.id) === oldName) r.id = newName;
        for (const c of r.controls) {
          if (String(c.id) === oldName) c.id = newName;
        }
      }
    }
    this.undo.push({
      label: "Rename id",
      undo: () => {
        this.identifiers.rename(newName, oldName);
        for (const r of this.resources) {
          if (r.type === "DIALOG" || r.type === "DIALOGEX") {
            if (String(r.id) === newName) r.id = oldName;
            for (const c of r.controls) if (String(c.id) === newName) c.id = oldName;
          }
        }
        this._emit();
      },
      redo: () => {
        this.identifiers.rename(oldName, newName);
        for (const r of this.resources) {
          if (r.type === "DIALOG" || r.type === "DIALOGEX") {
            if (String(r.id) === oldName) r.id = newName;
            for (const c of r.controls) if (String(c.id) === oldName) c.id = newName;
          }
        }
        this._emit();
      },
    });
    this._emit();
  }

  setIdentifierValue(name, value) {
    const id = this.identifiers.getByName(name);
    if (!id) return;
    const prev = id.value;
    this.identifiers.setValue(name, value);
    this.undo.push({
      label: "Id value",
      undo: () => { this.identifiers.setValue(name, prev); this._emit(); },
      redo: () => { this.identifiers.setValue(name, value); this._emit(); },
    });
    this._emit();
  }

  recomputeUsage() {
    /** @type {Map<string, string[]>} */
    const usage = new Map();
    const add = (name, tag) => {
      if (typeof name !== "string") return;
      if (!usage.has(name)) usage.set(name, []);
      usage.get(name).push(tag);
    };
    for (const r of this.resources) {
      if (r.type === "DIALOG" || r.type === "DIALOGEX") {
        add(r.id, `DIALOG:${r.id}`);
        for (const c of r.controls) add(c.id, `CONTROL:${r.id}/${c.id}`);
      }
    }
    return usage;
  }
}

export function defaultControl(partial) {
  return {
    id: -1,
    className: "BUTTON",
    text: "",
    x: 10, y: 10, cx: 50, cy: 14,
    style: WS.CHILD | WS.VISIBLE | WS.TABSTOP,
    exStyle: 0,
    tabIndex: 0,
    groupStart: false,
    ...partial,
  };
}
