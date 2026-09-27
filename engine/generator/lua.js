const fs = require("fs");
const path = require("path");
const C = require("./common");

const RUNTIME_SRC = path.join(__dirname, "..", "runtime", "lua", "botify.lua");

const LUA_RESERVED = new Set("and break do else elseif end false for function goto if in local nil not or repeat return then true until while B ctx client message args".split(" "));

// Discordia event name + handler params + context expression
const EVENT_MAP = {
    on_ready: { event: "ready", params: [], ctx: "{ client = client }" },
    on_message: { event: "messageCreate", params: ["message"], ctx: "{ client = client, message = message }", guard: "if message.author.bot then return end" },
    on_message_delete: { event: "messageDelete", params: ["message"], ctx: "{ client = client, channel = message.channel, guild = message.guild, user = message.author }" },
    on_message_update: { event: "messageUpdate", params: ["message"], ctx: "{ client = client, message = message }", guard: "if message.author.bot then return end" },
    on_member_join: { event: "memberJoin", params: ["member"], ctx: "{ client = client, member = member }" },
    on_member_leave: { event: "memberLeave", params: ["member"], ctx: "{ client = client, member = member }" },
    on_reaction_add: { event: "reactionAdd", params: ["reaction", "userId"], ctx: "{ client = client, user = client:getUser(userId), guild = reaction.message.guild, channel = reaction.message.channel }", guard: "local emoji = reaction.emojiName" },
    on_reaction_remove: { event: "reactionRemove", params: ["reaction", "userId"], ctx: "{ client = client, user = client:getUser(userId), guild = reaction.message.guild, channel = reaction.message.channel }", guard: "local emoji = reaction.emojiName" },
    on_guild_join: { event: "guildCreate", params: ["guild"], ctx: "{ client = client, guild = guild }" },
};

const LUA_PERMS = (p) => String(p || "administrator").charAt(0).toLowerCase() + String(p || "administrator").slice(1);

class LuaGenerator {
    constructor(project, options) {
        this.project = project;
        this.warnings = options.warnings;
    }

    lit(s) {
        return '"' + String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")
            .replace(/[\x00-\x1f]/g, (c) => "\\" + c.charCodeAt(0)) + '"';
    }

    tpl(s) {
        const parts = C.splitTemplate(s);
        if (!parts.some((p) => p.expr !== undefined)) return this.lit(s);
        return "(" + parts.map((p) => (p.expr !== undefined ? `B.s(${p.expr})` : this.lit(p.lit))).join(" .. ") + ")";
    }

    text(s) {
        if (s === undefined || s === null || s === "") return '""';
        return `B.text(ctx, ${this.tpl(s)}, __v())`;
    }

    obj(v) {
        if (typeof v === "string") return this.tpl(v);
        if (typeof v === "boolean") return v ? "true" : "false";
        if (v === null || v === undefined) return "nil";
        if (Array.isArray(v)) return "{ " + v.map((x) => this.obj(x)).join(", ") + " }";
        if (typeof v === "object") return "{ " + Object.entries(v).filter(([, x]) => x !== undefined && x !== "").map(([k, x]) => `[${this.lit(k)}] = ${this.obj(x)}`).join(", ") + " }";
        return JSON.stringify(v);
    }

    embedFor(ref, inline) {
        const data = inline || (ref ? C.findEmbed(this.project, ref) : null);
        if (ref && !data) this.warnings.push(`Saved embed "${ref}" was not found - it will be skipped.`);
        if (!data) return "nil";
        const d = { ...data };
        delete d.id; delete d.name;
        return `B.embed(ctx, ${this.obj(d)}, __v())`;
    }

    id(name, fb) {
        return C.identifier(name, fb, LUA_RESERVED);
    }

    actions(list, env, indent) {
        return (list || []).map((raw) => this.action(raw, env, indent)).filter(Boolean).join("\n");
    }

