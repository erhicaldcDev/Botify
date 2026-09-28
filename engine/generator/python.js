const fs = require("fs");
const path = require("path");
const C = require("./common");

const RUNTIME_SRC = path.join(__dirname, "..", "runtime", "python", "botify_runtime.py");

const PY_TYPES = {
    string: "str", integer: "int", number: "float", boolean: "bool", user: "discord.Member",
    channel: "discord.abc.GuildChannel", role: "discord.Role", attachment: "discord.Attachment",
};

const EVENT_MAP = {
    on_ready: { listener: "on_ready", params: [], ctx: "B.Context(self.bot)" },
    on_message: { listener: "on_message", params: ["message"], ctx: "B.Context(self.bot, message=message)", guard: "if message.author.bot:\n    return" },
    on_message_delete: { listener: "on_message_delete", params: ["message"], ctx: "B.Context(self.bot, channel=message.channel, guild=message.guild, user=message.author)", guard: "if message.author.bot:\n    return" },
    on_message_update: { listener: "on_message_edit", params: ["oldMessage", "message"], ctx: "B.Context(self.bot, message=message)", guard: "if message.author.bot or oldMessage.content == message.content:\n    return" },
    on_member_join: { listener: "on_member_join", params: ["member"], ctx: "B.Context(self.bot, member=member)" },
    on_member_leave: { listener: "on_member_remove", params: ["member"], ctx: "B.Context(self.bot, member=member)" },
    on_reaction_add: { listener: "on_reaction_add", params: ["reaction", "user"], ctx: "B.Context(self.bot, user=user, guild=reaction.message.guild, channel=reaction.message.channel, member=user if isinstance(user, discord.Member) else None)", guard: "if user.bot:\n    return\nmessage = reaction.message\nemoji = str(reaction.emoji)" },
    on_reaction_remove: { listener: "on_reaction_remove", params: ["reaction", "user"], ctx: "B.Context(self.bot, user=user, guild=reaction.message.guild, channel=reaction.message.channel, member=user if isinstance(user, discord.Member) else None)", guard: "if user.bot:\n    return\nmessage = reaction.message\nemoji = str(reaction.emoji)" },
    on_guild_join: { listener: "on_guild_join", params: ["guild"], ctx: "B.Context(self.bot, guild=guild, channel=guild.system_channel)" },
    on_interaction: { listener: "on_interaction", params: ["interaction"], ctx: "B.Context(self.bot, interaction=interaction)", guard: "if interaction.type == discord.InteractionType.application_command:\n    return" },
};

class PythonGenerator {
    constructor(project, options) {
        this.project = project;
        this.warnings = options.warnings;
        this.tmp = 0;
    }

    lit(s) {
        return JSON.stringify(String(s ?? "")).replace(/[\u2028\u2029]/g, (c) => (c === "\u2028" ? "\\u2028" : "\\u2029"));
    }

    /** Python expression for a string with ${python-expression} parts. */
    tpl(s) {
        const parts = C.splitTemplate(s);
        if (!parts.some((p) => p.expr !== undefined)) return this.lit(s);
        return "(" + parts.map((p) => (p.expr !== undefined ? `B._stringify(${p.expr})` : this.lit(p.lit))).join(" + ") + ")";
    }

    text(s) {
        if (s === undefined || s === null || s === "") return '""';
        return `B.text(ctx, ${this.tpl(s)}, locals())`;
    }

    obj(v) {
        if (typeof v === "string") return this.tpl(v);
        if (typeof v === "boolean") return v ? "True" : "False";
        if (v === null || v === undefined) return "None";
        if (Array.isArray(v)) return "[" + v.map((x) => this.obj(x)).join(", ") + "]";
        if (typeof v === "object") return "{" + Object.entries(v).filter(([, x]) => x !== undefined && x !== "").map(([k, x]) => `${this.lit(k)}: ${this.obj(x)}`).join(", ") + "}";
        return JSON.stringify(v);
    }

