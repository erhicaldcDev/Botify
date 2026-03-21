function renderSettings(el) {
  if (!AppState.currentProject) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div></div>';
    return;
  }
  const p = AppState.currentProject;

  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Settings & Themes</h1><p class="page-subtitle">Configure your project and IDE appearance</p></div>
    </div>
    
    <div class="card mb-md">
      <div class="card-title mb-md">Appearance & UI</div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Application Theme</label>
          <select class="input" id="set-theme">
            <option value="theme-dark">Dark (Modern)</option>
            <option value="theme-midnight">Midnight (Deep Blue)</option>
            <option value="theme-light">Light (Clean)</option>
            <option value="theme-cyberpunk">Cyberpunk (Neon)</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">IDE Font Family</label>
          <select class="input" id="set-font">
            <option value="JetBrains Mono">JetBrains Mono</option>
            <option value="Cascadia Code">Cascadia Code</option>
            <option value="Fira Code">Fira Code</option>
          </select>
        </div>
      </div>
      <div class="grid-2" style="margin-top: 1rem;">
        <div class="input-group">
          <label class="input-label">Language / Język</label>
          <select class="input" id="set-language">
            <option value="en">English</option>
            <option value="pl">Polski</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card-title mb-md">General Config</div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Project Name</label>
          <input class="input" id="set-name" value="${p.name}" />
        </div>
        <div class="input-group">
          <label class="input-label">Engine</label>
          <select class="input" id="set-engine">
            <option value="node" ${p.engine === "node" ? "selected" : ""}>Node.js (discord.js)</option>
            <option value="python" ${p.engine === "python" ? "selected" : ""}>Python (discord.py)</option>
            <option value="lua" ${p.engine === "lua" ? "selected" : ""}>Lua (Discordia)</option>
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Prefix</label>
          <input class="input" id="set-prefix" value="${p.prefix || "!"}" />
        </div>
        <div class="input-group">
          <label class="input-label">Project ID</label>
          <input class="input" value="${p.id}" disabled style="opacity:0.5" />
        </div>
      </div>
    </div>
    
    <div class="card mb-md">
      <div class="card-title mb-md">Bot Token</div>
      <div class="flex items-center gap-sm">
        <input class="input" id="set-token" type="password" placeholder="Enter bot token" style="flex:1" />
        <button class="btn btn-secondary" id="set-token-show">Show</button>
        <button class="btn btn-primary" id="set-token-save">Update Token</button>
      </div>
    </div>
    
    <div class="card mb-md">
      <div class="card-title mb-md">Maintenance</div>
      <div class="flex gap-sm">
        <button class="btn btn-primary" id="set-generate">Regenerate Code</button>
        <button class="btn btn-secondary" id="set-open-output">Open Root Dir</button>
        <button class="btn btn-danger" id="set-delete">Delete Project</button>
      </div>
    </div>
    
    <div class="flex justify-between mt-lg">
      <span style="color:var(--text-muted);font-size:12px">Deployment ID: ${p.id.substring(0, 8)}</span>
      <button class="btn btn-primary" id="set-save">Apply All Changes</button>
    </div>
  `;

  const currentTheme = document.body.className.split(' ').find(c => c.startsWith('theme-')) || 'theme-dark';
  el.querySelector("#set-theme").value = currentTheme;

  el.querySelector("#set-theme").onchange = (e) => {
    document.body.className = e.target.value;
    localStorage.setItem('bot-maker-theme', e.target.value);
  };

  const currentLanguage = localStorage.getItem('bot-maker-lang') || 'en';
  el.querySelector("#set-language").value = currentLanguage;

  el.querySelector("#set-language").onchange = (e) => {
    localStorage.setItem('bot-maker-lang', e.target.value);
    window.updateLanguage();
    renderSettings(el);
    showToast(e.target.value === 'pl' ? "Zmieniono język" : "Language changed", "success");
  };

  el.querySelector("#set-token-show").onclick = async () => {

    const tokenInput = el.querySelector("#set-token");
    if (tokenInput.type === "password") {
      const decrypted = await window.api.project.getToken(p.id);
      if (decrypted) tokenInput.value = decrypted;
      tokenInput.type = "text";
      el.querySelector("#set-token-show").textContent = "Hide";
    } else {
      tokenInput.type = "password";
      tokenInput.value = "";
      el.querySelector("#set-token-show").textContent = "Show";
    }
  };

  el.querySelector("#set-token-save").onclick = async () => {
    const token = el.querySelector("#set-token").value.trim();
    if (token) {
      const valid = await window.api.token.validate(token);
      if (!valid) { showToast("Invalid token format", "error"); return; }
    }
    await window.api.project.setToken(p.id, token);
    showToast("Token updated", "success");
  };

  el.querySelector("#set-save").onclick = async () => {
    AppState.currentProject.name = el.querySelector("#set-name").value.trim() || p.name;
    const newEngine = el.querySelector("#set-engine").value;
    const engineChanged = newEngine !== AppState.currentProject.engine;
    AppState.currentProject.engine = newEngine;
    AppState.currentProject.prefix = el.querySelector("#set-prefix").value.trim() || "!";
    await saveProject();
    updateSidebar();
    showToast("Settings applied", "success");
    if (engineChanged) {
      showToast("Engine changed - re-generate code", "warning");
    }
  };

  el.querySelector("#set-generate").onclick = async () => {
    showToast("Compiling code structure...", "info");
    try {
      await window.api.generate.code(AppState.currentProject);
      showToast("Code generated successfully!", "success");
    } catch (err) {
      showToast("Compilation failed", "error");
    }
  };

  el.querySelector("#set-open-output").onclick = async () => {
    const paths = await window.api.app.getPath();
    const sep = paths.projects.includes('\\') ? '\\' : '/';
    const outputPath = [paths.projects, p.id, 'output'].join(sep);
    await window.api.shell.openPath(outputPath);
  };

  el.querySelector("#set-delete").onclick = async () => {
    if (!confirm("Delete this project permanently?")) return;
    await window.api.project.delete(p.id);
    AppState.currentProject = null;
    AppState.projects = await window.api.project.list();
    updateSidebar();
    navigateTo("dashboard");
    showToast("Project purged", "success");
  };
}
