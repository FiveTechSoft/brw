export class UndoStack {
  constructor(limit = 10) {
    this.limit = Math.min(99, Math.max(1, limit));
    this._undo = [];
    this._redo = [];
  }
  get canUndo() { return this._undo.length > 0; }
  get canRedo() { return this._redo.length > 0; }
  get undoLabel() { return this.canUndo ? this._undo[this._undo.length - 1].label : ""; }
  get redoLabel() { return this.canRedo ? this._redo[this._redo.length - 1].label : ""; }
  setLimit(n) {
    this.limit = Math.min(99, Math.max(1, n | 0));
    while (this._undo.length > this.limit) this._undo.shift();
  }
  /** Call AFTER applying the forward change. */
  push(command) {
    this._undo.push(command);
    while (this._undo.length > this.limit) this._undo.shift();
    this._redo.length = 0;
  }
  undo() {
    if (!this.canUndo) return;
    const cmd = this._undo.pop();
    cmd.undo();
    this._redo.push(cmd);
  }
  redo() {
    if (!this.canRedo) return;
    const cmd = this._redo.pop();
    cmd.redo();
    this._undo.push(cmd);
    while (this._undo.length > this.limit) this._undo.shift();
  }
  clear() {
    this._undo.length = 0;
    this._redo.length = 0;
  }
}
