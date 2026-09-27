/* Core renderer helpers: escaping, icons, stacked modals, toasts and dialogs. */
(function () {
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
  }

  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) || "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  const ICONS = {
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>',
    restart: '<path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
    fit: '<path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4"/>',
    layout: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4M17.5 10v4"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    arrowUp: '<polyline points="18 15 12 9 6 15"/>',
    arrowDown: '<polyline points="6 9 12 15 18 9"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  };

  function icon(name, size = 16, extra = "") {
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name] || ""}</svg>`;
  }

  // ------------------------------------------------------------ modal stack
  const stack = [];

  function root() {
    let r = document.getElementById("modal-root");
    if (!r) {
      r = document.createElement("div");
      r.id = "modal-root";
      document.body.appendChild(r);
    }
    return r;
  }

  /**
   * Open a modal on top of any open ones.
   * showModal(html, onMount, { size: "sm"|"md"|"lg"|"xl"|"full", dismissible, onClose })
   */
  function showModal(html, onMount, opts = {}) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal-container modal-${opts.size || "md"}" role="dialog" aria-modal="true">${html}</div>`;
    root().appendChild(overlay);
    const container = overlay.firstElementChild;
    const entry = { overlay, container, opts };
    stack.push(entry);
    overlay.addEventListener("mousedown", (e) => {
      entry.downOnOverlay = e.target === overlay;
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && entry.downOnOverlay && opts.dismissible !== false) closeModal(entry);
    });
    requestAnimationFrame(() => overlay.classList.add("open"));
    if (onMount) onMount(container, () => closeModal(entry));
    const firstInput = container.querySelector("[autofocus]");
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
    return { container, close: () => closeModal(entry) };
  }

  function closeModal(entry) {
    const idx = stack.indexOf(entry);
    if (idx === -1) return;
    if (entry.opts.beforeClose && entry.opts.beforeClose() === false) return;
    stack.splice(idx, 1);
    entry.overlay.classList.remove("open");
    entry.overlay.classList.add("closing");
    setTimeout(() => entry.overlay.remove(), 160);
    if (entry.opts.onClose) entry.opts.onClose();
  }

  function hideModal() {
    if (stack.length) closeModal(stack[stack.length - 1]);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stack.length) {
      const top = stack[stack.length - 1];
      if (top.opts.dismissible !== false) {
        e.stopPropagation();
        closeModal(top);
      }
    }
  }, true);

  // ------------------------------------------------------------------ toast
  const TOAST_ICON = { success: "check", error: "alert", warning: "alert", info: "info" };
  function showToast(message, type = "info", timeout = 3200) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icon(TOAST_ICON[type] || "info", 16)}<span></span>`;
    toast.querySelector("span").textContent = message;
    container.appendChild(toast);
    const remove = () => {
      toast.classList.add("leaving");
      setTimeout(() => toast.remove(), 250);
    };
    toast.onclick = remove;
    setTimeout(remove, type === "error" ? Math.max(timeout, 6000) : timeout);
  }

  // ---------------------------------------------------------------- dialogs
  function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Confirm", danger = false } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      showModal(`
        <div class="dialog">
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          ${message ? `<p class="dialog-text">${escapeHtml(message)}</p>` : ""}
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="cancel">Cancel</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="ok" autofocus>${escapeHtml(confirmText)}</button>
          </div>
        </div>`, (c, close) => {
        c.querySelector('[data-act="cancel"]').onclick = () => close();
        c.querySelector('[data-act="ok"]').onclick = () => { answered = true; resolve(true); close(); };
      }, { size: "sm", onClose: () => { if (!answered) resolve(false); } });
    });
  }

  function promptDialog({ title = "Enter a value", label = "", value = "", placeholder = "", confirmText = "OK", validate } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      showModal(`
        <div class="dialog">
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          <div class="input-group">
            ${label ? `<label class="input-label">${escapeHtml(label)}</label>` : ""}
            <input class="input" data-el="value" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autofocus />
            <div class="input-error" data-el="error"></div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="cancel">Cancel</button>
            <button class="btn btn-primary" data-act="ok">${escapeHtml(confirmText)}</button>
          </div>
        </div>`, (c, close) => {
        const input = c.querySelector('[data-el="value"]');
        const submit = () => {
          const v = input.value.trim();
          const err = validate ? validate(v) : null;
          if (err) { c.querySelector('[data-el="error"]').textContent = err; return; }
          answered = true;
          resolve(v);
          close();
        };
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
        c.querySelector('[data-act="cancel"]').onclick = () => close();
        c.querySelector('[data-act="ok"]').onclick = submit;
        setTimeout(() => input.select(), 60);
      }, { size: "sm", onClose: () => { if (!answered) resolve(null); } });
    });
  }

  function openExternal(url) {
    window.api.shell.openExternal(url).catch(() => showToast("Could not open link", "error"));
  }

  Object.assign(window, { escapeHtml, uid, debounce, clone, icon, showModal, hideModal, showToast, confirmDialog, promptDialog, openExternal });
})();
