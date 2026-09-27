/* Builds editable forms from block field schemas (see src/shared/blocks.js). */
(function () {
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    children.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  /** Small popover listing placeholders / variables to insert into a text field. */
  function placeholderButton(input, opts) {
    const btn = h("button", { class: "ph-btn", type: "button", title: "Insert placeholder / variable" }, "{ }");
    btn.onclick = (e) => {
      e.preventDefault();
      document.querySelectorAll(".ph-popover").forEach((p) => p.remove());
      const vars = (opts.variables || []).filter(Boolean);
      const items = [
        ...vars.map((v) => ({ token: `{${v}}`, desc: "variable" })),
        ...BotifyBlocks.PLACEHOLDERS.filter((p) => p.token !== "{myVar}"),
      ];
      const pop = h("div", { class: "ph-popover" },
        h("div", { class: "ph-popover-title" }, "Insert"),
        ...items.map((it) => h("div", {
          class: "ph-item",
          onmousedown: (ev) => {
            ev.preventDefault();
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            input.value = input.value.slice(0, start) + it.token + input.value.slice(end);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
            input.selectionStart = input.selectionEnd = start + it.token.length;
            pop.remove();
          },
        }, h("code", {}, it.token), h("span", {}, it.desc))));
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect();
      pop.style.top = Math.min(window.innerHeight - 320, r.bottom + 4) + "px";
      pop.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.right - 260)) + "px";
      const off = (ev) => {
        if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener("mousedown", off, true); }
      };
      setTimeout(() => document.addEventListener("mousedown", off, true), 0);
    };
    return btn;
  }

  function isVisible(field, data) {
    if (!field.showIf) return true;
    return data[field.showIf.key] === field.showIf.value;
  }

  function fieldControl(field, data, opts, rerender) {
    const value = data[field.key];
    const set = (v) => {
      data[field.key] = v;
      opts.onChange && opts.onChange(field.key, v);
    };
    const wrapTextInput = (input) => {
      if (field.type === "code" || field.type === "variable" || field.type === "number" || field.noPlaceholders) return input;
      return h("div", { class: "input-with-addon" }, input, placeholderButton(input, opts));
    };

    switch (field.type) {
      case "textarea":
      case "code": {
        const ta = h("textarea", {
          class: "input" + (field.type === "code" ? " input-code" : ""), rows: field.rows || (field.type === "code" ? 4 : 3),
          placeholder: field.placeholder || "", spellcheck: field.type === "code" ? "false" : null,
          oninput: (e) => set(e.target.value),
        });
        ta.value = value ?? "";
        return wrapTextInput(ta);
      }
      case "number": {
        const inp = h("input", { class: "input", type: "number", placeholder: field.placeholder || "", oninput: (e) => set(e.target.value === "" ? "" : Number(e.target.value)) });
        inp.value = value ?? "";
        return inp;
      }
      case "checkbox": {
        const cb = h("div", { class: "toggle toggle-sm" + (value ? " active" : ""), role: "switch", tabindex: "0" });
        const toggle = () => { cb.classList.toggle("active"); set(cb.classList.contains("active")); };
        cb.onclick = toggle;
        cb.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } };
        return h("label", { class: "toggle-row" }, cb, h("span", {}, field.label));
      }
      case "select": {
        const sel = h("select", { class: "input", onchange: (e) => { set(e.target.value); if (opts.rerenderOnSelect !== false) rerender(); } },
          ...(field.options || []).map((o) => h("option", { value: o.value }, o.label)));
        sel.value = value ?? field.default ?? "";
        if (sel.value !== String(value ?? "") && value !== undefined && value !== "") {
          sel.appendChild(h("option", { value }, String(value)));
          sel.value = value;
        }
        return sel;
      }
      case "variable": {
        const inp = h("input", { class: "input input-code", placeholder: field.placeholder || "variableName", spellcheck: "false",
          oninput: (e) => {
            const clean = e.target.value.replace(/[^A-Za-z0-9_]/g, "_");
            if (clean !== e.target.value) e.target.value = clean;
            set(clean);
          } });
        inp.value = value ?? "";
        return inp;
      }
      case "color": {
        const text = h("input", { class: "input", value: value || "#5865f2" });
        const picker = h("input", { type: "color", class: "color-swatch", value: /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#5865f2" });
        picker.oninput = () => { text.value = picker.value; set(picker.value); };
        text.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) { picker.value = text.value; set(text.value); } };
        return h("div", { class: "color-field" }, picker, text);
      }
      case "embedRef": {
        const embeds = (opts.project && opts.project.embeds) || [];
        const sel = h("select", { class: "input", onchange: (e) => { set(e.target.value); rerender(); } },
          h("option", { value: "" }, embeds.length ? "— none —" : "No saved embeds (create one in Embed Styler)"),
          ...embeds.map((e) => h("option", { value: e.id }, e.name || e.title || "Untitled")));
        sel.value = value || "";
        return sel;
      }
      case "embed": {
        const emb = value || {};
        const card = h("div", { class: "embed-field-card" },
          h("div", { class: "embed-field-mini", html: DiscordPreview.embed(emb) }),
          h("div", { class: "flex gap-sm" },
            h("button", { class: "btn btn-primary btn-sm", type: "button", onclick: () => {
              EmbedEditor.openModal(clone(emb), (updated) => { set(updated); rerender(); }, { title: "Design embed" });
            } }, "🎨 Open Embed Designer"),
            (opts.project && (opts.project.embeds || []).length) ? h("select", { class: "input input-sm", onchange: (e) => {
              const src = opts.project.embeds.find((x) => x.id === e.target.value);
              if (src) { const copy = clone(src); delete copy.id; delete copy.name; set(copy); rerender(); }
            } }, h("option", { value: "" }, "Load from saved…"), ...opts.project.embeds.map((x) => h("option", { value: x.id }, x.name || x.title))) : null));
        return card;
      }
      case "params": {
        const list = Array.isArray(value) ? value : (typeof value === "string" && value ? value.split(",").map((s) => s.trim()) : []);
        if (!Array.isArray(value)) set(list);
        const wrap = h("div", { class: "params-list" });
        const draw = () => {
          wrap.innerHTML = "";
          list.forEach((p, i) => {
            const inp = h("input", { class: "input input-code", value: p, placeholder: "e.g. user.id", oninput: (e) => { list[i] = e.target.value; set(list); } });
            wrap.appendChild(h("div", { class: "params-row" }, h("span", { class: "params-idx" }, `?${i + 1}`), inp,
              h("button", { class: "icon-btn", type: "button", title: "Remove", html: icon("x", 14), onclick: () => { list.splice(i, 1); set(list); draw(); } })));
          });
          wrap.appendChild(h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => { list.push(""); set(list); draw(); } }, "+ Add parameter"));
        };
        draw();
        return wrap;
      }
      case "list":
        return listControl(field, data, opts, set);
      default: {
        const inp = h("input", { class: "input", placeholder: field.placeholder || "", oninput: (e) => set(e.target.value) });
        inp.value = value ?? "";
        return wrapTextInput(inp);
      }
    }
  }

  function listControl(field, data, opts, set) {
    if (!Array.isArray(data[field.key])) data[field.key] = [];
    const items = data[field.key];
    const wrap = h("div", { class: "list-field" });
    const draw = () => {
      wrap.innerHTML = "";
      items.forEach((item, idx) => {
        const title = item.label || item.id || item.value || `${field.itemLabel || "Item"} ${idx + 1}`;
        const body = h("div", { class: "list-item-body" });
        const card = h("div", { class: "list-item" + (item.__open ? " open" : "") },
          h("div", { class: "list-item-head", onclick: (e) => {
            if (e.target.closest("button")) return;
            item.__open = !item.__open;
            Object.defineProperty(item, "__open", { value: item.__open, enumerable: false, writable: true, configurable: true });
            card.classList.toggle("open");
          } },
          h("span", { class: "list-item-chevron", html: icon("chevronDown", 14) }),
          h("span", { class: "list-item-title" }, String(title)),
          h("div", { class: "list-item-tools" },
            h("button", { class: "icon-btn", type: "button", title: "Move up", disabled: idx === 0 ? true : null, html: icon("arrowUp", 14), onclick: () => { items.splice(idx - 1, 0, items.splice(idx, 1)[0]); set(items); draw(); } }),
            h("button", { class: "icon-btn", type: "button", title: "Move down", disabled: idx === items.length - 1 ? true : null, html: icon("arrowDown", 14), onclick: () => { items.splice(idx + 1, 0, items.splice(idx, 1)[0]); set(items); draw(); } }),
            h("button", { class: "icon-btn danger", type: "button", title: "Remove", html: icon("trash", 14), onclick: () => { items.splice(idx, 1); set(items); draw(); } }))),
          body);
        render(body, field.item || [], item, { ...opts, rerenderOnSelect: false, onChange: () => {
          card.querySelector(".list-item-title").textContent = item.label || item.id || item.value || `${field.itemLabel || "Item"} ${idx + 1}`;
          set(items);
        } });
        wrap.appendChild(card);
      });
      const canAdd = !field.max || items.length < field.max;
      wrap.appendChild(h("button", { class: "btn btn-ghost btn-sm list-add", type: "button", disabled: canAdd ? null : true, onclick: () => {
        const fresh = {};
        (field.item || []).forEach((f) => { fresh[f.key] = clone(f.default); });
        const n = items.length + 1;
        if ("id" in fresh) fresh.id = `${(fresh.id || "item").replace(/_?\d+$/, "")}_${n}`;
        if ("value" in fresh && !("id" in fresh)) fresh.value = `${(fresh.value || "value").replace(/_?\d+$/, "")}_${n}`;
        if ("label" in fresh) fresh.label = `${fresh.label || field.itemLabel || "Item"} ${n}`;
        Object.defineProperty(fresh, "__open", { value: true, enumerable: false, writable: true, configurable: true });
        items.push(fresh);
        set(items);
        draw();
      } }, canAdd ? `+ Add ${(field.itemLabel || "item").toLowerCase()}` : `Maximum ${field.max} reached`));
    };
    draw();
    return wrap;
  }

  /**
   * Render a form for `fields` editing `data` in place.
   * opts: { onChange(key, value), project, variables: string[] }
   */
  function render(container, fields, data, opts = {}) {
    const rerender = () => render(container, fields, data, opts);
    container.innerHTML = "";
    (fields || []).forEach((field) => {
      if (!isVisible(field, data)) return;
      if (data[field.key] === undefined && field.default !== undefined) data[field.key] = clone(field.default);
      const control = fieldControl(field, data, opts, rerender);
      if (field.type === "checkbox") {
        container.appendChild(h("div", { class: "input-group" }, control, field.help ? h("div", { class: "input-help" }, field.help) : null));
      } else {
        container.appendChild(h("div", { class: "input-group" },
          h("label", { class: "input-label" }, field.label),
          control,
          field.help ? h("div", { class: "input-help" }, field.help) : null));
      }
    });
    if (!fields || !fields.length) container.appendChild(h("p", { class: "text-muted text-sm" }, "This block has no settings."));
  }

  window.FieldForm = { render, h };
})();
