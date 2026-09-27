/* Embed Styler: saved embeds list + live designer workspace. */

const EMBED_TEMPLATES = [
  { name: "Blank", icon: "📄", data: { title: "New embed", description: "", color: "#5865f2", fields: [] } },
  { name: "Welcome", icon: "👋", data: { title: "Welcome to {server}!", description: "Hey {user}, we're happy to have you here! 🎉\n\n> Read the rules and grab some roles.", color: "#5865f2", thumbnail: "{user.avatar}", footer: "Member #{server.members}", timestamp: true, fields: [] } },
  { name: "Rules", icon: "📜", data: { title: "📜 Server rules", description: "Please follow these rules to keep the community friendly.", color: "#ed4245", fields: [
    { name: "1. Be respectful", value: "No harassment, hate speech or discrimination.", inline: false },
    { name: "2. No spam", value: "Don't flood channels or mass-mention.", inline: false },
    { name: "3. Stay on topic", value: "Use the right channel for your message.", inline: false },
  ], footer: "Breaking the rules may result in a ban." } },
  { name: "Announcement", icon: "📢", data: { authorName: "{server}", authorIcon: "{server.icon}", title: "📢 Big news!", description: "Write your announcement here. Supports **bold**, *italic* and [links](https://discord.com).", color: "#faa61a", image: "", footer: "Posted by {user.name}", timestamp: true, fields: [] } },
  { name: "Stats card", icon: "📊", data: { title: "📊 Stats for {user.name}", color: "#3ba55c", thumbnail: "{user.avatar}", fields: [
    { name: "Level", value: "{level}", inline: true }, { name: "XP", value: "{xp}", inline: true }, { name: "Rank", value: "#{rank}", inline: true },
  ], footer: "Keep chatting to level up!" } },
];

function embedUsage(project, id) {
  let n = 0;
  const walk = (actions) => (actions || []).forEach((a) => {
    if (a.embedRef === id) n++;
    ["then", "else", "body"].forEach((k) => walk(a[k]));
  });
  (project.commands || []).forEach((c) => walk(c.actions));
  (project.events || []).forEach((e) => walk(e.actions));
  return n;
}

