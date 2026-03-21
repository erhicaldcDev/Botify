function renderPlugins(el) {
    el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Plugins</h1><p class="page-subtitle">Extend your bot maker</p></div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary" id="plg-reload">Reload</button>
        <button class="btn btn-secondary" id="plg-open-dir">Open Folder</button>
      </div>
    </div>
    <div id="plugins-list"></div>
  `;

    loadPlugins();

    el.querySelector("#plg-reload").onclick = async () => {
        await window.api.plugins.reload();
        loadPlugins();
        showToast("Plugins reloaded", "info");
    };

    el.querySelector("#plg-open-dir").onclick = async () => {
        const paths = await window.api.app.getPath();
        await window.api.shell.openPath(paths.plugins);
    };

    async function loadPlugins() {
        const plugins = await window.api.plugins.list();
        const list = el.querySelector("#plugins-list");

        if (plugins.length === 0) {
            list.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/><circle cx="12" cy="12" r="3"/></svg>
          <div class="empty-state-title">No plugins installed</div>
          <div class="empty-state-text">Place plugin folders with manifest.json in the plugins directory</div>
        </div>
      `;
            return;
        }

        list.innerHTML = `${plugins.map((p) => `
      <div class="plugin-card">
        <div class="plugin-header">
           <div class="plugin-name">${p.name}${p.error ? ' <span style="color:var(--danger)">(error)</span>' : ""}</div>
           <span class="tag tag-${p.type || 'js'}">${(p.type || 'js').toUpperCase()}</span>
        </div>
        <div class="plugin-desc">${p.description}</div>
        <div class="plugin-meta" style="font-size:11px; color:var(--text-muted); display:flex; gap:10px; margin-top:10px;">
            <span>v${p.version}</span>
            <span>by ${p.author}</span>
        </div>
        <div class="plugin-footer">
          <div style="font-size:12px; font-weight:600; color:${p.enabled ? 'var(--success)' : 'var(--text-muted)'}">
            ${p.enabled ? "ACTIVE" : "DISABLED"}
          </div>
          <div class="switchbox ${p.enabled ? "active" : ""}" data-id="${p.id}" id="plg-toggle-${p.id}"></div>
        </div>
      </div>
    `).join("")}`;

        list.querySelectorAll(".switchbox").forEach((toggle) => {
            toggle.onclick = async () => {
                const newState = await window.api.plugins.toggle(toggle.dataset.id);
                toggle.classList.toggle("active", newState);
                
                const statusEl = toggle.parentElement.querySelector("div:first-child");
                if (statusEl) {
                  statusEl.textContent = newState ? "ACTIVE" : "DISABLED";
                  statusEl.style.color = newState ? 'var(--success)' : 'var(--text-muted)';
                }
                
                showToast(`Plugin ${newState ? "enabled" : "disabled"}`, "info");
            };
        });
    }
}