    embedExpr(data) {
        return `B.embed(ctx, ${this.obj(data)}, locals())`;
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

    actions(list, env, indent) {
        return (list || []).map((raw) => this.action(raw, env, indent)).filter(Boolean).join("\n");
    }

    branch(list, env, indent) {
        return this.actions(list, env, indent) || `${indent}pass`;
    }

    action(raw, env, i) {
        const a = C.normalizeAction(raw);
        if (!a) return "";
        const i2 = i + "    ";
        const target = C.saveTarget(a) ? C.identifier(C.saveTarget(a), "value", C.PY_RESERVED) : null;
        const save = (expr) => (target ? `${i}${target} = ${expr}` : `${i}${expr}`);
        const embedArg = (ref) => { const e = this.savedEmbedExpr(ref); return e ? `, embed=${e}` : ""; };
        const eph = a.ephemeral ? ", ephemeral=True" : "";

        switch (a.type) {
            case "reply":
                return `${i}await B.reply(ctx, ${this.text(a.content)}${embedArg(a.embedRef)}${eph})`;
            case "send_message": {
                const call = `await B.send(ctx, ${this.text(a.channelId)}, ${this.text(a.content)}${embedArg(a.embedRef)}${eph})`;
                return a.saveTo ? `${i}${C.identifier(a.saveTo, "value", C.PY_RESERVED)} = ${call}` : `${i}${call}`;
            }
            case "create_embed":
                return `${i}await B.send(ctx, ${this.text(a.channelId)}, ${this.text(a.content)}, embed=${this.embedExpr(a.embed || {})}${eph})`;
            case "send_saved_embed": {
                const e = this.savedEmbedExpr(a.embedRef);
                if (!e) return `${i}pass  # Send Saved Embed: no embed selected`;
                return `${i}await B.send(ctx, ${this.text(a.channelId)}, ${this.text(a.content)}, embed=${e}${eph})`;
            }
            case "ephemeral_message":
                return `${i}await B.reply(ctx, ${this.text(a.content)}, ephemeral=True)`;
            case "send_dm":
                return `${i}await B.dm(ctx, ${this.text(a.target)}, ${this.text(a.content)}${embedArg(a.embedRef)})`;
            case "edit_reply":
                return `${i}await B.edit_reply(ctx, ${this.text(a.content)}${embedArg(a.embedRef)})`;
            case "delete_message":
                return `${i}await B.delete_message(ctx)`;
            case "add_reaction":
                return `${i}await B.react(ctx, ${this.text(a.emoji || "✅")})`;

            case "send_buttons": {
                const e = this.savedEmbedExpr(a.embedRef);
                return save(`await B.ask_buttons(ctx, ${this.text(a.content)}, ${this.obj(a.buttons || [])}, ${Number(a.timeout) || 60}, ${a.onlyAuthor !== false ? "True" : "False"}${e ? `, embed=${e}` : ""}, variables=locals())`);
            }
            case "send_select_menu":
                return save(`await B.ask_select(ctx, ${this.text(a.content)}, ${this.lit(a.placeholder || "")}, ${this.obj(a.options || [])}, ${Number(a.minValues) || 1}, ${Number(a.maxValues) || 1}, ${Number(a.timeout) || 60}, variables=locals())`);
            case "show_modal":
                return `${save(`await B.ask_modal(ctx, ${this.tpl(a.title || "Form")}, ${this.obj(a.inputs || [])}, ${Number(a.timeout) || 300}, variables=locals())`)}\n${i}if not ${target}:\n${i2}return  # form closed / timed out`;
            case "send_layout":
            case "send_saved_layout": {
                const comps = C.layoutFor(this.project, a);
                if (!comps) {
                    this.warnings.push(`${env.label}: ${a.type === "send_layout" ? "layout is empty" : `saved layout "${a.layoutRef || ""}" not found`} - block skipped.`);
                    return `${i}pass  # Send Layout: no layout`;
                }
                const call = `await B.send_layout(ctx, ${this.text(a.channelId)}, ${this.obj(comps)}, locals(), ephemeral=${a.ephemeral ? "True" : "False"}, wait=${a.wait ? "True" : "False"}, timeout=${Number(a.timeout) || 60}, only_author=${a.onlyAuthor !== false ? "True" : "False"})`;
                return a.wait ? `${i}${C.identifier(a.saveTo || "clicked", "clicked", C.PY_RESERVED)} = ${call}` : `${i}${call}`;
            }
            case "defer_reply":
                return `${i}await B.defer(ctx, ${a.ephemeral ? "True" : "False"})`;

            case "kick_member":
                return `${i}await B.kick(ctx, ${this.text(a.target)}, ${this.text(a.reason)})`;
            case "ban_member":
                return `${i}await B.ban(ctx, ${this.text(a.target)}, ${this.text(a.reason)}, ${Number(a.deleteDays) || 0})`;
            case "timeout_member":
                return `${i}await B.timeout(ctx, ${this.text(a.target)}, ${this.text(String(a.minutes ?? 10))}, ${this.text(a.reason)})`;
            case "add_role":
            case "remove_role":
                return `${i}await B.role(ctx, ${this.text(a.target)}, ${this.text(a.roleId)}, ${a.type === "add_role" ? "True" : "False"})`;
            case "set_nickname":
                return `${i}await B.nickname(ctx, ${this.text(a.target)}, ${this.text(a.nickname)})`;
            case "purge_messages":
                return `${i}await B.purge(ctx, ${this.text(String(a.amount ?? 10))})`;

            case "check_permission":
            case "has_role": {
                const cond = a.type === "check_permission"
                    ? `B.has_permission(ctx, ${this.lit(C.camelToSnake(a.permission || "Administrator"))})`
                    : `await B.has_role(ctx, ${this.text(a.target)}, ${this.text(a.roleId)})`;
                const elseCode = this.actions(a.else, env, i2) || `${i2}await B.reply(ctx, ${this.text(a.denyMessage || "You can't do that.")}, ephemeral=True)\n${i2}return`;
                return `${i}if ${cond}:\n${this.branch(a.then, env, i2)}\n${i}else:\n${elseCode}`;
            }
            case "if_condition": {
                const cond = a.condition && String(a.condition).trim()
                    ? `(${C.toPythonExpr(a.condition)})`
                    : `B.compare(${this.text(a.left ?? "")}, ${this.lit(a.operator || "==")}, ${this.text(a.right ?? "")})`;
                const elseCode = this.actions(a.else, env, i2);
                return `${i}if ${cond}:\n${this.branch(a.then, env, i2)}${elseCode ? `\n${i}else:\n${elseCode}` : ""}`;
            }
            case "random_chance": {
                const elseCode = this.actions(a.else, env, i2);
                return `${i}if random.random() * 100 < ${Number(a.chance) || 50}:\n${this.branch(a.then, env, i2)}${elseCode ? `\n${i}else:\n${elseCode}` : ""}`;
            }
            case "loop": {
                const v = C.identifier(a.variable || "i", "i", C.PY_RESERVED);
                return `${i}for ${v} in range(1, min(1000, int(B.to_number(${this.text(String(a.times ?? 1))}))) + 1):\n${this.branch(a.body, env, i2)}`;
            }
            case "cooldown": {
                const r = `_cd${++this.tmp}`;
                return `${i}${r} = B.cooldown("${env.key}:${this.tmp}:" + str(ctx.user.id if ctx.user else ""), ${Number(a.time) || 5})\n${i}if ${r}:\n${i2}await B.reply(ctx, B.text(ctx, ${this.lit(a.message || "Slow down! Try again in {remaining}s.")}, {**locals(), "remaining": ${r}}), ephemeral=True)\n${i2}return`;
            }
            case "wait":
                return `${i}await asyncio.sleep(${(Number(a.time) || 1000) / 1000})`;
            case "stop":
                return `${i}return`;

            case "set_variable": {
                const name = C.identifier(a.name || "variable", "variable", C.PY_RESERVED);
                const mode = a.mode || "expression";
                if (mode === "text") return `${i}${name} = ${this.text(a.value ?? "")}`;
                if (mode === "number") return `${i}${name} = B.to_number(${this.text(String(a.value ?? "0"))})`;
                const expr = String(a.value ?? "").trim();
                return `${i}${name} = ${expr === "" ? '""' : `(${C.toPythonExpr(expr)})`}`;
            }
            case "math": {
                const name = C.identifier(a.name || "count", "count", C.PY_RESERVED);
                const amt = `B.to_number(${this.text(String(a.amount ?? "1"))})`;
                if (a.op === "=") return `${i}${name} = ${amt}`;
                const op = ["+", "-", "*", "/"].includes(a.op) ? a.op : "+";
                return `${i}${name} = B.to_number(${name}) ${op} ${amt}`;
            }
            case "random_number":
                return save(`B.random_int(${Number(a.min) || 0}, ${Number(a.max) || 100})`);
            case "random_choice":
                return save(`B.pick(${this.text(a.choices || "")})`);
            case "get_user_info":
                return save(`await B.user_info(ctx, ${this.text(a.target)})`);
            case "api_request":
                return `${i}try:\n${i2}${target} = await B.http(${this.text(a.url || "")}, ${this.lit(a.method || "GET")}, ${this.text(a.headers || "")}, ${this.text(a.body || "")})\n${i}except Exception as err:\n${i2}print("[Botify] HTTP request failed:", err)\n${i2}${target} = None`;
            case "kv_set":
                return `${i}B.kv_set(${this.text(a.key || "key")}, B.parse_value(${this.text(a.value ?? "")}))`;
            case "kv_get":
                return save(`B.kv_get(${this.text(a.key || "key")}, B.parse_value(${this.text(a.default ?? "")}))`);
            case "db_read":
                return save(`B.sql_all(${this.lit(a.query || "SELECT 1")}, [${(a.params || []).filter((p) => String(p).trim()).join(", ")}])`);
            case "db_write":
                return `${i}B.sql_run(${this.lit(a.query || "SELECT 1")}, [${(a.params || []).filter((p) => String(p).trim()).join(", ")}])`;
            case "mention_user":
                return save(`"<@" + re.sub(r"\\D", "", ${this.text(a.userId || "{user.id}")}) + ">"`);
            case "mention_role":
                return save(`"<@&" + re.sub(r"\\D", "", ${this.text(a.roleId || "")}) + ">"`);
            case "mention_channel":
                return save(`"<#" + re.sub(r"\\D", "", ${this.text(a.channelId || "{channel.id}")}) + ">"`);

            case "set_status":
                return `${i}await B.set_status(ctx.bot, ${this.text(a.text || "")}, ${this.lit(a.statusType || "Playing")}, ${this.lit(a.status || "online")})`;
            case "log":
                return `${i}print(${this.text(a.message || "")})`;
            case "raw_code":
                return C.indentLines(C.dedent(a.code || "pass"), i) || `${i}pass`;
            default:
                this.warnings.push(`${env.label}: block "${a.type}" is not supported by the Python engine and was skipped.`);
                return `${i}pass  # Unsupported block "${a.type}"`;
        }
    }

    preamble(actions, argNames, ind, declared) {
        const lines = [];
        const names = new Set(declared);
        ["user", "member", "guild", "channel"].forEach((b) => {
            if (!names.has(b)) { lines.push(`${b} = ctx.${b}`); names.add(b); }
        });
        argNames.forEach((n) => {
            const id = C.identifier(n, "arg", C.PY_RESERVED);
            lines.push(`${id} = ctx.args.get(${this.lit(n)})`);
            names.add(id);
        });
        const vars = [...new Set([...C.collectVariables(actions)].map((v) => C.identifier(v, "value", C.PY_RESERVED)))].filter((v) => !names.has(v));
        if (vars.length) lines.push(`${vars.join(" = ")} = None`);
        return lines.map((l) => ind + l).join("\n");
    }

    className(prefix, name) {
        return prefix + C.identifier(name, "x", C.PY_RESERVED).replace(/^_+/, "").replace(/(^|_)([a-z])/g, (m, a, b) => b.toUpperCase());
    }

    header() {
        return "# Generated by Botify - edits are overwritten when you regenerate. Use Custom Code blocks for custom logic.\nimport asyncio\nimport random\nimport re\nfrom typing import Optional\n\nimport discord\nfrom discord import app_commands\nfrom discord.ext import commands\n\nimport botify_runtime as B\n";
    }

    commandFile(cmd, className) {
        const name = C.commandName(cmd.name);
        const type = cmd.type || "slash";
        const args = (cmd.arguments || []).filter((a) => a && a.name).map((a) => ({ ...a, name: C.optionName(a.name) }));
        const sorted = [...args.filter((a) => a.required), ...args.filter((a) => !a.required)];
        const env = { label: `Command "${name}"`, key: name };
        const description = C.clampDescription(cmd.description, `Run ${name}`);
        const perms = (cmd.permissions || []).filter(Boolean).map((p) => C.camelToSnake(p));
        const actions = cmd.actions || [];

        let out = this.header() + `\n\nclass ${className}(commands.Cog):\n    def __init__(self, bot):\n        self.bot = bot\n`;

        if (type === "slash" || type === "both") {
            const params = sorted.map((a) => {
                const id = C.identifier(a.name, "arg", C.PY_RESERVED);
                const t = PY_TYPES[a.type] || "str";
                return a.required ? `${id}: ${t}` : `${id}: Optional[${t}] = None`;
            });
            const describe = sorted.map((a) => `${C.identifier(a.name, "arg", C.PY_RESERVED)}=${this.lit(C.clampDescription(a.description, a.name))}`);
            const renames = sorted.filter((a) => C.identifier(a.name, "arg", C.PY_RESERVED) !== a.name).map((a) => `${C.identifier(a.name, "arg", C.PY_RESERVED)}=${this.lit(a.name)}`);
            out += `\n    @app_commands.command(name=${this.lit(name)}, description=${this.lit(description)})\n`;
            if (describe.length) out += `    @app_commands.describe(${describe.join(", ")})\n`;
            if (renames.length) out += `    @app_commands.rename(${renames.join(", ")})\n`;
            if (perms.length) out += `    @app_commands.default_permissions(${perms.map((p) => `${p}=True`).join(", ")})\n`;
            out += `    async def slash(self, interaction: discord.Interaction${params.length ? ", " + params.join(", ") : ""}):\n`;
            out += `        ctx = B.Context(self.bot, interaction=interaction, args={${args.map((a) => `${this.lit(a.name)}: ${C.identifier(a.name, "arg", C.PY_RESERVED)}`).join(", ")}})\n        await self.flow(ctx)\n`;
        }
        if (type === "prefix" || type === "both") {
            const aliases = (cmd.aliases || []).map((x) => C.commandName(x)).filter(Boolean);
            const specs = args.map((a) => `{"name": ${this.lit(a.name)}, "type": ${this.lit(a.type || "string")}}`).join(", ");
            const required = args.filter((a) => a.required).map((a) => this.lit(a.name));
            const usage = `${name} ${args.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`)).join(" ")}`.trim();
            out += `\n    @commands.command(name=${this.lit(name)}${aliases.length ? `, aliases=${JSON.stringify(aliases)}` : ""})\n    async def prefix(self, pctx: commands.Context, *words):\n        ctx = B.Context(self.bot, message=pctx.message, args=await B.prefix_args(pctx, list(words), [${specs}]))\n`;
            if (required.length) out += `        if any(ctx.args.get(n) is None for n in [${required.join(", ")}]):\n            await B.reply(ctx, "ℹ️ Usage: \`" + pctx.prefix + ${this.lit(usage)} + "\`")\n            return\n`;
            out += `        await self.flow(ctx)\n`;
        }

        const guards = [];
        if (cmd.guildOnly !== false) guards.push(`if ctx.guild is None:\n    await B.reply(ctx, "This command only works in servers.", ephemeral=True)\n    return`);
        perms.forEach((p) => guards.push(`if not B.has_permission(ctx, ${this.lit(p)}):\n    await B.reply(ctx, ${this.lit(`⛔ You need the ${p} permission.`)}, ephemeral=True)\n    return`));
        if (Number(cmd.cooldown) > 0) {
            guards.push(`_wait = B.cooldown("cmd:${name}:" + str(ctx.user.id if ctx.user else ""), ${Number(cmd.cooldown)})\nif _wait:\n    await B.reply(ctx, f"⏳ Please wait {_wait}s before using this command again.", ephemeral=True)\n    return`);
        }
        const body = this.actions(actions, env, "        ") || `        await B.reply(ctx, "✅ Command executed.")`;
        out += `\n    async def flow(self, ctx):\n        bot = client = self.bot\n        interaction, message = ctx.interaction, ctx.message\n${guards.map((g) => C.indentLines(g, "        ")).join("\n")}\n${this.preamble(actions, args.map((a) => a.name), "        ", ["bot", "client", "interaction", "message", "ctx", "self"])}\n${body}\n`;
        out += `\n\nasync def setup(bot):\n    await bot.add_cog(${className}(bot))\n`;
        return out.replace(/\n{4,}/g, "\n\n\n");
    }

    eventFile(evt, className) {
        const spec = EVENT_MAP[evt.type];
        if (!spec) {
            this.warnings.push(`Event "${evt.type}" is not supported by the Python engine and was skipped.`);
            return null;
        }
        const env = { label: `Event "${evt.type}"`, key: evt.type };
        const actions = evt.actions || [];
        let body = this.actions(actions, env, "        ");
        if (!body) {
            const defaults = {
                on_ready: '        print(f"✅ {self.bot.user} is online!")',
                on_member_join: '        print(f"👋 {member} joined {member.guild.name}")',
                on_member_leave: '        print(f"🚪 {member} left {member.guild.name}")',
            };
            body = defaults[evt.type] || "        pass";
        }
        const declared = ["bot", "client", "ctx", "self", "message", "emoji", ...spec.params];
        return this.header() + `\n\nclass ${className}(commands.Cog):\n    def __init__(self, bot):\n        self.bot = bot\n\n    @commands.Cog.listener(${this.lit(spec.listener)})\n    async def handler(self${spec.params.map((p) => ", " + p).join("")}):\n${spec.guard ? C.indentLines(spec.guard, "        ") + "\n" : ""}        bot = client = self.bot\n        ctx = ${spec.ctx}\n${this.preamble(actions, [], "        ", declared)}\n${body}\n\n\nasync def setup(bot):\n    await bot.add_cog(${className}(bot))\n`;
    }

    helpFile(settings, commands) {
        const desc = {};
        commands.forEach((c) => { desc[C.commandName(c.name)] = C.clampDescription(c.description, ""); });
        const help = {
            title: settings.title || "Help", description: settings.description || "", color: settings.color || "#5865f2",
            style: settings.style || "select", footer: settings.footer || "", categories: settings.categories || [],
        };
        return this.header() + `\nimport json\n\nHELP = json.loads(${this.lit(JSON.stringify(help))})\nCOMMANDS = json.loads(${this.lit(JSON.stringify(desc))})\n\n\nclass HelpMenu(commands.Cog):\n    def __init__(self, bot):\n        self.bot = bot\n\n    @app_commands.command(name="help", description=${this.lit(C.clampDescription(settings.commandDescription, "Show all commands"))})\n    async def slash(self, interaction: discord.Interaction):\n        await B.help_menu(B.Context(self.bot, interaction=interaction), HELP, COMMANDS)\n\n    @commands.command(name="help")\n    async def prefix(self, pctx: commands.Context):\n        await B.help_menu(B.Context(self.bot, message=pctx.message), HELP, COMMANDS)\n\n\nasync def setup(bot):\n    await bot.add_cog(HelpMenu(bot))\n`;
    }

    mainFile(extensions) {
        const intents = (this.project.settings || {}).intents || {};
        return `# Generated by Botify - https://github.com/erhicaldcDev/Botify
import os
import sys

import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

PREFIX = os.getenv("PREFIX", ${this.lit(this.project.prefix || "!")})
TOKEN = os.getenv("DISCORD_TOKEN", "")
DEV_GUILD_ID = os.getenv("DEV_GUILD_ID", "").strip()

intents = discord.Intents.default()
intents.message_content = ${intents.messageContent !== false ? "True" : "False"}
intents.members = ${intents.members !== false ? "True" : "False"}
intents.presences = ${intents.presences ? "True" : "False"}

EXTENSIONS = ${JSON.stringify(extensions, null, 4)}


class BotifyBot(commands.Bot):
    async def setup_hook(self):
        for ext in EXTENSIONS:
            try:
                await self.load_extension(ext)
            except Exception as e:
                print(f"[Botify] Failed to load {ext}: {e}", file=sys.stderr)
        try:
            if DEV_GUILD_ID:
                guild = discord.Object(id=int(DEV_GUILD_ID))
                self.tree.copy_global_to(guild=guild)
                synced = await self.tree.sync(guild=guild)
                print(f"[Botify] Registered {len(synced)} slash command(s) in server {DEV_GUILD_ID} (instant).")
            else:
                synced = await self.tree.sync()
                print(f"[Botify] Registered {len(synced)} global slash command(s).")
        except Exception as e:
            print(f"[Botify] Failed to register slash commands: {e}", file=sys.stderr)


bot = BotifyBot(command_prefix=commands.when_mentioned_or(PREFIX), intents=intents, help_command=None, case_insensitive=True)


@bot.event
async def on_ready():
    print(f"Bot logged in as {bot.user}")
    print(f"[Botify] Serving {len(bot.guilds)} server(s). Prefix: {PREFIX}")
    print(f"[Botify] Invite link: https://discord.com/oauth2/authorize?client_id={bot.user.id}&scope=bot+applications.commands&permissions=8")


@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    print(f"[Botify] Error in {PREFIX}{ctx.command}: {error}", file=sys.stderr)
    try:
        await ctx.reply("❌ Something went wrong while running this command.")
    except discord.HTTPException:
        pass


@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    print(f"[Botify] Error in /{interaction.command.name if interaction.command else '?'}: {error}", file=sys.stderr)
    try:
        if interaction.response.is_done():
            await interaction.followup.send("❌ Something went wrong while running this command.", ephemeral=True)
        else:
            await interaction.response.send_message("❌ Something went wrong while running this command.", ephemeral=True)
    except discord.HTTPException:
        pass


if __name__ == "__main__":
    if not TOKEN or TOKEN == "YOUR_TOKEN_HERE":
        print("[Botify] No bot token set. Add your token in Settings > Bot Token.", file=sys.stderr)
        sys.exit(78)
    try:
        bot.run(TOKEN, log_handler=None)
    except discord.PrivilegedIntentsRequired:
        print("[Botify] Discord rejected the privileged intents. Enable 'Message Content' and 'Server Members' intents in the Developer Portal (Bot tab), or turn them off in Botify Settings.", file=sys.stderr)
        sys.exit(78)
    except discord.LoginFailure:
        print("[Botify] Invalid bot token. Reset it in the Discord Developer Portal and update it in Settings.", file=sys.stderr)
        sys.exit(78)
`;
    }

    write(outputPath, { commands, events, help }) {
        const files = {};
        files["requirements.txt"] = "discord.py>=2.6.0\npython-dotenv>=1.0.0\n";
        files["botify_runtime.py"] = "# Generated by Botify - runtime helpers\n" + fs.readFileSync(RUNTIME_SRC, "utf-8");
        files["commands/__init__.py"] = "";
        files["events/__init__.py"] = "";
        const extensions = [];
        const usedModules = new Set();
        const uniq = (base) => {
            let m = base;
            let n = 2;
            while (usedModules.has(m)) m = `${base}_${n++}`;
            usedModules.add(m);
            return m;
        };

        commands.forEach((cmd) => {
            const mod = uniq(C.identifier(C.commandName(cmd.name).replace(/-/g, "_"), "command", C.PY_RESERVED));
            files[`commands/${mod}.py`] = this.commandFile(cmd, this.className("Cmd", mod) + (usedModules.size));
            extensions.push(`commands.${mod}`);
        });
        if (help) {
            const mod = uniq("help_menu");
            files[`commands/${mod}.py`] = this.helpFile(help, commands);
            extensions.push(`commands.${mod}`);
        }
        events.forEach((evt) => {
            const mod = uniq(C.identifier(evt.type.replace(/^on_/, ""), "event", C.PY_RESERVED));
            const code = this.eventFile(evt, this.className("Evt", mod) + usedModules.size);
            if (!code) return;
            files[`events/${mod}.py`] = code;
            extensions.push(`events.${mod}`);
        });
        files["main.py"] = this.mainFile(extensions);

        fs.mkdirSync(path.join(outputPath, "commands"), { recursive: true });
        fs.mkdirSync(path.join(outputPath, "events"), { recursive: true });
        Object.entries(files).forEach(([rel, content]) => fs.writeFileSync(path.join(outputPath, rel), content));
        return Object.keys(files);
    }
}

module.exports = { PythonGenerator };
