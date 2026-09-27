/* Commands page: list + full-screen visual flow editor. */

const COMMAND_TEMPLATES = [
  { id: "blank", icon: "📄", name: "Blank command", desc: "Start with an empty flow", cmd: { name: "", description: "", actions: [] } },
  {
    id: "ping", icon: "🏓", name: "Ping", desc: "Simple reply", cmd: { name: "ping", description: "Check if the bot is alive", actions: [{ type: "reply", content: "🏓 Pong, {user}!" }] },
  },
  {
    id: "coinflip", icon: "🪙", name: "Coin flip", desc: "Random choice + embed",
    cmd: {
      name: "coinflip", description: "Flip a coin", actions: [
        { type: "random_choice", choices: "Heads\nTails", saveTo: "side" },
        { type: "create_embed", content: "", embed: { title: "🪙 Coin flip", description: "{user} flipped **{side}**!", color: "#faa61a", fields: [] } },
      ],
    },
  },
  {
    id: "poll", icon: "📊", name: "Yes/No poll", desc: "Buttons + branching",
    cmd: {
      name: "poll", description: "Ask a yes/no question", arguments: [{ name: "question", type: "string", description: "What to ask", required: true }], actions: [
        { type: "send_buttons", content: "📊 **{question}**", saveTo: "vote", timeout: 60, onlyAuthor: false, buttons: [{ label: "Yes", id: "yes", style: "3", emoji: "👍", url: "" }, { label: "No", id: "no", style: "4", emoji: "👎", url: "" }] },
        { type: "if_condition", left: "{vote}", operator: "==", right: "timeout", condition: "", then: [{ type: "reply", content: "⌛ Nobody voted in time." }], else: [{ type: "reply", content: "{user} voted **{vote}**!" }] },
      ],
    },
  },
  {
    id: "feedback", icon: "📝", name: "Modal form", desc: "Pop-up form with inputs",
    cmd: {
      name: "apply", description: "Fill in an application form", actions: [
        { type: "show_modal", title: "Staff application", saveTo: "form", timeout: 300, inputs: [
          { id: "age", label: "How old are you?", style: "short", placeholder: "18", required: true, minLength: "", maxLength: "3", value: "" },
          { id: "why", label: "Why do you want to join?", style: "paragraph", placeholder: "Tell us about yourself", required: true, minLength: "20", maxLength: "1000", value: "" },
        ] },
        { type: "create_embed", content: "", ephemeral: true, embed: { title: "✅ Application received", description: "Thanks {user}! We'll review it soon.", color: "#3ba55c", fields: [{ name: "Age", value: "{form.age}", inline: true }, { name: "Motivation", value: "{form.why}", inline: false }] } },
      ],
    },
  },
  {
    id: "roles", icon: "🎭", name: "Role picker", desc: "Select menu → add role",
    cmd: {
      name: "roles", description: "Pick a role", actions: [
        { type: "send_select_menu", content: "Choose your role:", placeholder: "Select a role...", minValues: 1, maxValues: 1, timeout: 60, saveTo: "picked", options: [{ label: "Gamer", value: "ROLE_ID_1", description: "Get pinged for game nights", emoji: "🎮" }, { label: "Artist", value: "ROLE_ID_2", description: "Share your art", emoji: "🎨" }] },
        { type: "add_role", roleId: "{picked}", target: "" },
        { type: "reply", content: "Done! You now have <@&{picked}>.", ephemeral: true },
      ],
    },
  },
  {
    id: "kick", icon: "👢", name: "Moderation: kick", desc: "Permission check + kick + log",
    cmd: {
      name: "kick", description: "Kick a member", permissions: ["KickMembers"], arguments: [{ name: "member", type: "user", description: "Who to kick", required: true }, { name: "reason", type: "string", description: "Why", required: false }], actions: [
        { type: "kick_member", target: "{member}", reason: "{reason}" },
        { type: "create_embed", content: "", embed: { title: "👢 Member kicked", description: "{member} was kicked by {user}.", color: "#ed4245", fields: [{ name: "Reason", value: "{reason}", inline: false }], timestamp: true } },
      ],
    },
  },
  {
    id: "8ball", icon: "🎱", name: "Magic 8-ball", desc: "Random answer",
    cmd: {
      name: "8ball", description: "Ask the magic 8-ball", arguments: [{ name: "question", type: "string", description: "Your question", required: true }], actions: [
        { type: "random_choice", choices: "Yes!\nNo.\nMaybe...\nAsk again later\nDefinitely\nI doubt it", saveTo: "answer" },
        { type: "create_embed", content: "", embed: { title: "🎱 Magic 8-Ball", description: "**Q:** {question}\n**A:** {answer}", color: "#2b2d31", fields: [] } },
      ],
    },
  },
];

