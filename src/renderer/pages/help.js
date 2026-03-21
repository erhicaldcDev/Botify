(function () {
  window.pages.help = {
    init: function () {
      const container = document.getElementById("page-help");
      if (!AppState.currentProject) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div><p>Open a project to design your Help UI</p></div>';
        return;
      }

      
      if (!AppState.currentProject.helpSettings) {
        AppState.currentProject.helpSettings = {
          title: "Bot Help Center",
          description: "Select a category below to see available commands.",
          color: "#7c6aef",
          style: "tabs",
          categories: [
            { name: "General", icon: "🌐", commands: ["ping", "help", "info"] },
            { name: "Moderation", icon: "🛡️", commands: ["kick", "ban", "clear"] }
          ]
        };
      }

      this.render(container);
    },

    render: function (container) {
      const help = AppState.currentProject.helpSettings;

      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Help UI Maker</h1>
            <p class="page-subtitle">Design interactive help menus with buttons and categories</p>
          </div>
          <button class="btn btn-primary" id="help-save-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Help Config
          </button>
        </div>

        <div class="grid grid-2">
          <div class="card p-lg">
            <div class="section-title">Global Config</div>
            <div class="grid grid-2 gap-md mt-md">
              <div class="input-group">
                <label class="input-label">Menu Title</label>
                <input class="input help-sync" data-key="title" value="${help.title}" />
              </div>
              <div class="input-group">
                <label class="input-label">Embed Color</label>
                <input type="color" class="input help-sync" data-key="color" value="${help.color}" style="height:42px; padding:4px"/>
              </div>
            </div>
            <div class="input-group mt-md">
              <label class="input-label">Description / Instructions</label>
              <textarea class="input help-sync" data-key="description" style="height:80px">${help.description}</textarea>
            </div>
            <div class="input-group mt-md">
               <label class="input-label">Menu Style</label>
               <select class="input help-sync" data-key="style">
                  <option value="tabs" ${help.style === 'tabs' ? 'selected' : ''}>Interactive Buttons (Tabs)</option>
                  <option value="select" ${help.style === 'select' ? 'selected' : ''}>Selection Menu (Dropdown)</option>
                  <option value="simple" ${help.style === 'simple' ? 'selected' : ''}>Static Embed (All-in-one)</option>
               </select>
            </div>

            <div class="section-title mt-xl flex justify-between items-center">
              <span>Categories</span>
              <button class="btn btn-ghost btn-sm" id="add-category-btn">+ Add Category</button>
            </div>
            <div id="help-categories-list" class="mt-md"></div>
          </div>

          <div class="help-preview-container" style="position: sticky; top: 20px;">
            <div class="section-title mb-md" style="text-align:center; opacity:0.6; font-size:12px; letter-spacing:1px">DISCORD PREVIEW</div>
            <div class="discord-embed" style="border-left: 4px solid ${help.color}; background: #2f3136; padding: 16px; border-radius: 4px; color: #dcddde;">
              <div class="embed-header" style="margin-bottom: 8px;">
                <div class="embed-title" id="preview-title" style="color: #fff; font-weight: 600; font-size: 16px;">${help.title}</div>
              </div>
              <div class="embed-description" id="preview-description" style="font-size: 14px; margin-bottom: 12px; line-height: 1.4;">${help.description}</div>
              
              <div id="preview-categories" class="mt-md" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;"></div>

              <div class="embed-footer mt-md" style="font-size: 12px; margin-top: 16px; display: flex; align-items: center; opacity: 0.6;">
                <div style="width: 20px; height: 20px; border-radius: 50%; background: #5865f2; margin-right: 8px;"></div>
                <span>Botify Help System • Today at 12:00</span>
              </div>
            </div>
            
            <div class="mt-md" id="preview-components">
            </div>
          </div>
        </div>
      `;

      this.setupHandlers(container);
      this.renderCategories();
      this.renderPreview();
    },

    setupHandlers: function (container) {
      const help = AppState.currentProject.helpSettings;

      container.querySelectorAll(".help-sync").forEach(inp => {
        inp.oninput = () => {
          help[inp.dataset.key] = inp.value;
          this.renderPreview();
        };
      });

      container.querySelector("#add-category-btn").onclick = () => {
        help.categories.push({ name: "New Category", icon: "📁", commands: [] });
        this.renderCategories();
        this.renderPreview();
      };

      container.querySelector("#help-save-btn").onclick = async () => {
        await saveProject();
        showToast("Help configuration saved!", "success");
      };
    },

    renderCategories: function () {
      const help = AppState.currentProject.helpSettings;
      const list = document.getElementById("help-categories-list");
      if (!list) return;

      list.innerHTML = help.categories.map((c, i) => `
        <div class="card p-md mb-md help-category-item" data-i="${i}" style="border-left: 3px solid var(--accent); background: rgba(255,255,255,0.03)">
          <div class="flex items-center gap-md">
            <input class="input cat-sync" data-i="${i}" data-key="icon" value="${c.icon}" style="width:50px; text-align:center" title="Icon"/>
            <input class="input cat-sync" data-i="${i}" data-key="name" value="${c.name}" style="flex:1" placeholder="Category Name"/>
            <button class="btn btn-danger btn-sm delete-cat" data-i="${i}">×</button>
          </div>
          <div class="mt-md">
            <label class="input-label" style="font-size:11px; opacity:0.6">Commands (comma separated)</label>
            <input class="input cat-sync" data-i="${i}" data-key="commands" value="${c.commands.join(", ")}" placeholder="ping, help, info"/>
          </div>
        </div>
      `).join("");

      list.querySelectorAll(".cat-sync").forEach(inp => {
        inp.oninput = () => {
          const i = inp.dataset.i;
          const key = inp.dataset.key;
          if (key === "commands") {
            help.categories[i][key] = inp.value.split(",").map(v => v.trim()).filter(v => v);
          } else {
            help.categories[i][key] = inp.value;
          }
          this.renderPreview();
        };
      });

      list.querySelectorAll(".delete-cat").forEach(btn => {
        btn.onclick = () => {
          help.categories.splice(btn.dataset.i, 1);
          this.renderCategories();
          this.renderPreview();
        };
      });
    },

    renderPreview: function () {
      const help = AppState.currentProject.helpSettings;
      const title = document.getElementById("preview-title");
      const desc = document.getElementById("preview-description");
      const embed = document.querySelector(".discord-embed");
      const cats = document.getElementById("preview-categories");
      const comp = document.getElementById("preview-components");

      if (title) title.textContent = help.title;
      if (desc) desc.textContent = help.description;
      if (embed) embed.style.borderLeftColor = help.color;

      if (cats) {
        cats.innerHTML = help.categories.map(c => `
          <div class="preview-cat-field" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">
            <div style="font-weight: 600; font-size: 12px; color: #fff; margin-bottom: 2px;">${c.icon} ${c.name}</div>
            <div style="font-size: 11px; opacity: 0.8;">${c.commands.length > 0 ? c.commands.map(cmd => `\`${cmd}\``).join(", ") : "None"}</div>
          </div>
        `).join("");
      }

      if (comp) {
        if (help.style === 'tabs') {
          comp.innerHTML = `<div style="display:flex; gap:8px; flex-wrap:wrap">
            ${help.categories.map(c => `<div style="background: #4f545c; color: #fff; padding: 6px 12px; border-radius: 3px; font-size:12px">${c.icon} ${c.name}</div>`).join("")}
          </div>`;
        } else if (help.style === 'select') {
          comp.innerHTML = `<div style="background: #4f545c; padding: 8px; border-radius: 4px; font-size: 13px; display:flex; justify-between; align-center; opacity:0.8">
            <span>Select a category...</span>
            <span>▼</span>
          </div>`;
        } else {
          comp.innerHTML = "";
        }
      }
    }
  };
})();
