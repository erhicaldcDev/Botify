function renderDashboard(container) {
  const lang = localStorage.getItem('bot-maker-lang') || 'en';
  
  const content = {
    en: {
      welcome: "Welcome to Botify",
      subtitle: "The most advanced open-source Discord bot creator. Build, deploy, and manage your bots with zero code.",
      launch: "Launchpad",
      create: "Create New Project",
      createDesc: "Start a fresh bot project from scratch",
      open: "Open Existing",
      openDesc: "Load a project from your computer",
      docs: "Documentation",
      docsDesc: "Learn how to use Botify like a pro",
      discord: "Discord Server Soon",
      discordDesc: "Community server is coming soon!",
      settings: "Global Settings",
      settingsDesc: "Configure your workspace and themes",
      lang: "Select Language"
    },
    pl: {
      welcome: "Witaj w Botify",
      subtitle: "Najbardziej zaawansowany kreator botów Discord Open-Source. Buduj i zarządzaj bez pisania kodu.",
      launch: "Panel Startowy",
      create: "Stwórz Projekt",
      createDesc: "Zacznij nowy projekt bota od zera",
      open: "Otwórz Projekt",
      openDesc: "Wczytaj projekt ze swojego komputera",
      docs: "Dokumentacja",
      docsDesc: "Naucz się obsługi Botify jak profesjonalista",
      discord: "Serwer Discord wkrótce",
      discordDesc: "Serwer społeczności zostanie wkrótce otwarty!",
      settings: "Ustawienia",
      settingsDesc: "Konfiguruj swój wygląd i opcje",
      lang: "Wybierz Język"
    }
  };

  const t = content[lang] || content.en;

  container.innerHTML = `
    <div class="welcome-container">
      <div class="welcome-hero">
        <h1 class="welcome-title">${t.welcome}</h1>
        <p class="welcome-subtitle">${t.subtitle}</p>
      </div>

      <div class="launchpad-grid" style="grid-template-columns: repeat(2, 1fr); max-width: 800px; margin: 0 auto 40px auto;">
        <div class="launchpad-card" id="dash-new-project">
          <div class="launchpad-card-icon">➕</div>
          <div class="launchpad-card-title">${t.create}</div>
          <div class="launchpad-card-desc">${t.createDesc}</div>
        </div>

        <div class="launchpad-card" id="dash-open-project">
          <div class="launchpad-card-icon">📂</div>
          <div class="launchpad-card-title">${t.open}</div>
          <div class="launchpad-card-desc">${t.openDesc}</div>
        </div>
      </div>

      <div class="launchpad-grid small-icons">
        <div class="launchpad-card small" onclick="require('electron').shell.openExternal('https://docs.botify.app')">
          <div class="launchpad-card-icon" style="font-size: 20px;">📖</div>
          <div class="launchpad-card-title">${t.docs}</div>
        </div>
        <div class="launchpad-card small" onclick="require('electron').shell.openExternal('https://discord.gg/botify')">
          <div class="launchpad-card-icon" style="font-size: 20px;">💬</div>
          <div class="launchpad-card-title">${t.discord}</div>
        </div>
        <div class="launchpad-card small" onclick="navigateTo('settings')">
          <div class="launchpad-card-icon" style="font-size: 20px;">⚙️</div>
          <div class="launchpad-card-title">${t.settings}</div>
        </div>
        <div class="launchpad-card small" onclick="require('electron').shell.openExternal('https://github.com/erhicaldcDev')">
          <div class="launchpad-card-icon" style="font-size: 20px;">⭐</div>
          <div class="launchpad-card-title">GitHub</div>
        </div>
      </div>

      <div class="lang-selector">
        <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="setLanguage('en')">
          <span>🇺🇸</span> English
        </button>
        <button class="lang-btn ${lang === 'pl' ? 'active' : ''}" onclick="setLanguage('pl')">
          <span>🇵🇱</span> Polski
        </button>
      </div>
    </div>
  `;

  container.querySelector("#dash-new-project").onclick = () => {
    if (typeof window.showNewProjectModal === "function") window.showNewProjectModal();
  };

  container.querySelector("#dash-open-project").onclick = () => {
    showProjectSelectorModal();
  };
}

async function showProjectSelectorModal() {
  const projects = await window.api.project.list();
  
  showModal(`
    <style>
      .selector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 20px; max-height: 400px; overflow-y: auto; padding: 5px; }
      .project-item { background: var(--bg-tertiary); padding: 15px; border-radius: 12px; border: 1px solid var(--border-subtle); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; }
      .project-item:hover { border-color: var(--accent); background: var(--bg-hover); transform: translateY(-2px); }
      .proj-icon { font-size: 20px; }
      .proj-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .proj-engine { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
    </style>
    <div style="padding: 10px;">
      <h2 class="modal-title">Open Your Bot Project</h2>
      <p style="color: var(--text-secondary); font-size: 13px;">Select a project from the list below to load it into the editor.</p>
      
      <div class="selector-grid" id="project-selector-list">
        ${projects.length === 0 ? '<p style="color: var(--text-muted);">No projects found.</p>' : projects.map(p => `
          <div class="project-item" onclick="selectProject('${p.id}')">
            <div class="proj-icon">${p.engine === 'node' ? '🟢' : (p.engine === 'python' ? '🐍' : '🌙')}</div>
            <div class="project-card-info">
              <div class="proj-name">${p.name}</div>
              <div class="proj-engine">${p.engine} • ${p.prefix}</div>
            </div>
          </div>
        `).join("")}
      </div>
      
      <div class="modal-actions" style="margin-top: 20px;">
        <button class="btn btn-secondary" onclick="hideModal()">Close</button>
      </div>
    </div>
  `, (container) => {
    window.selectProject = async (id) => {
      const project = await window.api.project.open(id);
      if (project) {
        AppState.currentProject = project;
        updateSidebar();
        hideModal();
        showToast(`Project '${project.name}' loaded!`, "success");
        navigateTo("dashboard");
      }
    };
  });
}

window.setLanguage = (lang) => {
  localStorage.setItem('bot-maker-lang', lang);
  if (typeof updateLanguage === "function") updateLanguage();
  renderPage("dashboard");
};