function renderEmbeds(el) {
  if (!AppState.currentProject) return noProjectState(el, "the Embed Styler");
  const p = AppState.currentProject;
  p.embeds = p.embeds || [];
  let selectedId = el.dataset.selected && p.embeds.some((e) => e.id === el.dataset.selected) ? el.dataset.selected : (p.embeds[0] && p.embeds[0].id);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Embed Styler</h1>
        <p class="page-subtitle">Design rich embeds with a live Discord preview, then send them from any command or event with the <b>Send Saved Embed</b> block.</p>
      </div>
      <button class="btn btn-primary" data-act="new">${icon("plus", 16)} New embed</button>
    </div>
    <div class="embed-workspace">
      <aside class="embed-list" data-el="list"></aside>
      <section class="embed-editor-pane" data-el="editor"></section>
    </div>`;

  const list = el.querySelector('[data-el="list"]');
  const editorPane = el.querySelector('[data-el="editor"]');
  const autosave = debounce(async () => {
    await saveProject();
    const s = el.querySelector('[data-el="saved"]');
    if (s) { s.textContent = "Saved"; s.classList.add("ok"); }
  }, 600);

  function drawList() {
    list.innerHTML = p.embeds.length ? p.embeds.map((e) => {
      const used = embedUsage(p, e.id);
      return `
      <div class="embed-list-item${e.id === selectedId ? " active" : ""}" data-id="${e.id}" style="--embed-color:${/^#[0-9a-f]{6}$/i.test(e.color || "") ? e.color : "#1e1f22"}">
        <div class="embed-list-name">${escapeHtml(e.name || e.title || "Untitled")}</div>
        <div class="embed-list-sub">${escapeHtml((e.title || e.description || "Empty embed").slice(0, 60))}</div>
        <div class="embed-list-meta">${used ? `<span class="tag tag-slash">used in ${used} block${used === 1 ? "" : "s"}</span>` : '<span class="text-muted text-xs">not used yet</span>'}</div>
      </div>`;
    }).join("") : '<div class="empty-state"><div class="empty-state-emoji">🎨</div><div class="empty-state-title">No embeds</div><div class="empty-state-text">Create one from a template.</div></div>';
    list.querySelectorAll("[data-id]").forEach((item) => {
      item.onclick = () => { selectedId = item.dataset.id; el.dataset.selected = selectedId; drawList(); drawEditor(); };
    });
  }

  function drawEditor() {
    const emb = p.embeds.find((e) => e.id === selectedId);
    if (!emb) {
      editorPane.innerHTML = '<div class="empty-state empty-state-lg"><div class="empty-state-emoji">👈</div><div class="empty-state-title">Select or create an embed</div></div>';
      return;
    }
    editorPane.innerHTML = `
      <div class="embed-editor-head">
        <input class="input input-title" data-el="name" value="${escapeHtml(emb.name || "")}" placeholder="Embed name" />
        <span class="save-state" data-el="saved">Saved</span>
        <div class="flex-1"></div>
        <button class="btn btn-ghost btn-sm" data-act="dup">${icon("copy", 14)} Duplicate</button>
        <button class="btn btn-danger-ghost btn-sm" data-act="del">${icon("trash", 14)} Delete</button>
      </div>
      <div data-el="designer"></div>`;
    const markUnsaved = () => {
      const s = el.querySelector('[data-el="saved"]');
      s.textContent = "Saving...";
      s.classList.remove("ok");
    };
    editorPane.querySelector('[data-el="name"]').oninput = (e) => {
      emb.name = e.target.value;
      const item = list.querySelector(`[data-id="${emb.id}"] .embed-list-name`);
      if (item) item.textContent = emb.name || "Untitled";
      markUnsaved();
      autosave();
      updateSidebar();
    };
    editorPane.querySelector('[data-act="dup"]').onclick = async () => {
      const copy = { ...clone(emb), id: uid(), name: `${emb.name || "Embed"} (copy)` };
      p.embeds.splice(p.embeds.indexOf(emb) + 1, 0, copy);
      selectedId = copy.id;
      await saveProject();
      drawList();
      drawEditor();
    };
    editorPane.querySelector('[data-act="del"]').onclick = async () => {
      const used = embedUsage(p, emb.id);
      if (!(await confirmDialog({ title: `Delete "${emb.name}"?`, message: used ? `It is used by ${used} block(s) - they will send nothing until you pick another embed.` : "This cannot be undone.", confirmText: "Delete", danger: true }))) return;
      p.embeds = p.embeds.filter((e) => e.id !== emb.id);
      selectedId = p.embeds[0] && p.embeds[0].id;
      await saveProject();
      drawList();
      drawEditor();
      updateSidebar();
    };
    EmbedEditor.mount(editorPane.querySelector('[data-el="designer"]'), emb, {
      onChange: () => {
        markUnsaved();
        autosave();
        const item = list.querySelector(`[data-id="${emb.id}"]`);
        if (item) {
          item.style.setProperty("--embed-color", /^#[0-9a-f]{6}$/i.test(emb.color || "") ? emb.color : "#1e1f22");
          item.querySelector(".embed-list-sub").textContent = (emb.title || emb.description || "Empty embed").slice(0, 60);
        }
      },
    });
  }

  el.querySelector('[data-act="new"]').onclick = () => {
    showModal(`
      <div class="modal-head"><h2 class="modal-title">New embed</h2></div>
      <div class="template-grid">${EMBED_TEMPLATES.map((t, i) => `
        <button class="template-card template-card-embed" data-i="${i}">
          <div class="template-embed-preview">${DiscordPreview.embed(t.data)}</div>
          <span class="template-name">${t.icon} ${escapeHtml(t.name)}</span>
        </button>`).join("")}</div>`, (c, close) => {
      c.querySelectorAll("[data-i]").forEach((b) => {
        b.onclick = async () => {
          const t = EMBED_TEMPLATES[Number(b.dataset.i)];
          let name = t.name === "Blank" ? "New embed" : t.name;
          let n = 2;
          while (p.embeds.some((e) => e.name === name)) name = `${t.name === "Blank" ? "New embed" : t.name} ${n++}`;
          const emb = { ...EmbedEditor.blank(), ...clone(t.data), id: uid(), name };
          p.embeds.push(emb);
          selectedId = emb.id;
          el.dataset.selected = selectedId;
          await saveProject();
          close();
          drawList();
          drawEditor();
          updateSidebar();
        };
      });
    }, { size: "lg" });
  };

  drawList();
  drawEditor();
}
