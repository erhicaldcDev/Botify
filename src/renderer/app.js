/* App shell: navigation, sidebar, project lifecycle and the global Build & Run flow. */

const PAGE_RENDERERS = {
  dashboard: () => renderDashboard,
  commands: () => renderCommands,
  events: () => renderEvents,
  embeds: () => renderEmbeds,
  database: () => renderDatabase,
  console: () => renderConsole,
  plugins: () => renderPlugins,
  settings: () => renderSettings,
};

function navigateTo(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add("active");
  if (navEl) navEl.classList.add("active");
  AppState.currentPage = page;
  renderPage(page);
}

function renderPage(page) {
  const el = document.getElementById(`page-${page}`);
  if (!el) return;
  try {
    if (window.pages[page] && typeof window.pages[page].init === "function") {
      window.pages[page].init();
      return;
    }
    const renderer = PAGE_RENDERERS[page] && PAGE_RENDERERS[page]();
    if (renderer) renderer(el);
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="empty-state"><div class="empty-state-title">Something went wrong</div><div class="empty-state-text">${escapeHtml(err.message)}</div></div>`;
  }
}

function noProjectState(el, what = "this page") {
  el.innerHTML = `
    <div class="empty-state empty-state-lg">
      <div class="empty-state-emoji">🤖</div>
      <div class="empty-state-title">No project open</div>
      <div class="empty-state-text">Create or open a bot project to use ${escapeHtml(what)}.</div>
      <div class="flex gap-sm mt-md">
        <button class="btn btn-primary" data-act="new">${icon("plus", 16)} New project</button>
        <button class="btn btn-secondary" data-act="open">${icon("folder", 16)} Open project</button>
      </div>
    </div>`;
  el.querySelector('[data-act="new"]').onclick = () => showNewProjectModal();
  el.querySelector('[data-act="open"]').onclick = () => navigateTo("dashboard");
}

const ENGINE_INFO = {
  node: { label: "Discord.JS", icon: "🟢", lang: "JavaScript" },
  python: { label: "Discord.PY", icon: "🐍", lang: "Python" },
  lua: { label: "Discordia", icon: "🌙", lang: "Lua" },
};

function updateSidebar() {
  const p = AppState.currentProject;
  const nameEl = document.getElementById("project-name-display");
  const engineLabel = document.getElementById("engine-label");
  const engineDot = document.querySelector(".engine-dot");
  if (p) {
    nameEl.textContent = p.name;
    nameEl.title = p.name;
    engineLabel.textContent = (ENGINE_INFO[p.engine] || { label: p.engine }).label;
    engineDot.classList.add("active");
  } else {
    nameEl.textContent = t("No Project");
    engineLabel.textContent = t("No Engine");
    engineDot.classList.remove("active");
  }
  const counts = {
    commands: p ? (p.commands || []).length : 0,
    events: p ? (p.events || []).filter((e) => e.enabled).length : 0,
    embeds: p ? (p.embeds || []).length : 0,
  };
  Object.entries(counts).forEach(([k, v]) => {
    const badge = document.querySelector(`.nav-item[data-page="${k}"] .nav-count`);
    if (badge) {
      badge.textContent = v;
      badge.style.display = v ? "" : "none";
    }
  });
  document.getElementById("titlebar-project").textContent = p ? p.name : "";
  updateRunButton();
}

async function saveProject() {
  if (!AppState.currentProject) return;
  await window.api.project.save(AppState.currentProject);
  updateSidebar();
}

async function openProject(id) {
  const project = await window.api.project.open(id);
  if (!project) {
    showToast("Project not found", "error");
    return null;
  }
  if (AppState.bot.running) await window.api.engine.stop();
  AppState.currentProject = project;
  localStorage.setItem("botify-last-project", project.id);
  await refreshPluginBlocks();
  updateSidebar();
  showToast(`Opened ${project.name}`, "success");
  return project;
}

// ------------------------------------------------------------------ new project
window.showNewProjectModal = function () {
  showModal(`
    <div class="modal-head"><h2 class="modal-title">Create a new bot</h2></div>
    <div class="input-group">
      <label class="input-label">Bot name</label>
      <input class="input" id="new-project-name" placeholder="My Awesome Bot" autofocus maxlength="64" />
    </div>
    <div class="input-group">
      <label class="input-label">Language / engine</label>
      <div class="choice-grid choice-grid-3" id="engine-selector">
        <button type="button" class="choice selected" data-engine="node"><span class="choice-icon">🟢</span><b>Node.js</b><small>discord.js • all features</small></button>
        <button type="button" class="choice" data-engine="python"><span class="choice-icon">🐍</span><b>Python</b><small>discord.py • all features</small></button>
        <button type="button" class="choice" data-engine="lua"><span class="choice-icon">🌙</span><b>Lua</b><small>Discordia • prefix commands</small></button>
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Start from</label>
      <div class="choice-grid choice-grid-2" id="template-selector">
        <button type="button" class="choice selected" data-template="starter"><span class="choice-icon">🚀</span><b>Starter bot</b><small>/ping, /userinfo, modal form, welcome embed, help menu</small></button>
        <button type="button" class="choice" data-template="empty"><span class="choice-icon">📄</span><b>Empty project</b><small>Start from scratch</small></button>
      </div>
    </div>
    <div class="grid-2">
      <div class="input-group">
        <label class="input-label">Prefix (for prefix commands)</label>
        <input class="input" id="new-project-prefix" value="!" maxlength="5" />
      </div>
      <div class="input-group">
        <label class="input-label">Bot token (optional, can be added later)</label>
        <input class="input" id="new-project-token" type="password" placeholder="Paste token from the Developer Portal" />
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-act="cancel">Cancel</button>
      <button class="btn btn-primary" id="create-project-final">${icon("rocket", 16)} Create bot</button>
    </div>`, (c, close) => {
    let engine = "node";
    let template = "starter";
    c.querySelectorAll("#engine-selector .choice").forEach((o) => {
      o.onclick = () => { c.querySelectorAll("#engine-selector .choice").forEach((x) => x.classList.remove("selected")); o.classList.add("selected"); engine = o.dataset.engine; };
    });
    c.querySelectorAll("#template-selector .choice").forEach((o) => {
      o.onclick = () => { c.querySelectorAll("#template-selector .choice").forEach((x) => x.classList.remove("selected")); o.classList.add("selected"); template = o.dataset.template; };
    });
    c.querySelector('[data-act="cancel"]').onclick = close;
    const submit = async () => {
      const name = c.querySelector("#new-project-name").value.trim();
      const prefix = c.querySelector("#new-project-prefix").value.trim() || "!";
      const token = c.querySelector("#new-project-token").value.trim();
      if (!name) { showToast("Give your bot a name", "warning"); c.querySelector("#new-project-name").focus(); return; }
      if (token && !(await window.api.token.validate(token))) { showToast("That doesn't look like a bot token", "error"); return; }
      const btn = c.querySelector("#create-project-final");
      btn.disabled = true;
      btn.textContent = "Creating...";
      try {
        const project = await window.api.project.create({ name, engine, prefix, template, token: token || null });
        AppState.projects.unshift(project);
        AppState.currentProject = project;
        AppState.pluginBlocks = [];
        localStorage.setItem("botify-last-project", project.id);
        updateSidebar();
        close();
        showToast(`Bot "${name}" created!`, "success");
        navigateTo(template === "starter" ? "commands" : "dashboard");
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `${icon("rocket", 16)} Create bot`;
        showToast("Creation failed: " + err.message, "error");
      }
    };
    c.querySelector("#create-project-final").onclick = submit;
    c.querySelector("#new-project-name").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }, { size: "md" });
};

// ------------------------------------------------------------------ bot runner
const BotRunner = {
  busy: false,

  async generate({ quiet = false } = {}) {
    const p = AppState.currentProject;
    if (!p) return null;
    await saveProject();
    const result = await window.api.generate.code(p);
    const warnings = result.warnings || [];
    warnings.forEach((w) => addConsoleLine({ type: "warn", message: "⚠ " + w, timestamp: new Date().toISOString() }));
    if (!quiet) {
      if (warnings.length) showToast(`Code generated with ${warnings.length} warning(s) - see Console`, "warning");
      else showToast("Code generated", "success");
    }
    return result;
  },

  async install() {
    const p = AppState.currentProject;
    addConsoleLine({ type: "info", message: "Installing dependencies - this can take a minute the first time...", timestamp: new Date().toISOString() });
    AppState.bot.installing = true;
    updateRunButton();
    try {
      return await window.api.deps.install(p);
    } finally {
      AppState.bot.installing = false;
      updateRunButton();
    }
  },

  /** Save → generate → install (if needed) → start. */
  async buildAndRun() {
    const p = AppState.currentProject;
    if (!p) return showToast("Open a project first", "warning");
    if (this.busy) return;
    if (!p.hasToken) {
      const go = await confirmDialog({ title: "No bot token", message: "Your bot needs a token from the Discord Developer Portal before it can go online. Add it now in Settings?", confirmText: "Open Settings" });
      if (go) navigateTo("settings");
      return;
    }
    this.busy = true;
    updateRunButton();
    try {
      addConsoleLine({ type: "info", message: "▶ Build & Run: generating code...", timestamp: new Date().toISOString() });
      const result = await this.generate({ quiet: true });
      const syntax = (result.warnings || []).filter((w) => w.startsWith("Syntax error"));
      if (syntax.length) {
        showToast("Generated code has syntax errors - see Console", "error");
        if (AppState.currentPage !== "console") navigateTo("console");
        return;
      }
      if (!(await window.api.deps.check(p))) {
        const ok = await this.install();
        if (!ok) {
          showToast("Dependency install failed - see Console", "error");
          return;
        }
      }
      if (AppState.bot.running) await window.api.engine.stop();
      await window.api.engine.start(p);
      showToast("Starting bot...", "info");
    } catch (err) {
      addConsoleLine({ type: "error", message: "Build failed: " + err.message, timestamp: new Date().toISOString() });
      showToast("Build failed: " + err.message, "error");
    } finally {
      this.busy = false;
      setTimeout(refreshBotStatus, 800);
    }
  },

  async stop() {
    await window.api.engine.stop();
    setTimeout(refreshBotStatus, 300);
  },
};
window.BotRunner = BotRunner;

async function refreshBotStatus() {
  try {
    const s = await window.api.engine.status();
    AppState.bot.running = s.running;
    AppState.bot.engine = s.engine;
  } catch { /* ignore */ }
  updateRunButton();
  document.dispatchEvent(new CustomEvent("botify:status"));
}

const refreshStatusSoon = debounce(refreshBotStatus, 250);

function updateRunButton() {
  const btn = document.getElementById("titlebar-run");
  const dot = document.getElementById("titlebar-status");
  if (!btn) return;
  const { running, online, installing } = AppState.bot;
  btn.disabled = !AppState.currentProject || BotRunner.busy || installing;
  if (BotRunner.busy || installing) {
    btn.innerHTML = `<span class="spinner"></span> ${installing ? "Installing..." : "Building..."}`;
    btn.className = "titlebar-run busy";
  } else if (running) {
    btn.innerHTML = `${icon("stop", 12)} Stop`;
    btn.className = "titlebar-run running";
  } else {
    btn.innerHTML = `${icon("play", 12)} Run bot`;
    btn.className = "titlebar-run";
  }
  dot.className = "status-dot " + (running ? (online ? "running" : "starting") : "stopped");
  dot.title = running ? (online ? "Bot online" : "Starting...") : "Bot offline";
}

// ------------------------------------------------------------------ i18n
const TRANSLATIONS = {
  pl: {
    "No Project": "Brak projektu", "No Engine": "Brak silnika", PROJECT: "PROJEKT", BUILD: "TWORZENIE", DEVELOP: "PROGRAMOWANIE", CONFIGURE: "KONFIGURACJA",
    Dashboard: "Panel główny", Commands: "Komendy", Events: "Zdarzenia", "Embed Styler": "Stylizator embedów", "Help Menu": "Menu pomocy",
    "Code IDE": "Edytor kodu", Database: "Baza danych", Console: "Konsola", Plugins: "Wtyczki", Settings: "Ustawienia",
  },
};
function t(key) {
  const lang = localStorage.getItem("bot-maker-lang") || "en";
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || key;
}
window.t = t;
window.updateLanguage = () => {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  updateSidebar();
};

// ------------------------------------------------------------------ init
async function init() {
  const savedTheme = localStorage.getItem("bot-maker-theme") || "theme-dark";
  document.body.className = savedTheme;

  document.getElementById("btn-minimize").onclick = () => window.api.window.minimize();
  document.getElementById("btn-maximize").onclick = () => window.api.window.maximize();
  document.getElementById("btn-close").onclick = () => window.api.window.close();
  document.getElementById("titlebar-run").onclick = () => (AppState.bot.running ? BotRunner.stop() : BotRunner.buildAndRun());
  document.querySelectorAll(".nav-item").forEach((btn) => { btn.onclick = () => navigateTo(btn.dataset.page); });
  document.querySelectorAll("[data-link]").forEach((el) => { el.onclick = () => openExternal(el.dataset.link); });

  window.api.engine.onLog((event) => {
    if (/Bot logged in as|Ready! Logged in/.test(event.message)) {
      AppState.bot.online = true;
      showToast("Bot is online! 🎉", "success");
    }
    if (/Process exited|Bot stopped/.test(event.message)) AppState.bot.online = false;
    addConsoleLine(event);
    document.dispatchEvent(new CustomEvent("botify:log", { detail: event }));
    refreshStatusSoon();
  });
  window.api.deps.onProgress((event) => handleDepsProgress(event));

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && AppState.currentProject) {
      e.preventDefault();
      AppState.bot.running ? BotRunner.stop() : BotRunner.buildAndRun();
    }
  });

  AppState.projects = await window.api.project.list();
  const last = localStorage.getItem("botify-last-project");
  if (last && AppState.projects.some((p) => p.id === last)) {
    AppState.currentProject = await window.api.project.open(last);
    await refreshPluginBlocks();
  }
  window.updateLanguage();
  await refreshBotStatus();
  navigateTo("dashboard");
}

init();
