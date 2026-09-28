const crypto = require("crypto");
const Blocks = require("../src/shared/blocks");
const Layout = require("../src/shared/layout");

const uid = () => crypto.randomUUID();

const DEFAULT_SETTINGS = {
    intents: { messageContent: true, members: true, presences: false },
    devGuildId: "",
};

function starterCommands(engine) {
    const cmds = [
        {
            id: uid(), type: "slash", name: "ping", description: "Check if the bot is alive", cooldown: 0, permissions: [], arguments: [],
            actions: [{ type: "reply", content: "🏓 Pong, {user}!", ephemeral: false }],
        },
        {
            id: uid(), type: "slash", name: "userinfo", description: "Show information about a user", cooldown: 3, permissions: [],
            arguments: [{ name: "member", type: "user", description: "Who to look up", required: false }],
            actions: [
                { type: "get_user_info", target: "{member}", saveTo: "info" },
                {
                    type: "create_embed", content: "",
                    embed: {
                        title: "👤 {info.displayName}", color: "#5865f2", thumbnail: "{info.avatar}", description: "",
                        fields: [
                            { name: "ID", value: "{info.id}", inline: true },
                            { name: "Account created", value: "{info.created}", inline: true },
                            { name: "Joined server", value: "{info.joined}", inline: true },
                        ],
                        footer: "Requested by {user.name}", timestamp: true,
                    },
                },
            ],
        },
    ];
    if (engine !== "lua") {
        cmds.push({
            id: uid(), type: "slash", name: "feedback", description: "Send feedback using a pop-up form", cooldown: 10, permissions: [], arguments: [],
            actions: [
                {
                    type: "show_modal", title: "Send us feedback", saveTo: "form", timeout: 300,
                    inputs: [
                        { id: "topic", label: "Topic", style: "short", placeholder: "What is it about?", required: true, minLength: "", maxLength: "100", value: "" },
                        { id: "details", label: "Details", style: "paragraph", placeholder: "Tell us more...", required: true, minLength: "10", maxLength: "1000", value: "" },
                    ],
                },
                {
                    type: "send_buttons", content: "Send this feedback?", saveTo: "clicked", timeout: 60, onlyAuthor: true,
                    buttons: [{ label: "Send", id: "send", style: "3", emoji: "✅", url: "" }, { label: "Cancel", id: "cancel", style: "4", emoji: "✖️", url: "" }],
                },
                {
                    type: "if_condition", left: "{clicked}", operator: "==", right: "send", condition: "",
                    then: [{
                        type: "create_embed", content: "",
                        embed: { title: "📨 {form.topic}", description: "{form.details}", color: "#43b581", footer: "Feedback from {user.name}", timestamp: true, fields: [] },
                    }],
                    else: [{ type: "reply", content: "Cancelled.", ephemeral: true }],
                },
            ],
        });
    }
    // Discordia (Lua) has no slash commands.
    if (engine === "lua") cmds.forEach((c) => { c.type = "prefix"; });
    return cmds;
}

function defaultEvents(template) {
    return Blocks.EVENTS.map((e) => {
        const evt = { type: e.type, enabled: e.type === "on_ready", actions: [] };
        if (template === "starter" && e.type === "on_ready") {
            evt.actions = [{ type: "set_status", text: "/help", statusType: "Listening", status: "online" }];
        }
        if (template === "starter" && e.type === "on_member_join") {
            evt.actions = [{ type: "send_message", content: "👋 Welcome {user} to **{server}**! You are member #{server.members}.", channelId: "" }];
        }
        return evt;
    });
}

function createProject(data) {
    const now = new Date().toISOString();
    const engine = ["node", "python", "lua"].includes(data.engine) ? data.engine : "node";
    const template = data.template || "starter";
    return {
        id: uid(),
        name: String(data.name || "My Bot").slice(0, 64),
        engine,
        token: null,
        prefix: data.prefix || "!",
        commands: template === "starter" ? starterCommands(engine) : [],
        events: defaultEvents(template),
        embeds: template === "starter" ? [{
            id: uid(), name: "Welcome", title: "Welcome to {server}!", description: "Hey {user}, glad to have you here. 🎉\nRead the rules and have fun!",
            color: "#5865f2", thumbnail: "{user.avatar}", image: "", footer: "{server} • member #{server.members}", footerIcon: "", timestamp: true,
            authorName: "", authorIcon: "", authorUrl: "", url: "", fields: [],
        }] : [],
        layouts: template === "starter"
            ? [{ id: uid(), name: "Welcome card", components: JSON.parse(JSON.stringify(Layout.TEMPLATES.find((t) => t.name === "Welcome card").components)) }]
            : [],
        database: { type: "sqlite", tables: [] },
        plugins: [],
        settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
        helpSettings: template === "starter" ? {
            enabled: true, title: "Help Center", description: "Pick a category below to see its commands.", color: "#5865f2", style: "select", footer: "",
            categories: [{ name: "General", icon: "🌐", commands: engine === "lua" ? ["ping", "userinfo"] : ["ping", "userinfo", "feedback"] }],
        } : undefined,
        createdAt: now,
        updatedAt: now,
    };
}

/** Bring a project saved by an older Botify version up to the current shape (non-destructive). */
function migrateProject(p) {
    const project = { ...p };
    project.commands = (project.commands || []).filter(Boolean).map((c) => {
        const cmd = { type: "slash", cooldown: 0, permissions: [], arguments: [], actions: [], ...c };
        cmd.id = cmd.id || uid();
        cmd.name = cmd.name || "command";
        if (!cmd.description || cmd.description === "Compiled BVS Logic") cmd.description = "";
        return cmd;
    });

    const events = Array.isArray(project.events) ? project.events.slice() : [];
    Blocks.EVENTS.forEach((e) => {
        if (!events.some((x) => x.type === e.type)) events.push({ type: e.type, enabled: false, actions: [] });
    });
    project.events = events.map((e) => ({ actions: [], ...e }));

    project.embeds = (project.embeds || []).map((e, i) => ({ ...e, id: e.id || uid(), name: e.name || e.title || `Embed ${i + 1}` }));
    project.layouts = (project.layouts || []).map((l, i) => ({ ...l, id: l.id || uid(), name: l.name || `Layout ${i + 1}`, components: Array.isArray(l.components) ? l.components : [] }));
    project.plugins = Array.isArray(project.plugins) ? project.plugins.filter((x) => typeof x === "string") : [];
    project.settings = {
        ...DEFAULT_SETTINGS,
        ...(project.settings || {}),
        intents: { ...DEFAULT_SETTINGS.intents, ...((project.settings || {}).intents || {}) },
    };
    if (project.helpSettings && project.helpSettings.enabled === undefined) project.helpSettings.enabled = true;
    return project;
}

module.exports = { createProject, migrateProject, DEFAULT_SETTINGS };
