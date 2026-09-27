/* Embed Designer: form + live Discord preview. Used by the Embed Styler page and by graph blocks. */
(function () {
  const PRESETS = ["#5865f2", "#57f287", "#fee75c", "#faa61a", "#ed4245", "#eb459e", "#00b0f4", "#9b59b6", "#ffffff", "#2b2d31"];
  const LIMITS = { title: 256, description: 4096, footer: 2048, authorName: 256, fieldName: 256, fieldValue: 1024, total: 6000 };

  function blank() {
    return { title: "", url: "", description: "", color: "#5865f2", authorName: "", authorIcon: "", authorUrl: "", thumbnail: "", image: "", footer: "", footerIcon: "", timestamp: false, fields: [] };
  }

  function totalLength(e) {
    return [e.title, e.description, e.footer, e.authorName, ...(e.fields || []).flatMap((f) => [f.name, f.value])].reduce((n, s) => n + String(s || "").length, 0);
  }

  function wrapSelection(ta, before, after = before) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || "text";
    ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
    ta.selectionStart = s + before.length;
    ta.selectionEnd = s + before.length + sel.length;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * Mount the designer into `container`, editing `embed` in place.
   * opts: { onChange(embed), showName: bool, name, onNameChange, extraHeader }
   */
  function mount(container, embed, opts = {}) {
    const e = Object.assign(blank(), embed || {});
    Object.assign(embed, e);
    if (!Array.isArray(embed.fields)) embed.fields = [];

    container.innerHTML = `
      <div class="embed-designer">
        <div class="embed-designer-form">
          ${opts.showName ? `
          <div class="ed-section">
            <div class="input-group"><label class="input-label">Embed name (used to pick it in blocks)</label>
              <input class="input" data-k="__name" value="${escapeHtml(opts.name || "")}" placeholder="e.g. Welcome message" /></div>
          </div>` : ""}
          <div class="ed-section">
            <div class="ed-section-title">Color</div>
            <div class="color-row">
              <input type="color" class="color-swatch" data-el="picker" value="${/^#[0-9a-f]{6}$/i.test(embed.color) ? embed.color : "#5865f2"}" />
              <input class="input input-sm color-hex" data-el="hex" value="${escapeHtml(embed.color || "#5865f2")}" />
              <div class="color-presets">${PRESETS.map((c) => `<button type="button" class="color-dot" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div>
            </div>
          </div>
          <div class="ed-section">
            <div class="ed-section-title">Author</div>
            <div class="grid-2">
              <div class="input-group"><label class="input-label">Author name</label><input class="input" data-k="authorName" placeholder="{user.name}" /></div>
              <div class="input-group"><label class="input-label">Author icon URL</label><input class="input" data-k="authorIcon" placeholder="{user.avatar}" /></div>
            </div>
            <div class="input-group"><label class="input-label">Author link (optional)</label><input class="input" data-k="authorUrl" placeholder="https://..." /></div>
          </div>
          <div class="ed-section">
            <div class="ed-section-title">Body</div>
            <div class="input-group"><label class="input-label">Title <span class="char-count" data-count="title"></span></label><input class="input" data-k="title" placeholder="Embed title" /></div>
            <div class="input-group"><label class="input-label">Title link (optional)</label><input class="input" data-k="url" placeholder="https://..." /></div>
            <div class="input-group">
              <label class="input-label">Description <span class="char-count" data-count="description"></span></label>
              <div class="md-toolbar">
                <button type="button" data-md="**" title="Bold"><b>B</b></button>
                <button type="button" data-md="*" title="Italic"><i>I</i></button>
                <button type="button" data-md="__" title="Underline"><u>U</u></button>
                <button type="button" data-md="~~" title="Strikethrough"><s>S</s></button>
                <button type="button" data-md="\`" title="Inline code">&lt;/&gt;</button>
                <button type="button" data-md="||" title="Spoiler">▒</button>
                <button type="button" data-md-line="> " title="Quote">❝</button>
                <button type="button" data-md-line="# " title="Heading">H</button>
                <button type="button" data-md-link title="Masked link">🔗</button>
              </div>
              <textarea class="input" data-k="description" rows="5" placeholder="Supports **markdown**, {user}, {server} and your variables"></textarea>
            </div>
          </div>
          <div class="ed-section">
            <div class="ed-section-title flex justify-between items-center">Fields <span class="text-muted text-xs" data-el="field-count"></span></div>
            <div data-el="fields"></div>
            <button type="button" class="btn btn-ghost btn-sm" data-act="add-field">+ Add field</button>
          </div>
          <div class="ed-section">
            <div class="ed-section-title">Images</div>
            <div class="grid-2">
              <div class="input-group"><label class="input-label">Thumbnail URL (small, right)</label><input class="input" data-k="thumbnail" placeholder="https://... or {user.avatar}" /></div>
              <div class="input-group"><label class="input-label">Image URL (large, bottom)</label><input class="input" data-k="image" placeholder="https://..." /></div>
            </div>
          </div>
          <div class="ed-section">
            <div class="ed-section-title">Footer</div>
            <div class="grid-2">
              <div class="input-group"><label class="input-label">Footer text</label><input class="input" data-k="footer" placeholder="Footer text" /></div>
              <div class="input-group"><label class="input-label">Footer icon URL</label><input class="input" data-k="footerIcon" placeholder="https://..." /></div>
            </div>
            <label class="toggle-row"><div class="toggle toggle-sm ${embed.timestamp ? "active" : ""}" data-el="timestamp"></div><span>Show timestamp</span></label>
          </div>
        </div>
        <div class="embed-designer-preview">
          <div class="preview-label">${icon("eye", 14)} Live preview</div>
          <div class="discord-surface" data-el="preview"></div>
          <div class="ed-stats" data-el="stats"></div>
          <div class="ed-json-tools">
            <button type="button" class="btn btn-ghost btn-sm" data-act="copy-json">${icon("copy", 14)} Copy JSON</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="import-json">${icon("upload", 14)} Import JSON</button>
          </div>
        </div>
      </div>`;

    const $ = (sel) => container.querySelector(sel);
    const preview = $('[data-el="preview"]');
    const changed = () => {
      update();
      opts.onChange && opts.onChange(embed);
    };

    function update() {
      preview.innerHTML = DiscordPreview.message({ embeds: [embed], content: opts.content || "" });
      ["title", "description"].forEach((k) => {
        const el = container.querySelector(`[data-count="${k}"]`);
        const n = String(embed[k] || "").length;
        el.textContent = `${n}/${LIMITS[k]}`;
        el.classList.toggle("over", n > LIMITS[k]);
      });
      const total = totalLength(embed);
      const warnings = [];
      if (total > LIMITS.total) warnings.push(`Total text is ${total}/6000 characters - Discord will reject it.`);
      if ((embed.fields || []).length > 25) warnings.push("Discord allows at most 25 fields.");
      ["thumbnail", "image", "authorIcon", "footerIcon", "url", "authorUrl"].forEach((k) => {
        const v = String(embed[k] || "").trim();
        if (v && !/^https?:\/\//i.test(v) && !/^\{[\w.]+\}$/.test(v)) warnings.push(`${k} must be an http(s) URL or a {placeholder}.`);
      });
      $('[data-el="stats"]').innerHTML = `<span class="${total > LIMITS.total ? "over" : ""}">${total}/6000 characters</span>` +
        warnings.map((w) => `<div class="ed-warning">${icon("alert", 13)} ${escapeHtml(w)}</div>`).join("");
      $('[data-el="field-count"]').textContent = `${(embed.fields || []).length}/25`;
    }

    container.querySelectorAll("[data-k]").forEach((inp) => {
      const k = inp.dataset.k;
      if (k === "__name") {
        inp.oninput = () => opts.onNameChange && opts.onNameChange(inp.value);
        return;
      }
      inp.value = embed[k] || "";
      inp.addEventListener("input", () => { embed[k] = inp.value; changed(); });
    });

    const picker = $('[data-el="picker"]');
    const hex = $('[data-el="hex"]');
    const setColor = (c) => {
      embed.color = c;
      picker.value = c;
      hex.value = c;
      changed();
    };
    picker.oninput = () => setColor(picker.value);
    hex.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) setColor(hex.value); };
    container.querySelectorAll(".color-dot").forEach((d) => { d.onclick = () => setColor(d.dataset.color); });

    const tsToggle = $('[data-el="timestamp"]');
    tsToggle.onclick = () => { tsToggle.classList.toggle("active"); embed.timestamp = tsToggle.classList.contains("active"); changed(); };

    const desc = container.querySelector('[data-k="description"]');
    container.querySelectorAll("[data-md]").forEach((b) => { b.onclick = () => wrapSelection(desc, b.dataset.md); });
    container.querySelectorAll("[data-md-line]").forEach((b) => {
      b.onclick = () => {
        const s = desc.selectionStart;
        const lineStart = desc.value.lastIndexOf("\n", s - 1) + 1;
        desc.value = desc.value.slice(0, lineStart) + b.dataset.mdLine + desc.value.slice(lineStart);
        desc.dispatchEvent(new Event("input", { bubbles: true }));
        desc.focus();
      };
    });
    container.querySelector("[data-md-link]").onclick = () => wrapSelection(desc, "[", "](https://example.com)");

    function renderFields() {
      const list = $('[data-el="fields"]');
      list.innerHTML = "";
      embed.fields.forEach((f, i) => {
        const row = document.createElement("div");
        row.className = "ed-field";
        row.innerHTML = `
          <div class="ed-field-head">
            <span class="ed-field-num">#${i + 1}</span>
            <label class="toggle-row toggle-row-sm"><div class="toggle toggle-sm ${f.inline ? "active" : ""}" data-f="inline"></div><span>Inline</span></label>
            <div class="list-item-tools">
              <button type="button" class="icon-btn" data-f="up" title="Move up" ${i === 0 ? "disabled" : ""}>${icon("arrowUp", 14)}</button>
              <button type="button" class="icon-btn" data-f="down" title="Move down" ${i === embed.fields.length - 1 ? "disabled" : ""}>${icon("arrowDown", 14)}</button>
              <button type="button" class="icon-btn" data-f="dup" title="Duplicate">${icon("copy", 14)}</button>
              <button type="button" class="icon-btn danger" data-f="del" title="Remove">${icon("trash", 14)}</button>
            </div>
          </div>
          <input class="input input-sm" data-f="name" placeholder="Field name" />
          <textarea class="input input-sm" data-f="value" rows="2" placeholder="Field value"></textarea>`;
        row.querySelector('[data-f="name"]').value = f.name || "";
        row.querySelector('[data-f="value"]').value = f.value || "";
        row.querySelector('[data-f="name"]').oninput = (ev) => { f.name = ev.target.value; changed(); };
        row.querySelector('[data-f="value"]').oninput = (ev) => { f.value = ev.target.value; changed(); };
        row.querySelector('[data-f="inline"]').onclick = (ev) => { ev.currentTarget.classList.toggle("active"); f.inline = ev.currentTarget.classList.contains("active"); changed(); };
        row.querySelector('[data-f="up"]').onclick = () => { embed.fields.splice(i - 1, 0, embed.fields.splice(i, 1)[0]); renderFields(); changed(); };
        row.querySelector('[data-f="down"]').onclick = () => { embed.fields.splice(i + 1, 0, embed.fields.splice(i, 1)[0]); renderFields(); changed(); };
        row.querySelector('[data-f="dup"]').onclick = () => { embed.fields.splice(i + 1, 0, { ...f }); renderFields(); changed(); };
        row.querySelector('[data-f="del"]').onclick = () => { embed.fields.splice(i, 1); renderFields(); changed(); };
        list.appendChild(row);
      });
    }
    renderFields();

    $('[data-act="add-field"]').onclick = () => {
      if (embed.fields.length >= 25) return showToast("Discord allows at most 25 fields", "warning");
      embed.fields.push({ name: "Field name", value: "Field value", inline: true });
      renderFields();
      changed();
    };

    $('[data-act="copy-json"]').onclick = async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(embed, null, 2));
        showToast("Embed JSON copied", "success");
      } catch {
        showToast("Clipboard unavailable", "error");
      }
    };
    $('[data-act="import-json"]').onclick = () => {
      showModal(`
        <h2 class="modal-title">Import embed JSON</h2>
        <p class="dialog-text">Paste Botify embed JSON or a Discord embed object (e.g. from another bot builder).</p>
        <textarea class="input input-code" rows="10" data-el="json" placeholder='{"title": "Hello", "description": "..."}'></textarea>
        <div class="modal-actions"><button class="btn btn-secondary" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="ok">Import</button></div>`,
      (c, close) => {
        c.querySelector('[data-act="cancel"]').onclick = close;
        c.querySelector('[data-act="ok"]').onclick = () => {
          try {
            let data = JSON.parse(c.querySelector('[data-el="json"]').value);
            if (data.embeds) data = data.embeds[0];
            const converted = {
              title: data.title || "", url: data.url || "", description: data.description || "",
              color: typeof data.color === "number" ? "#" + data.color.toString(16).padStart(6, "0") : (data.color || "#5865f2"),
              authorName: data.authorName || (data.author && data.author.name) || "", authorIcon: data.authorIcon || (data.author && (data.author.icon_url || data.author.iconURL)) || "",
              authorUrl: data.authorUrl || (data.author && data.author.url) || "",
              thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : (data.thumbnail && data.thumbnail.url) || "",
              image: typeof data.image === "string" ? data.image : (data.image && data.image.url) || "",
              footer: typeof data.footer === "string" ? data.footer : (data.footer && data.footer.text) || "",
              footerIcon: data.footerIcon || (data.footer && (data.footer.icon_url || data.footer.iconURL)) || "",
              timestamp: !!data.timestamp,
              fields: (data.fields || []).map((f) => ({ name: f.name || "", value: f.value || "", inline: !!f.inline })),
            };
            Object.keys(embed).forEach((k) => delete embed[k]);
            Object.assign(embed, converted);
            close();
            mount(container, embed, opts);
            opts.onChange && opts.onChange(embed);
            showToast("Embed imported", "success");
          } catch (err) {
            showToast("Invalid JSON: " + err.message, "error");
          }
        };
      }, { size: "md" });
    };

    update();
    return { refresh: update };
  }

  /** Open the designer in a modal. onSave(embed) is called with the edited copy. */
  function openModal(embed, onSave, opts = {}) {
    const working = clone(embed || blank());
    let name = opts.name || "";
    showModal(`
      <div class="modal-head">
        <h2 class="modal-title">${escapeHtml(opts.title || "Embed Designer")}</h2>
        <div class="flex gap-sm">
          <button class="btn btn-secondary" data-act="cancel">Cancel</button>
          <button class="btn btn-primary" data-act="save">${icon("check", 16)} ${escapeHtml(opts.saveText || "Apply")}</button>
        </div>
      </div>
      <div class="modal-scroll" data-el="designer"></div>`, (c, close) => {
      mount(c.querySelector('[data-el="designer"]'), working, { showName: opts.showName, name, onNameChange: (v) => { name = v; } });
      c.querySelector('[data-act="cancel"]').onclick = close;
      c.querySelector('[data-act="save"]').onclick = () => {
        if (opts.showName && !name.trim()) return showToast("Give the embed a name", "warning");
        onSave(working, name.trim());
        close();
      };
    }, { size: "xl" });
  }

  window.EmbedEditor = { mount, openModal, blank };
})();
