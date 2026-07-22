// js/core/app-state.js — desktop layout persistence

const KEY = "brw.desktop.v1";

/**
 * @typedef {object} DesktopState
 * @property {{id:string,x:number,y:number,w:number,h:number,state?:string}[]} [windows]
 * @property {number} [undoLimit]
 * @property {"dialog"|"screen"} [unitMode]
 * @property {"byType"|"byFile"} [sortMode]
 * @property {{showResources?:boolean,showIdentifiers?:boolean,showItems?:boolean,showUnusedTypes?:boolean}} [filters]
 * @property {string[]} [lastPaths]
 * @property {"off"|"popup"|"horizontal"|"vertical"} [speedBarMode]
 * @property {boolean} [gridSnap]
 */

/**
 * @param {DesktopState} state
 */
export function saveDesktop(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("saveDesktop failed", e);
  }
}

/**
 * @returns {DesktopState|null}
 */
export function loadDesktop() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export { KEY as DESKTOP_STORAGE_KEY };
