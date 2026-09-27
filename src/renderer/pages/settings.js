/* Settings: app appearance + project configuration, token, intents and maintenance. */

function renderSettings(el) {
  const p = AppState.currentProject;
  const theme = localStorage.getItem("bot-maker-theme") || "theme-dark";
  const lang = localStorage.getItem("bot-maker-lang") || "en";
  const ideFont = localStorage.getItem("botify-ide-font") || "JetBrains Mono";
  const ideSize = localStorage.getItem("botify-ide-size") || "13";
  const s = p ? p.settings || (p.settings = { intents: { messageContent: true, members: true, presences: false }, devGuildId: "" }) : null;
  if (s && !s.intents) s.intents = { messageContent: true, members: true, presences: false };

  const THEMES = [
    { id: "theme-dark", name: "Dark", colors: ["#0d0f14", "#181c26", "#7c6aef"] },
    { id: "theme-midnight", name: "Midnight", colors: ["#05070a", "#0e121a", "#3182ce"] },
    { id: "theme-discord", name: "Discord", colors: ["#1e1f22", "#2b2d31", "#5865f2"] },
    { id: "theme-light", name: "Light", colors: ["#f8f9fc", "#ffffff", "#6366f1"] },
    { id: "theme-cyberpunk", name: "Cyberpunk", colors: ["#0b021d", "#1b0542", "#ff00ff"] },
  ];

  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Settings</h1><p class="page-subtitle">Appearance, project configuration and bot connection.</p></div>
      ${p ? `<button class="btn btn-primary" data-act="save">${icon("save", 15)} Save changes</button>` : ""}
    </div>

    <div class="settings-grid">
      <div class="card">
        <div class="card-title mb-md">Appearance</div>
        <div class="input-group"><label class="input-label">Theme</label>
          <div class="theme-grid">${THEMES.map((t) => `
            <button class="theme-card ${theme === t.id ? "active" : ""}" data-theme="${t.id}">
              <span class="theme-swatch">${t.colors.map((c) => `<i style="background:${c}"></i>`).join("")}</span>${t.name}
            </button>`).join("")}</div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">Language / Język</label>
            <select class="input" data-el="lang"><option value="en">English</option><option value="pl">Polski</option></select></div>
          <div class="input-group"><label class="input-label">Code editor font</label>
            <select class="input" data-el="font">${["JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", "monospace"].map((f) => `<option ${f === ideFont ? "selected" : ""}>${f}</option>`).join("")}</select></div>
        </div>
        <div class="input-group"><label class="input-label">Code editor font size</label>
          <input class="input" type="number" min="10" max="24" data-el="size" value="${escapeHtml(ideSize)}" /></div>
      </div>

      ${p ? `
      <div class="card">
        <div class="card-title mb-md">Bot token</div>
        <p class="text-sm text-muted mb-md">Get it from the <a class="link" data-link="https://discord.com/developers/applications">Discord Developer Portal</a> → your app → <b>Bot</b> → Reset Token. It is stored encrypted on this computer.</p>
        <div class="token-status ${p.hasToken ? "ok" : "missing"}">${p.hasToken ? `${icon("check", 14)} Token saved` : `${icon("alert", 14)} No token yet - the bot can't log in`}</div>
        <div class="flex items-center gap-sm mt-md">
          <input class="input" data-el="token" type="password" placeholder="${p.hasToken ? "Paste a new token to replace it" : "Paste your bot token"}" style="flex:1" autocomplete="off" />
          <button class="btn btn-secondary" data-act="show-token">${icon("eye", 14)}</button>
          <button class="btn btn-primary" data-act="save-token">Save token</button>
        </div>
        ${p.hasToken ? `<button class="btn btn-ghost btn-sm mt-sm" data-act="clear-token">Remove saved token</button>` : ""}
      </div>

      <div class="card">
        <div class="card-title mb-md">Project</div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">Project name</label><input class="input" data-el="name" value="${escapeHtml(p.name)}" maxlength="64" /></div>
          <div class="input-group"><label class="input-label">Prefix</label><input class="input" data-el="prefix" value="${escapeHtml(p.prefix || "!")}" maxlength="5" /></div>
        </div>
        <div class="input-group"><label class="input-label">Engine</label>
          <div class="segmented" data-el="engine">
            ${Object.entries(ENGINE_INFO).map(([k, v]) => `<button data-v="${k}" class="${p.engine === k ? "active" : ""}">${v.icon} ${v.label}</button>`).join("")}
          </div>
          <div class="input-help">Your blocks are converted to the selected language when generating. Lua only supports prefix commands and a subset of blocks.</div>
        </div>
        <div class="input-group"><label class="input-label">Test server ID (optional)</label>
          <input class="input" data-el="guild" value="${escapeHtml(s.devGuildId || "")}" placeholder="Right-click your server → Copy Server ID" />
          <div class="input-help">Slash commands appear instantly in this server. Leave empty to register globally (may take a moment).</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title mb-md">Gateway intents</div>
        <p class="text-sm text-muted mb-md">Privileged intents must also be switched on in the Developer Portal (Bot tab → Privileged Gateway Intents), otherwise login fails.</p>
        ${[
          ["messageContent", "Message Content", "Needed for prefix commands and reading messages in events."],
          ["members", "Server Members", "Needed for member join/leave events and finding members."],
          ["presences", "Presence", "Only needed if you read user statuses. Usually leave off."],
        ].map(([k, label, help]) => `
          <label class="toggle-row toggle-row-block"><div class="toggle ${s.intents[k] !== false && (k !== "presences" || s.intents[k]) ? "active" : ""}" data-intent="${k}"></div>
            <span><b>${label}</b><small>${help}</small></span></label>`).join("")}
      </div>

      <div class="card">
        <div class="card-title mb-md">Maintenance</div>
        <div class="flex gap-sm flex-wrap">
          <button class="btn btn-secondary" data-act="generate">${icon("code", 14)} Regenerate code</button>
          <button class="btn btn-secondary" data-act="folder">${icon("folder", 14)} Open output folder</button>
          <button class="btn btn-secondary" data-act="export">${icon("download", 14)} Export project</button>
          <button class="btn btn-danger" data-act="delete">${icon("trash", 14)} Delete project</button>
        </div>
        <div class="text-xs text-muted mt-md">Project ID: <code>${escapeHtml(p.id)}</code></div>
      </div>` : `
      <div class="card"><div class="empty-state"><div class="empty-state-title">No project open</div><div class="empty-state-text">Project settings appear here once you open a bot project.</div></div></div>`}
    </div>`;

  el.querySelectorAll("[data-link]").forEach((a) => { a.onclick = () => openExternal(a.dataset.link); });
  el.querySelectorAll("[data-theme]").forEach((b) => {
    b.onclick = () => {
      document.body.className = b.dataset.theme;
      localStorage.setItem("bot-maker-theme", b.dataset.theme);
      el.querySelectorAll("[data-theme]").forEach((x) => x.classList.toggle("active", x === b));
    };
  });
  const langSel = el.querySelector('[data-el="lang"]');
  langSel.value = lang;
  langSel.onchange = () => {
    localStorage.setItem("bot-maker-lang", langSel.value);
    window.updateLanguage();
    showToast(langSel.value === "pl" ? "Zmieniono język" : "Language changed", "success");
  };
  el.querySelector('[data-el="font"]').onchange = (e) => localStorage.setItem("botify-ide-font", e.target.value);
  el.querySelector('[data-el="size"]').onchange = (e) => localStorage.setItem("botify-ide-size", String(Math.min(24, Math.max(10, Number(e.target.value) || 13))));

  if (!p) return;

  let engine = p.engine;
  el.querySelectorAll('[data-el="engine"] button').forEach((b) => {
    b.onclick = () => {
      engine = b.dataset.v;
      el.querySelectorAll('[data-el="engine"] button').forEach((x) => x.classList.toggle("active", x === b));
    };
  });
  el.querySelectorAll("[data-intent]").forEach((t) => {
    t.onclick = () => t.classList.toggle("active");
  });

  el.querySelector('[data-act="save"]').onclick = async () => {
    const name = el.querySelector('[data-el="name"]').value.trim();
    if (!name) return showToast("Project name can't be empty", "warning");
    const guild = el.querySelector('[data-el="guild"]').value.trim();
    if (guild && !/^\d{15,25}$/.test(guild)) return showToast("Test server ID must be a number (enable Developer Mode in Discord to copy it)", "warning");
    const engineChanged = engine !== p.engine;
    if (engineChanged && engine === "lua" && p.commands.some((c) => c.type !== "prefix")) {
      if (!(await confirmDialog({ title: "Switch to Lua?", message: "Discordia has no slash commands - your slash commands will be generated as prefix commands.", confirmText: "Switch" }))) return;
    }
    p.name = name;
    p.prefix = el.querySelector('[data-el="prefix"]').value.trim() || "!";
    p.engine = engine;
    s.devGuildId = guild;
    el.querySelectorAll("[data-intent]").forEach((t) => { s.intents[t.dataset.intent] = t.classList.contains("active"); });
    await saveProject();
    AppState.projects = await window.api.project.list();
    showToast(engineChanged ? "Saved - the bot will be rebuilt for the new engine on next run" : "Settings saved", "success");
    renderSettings(el);
  };

  const tokenInput = el.querySelector('[data-el="token"]');
  el.querySelector('[data-act="show-token"]').onclick = async () => {
    if (tokenInput.type === "password") {
      if (!tokenInput.value && p.hasToken) tokenInput.value = (await window.api.project.getToken(p.id)) || "";
      tokenInput.type = "text";
    } else {
      tokenInput.type = "password";
    }
  };
  el.querySelector('[data-act="save-token"]').onclick = async () => {
    const token = tokenInput.value.trim();
    if (!token) return showToast("Paste a token first", "warning");
    if (!(await window.api.token.validate(token))) return showToast("That doesn't look like a bot token (it has 3 parts separated by dots)", "error");
    await window.api.project.setToken(p.id, token);
    p.hasToken = true;
    showToast("Token saved securely", "success");
    renderSettings(el);
  };
  const clearBtn = el.querySelector('[data-act="clear-token"]');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      if (!(await confirmDialog({ title: "Remove token?", message: "The bot won't be able to log in until you add a new one.", confirmText: "Remove", danger: true }))) return;
      await window.api.project.setToken(p.id, null);
      p.hasToken = false;
      renderSettings(el);
    };
  }
  el.querySelector('[data-act="generate"]').onclick = () => BotRunner.generate().catch((e) => showToast("Generation failed: " + e.message, "error"));
  el.querySelector('[data-act="folder"]').onclick = async () => {
    const paths = await window.api.app.getPath();
    const sep = paths.projects.includes("\\") ? "\\" : "/";
    window.api.shell.openPath([paths.projects, p.id, "output"].join(sep)).catch((e) => showToast(e.message, "error"));
  };
  el.querySelector('[data-act="export"]').onclick = async () => {
    const file = await window.api.project.export(p.id);
    if (file) showToast("Project exported (token not included)", "success");
  };
  el.querySelector('[data-act="delete"]').onclick = async () => {
    if (!(await confirmDialog({ title: `Delete "${p.name}"?`, message: "The project, generated code and database will be removed permanently.", confirmText: "Delete forever", danger: true }))) return;
    await window.api.project.delete(p.id);
    AppState.currentProject = null;
    localStorage.removeItem("botify-last-project");
    AppState.projects = await window.api.project.list();
    updateSidebar();
    navigateTo("dashboard");
    showToast("Project deleted", "success");
  };
}
