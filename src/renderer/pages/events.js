/* Events page: toggle event handlers and edit their flows visually. */

function renderEvents(el) {
  if (!AppState.currentProject) return noProjectState(el, "event handlers");
  const p = AppState.currentProject;
  const events = p.events || [];
  const engine = p.engine;
  const unsupported = { lua: ["on_interaction"] };

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Events</h1>
        <p class="page-subtitle">React to things happening on Discord - welcome new members, auto-react to messages and more.</p>
      </div>
    </div>
    <div class="event-grid">
      ${BotifyBlocks.EVENTS.map((meta) => {
        const idx = events.findIndex((e) => e.type === meta.type);
        const evt = events[idx] || { type: meta.type, enabled: false, actions: [] };
        const blocks = countBlocks(evt.actions);
        const notSupported = (unsupported[engine] || []).includes(meta.type);
        return `
        <div class="event-card${evt.enabled ? " enabled" : ""}${notSupported ? " disabled" : ""}" data-type="${meta.type}">
          <div class="event-card-icon">${meta.icon}</div>
          <div class="event-card-body">
            <div class="event-card-title">${escapeHtml(meta.label)} <code class="event-card-code">${meta.type}</code></div>
            <div class="event-card-desc">${escapeHtml(meta.description)}</div>
            <div class="event-card-meta">${notSupported ? `<span class="tag tag-warn">Not available for ${escapeHtml(engine)}</span>` : `🧩 ${blocks} block${blocks === 1 ? "" : "s"}`}</div>
          </div>
          <div class="event-card-actions">
            <div class="toggle ${evt.enabled ? "active" : ""}" data-toggle="${meta.type}" title="${evt.enabled ? "Disable" : "Enable"}"></div>
            <button class="btn btn-secondary btn-sm" data-edit="${meta.type}" ${notSupported ? "disabled" : ""}>${icon("edit", 14)} Edit flow</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;

  const ensure = (type) => {
    let evt = p.events.find((e) => e.type === type);
    if (!evt) {
      evt = { type, enabled: false, actions: [] };
      p.events.push(evt);
    }
    return evt;
  };

  el.querySelectorAll("[data-toggle]").forEach((t) => {
    t.onclick = async () => {
      const evt = ensure(t.dataset.toggle);
      evt.enabled = !evt.enabled;
      await saveProject();
      renderEvents(el);
      showToast(`${evt.type} ${evt.enabled ? "enabled" : "disabled"}`, "info");
    };
  });

  el.querySelectorAll("[data-edit]").forEach((b) => {
    b.onclick = () => {
      const meta = BotifyBlocks.EVENTS.find((m) => m.type === b.dataset.edit);
      const evt = ensure(meta.type);
      openFlowEditor({
        title: meta.label,
        icon: meta.icon,
        trigger: { label: `When: ${meta.label}`, sub: meta.description, icon: meta.icon },
        actions: evt.actions,
        graph: evt.graph,
        triggerKind: "event",
        variables: () => (BotifyBlocks.TRIGGER_VARIABLES[meta.type] || []).filter((v) => !["client", "interaction", "reaction", "oldMessage"].includes(v)),
        onSave: async (actions, graph) => {
          evt.actions = actions;
          evt.graph = graph;
          if (actions.length && !evt.enabled) {
            evt.enabled = true;
            showToast(`${meta.label} enabled`, "info");
          }
          await saveProject();
          renderEvents(document.getElementById("page-events"));
          showToast("Event flow saved", "success");
          return true;
        },
      });
    };
  });
}
