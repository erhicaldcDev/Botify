
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(html, onMount) {
    const overlay = document.getElementById("modal-overlay");
    const container = document.getElementById("modal-container");
    container.innerHTML = html;
    overlay.classList.remove("hidden");
    overlay.onclick = (e) => {
        if (e.target === overlay) hideModal();
    };
    if (onMount) onMount(container);
}

function hideModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}

function navigateTo(page) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    const pageEl = document.getElementById(`page-${page}`);
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add("active");
    if (navEl) navEl.classList.add("active");
    AppState.currentPage = page;
    renderPage(page);
}

window.showNewProjectModal = function() {
    showModal(`
    <style>
      .engine-select-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 15px; }
      .engine-option { border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 15px; text-align: center; cursor: pointer; transition: all 0.2s; background: rgba(255,255,255,0.02); }
      .engine-option:hover { background: var(--bg-hover); border-color: var(--accent); }
      .engine-option.selected { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); font-weight: 600; box-shadow: 0 0 10px var(--accent-glow); }
      .engine-icon { font-size: 24px; margin-bottom: 8px; display: block; }
    </style>
    <div style="padding: 10px;">
      <h2 class="modal-title" style="margin-bottom: 20px;">Create New Bot Project</h2>
      <div class="input-group">
        <label class="input-label">Project Name</label>
        <input class="input" id="new-project-name" placeholder="My Awesome Bot" autofocus />
      </div>
      <div class="input-group" style="margin-top: 20px;">
        <label class="input-label">Select Bot Engine</label>
        <div class="engine-select-grid" id="engine-selector">
          <div class="engine-option selected" data-engine="node">
            <span class="engine-icon">🟢</span>
            Node.js (discord.js)
          </div>
          <div class="engine-option" data-engine="python">
            <span class="engine-icon">🐍</span>
            Python (discord.py)
          </div>
          <div class="engine-option" data-engine="lua">
            <span class="engine-icon">🌙</span>
            Lua (Discordia)
          </div>
        </div>
      </div>
      <div class="input-group" style="margin-top: 20px;">
        <label class="input-label">Command Prefix</label>
        <input class="input" id="new-project-prefix" value="!" placeholder="!" />
      </div>
      <div class="modal-actions" style="margin-top: 30px;">
        <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
        <button class="btn btn-primary" id="create-project-final" style="min-width: 140px;">Create Project</button>
      </div>
    </div>
  `, (container) => {
        let selectedEngine = "node";
        container.querySelectorAll(".engine-option").forEach(opt => {
            opt.onclick = () => {
                container.querySelectorAll(".engine-option").forEach(o => o.classList.remove("selected"));
                opt.classList.add("selected");
                selectedEngine = opt.dataset.engine;
            };
        });

        container.querySelector("#create-project-final").onclick = async () => {
            const name = container.querySelector("#new-project-name").value.trim();
            const prefix = container.querySelector("#new-project-prefix").value.trim() || "!";
            if (!name) { showToast("Name is required", "error"); return; }

            
            container.innerHTML = `
              <div style="padding: 20px;">
                <h2 class="modal-title">🔨 Creating Project...</h2>
                <div id="creation-logs" style="background:#000; color:#0f0; padding:15px; border-radius:8px; height:200px; overflow-y:auto; font-family:'JetBrains Mono', monospace; font-size:12px; margin-top:15px;">
                  <div style="color:#aaa;">> Initializing setup...</div>
                </div>
                <div class="progress-bar" style="margin-top:20px;">
                  <div id="creation-progress" class="progress-bar-fill" style="width:10%;"></div>
                </div>
              </div>
            `;

            const log = (msg, color="#0f0") => {
              const el = container.querySelector("#creation-logs");
              if (el) {
                el.innerHTML += `<div style="color:${color}">> ${msg}</div>`;
                el.scrollTop = el.scrollHeight;
              }
            };

            const progress = (val) => {
              const el = container.querySelector("#creation-progress");
              if (el) el.style.width = val + "%";
            };

            try {
              log("Initializing project architecture...");
              progress(20);
              const project = await window.api.project.create({ name, engine: selectedEngine, prefix });
              
              if (project) {
                log(`Project '${name}' metadata created.`, "#fff");
                progress(50);
                AppState.currentProject = project;
                AppState.projects.push(project);
                updateSidebar();

                log("Writing system files (project.json)...");
                progress(70);
                
                log("Generating base code files for engine: " + selectedEngine + "...");
                await window.api.generate.code(project);
                progress(90);

                log("Finalizing project setup...", "#fff");
                progress(100);
                
                const finishBtn = document.createElement("div");
                finishBtn.style.textAlign = "center";
                finishBtn.style.marginTop = "25px";
                finishBtn.innerHTML = `
                  <button class="btn btn-primary" id="creation-finish-btn" style="padding: 12px 30px; font-size: 14px; box-shadow: 0 0 20px var(--accent-glow);">
                    🚀 START CODING!
                  </button>
                `;
                container.appendChild(finishBtn);

                container.querySelector("#creation-finish-btn").onclick = () => {
                  hideModal();
                  navigateTo("dashboard");
                  showToast(`Project '${name}' initialized!`, "success");
                };
              }
            } catch (err) {
              log("ERROR: " + err.message, "#f44");
              showToast("Creation failed: " + err.message, "error");
              
              const btnContainer = document.createElement("div");
              btnContainer.style.marginTop = "20px";
              btnContainer.style.textAlign = "right";
              btnContainer.innerHTML = `<button class="btn btn-secondary" onclick="hideModal()">Dismiss</button>`;
              container.appendChild(btnContainer);
            }
        };
    });
}

