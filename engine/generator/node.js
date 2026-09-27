const fs = require("fs");
const path = require("path");
const C = require("./common");

const RUNTIME_SRC = path.join(__dirname, "..", "runtime", "node", "botify.js");

const OPTION_TYPES = {
    string: { add: "addStringOption", get: (n) => `interaction.options.getString(${n})` },
    integer: { add: "addIntegerOption", get: (n) => `interaction.options.getInteger(${n})` },
    number: { add: "addNumberOption", get: (n) => `interaction.options.getNumber(${n})` },
    boolean: { add: "addBooleanOption", get: (n) => `interaction.options.getBoolean(${n})` },
    user: { add: "addUserOption", get: (n) => `(interaction.options.getMember(${n}) ?? interaction.options.getUser(${n}))` },
    channel: { add: "addChannelOption", get: (n) => `interaction.options.getChannel(${n})` },
    role: { add: "addRoleOption", get: (n) => `interaction.options.getRole(${n})` },
    attachment: { add: "addAttachmentOption", get: (n) => `interaction.options.getAttachment(${n})` },
};

const EVENT_MAP = {
    on_ready: { event: "ClientReady", once: true, params: ["readyClient"], ctx: "{ client }" },
    on_message: { event: "MessageCreate", params: ["message"], ctx: "{ client, message }", guard: "if (message.author?.bot) return;" },
    on_message_delete: { event: "MessageDelete", params: ["message"], ctx: "{ client, channel: message.channel, guild: message.guild, user: message.author }", guard: "if (message.author?.bot) return;" },
    on_message_update: { event: "MessageUpdate", params: ["oldMessage", "message"], ctx: "{ client, message }", guard: "if (message.partial) await message.fetch().catch(() => {});\n    if (message.author?.bot || oldMessage.content === message.content) return;" },
    on_member_join: { event: "GuildMemberAdd", params: ["member"], ctx: "{ client, member }" },
    on_member_leave: { event: "GuildMemberRemove", params: ["member"], ctx: "{ client, member }" },
    on_reaction_add: { event: "MessageReactionAdd", params: ["reaction", "user"], ctx: "{ client, user, guild: reaction.message.guild, channel: reaction.message.channel, member: reaction.message.guild?.members.cache.get(user.id) }", guard: "if (user.bot) return;\n    if (reaction.partial) await reaction.fetch().catch(() => {});\n    const message = reaction.message;\n    const emoji = reaction.emoji.name;" },
    on_reaction_remove: { event: "MessageReactionRemove", params: ["reaction", "user"], ctx: "{ client, user, guild: reaction.message.guild, channel: reaction.message.channel, member: reaction.message.guild?.members.cache.get(user.id) }", guard: "if (user.bot) return;\n    if (reaction.partial) await reaction.fetch().catch(() => {});\n    const message = reaction.message;\n    const emoji = reaction.emoji.name;" },
    on_guild_join: { event: "GuildCreate", params: ["guild"], ctx: "{ client, guild, channel: guild.systemChannel }" },
    on_interaction: { event: "InteractionCreate", params: ["interaction"], ctx: "{ client, interaction }", guard: "if (interaction.isChatInputCommand()) return;" },
};

class NodeGenerator {
    constructor(project, options) {
        this.project = project;
        this.options = options;
        this.warnings = options.warnings;
        this.pluginBlocks = options.pluginBlocks || new Map();
        this.tmp = 0;
    }

    // ------------------------------------------------------------ strings
    lit(s) {
        return JSON.stringify(String(s ?? ""));
    }

