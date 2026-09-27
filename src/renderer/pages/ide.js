/* Code IDE: browse and edit the generated bot code with Monaco. */
(function () {
  let editor = null;
  let currentFile = null;
  let dirty = false;
  let monacoLoading = null;

  function loadMonaco() {
    if (window.monaco) return Promise.resolve();
    if (monacoLoading) return monacoLoading;
    monacoLoading = new Promise((resolve, reject) => {
      const start = Date.now();
      const wait = setInterval(() => {
        if (typeof window.require === "function" && window.require.config) {
          clearInterval(wait);
          window.require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs" } });
          window.require(["vs/editor/editor.main"], () => resolve(), reject);
        } else if (Date.now() - start > 10000) {
          clearInterval(wait);
          reject(new Error("Monaco editor could not be loaded (offline?)"));
        }
      }, 100);
    });
    return monacoLoading;
  }

  const LANG = { js: "javascript", py: "python", lua: "lua", json: "json", env: "ini", txt: "plaintext", md: "markdown", gitignore: "plaintext" };

  function fileIcon(name) {
    const ext = name.split(".").pop();
    return { js: "🟨", py: "🐍", lua: "🌙", json: "🧾", env: "🔑", txt: "📄", md: "📝" }[ext] || "📄";
  }

  window.pages.ide = {
    init() {
      const container = document.getElementById("page-ide");
      if (!AppState.currentProject) return noProjectState(container, "the code editor");
      if (editor) { editor.dispose(); editor = null; }
      currentFile = null;
      dirty = false;

      container.innerHTML = `
        <div class="page-header page-header-compact">
          <div><h1 class="page-title">Code IDE</h1><p class="page-subtitle">Generated code for <b>${escapeHtml(AppState.currentProject.name)}</b></p></div>
          <div class="flex gap-sm">
            <button class="btn btn-secondary btn-sm" data-act="generate">${icon("code", 14)} Regenerate</button>
            <button class="btn btn-secondary btn-sm" data-act="refresh">${icon("restart", 14)} Refresh</button>
            <button class="btn btn-primary btn-sm" data-act="save" disabled>${icon("save", 14)} Save <kbd>Ctrl+S</kbd></button>
          </div>
        </div>
        <div class="notice notice-info notice-sm">${icon("info", 14)} Files are regenerated from your blocks when you build. Put permanent custom logic in <b>Custom Code</b> blocks instead of editing here.</div>
        <div class="ide-container">
          <aside class="ide-sidebar">
            <div class="ide-sidebar-title">EXPLORER</div>
            <div class="ide-file-tree" data-el="tree"><div class="text-muted text-sm" style="padding:12px">Loading...</div></div>
          </aside>
          <div class="ide-main">
            <div class="ide-tabs" data-el="tabs"><div class="ide-tab">No file open</div></div>
            <div class="ide-editor-container"><div id="monaco-editor-host"></div></div>
            <div class="ide-bottom">
              <div class="ide-bottom-tabs">
                <button class="tab active" data-panel="terminal">Terminal</button>
                <button class="tab" data-panel="problems">Problems <span class="badge badge-err" data-el="problems-count" style="display:none">0</span></button>
              </div>
              <div class="ide-panel active" data-pane="terminal"></div>
              <div class="ide-panel" data-pane="problems"><div class="text-muted">No problems detected.</div></div>
            </div>
          </div>
        </div>`;

      const term = container.querySelector('[data-pane="terminal"]');
      consoleLines.slice(-200).forEach((l) => term.appendChild(consoleLineEl(l)));
      term.scrollTop = term.scrollHeight;

      container.querySelectorAll("[data-panel]").forEach((tab) => {
        tab.onclick = () => {
          container.querySelectorAll("[data-panel]").forEach((t) => t.classList.toggle("active", t === tab));
          container.querySelectorAll("[data-pane]").forEach((p) => p.classList.toggle("active", p.dataset.pane === tab.dataset.panel));
        };
      });
      container.querySelector('[data-act="refresh"]').onclick = () => this.loadFiles();
      container.querySelector('[data-act="save"]').onclick = () => this.save();
      container.querySelector('[data-act="generate"]').onclick = async () => {
        if (dirty && !(await confirmDialog({ title: "Regenerate code?", message: "Unsaved edits in the open file will be lost.", confirmText: "Regenerate" }))) return;
        await BotRunner.generate();
        await this.loadFiles();
        if (currentFile) this.open(currentFile, true);
      };

      loadMonaco().then(() => this.createEditor()).catch((err) => {
        container.querySelector("#monaco-editor-host").innerHTML = `<div class="empty-state"><div class="empty-state-title">Editor unavailable</div><div class="empty-state-text">${escapeHtml(err.message)}</div></div>`;
      });
      this.loadFiles();
    },

    createEditor() {
      const host = document.getElementById("monaco-editor-host");
      if (!host || editor) return;
      const light = document.body.classList.contains("theme-light");
      editor = monaco.editor.create(host, {
        value: "// Select a file on the left",
        language: "javascript",
        theme: light ? "vs" : "vs-dark",
        automaticLayout: true,
        fontFamily: `'${localStorage.getItem("botify-ide-font") || "JetBrains Mono"}', monospace`,
        fontSize: Number(localStorage.getItem("botify-ide-size")) || 13,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorSmoothCaretAnimation: "on",
        padding: { top: 12 },
        readOnly: true,
      });
      editor.onDidChangeModelContent(() => {
        if (!currentFile) return;
        dirty = true;
        this.updateTab();
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => this.save());
      monaco.editor.onDidChangeMarkers(() => this.updateProblems());
    },

    async loadFiles() {
      const tree = document.querySelector('#page-ide [data-el="tree"]');
      if (!tree) return;
      let files = [];
      try {
        files = await window.api.ide.listFiles(AppState.currentProject.id);
      } catch (err) {
        tree.innerHTML = `<div class="notice notice-err notice-sm">${escapeHtml(err.message)}</div>`;
        return;
      }
      if (!files.length) {
        tree.innerHTML = `<div class="ide-empty">No code generated yet.<button class="btn btn-primary btn-sm mt-sm" data-act="gen">Generate now</button></div>`;
        tree.querySelector('[data-act="gen"]').onclick = async () => { await BotRunner.generate(); this.loadFiles(); };
        return;
      }
      let lastDir = null;
      tree.innerHTML = "";
      files.forEach((f) => {
        const parts = f.name.split("/");
        const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
        if (dir && dir !== lastDir) {
          const d = document.createElement("div");
          d.className = "file-dir";
          d.textContent = "📁 " + dir;
          tree.appendChild(d);
        }
        lastDir = dir;
        const item = document.createElement("div");
        item.className = "file-item" + (dir ? " nested" : "") + (currentFile && currentFile.name === f.name ? " active" : "");
        item.innerHTML = `<span>${fileIcon(f.name)}</span><span>${escapeHtml(parts[parts.length - 1])}</span>`;
        item.onclick = () => this.open(f);
        tree.appendChild(item);
      });
    },

    async open(file, force = false) {
      if (!editor) return;
      if (!force && dirty && currentFile && currentFile.name !== file.name) {
        if (!(await confirmDialog({ title: "Discard unsaved changes?", message: `${currentFile.name} has unsaved changes.`, confirmText: "Discard", danger: true }))) return;
      }
      const content = await window.api.ide.readFile(AppState.currentProject.id, file.name);
      currentFile = file;
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "txt";
      monaco.editor.setModelLanguage(editor.getModel(), LANG[ext] || "plaintext");
      editor.updateOptions({ readOnly: false });
      editor.setValue(content);
      dirty = false;
      this.updateTab();
      document.querySelectorAll("#page-ide .file-item").forEach((i) => i.classList.toggle("active", i.textContent.trim().endsWith(file.name.split("/").pop())));
    },

    updateTab() {
      const tabs = document.querySelector('#page-ide [data-el="tabs"]');
      const save = document.querySelector('#page-ide [data-act="save"]');
      if (!tabs || !currentFile) return;
      tabs.innerHTML = `<div class="ide-tab active">${fileIcon(currentFile.name)} ${escapeHtml(currentFile.name)}${dirty ? ' <span class="flow-dirty">●</span>' : ""}</div>`;
      if (save) save.disabled = !dirty;
    },

    updateProblems() {
      if (!editor || !editor.getModel()) return;
      const markers = monaco.editor.getModelMarkers({ resource: editor.getModel().uri });
      const pane = document.querySelector('#page-ide [data-pane="problems"]');
      const badge = document.querySelector('#page-ide [data-el="problems-count"]');
      if (!pane) return;
      badge.textContent = markers.length;
      badge.style.display = markers.length ? "" : "none";
      pane.innerHTML = markers.length ? markers.map((m) => `
        <div class="problem ${m.severity === monaco.MarkerSeverity.Error ? "err" : "warn"}" data-line="${m.startLineNumber}">
          <span class="problem-pos">${m.startLineNumber}:${m.startColumn}</span><span>${escapeHtml(m.message)}</span></div>`).join("") : '<div class="text-muted">No problems detected.</div>';
      pane.querySelectorAll("[data-line]").forEach((el) => {
        el.onclick = () => { editor.revealLineInCenter(Number(el.dataset.line)); editor.setPosition({ lineNumber: Number(el.dataset.line), column: 1 }); editor.focus(); };
      });
    },

    async save() {
      if (!currentFile || !editor || !dirty) return;
      await window.api.ide.writeFile(AppState.currentProject.id, currentFile.name, editor.getValue());
      dirty = false;
      this.updateTab();
      showToast(`Saved ${currentFile.name}`, "success");
    },
  };

  document.addEventListener("botify:log", (e) => {
    const term = document.querySelector('#page-ide [data-pane="terminal"]');
    if (!term) return;
    term.appendChild(consoleLineEl(e.detail));
    while (term.childElementCount > 500) term.firstElementChild.remove();
    term.scrollTop = term.scrollHeight;
  });
})();
