/* Layouts: saved Components V2 messages + designer workspace. */

function layoutUsage(project, id) {
  let n = 0;
  const walk = (actions) => (actions || []).forEach((a) => {
    if (a.layoutRef === id) n++;
    ["then", "else", "body"].forEach((k) => walk(a[k]));
  });
  (project.commands || []).forEach((c) => walk(c.actions));
  (project.events || []).forEach((e) => walk(e.actions));
  return n;
}

function renderLayouts(el) {
  if (!AppState.currentProject) return noProjectState(el, "the Components V2 designer");
  const p = AppState.currentProject;
  p.layouts = p.layouts || [];
  let selectedId = el.dataset.selected && p.layouts.some((l) => l.id === el.dataset.selected) ? el.dataset.selected : (p.layouts[0] && p.layouts[0].id);

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Layouts <span class="badge badge-v2">Components V2</span></h1>
        <p class="page-subtitle">Build modern Discord messages from containers, sections, images, separators and buttons. Send them with the <b>Send Saved Layout</b> block.</p>
      </div>
      <button class="btn btn-primary" data-act="new">${icon("plus", 16)} New layout</button>
    </div>
    ${p.engine === "lua" ? `<div class="notice notice-warn">${icon("alert", 16)} Components V2 needs the Node.js or Python engine - layout blocks are skipped for Lua.</div>` : ""}
    <div class="embed-workspace">
      <aside class="embed-list" data-el="list"></aside>
      <section class="embed-editor-pane" data-el="editor"></section>
    </div>`;

  const list = el.querySelector('[data-el="list"]');
  const pane = el.querySelector('[data-el="editor"]');
  const autosave = debounce(async () => {
    await saveProject();
    const s = el.querySelector('[data-el="saved"]');
    if (s) { s.textContent = "Saved"; s.classList.add("ok"); }
  }, 600);
  const accentOf = (l) => {
    const c = (l.components || []).find((n) => n.type === "container" && /^#[0-9a-f]{6}$/i.test(n.accentColor || ""));
    return c ? c.accentColor : "#00a8fc";
  };
  const describe = (l) => `${BotifyLayout.countComponents(l.components)} components${BotifyLayout.validate(l).length ? " • ⚠ check" : ""}`;

  function drawList() {
    list.innerHTML = p.layouts.length ? p.layouts.map((l) => {
      const used = layoutUsage(p, l.id);
      return `
      <div class="embed-list-item${l.id === selectedId ? " active" : ""}" data-id="${l.id}" style="--embed-color:${accentOf(l)}">
        <div class="embed-list-name">${escapeHtml(l.name || "Untitled")}</div>
        <div class="embed-list-sub">${escapeHtml(describe(l))}</div>
        <div class="embed-list-meta">${used ? `<span class="tag tag-slash">used in ${used} block${used === 1 ? "" : "s"}</span>` : '<span class="text-muted text-xs">not used yet</span>'}</div>
      </div>`;
    }).join("") : '<div class="empty-state"><div class="empty-state-emoji">🧱</div><div class="empty-state-title">No layouts</div><div class="empty-state-text">Create one from a template.</div></div>';
    list.querySelectorAll("[data-id]").forEach((item) => {
      item.onclick = () => { selectedId = item.dataset.id; el.dataset.selected = selectedId; drawList(); drawEditor(); };
    });
  }

  function drawEditor() {
    const layout = p.layouts.find((l) => l.id === selectedId);
    if (!layout) {
      pane.innerHTML = '<div class="empty-state empty-state-lg"><div class="empty-state-emoji">👈</div><div class="empty-state-title">Select or create a layout</div></div>';
      return;
    }
    pane.innerHTML = `
      <div class="embed-editor-head">
        <input class="input input-title" data-el="name" value="${escapeHtml(layout.name || "")}" placeholder="Layout name" />
        <span class="save-state ok" data-el="saved">Saved</span>
        <div class="flex-1"></div>
        <button class="btn btn-ghost btn-sm" data-act="dup">${icon("copy", 14)} Duplicate</button>
        <button class="btn btn-danger-ghost btn-sm" data-act="del">${icon("trash", 14)} Delete</button>
      </div>
      <div data-el="designer"></div>`;
    const unsaved = () => {
      const s = el.querySelector('[data-el="saved"]');
      s.textContent = "Saving...";
      s.classList.remove("ok");
      autosave();
    };
    pane.querySelector('[data-el="name"]').oninput = (e) => {
      layout.name = e.target.value;
      const item = list.querySelector(`[data-id="${layout.id}"] .embed-list-name`);
      if (item) item.textContent = layout.name || "Untitled";
      unsaved();
    };
    pane.querySelector('[data-act="dup"]').onclick = async () => {
      const copy = { ...clone(layout), id: uid(), name: `${layout.name || "Layout"} (copy)` };
      p.layouts.splice(p.layouts.indexOf(layout) + 1, 0, copy);
      selectedId = copy.id;
      await saveProject();
      drawList();
      drawEditor();
    };
    pane.querySelector('[data-act="del"]').onclick = async () => {
      const used = layoutUsage(p, layout.id);
      if (!(await confirmDialog({ title: `Delete "${layout.name}"?`, message: used ? `It is used by ${used} block(s) - they will be skipped until you pick another layout.` : "This cannot be undone.", confirmText: "Delete", danger: true }))) return;
      p.layouts = p.layouts.filter((l) => l.id !== layout.id);
      selectedId = p.layouts[0] && p.layouts[0].id;
      await saveProject();
      drawList();
      drawEditor();
      updateSidebar();
    };
    LayoutEditor.mount(pane.querySelector('[data-el="designer"]'), layout, {
      onChange: () => {
        unsaved();
        const item = list.querySelector(`[data-id="${layout.id}"]`);
        if (item) {
          item.style.setProperty("--embed-color", accentOf(layout));
          item.querySelector(".embed-list-sub").textContent = describe(layout);
        }
      },
    });
  }

  el.querySelector('[data-act="new"]').onclick = () => LayoutEditor.openTemplatePicker(async (tpl) => {
    let name = tpl.name === "Blank" ? "New layout" : tpl.name;
    let n = 2;
    while (p.layouts.some((l) => l.name === name)) name = `${tpl.name === "Blank" ? "New layout" : tpl.name} ${n++}`;
    const layout = { id: uid(), name, components: clone(tpl.components) };
    p.layouts.push(layout);
    selectedId = layout.id;
    el.dataset.selected = selectedId;
    await saveProject();
    drawList();
    drawEditor();
    updateSidebar();
  });

  drawList();
  drawEditor();
}
