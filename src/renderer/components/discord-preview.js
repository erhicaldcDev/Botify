/* Renders Discord-looking previews of messages, embeds, components and modals. */
(function () {
  const SAMPLE = {
    user: '<span class="dc-mention">@Wumpus</span>',
    "user.mention": '<span class="dc-mention">@Wumpus</span>',
    "user.name": "wumpus",
    "user.username": "wumpus",
    "user.displayName": "Wumpus",
    "user.tag": "wumpus",
    "user.id": "123456789012345678",
    server: "Botify Community",
    "server.name": "Botify Community",
    "server.id": "987654321098765432",
    "server.members": "1,337",
    channel: '<span class="dc-mention">#general</span>',
    "channel.mention": '<span class="dc-mention">#general</span>',
    "channel.name": "general",
    "channel.id": "112233445566778899",
    bot: '<span class="dc-mention">@Botify</span>',
    "bot.name": "Botify",
    remaining: "4",
  };

  const AVATAR_COLORS = ["#5865f2", "#3ba55c", "#faa61a", "#ed4245", "#eb459e"];
  function avatarSvg(letter = "B", color = "#5865f2") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' rx='40' fill='${color}'/><text x='40' y='52' font-size='36' text-anchor='middle' fill='white' font-family='Arial' font-weight='700'>${letter}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  const SAMPLE_IMAGES = {
    "{user.avatar}": avatarSvg("W", AVATAR_COLORS[0]),
    "{bot.avatar}": avatarSvg("B", AVATAR_COLORS[1]),
    "{server.icon}": avatarSvg("S", AVATAR_COLORS[2]),
    "{info.avatar}": avatarSvg("W", AVATAR_COLORS[0]),
  };

  function resolveUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (SAMPLE_IMAGES[u]) return SAMPLE_IMAGES[u];
    if (/^\{[\w.]+\}$/.test(u)) return avatarSvg("?", "#4f545c");
    if (/^https?:\/\//i.test(u) && !/[{}]/.test(u)) return u;
    if (/^https?:\/\//i.test(u)) return avatarSvg("?", "#4f545c");
    return "";
  }

  function img(url, cls) {
    const src = resolveUrl(url);
    if (!src) return "";
    return `<img class="${cls}" src="${escapeHtml(src)}" alt="" loading="lazy" onerror="this.classList.add('dc-img-broken');this.removeAttribute('src')" />`;
  }

  function formatTimestamp(sec, style) {
    const d = new Date(Number(sec) * 1000);
    if (isNaN(d)) return "";
    switch (style) {
      case "t": return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      case "T": return d.toLocaleTimeString();
      case "d": return d.toLocaleDateString();
      case "D": return d.toLocaleDateString([], { dateStyle: "long" });
      case "R": return "just now";
      case "F": return d.toLocaleString([], { dateStyle: "full", timeStyle: "short" });
      default: return d.toLocaleString([], { dateStyle: "long", timeStyle: "short" });
    }
  }

  /** Discord-flavoured markdown to HTML (input is raw user text). */
  function markdown(text, opts = {}) {
    let s = escapeHtml(String(text ?? ""));
    const stash = [];
    const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;

    s = s.replace(/```(?:[\w+-]+\n)?([\s\S]*?)```/g, (m, code) => keep(`<pre class="dc-codeblock"><code>${code.replace(/^\n/, "")}</code></pre>`));
    s = s.replace(/`([^`\n]+)`/g, (m, code) => keep(`<code class="dc-inline-code">${code}</code>`));

    // Placeholders / variables
    s = s.replace(/\{([A-Za-z_][\w]*(?:\.[\w]+)*)\}/g, (m, token) => {
      if (SAMPLE[token] !== undefined) return keep(SAMPLE[token]);
      if (token === "date") return new Date().toLocaleDateString();
      if (token === "time") return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (token === "timestamp") return keep(`<span class="dc-timestamp-inline">${formatTimestamp(Date.now() / 1000)}</span>`);
      if (/avatar|icon/.test(token)) return keep(`<span class="dc-var" title="Variable">${token}</span>`);
      return keep(`<span class="dc-var" title="Filled in when the bot runs">${token}</span>`);
    });
    s = s.replace(/\$\{([^}]+)\}/g, (m, expr) => keep(`<span class="dc-var dc-var-code" title="Code expression">${expr}</span>`));

    // Mentions & timestamps
    s = s.replace(/&lt;@!?(\d+)&gt;/g, () => keep('<span class="dc-mention">@user</span>'));
    s = s.replace(/&lt;@&amp;(\d+)&gt;/g, () => keep('<span class="dc-mention dc-mention-role">@role</span>'));
    s = s.replace(/&lt;#(\d+)&gt;/g, () => keep('<span class="dc-mention">#channel</span>'));
    s = s.replace(/&lt;t:(\d+)(?::([tTdDfFR]))?&gt;/g, (m, sec, style) => keep(`<span class="dc-timestamp-inline">${formatTimestamp(sec, style)}</span>`));
    s = s.replace(/&lt;a?:(\w+):\d+&gt;/g, (m, name) => `:${name}:`);

    // Masked links (embeds only in real Discord, but harmless elsewhere)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => keep(`<a class="dc-link" title="${url}">${label}</a>`));
    s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (m, pre, url) => pre + keep(`<a class="dc-link">${url}</a>`));

    // Inline formatting
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<u>$1</u>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_(?!\s)(.+?)_(?!\w)/g, "$1<em>$2</em>")
      .replace(/~~(.+?)~~/g, "<s>$1</s>")
      .replace(/\|\|(.+?)\|\|/g, '<span class="dc-spoiler" onclick="this.classList.add(\'revealed\')">$1</span>');

    // Block formatting (line based)
    const lines = s.split("\n");
    const out = [];
    let quote = [];
    const flushQuote = () => {
      if (quote.length) out.push(`<div class="dc-quote">${quote.join("<br>")}</div>`);
      quote = [];
    };
    lines.forEach((line) => {
      let m;
      if ((m = line.match(/^&gt;\s?(.*)$/))) { quote.push(m[1]); return; }
      flushQuote();
      if (!opts.inline && (m = line.match(/^(#{1,3})\s+(.+)$/))) { out.push(`<div class="dc-h${m[1].length}">${m[2]}</div>`); return; }
      if ((m = line.match(/^-#\s+(.+)$/))) { out.push(`<div class="dc-subtext">${m[1]}</div>`); return; }
      if ((m = line.match(/^\s*[-*]\s+(.+)$/))) { out.push(`<div class="dc-li">${m[1]}</div>`); return; }
      out.push(line + "<br>");
    });
    flushQuote();
    s = out.join("").replace(/(<br>)+$/, "");

    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[Number(i)]);
  }

  function colorOf(c) {
    return /^#[0-9a-fA-F]{6}$/.test(String(c || "")) ? c : "#1e1f22";
  }

  /** Discord groups inline fields up to 3 per row (2 when a thumbnail is present). */
  function fieldsHtml(fields, hasThumb) {
    const list = (fields || []).filter((f) => f && (f.name || f.value));
    if (!list.length) return "";
    const perRow = hasThumb ? 2 : 3;
    const rows = [];
    let current = [];
    list.forEach((f) => {
      if (!f.inline) {
        if (current.length) rows.push(current);
        rows.push([f]);
        current = [];
        return;
      }
      current.push(f);
      if (current.length === perRow) { rows.push(current); current = []; }
    });
    if (current.length) rows.push(current);
    return `<div class="dc-embed-fields">${rows.map((row) => `<div class="dc-embed-field-row" style="grid-template-columns:repeat(${row.length},minmax(0,1fr))">${row.map((f) => `
      <div class="dc-embed-field">
        <div class="dc-embed-field-name">${markdown(f.name || "​", { inline: true })}</div>
        <div class="dc-embed-field-value">${markdown(f.value || "​")}</div>
      </div>`).join("")}</div>`).join("")}</div>`;
  }

  function embed(e) {
    if (!e) return "";
    const thumb = e.thumbnail ? img(e.thumbnail, "dc-embed-thumb") : "";
    const footerText = [e.footer ? markdown(e.footer, { inline: true }) : "", e.timestamp ? "Today at " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""].filter(Boolean).join(" • ");
    const body = [
      e.authorName ? `<div class="dc-embed-author">${img(e.authorIcon, "dc-embed-author-icon")}<span${e.authorUrl ? ' class="dc-link"' : ""}>${markdown(e.authorName, { inline: true })}</span></div>` : "",
      e.title ? `<div class="dc-embed-title${e.url ? " dc-link" : ""}">${markdown(e.title, { inline: true })}</div>` : "",
      e.description ? `<div class="dc-embed-desc">${markdown(e.description)}</div>` : "",
      fieldsHtml(e.fields, !!thumb),
      e.image ? `<div class="dc-embed-image-wrap">${img(e.image, "dc-embed-image")}</div>` : "",
      footerText ? `<div class="dc-embed-footer">${img(e.footerIcon, "dc-embed-footer-icon")}<span>${footerText}</span></div>` : "",
    ].join("");
    const empty = !body.trim() && !thumb;
    return `<div class="dc-embed" style="--embed-color:${colorOf(e.color)}">
      <div class="dc-embed-body">${empty ? '<div class="dc-embed-desc dc-muted">Empty embed</div>' : body}</div>
      ${thumb ? `<div class="dc-embed-thumb-wrap">${thumb}</div>` : ""}
    </div>`;
  }

  const BTN_CLASS = { 1: "primary", 2: "secondary", 3: "success", 4: "danger", 5: "link" };
  function buttons(list) {
    const items = (list || []).slice(0, 25);
    if (!items.length) return "";
    const rows = [];
    items.forEach((b, i) => {
      if (i % 5 === 0) rows.push([]);
      rows[rows.length - 1].push(b);
    });
    return rows.map((row) => `<div class="dc-action-row">${row.map((b) => {
      const style = BTN_CLASS[Number(b.style) || 1] || "primary";
      return `<span class="dc-button dc-button-${style}">${b.emoji ? `<span class="dc-emoji">${escapeHtml(b.emoji)}</span>` : ""}${b.label ? markdown(b.label, { inline: true }) : ""}${style === "link" ? icon("external", 13) : ""}</span>`;
    }).join("")}</div>`).join("");
  }

  function select(sel) {
    if (!sel) return "";
    const opts = (sel.options || []).slice(0, 25);
    return `<div class="dc-action-row"><div class="dc-select">
        <span class="dc-select-placeholder">${markdown(sel.placeholder || "Make a selection", { inline: true })}</span>${icon("chevronDown", 18)}
      </div></div>
      ${sel.expanded !== false && opts.length ? `<div class="dc-select-menu">${opts.map((o) => `
        <div class="dc-select-option">${o.emoji ? `<span class="dc-emoji">${escapeHtml(o.emoji)}</span>` : ""}<div><div class="dc-select-option-label">${markdown(o.label || o.value || "Option", { inline: true })}</div>${o.description ? `<div class="dc-select-option-desc">${markdown(o.description, { inline: true })}</div>` : ""}</div></div>`).join("")}
      </div>` : ""}`;
  }

  // ------------------------------------------------------------ Components V2
  function galleryHtml(items) {
    const list = (items || []).filter((i) => i && String(i.url || "").trim()).slice(0, 10);
    if (!list.length) return '<div class="dc-v2-gallery dc-v2-gallery-empty">No images yet</div>';
    const n = list.length;
    const layoutClass = n === 1 ? "g1" : n === 2 ? "g2" : n === 3 ? "g3" : n === 4 ? "g4" : "gn";
    return `<div class="dc-v2-gallery ${layoutClass}">${list.map((it) => `
      <div class="dc-v2-gallery-item${it.spoiler ? " spoiler" : ""}">${img(it.url === "https://" ? "" : it.url, "dc-v2-gallery-img") || '<div class="dc-img-broken dc-v2-gallery-img"></div>'}${it.spoiler ? '<span class="dc-v2-spoiler-tag">SPOILER</span>' : ""}</div>`).join("")}</div>`;
  }

  function accessoryHtml(acc) {
    if (!acc) return "";
    if (acc.kind === "button") return buttons([acc]).replace("dc-action-row", "dc-v2-accessory-btn");
    return `<div class="dc-v2-thumb${acc.spoiler ? " spoiler" : ""}">${img(acc.url, "dc-v2-thumb-img") || '<div class="dc-img-broken dc-v2-thumb-img"></div>'}</div>`;
  }

  function v2Node(n) {
    switch (n && n.type) {
      case "text": return `<div class="dc-v2-text">${markdown(n.content || "")}</div>`;
      case "section": return `<div class="dc-v2-section"><div class="dc-v2-text">${markdown(n.content || "")}</div>${accessoryHtml(n.accessory)}</div>`;
      case "separator": return `<div class="dc-v2-sep ${n.spacing === "large" ? "large" : ""} ${n.divider === false ? "nodivider" : ""}"></div>`;
      case "gallery": return galleryHtml(n.items);
      case "buttons": return buttons(n.buttons || []);
      case "container": return `<div class="dc-v2-container${n.spoiler ? " spoiler" : ""}" style="--accent:${/^#[0-9a-f]{6}$/i.test(n.accentColor || "") ? n.accentColor : "transparent"}">${(n.children || []).map(v2Node).join("")}${n.spoiler ? '<div class="dc-v2-spoiler-cover">SPOILER</div>' : ""}</div>`;
      default: return "";
    }
  }

  /** Render a Components V2 layout ({ components: [...] }). */
  function layout(spec) {
    const comps = (spec && spec.components) || [];
    if (!comps.length) return '<div class="dc-muted">Empty layout</div>';
    return `<div class="dc-v2">${comps.map(v2Node).join("")}</div>`;
  }

  function message(m = {}) {
    const botName = m.botName || (window.AppState && AppState.currentProject && AppState.currentProject.name) || "Botify";
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const reply = m.command ? `<div class="dc-reply-bar"><img class="dc-reply-avatar" src="${SAMPLE_IMAGES["{user.avatar}"]}" alt=""/><span class="dc-mention-name">Wumpus</span> used <span class="dc-command-name">${escapeHtml(m.command)}</span></div>` : "";
    return `<div class="dc-message${m.ephemeral ? " dc-ephemeral" : ""}">
      ${reply}
      <div class="dc-message-main">
        <img class="dc-avatar" src="${m.botAvatar || SAMPLE_IMAGES["{bot.avatar}"]}" alt="" />
        <div class="dc-message-body">
          <div class="dc-header"><span class="dc-username">${escapeHtml(botName)}</span><span class="dc-bot-tag">APP</span><span class="dc-time">Today at ${time}</span></div>
          ${m.layout ? layout(m.layout) : ""}
          ${m.content && !m.layout ? `<div class="dc-content">${markdown(m.content)}</div>` : ""}
          ${(m.embeds || []).map(embed).join("")}
          ${m.buttons ? buttons(m.buttons) : ""}
          ${m.select ? select(m.select) : ""}
          ${m.ephemeral ? `<div class="dc-ephemeral-note">${icon("eye", 14)} Only you can see this • <span class="dc-link">Dismiss message</span></div>` : ""}
          ${m.note ? `<div class="dc-note">${escapeHtml(m.note)}</div>` : ""}
        </div>
      </div>
    </div>`;
  }

  function modal(m = {}) {
    const inputs = (m.inputs || []).slice(0, 5);
    return `<div class="dc-modal">
      <div class="dc-modal-header">
        <img class="dc-modal-icon" src="${SAMPLE_IMAGES["{bot.avatar}"]}" alt="" />
        <div class="dc-modal-title">${markdown(m.title || "Form", { inline: true })}</div>
        <span class="dc-modal-close">${icon("x", 18)}</span>
      </div>
      <div class="dc-modal-body">
        ${inputs.length ? inputs.map((inp) => `
          <div class="dc-modal-field">
            <div class="dc-modal-label">${markdown(inp.label || "Input", { inline: true })}${inp.required !== false ? '<span class="dc-required">*</span>' : ""}</div>
            <div class="dc-modal-input${inp.style === "paragraph" ? " dc-modal-textarea" : ""}">${inp.value ? `<span>${escapeHtml(inp.value)}</span>` : `<span class="dc-placeholder">${escapeHtml(inp.placeholder || "")}</span>`}</div>
            ${inp.maxLength ? `<div class="dc-modal-counter">0/${escapeHtml(inp.maxLength)}</div>` : ""}
          </div>`).join("") : '<div class="dc-muted">Add at least one text input.</div>'}
      </div>
      <div class="dc-modal-footer"><span class="dc-modal-cancel">Cancel</span><span class="dc-button dc-button-primary">Submit</span></div>
    </div>`;
  }

  function findEmbed(project, ref) {
    if (!ref || !project) return null;
    return (project.embeds || []).find((e) => e.id === ref) || (project.embeds || []).find((e) => e.name === ref) || null;
  }

  /** Preview for a BVS block, or null if the block does not send anything visible. */
  function forAction(a, ctx = {}) {
    const project = ctx.project || (window.AppState && AppState.currentProject);
    const command = ctx.command ? `/${ctx.command}` : null;
    const saved = findEmbed(project, a.embedRef);
    switch (a.type) {
      case "reply":
      case "send_message":
        return message({ content: a.content, embeds: saved ? [saved] : [], ephemeral: a.ephemeral, command });
      case "ephemeral_message":
        return message({ content: a.content, ephemeral: true, command });
      case "edit_reply":
        return message({ content: a.content, embeds: saved ? [saved] : [], note: "(edited)" });
      case "send_dm":
        return message({ content: a.content, embeds: saved ? [saved] : [], note: "Sent in Direct Messages" });
      case "create_embed":
        return message({ content: a.content, embeds: [a.embed || {}], ephemeral: a.ephemeral, command });
      case "send_saved_embed":
        return saved ? message({ content: a.content, embeds: [saved], ephemeral: a.ephemeral, command }) : '<div class="dc-muted preview-empty">Select a saved embed to see a preview.</div>';
      case "send_buttons":
      case "send_await_interaction":
        return message({ content: a.content, embeds: saved ? [saved] : [], buttons: a.buttons || a.components || [], command });
      case "send_select_menu":
        return message({ content: a.content, select: { placeholder: a.placeholder, options: a.options }, command });
      case "show_modal":
        return modal({ title: a.title, inputs: a.inputs });
      case "send_layout":
        return message({ layout: a.layout || { components: [] }, ephemeral: a.ephemeral, command });
      case "send_saved_layout": {
        const saved = project && (project.layouts || []).find((l) => l.id === a.layoutRef);
        return saved ? message({ layout: saved, ephemeral: a.ephemeral, command }) : '<div class="dc-muted preview-empty">Select a saved layout to see a preview.</div>';
      }
      default:
        return null;
    }
  }

  window.DiscordPreview = { markdown, embed, message, modal, buttons, select, forAction, avatarSvg, layout };
})();