function updateSidebar() {
    const nameEl = document.getElementById("project-name-display");
    const engineLabel = document.getElementById("engine-label");
    const engineDot = document.querySelector(".engine-dot");
    if (AppState.currentProject) {
        nameEl.textContent = AppState.currentProject.name;
        const engineMap = {
            node: "Discord.JS",
            python: "Discord.PY",
            lua: "Discordia (Lua)"
        };
        engineLabel.textContent = engineMap[AppState.currentProject.engine] || AppState.currentProject.engine;
        engineDot.classList.add("active");
    } else {
        nameEl.textContent = "No Project";
        engineLabel.textContent = "No Engine";
        engineDot.classList.remove("active");
    }
}

function renderPage(page) {
    const el = document.getElementById(`page-${page}`);
    if (!el) return;

    if (window.pages[page] && typeof window.pages[page].init === "function") {
        window.pages[page].init();
        return;
    }

    switch (page) {
        case "dashboard": renderDashboard(el); break;
        case "commands": renderCommands(el); break;
        case "events": renderEvents(el); break;
        case "embeds": renderEmbeds(el); break;
        case "database": renderDatabase(el); break;
        case "console": renderConsole(el); break;
        case "plugins": renderPlugins(el); break;
        case "settings": renderSettings(el); break;
    }
}

async function saveProject() {
    if (!AppState.currentProject) return;
    await window.api.project.save(AppState.currentProject);
}

const TRANSLATIONS = {
    "No Project": "Brak Projektu",
    "Dashboard": "Panel Główny",
    "Visual Builders": "Kreatory Wizualne",
    "Command Builder": "Kreator Komend",
    "Economy System": "System Ekonomii",
    "Help UI Maker": "Kreator Pomocy",
    "Embed Styler": "Stylizator Embedów",
    "Event Handlers": "Menedżer Zdarzeń",
    "Development": "Programowanie",
    "Code IDE": "Edytor Kodu IDE",
    "Database Manager": "Menedżer Bazy Danych",
    "Live Console": "Konsola na Żywo",
    "Configuration": "Konfiguracja",
    "Plugin Market": "Rynek Wtyczek",
    "Settings & Themes": "Ustawienia i Styl",
    "No Engine": "Brak Silnika"
};

window.updateLanguage = () => {
    const lang = localStorage.getItem('bot-maker-lang') || 'en';
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const textKey = el.dataset.i18n;
        if (lang === 'pl' && TRANSLATIONS[textKey]) {
            el.textContent = TRANSLATIONS[textKey];
        } else {
            el.textContent = textKey;
        }
    });

    if (AppState.currentProject) {
        updateSidebar();
    }
};

async function init() {
    const savedTheme = localStorage.getItem('bot-maker-theme') || 'theme-dark';
    document.body.className = savedTheme;

    document.getElementById("btn-minimize").onclick = () => window.api.window.minimize();
    document.getElementById("btn-maximize").onclick = () => window.api.window.maximize();
    document.getElementById("btn-close").onclick = () => window.api.window.close();

    document.querySelectorAll(".nav-item").forEach((btn) => {
        btn.onclick = () => navigateTo(btn.dataset.page);
    });

    window.api.engine.onLog((event) => {
        if (typeof addConsoleLine === "function") addConsoleLine(event);
    });

    window.api.deps.onProgress((event) => {
        if (typeof handleDepsProgress === "function") handleDepsProgress(event);
    });

    AppState.projects = await window.api.project.list();
    window.updateLanguage();
    navigateTo("dashboard");
}

init();