    action(raw, env, i) {
        const a = C.normalizeAction(raw);
        if (!a) return "";
        const i2 = i + "  ";
        const target = C.saveTarget(a) ? this.id(C.saveTarget(a), "value") : null;
        const save = (expr) => (target ? `${i}${target} = ${expr}` : `${i}${expr}`);
        switch (a.type) {
            case "reply":
            case "ephemeral_message":
                return `${i}B.reply(ctx, ${this.text(a.content)}, ${this.embedFor(a.embedRef)})`;
            case "send_message":
                return `${i}B.send(ctx, ${this.text(a.channelId)}, ${this.text(a.content)}, ${this.embedFor(a.embedRef)})`;
            case "create_embed":
                return `${i}B.send(ctx, ${this.text(a.channelId)}, ${this.text(a.content)}, ${this.embedFor(null, a.embed || {})})`;
            case "send_saved_embed":
                return `${i}B.send(ctx, ${this.text(a.channelId)}, ${this.text(a.content)}, ${this.embedFor(a.embedRef)})`;
            case "send_dm":
                return `${i}B.dm(ctx, ${this.text(a.target)}, ${this.text(a.content)}, ${this.embedFor(a.embedRef)})`;
            case "delete_message":
                return `${i}B.deleteMessage(ctx)`;
            case "add_reaction":
                return `${i}B.react(ctx, ${this.text(a.emoji || "✅")})`;
            case "kick_member":
                return `${i}B.kick(ctx, ${this.text(a.target)}, ${this.text(a.reason)})`;
            case "ban_member":
                return `${i}B.ban(ctx, ${this.text(a.target)}, ${this.text(a.reason)}, ${Number(a.deleteDays) || 0})`;
            case "add_role":
            case "remove_role":
                return `${i}B.role(ctx, ${this.text(a.target)}, ${this.text(a.roleId)}, ${a.type === "add_role"})`;
            case "check_permission":
            case "has_role": {
                const cond = a.type === "check_permission"
                    ? `B.hasPermission(ctx, ${this.lit(LUA_PERMS(a.permission))})`
                    : `B.hasRole(ctx, ${this.text(a.target)}, ${this.text(a.roleId)})`;
                const elseCode = this.actions(a.else, env, i2) || `${i2}B.reply(ctx, ${this.text(a.denyMessage || "You can't do that.")})\n${i2}return`;
                return `${i}if ${cond} then\n${this.actions(a.then, env, i2)}\n${i}else\n${elseCode}\n${i}end`;
            }
            case "if_condition": {
                const cond = a.condition && String(a.condition).trim() ? `(${C.toLuaExpr(a.condition)})` : `B.compare(${this.text(a.left ?? "")}, ${this.lit(a.operator || "==")}, ${this.text(a.right ?? "")})`;
                const elseCode = this.actions(a.else, env, i2);
                return `${i}if ${cond} then\n${this.actions(a.then, env, i2)}${elseCode ? `\n${i}else\n${elseCode}` : ""}\n${i}end`;
            }
            case "random_chance": {
                const elseCode = this.actions(a.else, env, i2);
                return `${i}if math.random() * 100 < ${Number(a.chance) || 50} then\n${this.actions(a.then, env, i2)}${elseCode ? `\n${i}else\n${elseCode}` : ""}\n${i}end`;
            }
            case "loop": {
                const v = this.id(a.variable || "i", "i");
                return `${i}for __n = 1, math.min(1000, B.toNumber(${this.text(String(a.times ?? 1))})) do\n${i2}${v} = __n\n${this.actions(a.body, env, i2)}\n${i}end`;
            }
            case "wait":
                return `${i}B.sleep(${Number(a.time) || 1000})`;
            case "stop":
                return `${i}do return end`;
            case "set_variable": {
                const name = this.id(a.name || "variable", "variable");
                const mode = a.mode || "expression";
                if (mode === "text") return `${i}${name} = ${this.text(a.value ?? "")}`;
                if (mode === "number") return `${i}${name} = B.toNumber(${this.text(String(a.value ?? "0"))})`;
                const expr = String(a.value ?? "").trim();
                return `${i}${name} = ${expr === "" ? '""' : `(${C.toLuaExpr(expr)})`}`;
            }
            case "math": {
                const name = this.id(a.name || "count", "count");
                const amt = `B.toNumber(${this.text(String(a.amount ?? "1"))})`;
                if (a.op === "=") return `${i}${name} = ${amt}`;
                const op = ["+", "-", "*", "/"].includes(a.op) ? a.op : "+";
                return `${i}${name} = B.toNumber(${name}) ${op} ${amt}`;
            }
            case "random_number":
                return save(`B.randomInt(${Number(a.min) || 0}, ${Number(a.max) || 100})`);
            case "random_choice":
                return save(`B.pick(${this.text(a.choices || "")})`);
            case "get_user_info":
                return save(`B.userInfo(ctx, ${this.text(a.target)})`);
            case "set_status":
                return `${i}B.setStatus(ctx.client, ${this.text(a.text || "")}, ${this.lit(a.statusType || "Playing")}, ${this.lit(a.status || "online")})`;
            case "log":
                return `${i}print(${this.text(a.message || "")})`;
            case "raw_code":
                return C.indentLines(C.dedent(a.code || ""), i);
            default:
                this.warnings.push(`${env.label}: block "${a.type}" is not supported by the Lua engine and was skipped.`);
                return `${i}-- Unsupported block "${a.type}" skipped`;
        }
    }

