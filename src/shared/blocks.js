/*
 * Botify block registry.
 *
 * Single source of truth for every Blueprint Visual Scripting (BVS) block:
 * the renderer uses it to build the palette, node pins and the inspector
 * forms, and the code generator (main process) uses it for defaults,
 * branch outputs and engine support checks.
 *
 * Works both as a browser <script> (exposes window.BotifyBlocks) and as a
 * CommonJS module.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BotifyBlocks = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ALL = ["node", "python", "lua"];
  const NODE_PY = ["node", "python"];

  const CATEGORIES = [
    { id: "message", label: "Messages", color: "#5865f2", icon: "💬" },
    { id: "interactive", label: "Interactive (Buttons, Menus, Modals)", color: "#eb459e", icon: "🧩" },
    { id: "layout", label: "Components V2 Layouts", color: "#00a8fc", icon: "🧱" },
    { id: "moderation", label: "Moderation", color: "#ed4245", icon: "🛡️" },
    { id: "logic", label: "Logic & Flow", color: "#3ba55c", icon: "🔀" },
    { id: "data", label: "Variables & Data", color: "#faa61a", icon: "📦" },
    { id: "bot", label: "Bot & Advanced", color: "#99aab5", icon: "⚙️" },
    { id: "plugin", label: "Plugin Blocks", color: "#00b0f4", icon: "🔌" },
  ];

  const BUTTON_STYLES = [
    { value: "1", label: "Primary (blurple)" },
    { value: "2", label: "Secondary (grey)" },
    { value: "3", label: "Success (green)" },
    { value: "4", label: "Danger (red)" },
    { value: "5", label: "Link (opens URL)" },
  ];

  const PERMISSIONS = [
    "Administrator", "ManageGuild", "ManageRoles", "ManageChannels", "ManageMessages",
    "KickMembers", "BanMembers", "ModerateMembers", "ManageNicknames", "MentionEveryone",
    "ViewAuditLog", "SendMessages", "AttachFiles", "EmbedLinks",
  ].map((p) => ({ value: p, label: p.replace(/([a-z])([A-Z])/g, "$1 $2") }));

  const OPERATORS = [
    { value: "==", label: "equals" },
    { value: "!=", label: "does not equal" },
    { value: ">", label: "is greater than" },
    { value: "<", label: "is less than" },
    { value: ">=", label: "is greater or equal" },
    { value: "<=", label: "is less or equal" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "is_empty", label: "is empty" },
    { value: "not_empty", label: "is not empty" },
  ];

  const f = {
    content: (def = "Hello {user}!") => ({ key: "content", label: "Message content", type: "textarea", default: def, placeholder: "Supports {user}, {server}, {variable} placeholders and **markdown**" }),
    channel: () => ({ key: "channelId", label: "Channel (optional)", type: "text", default: "", placeholder: "Channel ID or {variable} - empty = current channel" }),
    target: (label = "Target member") => ({ key: "target", label, type: "text", default: "", placeholder: "Empty = first user argument / mention, else user ID or {variable}" }),
    ephemeral: () => ({ key: "ephemeral", label: "Only visible to the user (ephemeral, slash commands only)", type: "checkbox", default: false }),
    saveTo: (def, label = "Save result to variable") => ({ key: "saveTo", label, type: "variable", default: def }),
    embedRef: () => ({ key: "embedRef", label: "Attach saved embed (optional)", type: "embedRef", default: "" }),
    reason: (def) => ({ key: "reason", label: "Reason", type: "text", default: def }),
  };

  const BLOCKS = [
    // ---------------------------------------------------------------- Messages
    {
      type: "reply", label: "Reply", icon: "↩️", category: "message", engines: ALL,
      description: "Reply to the command / message that triggered this flow.",
      fields: [f.content("Hello {user}!"), f.embedRef(), f.ephemeral()],
      summary: (a) => a.content,
    },
    {
      type: "send_message", label: "Send Message", icon: "💬", category: "message", engines: ALL,
      description: "Send a message to the current channel or a specific channel.",
      fields: [f.content("Hello!"), f.channel(), f.embedRef(), f.ephemeral(), f.saveTo("", "Save sent message to variable (optional)")],
      summary: (a) => a.content,
    },
    {
      type: "create_embed", label: "Send Embed", icon: "📋", category: "message", engines: ALL,
      description: "Design a rich embed and send it.",
      fields: [
        { key: "embed", label: "Embed", type: "embed", default: { title: "New embed", description: "Hello {user}!", color: "#5865f2", fields: [] } },
        { key: "content", label: "Text above embed (optional)", type: "text", default: "" },
        f.channel(), f.ephemeral(),
      ],
      summary: (a) => (a.embed && (a.embed.title || a.embed.description)) || "Embed",
    },
    {
      type: "send_saved_embed", label: "Send Saved Embed", icon: "🗂️", category: "message", engines: ALL,
      description: "Send one of the embeds designed in the Embed Styler.",
      fields: [
        { key: "embedRef", label: "Saved embed", type: "embedRef", default: "" },
        { key: "content", label: "Text above embed (optional)", type: "text", default: "" },
        f.channel(), f.ephemeral(),
      ],
      summary: (a) => a.embedRef ? `Embed: ${a.embedRef}` : "No embed selected",
    },
    {
      type: "ephemeral_message", label: "Hidden Reply", icon: "👻", category: "message", engines: NODE_PY,
      description: "Reply with a message only the user can see (slash commands).",
      fields: [f.content("Only you can see this.")],
      summary: (a) => a.content,
    },
    {
      type: "send_dm", label: "Send DM", icon: "📩", category: "message", engines: ALL,
      description: "Send a direct message to a user.",
      fields: [f.target("Recipient (empty = command user)"), f.content("Hello in DMs!"), f.embedRef()],
      summary: (a) => a.content,
    },
    {
      type: "edit_reply", label: "Edit Last Reply", icon: "✏️", category: "message", engines: NODE_PY,
      description: "Edit the last message the bot sent in this flow.",
      fields: [f.content("Updated!"), f.embedRef()],
      summary: (a) => a.content,
    },
    {
      type: "delete_message", label: "Delete Message", icon: "🗑️", category: "message", engines: ALL,
      description: "Delete the triggering message (prefix) or the bot reply (slash).",
      fields: [],
    },
    {
      type: "add_reaction", label: "Add Reaction", icon: "😀", category: "message", engines: ALL,
      description: "React to the triggering message or the last bot reply.",
      fields: [{ key: "emoji", label: "Emoji (unicode or custom <:name:id>)", type: "text", default: "✅" }],
      summary: (a) => a.emoji,
    },

    // ------------------------------------------------------------ Interactive
    {
      type: "send_buttons", label: "Buttons", icon: "🔘", category: "interactive", engines: NODE_PY,
      description: "Send a message with buttons and wait for a click. The clicked button ID is saved to a variable ('timeout' if nobody clicks).",
      fields: [
        f.content("Choose an option:"),
        f.embedRef(),
        {
          key: "buttons", label: "Buttons", type: "list", itemLabel: "Button", max: 25,
          default: [{ label: "Yes", id: "yes", style: "3", emoji: "", url: "" }, { label: "No", id: "no", style: "4", emoji: "", url: "" }],
          item: [
            { key: "label", label: "Label", type: "text", default: "Button" },
            { key: "id", label: "Button ID", type: "text", default: "btn" },
            { key: "style", label: "Style", type: "select", options: BUTTON_STYLES, default: "1" },
            { key: "emoji", label: "Emoji", type: "text", default: "" },
            { key: "url", label: "URL (Link style only)", type: "text", default: "" },
          ],
        },
        { key: "timeout", label: "Wait time (seconds)", type: "number", default: 60 },
        { key: "onlyAuthor", label: "Only the command user can click", type: "checkbox", default: true },
        f.saveTo("clicked", "Save clicked button ID to"),
      ],
      summary: (a) => (a.buttons || []).map((b) => b.label).join(" | "),
    },
    {
      type: "send_select_menu", label: "Select Menu", icon: "🔽", category: "interactive", engines: NODE_PY,
      description: "Send a dropdown menu and wait for a choice. The chosen value is saved to a variable.",
      fields: [
        f.content("Pick an option:"),
        { key: "placeholder", label: "Placeholder", type: "text", default: "Make a selection..." },
        {
          key: "options", label: "Options", type: "list", itemLabel: "Option", max: 25,
          default: [{ label: "Option A", value: "a", description: "", emoji: "" }, { label: "Option B", value: "b", description: "", emoji: "" }],
          item: [
            { key: "label", label: "Label", type: "text", default: "Option" },
            { key: "value", label: "Value", type: "text", default: "value" },
            { key: "description", label: "Description", type: "text", default: "" },
            { key: "emoji", label: "Emoji", type: "text", default: "" },
          ],
        },
        { key: "minValues", label: "Min choices", type: "number", default: 1 },
        { key: "maxValues", label: "Max choices", type: "number", default: 1 },
        { key: "timeout", label: "Wait time (seconds)", type: "number", default: 60 },
        f.saveTo("selected", "Save selected value to"),
      ],
      summary: (a) => a.placeholder,
    },
    {
      type: "show_modal", label: "Modal Form", icon: "📝", category: "interactive", engines: NODE_PY,
      description: "Open a pop-up form (modal) with up to 5 text inputs. Values are saved as {form.input_id}. In prefix commands a button is shown first.",
      fields: [
        { key: "title", label: "Modal title", type: "text", default: "Feedback form" },
        {
          key: "inputs", label: "Text inputs (max 5)", type: "list", itemLabel: "Input", max: 5,
          default: [{ id: "name", label: "Your name", style: "short", placeholder: "", required: true, minLength: "", maxLength: "", value: "" }],
          item: [
            { key: "label", label: "Label", type: "text", default: "Question" },
            { key: "id", label: "Input ID", type: "text", default: "answer" },
            { key: "style", label: "Style", type: "select", options: [{ value: "short", label: "Short (one line)" }, { value: "paragraph", label: "Paragraph" }], default: "short" },
            { key: "placeholder", label: "Placeholder", type: "text", default: "" },
            { key: "value", label: "Pre-filled value", type: "text", default: "" },
            { key: "required", label: "Required", type: "checkbox", default: true },
            { key: "minLength", label: "Min length", type: "number", default: "" },
            { key: "maxLength", label: "Max length", type: "number", default: "" },
          ],
        },
        { key: "timeout", label: "Wait time (seconds)", type: "number", default: 300 },
        f.saveTo("form", "Save answers to"),
      ],
      summary: (a) => a.title,
    },
    {
      type: "defer_reply", label: "Defer (Thinking...)", icon: "⏳", category: "interactive", engines: NODE_PY,
      description: "Show 'Bot is thinking...' - use before slow actions (API requests) so the interaction does not time out.",
      fields: [f.ephemeral()],
    },

    // ------------------------------------------------------- Components V2
    {
      type: "send_layout", label: "Send Layout (V2)", icon: "🧱", category: "layout", engines: NODE_PY,
      description: "Send a Components V2 message: containers, sections, images, separators and buttons. Can wait for a button click.",
      fields: [
        {
          key: "layout", label: "Layout", type: "layout",
          default: { components: [{ type: "container", accentColor: "#5865f2", spoiler: false, children: [
            { type: "text", content: "## Hello {user.name}!\nThis is a **Components V2** message." },
            { type: "separator", divider: true, spacing: "small" },
            { type: "buttons", buttons: [{ label: "Nice!", id: "nice", style: "1", emoji: "✨", url: "" }] },
          ] }] },
        },
        f.channel(), f.ephemeral(),
        { key: "wait", label: "Wait for a button click", type: "checkbox", default: false },
        { key: "timeout", label: "Wait time (seconds)", type: "number", default: 60, showIf: { key: "wait", value: true } },
        { key: "onlyAuthor", label: "Only the command user can click", type: "checkbox", default: true, showIf: { key: "wait", value: true } },
        { key: "saveTo", label: "Save clicked button ID to", type: "variable", default: "clicked", showIf: { key: "wait", value: true } },
      ],
      summary: (a) => `${((a.layout && a.layout.components) || []).length} component(s)${a.wait ? " • waits for click" : ""}`,
    },
    {
      type: "send_saved_layout", label: "Send Saved Layout", icon: "🗃️", category: "layout", engines: NODE_PY,
      description: "Send a layout designed on the Layouts page.",
      fields: [
        { key: "layoutRef", label: "Saved layout", type: "layoutRef", default: "" },
        f.channel(), f.ephemeral(),
        { key: "wait", label: "Wait for a button click", type: "checkbox", default: false },
        { key: "timeout", label: "Wait time (seconds)", type: "number", default: 60, showIf: { key: "wait", value: true } },
        { key: "onlyAuthor", label: "Only the command user can click", type: "checkbox", default: true, showIf: { key: "wait", value: true } },
        { key: "saveTo", label: "Save clicked button ID to", type: "variable", default: "clicked", showIf: { key: "wait", value: true } },
      ],
      summary: (a) => (a.layoutRef ? "Saved layout" : "No layout selected") + (a.wait ? " • waits for click" : ""),
    },

    // ------------------------------------------------------------- Moderation
    {
      type: "kick_member", label: "Kick Member", icon: "👢", category: "moderation", engines: ALL,
      fields: [f.target(), f.reason("Kicked by bot")],
      summary: (a) => a.reason,
    },
    {
      type: "ban_member", label: "Ban Member", icon: "🔨", category: "moderation", engines: ALL,
      fields: [f.target(), f.reason("Banned by bot"), { key: "deleteDays", label: "Delete message history (days, 0-7)", type: "number", default: 0 }],
      summary: (a) => a.reason,
    },
    {
      type: "timeout_member", label: "Timeout Member", icon: "🔇", category: "moderation", engines: NODE_PY,
      fields: [f.target(), { key: "minutes", label: "Duration (minutes)", type: "number", default: 10 }, f.reason("Timed out by bot")],
      summary: (a) => `${a.minutes} min`,
    },
    {
      type: "add_role", label: "Add Role", icon: "🛡️", category: "moderation", engines: ALL,
      fields: [{ key: "roleId", label: "Role ID", type: "text", default: "", placeholder: "Role ID or {variable}" }, f.target("Member (empty = command user)")],
      summary: (a) => a.roleId,
    },
    {
      type: "remove_role", label: "Remove Role", icon: "🚫", category: "moderation", engines: ALL,
      fields: [{ key: "roleId", label: "Role ID", type: "text", default: "", placeholder: "Role ID or {variable}" }, f.target("Member (empty = command user)")],
      summary: (a) => a.roleId,
    },
    {
      type: "set_nickname", label: "Set Nickname", icon: "🏷️", category: "moderation", engines: NODE_PY,
      fields: [f.target("Member (empty = command user)"), { key: "nickname", label: "New nickname (empty = reset)", type: "text", default: "" }],
      summary: (a) => a.nickname,
    },
    {
      type: "purge_messages", label: "Purge Messages", icon: "🧹", category: "moderation", engines: NODE_PY,
      fields: [{ key: "amount", label: "Amount (1-100)", type: "text", default: "10", placeholder: "Number or {variable}" }],
      summary: (a) => `${a.amount} messages`,
    },
    {
      type: "check_permission", label: "Check Permission", icon: "🔒", category: "moderation", engines: ALL,
      description: "Branch on whether the user has a permission. If the Denied branch is empty, a message is sent and the flow stops.",
      outputs: ["then", "else", "next"], pinLabels: { then: "Allowed", else: "Denied" },
      fields: [
        { key: "permission", label: "Permission", type: "select", options: PERMISSIONS, default: "Administrator" },
        { key: "denyMessage", label: "Message when denied (if Denied branch is empty)", type: "text", default: "You don't have permission to do that." },
      ],
      summary: (a) => a.permission,
    },
    {
      type: "has_role", label: "Has Role?", icon: "👤", category: "moderation", engines: ALL,
      description: "Branch on whether a member has a role. If the No branch is empty, a message is sent and the flow stops.",
      outputs: ["then", "else", "next"], pinLabels: { then: "Yes", else: "No" },
      fields: [
        { key: "roleId", label: "Role ID", type: "text", default: "" },
        f.target("Member (empty = command user)"),
        { key: "denyMessage", label: "Message when missing (if No branch is empty)", type: "text", default: "You are missing the required role." },
      ],
      summary: (a) => a.roleId,
    },

    // ------------------------------------------------------------------ Logic
    {
      type: "if_condition", label: "If / Else", icon: "❓", category: "logic", engines: ALL,
      description: "Compare two values. Use the advanced expression for custom code conditions.",
      outputs: ["then", "else", "next"], pinLabels: { then: "True", else: "False" },
      fields: [
        { key: "left", label: "Value", type: "text", default: "", placeholder: "e.g. {clicked} or {user.name}" },
        { key: "operator", label: "Operator", type: "select", options: OPERATORS, default: "==" },
        { key: "right", label: "Compare to", type: "text", default: "", placeholder: "e.g. yes" },
        { key: "condition", label: "Advanced: raw code expression (overrides above)", type: "code", default: "", placeholder: "e.g. member.user.bot" },
      ],
      summary: (a) => a.condition ? a.condition : `${a.left || ""} ${(OPERATORS.find((o) => o.value === a.operator) || { label: a.operator || "" }).label} ${a.right || ""}`,
    },
    {
      type: "random_chance", label: "Random Chance", icon: "🎲", category: "logic", engines: ALL,
      outputs: ["then", "else", "next"], pinLabels: { then: "Hit", else: "Miss" },
      fields: [{ key: "chance", label: "Chance (%)", type: "number", default: 50 }],
      summary: (a) => `${a.chance}%`,
    },
    {
      type: "loop", label: "Repeat", icon: "🔁", category: "logic", engines: ALL,
      description: "Run the Loop branch several times. The current iteration number is stored in the variable.",
      outputs: ["body", "next"], pinLabels: { body: "Loop", next: "Done" },
      fields: [
        { key: "times", label: "Times", type: "text", default: "3", placeholder: "Number or {variable}" },
        { key: "variable", label: "Counter variable", type: "variable", default: "i" },
      ],
      summary: (a) => `${a.times}×`,
    },
    {
      type: "cooldown", label: "User Cooldown", icon: "⏱️", category: "logic", engines: NODE_PY,
      description: "Stop the flow if the user used it less than N seconds ago.",
      fields: [
        { key: "time", label: "Cooldown (seconds)", type: "number", default: 5 },
        { key: "message", label: "Message while on cooldown", type: "text", default: "Slow down! Try again in {remaining}s." },
      ],
      summary: (a) => `${a.time}s`,
    },
    {
      type: "wait", label: "Wait", icon: "⏲️", category: "logic", engines: ALL,
      fields: [{ key: "time", label: "Delay (milliseconds)", type: "number", default: 1000 }],
      summary: (a) => `${a.time} ms`,
    },
    {
      type: "stop", label: "Stop", icon: "⛔", category: "logic", engines: ALL,
      description: "Stop running this flow.",
      outputs: [],
      fields: [],
    },

    // ------------------------------------------------------------------- Data
    {
      type: "set_variable", label: "Set Variable", icon: "📦", category: "data", engines: ALL,
      fields: [
        { key: "name", label: "Variable name", type: "variable", default: "myVar" },
        { key: "mode", label: "Value type", type: "select", options: [{ value: "text", label: "Text (supports {placeholders})" }, { value: "number", label: "Number" }, { value: "expression", label: "Code expression" }], default: "text" },
        { key: "value", label: "Value", type: "text", default: "" },
      ],
      summary: (a) => `${a.name} = ${a.value}`,
    },
    {
      type: "math", label: "Change Number", icon: "➕", category: "data", engines: ALL,
      fields: [
        { key: "name", label: "Variable", type: "variable", default: "count" },
        { key: "op", label: "Operation", type: "select", options: [{ value: "+", label: "Add" }, { value: "-", label: "Subtract" }, { value: "*", label: "Multiply" }, { value: "/", label: "Divide" }, { value: "=", label: "Set to" }], default: "+" },
        { key: "amount", label: "Amount", type: "text", default: "1" },
      ],
      summary: (a) => `${a.name} ${a.op} ${a.amount}`,
    },
    {
      type: "random_number", label: "Random Number", icon: "🔢", category: "data", engines: ALL,
      fields: [
        { key: "min", label: "Min", type: "number", default: 1 },
        { key: "max", label: "Max", type: "number", default: 100 },
        f.saveTo("number"),
      ],
      summary: (a) => `${a.min}-${a.max} → ${a.saveTo}`,
    },
    {
      type: "random_choice", label: "Random Choice", icon: "🎰", category: "data", engines: ALL,
      fields: [
        { key: "choices", label: "Choices (one per line)", type: "textarea", default: "Heads\nTails" },
        f.saveTo("choice"),
      ],
      summary: (a) => `→ ${a.saveTo}`,
    },
    {
      type: "get_user_info", label: "Get User Info", icon: "🆔", category: "data", engines: ALL,
      description: "Stores {info.name}, {info.id}, {info.mention}, {info.avatar}, {info.created}, {info.joined}.",
      fields: [f.target("User (empty = command user)"), f.saveTo("info")],
      summary: (a) => `→ ${a.saveTo || "userInfo"}`,
    },
    {
      type: "api_request", label: "HTTP Request", icon: "🌐", category: "data", engines: NODE_PY,
      description: "Call a web API. JSON responses are parsed ({apiData.field}).",
      fields: [
        { key: "url", label: "URL", type: "text", default: "https://api.example.com" },
        { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => ({ value: m, label: m })), default: "GET" },
        { key: "headers", label: "Headers (JSON, optional)", type: "code", default: "" },
        { key: "body", label: "Body (optional)", type: "code", default: "" },
        f.saveTo("apiData"),
      ],
      summary: (a) => `${a.method || "GET"} ${a.url}`,
    },
    {
      type: "kv_set", label: "Save Data", icon: "💾", category: "data", engines: NODE_PY,
      description: "Save a value permanently (built-in key/value storage).",
      fields: [
        { key: "key", label: "Key", type: "text", default: "points_{user.id}" },
        { key: "value", label: "Value", type: "text", default: "{points}" },
      ],
      summary: (a) => `${a.key} = ${a.value}`,
    },
    {
      type: "kv_get", label: "Load Data", icon: "📂", category: "data", engines: NODE_PY,
      description: "Load a value saved with Save Data.",
      fields: [
        { key: "key", label: "Key", type: "text", default: "points_{user.id}" },
        { key: "default", label: "Default if missing", type: "text", default: "0" },
        f.saveTo("points"),
      ],
      summary: (a) => `${a.key} → ${a.saveTo}`,
    },
    {
      type: "db_read", label: "SQL Read", icon: "📖", category: "data", engines: NODE_PY,
      description: "Run a SELECT query. Rows are stored in the variable (list).",
      fields: [
        { key: "query", label: "SQL query", type: "code", default: "SELECT * FROM data" },
        { key: "params", label: "Parameters (code expressions, one per ?)", type: "params", default: [] },
        f.saveTo("rows"),
      ],
      summary: (a) => a.query,
    },
    {
      type: "db_write", label: "SQL Write", icon: "✏️", category: "data", engines: NODE_PY,
      fields: [
        { key: "query", label: "SQL query", type: "code", default: "INSERT INTO data (key, value) VALUES (?, ?)" },
        { key: "params", label: "Parameters (code expressions, one per ?)", type: "params", default: [] },
      ],
      summary: (a) => a.query,
    },
    {
      type: "mention_user", label: "Mention User", icon: "@", category: "data", engines: NODE_PY, hidden: true,
      fields: [{ key: "userId", label: "User ID", type: "text", default: "{user.id}" }, f.saveTo("mention", "Save to variable")],
    },
    {
      type: "mention_role", label: "Mention Role", icon: "🏷️", category: "data", engines: NODE_PY, hidden: true,
      fields: [{ key: "roleId", label: "Role ID", type: "text", default: "" }, f.saveTo("mention", "Save to variable")],
    },
    {
      type: "mention_channel", label: "Mention Channel", icon: "#", category: "data", engines: NODE_PY, hidden: true,
      fields: [{ key: "channelId", label: "Channel ID", type: "text", default: "{channel.id}" }, f.saveTo("mention", "Save to variable")],
    },

    // -------------------------------------------------------------------- Bot
    {
      type: "set_status", label: "Set Bot Status", icon: "🎭", category: "bot", engines: ALL,
      fields: [
        { key: "text", label: "Activity text", type: "text", default: "with Botify" },
        { key: "statusType", label: "Activity type", type: "select", options: ["Playing", "Streaming", "Listening", "Watching", "Competing"].map((v) => ({ value: v, label: v })), default: "Playing" },
        { key: "status", label: "Status", type: "select", options: [{ value: "online", label: "Online" }, { value: "idle", label: "Idle" }, { value: "dnd", label: "Do Not Disturb" }, { value: "invisible", label: "Invisible" }], default: "online" },
      ],
      summary: (a) => `${a.statusType} ${a.text}`,
    },
    {
      type: "log", label: "Console Log", icon: "🖨️", category: "bot", engines: ALL,
      fields: [{ key: "message", label: "Message", type: "text", default: "Command used by {user.name}" }],
      summary: (a) => a.message,
    },
    {
      type: "raw_code", label: "Custom Code", icon: "🧑‍💻", category: "bot", engines: ALL,
      description: "Insert raw code for the selected engine (JavaScript / Python / Lua).",
      fields: [{ key: "code", label: "Code", type: "code", default: "// your code here", rows: 10 }],
      summary: (a) => (a.code || "").split("\n")[0],
    },
  ];

  // Legacy block kept so old projects/plugins still compile.
  const ALIASES = { send_await_interaction: "send_buttons" };

  const TRIGGER_VARIABLES = {
    command: ["user", "member", "guild", "channel", "server"],
    on_ready: ["client"],
    on_message: ["message", "user", "member", "guild", "channel"],
    on_message_delete: ["message", "user", "guild", "channel"],
    on_message_update: ["message", "oldMessage", "user", "guild", "channel"],
    on_member_join: ["member", "user", "guild", "server"],
    on_member_leave: ["member", "user", "guild", "server"],
    on_reaction_add: ["reaction", "message", "user", "guild", "channel", "emoji"],
    on_reaction_remove: ["reaction", "message", "user", "guild", "channel", "emoji"],
    on_guild_join: ["guild", "server"],
    on_interaction: ["interaction", "user", "guild", "channel"],
  };

  const EVENTS = [
    { type: "on_ready", label: "Bot Ready", icon: "🟢", description: "Fires once when the bot connects to Discord." },
    { type: "on_message", label: "Message Sent", icon: "💬", description: "Fires for every message the bot can see (needs Message Content intent)." },
    { type: "on_message_delete", label: "Message Deleted", icon: "🗑️", description: "Fires when a cached message is deleted." },
    { type: "on_message_update", label: "Message Edited", icon: "✏️", description: "Fires when a message is edited." },
    { type: "on_member_join", label: "Member Joined", icon: "👋", description: "Fires when a new member joins (needs Server Members intent)." },
    { type: "on_member_leave", label: "Member Left", icon: "🚪", description: "Fires when a member leaves the server." },
    { type: "on_reaction_add", label: "Reaction Added", icon: "😀", description: "Fires when a reaction is added to a message." },
    { type: "on_reaction_remove", label: "Reaction Removed", icon: "🙃", description: "Fires when a reaction is removed from a message." },
    { type: "on_guild_join", label: "Bot Added To Server", icon: "🏠", description: "Fires when the bot joins a new server." },
    { type: "on_interaction", label: "Any Interaction", icon: "⚡", description: "Fires for every interaction (commands, buttons, menus)." },
  ];

  const PLACEHOLDERS = [
    { token: "{user}", desc: "Mention of the user" },
    { token: "{user.name}", desc: "Username" },
    { token: "{user.id}", desc: "User ID" },
    { token: "{user.avatar}", desc: "Avatar URL" },
    { token: "{server}", desc: "Server name" },
    { token: "{server.members}", desc: "Member count" },
    { token: "{server.icon}", desc: "Server icon URL" },
    { token: "{channel}", desc: "Channel mention" },
    { token: "{channel.name}", desc: "Channel name" },
    { token: "{bot.name}", desc: "Bot username" },
    { token: "{date}", desc: "Current date" },
    { token: "{time}", desc: "Current time" },
    { token: "{myVar}", desc: "Any variable / argument / {form.field}" },
  ];

  const registry = new Map(BLOCKS.map((b) => [b.type, b]));

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  function getBlock(type) {
    return registry.get(ALIASES[type] || type) || null;
  }

  function outputsOf(type, extraBlocks) {
    const b = getBlock(type) || (extraBlocks || []).find((x) => x.type === type);
    if (!b) return ["next"];
    return b.outputs || b.pins || ["next"];
  }

  function createDefault(type, extraBlocks) {
    const b = getBlock(type) || (extraBlocks || []).find((x) => x.type === type);
    const data = { type };
    ((b && b.fields) || []).forEach((fd) => {
      if (fd.default !== undefined) data[fd.key] = clone(fd.default);
    });
    return data;
  }

  function supports(type, engine) {
    const b = getBlock(type);
    if (!b) return engine === "node";
    return (b.engines || ALL).includes(engine);
  }

  return {
    CATEGORIES, BLOCKS, EVENTS, PLACEHOLDERS, TRIGGER_VARIABLES, OPERATORS, PERMISSIONS, BUTTON_STYLES, ALIASES,
    getBlock, outputsOf, createDefault, supports,
  };
});