const ARG_TYPES = [
  { value: "string", label: "Text" }, { value: "integer", label: "Whole number" }, { value: "number", label: "Decimal number" },
  { value: "boolean", label: "True / False" }, { value: "user", label: "User / member" }, { value: "channel", label: "Channel" },
  { value: "role", label: "Role" }, { value: "attachment", label: "File attachment" },
];

function countBlocks(actions) {
  let n = 0;
  (actions || []).forEach((a) => {
    n++;
    ["then", "else", "body"].forEach((k) => { n += countBlocks(a[k]); });
  });
  return n;
}

function renderCommands(el) {
  if (!AppState.currentProject) return noProjectState(el, "the command builder");
  const p = AppState.currentProject;
  const commands = p.commands || [];
  const q = (el.dataset.filter || "").toLowerCase();
  const filtered = commands.map((c, i) => ({ c, i })).filter(({ c }) => !q || c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q));

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Commands</h1>
        <p class="page-subtitle">Build slash & prefix commands visually with blocks, buttons, menus and modals.</p>
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-primary" data-act="add">${icon("plus", 16)} New command</button>
      </div>
    </div>
    ${commands.length ? `
    <div class="toolbar-row">
      <div class="search-box">${icon("search", 14)}<input class="input" placeholder="Search commands..." data-el="search" value="${escapeHtml(el.dataset.filter || "")}" /></div>
      <span class="text-muted text-sm">${commands.length} command${commands.length === 1 ? "" : "s"}</span>
    </div>` : ""}
    <div class="cmd-grid">
      ${commands.length === 0 ? `
        <div class="empty-state empty-state-lg" style="grid-column:1/-1">
          <div class="empty-state-emoji">⚡</div>
          <div class="empty-state-title">No commands yet</div>
          <div class="empty-state-text">Create your first command from a template - no coding needed.</div>
          <button class="btn btn-primary mt-md" data-act="add">${icon("plus", 16)} New command</button>
        </div>` :
      filtered.map(({ c, i }) => {
        const prefixChar = c.type === "prefix" ? p.prefix : "/";
        const blocks = countBlocks(c.actions);
        return `
        <div class="cmd-card${c.enabled === false ? " disabled" : ""}" data-index="${i}">
          <div class="cmd-card-top">
            <div class="cmd-card-name"><span class="cmd-prefix">${escapeHtml(c.type === "both" ? "/" : prefixChar)}</span>${escapeHtml(c.name)}</div>
            <div class="toggle toggle-sm ${c.enabled === false ? "" : "active"}" data-toggle="${i}" title="Enable / disable"></div>
          </div>
          <div class="cmd-card-desc">${escapeHtml(c.description || "No description")}</div>
          <div class="cmd-card-meta">
            <span class="tag ${c.type === "prefix" ? "tag-prefix" : "tag-slash"}">${c.type === "both" ? "slash + prefix" : escapeHtml(c.type)}</span>
            <span class="meta-item">🧩 ${blocks} block${blocks === 1 ? "" : "s"}</span>
            ${(c.arguments || []).length ? `<span class="meta-item">⌨️ ${(c.arguments || []).length} arg${(c.arguments || []).length === 1 ? "" : "s"}</span>` : ""}
            ${c.cooldown ? `<span class="meta-item">⏱️ ${c.cooldown}s</span>` : ""}
            ${(c.permissions || []).length ? `<span class="meta-item">🔒</span>` : ""}
          </div>
          <div class="cmd-card-actions">
            <button class="btn btn-secondary btn-sm" data-edit="${i}">${icon("edit", 14)} Edit flow</button>
            <button class="icon-btn" data-dup="${i}" title="Duplicate">${icon("copy", 15)}</button>
            <button class="icon-btn danger" data-del="${i}" title="Delete">${icon("trash", 15)}</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;

  el.querySelectorAll('[data-act="add"]').forEach((b) => { b.onclick = () => showCommandTemplates(); });
  const search = el.querySelector('[data-el="search"]');
  if (search) {
    search.oninput = debounce(() => {
      el.dataset.filter = search.value;
      renderCommands(el);
      const s = el.querySelector('[data-el="search"]');
      s.focus();
      s.selectionStart = s.selectionEnd = s.value.length;
    }, 150);
  }
  el.querySelectorAll("[data-edit]").forEach((b) => { b.onclick = () => showCommandEditor(Number(b.dataset.edit)); });
  el.querySelectorAll(".cmd-card").forEach((card) => {
    card.ondblclick = (e) => { if (!e.target.closest("button, .toggle")) showCommandEditor(Number(card.dataset.index)); };
  });
  el.querySelectorAll("[data-toggle]").forEach((t) => {
    t.onclick = async () => {
      const c = p.commands[Number(t.dataset.toggle)];
      c.enabled = c.enabled === false;
      await saveProject();
      renderCommands(el);
    };
  });
  el.querySelectorAll("[data-dup]").forEach((b) => {
    b.onclick = async () => {
      const src = p.commands[Number(b.dataset.dup)];
      const copy = clone(src);
      copy.id = uid();
      let n = 2;
      while (p.commands.some((c) => c.name === `${src.name}-${n}`)) n++;
      copy.name = `${src.name}-${n}`.slice(0, 32);
      p.commands.splice(Number(b.dataset.dup) + 1, 0, copy);
      await saveProject();
      renderCommands(el);
      showToast(`Duplicated as ${copy.name}`, "success");
    };
  });
  el.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      const c = p.commands[Number(b.dataset.del)];
      if (!(await confirmDialog({ title: `Delete "${c.name}"?`, message: "This cannot be undone.", confirmText: "Delete", danger: true }))) return;
      p.commands.splice(Number(b.dataset.del), 1);
      await saveProject();
      renderCommands(el);
      showToast("Command deleted", "success");
    };
  });
}

function showCommandTemplates() {
  showModal(`
    <div class="modal-head"><h2 class="modal-title">New command</h2></div>
    <p class="dialog-text">Pick a starting point - you can change everything afterwards.</p>
    <div class="template-grid">
      ${COMMAND_TEMPLATES.map((t) => `
        <button class="template-card" data-tpl="${t.id}">
          <span class="template-icon">${t.icon}</span>
          <span class="template-name">${escapeHtml(t.name)}</span>
          <span class="template-desc">${escapeHtml(t.desc)}</span>
        </button>`).join("")}
    </div>`, (c, close) => {
    c.querySelectorAll("[data-tpl]").forEach((b) => {
      b.onclick = () => {
        const tpl = COMMAND_TEMPLATES.find((t) => t.id === b.dataset.tpl);
        close();
        const cmd = { type: AppState.currentProject.engine === "lua" ? "prefix" : "slash", cooldown: 0, permissions: [], arguments: [], ...clone(tpl.cmd) };
        let name = cmd.name;
        let n = 2;
        while (name && AppState.currentProject.commands.some((x) => x.name === name)) name = `${cmd.name}-${n++}`;
        cmd.name = name;
        showCommandEditor(undefined, cmd);
      };
    });
  }, { size: "lg" });
}

/**
 * Generic full-screen flow editor used by commands and events.
 * opts: { title, icon, tabs: [{id,label,render(el)}], trigger, actions, graph, variables(), onSave(actions, graph) → bool|Promise<bool>, triggerKind }
 */
function openFlowEditor(opts) {
  let editor = null;
  let dirty = false;
  const markDirty = () => {
    dirty = true;
    const b = document.querySelector(".flow-editor [data-el='dirty']");
    if (b) b.style.display = "";
  };
  const modal = showModal(`
    <div class="flow-editor">
      <div class="flow-head">
        <button class="icon-btn" data-act="close" title="Close (Esc)">${icon("x", 18)}</button>
        <div class="flow-title"><span class="flow-title-icon">${escapeHtml(opts.icon || "⚡")}</span><span data-el="title">${escapeHtml(opts.title)}</span><span class="flow-dirty" data-el="dirty" style="display:none" title="Unsaved changes">●</span></div>
        <div class="tabs" data-el="tabs">
          <button class="tab active" data-tab="logic">${icon("bolt", 14)} Logic</button>
          ${(opts.tabs || []).map((t) => `<button class="tab" data-tab="${t.id}">${escapeHtml(t.label)}</button>`).join("")}
        </div>
        <div class="flex-1"></div>
        <button class="btn btn-secondary" data-act="cancel">Cancel</button>
        <button class="btn btn-primary" data-act="save">${icon("save", 15)} Save</button>
      </div>
      <div class="flow-body">
        <div class="flow-pane active" data-pane="logic"></div>
        ${(opts.tabs || []).map((t) => `<div class="flow-pane flow-pane-scroll" data-pane="${t.id}"></div>`).join("")}
      </div>
    </div>`, (c) => {
    editor = BVSEditor.mount(c.querySelector('[data-pane="logic"]'), {
      graph: opts.graph, actions: opts.actions, trigger: opts.trigger, engine: AppState.currentProject.engine,
      project: AppState.currentProject, pluginBlocks: AppState.pluginBlocks || [], variables: opts.variables ? opts.variables() : [],
      commandName: opts.commandName, triggerKind: opts.triggerKind, onChange: markDirty,
    });
    (opts.tabs || []).forEach((t) => t.render(c.querySelector(`[data-pane="${t.id}"]`), { markDirty, editor }));
    c.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.onclick = () => {
        c.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("active", x === tab));
        c.querySelectorAll("[data-pane]").forEach((p) => p.classList.toggle("active", p.dataset.pane === tab.dataset.tab));
        if (tab.dataset.tab === "logic" && opts.variables) editor.setVariables(opts.variables());
      };
    });
    const tryClose = async () => {
      if (dirty && !(await confirmDialog({ title: "Discard changes?", message: "You have unsaved changes in this flow.", confirmText: "Discard", danger: true }))) return;
      dirty = false;
      modal.close();
    };
    c.querySelector('[data-act="close"]').onclick = tryClose;
    c.querySelector('[data-act="cancel"]').onclick = tryClose;
    c.querySelector('[data-act="save"]').onclick = async () => {
      const ok = await opts.onSave(editor.compile(), editor.getGraph(), editor.issues());
      if (ok) {
        dirty = false;
        modal.close();
      }
    };
    c.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        c.querySelector('[data-act="save"]').click();
      }
    });
  }, {
    size: "full",
    beforeClose: () => {
      if (!dirty) return true;
      confirmDialog({ title: "Discard changes?", message: "You have unsaved changes in this flow.", confirmText: "Discard", danger: true }).then((yes) => {
        if (yes) { dirty = false; modal.close(); }
      });
      return false;
    },
    onClose: () => editor && editor.destroy(),
  });
  return { setTitle: (t) => { const el = modal.container.querySelector('[data-el="title"]'); if (el) el.textContent = t; }, editor: () => editor };
}

function showCommandEditor(editIndex, preset) {
  const project = AppState.currentProject;
  const isEdit = editIndex !== undefined;
  const cmd = isEdit ? clone(project.commands[editIndex]) : clone(preset || { type: "slash", name: "", description: "", cooldown: 0, permissions: [], arguments: [], actions: [] });
  cmd.arguments = cmd.arguments || [];
  cmd.permissions = cmd.permissions || [];
  if (project.engine === "lua") cmd.type = "prefix";

  const triggerFor = () => ({
    label: cmd.type === "prefix" ? `${project.prefix}${cmd.name || "command"}` : `/${cmd.name || "command"}`,
    sub: cmd.type === "both" ? "Slash + prefix command" : cmd.type === "prefix" ? "Prefix command" : "Slash command",
    icon: cmd.type === "prefix" ? "⌨️" : "⚡",
  });

  let flow = null;
  const settingsTab = {
    id: "settings",
    label: "⚙ Settings & arguments",
    render(el, { markDirty }) {
      const draw = () => {
        el.innerHTML = `
          <div class="settings-layout">
            <div class="settings-main">
              <div class="card">
                <div class="card-title mb-md">Command</div>
                <div class="grid-2">
                  <div class="input-group"><label class="input-label">Name</label>
                    <div class="input-prefixed"><span>${cmd.type === "prefix" ? escapeHtml(project.prefix) : "/"}</span><input class="input" data-k="name" value="${escapeHtml(cmd.name)}" placeholder="my-command" maxlength="32" /></div>
                    <div class="input-help">Lowercase letters, numbers, - and _ (max 32)</div>
                  </div>
                  <div class="input-group"><label class="input-label">Type</label>
                    <div class="segmented" data-el="type">
                      ${project.engine === "lua" ? '<button class="active" data-v="prefix">Prefix</button>' : ["slash", "prefix", "both"].map((t) => `<button class="${cmd.type === t ? "active" : ""}" data-v="${t}">${t === "both" ? "Both" : t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
                    </div>
                  </div>
                </div>
                <div class="input-group"><label class="input-label">Description <span class="char-count">${(cmd.description || "").length}/100</span></label>
                  <input class="input" data-k="description" value="${escapeHtml(cmd.description || "")}" maxlength="100" placeholder="What does this command do?" /></div>
                ${cmd.type !== "slash" ? `<div class="input-group"><label class="input-label">Aliases (prefix, comma separated)</label><input class="input" data-k="aliases" value="${escapeHtml((cmd.aliases || []).join(", "))}" placeholder="p, pong" /></div>` : ""}
              </div>

              <div class="card">
                <div class="card-header"><div class="card-title">Arguments / options</div><button class="btn btn-ghost btn-sm" data-act="add-arg">+ Add argument</button></div>
                <p class="text-sm text-muted mb-md">Arguments become variables: an argument named <code>target</code> can be used as <code>{target}</code> in any block.</p>
                <div class="arg-list" data-el="args">
                  ${cmd.arguments.length ? cmd.arguments.map((a, i) => `
                    <div class="arg-row" data-i="${i}">
                      <input class="input input-sm input-code" data-a="name" value="${escapeHtml(a.name)}" placeholder="name" />
                      <select class="input input-sm" data-a="type">${ARG_TYPES.map((t) => `<option value="${t.value}" ${a.type === t.value ? "selected" : ""}>${t.label}</option>`).join("")}</select>
                      <input class="input input-sm" data-a="description" value="${escapeHtml(a.description || "")}" placeholder="Description" maxlength="100" />
                      <label class="toggle-row toggle-row-sm" title="Required"><div class="toggle toggle-sm ${a.required ? "active" : ""}" data-a="required"></div><span>Required</span></label>
                      <button class="icon-btn danger" data-a="remove" title="Remove">${icon("trash", 14)}</button>
                    </div>`).join("") : '<div class="text-muted text-sm">No arguments.</div>'}
                </div>
              </div>

              <div class="card">
                <div class="card-title mb-md">Restrictions</div>
                <div class="grid-2">
                  <div class="input-group"><label class="input-label">Cooldown per user (seconds)</label><input class="input" type="number" min="0" data-k="cooldown" value="${Number(cmd.cooldown) || 0}" /></div>
                  <div class="input-group"><label class="input-label">Where</label>
                    <label class="toggle-row"><div class="toggle toggle-sm ${cmd.guildOnly === false ? "active" : ""}" data-el="dms"></div><span>Also allow in DMs</span></label></div>
                </div>
                <div class="input-group"><label class="input-label">Required permissions</label>
                  <div class="chip-select" data-el="perms">
                    ${BotifyBlocks.PERMISSIONS.map((perm) => `<button class="chip-toggle ${cmd.permissions.includes(perm.value) ? "active" : ""}" data-perm="${perm.value}">${escapeHtml(perm.label)}</button>`).join("")}
                  </div>
                </div>
              </div>
            </div>
            <div class="settings-side">
              <div class="preview-label">${icon("eye", 14)} How it appears in Discord</div>
              <div class="discord-surface">
                ${cmd.type === "prefix" ? `<div class="dc-typing-bar"><span>${escapeHtml(project.prefix)}${escapeHtml(cmd.name || "command")} ${cmd.arguments.map((a) => `<span class="dc-arg-chip">${escapeHtml(a.name)}</span>`).join(" ")}</span></div>` : `
                <div class="dc-slash-popup">
                  <div class="dc-slash-head">COMMANDS MATCHING /${escapeHtml(cmd.name || "")}</div>
                  <div class="dc-slash-item"><img class="dc-slash-avatar" src="${DiscordPreview.avatarSvg("B", "#3ba55c")}" alt=""/><div><div class="dc-slash-name">/${escapeHtml(cmd.name || "command")} ${cmd.arguments.map((a) => `<span class="dc-arg-chip${a.required ? "" : " optional"}">${escapeHtml(a.name)}</span>`).join(" ")}</div><div class="dc-slash-desc">${escapeHtml(cmd.description || "No description")}</div></div><span class="dc-slash-app">${escapeHtml(project.name)}</span></div>
                </div>`}
              </div>
            </div>
          </div>`;

        el.querySelectorAll("[data-k]").forEach((inp) => {
          inp.oninput = () => {
            const k = inp.dataset.k;
            if (k === "name") {
              const clean = inp.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
              if (clean !== inp.value) inp.value = clean;
              cmd.name = clean;
              flow.setTitle(triggerFor().label);
              flow.editor().setTrigger(triggerFor());
            } else if (k === "cooldown") cmd.cooldown = Math.max(0, Number(inp.value) || 0);
            else if (k === "aliases") cmd.aliases = inp.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
            else cmd[k] = inp.value;
            if (k === "description") inp.closest(".input-group").querySelector(".char-count").textContent = `${inp.value.length}/100`;
            markDirty();
          };
          inp.onchange = () => { if (inp.dataset.k === "name" || inp.dataset.k === "description") draw(); };
        });
        el.querySelectorAll('[data-el="type"] button').forEach((b) => {
          b.onclick = () => { cmd.type = b.dataset.v; flow.editor().setTrigger(triggerFor()); flow.setTitle(triggerFor().label); markDirty(); draw(); };
        });
        el.querySelector('[data-act="add-arg"]').onclick = () => {
          if (cmd.arguments.length >= 25) return showToast("Discord allows at most 25 options", "warning");
          let n = cmd.arguments.length + 1;
          while (cmd.arguments.some((a) => a.name === `arg${n}`)) n++;
          cmd.arguments.push({ name: `arg${n}`, type: "string", description: "", required: false });
          markDirty();
          draw();
        };
        el.querySelectorAll(".arg-row").forEach((row) => {
          const a = cmd.arguments[Number(row.dataset.i)];
          row.querySelector('[data-a="name"]').oninput = (e) => {
            const clean = e.target.value.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 32);
            if (clean !== e.target.value) e.target.value = clean;
            a.name = clean;
            markDirty();
          };
          row.querySelector('[data-a="name"]').onchange = draw;
          row.querySelector('[data-a="type"]').onchange = (e) => { a.type = e.target.value; markDirty(); };
          row.querySelector('[data-a="description"]').oninput = (e) => { a.description = e.target.value; markDirty(); };
          row.querySelector('[data-a="required"]').onclick = (e) => { a.required = !a.required; e.currentTarget.classList.toggle("active", a.required); markDirty(); draw(); };
          row.querySelector('[data-a="remove"]').onclick = () => { cmd.arguments.splice(Number(row.dataset.i), 1); markDirty(); draw(); };
        });
        el.querySelector('[data-el="dms"]').onclick = (e) => { cmd.guildOnly = cmd.guildOnly === false ? true : false; e.currentTarget.classList.toggle("active", cmd.guildOnly === false); markDirty(); };
        el.querySelectorAll("[data-perm]").forEach((b) => {
          b.onclick = () => {
            const v = b.dataset.perm;
            cmd.permissions = cmd.permissions.includes(v) ? cmd.permissions.filter((x) => x !== v) : [...cmd.permissions, v];
            b.classList.toggle("active");
            markDirty();
          };
        });
      };
      draw();
    },
  };

  flow = openFlowEditor({
    title: triggerFor().label,
    icon: triggerFor().icon,
    trigger: triggerFor(),
    actions: cmd.actions,
    graph: cmd.graph,
    commandName: cmd.name,
    triggerKind: "command",
    variables: () => cmd.arguments.map((a) => a.name).filter(Boolean),
    tabs: [settingsTab],
    onSave: async (actions, graph, issues) => {
      const name = (cmd.name || "").trim();
      if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
        showToast("Set a valid command name in the Settings tab", "warning");
        document.querySelector('.flow-editor [data-tab="settings"]').click();
        return false;
      }
      const clash = project.commands.findIndex((c, i) => i !== editIndex && c.name === name && (c.type === cmd.type || c.type === "both" || cmd.type === "both"));
      if (clash !== -1) {
        showToast(`A command named "${name}" already exists`, "error");
        return false;
      }
      const argNames = cmd.arguments.map((a) => a.name);
      if (argNames.some((n) => !n) || new Set(argNames).size !== argNames.length) {
        showToast("Every argument needs a unique name", "warning");
        document.querySelector('.flow-editor [data-tab="settings"]').click();
        return false;
      }
      const blocking = issues.filter((i) => /Not supported/.test(i.msg));
      if (blocking.length && !(await confirmDialog({ title: "Some blocks won't work", message: `${blocking.length} block(s) are not supported by the ${project.engine} engine and will be skipped. Save anyway?`, confirmText: "Save anyway" }))) return false;
      const data = { ...cmd, name, actions, graph };
      if (!data.id) data.id = uid();
      if (isEdit) project.commands[editIndex] = data;
      else project.commands.push(data);
      await saveProject();
      renderCommands(document.getElementById("page-commands"));
      showToast(`Saved ${data.type === "prefix" ? project.prefix : "/"}${name}`, "success");
      return true;
    },
  });
  if (!cmd.name) setTimeout(() => document.querySelector('.flow-editor [data-tab="settings"]')?.click(), 50);
}
