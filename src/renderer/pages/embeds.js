function renderEmbeds(el) {
    if (!AppState.currentProject) {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div></div>';
        return;
    }
    const embeds = AppState.currentProject.embeds || [];
    el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Embeds</h1><p class="page-subtitle">Visual embed builder</p></div>
      <button class="btn btn-primary" id="add-embed-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Embed
      </button>
    </div>
    <div class="command-list" id="embeds-list">
      ${embeds.length === 0 ? '<div class="empty-state"><div class="empty-state-title">No embeds</div><div class="empty-state-text">Create rich embeds for your bot</div></div>' :
            embeds.map((emb, i) => `
        <div class="command-item" data-index="${i}">
          <div class="command-info">
            <div class="color-preview" style="background:${emb.color || "#7c6aef"};width:24px;height:24px;border-radius:4px;flex-shrink:0"></div>
            <div>
              <div class="command-name">${emb.title || "Untitled Embed"}</div>
              <div class="command-desc">${emb.description ? emb.description.substring(0, 60) + "..." : "No description"}</div>
            </div>
          </div>
          <div class="command-actions">
            <button class="btn btn-secondary btn-sm emb-edit" data-index="${i}">Edit</button>
            <button class="btn btn-danger btn-sm emb-delete" data-index="${i}">Delete</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;

    el.querySelector("#add-embed-btn").onclick = () => showEmbedEditor();
    el.querySelectorAll(".emb-edit").forEach((btn) => {
        btn.onclick = (e) => { e.stopPropagation(); showEmbedEditor(parseInt(btn.dataset.index)); };
    });
    el.querySelectorAll(".emb-delete").forEach((btn) => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            AppState.currentProject.embeds.splice(parseInt(btn.dataset.index), 1);
            await saveProject();
            renderEmbeds(el);
            showToast("Embed deleted", "success");
        };
    });
}

function showEmbedEditor(editIndex) {
    const isEdit = editIndex !== undefined;
    const emb = isEdit ? { ...AppState.currentProject.embeds[editIndex] } : {
        title: "", description: "", color: "#7c6aef", fields: [], footer: "", thumbnail: "", image: "",
    };
    if (!emb.fields) emb.fields = [];
    let fields = [...emb.fields];

    showModal(`
    <h2 class="modal-title">${isEdit ? "Edit" : "New"} Embed</h2>
    <div class="grid-2">
      <div class="input-group">
        <label class="input-label">Title</label>
        <input class="input" id="emb-title" value="${emb.title || ""}" placeholder="Embed Title" />
      </div>
      <div class="input-group">
        <label class="input-label">Color</label>
        <div class="color-picker-wrapper">
          <div class="color-preview" id="emb-color-preview" style="background:${emb.color || "#7c6aef"}"></div>
          <input type="color" class="color-input" id="emb-color" value="${emb.color || "#7c6aef"}" />
          <input class="input" id="emb-color-hex" value="${emb.color || "#7c6aef"}" style="width:120px" />
        </div>
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Description</label>
      <textarea class="input" id="emb-desc" rows="3">${emb.description || ""}</textarea>
    </div>
    <div class="grid-2">
      <div class="input-group">
        <label class="input-label">Thumbnail URL</label>
        <input class="input" id="emb-thumb" value="${emb.thumbnail || ""}" placeholder="https://example.com/image.png" />
      </div>
      <div class="input-group">
        <label class="input-label">Image URL</label>
        <input class="input" id="emb-image" value="${emb.image || ""}" placeholder="https://example.com/large-image.png" />
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Footer</label>
      <input class="input" id="emb-footer" value="${emb.footer || ""}" placeholder="Footer text" />
    </div>
    <div class="section mt-md">
      <div class="section-title">Fields</div>
      <div id="emb-fields-list"></div>
      <button class="btn btn-ghost btn-sm mt-sm" id="add-field-btn">+ Add Field</button>
    </div>
    <div class="section mt-md">
      <div class="section-title">Preview</div>
      <div id="emb-preview"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="emb-cancel">Cancel</button>
      <button class="btn btn-primary" id="emb-save">Save Embed</button>
    </div>
  `, (container) => {
        const colorPicker = container.querySelector("#emb-color");
        const colorPreview = container.querySelector("#emb-color-preview");
        const colorHex = container.querySelector("#emb-color-hex");

        colorPreview.onclick = () => colorPicker.click();
        colorPicker.oninput = () => {
            colorPreview.style.background = colorPicker.value;
            colorHex.value = colorPicker.value;
            updatePreview();
        };
        colorHex.oninput = () => {
            if (/^#[0-9a-fA-F]{6}$/.test(colorHex.value)) {
                colorPicker.value = colorHex.value;
                colorPreview.style.background = colorHex.value;
                updatePreview();
            }
        };

        ["#emb-title", "#emb-desc", "#emb-footer", "#emb-thumb", "#emb-image"].forEach((sel) => {
            container.querySelector(sel).oninput = updatePreview;
        });

        function renderFields() {
            const list = container.querySelector("#emb-fields-list");
            list.innerHTML = fields.map((f, i) => `
        <div class="flex items-center gap-sm mb-md">
          <input class="input" value="${f.name}" placeholder="Field Name" data-i="${i}" data-f="name" style="flex:1" />
          <input class="input" value="${f.value}" placeholder="Field Value" data-i="${i}" data-f="value" style="flex:1" />
          <label class="checkbox-wrapper" style="font-size:12px">
            <div class="checkbox ${f.inline ? "checked" : ""}" data-i="${i}" data-f="inline"></div>
            Inline
          </label>
          <button class="btn btn-danger btn-sm field-remove" data-i="${i}">×</button>
        </div>
      `).join("");
            list.querySelectorAll("input[data-f]").forEach((inp) => {
                inp.oninput = () => { fields[inp.dataset.i][inp.dataset.f] = inp.value; updatePreview(); };
            });
            list.querySelectorAll(".checkbox").forEach((cb) => {
                cb.onclick = () => {
                    fields[cb.dataset.i].inline = !fields[cb.dataset.i].inline;
                    cb.classList.toggle("checked");
                    updatePreview();
                };
            });
            list.querySelectorAll(".field-remove").forEach((btn) => {
                btn.onclick = () => { fields.splice(parseInt(btn.dataset.i), 1); renderFields(); updatePreview(); };
            });
        }
        renderFields();

        container.querySelector("#add-field-btn").onclick = () => {
            fields.push({ name: "Field", value: "Value", inline: false });
            renderFields();
            updatePreview();
        };

        function updatePreview() {
            const title = container.querySelector("#emb-title").value;
            const desc = container.querySelector("#emb-desc").value;
            const color = colorPicker.value;
            const footer = container.querySelector("#emb-footer").value;
            const preview = container.querySelector("#emb-preview");
            preview.innerHTML = `
        <div class="embed-preview" style="border-left-color:${color}">
          ${title ? `<div class="embed-preview-title">${title}</div>` : ""}
          ${desc ? `<div class="embed-preview-desc">${desc}</div>` : ""}
          ${fields.length > 0 ? `<div class="embed-preview-fields">${fields.map((f) => `
            <div class="embed-preview-field" style="${f.inline ? "" : "grid-column:1/-1"}">
              <div class="embed-preview-field-name">${f.name}</div>
              <div class="embed-preview-field-value">${f.value}</div>
            </div>`).join("")}</div>` : ""}
          ${footer ? `<div class="embed-preview-footer">${footer}</div>` : ""}
        </div>
      `;
        }
        updatePreview();

        container.querySelector("#emb-cancel").onclick = hideModal;
        container.querySelector("#emb-save").onclick = async () => {
            const data = {
                title: container.querySelector("#emb-title").value,
                description: container.querySelector("#emb-desc").value,
                color: colorPicker.value,
                fields: fields.filter((f) => f.name),
                footer: container.querySelector("#emb-footer").value,
                thumbnail: container.querySelector("#emb-thumb").value,
                image: container.querySelector("#emb-image").value,
            };
            if (!AppState.currentProject.embeds) AppState.currentProject.embeds = [];
            if (isEdit) {
                AppState.currentProject.embeds[editIndex] = data;
            } else {
                AppState.currentProject.embeds.push(data);
            }
            await saveProject();
            hideModal();
            renderEmbeds(document.getElementById("page-embeds"));
            showToast(isEdit ? "Embed updated" : "Embed added", "success");
        };
    });
}
