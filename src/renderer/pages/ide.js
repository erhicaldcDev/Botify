(function () {
  let editor = null;
  let currentFile = null;



  window.pages.ide = {
    init: function () {
      const container = document.getElementById("page-ide");
      if (!AppState.currentProject) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div><p>Open or create a project to use the IDE</p></div>';
        return;
      }

      if (editor) {
        editor.dispose();
        editor = null;
      }
      currentFile = null;

      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Code IDE</h1>
            <p class="page-subtitle">Professional editor for <strong>${AppState.currentProject.name}</strong></p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="ide-sync">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              Refresh Files
            </button>
            <button class="btn btn-primary" id="ide-save">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save File
            </button>
            <button class="btn btn-primary" id="ide-run-bot" style="background: var(--success); color: #fff;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Test Bot
            </button>
          </div>
        </div>

        <div class="ide-container" style="display: flex; height: calc(100vh - 120px); flex-direction: row; gap: var(--spacing);">
          <div class="ide-sidebar">
            <div class="sidebar-label" style="padding: 12px; border-bottom: 1px solid var(--border-subtle)">EXPLORER</div>
            <div class="ide-file-tree" id="ide-file-tree">
              <div class="empty-state">
                <p class="text-muted">Loading...</p>
              </div>
            </div>
          </div>
          <div class="ide-main" style="display: flex; flex-direction: column; flex: 1;">
            <div class="ide-tabs" id="ide-tabs">
               <div class="ide-tab">No file open</div>
            </div>
            <div class="ide-editor-container" style="flex: 2; min-height: 0;">
              <div id="monaco-editor-host" style="width: 100%; height: 100%;"></div>
            </div>
            
            <div class="ide-console-panel" style="flex: 1; min-height: 150px; background: #0d1117; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; overflow: hidden; border-radius: 0 0 var(--radius) var(--radius);">
              <div style="padding: 0 16px; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; color: var(--text-muted); text-transform: uppercase;">
                <div style="display: flex; gap: 16px;" id="ide-console-tabs">
                  <div class="console-tab active" data-target="ide-terminal-output" style="padding: 8px 0; cursor: pointer; color: var(--text-primary); border-bottom: 2px solid var(--primary);">TERMINAL</div>
                  <div class="console-tab" data-target="ide-problems-output" style="padding: 8px 0; cursor: pointer;">PROBLEMS <span id="ide-problems-badge" style="background: var(--error); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; display: none;">0</span></div>
                </div>
                <span id="ide-engine-status" style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--error);"></span> Offline
                </span>
              </div>
              <div id="ide-terminal-output" class="console-content" style="overflow-y: auto; padding: 12px; font-family: var(--font-mono); font-size: 13px; color: #c9d1d9; flex: 1; white-space: pre-wrap; display: block;">
                [Botify IDE] Ready to test. Press 'Test Bot' to start the engine.
              </div>
              <div id="ide-problems-output" class="console-content" style="overflow-y: auto; padding: 12px; font-family: var(--font-mono); font-size: 13px; color: #c9d1d9; flex: 1; display: none;">
                No syntax errors detected.
              </div>
            </div>

          </div>
        </div>
      `;

      document.getElementById("ide-sync").addEventListener("click", () => this.loadFiles());
      document.getElementById("ide-save").addEventListener("click", () => this.saveCurrentFile());
      document.getElementById("ide-run-bot").addEventListener("click", () => this.toggleBotEngine());

      document.querySelectorAll(".console-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
          document.querySelectorAll(".console-tab").forEach(t => {
            t.classList.remove("active");
            t.style.color = "";
            t.style.borderBottom = "";
          });
          e.currentTarget.classList.add("active");
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.borderBottom = "2px solid var(--primary)";

          document.querySelectorAll(".console-content").forEach(c => c.style.display = "none");
          document.getElementById(e.currentTarget.dataset.target).style.display = "block";
        });
      });

      this.initMonaco();
      this.setupEngineListeners();
    },

    toggleBotEngine: async function () {
      const btn = document.getElementById("ide-run-bot");
      if (this.engineRunning) {
        await window.api.engine.stop();
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Test Bot`;
        btn.style.background = "var(--success)";
      } else {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Stop Bot`;
        btn.style.background = "var(--error)";
        const term = document.getElementById("ide-terminal-output");
        if (term) term.innerHTML = "[Botify Engine] Booting sequence initialized...\n";
        await window.api.engine.start(AppState.currentProject);
      }
    },

    setupEngineListeners: function () {
      if (window._ideEngineListenerSetup) return;
      window._ideEngineListenerSetup = true;
      this.engineRunning = false;

      const self = this;
      window.api.engine.onLog((event) => {
        const term = document.getElementById("ide-terminal-output");
        if (!term) return;

        let color = "#c9d1d9";
        if (event.type === "error" || event.type === "stderr") color = "#ff7b72";
        if (event.type === "warn") color = "#d2a8ff";

        const line = document.createElement("div");
        line.style.color = color;
        line.style.marginBottom = "4px";
        line.textContent = `[${event.type}] ${event.message}`;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;

        if (event.message.includes("Bot logged in as") || event.message.includes("Ready!")) {
          self.engineRunning = true;
          const status = document.getElementById('ide-engine-status');
          if (status) status.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success);"></span> Online`;
        }
        if (event.message.includes("Process exited") || event.message.includes("Bot stopped")) {
          self.engineRunning = false;
          const status = document.getElementById('ide-engine-status');
          if (status) status.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--error);"></span> Offline`;
          const btn = document.getElementById("ide-run-bot");
          if (btn) {
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Test Bot`;
            btn.style.background = "var(--success)";
          }
        }
      });
    },

    initMonaco: function () {
      if (window.monaco) {
        this.createEditor();
        return;
      }

      const loaderCmd = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js";
      const checkMonaco = setInterval(() => {
        if (window.require) {
          clearInterval(checkMonaco);
          require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
          require(['vs/editor/editor.main'], () => {
            this.createEditor();
          });
        }
      }, 100);
    },

    createEditor: function () {
      const host = document.getElementById("monaco-editor-host");
      if (!host || editor) return;

      editor = monaco.editor.create(host, {
        value: "",
        language: "javascript",
        theme: "vs-dark",
        automaticLayout: true,
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.6,
        renderLineHighlight: "all",
        minimap: { enabled: true },
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
          vertical: 'visible',
          horizontal: 'visible'
        },
        padding: { top: 16 },
        cursorSmoothCaretAnimation: "on",
        cursorBlinking: "smooth",
        cursorStyle: "line",
        smoothScrolling: true,
        mouseWheelZoom: true,
        contextmenu: true,
        quickSuggestions: true,
        scrollBeyondLastLine: false,
        roundedSelection: true,
        selectionHighlight: true
      });

      monaco.editor.onDidChangeMarkers(() => {
        const markers = monaco.editor.getModelMarkers({ resource: editor.getModel().uri });
        const problemsOutput = document.getElementById("ide-problems-output");
        const badge = document.getElementById("ide-problems-badge");
        if (!problemsOutput || !badge) return;

        if (markers.length === 0) {
          problemsOutput.innerHTML = '<div style="color: var(--success); padding: 8px 0;">No syntax errors detected.</div>';
          badge.style.display = "none";
          badge.textContent = "0";
        } else {
          badge.style.display = "inline-block";
          badge.textContent = markers.length;
          problemsOutput.innerHTML = markers.map(m => {
            const isErr = m.severity === monaco.MarkerSeverity.Error;
            return `<div style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: ${isErr ? '#ff7b72' : '#d2a8ff'}; display: flex; gap: 8px;">
              <span style="min-width: 70px; opacity: 0.7;">[${m.startLineNumber}:${m.startColumn}]</span>
              <span>${m.message}</span>
            </div>`;
          }).join("");
        }
      });

      this.loadFiles();
    },

    loadFiles: async function () {
      if (!AppState.currentProject) return;
      try {
        const fileList = await window.api.ide.listFiles(AppState.currentProject.id);
        this.renderFileTree(fileList);
      } catch (err) {
        console.error("Failed to list IDE files:", err);
        this.renderFileTree([]);
      }
    },

    renderFileTree: function (fileList) {
      const tree = document.getElementById("ide-file-tree");
      if (!tree) return;
      tree.innerHTML = "";

      if (fileList.length === 0) {
        tree.innerHTML = '<div class="p-3 text-muted text-xs">No files generated yet.<br>Go to Settings > Generate Bot Code first.</div>';
        return;
      }

      fileList.forEach(file => {
        const item = document.createElement("div");
        item.className = `file-item ${currentFile && currentFile.name === file.name ? 'active' : ''}`;
        item.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          ${file.name}
        `;
        item.onclick = () => this.openFile(file);
        tree.appendChild(item);
      });
    },

    openFile: async function (file) {
      currentFile = file;
      document.querySelectorAll(".file-item").forEach(i => i.classList.remove("active"));
      this.loadFiles(); 

      const content = await window.api.ide.readFile(AppState.currentProject.id, file.name);

      const ext = file.name.split('.').pop();
      let lang = "javascript";
      if (ext === "py") lang = "python";
      if (ext === "lua") lang = "lua";
      if (ext === "json") lang = "json";
      if (ext === "env") lang = "ini";
      if (ext === "txt" || ext === "log") lang = "plaintext";

      monaco.editor.setModelLanguage(editor.getModel(), lang);
      editor.setValue(content);

      this.updateTabs(file.name);
    },

    updateTabs: function (filename) {
      const tabs = document.getElementById("ide-tabs");
      if (!tabs) return;
      tabs.innerHTML = `
        <div class="ide-tab active">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          ${filename}
        </div>
      `;
    },

    saveCurrentFile: async function () {
      if (!currentFile || !AppState.currentProject) return;
      const content = editor.getValue();
      await window.api.ide.writeFile(AppState.currentProject.id, currentFile.name, content);
      window.showToast("Changes saved to disk", "success");
    }
  };
})();
