/* Plugins: enable plugins per project and see what they add. */

/** Load visual blocks contributed by the plugins enabled in the current project. */
async function refreshPluginBlocks() {
  const p = AppState.currentProject;
  if (!p) { AppState.pluginBlocks = []; return; }
  try {
    const plugins = await window.api.plugins.list();
    const enabled = new Set(p.plugins || []);
    AppState.pluginBlocks = plugins.filter((pl) => enabled.has(pl.id) && pl.enabled && !pl.error).flatMap((pl) => pl.blocks || []);
  } catch {
    AppState.pluginBlocks = [];
  }
}
window.refreshPluginBlocks = refreshPluginBlocks;

async function renderPlugins(el) {
  const p = AppState.currentProject;
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Plugins</h1>
        <p class="page-subtitle">${p ? `Turn on ready-made features for <b>${escapeHtml(p.name)}</b>. Plugins add commands, events and new blocks.` : "Open a project to enable plugins for it."}</p>
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary" data-act="reload">${icon("restart", 14)} Reload</button>
        <button class="btn btn-secondary" data-act="folder">${icon("folder", 14)} Plugins folder</button>
      </div>
    </div>
    ${p && p.engine !== "node" ? `<div class="notice notice-warn">${icon("alert", 16)} Plugins currently only work with the Node.js engine. They will be skipped when generating ${escapeHtml(p.engine)} code.</div>` : ""}
    <div class="toolbar-row">
      <div class="search-box">${icon("search", 14)}<input class="input" data-el="search" placeholder="Search plugins..." /></div>
    </div>
    <div class="plugin-grid" data-el="list"><div class="text-muted">Loading...</div></div>`;

  el.querySelector('[data-act="reload"]').onclick = async () => {
    await window.api.plugins.reload();
    await refreshPluginBlocks();
    draw();
    showToast("Plugins reloaded", "info");
  };
  el.querySelector('[data-act="folder"]').onclick = async () => {
    const paths = await window.api.app.getPath();
    window.api.shell.openPath(paths.plugins).catch((e) => showToast(e.message, "error"));
  };

  let plugins = [];
  const list = el.querySelector('[data-el="list"]');
  const search = el.querySelector('[data-el="search"]');
  search.oninput = debounce(() => draw(false), 120);

  async function draw(reload = true) {
    if (reload) plugins = await window.api.plugins.list();
    const q = search.value.trim().toLowerCase();
    const enabled = new Set((p && p.plugins) || []);
    const shown = plugins.filter((pl) => !q || pl.name.toLowerCase().includes(q) || (pl.description || "").toLowerCase().includes(q));
    if (!shown.length) {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-title">No plugins found</div><div class="empty-state-text">Put plugin folders (with manifest.json) in the plugins folder.</div></div>`;
      return;
    }
    list.innerHTML = shown.map((pl) => {
      const on = enabled.has(pl.id);
      const cmdNames = (pl.commands || []).map((c) => "/" + c.name);
      const conflicts = p ? cmdNames.filter((n) => (p.commands || []).some((c) => "/" + c.name === n)) : [];
      return `
      <div class="plugin-card${on ? " active" : ""}${pl.error ? " error" : ""}">
        <div class="plugin-header">
          <div>
            <div class="plugin-name">${escapeHtml(pl.name)}</div>
            <div class="plugin-meta">v${escapeHtml(pl.version)} • by ${escapeHtml(pl.author)}</div>
          </div>
          ${p ? `<div class="toggle ${on ? "active" : ""}" data-toggle="${escapeHtml(pl.id)}" ${pl.error || !pl.enabled ? 'style="opacity:.4;pointer-events:none"' : ""}></div>` : ""}
        </div>
        <div class="plugin-desc">${escapeHtml(pl.description || "")}</div>
        ${pl.error ? `<div class="notice notice-err notice-sm">${escapeHtml(pl.error)}</div>` : ""}
        <div class="plugin-provides">
          ${cmdNames.length ? `<div><span class="provides-label">Commands</span>${cmdNames.slice(0, 8).map((n) => `<code class="chip">${escapeHtml(n)}</code>`).join("")}${cmdNames.length > 8 ? `<span class="text-muted text-xs">+${cmdNames.length - 8}</span>` : ""}</div>` : ""}
          ${(pl.blocks || []).length ? `<div><span class="provides-label">Blocks</span>${pl.blocks.map((b) => `<span class="chip">${escapeHtml(b.icon || "")} ${escapeHtml(b.label)}</span>`).join("")}</div>` : ""}
          ${(pl.events || []).length ? `<div><span class="provides-label">Events</span>${pl.events.map((e) => `<code class="chip chip-muted">${escapeHtml(e)}</code>`).join("")}</div>` : ""}
          ${(pl.hooks || []).length ? `<div><span class="provides-label">Hooks</span>${pl.hooks.map((h) => `<code class="chip chip-muted">${escapeHtml(h)}</code>`).join("")}</div>` : ""}
          ${Object.keys(pl.dependencies || {}).length ? `<div><span class="provides-label">Installs</span>${Object.keys(pl.dependencies).map((d) => `<code class="chip chip-muted">${escapeHtml(d)}</code>`).join("")}</div>` : ""}
        </div>
        ${conflicts.length ? `<div class="text-xs text-warn">⚠ ${escapeHtml(conflicts.join(", "))} already exist in your project - your version wins.</div>` : ""}
      </div>`;
    }).join("");

    list.querySelectorAll("[data-toggle]").forEach((t) => {
      t.onclick = async () => {
        const id = t.dataset.toggle;
        const set = new Set(p.plugins || []);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        p.plugins = [...set];
        await saveProject();
        await refreshPluginBlocks();
        draw(false);
        const pl = plugins.find((x) => x.id === id);
        showToast(`${pl.name} ${set.has(id) ? "enabled" : "disabled"} - rebuild the bot to apply`, "info");
      };
    });
  }
  draw();
}