    preamble(actions, argNames, ind, declared) {
        const names = new Set(declared);
        const lines = [];
        const builtins = ["user", "member", "guild", "channel"].filter((b) => !names.has(b));
        if (builtins.length) lines.push(`local ${builtins.join(", ")} = ${builtins.map((b) => `ctx.${b}`).join(", ")}`);
        builtins.forEach((b) => names.add(b));
        const argLocals = argNames.map((n) => this.id(n, "arg")).filter((n) => !names.has(n));
        argLocals.forEach((n) => { lines.push(`local ${n} = ctx.args[${this.lit(n)}]`); names.add(n); });
        const vars = [...new Set([...C.collectVariables(actions)].map((v) => this.id(v, "value")))].filter((v) => !names.has(v));
        if (vars.length) lines.push(`local ${vars.join(", ")}`);
        const snap = [...argLocals, ...vars];
        lines.push(`local function __v() local t = {} for k, v in pairs(ctx.args) do t[k] = v end ${snap.map((n) => `t[${this.lit(n)}] = ${n}`).join(" ")} return t end`);
        return lines.map((l) => ind + l).join("\n");
    }

    commandModule(cmd) {
        const name = C.commandName(cmd.name);
        if ((cmd.type || "slash") === "slash") {
            this.warnings.push(`Command "${name}": Discordia has no slash command support - it is generated as a prefix command.`);
        }
        const args = (cmd.arguments || []).filter((a) => a && a.name).map((a) => ({ name: C.optionName(a.name), type: a.type || "string" }));
        const env = { label: `Command "${name}"`, key: name };
        const actions = cmd.actions || [];
        const specs = "{ " + args.map((a) => `{ name = ${this.lit(a.name)}, type = ${this.lit(a.type)} }`).join(", ") + " }";
        const body = this.actions(actions, env, "    ") || `    B.reply(ctx, "✅ Command executed.")`;
        const perms = (cmd.permissions || []).filter(Boolean);
        const permCheck = perms.map((p) => `    if not B.hasPermission(ctx, ${this.lit(LUA_PERMS(p))}) then return B.reply(ctx, ${this.lit(`⛔ You need the ${p} permission.`)}) end`).join("\n");
        return `-- Generated by Botify\nlocal B = require("../botify")\n\nreturn {\n  name = ${this.lit(name)},\n  aliases = { ${(cmd.aliases || []).map((x) => this.lit(C.commandName(x))).join(", ")} },\n  description = ${this.lit(C.clampDescription(cmd.description, name))},\n  run = function(message, words, client)\n    local ctx = B.context({ client = client, message = message, args = B.prefixArgs(message, words, ${specs}) })\n${permCheck ? permCheck + "\n" : ""}${this.preamble(actions, args.map((a) => a.name), "    ", ["message", "words", "client", "ctx"])}\n${body}\n  end,\n}\n`;
    }

    eventModule(evt) {
        const spec = EVENT_MAP[evt.type];
        if (!spec) {
            this.warnings.push(`Event "${evt.type}" is not supported by the Lua engine and was skipped.`);
            return null;
        }
        const env = { label: `Event "${evt.type}"`, key: evt.type };
        const actions = evt.actions || [];
        const body = this.actions(actions, env, "    ") || (evt.type === "on_ready" ? '    print("Bot is ready as " .. client.user.tag)' : "    -- no actions");
        return `-- Generated by Botify\nlocal B = require("../botify")\n\nreturn function(client)\n  client:on(${this.lit(spec.event)}, function(${spec.params.join(", ")})\n${spec.guard ? "    " + spec.guard + "\n" : ""}    local ctx = B.context(${spec.ctx})\n${this.preamble(actions, [], "    ", ["client", "ctx", "message", "emoji", ...spec.params])}\n${body}\n  end)\nend\n`;
    }

