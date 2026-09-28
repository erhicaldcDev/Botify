/*
 * Components V2 ("message layouts") schema shared by the designer UI and the code generator.
 *
 * A layout is { components: [node, ...] } where a node is one of:
 *   container  { accentColor, spoiler, children: [node (not container)] }
 *   text       { content }
 *   section    { content, accessory: { kind: "thumbnail"|"button", url, description, spoiler, label, id, style, emoji } }
 *   separator  { divider, spacing: "small"|"large" }
 *   gallery    { items: [{ url, description, spoiler }] }
 *   buttons    { buttons: [{ label, id, style, emoji, url }] }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BotifyLayout = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const BUTTON_STYLES = [
    { value: "1", label: "Primary (blurple)" },
    { value: "2", label: "Secondary (grey)" },
    { value: "3", label: "Success (green)" },
    { value: "4", label: "Danger (red)" },
    { value: "5", label: "Link (opens URL)" },
  ];

  const TYPES = {
    container: {
      label: "Container", icon: "🗂️", description: "A box with an accent color that groups other components (like an embed).",
      fields: [
        { key: "accentColor", label: "Accent color", type: "color", default: "#5865f2" },
        { key: "spoiler", label: "Hide as spoiler", type: "checkbox", default: false },
      ],
      create: () => ({ type: "container", accentColor: "#5865f2", spoiler: false, children: [{ type: "text", content: "## New container\nWrite something here." }] }),
      summary: (n) => `${(n.children || []).length} item(s)`,
    },
    text: {
      label: "Text", icon: "📝", description: "Markdown text. Supports headings (#), lists, **bold**, links and {placeholders}.",
      fields: [{ key: "content", label: "Text (markdown)", type: "textarea", rows: 4, default: "Hello {user}!" }],
      create: () => ({ type: "text", content: "Hello {user}!" }),
      summary: (n) => n.content,
    },
    section: {
      label: "Section", icon: "🧾", description: "Text with a thumbnail or a button on the right.",
      fields: [
        { key: "content", label: "Text (markdown)", type: "textarea", rows: 3, default: "**Title**\nSome details" },
        { key: "accessory.kind", label: "Right side", type: "select", options: [{ value: "thumbnail", label: "Thumbnail image" }, { value: "button", label: "Button" }], default: "thumbnail" },
        { key: "accessory.url", label: "Image URL / link URL", type: "text", default: "{user.avatar}", placeholder: "https://... or {user.avatar}" },
        { key: "accessory.description", label: "Image alt text", type: "text", default: "", showIf: { key: "accessory.kind", value: "thumbnail" } },
        { key: "accessory.label", label: "Button label", type: "text", default: "Click me", showIf: { key: "accessory.kind", value: "button" } },
        { key: "accessory.id", label: "Button ID", type: "text", default: "section_btn", showIf: { key: "accessory.kind", value: "button" } },
        { key: "accessory.style", label: "Button style", type: "select", options: BUTTON_STYLES, default: "2", showIf: { key: "accessory.kind", value: "button" } },
        { key: "accessory.emoji", label: "Button emoji", type: "text", default: "", showIf: { key: "accessory.kind", value: "button" } },
      ],
      create: () => ({ type: "section", content: "**Title**\nSome details", accessory: { kind: "thumbnail", url: "{user.avatar}", description: "", spoiler: false, label: "Click me", id: "section_btn", style: "2", emoji: "" } }),
      summary: (n) => n.content,
    },
    separator: {
      label: "Separator", icon: "➖", description: "Vertical space, optionally with a divider line.",
      fields: [
        { key: "divider", label: "Show divider line", type: "checkbox", default: true },
        { key: "spacing", label: "Spacing", type: "select", options: [{ value: "small", label: "Small" }, { value: "large", label: "Large" }], default: "small" },
      ],
      create: () => ({ type: "separator", divider: true, spacing: "small" }),
      summary: (n) => `${n.divider !== false ? "line" : "space"} • ${n.spacing || "small"}`,
    },
    gallery: {
      label: "Media gallery", icon: "🖼️", description: "1-10 images shown in a grid.",
      fields: [{
        key: "items", label: "Images", type: "list", itemLabel: "Image", max: 10,
        item: [
          { key: "url", label: "Image URL", type: "text", default: "https://" },
          { key: "description", label: "Alt text", type: "text", default: "" },
          { key: "spoiler", label: "Spoiler", type: "checkbox", default: false },
        ],
        default: [{ url: "https://", description: "", spoiler: false }],
      }],
      create: () => ({ type: "gallery", items: [{ url: "https://", description: "", spoiler: false }] }),
      summary: (n) => `${(n.items || []).length} image(s)`,
    },
    buttons: {
      label: "Button row", icon: "🔘", description: "Up to 5 buttons. Use \"Wait for a click\" on the send block to react to them.",
      fields: [{
        key: "buttons", label: "Buttons", type: "list", itemLabel: "Button", max: 5,
        item: [
          { key: "label", label: "Label", type: "text", default: "Button" },
          { key: "id", label: "Button ID", type: "text", default: "btn" },
          { key: "style", label: "Style", type: "select", options: BUTTON_STYLES, default: "1" },
          { key: "emoji", label: "Emoji", type: "text", default: "" },
          { key: "url", label: "URL (Link style only)", type: "text", default: "" },
        ],
        default: [{ label: "Yes", id: "yes", style: "3", emoji: "", url: "" }, { label: "No", id: "no", style: "4", emoji: "", url: "" }],
      }],
      create: () => ({ type: "buttons", buttons: [{ label: "Yes", id: "yes", style: "3", emoji: "", url: "" }, { label: "No", id: "no", style: "4", emoji: "", url: "" }] }),
      summary: (n) => (n.buttons || []).map((b) => b.label).join(" | "),
    },
  };

  const LIMITS = { components: 40, text: 4000, gallery: 10, rowButtons: 5 };

  function countComponents(nodes) {
    let n = 0;
    (nodes || []).forEach((c) => {
      n += 1;
      if (c.type === "container") n += countComponents(c.children);
      if (c.type === "section") n += 2; // text display + accessory
      if (c.type === "buttons") n += (c.buttons || []).length;
    });
    return n;
  }

  function textLength(nodes) {
    let n = 0;
    (nodes || []).forEach((c) => {
      if (c.type === "text" || c.type === "section") n += String(c.content || "").length;
      if (c.type === "container") n += textLength(c.children);
    });
    return n;
  }

  /** Returns a list of human readable problems (empty = valid). */
  function validate(layout) {
    const problems = [];
    const comps = (layout && layout.components) || [];
    if (!comps.length) problems.push("Add at least one component.");
    const count = countComponents(comps);
    if (count > LIMITS.components) problems.push(`Too many components (${count}/${LIMITS.components}).`);
    const chars = textLength(comps);
    if (chars > LIMITS.text) problems.push(`Too much text (${chars}/${LIMITS.text} characters).`);
    const walk = (nodes, inContainer) => (nodes || []).forEach((c) => {
      if (c.type === "container") {
        if (inContainer) problems.push("Containers can't be nested.");
        if (!(c.children || []).length) problems.push("A container is empty.");
        walk(c.children, true);
      }
      if ((c.type === "text" || c.type === "section") && !String(c.content || "").trim()) problems.push(`A ${c.type} has no text.`);
      if (c.type === "gallery") {
        const items = (c.items || []).filter((i) => String(i.url || "").trim() && i.url !== "https://");
        if (!items.length) problems.push("A media gallery has no images.");
        if ((c.items || []).length > LIMITS.gallery) problems.push("A media gallery can have at most 10 images.");
      }
      if (c.type === "buttons" && !(c.buttons || []).length) problems.push("A button row is empty.");
      if (c.type === "buttons" && (c.buttons || []).length > LIMITS.rowButtons) problems.push("A button row can have at most 5 buttons.");
      if (c.type === "section" && c.accessory && c.accessory.kind === "thumbnail" && !String(c.accessory.url || "").trim()) problems.push("A section thumbnail has no image URL.");
    });
    walk(comps, false);
    return [...new Set(problems)];
  }

  /** Button ids that can be clicked (for "wait for click"). */
  function buttonIds(layout) {
    const ids = [];
    const walk = (nodes) => (nodes || []).forEach((c) => {
      if (c.type === "container") walk(c.children);
      if (c.type === "buttons") (c.buttons || []).forEach((b) => { if (String(b.style) !== "5" && b.id) ids.push(b.id); });
      if (c.type === "section" && c.accessory && c.accessory.kind === "button" && String(c.accessory.style) !== "5" && c.accessory.id) ids.push(c.accessory.id);
    });
    walk((layout && layout.components) || []);
    return ids;
  }

  const TEMPLATES = [
    {
      name: "Welcome card", icon: "👋",
      components: [{
        type: "container", accentColor: "#5865f2", spoiler: false, children: [
          { type: "section", content: "# Welcome, {user.name}! 🎉\nYou are member **#{server.members}** of **{server}**.", accessory: { kind: "thumbnail", url: "{user.avatar}", description: "avatar", spoiler: false, label: "", id: "", style: "2", emoji: "" } },
          { type: "separator", divider: true, spacing: "small" },
          { type: "text", content: "📜 Read the rules\n🎭 Pick your roles\n💬 Say hi in {channel}" },
          { type: "buttons", buttons: [{ label: "Rules", id: "rules", style: "1", emoji: "📜", url: "" }, { label: "Roles", id: "roles", style: "2", emoji: "🎭", url: "" }] },
        ],
      }],
    },
    {
      name: "Announcement", icon: "📢",
      components: [{
        type: "container", accentColor: "#faa61a", spoiler: false, children: [
          { type: "text", content: "-# 📢 ANNOUNCEMENT\n# Big update is here!\nWe just shipped a bunch of new features. Here's what's new:" },
          { type: "gallery", items: [{ url: "https://picsum.photos/seed/botify1/800/450", description: "", spoiler: false }] },
          { type: "text", content: "- ✨ New commands\n- 🎨 Better embeds\n- 🐛 Lots of fixes" },
          { type: "separator", divider: true, spacing: "large" },
          { type: "buttons", buttons: [{ label: "Read more", id: "", style: "5", emoji: "🔗", url: "https://discord.com" }] },
        ],
      }],
    },
    {
      name: "Profile card", icon: "🪪",
      components: [{
        type: "container", accentColor: "#3ba55c", spoiler: false, children: [
          { type: "section", content: "## {info.displayName}\n`{info.id}`", accessory: { kind: "thumbnail", url: "{info.avatar}", description: "", spoiler: false, label: "", id: "", style: "2", emoji: "" } },
          { type: "separator", divider: true, spacing: "small" },
          { type: "text", content: "**Account created:** {info.created}\n**Joined server:** {info.joined}\n**Roles:** {info.roles}" },
        ],
      }],
    },
    {
      name: "Shop item", icon: "🛒",
      components: [{
        type: "container", accentColor: "#eb459e", spoiler: false, children: [
          { type: "section", content: "## Golden Sword ⚔️\nA legendary blade.\n**Price:** 💰 500 coins", accessory: { kind: "button", url: "", description: "", spoiler: false, label: "Buy", id: "buy_sword", style: "3", emoji: "🛒" } },
          { type: "separator", divider: true, spacing: "small" },
          { type: "section", content: "## Magic Shield 🛡️\nBlocks one attack per day.\n**Price:** 💰 350 coins", accessory: { kind: "button", url: "", description: "", spoiler: false, label: "Buy", id: "buy_shield", style: "3", emoji: "🛒" } },
        ],
      }],
    },
    {
      name: "Rules", icon: "📜",
      components: [
        { type: "text", content: "# 📜 Server rules" },
        {
          type: "container", accentColor: "#ed4245", spoiler: false, children: [
            { type: "text", content: "### 1. Be respectful\nNo harassment, hate speech or discrimination." },
            { type: "separator", divider: true, spacing: "small" },
            { type: "text", content: "### 2. No spam\nDon't flood channels or mass-mention." },
            { type: "separator", divider: true, spacing: "small" },
            { type: "text", content: "### 3. Have fun!\n-# Breaking the rules may result in a ban." },
          ],
        },
        { type: "buttons", buttons: [{ label: "I accept", id: "accept_rules", style: "3", emoji: "✅", url: "" }] },
      ],
    },
    { name: "Blank", icon: "📄", components: [{ type: "text", content: "Hello {user}!" }] },
  ];

  return { TYPES, LIMITS, TEMPLATES, BUTTON_STYLES, validate, countComponents, textLength, buttonIds };
});
