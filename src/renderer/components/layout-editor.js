/* Components V2 layout designer: component tree editor + live Discord preview. */
(function () {
  const ADDABLE = ["text", "section", "container", "separator", "gallery", "buttons"];

  /**
   * Mount the designer, editing `layout` ({ components: [] }) in place.
   * opts: { onChange(layout), showName, name, onNameChange }
   */
  function mount(root, layout, opts = {}) {
    if (!Array.isArray(layout.components)) layout.components = [];
    const open = new WeakSet();
    const T = BotifyLayout.TYPES;

    root.innerHTML = `
      <div class="layout-designer">
        <div class="layout-tree-col">
          ${opts.showName ? `<div class="input-group"><label class="input-label">Layout name</label><input class="input" data-el="name" placeholder="e.g. Welcome card" /></div>` : ""}
          <div class="ld-info">
            <span class="badge badge-v2">Components V2</span>
            <span class="text-xs text-muted">Messages built from components instead of content + embeds. Containers work like embeds you can put anything in.</span>
          </div>
          <div class="ld-tree" data-el="tree"></div>
          <div class="ld-add-bar" data-el="add-root"></div>
        </div>
        <div class="layout-preview-col">
          <div class="preview-label">${icon("eye", 14)} Live preview ${window.previewThemeSwitch ? previewThemeSwitch() : ""}</div>
          <div class="discord-surface" data-el="preview"></div>
          <div class="ed-stats" data-el="stats"></div>
          <div class="ed-json-tools">
            <button type="button" class="btn btn-ghost btn-sm" data-act="templates">🧩 Templates</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="copy">${icon("copy", 14)} Copy JSON</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="import">${icon("upload", 14)} Import JSON</button>
          </div>
        </div>
      </div>`;

    const $ = (s) => root.querySelector(s);
    if (opts.showName) {
      $('[data-el="name"]').value = opts.name || "";
      $('[data-el="name"]').oninput = (e) => opts.onNameChange && opts.onNameChange(e.target.value);
    }

    const changed = () => {
      updatePreview();
      opts.onChange && opts.onChange(layout);
    };

    function updatePreview() {
      $('[data-el="preview"]').innerHTML = DiscordPreview.message({ layout });
      const count = BotifyLayout.countComponents(layout.components);
      const chars = BotifyLayout.textLength(layout.components);
      const problems = BotifyLayout.validate(layout);
      $('[data-el="stats"]').innerHTML = `
        <span class="${count > BotifyLayout.LIMITS.components ? "over" : ""}">${count}/${BotifyLayout.LIMITS.components} components</span> •
        <span class="${chars > BotifyLayout.LIMITS.text ? "over" : ""}">${chars}/${BotifyLayout.LIMITS.text} characters</span>
        ${problems.map((p) => `<div class="ed-warning">${icon("alert", 13)} ${escapeHtml(p)}</div>`).join("")}`;
    }

    function addBar(list, allowContainer) {
      const bar = document.createElement("div");
      bar.className = "ld-add-row";
      bar.innerHTML = `<span class="ld-add-label">Add</span>` + ADDABLE.filter((t) => allowContainer || t !== "container")
        .map((t) => `<button type="button" class="ld-add-btn" data-type="${t}">${T[t].icon} ${escapeHtml(T[t].label)}</button>`).join("");
      bar.querySelectorAll("[data-type]").forEach((b) => {
        b.onclick = () => {
          const node = T[b.dataset.type].create();
          list.push(node);
          open.add(node);
          drawTree();
          changed();
        };
      });
      return bar;
    }

    function nodeCard(node, list, idx, depth) {
      const def = T[node.type] || { label: node.type, icon: "❔", fields: [] };
      const card = document.createElement("div");
      card.className = `ld-node ld-node-${node.type}${open.has(node) ? " open" : ""}`;
      if (node.type === "container") card.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(node.accentColor || "") ? node.accentColor : "var(--border-strong)");
      const summary = String((def.summary && def.summary(node)) || "").replace(/\s+/g, " ").slice(0, 60);
      card.innerHTML = `
        <div class="ld-node-head">
          <span class="list-item-chevron">${icon("chevronDown", 14)}</span>
          <span class="ld-node-icon">${def.icon}</span>
          <span class="ld-node-label">${escapeHtml(def.label)}</span>
          <span class="ld-node-summary">${escapeHtml(summary)}</span>
          <div class="list-item-tools">
            <button type="button" class="icon-btn" data-t="up" title="Move up" ${idx === 0 ? "disabled" : ""}>${icon("arrowUp", 14)}</button>
            <button type="button" class="icon-btn" data-t="down" title="Move down" ${idx === list.length - 1 ? "disabled" : ""}>${icon("arrowDown", 14)}</button>
            <button type="button" class="icon-btn" data-t="dup" title="Duplicate">${icon("copy", 14)}</button>
            <button type="button" class="icon-btn danger" data-t="del" title="Remove">${icon("trash", 14)}</button>
          </div>
        </div>
        <div class="ld-node-body"><div class="ld-node-desc">${escapeHtml(def.description || "")}</div><div data-el="form"></div></div>`;

      card.querySelector(".ld-node-head").onclick = (e) => {
        if (e.target.closest("button")) return;
        if (open.has(node)) open.delete(node);
        else open.add(node);
        card.classList.toggle("open");
      };
      const tool = (t, fn) => { card.querySelector(`[data-t="${t}"]`).onclick = (e) => { e.stopPropagation(); fn(); drawTree(); changed(); }; };
      tool("up", () => list.splice(idx - 1, 0, list.splice(idx, 1)[0]));
      tool("down", () => list.splice(idx + 1, 0, list.splice(idx, 1)[0]));
      tool("dup", () => { const copy = clone(node); list.splice(idx + 1, 0, copy); open.add(copy); });
      tool("del", () => list.splice(idx, 1));

      const form = card.querySelector('[data-el="form"]');
      FieldForm.render(form, def.fields, node, {
        project: window.AppState && AppState.currentProject,
        variables: [],
        onChange: () => {
          const sum = card.querySelector(".ld-node-summary");
          sum.textContent = String((def.summary && def.summary(node)) || "").replace(/\s+/g, " ").slice(0, 60);
          if (node.type === "container") card.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(node.accentColor || "") ? node.accentColor : "var(--border-strong)");
          changed();
        },
      });

      if (node.type === "container") {
        if (!Array.isArray(node.children)) node.children = [];
        const kids = document.createElement("div");
        kids.className = "ld-children";
        node.children.forEach((child, i) => kids.appendChild(nodeCard(child, node.children, i, depth + 1)));
        if (!node.children.length) kids.innerHTML = '<div class="text-muted text-xs" style="padding:6px 2px">Empty container - add components below.</div>';
        kids.appendChild(addBar(node.children, false));
        card.querySelector(".ld-node-body").appendChild(kids);
      }
      return card;
    }

    function drawTree() {
      const tree = $('[data-el="tree"]');
      tree.innerHTML = "";
      if (!layout.components.length) tree.innerHTML = '<div class="empty-state"><div class="empty-state-title">Empty layout</div><div class="empty-state-text">Add components below or start from a template.</div></div>';
      layout.components.forEach((n, i) => tree.appendChild(nodeCard(n, layout.components, i, 0)));
      const addRoot = $('[data-el="add-root"]');
      addRoot.innerHTML = "";
      addRoot.appendChild(addBar(layout.components, true));
    }

    $('[data-act="templates"]').onclick = () => openTemplatePicker((tpl) => {
      layout.components = clone(tpl.components);
      drawTree();
      changed();
    });
    $('[data-act="copy"]').onclick = async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(layout.components, null, 2)); showToast("Layout JSON copied", "success"); } catch { showToast("Clipboard unavailable", "error"); }
    };
    $('[data-act="import"]').onclick = () => {
      showModal(`
        <h2 class="modal-title">Import layout JSON</h2>
        <p class="dialog-text">Paste JSON copied from another Botify layout.</p>
        <textarea class="input input-code" rows="10" data-el="json"></textarea>
        <div class="modal-actions"><button class="btn btn-secondary" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="ok">Import</button></div>`, (c, close) => {
        c.querySelector('[data-act="cancel"]').onclick = close;
        c.querySelector('[data-act="ok"]').onclick = () => {
          try {
            const data = JSON.parse(c.querySelector('[data-el="json"]').value);
            const comps = Array.isArray(data) ? data : data.components;
            if (!Array.isArray(comps) || comps.some((x) => !x || !T[x.type])) throw new Error("Not a Botify layout");
            layout.components = comps;
            close();
            drawTree();
            changed();
            showToast("Layout imported", "success");
          } catch (err) {
            showToast("Invalid JSON: " + err.message, "error");
          }
        };
      }, { size: "md" });
    };

    drawTree();
    updatePreview();
    return { refresh: () => { drawTree(); updatePreview(); } };
  }

  function openTemplatePicker(onPick) {
    showModal(`
      <div class="modal-head"><h2 class="modal-title">Layout templates</h2></div>
      <div class="template-grid">${BotifyLayout.TEMPLATES.map((t, i) => `
        <button class="template-card template-card-embed" data-i="${i}">
          <div class="template-embed-preview">${DiscordPreview.layout({ components: t.components })}</div>
          <span class="template-name">${t.icon} ${escapeHtml(t.name)}</span>
        </button>`).join("")}</div>`, (c, close) => {
      c.querySelectorAll("[data-i]").forEach((b) => {
        b.onclick = () => { close(); onPick(BotifyLayout.TEMPLATES[Number(b.dataset.i)]); };
      });
    }, { size: "lg" });
  }

  function openModal(layout, onSave, opts = {}) {
    const working = clone(layout && Array.isArray(layout.components) ? layout : { components: [] });
    showModal(`
      <div class="modal-head">
        <h2 class="modal-title">${escapeHtml(opts.title || "Layout Designer")}</h2>
        <div class="flex gap-sm">
          <button class="btn btn-secondary" data-act="cancel">Cancel</button>
          <button class="btn btn-primary" data-act="save">${icon("check", 16)} Apply</button>
        </div>
      </div>
      <div class="modal-scroll" data-el="designer"></div>`, (c, close) => {
      mount(c.querySelector('[data-el="designer"]'), working);
      c.querySelector('[data-act="cancel"]').onclick = close;
      c.querySelector('[data-act="save"]').onclick = () => { onSave(working); close(); };
    }, { size: "xl" });
  }

  window.LayoutEditor = { mount, openModal, openTemplatePicker };
})();