    /** JS expression for a string that may contain ${js} expressions (compile-time template). */
    tpl(s) {
        const parts = C.splitTemplate(s);
        if (!parts.some((p) => p.expr !== undefined)) return this.lit(s);
        return "`" + parts.map((p) => (p.expr !== undefined ? "${" + p.expr + "}" : p.lit.replace(/\\/g, "\\\\").replace(/`/g, "\\`"))).join("") + "`";
    }

    /** JS expression for user text: ${js} templates + {placeholder} runtime formatting. */
    text(s) {
        if (s === undefined || s === null || s === "") return '""';
        return `B.text(ctx, ${this.tpl(s)}, __v())`;
    }

    /** Object literal where every string may be a template (placeholders are formatted by the runtime). */
    obj(v) {
        if (typeof v === "string") return this.tpl(v);
        if (Array.isArray(v)) return "[" + v.map((x) => this.obj(x)).join(", ") + "]";
        if (v && typeof v === "object") {
            return "{ " + Object.entries(v).filter(([, x]) => x !== undefined && x !== "").map(([k, x]) => `${JSON.stringify(k)}: ${this.obj(x)}`).join(", ") + " }";
        }
        return JSON.stringify(v);
    }

    embedExpr(data) {
        return `B.embed(ctx, ${this.obj(data)}, __v())`;
    }

    savedEmbedExpr(ref) {
        if (!ref) return null;
        const emb = C.findEmbed(this.project, ref);
        if (!emb) {
            this.warnings.push(`Saved embed "${ref}" was not found - it will be skipped.`);
            return null;
        }
        const data = { ...emb };
        delete data.id; delete data.name;
        return this.embedExpr(data);
    }

    payload(content, embedExpr, extra = "") {
        const parts = [];
        if (content) parts.push(`content: ${this.text(content)}`);
        if (embedExpr) parts.push(`embeds: [${embedExpr}]`);
        if (extra) parts.push(extra);
        return `{ ${parts.join(", ")} }`;
    }

    // ------------------------------------------------------------ actions
    actions(list, env, indent) {
        return (list || []).map((raw) => this.action(raw, env, indent)).filter((c) => c !== null && c !== undefined && c !== "").join("\n");
    }

    branch(list, env, indent, fallback = "") {
        const code = this.actions(list, env, indent);
        return code || fallback;
    }

    action(raw, env, ind) {
        const a = C.normalizeAction(raw);
        if (!a) return "";
        const i = ind;
        const i2 = ind + "  ";
        const save = (expr) => {
            const target = C.saveTarget(a);
            return target ? `${i}${C.identifier(target)} = ${expr};` : `${i}${expr};`;
        };
        const eph = a.ephemeral ? "{ ephemeral: true }" : "{}";

        switch (a.type) {
            case "reply":
                return `${i}await B.reply(ctx, ${this.payload(a.content, this.savedEmbedExpr(a.embedRef))}, ${eph});`;
            case "send_message": {
                const call = `await B.send(ctx, ${this.text(a.channelId)}, ${this.payload(a.content, this.savedEmbedExpr(a.embedRef))}, ${eph})`;
                return a.saveTo ? `${i}${C.identifier(a.saveTo)} = ${call};` : `${i}${call};`;
            }
            case "create_embed":
                return `${i}await B.send(ctx, ${this.text(a.channelId)}, ${this.payload(a.content, this.embedExpr(a.embed || {}))}, ${eph});`;
            case "send_saved_embed": {
                const e = this.savedEmbedExpr(a.embedRef);
                if (!e) return `${i}// [Botify] Send Saved Embed: no embed selected`;
                return `${i}await B.send(ctx, ${this.text(a.channelId)}, ${this.payload(a.content, e)}, ${eph});`;
            }
            case "ephemeral_message":
                return `${i}await B.reply(ctx, ${this.text(a.content)}, { ephemeral: true });`;
            case "send_dm":
                return `${i}await B.dm(ctx, ${this.text(a.target)}, ${this.payload(a.content, this.savedEmbedExpr(a.embedRef))});`;
            case "edit_reply":
                return `${i}await B.editReply(ctx, ${this.payload(a.content, this.savedEmbedExpr(a.embedRef))});`;
            case "delete_message":
                return `${i}await B.deleteMessage(ctx);`;
            case "add_reaction":
                return `${i}await B.react(ctx, ${this.text(a.emoji || "✅")});`;

            case "send_buttons": {
                const e = this.savedEmbedExpr(a.embedRef);
                const opts = `{ content: ${this.text(a.content)}, ${e ? `embed: ${e}, ` : ""}buttons: ${JSON.stringify(a.buttons || [])}, timeout: ${Number(a.timeout) || 60}, onlyAuthor: ${a.onlyAuthor !== false}${a.ephemeral ? ", ephemeral: true" : ""} }`;
                return save(`await B.askButtons(ctx, ${opts}, __v())`);
            }
            case "send_select_menu": {
                const opts = `{ content: ${this.text(a.content)}, placeholder: ${this.lit(a.placeholder || "")}, options: ${JSON.stringify(a.options || [])}, minValues: ${Number(a.minValues) || 1}, maxValues: ${Number(a.maxValues) || 1}, timeout: ${Number(a.timeout) || 60} }`;
                return save(`await B.askSelect(ctx, ${opts}, __v())`);
            }
            case "show_modal": {
                const target = C.identifier(C.saveTarget(a));
                const opts = `{ title: ${this.tpl(a.title || "Form")}, inputs: ${this.obj(a.inputs || [])}, timeout: ${Number(a.timeout) || 300} }`;
                return `${i}${target} = await B.askModal(ctx, ${opts}, __v());\n${i}if (!${target}) return; // form closed / timed out`;
            }
            case "defer_reply":
                return `${i}await B.defer(ctx, ${!!a.ephemeral});`;

            case "kick_member":
                return `${i}await B.kick(ctx, ${this.text(a.target)}, ${this.text(a.reason)});`;
            case "ban_member":
                return `${i}await B.ban(ctx, ${this.text(a.target)}, ${this.text(a.reason)}, ${Number(a.deleteDays) || 0});`;
            case "timeout_member":
                return `${i}await B.timeout(ctx, ${this.text(a.target)}, ${this.text(String(a.minutes ?? 10))}, ${this.text(a.reason)});`;
            case "add_role":
            case "remove_role":
                if (!a.roleId) this.warnings.push(`${env.label}: "${a.type === "add_role" ? "Add" : "Remove"} Role" block has no Role ID.`);
                return `${i}await B.role(ctx, ${this.text(a.target)}, ${this.text(a.roleId)}, ${a.type === "add_role"});`;
            case "set_nickname":
                return `${i}await B.nickname(ctx, ${this.text(a.target)}, ${this.text(a.nickname)});`;
            case "purge_messages":
                return `${i}await B.purge(ctx, ${this.text(String(a.amount ?? 10))});`;

            case "check_permission":
            case "has_role": {
                const cond = a.type === "check_permission"
                    ? `await B.hasPermission(ctx, ${this.lit(a.permission || "Administrator")})`
                    : `await B.hasRole(ctx, ${this.text(a.target)}, ${this.text(a.roleId)})`;
                const thenCode = this.branch(a.then, env, i2);
                const elseCode = this.branch(a.else, env, i2, `${i2}await B.reply(ctx, ${this.text(a.denyMessage || "You can't do that.")}, { ephemeral: true });\n${i2}return;`);
                return `${i}if (${cond}) {\n${thenCode || `${i2}// allowed`}\n${i}} else {\n${elseCode}\n${i}}`;
            }
            case "if_condition": {
                const cond = a.condition && String(a.condition).trim()
                    ? `(${a.condition})`
                    : `B.compare(${this.text(a.left ?? "")}, ${this.lit(a.operator || "==")}, ${this.text(a.right ?? "")})`;
                const thenCode = this.branch(a.then, env, i2);
                const elseCode = this.branch(a.else, env, i2);
                return `${i}if (${cond}) {\n${thenCode || `${i2}// true`}\n${i}}${elseCode ? ` else {\n${elseCode}\n${i}}` : ""}`;
            }
            case "random_chance": {
                const thenCode = this.branch(a.then, env, i2);
                const elseCode = this.branch(a.else, env, i2);
                return `${i}if (Math.random() * 100 < ${Number(a.chance) || 50}) {\n${thenCode || `${i2}// hit`}\n${i}}${elseCode ? ` else {\n${elseCode}\n${i}}` : ""}`;
            }
            case "loop": {
                const v = C.identifier(a.variable || "i");
                const n = `__n${++this.tmp}`;
                const body = this.branch(a.body, env, i2);
                return `${i}for (let ${n} = 1, ${n}max = Math.min(1000, B.toNumber(${this.text(String(a.times ?? 1))})); ${n} <= ${n}max; ${n}++) {\n${i2}${v} = ${n};\n${body}\n${i}}`;
            }
            case "cooldown": {
                const r = `__cd${++this.tmp}`;
                return `${i}const ${r} = B.cooldown(\`${env.key}:${this.tmp}:\${ctx.user?.id}\`, ${Number(a.time) || 5});\n${i}if (${r}) {\n${i2}await B.reply(ctx, B.text(ctx, ${this.tpl(a.message || "Slow down! Try again in {remaining}s.")}, { ...__v(), remaining: ${r} }), { ephemeral: true });\n${i2}return;\n${i}}`;
            }
            case "wait":
                return `${i}await B.sleep(${Number(a.time) || 1000});`;
            case "stop":
                return `${i}return;`;

            case "set_variable": {
                const name = C.identifier(a.name || "variable");
                const mode = a.mode || "expression";
                if (mode === "text") return `${i}${name} = ${this.text(a.value ?? "")};`;
                if (mode === "number") return `${i}${name} = B.toNumber(${this.text(String(a.value ?? "0"))});`;
                const expr = String(a.value ?? "").trim();
                return `${i}${name} = ${expr === "" ? '""' : `(${expr})`};`;
            }
            case "math": {
                const name = C.identifier(a.name || "count");
                const amt = `B.toNumber(${this.text(String(a.amount ?? "1"))})`;
                if (a.op === "=") return `${i}${name} = ${amt};`;
                const op = ["+", "-", "*", "/"].includes(a.op) ? a.op : "+";
                return `${i}${name} = B.toNumber(${name}) ${op} ${amt};`;
            }
            case "random_number":
                return save(`B.randomInt(${Number(a.min) || 0}, ${Number(a.max) || 100})`);
            case "random_choice":
                return save(`B.pick(${this.text(a.choices || "")})`);
            case "get_user_info":
                return save(`await B.userInfo(ctx, ${this.text(a.target)})`);
            case "api_request": {
                const target = C.identifier(C.saveTarget(a));
                return `${i}try {\n${i2}${target} = await B.http(${this.text(a.url || "")}, ${this.lit(a.method || "GET")}, ${this.text(a.headers || "")}, ${this.text(a.body || "")});\n${i}} catch (err) {\n${i2}console.error("[Botify] HTTP request failed:", err.message);\n${i2}${target} = null;\n${i}}`;
            }
            case "kv_set":
                return `${i}B.kvSet(${this.text(a.key || "key")}, B.parseValue(${this.text(a.value ?? "")}));`;
            case "kv_get":
                return save(`B.kvGet(${this.text(a.key || "key")}, B.parseValue(${this.text(a.default ?? "")}))`);
            case "db_read":
                return save(`B.sqlAll(${this.lit(a.query || "SELECT 1")}, [${(a.params || []).filter((p) => String(p).trim()).join(", ")}])`);
            case "db_write":
                return `${i}B.sqlRun(${this.lit(a.query || "SELECT 1")}, [${(a.params || []).filter((p) => String(p).trim()).join(", ")}]);`;
            case "mention_user":
                return save(`\`<@\${String(${this.text(a.userId || "{user.id}")}).replace(/\\D/g, "")}>\``);
            case "mention_role":
                return save(`\`<@&\${String(${this.text(a.roleId || "")}).replace(/\\D/g, "")}>\``);
            case "mention_channel":
                return save(`\`<#\${String(${this.text(a.channelId || "{channel.id}")}).replace(/\\D/g, "")}>\``);

            case "set_status":
                return `${i}B.setStatus(ctx.client, ${this.text(a.text || "")}, ${this.lit(a.statusType || "Playing")}, ${this.lit(a.status || "online")});`;
            case "log":
                return `${i}console.log(${this.text(a.message || "")});`;
            case "raw_code":
                return C.indentLines(C.dedent(a.code || ""), i);

            default: {
                const pb = this.pluginBlocks.get(a.type);
                if (pb && pb.compile && typeof pb.compile.node === "function") {
                    try {
                        const code = pb.compile.node(a, { text: (s) => this.text(s), tpl: (s) => this.tpl(s), lit: (s) => this.lit(s), indent: i, ctx: "ctx" });
                        return C.indentLines(C.dedent(code), i);
                    } catch (e) {
                        this.warnings.push(`Plugin block "${a.type}" failed to compile: ${e.message}`);
                    }
                }
                this.warnings.push(`${env.label}: block "${a.type}" is not supported by the Node.js engine and was skipped.`);
                return `${i}// [Botify] Unsupported block "${a.type}" skipped`;
            }
        }
    }

    /** Standard preamble: builtin locals, argument locals, declared variables, __v() snapshot. */
    preamble(actions, params, argNames, ind) {
        const declared = new Set([...params, "ctx", "B", "__v"]);
        const lines = [];
        const argLocals = [];
        argNames.forEach((n) => {
            const id = C.identifier(n);
            if (id === n && !declared.has(id) && !["interaction", "client", "message", "args"].includes(id)) {
                argLocals.push(id);
                declared.add(id);
            }
        });
        const builtins = ["user", "member", "guild", "channel"].filter((b) => !declared.has(b));
        if (builtins.length) lines.push(`let { ${builtins.join(", ")} } = ctx;`);
        builtins.forEach((b) => declared.add(b));
        argLocals.forEach((id) => lines.push(`let ${id} = ctx.args[${JSON.stringify(id)}];`));
        const vars = [...C.collectVariables(actions)].map((v) => C.identifier(v)).filter((v) => !declared.has(v));
        const uniqueVars = [...new Set(vars)];
        if (uniqueVars.length) lines.push(`let ${uniqueVars.join(", ")};`);
        const snapshot = [...argLocals, ...uniqueVars];
        lines.push(`const __v = () => ({ ...ctx.args${snapshot.length ? ", " + snapshot.join(", ") : ""} });`);
        return lines.map((l) => ind + l).join("\n");
    }

    // ------------------------------------------------------------ files
    commandFile(cmd) {
        const name = C.commandName(cmd.name);
        const type = cmd.type || "slash";
        const args = (cmd.arguments || []).filter((a) => a && a.name).map((a) => ({ ...a, name: C.optionName(a.name) }));
        const sortedArgs = [...args.filter((a) => a.required), ...args.filter((a) => !a.required)];
        const actions = cmd.actions || [];
        const env = { label: `Command "${name}"`, key: name };
        const hasSlash = type === "slash" || type === "both";
        const hasPrefix = type === "prefix" || type === "both";
        const description = C.clampDescription(cmd.description, `Run /${name}`);
        const perms = (cmd.permissions || []).filter(Boolean);

        const guard = [];
        if (perms.length) {
            guard.push(`for (const perm of ${JSON.stringify(perms)}) {\n      if (!(await B.hasPermission(ctx, perm))) return B.reply(ctx, \`⛔ You need the **\${perm}** permission.\`, { ephemeral: true });\n    }`);
        }
        if (Number(cmd.cooldown) > 0) {
            guard.push(`const __wait = B.cooldown(\`cmd:${name}:\${ctx.user?.id}\`, ${Number(cmd.cooldown)});\n    if (__wait) return B.reply(ctx, \`⏳ Please wait \${__wait}s before using this command again.\`, { ephemeral: true });`);
        }
        if (cmd.guildOnly !== false) {
            guard.unshift(`if (!ctx.guild) return B.reply(ctx, "This command only works in servers.", { ephemeral: true });`);
        }

        const body = (params) => {
            const pre = this.preamble(actions, params, args.map((a) => a.name), "    ");
            const code = this.actions(actions, env, "    ");
            return `${guard.map((g) => "    " + g).join("\n")}\n${pre}\n${code || `    await B.reply(ctx, "✅ Command executed.");`}`;
        };

        let out = `// Generated by Botify - edits are overwritten when you regenerate. Use Custom Code blocks for custom logic.\nconst B = require("../botify");\n`;
        const parts = [];
        if (hasSlash) {
            out += `const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");\n`;
            const opts = sortedArgs.map((a) => {
                const t = OPTION_TYPES[a.type] || OPTION_TYPES.string;
                return `\n    .${t.add}((o) => o.setName(${JSON.stringify(a.name)}).setDescription(${JSON.stringify(C.clampDescription(a.description, a.name))}).setRequired(${!!a.required}))`;
            }).join("");
            const permFlags = perms.length ? `\n    .setDefaultMemberPermissions(${perms.map((p) => `PermissionFlagsBits.${p}`).join(" | ")})` : "";
            const argsObj = args.map((a) => `${JSON.stringify(a.name)}: ${(OPTION_TYPES[a.type] || OPTION_TYPES.string).get(JSON.stringify(a.name))}`).join(", ");
            parts.push(`  data: new SlashCommandBuilder()\n    .setName(${JSON.stringify(name)})\n    .setDescription(${JSON.stringify(description)})${permFlags}${opts},\n  async execute(interaction, client) {\n    const ctx = B.context({ interaction, client, args: { ${argsObj} } });\n${body(["interaction", "client"])}\n  }`);
        }
        if (hasPrefix) {
            const aliases = (cmd.aliases || []).map((x) => C.commandName(x)).filter(Boolean);
            const required = args.filter((a) => a.required).map((a) => a.name);
            const usageText = `${name} ${args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(" ")}`.trim();
            const usage = required.length
                ? `    if (${JSON.stringify(required)}.some((n) => ctx.args[n] == null)) return B.reply(ctx, \`ℹ️ Usage: \\\`\${process.env.PREFIX || "!"}${usageText.replace(/`/g, "")}\\\`\`);\n`
                : "";
            parts.push(`  name: ${JSON.stringify(name)},\n  aliases: ${JSON.stringify(aliases)},\n  description: ${JSON.stringify(description)},\n  async run(message, args, client) {\n    const ctx = B.context({ message, client, args: await B.prefixArgs(message, args, ${JSON.stringify(args.map((a) => ({ name: a.name, type: a.type || "string", required: !!a.required })))}) });\n${usage}${body(["message", "args", "client"])}\n  }`);
        }
        out += `\nmodule.exports = {\n${parts.join(",\n")},\n};\n`;
        return { name, file: out };
    }

    eventFile(evt, label) {
        const spec = EVENT_MAP[evt.type];
        if (!spec) {
            this.warnings.push(`Event "${evt.type}" is not supported and was skipped.`);
            return null;
        }
        const env = { label: label || `Event "${evt.type}"`, key: evt.type };
        const actions = evt.actions || [];
        const params = [...spec.params, "client"];
        let code = this.actions(actions, env, "    ");
        if (!code) {
            const defaults = {
                on_ready: `    console.log(\`✅ \${client.user.tag} is online!\`);`,
                on_member_join: "    console.log(`👋 ${member.user.tag} joined ${member.guild.name}`);",
                on_member_leave: "    console.log(`🚪 ${member.user.tag} left ${member.guild.name}`);",
            };
            code = defaults[evt.type] || "    // No actions configured";
        }
        const guardLocals = ["message", "emoji"].filter((n) => spec.guard && spec.guard.includes(`const ${n} `));
        const pre = this.preamble(actions, [...params, ...guardLocals], [], "    ");
        return `// Generated by Botify\nconst { Events } = require("discord.js");\nconst B = require("../botify");\n\nmodule.exports = {\n  name: Events.${spec.event},\n  once: ${!!spec.once},\n  async execute(${params.join(", ")}) {\n${spec.guard ? "    " + spec.guard + "\n" : ""}    const ctx = B.context(${spec.ctx});\n${pre}\n${code}\n  },\n};\n`;
    }

    helpFile(settings, commands) {
        const descMap = {};
        commands.forEach((c) => { descMap[C.commandName(c.name)] = C.clampDescription(c.description, ""); });
        const help = {
            title: settings.title || "Help", description: settings.description || "", color: settings.color || "#5865f2",
            style: settings.style || "select", footer: settings.footer || "", categories: settings.categories || [],
        };
        return `// Generated by Botify (Help System)\nconst { SlashCommandBuilder } = require("discord.js");\nconst B = require("../botify");\n\nconst HELP = ${JSON.stringify(help, null, 2)};\nconst COMMANDS = ${JSON.stringify(descMap, null, 2)};\n\nmodule.exports = {\n  data: new SlashCommandBuilder().setName("help").setDescription(${JSON.stringify(C.clampDescription(settings.commandDescription, "Show all commands"))}),\n  name: "help",\n  aliases: [],\n  async execute(interaction, client) {\n    await B.helpMenu(B.context({ interaction, client }), HELP, COMMANDS);\n  },\n  async run(message, args, client) {\n    await B.helpMenu(B.context({ message, client }), HELP, COMMANDS);\n  },\n};\n`;
    }

    indexFile(pluginLogics) {
        const s = this.project.settings || {};
        const intents = s.intents || {};
        const intentList = ["Guilds", "GuildMessages", "GuildMessageReactions", "DirectMessages", "GuildVoiceStates", "GuildModeration"];
        if (intents.messageContent !== false) intentList.push("MessageContent");
        if (intents.members !== false) intentList.push("GuildMembers");
        if (intents.presences) intentList.push("GuildPresences");

        const initHooks = pluginLogics.filter((l) => l.hooks && typeof l.hooks.on_init === "function").map((l) =>
            `try {\n  (${l.hooks.on_init.toString()})(client);\n} catch (e) {\n  console.error("[Plugin ${l.__name}] on_init failed:", e);\n}`).join("\n");
        const msgHooks = pluginLogics.filter((l) => l.hooks && typeof l.hooks.on_message === "function").map((l, idx) =>
            `const __hook${idx} = ${l.hooks.on_message.toString()};`).join("\n");
        const msgHookCalls = pluginLogics.filter((l) => l.hooks && typeof l.hooks.on_message === "function").map((l, idx) =>
            `  try { await __hook${idx}(message, client); } catch (e) { console.error("[Plugin ${l.__name}] on_message failed:", e); }`).join("\n");

        return `// Generated by Botify - https://github.com/erhicaldcDev/Botify
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes, Events } = require("discord.js");
const B = require("./botify");

const PREFIX = process.env.PREFIX || ${JSON.stringify(this.project.prefix || "!")};

const client = new Client({
  intents: [${intentList.map((x) => `GatewayIntentBits.${x}`).join(", ")}],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.slashCommands = new Collection();
client.prefixCommands = new Collection();

// ---------------------------------------------------------------- commands
for (const file of fs.readdirSync(path.join(__dirname, "commands")).filter((f) => f.endsWith(".js"))) {
  try {
    const cmd = require(path.join(__dirname, "commands", file));
    if (cmd.data && cmd.execute) client.slashCommands.set(cmd.data.name, cmd);
    if (cmd.name && cmd.run) {
      client.prefixCommands.set(cmd.name, cmd);
      (cmd.aliases || []).forEach((a) => client.prefixCommands.set(a, cmd));
    }
  } catch (err) {
    console.error(\`[Botify] Failed to load command \${file}:\`, err);
  }
}

// ------------------------------------------------------------------ events
for (const file of fs.readdirSync(path.join(__dirname, "events")).filter((f) => f.endsWith(".js"))) {
  try {
    const evt = require(path.join(__dirname, "events", file));
    const handler = async (...args) => {
      try {
        await evt.execute(...args, client);
      } catch (err) {
        console.error(\`[Botify] Error in event \${file}:\`, err);
      }
    };
    if (evt.once) client.once(evt.name, handler);
    else client.on(evt.name, handler);
  } catch (err) {
    console.error(\`[Botify] Failed to load event \${file}:\`, err);
  }
}

${initHooks}

// ----------------------------------------------------------- slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.slashCommands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(\`[Botify] Error in /\${interaction.commandName}:\`, error);
    const payload = { content: "❌ Something went wrong while running this command.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

// ---------------------------------------------------------- prefix commands
${msgHooks}
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
${msgHookCalls}
  if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) return;
  const args = message.content.slice(PREFIX.length).trim().split(/\\s+/);
  const name = (args.shift() || "").toLowerCase();
  const command = client.prefixCommands.get(name);
  if (!command) return;
  try {
    await command.run(message, args, client);
  } catch (error) {
    console.error(\`[Botify] Error in \${PREFIX}\${name}:\`, error);
    message.reply("❌ Something went wrong while running this command.").catch(() => {});
  }
});

// -------------------------------------------------------------- startup
async function registerSlashCommands() {
  const body = [...client.slashCommands.values()].map((c) => c.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const guildId = (process.env.DEV_GUILD_ID || "").trim();
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body });
      console.log(\`[Botify] Registered \${body.length} slash command(s) in server \${guildId} (instant).\`);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body });
      console.log(\`[Botify] Registered \${body.length} global slash command(s).\`);
    }
  } catch (error) {
    console.error("[Botify] Failed to register slash commands:", error.message || error);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(\`Bot logged in as \${client.user.tag}\`);
  console.log(\`[Botify] Serving \${client.guilds.cache.size} server(s). Prefix: \${PREFIX}\`);
  console.log(\`[Botify] Invite link: https://discord.com/oauth2/authorize?client_id=\${client.user.id}&scope=bot+applications.commands&permissions=8\`);
  await registerSlashCommands();
});

process.on("unhandledRejection", (err) => console.error("[Botify] Unhandled error:", err));

if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN === "YOUR_TOKEN_HERE") {
  console.error("[Botify] No bot token set. Add your token in Settings > Bot Token.");
  process.exit(78);
}

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  const msg = String(err && err.message || err);
  if (/disallowed intents/i.test(msg)) {
    console.error("[Botify] Discord rejected the privileged intents. Enable 'Message Content' and 'Server Members' intents in the Developer Portal (Bot tab), or turn them off in Botify Settings.");
  } else if (/token/i.test(msg)) {
    console.error("[Botify] Invalid bot token. Reset it in the Discord Developer Portal and update it in Settings.");
  } else {
    console.error("[Botify] Login failed:", msg);
  }
  process.exit(78);
});
`;
    }

    write(outputPath, { commands, events, pluginLogics, help }) {
        const commandsDir = path.join(outputPath, "commands");
        const eventsDir = path.join(outputPath, "events");
        fs.mkdirSync(commandsDir, { recursive: true });
        fs.mkdirSync(eventsDir, { recursive: true });

        const deps = { "discord.js": "^14.16.3", "better-sqlite3": "^11.7.0", dotenv: "^16.4.7" };
        pluginLogics.forEach((l) => Object.assign(deps, l.dependencies || {}));
        const pkg = {
            name: C.commandName(this.project.name) || "botify-bot",
            version: "1.0.0",
            private: true,
            description: `Discord bot: ${this.project.name}`,
            main: "index.js",
            scripts: { start: "node index.js" },
            engines: { node: ">=18" },
            dependencies: deps,
        };
        const files = {};
        files["package.json"] = JSON.stringify(pkg, null, 2);
        files["index.js"] = this.indexFile(pluginLogics);
        files["botify.js"] = fs.readFileSync(RUNTIME_SRC, "utf-8").replace(/^/, "// Generated by Botify - runtime helpers\n");

        const used = new Set();
        commands.forEach((cmd) => {
            const { name, file } = this.commandFile(cmd);
            let fname = `${name}.js`;
            let n = 2;
            while (used.has(fname)) fname = `${name}-${n++}.js`;
            used.add(fname);
            files[`commands/${fname}`] = file;
        });
        if (help) files["commands/help.js"] = this.helpFile(help, commands);

        events.forEach((evt, idx) => {
            const code = this.eventFile(evt, evt.__label);
            if (!code) return;
            const base = evt.__source ? `${evt.__source}-${evt.type.replace("on_", "")}` : evt.type.replace("on_", "");
            let fname = `${base}.js`;
            let n = 2;
            while (files[`events/${fname}`]) fname = `${base}-${n++}.js`;
            files[`events/${fname}`] = code;
        });

        Object.entries(files).forEach(([rel, content]) => fs.writeFileSync(path.join(outputPath, rel), content));
        return Object.keys(files);
    }
}

module.exports = { NodeGenerator };
