/* Dashboard: current project overview, setup checklist and project gallery. */

function timeAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return d.toLocaleDateString();
}

async function renderDashboard(container) {
  const p = AppState.currentProject;
  const lang = localStorage.getItem("bot-maker-lang") || "en";
  const T = lang === "pl"
    ? { welcome: "Witaj w Botify", sub: "Twórz boty Discord bez pisania kodu - wizualne bloki, embedy, przyciski i formularze.", newBot: "Nowy bot", import: "Importuj", projects: "Twoje projekty", current: "Aktualny projekt" }
    : { welcome: "Welcome to Botify", sub: "Build Discord bots without writing code - visual blocks, embeds, buttons, menus and modal forms.", newBot: "New bot", import: "Import", projects: "Your projects", current: "Current project" };

  const projects = AppState.projects || [];
  const stats = p ? {
    commands: (p.commands || []).length,
    events: (p.events || []).filter((e) => e.enabled).length,
    embeds: (p.embeds || []).length,
    plugins: (p.plugins || []).length,
  } : null;
  const steps = p ? [
    { done: !!p.hasToken, label: "Add your bot token", hint: "Settings → Bot token", action: () => navigateTo("settings") },
    { done: true, label: "Enable intents in the Developer Portal", hint: "Bot tab → Message Content & Server Members", action: () => openExternal("https://discord.com/developers/applications") },
    { done: stats.commands > 0, label: "Create a command", hint: "Use a template in Commands", action: () => navigateTo("commands") },
    { done: AppState.bot.online, label: "Run your bot", hint: "Click Run bot (Ctrl+Enter)", action: () => BotRunner.buildAndRun() },
  ] : [];

  container.innerHTML = `
    <div class="dash">
      <div class="dash-hero">
        <div>
          <h1 class="dash-title">${T.welcome}</h1>
          <p class="dash-sub">${T.sub}</p>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-primary" data-act="new">${icon("plus", 16)} ${T.newBot}</button>
          <button class="btn btn-secondary" data-act="import">${icon("upload", 16)} ${T.import}</button>
        </div>
      </div>

      ${p ? `
      <div class="dash-current">
        <div class="dash-project-card">
          <div class="dash-project-top">
            <div class="dash-project-icon">${(ENGINE_INFO[p.engine] || {}).icon || "🤖"}</div>
            <div class="flex-1">
              <div class="dash-kicker">${T.current}</div>
              <div class="dash-project-name">${escapeHtml(p.name)}</div>
              <div class="dash-project-meta">${escapeHtml((ENGINE_INFO[p.engine] || {}).label || p.engine)} • prefix <code>${escapeHtml(p.prefix)}</code> • edited ${timeAgo(p.updatedAt)}</div>
            </div>
            <div class="bot-pill ${AppState.bot.running ? (AppState.bot.online ? "online" : "starting") : ""}">
              <span class="status-dot ${AppState.bot.running ? (AppState.bot.online ? "running" : "starting") : "stopped"}"></span>
              ${AppState.bot.running ? (AppState.bot.online ? "Online" : "Starting...") : "Offline"}
            </div>
          </div>
          <div class="stat-row">
            <button class="stat-tile" data-nav="commands"><span class="stat-num">${stats.commands}</span><span class="stat-lbl">Commands</span></button>
            <button class="stat-tile" data-nav="events"><span class="stat-num">${stats.events}</span><span class="stat-lbl">Active events</span></button>
            <button class="stat-tile" data-nav="embeds"><span class="stat-num">${stats.embeds}</span><span class="stat-lbl">Embeds</span></button>
            <button class="stat-tile" data-nav="plugins"><span class="stat-num">${stats.plugins}</span><span class="stat-lbl">Plugins</span></button>
          </div>
          <div class="flex gap-sm mt-md">
            ${AppState.bot.running
              ? `<button class="btn btn-danger" data-act="stop">${icon("stop", 14)} Stop bot</button>`
              : `<button class="btn btn-success" data-act="run">${icon("play", 14)} Build & run</button>`}
            <button class="btn btn-secondary" data-nav="console">Console</button>
            <button class="btn btn-ghost" data-act="generate">${icon("code", 14)} Generate code only</button>
          </div>
        </div>
        <div class="dash-checklist card">
          <div class="card-title mb-md">Get your bot online</div>
          ${steps.map((s, i) => `
            <button class="check-step ${s.done ? "done" : ""}" data-step="${i}">
              <span class="check-circle">${s.done ? icon("check", 14) : i + 1}</span>
              <span class="check-text"><b>${escapeHtml(s.label)}</b><small>${escapeHtml(s.hint)}</small></span>
            </button>`).join("")}
        </div>
      </div>` : `
      <div class="dash-empty card">
        <div class="empty-state-emoji">🤖</div>
        <div>
          <div class="card-title">No project open</div>
          <p class="text-muted text-sm">Create a new bot from the starter template or open one below.</p>
        </div>
      </div>`}

      <div class="section-title mt-lg">${T.projects} <span class="text-muted">(${projects.length})</span></div>
      <div class="project-grid">
        ${projects.map((proj) => `
          <div class="project-tile${p && proj.id === p.id ? " current" : ""}" data-open="${proj.id}">
            <div class="project-tile-icon">${(ENGINE_INFO[proj.engine] || {}).icon || "🤖"}</div>
            <div class="project-tile-body">
              <div class="project-tile-name">${escapeHtml(proj.name)}</div>
              <div class="project-tile-meta">${(proj.commands || []).length} commands • ${timeAgo(proj.updatedAt)}</div>
            </div>
            <div class="project-tile-tools">
              <button class="icon-btn" data-export="${proj.id}" title="Export">${icon("download", 14)}</button>
              <button class="icon-btn danger" data-delete="${proj.id}" title="Delete">${icon("trash", 14)}</button>
            </div>
          </div>`).join("")}
        <button class="project-tile project-tile-new" data-act="new">${icon("plus", 20)}<span>${T.newBot}</span></button>
      </div>

      <div class="dash-footer">
        <div class="lang-selector">
          <button class="lang-btn ${lang === "en" ? "active" : ""}" data-lang="en">🇺🇸 English</button>
          <button class="lang-btn ${lang === "pl" ? "active" : ""}" data-lang="pl">🇵🇱 Polski</button>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-ghost btn-sm" data-link="https://discord.com/developers/applications">${icon("external", 14)} Developer Portal</button>
          <button class="btn btn-ghost btn-sm" data-link="https://github.com/erhicaldcDev/Botify">${icon("external", 14)} GitHub</button>
        </div>
      </div>
    </div>`;

  const $$ = (s) => container.querySelectorAll(s);
  $$('[data-act="new"]').forEach((b) => { b.onclick = () => showNewProjectModal(); });
  $$("[data-nav]").forEach((b) => { b.onclick = () => navigateTo(b.dataset.nav); });
  $$("[data-link]").forEach((b) => { b.onclick = () => openExternal(b.dataset.link); });
  $$("[data-lang]").forEach((b) => {
    b.onclick = () => {
      localStorage.setItem("bot-maker-lang", b.dataset.lang);
      window.updateLanguage();
      renderDashboard(container);
    };
  });
  const run = container.querySelector('[data-act="run"]');
  if (run) run.onclick = () => BotRunner.buildAndRun();
  const stop = container.querySelector('[data-act="stop"]');
  if (stop) stop.onclick = () => BotRunner.stop();
  const gen = container.querySelector('[data-act="generate"]');
  if (gen) gen.onclick = () => BotRunner.generate().catch((e) => showToast("Generation failed: " + e.message, "error"));
  $$("[data-step]").forEach((b) => { b.onclick = () => steps[Number(b.dataset.step)].action(); });

  container.querySelector('[data-act="import"]').onclick = async () => {
    try {
      const proj = await window.api.project.import();
      if (!proj) return;
      AppState.projects = await window.api.project.list();
      await openProject(proj.id);
      renderDashboard(container);
    } catch (err) {
      showToast("Import failed: " + err.message, "error");
    }
  };

  $$("[data-open]").forEach((tile) => {
    tile.onclick = async (e) => {
      if (e.target.closest("button")) return;
      if (p && tile.dataset.open === p.id) return navigateTo("commands");
      await openProject(tile.dataset.open);
      renderDashboard(container);
    };
  });
  $$("[data-export]").forEach((b) => {
    b.onclick = async () => {
      try {
        const file = await window.api.project.export(b.dataset.export);
        if (file) showToast("Project exported (token not included)", "success");
      } catch (err) {
        showToast("Export failed: " + err.message, "error");
      }
    };
  });
  $$("[data-delete]").forEach((b) => {
    b.onclick = async () => {
      const proj = projects.find((x) => x.id === b.dataset.delete);
      if (!(await confirmDialog({ title: `Delete "${proj.name}"?`, message: "The project, its generated code and database will be removed permanently.", confirmText: "Delete", danger: true }))) return;
      await window.api.project.delete(proj.id);
      if (p && p.id === proj.id) {
        AppState.currentProject = null;
        localStorage.removeItem("botify-last-project");
      }
      AppState.projects = await window.api.project.list();
      updateSidebar();
      renderDashboard(container);
      showToast("Project deleted", "success");
    };
  });
}

let lastDashStatus = "";
document.addEventListener("botify:status", () => {
  const key = `${AppState.bot.running}-${AppState.bot.online}`;
  if (key === lastDashStatus) return;
  lastDashStatus = key;
  if (AppState.currentPage === "dashboard") {
    const el = document.getElementById("page-dashboard");
    const pill = el && el.querySelector(".bot-pill");
    if (pill) renderDashboard(el);
  }
});
