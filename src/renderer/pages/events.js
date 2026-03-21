const EVENT_DESCRIPTIONS = {
    on_ready: "Fires when the bot successfully connects to Discord",
    on_message: "Fires when a message is sent in any accessible channel",
    on_member_join: "Fires when a new member joins the server",
    on_member_leave: "Fires when a member leaves the server",
    on_interaction: "Fires when a user interacts with a slash command or component",
    on_reaction_add: "Fires when a reaction is added to a message",
};

function renderEvents(el) {
    if (!AppState.currentProject) {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div></div>';
        return;
    }
    const events = AppState.currentProject.events || [];
    el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Events</h1><p class="page-subtitle">Configure event handlers</p></div>
    </div>
    <div class="event-list">
      ${events.map((evt, i) => `
        <div class="event-item">
          <div class="event-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${evt.enabled ? "var(--success)" : "var(--text-muted)"}" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <div>
              <div class="event-name">${evt.type}</div>
              <div class="event-desc">${EVENT_DESCRIPTIONS[evt.type] || ""}</div>
            </div>
          </div>
          <div class="flex items-center gap-md">
            <button class="btn btn-ghost btn-sm evt-config" data-index="${i}">Configure</button>
            <div class="toggle ${evt.enabled ? "active" : ""}" data-index="${i}" id="evt-toggle-${i}"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;

    el.querySelectorAll(".toggle").forEach((toggle) => {
        toggle.onclick = async () => {
            const idx = parseInt(toggle.dataset.index);
            AppState.currentProject.events[idx].enabled = !AppState.currentProject.events[idx].enabled;
            toggle.classList.toggle("active");
            await saveProject();
            showToast(`${AppState.currentProject.events[idx].type} ${AppState.currentProject.events[idx].enabled ? "enabled" : "disabled"}`, "info");
        };
    });

    el.querySelectorAll(".evt-config").forEach((btn) => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.index);
            const evt = AppState.currentProject.events[idx];
            showModal(`
        <h2 class="modal-title">Configure ${evt.type}</h2>
        <p class="page-subtitle mb-md">${EVENT_DESCRIPTIONS[evt.type] || ""}</p>
        <div class="input-group">
          <label class="input-label">Custom Actions (JSON)</label>
          <textarea class="input" id="evt-actions" rows="6" placeholder='[{"type":"send_message","content":"Hello!"}]'>${JSON.stringify(evt.actions || [], null, 2)}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="evt-cancel">Cancel</button>
          <button class="btn btn-primary" id="evt-save">Save</button>
        </div>
      `, (container) => {
                container.querySelector("#evt-cancel").onclick = hideModal;
                container.querySelector("#evt-save").onclick = async () => {
                    try {
                        const actions = JSON.parse(container.querySelector("#evt-actions").value || "[]");
                        AppState.currentProject.events[idx].actions = actions;
                        await saveProject();
                        hideModal();
                        showToast("Event configured", "success");
                    } catch {
                        showToast("Invalid JSON", "error");
                    }
                };
            });
        };
    });
}
