/**
 * @typedef {{ name: string, value: number, sourceFile: string }} Identifier
 */

export class IdentifierStore {
  constructor() {
    /** @type {Map<string, Identifier>} */
    this._byName = new Map();
  }

  list() {
    return [...this._byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  getByName(name) { return this._byName.get(name) || null; }

  getValue(name) {
    const id = this._byName.get(name);
    return id ? id.value : null;
  }

  resolve(idOrName) {
    if (typeof idOrName === "number") return idOrName;
    if (/^-?\d+$/.test(idOrName)) return parseInt(idOrName, 10);
    if (/^0x[0-9a-fA-F]+$/.test(idOrName)) return parseInt(idOrName, 16);
    return this.getValue(idOrName);
  }

  define(name, value, sourceFile = "resource.h") {
    this._byName.set(name, { name, value: value | 0, sourceFile });
  }

  remove(name) { this._byName.delete(name); }

  rename(oldName, newName) {
    const id = this._byName.get(oldName);
    if (!id) return false;
    if (oldName !== newName && this._byName.has(newName)) {
      throw new Error(`Identifier ${newName} already exists`);
    }
    this._byName.delete(oldName);
    id.name = newName;
    this._byName.set(newName, id);
    return true;
  }

  setValue(name, value) {
    const id = this._byName.get(name);
    if (!id) return false;
    id.value = value | 0;
    return true;
  }

  nextId(prefix, start = 100) {
    let n = start;
    const used = new Set(this.list().map((i) => i.value));
    while (used.has(n)) n++;
    let i = 1;
    let name = `${prefix}${i}`;
    while (this._byName.has(name)) { i++; name = `${prefix}${i}`; }
    return { name, value: n };
  }

  toHeaderText() {
    return this.list()
      .map((id) => `#define ${id.name} ${id.value}`)
      .join("\n") + (this._byName.size ? "\n" : "");
  }

  clear() { this._byName.clear(); }
}
