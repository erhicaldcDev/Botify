/* Help Menu designer: generates an interactive /help command (buttons, select menu or static embed). */
(function () {
  window.pages.help = {
    init() {
      const container = document.getElementById("page-help");
      if (!AppState.currentProject) return noProjectState(container, "the Help menu designer");
      const p = AppState.currentProject;
      if (!p.helpSettings) {
        p.helpSettings = {
          enabled: false, title: "Help Center", description: "Pick a category below to see its commands.", color: "#5865f2", style: "select", footer: "",
          categories: [{ name: "General", icon: "🌐", commands: (p.commands || []).slice(0, 5).map((c) => c.name) }],
        };
      }
      this.render(container);
    },

    render(container) {
      const p = AppState.currentProject;
      const help = p.helpSettings;
      const save = debounce(async () => {
        await saveProject();
        const s = container.querySelector('[data-el="saved"]');
        if (s) { s.textContent = "Saved"; s.classList.add("ok"); }
      }, 500);
      const changed = () => {
        const s = container.querySelector('[data-el="saved"]');
        if (s) { s.textContent = "Saving..."; s.classList.remove("ok"); }
        save();
        this.renderPreview(container);
      };

      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Help Menu</h1>
            <p class="page-subtitle">Generate an interactive <code>/help</code> command that lists your commands by category.</p>
          </div>
          <div class="flex items-center gap-md">
            <span class="save-state ok" data-el="saved">Saved</span>
            <label class="toggle-row"><div class="toggle ${help.enabled !== false ? "active" : ""}" data-el="enabled"></div><span><b>Generate /help</b></span></label>
          </div>
        </div>
        <div class="split-2">
          <div class="flex-col gap-md">
            <div class="card">
              <div class="card-title mb-md">Appearance</div>
              <div class="grid-2">
                <div class="input-group"><label class="input-label">Title</label><input class="input" data-k="title" /></div>
                <div class="input-group"><label class="input-label">Color</label>
                  <div class="color-field"><input type="color" class="color-swatch" data-k="color" /><input class="input" data-el="color-hex" /></div></div>
              </div>
              <div class="input-group"><label class="input-label">Description</label><textarea class="input" rows="3" data-k="description"></textarea></div>
              <div class="input-group"><label class="input-label">Footer</label><input class="input" data-k="footer" placeholder="Optional footer text" /></div>
              <div class="input-group"><label class="input-label">Menu style</label>
                <div class="segmented" data-el="style">
                  <button data-v="select">🔽 Select menu</button><button data-v="tabs">🔘 Buttons</button><button data-v="simple">📋 Single embed</button>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-header"><div class="card-title">Categories</div><button class="btn btn-ghost btn-sm" data-act="add-cat">+ Add category</button></div>
              <div data-el="cats"></div>
            </div>
          </div>
          <div class="sticky-col">
            <div class="preview-label">${icon("eye", 14)} Preview of /help</div>
            <div class="discord-surface" data-el="preview"></div>
            <p class="text-muted text-xs mt-sm">Clicking a category in Discord shows that category's commands. Menus stay active for 5 minutes.</p>
          </div>
        </div>`;

      container.querySelectorAll("[data-k]").forEach((inp) => {
        inp.value = help[inp.dataset.k] || (inp.dataset.k === "color" ? "#5865f2" : "");
        inp.oninput = () => {
          help[inp.dataset.k] = inp.value;
          if (inp.dataset.k === "color") container.querySelector('[data-el="color-hex"]').value = inp.value;
          changed();
        };
      });
      const hex = container.querySelector('[data-el="color-hex"]');
      hex.value = help.color || "#5865f2";
      hex.oninput = () => {
        if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
          help.color = hex.value;
          container.querySelector('[data-k="color"]').value = hex.value;
          changed();
        }
      };
      container.querySelector('[data-el="enabled"]').onclick = (e) => {
        help.enabled = help.enabled === false;
        e.currentTarget.classList.toggle("active", help.enabled);
        changed();
        showToast(help.enabled ? "/help will be generated" : "/help disabled", "info");
      };
      container.querySelectorAll('[data-el="style"] button').forEach((b) => {
        b.classList.toggle("active", (help.style || "select") === b.dataset.v);
        b.onclick = () => {
          help.style = b.dataset.v;
          container.querySelectorAll('[data-el="style"] button').forEach((x) => x.classList.toggle("active", x === b));
          changed();
        };
      });
      container.querySelector('[data-act="add-cat"]').onclick = () => {
        help.categories.push({ name: "New category", icon: "📁", commands: [] });
        this.renderCategories(container, changed);
        changed();
      };
      this.renderCategories(container, changed);
      this.renderPreview(container);
    },

    renderCategories(container, changed) {
      const p = AppState.currentProject;
      const help = p.helpSettings;
      const list = container.querySelector('[data-el="cats"]');
      const allNames = (p.commands || []).map((c) => c.name);
      list.innerHTML = help.categories.length ? help.categories.map((c, i) => `
        <div class="help-cat" data-i="${i}">
          <div class="help-cat-head">
            <input class="input input-emoji" data-f="icon" value="${escapeHtml(c.icon || "")}" maxlength="4" title="Emoji" />
            <input class="input" data-f="name" value="${escapeHtml(c.name || "")}" placeholder="Category name" />
            <button class="icon-btn" data-f="up" ${i === 0 ? "disabled" : ""} title="Move up">${icon("arrowUp", 14)}</button>
            <button class="icon-btn" data-f="down" ${i === help.categories.length - 1 ? "disabled" : ""} title="Move down">${icon("arrowDown", 14)}</button>
            <button class="icon-btn danger" data-f="del" title="Remove">${icon("trash", 14)}</button>
          </div>
          <div class="chip-select">
            ${allNames.length ? allNames.map((n) => `<button class="chip-toggle ${(c.commands || []).includes(n) ? "active" : ""}" data-cmd="${escapeHtml(n)}">/${escapeHtml(n)}</button>`).join("") : '<span class="text-muted text-sm">Create commands first - they will appear here.</span>'}
            ${(c.commands || []).filter((n) => !allNames.includes(n)).map((n) => `<button class="chip-toggle active missing" data-cmd="${escapeHtml(n)}" title="Command no longer exists">/${escapeHtml(n)} ✕</button>`).join("")}
          </div>
        </div>`).join("") : '<p class="text-muted text-sm">No categories. Add one to group your commands.</p>';

      list.querySelectorAll(".help-cat").forEach((row) => {
        const i = Number(row.dataset.i);
        const cat = help.categories[i];
        row.querySelector('[data-f="icon"]').oninput = (e) => { cat.icon = e.target.value; changed(); };
        row.querySelector('[data-f="name"]').oninput = (e) => { cat.name = e.target.value; changed(); };
        row.querySelector('[data-f="del"]').onclick = () => { help.categories.splice(i, 1); this.renderCategories(container, changed); changed(); };
        row.querySelector('[data-f="up"]').onclick = () => { help.categories.splice(i - 1, 0, help.categories.splice(i, 1)[0]); this.renderCategories(container, changed); changed(); };
        row.querySelector('[data-f="down"]').onclick = () => { help.categories.splice(i + 1, 0, help.categories.splice(i, 1)[0]); this.renderCategories(container, changed); changed(); };
        row.querySelectorAll("[data-cmd]").forEach((b) => {
          b.onclick = () => {
            const n = b.dataset.cmd;
            cat.commands = (cat.commands || []).includes(n) ? cat.commands.filter((x) => x !== n) : [...(cat.commands || []), n];
            if (b.classList.contains("missing")) this.renderCategories(container, changed);
            else b.classList.toggle("active");
            changed();
          };
        });
      });
    },

    renderPreview(container) {
      const p = AppState.currentProject;
      const help = p.helpSettings;
      const cats = (help.categories || []).filter((c) => c.name);
      const desc = (n) => ((p.commands || []).find((c) => c.name === n) || {}).description || "";
      const simple = help.style === "simple" || !cats.length;
      const embed = {
        title: help.title, description: help.description, color: help.color, footer: help.footer, timestamp: true,
        fields: simple
          ? cats.map((c) => ({ name: `${c.icon || ""} ${c.name}`.trim(), value: (c.commands || []).map((n) => `\`/${n}\` ${desc(n)}`).join("\n") || "No commands", inline: false }))
          : cats.map((c) => ({ name: `${c.icon || ""} ${c.name}`.trim(), value: `${(c.commands || []).length} commands`, inline: true })),
      };
      const msg = { command: "/help", embeds: [embed] };
      if (!simple && help.style === "select") msg.select = { placeholder: "Select a category...", options: cats.map((c) => ({ label: c.name, emoji: c.icon })), expanded: false };
      if (!simple && help.style !== "select") msg.buttons = cats.map((c) => ({ label: c.name, emoji: c.icon, style: "2" }));
      container.querySelector('[data-el="preview"]').innerHTML = (help.enabled === false ? '<div class="preview-disabled">/help is disabled - toggle "Generate /help" to include it.</div>' : "") + DiscordPreview.message(msg);
    },
  };
})();
