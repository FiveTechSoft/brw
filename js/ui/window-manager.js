// js/ui/window-manager.js
let zCounter = 100;

export class WindowManager {
  /**
   * @param {HTMLElement} desktopEl
   * @param {HTMLElement} taskstripEl
   */
  constructor(desktopEl, taskstripEl) {
    this.desktop = desktopEl;
    this.taskstrip = taskstripEl;
    /** @type {Map<string, object>} */
    this.windows = new Map();
  }

  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.title
   * @param {number} [opts.x]
   * @param {number} [opts.y]
   * @param {number} [opts.w]
   * @param {number} [opts.h]
   * @param {boolean} [opts.modal]
   * @param {() => void} [opts.onClose]
   * @returns {{ root: HTMLElement, content: HTMLElement, setTitle: (t:string)=>void, close: ()=>void, focus: ()=>void }}
   */
  createWindow(opts) {
    const id = opts.id;
    if (this.windows.has(id)) {
      this.focus(id);
      return this.windows.get(id).api;
    }
    const root = document.createElement("div");
    root.className = "mdi-window" + (opts.modal ? " modal" : "");
    const modal = !!opts.modal;
    root.dataset.winId = id;
    root.style.left = (opts.x ?? 40) + "px";
    root.style.top = (opts.y ?? 40) + "px";
    root.style.width = (opts.w ?? 400) + "px";
    root.style.height = (opts.h ?? 300) + "px";
    root.style.zIndex = String(++zCounter);

    root.innerHTML = `
      <div class="mdi-titlebar">
        <span class="mdi-title"></span>
        <div class="mdi-sysbtns">
          <button type="button" data-act="min" title="Minimize">_</button>
          <button type="button" data-act="max" title="Maximize">□</button>
          <button type="button" data-act="close" title="Close">×</button>
        </div>
      </div>
      <div class="mdi-content"></div>
      <div class="mdi-resize" data-dir="e"></div>
      <div class="mdi-resize" data-dir="s"></div>
      <div class="mdi-resize" data-dir="se"></div>
    `;
    const titleEl = root.querySelector(".mdi-title");
    titleEl.textContent = opts.title;
    const content = root.querySelector(".mdi-content");

    const state = {
      id,
      root,
      content,
      titleEl,
      opts,
      state: "normal",
      restore: null,
      api: null,
      taskBtn: null,
    };
    this.windows.set(id, state);
    this.desktop.appendChild(root);
    if (modal) {
      const maxBtn = root.querySelector('[data-act="max"]');
      if (maxBtn) maxBtn.style.display = "none";
    }
    this._wire(state);
    this._addTaskButton(state);

    const api = {
      root,
      content,
      setTitle: (t) => {
        titleEl.textContent = t;
        opts.title = t;
        if (state.taskBtn) state.taskBtn.textContent = t;
      },
      close: () => this.close(id),
      focus: () => this.focus(id),
    };
    state.api = api;
    this.focus(id);
    return api;
  }

  focus(id) {
    const w = this.windows.get(id);
    if (!w) return;
    if (w.state === "min") {
      w.root.style.display = "";
      w.state = "normal";
    }
    w.root.style.zIndex = String(++zCounter);
    w.root.classList.add("focused");
    for (const [oid, ow] of this.windows) {
      if (oid !== id) {
        ow.root.classList.remove("focused");
        ow.taskBtn?.classList.remove("active");
      }
    }
    w.taskBtn?.classList.add("active");
  }

  close(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.root.remove();
    w.taskBtn?.remove();
    this.windows.delete(id);
    w.opts.onClose?.();
  }

  getLayout() {
    return [...this.windows.values()].map((w) => ({
      id: w.id,
      x: parseInt(w.root.style.left, 10) || 0,
      y: parseInt(w.root.style.top, 10) || 0,
      w: w.root.offsetWidth,
      h: w.root.offsetHeight,
      state: w.state,
    }));
  }

  applyLayout(list) {
    for (const L of list || []) {
      const w = this.windows.get(L.id);
      if (!w) continue;
      w.root.style.left = L.x + "px";
      w.root.style.top = L.y + "px";
      w.root.style.width = L.w + "px";
      w.root.style.height = L.h + "px";
      w.state = L.state || "normal";
      if (w.state === "min") {
        w.root.style.display = "none";
      } else {
        w.root.style.display = "";
      }
    }
  }

  _addTaskButton(state) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "task-btn";
    btn.textContent = state.opts.title;
    btn.addEventListener("click", () => {
      if (state.state === "min") {
        state.root.style.display = "";
        state.state = "normal";
      }
      this.focus(state.id);
    });
    this.taskstrip.appendChild(btn);
    state.taskBtn = btn;
  }

  _wire(state) {
    const { root } = state;
    const bar = root.querySelector(".mdi-titlebar");
    root.addEventListener("mousedown", () => this.focus(state.id));

    // drag
    bar.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      if (state.state === "max") return;
      e.preventDefault();
      const sx = e.clientX;
      const sy = e.clientY;
      const sl = root.offsetLeft;
      const st = root.offsetTop;
      const move = (ev) => {
        root.style.left = sl + ev.clientX - sx + "px";
        root.style.top = st + ev.clientY - sy + "px";
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up); this.onLayoutChange?.();
    });

    bar.addEventListener("dblclick", () => this._toggleMax(state));

    root.querySelector('[data-act="close"]').onclick = () => this.close(state.id);
    root.querySelector('[data-act="min"]').onclick = () => {
      root.style.display = "none";
      state.state = "min";
      state.root.classList.remove("focused");
      state.taskBtn?.classList.remove("active");
    };
    root.querySelector('[data-act="max"]').onclick = () => this._toggleMax(state);

    // resize se/e/s
    for (const handle of root.querySelectorAll(".mdi-resize")) {
      handle.addEventListener("mousedown", (e) => {
        if (state.state === "max") return;
        e.preventDefault();
        e.stopPropagation();
        const dir = handle.dataset.dir;
        const sx = e.clientX;
        const sy = e.clientY;
        const sw = root.offsetWidth;
        const sh = root.offsetHeight;
        const move = (ev) => {
          if (dir.includes("e")) root.style.width = Math.max(200, sw + ev.clientX - sx) + "px";
          if (dir.includes("s")) root.style.height = Math.max(120, sh + ev.clientY - sy) + "px";
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up); this.onLayoutChange?.();
      });
    }
  }

  _toggleMax(state) {
    const { root } = state;
    if (state.state === "max") {
      const r = state.restore;
      if (r) {
        root.style.left = r.left;
        root.style.top = r.top;
        root.style.width = r.width;
        root.style.height = r.height;
      }
      state.state = "normal";
    } else {
      if (state.state === "min") {
        root.style.display = "";
      }
      state.restore = {
        left: root.style.left,
        top: root.style.top,
        width: root.style.width,
        height: root.style.height,
      };
      root.style.left = "0";
      root.style.top = "0";
      root.style.width = "100%";
      root.style.height = "100%";
      state.state = "max";
    }
  }
}