    write(outputPath, { commands, events }) {
        const files = {};
        files["botify.lua"] = "-- Generated by Botify - runtime helpers\n" + fs.readFileSync(RUNTIME_SRC, "utf-8");
        const cmdMods = [];
        const used = new Set();
        commands.forEach((cmd) => {
            let mod = C.identifier(C.commandName(cmd.name).replace(/-/g, "_"), "command", LUA_RESERVED);
            let n = 2;
            const base = mod;
            while (used.has(mod)) mod = `${base}_${n++}`;
            used.add(mod);
            files[`commands/${mod}.lua`] = this.commandModule(cmd);
            cmdMods.push(mod);
        });
        const evtMods = [];
        events.forEach((evt, idx) => {
            const code = this.eventModule(evt);
            if (!code) return;
            const mod = `${evt.type.replace(/^on_/, "")}_${idx + 1}`;
            files[`events/${mod}.lua`] = code;
            evtMods.push(mod);
        });
        const intents = (this.project.settings || {}).intents || {};
        files["main.lua"] = `-- Generated by Botify - run with: luvit main.lua
local discordia = require("discordia")
local B = require("./botify")
local env = B.loadEnv(".env")

local client = discordia.Client()
${intents.messageContent !== false ? "client:enableIntents(discordia.enums.gatewayIntent.messageContent)\n" : ""}${intents.members !== false ? "client:enableIntents(discordia.enums.gatewayIntent.guildMembers)\n" : ""}
local PREFIX = env.PREFIX or ${this.lit(this.project.prefix || "!")}
local commands = {}
for _, name in ipairs({ ${cmdMods.map((m) => this.lit(m)).join(", ")} }) do
  local ok, cmd = pcall(require, "./commands/" .. name)
  if ok then
    commands[cmd.name] = cmd
    for _, alias in ipairs(cmd.aliases or {}) do commands[alias] = cmd end
  else
    print("[Botify] Failed to load command " .. name .. ": " .. tostring(cmd))
  end
end

for _, name in ipairs({ ${evtMods.map((m) => this.lit(m)).join(", ")} }) do
  local ok, register = pcall(require, "./events/" .. name)
  if ok then register(client) else print("[Botify] Failed to load event " .. name .. ": " .. tostring(register)) end
end

client:on("ready", function()
  print("Bot logged in as " .. client.user.tag)
  print("[Botify] Invite link: https://discord.com/oauth2/authorize?client_id=" .. client.user.id .. "&scope=bot&permissions=8")
end)

client:on("messageCreate", function(message)
  if message.author.bot then return end
  local content = message.content
  if content:sub(1, #PREFIX):lower() ~= PREFIX:lower() then return end
  local words = {}
  for word in content:sub(#PREFIX + 1):gmatch("%S+") do table.insert(words, word) end
  local name = table.remove(words, 1)
  local cmd = name and commands[name:lower()]
  if not cmd then return end
  local ok, err = pcall(cmd.run, message, words, client)
  if not ok then
    print("[Botify] Error in " .. PREFIX .. name .. ": " .. tostring(err))
    message:reply("❌ Something went wrong while running this command.")
  end
end)

local token = env.DISCORD_TOKEN
if not token or token == "" or token == "YOUR_TOKEN_HERE" then
  print("[Botify] No bot token set. Add your token in Settings > Bot Token.")
  os.exit(78)
end
client:run("Bot " .. token)
`;
        files["package.lua"] = `return {\n  name = ${this.lit(C.commandName(this.project.name))},\n  version = "1.0.0",\n  dependencies = { "SinisterRectus/discordia" },\n}\n`;
        fs.mkdirSync(path.join(outputPath, "commands"), { recursive: true });
        fs.mkdirSync(path.join(outputPath, "events"), { recursive: true });
        Object.entries(files).forEach(([rel, content]) => fs.writeFileSync(path.join(outputPath, rel), content));
        return Object.keys(files);
    }
}

module.exports = { LuaGenerator };
