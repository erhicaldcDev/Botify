const fs = require("fs");
const path = require("path");

class CodeGenerator {
    async generate(project, outputPath, token, plugins = []) {
        this.plugins = plugins;
        switch (project.engine) {
            case "node":
                this._generateNode(project, outputPath, token);
                break;
            case "python":
                this._generatePython(project, outputPath, token);
                break;
            case "lua":
                this._generateLua(project, outputPath, token);
                break;
        }
    }

    _generateNode(project, outputPath, token) {
        const commandsDir = path.join(outputPath, "commands");
        const eventsDir = path.join(outputPath, "events");
        fs.mkdirSync(commandsDir, { recursive: true });
        fs.mkdirSync(eventsDir, { recursive: true });

        const pluginLogics = (this.plugins || []).map(p => {
            try {
                const mainPath = path.join(p.path, p.main);
                if (fs.existsSync(mainPath)) {
                    delete require.cache[require.resolve(mainPath)];
                    return require(mainPath);
                }
            } catch (e) {
                console.error(`Failed to load plugin logic: ${p.name}`, e);
            }
            return null;
        }).filter(Boolean);

        const packageJson = {
            name: project.name.toLowerCase().replace(/\s+/g, "-"),
            version: "1.0.0",
            description: `Discord bot: ${project.name}`,
            main: "index.js",
            dependencies: {
                "discord.js": "^14.16.3",
                "better-sqlite3": "^11.7.0",
                dotenv: "^16.4.7",
                "node-fetch": "^2.7.0"
            },
        };

        pluginLogics.forEach(logic => {
            if (logic.dependencies) {
                Object.assign(packageJson.dependencies, logic.dependencies);
            }
        });

        fs.writeFileSync(
            path.join(outputPath, "package.json"),
            JSON.stringify(packageJson, null, 2)
        );

        fs.writeFileSync(
            path.join(outputPath, ".env"),
            `DISCORD_TOKEN=${token || "YOUR_TOKEN_HERE"}\nPREFIX=${project.prefix || "!"}\n`
        );

        const slashCommands = [...(project.commands || []).filter((c) => c.type === "slash")];
        const prefixCommands = [...(project.commands || []).filter((c) => c.type === "prefix")];
        const events = [...(project.events || [])];

        pluginLogics.forEach(logic => {
            if (logic.commands) {
                logic.commands.forEach(cmd => {
                    if (cmd.type === "slash") slashCommands.push(cmd);
                    else prefixCommands.push(cmd);
                });
            }
            if (logic.events) {
                logic.events.forEach(evt => {
                    evt.enabled = true;
                    events.push(evt);
                });
            }
        });

        if (project.helpSettings) {
            const helpCmd = {
                name: "help",
                description: "View the list of available commands",
                type: "slash",
                isHelp: true,
                actions: [
                    {
                        type: "create_embed",
                        embed: {
                            title: project.helpSettings.title || "Help Menu",
                            description: project.helpSettings.description || "Commands list",
                            color: project.helpSettings.color || "#7c6aef",
                            fields: project.helpSettings.categories.map(cat => ({
                                name: `${cat.icon || ""} ${cat.name}`,
                                value: cat.commands.map(c => `\`${c}\``).join(", ") || "No commands",
                                inline: false
                            }))
                        }
                    }
                ]
            };
            slashCommands.push(helpCmd);
        }

        let indexJs = `const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();
const prefix = process.env.PREFIX || "${project.prefix || "!"}";

const commandFiles = fs.readdirSync(path.join(__dirname, "commands")).filter(f => f.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(path.join(__dirname, "commands", file));
  if (command.data) {
    client.commands.set(command.data.name, command);
  } else if (command.name) {
    client.commands.set(command.name, command);
  }
}

const eventFiles = fs.readdirSync(path.join(__dirname, "events")).filter(f => f.endsWith(".js"));
for (const file of eventFiles) {
  const event = require(path.join(__dirname, "events", file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

${pluginLogics.filter(l => l.hooks?.on_init).map(l => `
try {
  const initHook = ${l.hooks.on_init.toString()};
  initHook(client);
} catch (e) {
  console.error("Plugin Hook Error (on_init):", e);
}
`).join("\n")}

const cooldowns = new Map();

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command || !command.execute) return;
  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    const reply = { content: "An error occurred.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  
  ${pluginLogics.filter(l => l.hooks?.on_message).map(l => `
  try {
    const hook = ${l.hooks.on_message.toString()};
    await hook(message, client);
  } catch (e) {
    console.error("Plugin Hook Error (on_message):", e);
  }
  `).join("\n")}

  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  if (!command || !command.run) return;
  try {
    await command.run(message, args, client);
  } catch (error) {
    console.error(error);
    message.reply("An error occurred.");
  }
});

async function registerSlashCommands() {
  const slashCmds = [];
  client.commands.forEach((cmd) => {
    if (cmd.data) slashCmds.push(cmd.data.toJSON ? cmd.data.toJSON() : cmd.data);
  });
  if (slashCmds.length === 0) return;
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCmds });
    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
}

client.once("ready", () => {
  console.log(\`Bot logged in as \${client.user.tag}\`);
  registerSlashCommands();
});

client.login(process.env.DISCORD_TOKEN);
`;
        fs.writeFileSync(path.join(outputPath, "index.js"), indexJs);

        slashCommands.forEach((cmd) => {
            const cmdCode = this._generateNodeSlashCommand(cmd, project);
            fs.writeFileSync(
                path.join(commandsDir, `${cmd.name}.js`),
                cmdCode
            );
        });

        prefixCommands.forEach((cmd) => {
            const cmdCode = this._generateNodePrefixCommand(cmd, project);
            fs.writeFileSync(
                path.join(commandsDir, `${cmd.name}.js`),
                cmdCode
            );
        });

        const enabledEvents = events.filter((e) => e.enabled);
        enabledEvents.forEach((evt) => {
            const evtCode = this._generateNodeEvent(evt, project);
            const evtName = evt.type.replace("on_", "");
            fs.writeFileSync(path.join(eventsDir, `${evtName}.js`), evtCode);
        });

        if (enabledEvents.length === 0) {
            fs.writeFileSync(
                path.join(eventsDir, "ready.js"),
                `module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    console.log(\`Ready! Logged in as \${client.user.tag}\`);
  },
};
`
            );
        }
    }

    _generateNodeSlashCommand(cmd, project) {
        let optionsCode = "";
        if (cmd.arguments && cmd.arguments.length > 0) {
            optionsCode = cmd.arguments
                .map((arg) => {
                    switch (arg.type) {
                        case "string":
                            return `    .addStringOption(opt => opt.setName("${arg.name}").setDescription("${arg.description || arg.name}").setRequired(${arg.required || false}))`;
                        case "integer":
                            return `    .addIntegerOption(opt => opt.setName("${arg.name}").setDescription("${arg.description || arg.name}").setRequired(${arg.required || false}))`;
                        case "user":
                            return `    .addUserOption(opt => opt.setName("${arg.name}").setDescription("${arg.description || arg.name}").setRequired(${arg.required || false}))`;
                        case "boolean":
                            return `    .addBooleanOption(opt => opt.setName("${arg.name}").setDescription("${arg.description || arg.name}").setRequired(${arg.required || false}))`;
                        case "channel":
                            return `    .addChannelOption(opt => opt.setName("${arg.name}").setDescription("${arg.description || arg.name}").setRequired(${arg.required || false}))`;
                        case "role":
                            return `    .addRoleOption(opt => opt.setName("${arg.name}").setDescription("${arg.description || arg.name}").setRequired(${arg.required || false}))`;
                        default:
                            return `    .addStringOption(opt => opt.setName("${arg.name}").setDescription("${arg.description || arg.name}").setRequired(${arg.required || false}))`;
                    }
                })
                .join("\n");
        }

        let actionCode = this._generateNodeActions(cmd.actions || [], "interaction");

        let permCheck = "";
        if (cmd.permissions && cmd.permissions.length > 0) {
            const perms = cmd.permissions.map((p) => `"${p}"`).join(", ");
            permCheck = `
  if (!interaction.member.permissions.has([${perms}])) {
    return interaction.reply({ content: "You lack permissions.", ephemeral: true });
  }`;
        }

        let cooldownCode = "";
        if (cmd.cooldown && cmd.cooldown > 0) {
            cooldownCode = `
const cooldowns = new Map();
`;
            permCheck += `
  const now = Date.now();
  const cdKey = \`\${interaction.user.id}-${cmd.name}\`;
  if (cooldowns.has(cdKey)) {
    const expiry = cooldowns.get(cdKey) + ${cmd.cooldown * 1000};
    if (now < expiry) {
      const remaining = ((expiry - now) / 1000).toFixed(1);
      return interaction.reply({ content: \`Cooldown: \${remaining}s remaining.\`, ephemeral: true });
    }
  }
  cooldowns.set(cdKey, now);`;
        }

        return `const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
${cooldownCode}
module.exports = {
  data: new SlashCommandBuilder()
    .setName("${cmd.name}")
    .setDescription("${cmd.description || cmd.name}")
${optionsCode ? optionsCode : ""},
  async execute(interaction, client) {${permCheck}
${actionCode || '    await interaction.reply("Command executed.");'}
  },
};
`;
    }

    _generateNodePrefixCommand(cmd, project) {
        let actionCode = this._generateNodeActions(cmd.actions || [], "message");

        let permCheck = "";
        if (cmd.permissions && cmd.permissions.length > 0) {
            const perms = cmd.permissions.map((p) => `"${p}"`).join(", ");
            permCheck = `
  if (!message.member.permissions.has([${perms}])) {
    return message.reply("You lack permissions.");
  }`;
        }

        return `module.exports = {
  name: "${cmd.name}",
  description: "${cmd.description || cmd.name}",
  async run(message, args, client) {${permCheck}
${actionCode || '    message.reply("Command executed.");'}
  },
};
`;
    }

    _resolveString(str) {
        if (typeof str !== 'string') return JSON.stringify(str);
        if (str.includes('${')) {
            return `\`${str}\``;
        }
        return JSON.stringify(str);
    }

    _generateNodeActions(actions, ctx, indentAmount = 4) {
        if (!actions) return "";

        if (!Array.isArray(actions)) throw new Error("Invalid project structure: actions block must be an array.");
        if (actions.length === 0) return "";
        let _dbCounter = 0;
        return actions
            .map((action) => {
                const indent = " ".repeat(indentAmount);
                switch (action.type) {
                    case "send_message":
                    case "reply":
                        return `${indent}if (typeof interaction !== "undefined") { await interaction.reply(${this._resolveString(action.content || "Hello!")}); }\n${indent}else if (typeof message !== "undefined") { await message.reply(${this._resolveString(action.content || "Hello!")}); }\n${indent}else if (typeof member !== "undefined" && member.guild.systemChannel) { await member.guild.systemChannel.send(${this._resolveString(action.content || "Hello!")}); }`;
                    case "add_role": {
                        const roleId = action.roleId || "ROLE_ID";
                        return ctx === "interaction"
                            ? `${indent}const member = interaction.member;\n${indent}await member.roles.add("${roleId}").catch(()=>console.log("Missing permissions to add role"));`
                            : `${indent}await message.member.roles.add("${roleId}").catch(()=>console.log("Missing permissions"));`;
                    }
                    case "remove_role": {
                        const roleId = action.roleId || "ROLE_ID";
                        return ctx === "interaction"
                            ? `${indent}await interaction.member.roles.remove("${roleId}");`
                            : `${indent}await message.member.roles.remove("${roleId}");`;
                    }
                    case "kick_member":
                        return ctx === "interaction"
                            ? `${indent}const target = interaction.options.getUser("user") || interaction.user;\n${indent}const gMember = await interaction.guild.members.fetch(target.id);\n${indent}await gMember.kick(${JSON.stringify(action.reason || "Kicked")});`
                            : `${indent}const target = message.mentions.members.first();\n${indent}if (target) await target.kick(${JSON.stringify(action.reason || "Kicked")});`;
                    case "ban_member":
                        return ctx === "interaction"
                            ? `${indent}const banTarget = interaction.options.getUser("user") || interaction.user;\n${indent}const banMember = await interaction.guild.members.fetch(banTarget.id);\n${indent}await banMember.ban({ reason: ${JSON.stringify(action.reason || "Banned")} });`
                            : `${indent}const banTarget = message.mentions.members.first();\n${indent}if (banTarget) await banTarget.ban({ reason: ${JSON.stringify(action.reason || "Banned")} });`;
                    case "create_embed": {
                        const embed = action.embed || {};
                        let code = `${indent}const embed = new EmbedBuilder()`;
                        if (embed.title) code += `\n${indent}  .setTitle(${this._resolveString(embed.title)})`;
                        if (embed.description) code += `\n${indent}  .setDescription(${this._resolveString(embed.description)})`;
                        if (embed.color) code += `\n${indent}  .setColor(${JSON.stringify(embed.color)})`;
                        if (embed.footer) code += `\n${indent}  .setFooter({ text: ${this._resolveString(embed.footer)} })`;
                        if (embed.thumbnail) code += `\n${indent}  .setThumbnail(${this._resolveString(embed.thumbnail)})`;
                        if (embed.image) code += `\n${indent}  .setImage(${this._resolveString(embed.image)})`;
                        if (embed.fields && embed.fields.length > 0) {
                            embed.fields.forEach((f) => {
                                code += `\n${indent}  .addFields({ name: ${this._resolveString(f.name)}, value: ${this._resolveString(f.value)}, inline: ${f.inline || false} })`;
                            });
                        }
                        code += ";";
                        code += `\n${indent}if (typeof interaction !== "undefined") { await interaction.reply({ embeds: [embed] }); }\n${indent}else if (typeof message !== "undefined") { await message.reply({ embeds: [embed] }); }\n${indent}else if (typeof member !== "undefined" && member.guild.systemChannel) { await member.guild.systemChannel.send({ embeds: [embed] }); }`;
                        return code;
                    }
                    case "if_condition": {
                        const condition = action.condition || "true";
                        const thenActions = this._generateNodeActions(action.then || [], ctx, indentAmount + 4);
                        const elseActions = this._generateNodeActions(action.else || [], ctx, indentAmount + 4);
                        return `${indent}if (${condition}) {\n${thenActions}\n${indent}}${elseActions ? ` else {\n${elseActions}\n${indent}}` : ""}`;
                    }
                    case "set_variable":
                        return `${indent}const ${action.name || "variable"} = ${JSON.stringify(action.value || "")};`;
                    case "api_request":
                        return `${indent}const apiResponse = await fetch(${JSON.stringify(action.url || "https://api.example.com")}, { method: ${JSON.stringify(action.method || "GET")} });\n${indent}let apiData;\n${indent}try { apiData = await apiResponse.json(); } catch { apiData = await apiResponse.text(); }`;
                    case "db_read": {
                        const dbId = _dbCounter++;
                        return `${indent}const Database_${dbId} = require("better-sqlite3");\n${indent}const db_${dbId} = new Database_${dbId}("./data.db");\n${indent}const rows_${dbId} = db_${dbId}.prepare(${JSON.stringify(action.query || "SELECT * FROM data")}).all();\n${indent}db_${dbId}.close();`;
                    }
                    case "db_write": {
                        const dbId = _dbCounter++;
                        return `${indent}const Database_${dbId} = require("better-sqlite3");\n${indent}const db_${dbId} = new Database_${dbId}("./data.db");\n${indent}db_${dbId}.prepare(${JSON.stringify(action.query || "INSERT INTO data (key, value) VALUES (?, ?)")}).run(${JSON.stringify(action.params || [])});\n${indent}db_${dbId}.close();`;
                    }
                    case "send_await_interaction": {
                        const time = action.time || 30000;
                        const saveTo = action.saveTo || "interaction_result";
                        const content = this._resolveString(action.content || "Please interact");
                        const components = action.components || [];
                        const btnCode = components.map(c => `new (require('discord.js').ButtonBuilder)().setCustomId('${c.id}').setLabel('${c.label}').setStyle(${c.style || 1})`).join(',');
                        return `${indent}const _row = new (require('discord.js').ActionRowBuilder)().addComponents(${btnCode});\n${indent}const _msg = await ${ctx === "interaction" ? "interaction.reply" : "message.reply"}({ content: ${content}, components: [_row], fetchReply: true });\n${indent}let ${saveTo} = null;\n${indent}try {\n${indent}    const _col = await _msg.awaitMessageComponent({ filter: (i) => i.user.id === ${ctx === "interaction" ? "interaction.user.id" : "message.author.id"}, time: ${time} });\n${indent}    ${saveTo} = _col.customId;\n${indent}    await _col.deferUpdate().catch(() => {});\n${indent}} catch(e) {\n${indent}    ${saveTo} = "timeout";\n${indent}}`;
                    }
                    case "ephemeral_message":
                        return `${indent}if (typeof interaction !== "undefined") {\n${indent}    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: ${this._resolveString(action.content)}, ephemeral: true });\n${indent}    else await interaction.reply({ content: ${this._resolveString(action.content)}, ephemeral: true });\n${indent}}`;
                    case "check_permission": {
                        const perm = action.permission || "Administrator";
                        return `${indent}if (!${ctx === "interaction" ? "interaction.member.permissions" : "message.member.permissions"}.has("${perm}")) return ${ctx === "interaction" ? "interaction.reply({ content: 'Missing permission: "+perm+"', ephemeral: true })" : "message.reply('Missing permission: "+perm+"')"};`;
                    }
                    case "has_role": {
                        const roleId = action.roleId || "ROLE_ID";
                        return `${indent}if (!${ctx === "interaction" ? "interaction.member.roles.cache" : "message.member.roles.cache"}.has("${roleId}")) return ${ctx === "interaction" ? "interaction.reply({ content: 'Missing required role.', ephemeral: true })" : "message.reply('Missing required role.')"};`;
                    }
                    case "cooldown": {
                        const seconds = action.time || 5;
                        return `${indent}if (!cooldowns.has("${ctx === "interaction" ? "interaction.commandName" : "message.content.split(' ')[0]"}")) cooldowns.set("${ctx === "interaction" ? "interaction.commandName" : "message.content.split(' ')[0]"}", new Map());\n${indent}const timestamps = cooldowns.get("${ctx === "interaction" ? "interaction.commandName" : "message.content.split(' ')[0]"}");\n${indent}const now = Date.now();\n${indent}if (timestamps.has(${ctx === "interaction" ? "interaction.user.id" : "message.author.id"})) {\n${indent}  const expiration = timestamps.get(${ctx === "interaction" ? "interaction.user.id" : "message.author.id"}) + ${seconds * 1000};\n${indent}  if (now < expiration) return ${ctx === "interaction" ? "interaction.reply({ content: 'Wait slow down!', ephemeral: true })" : "message.reply('Wait slow down!')"};\n${indent}}\n${indent}timestamps.set(${ctx === "interaction" ? "interaction.user.id" : "message.author.id"}, now);`;
                    }
                    case "get_user_info": {
                        const saveTo = action.saveTo || "userInfo";
                        const target = ctx === "interaction" ? "interaction.user" : "message.author";
                        return `${indent}const ${saveTo} = { id: ${target}.id, tag: ${target}.tag, avatar: ${target}.displayAvatarURL() };`;
                    }
                    case "delete_message":
                        return `${indent}if (typeof interaction !== "undefined") { await interaction.deleteReply().catch(() => {}); }\n${indent}else if (typeof message !== "undefined") { await message.delete().catch(() => {}); }`;
                    case "send_dm":
                        return `${indent}const dmTarget = ${ctx === "interaction" ? "interaction.user" : "message.author"};\n${indent}await dmTarget.send(${this._resolveString(action.content || "Hello in DMs!")}).catch(() => console.log("Can't send DM to user"));`;
                    case "add_reaction":
                        return `${indent}if (typeof message !== "undefined") { await message.react("${action.emoji || "✅"}").catch(() => {}); }\n${indent}else if (typeof interaction !== "undefined") { const msg = await interaction.fetchReply(); await msg.react("${action.emoji || "✅"}").catch(() => {}); }`;
                    case "random_chance": {
                        const chance = action.chance || 50;
                        const thenActions = this._generateNodeActions(action.then || [], ctx, indentAmount + 4);
                        const elseActions = this._generateNodeActions(action.else || [], ctx, indentAmount + 4);
                        return `${indent}if (Math.random() * 100 < ${chance}) {\n${thenActions}\n${indent}}${elseActions ? ` else {\n${elseActions}\n${indent}}` : ""}`;
                    }
                    case "wait":
                        return `${indent}await new Promise(r => setTimeout(r, ${action.time || 1000}));`;
                    case "raw_code":
                        return (action.code || "").split('\n').map(l => indent + l).join('\n') || "";
                    default:
                        return `${indent}Unknown action`;
                }
            })
            .filter(Boolean)
            .join("\n");
    }

    _generateNodeEvent(evt, project) {
        const eventNameMap = {
            on_ready: "ready",
            on_message: "messageCreate",
            on_member_join: "guildMemberAdd",
            on_member_leave: "guildMemberRemove",
            on_interaction: "interactionCreate",
            on_reaction_add: "messageReactionAdd",
        };

        const name = eventNameMap[evt.type] || evt.type.replace("on_", "");
        const isOnce = evt.type === "on_ready";

        let paramsList;
        switch (evt.type) {
            case "on_ready":
                paramsList = "client";
                break;
            case "on_message":
                paramsList = "message, client";
                break;
            case "on_member_join":
            case "on_member_leave":
                paramsList = "member, client";
                break;
            case "on_interaction":
                paramsList = "interaction, client";
                break;
            case "on_reaction_add":
                paramsList = "reaction, user, client";
                break;
            default:
                paramsList = "client";
        }

        let actionCode = "";
        if (evt.actions && evt.actions.length > 0) {
            actionCode = this._generateNodeActions(evt.actions, evt.type === "on_message" ? "message" : "interaction");
        } else {
            switch (evt.type) {
                case "on_ready":
                    actionCode = "    console.log(`Bot is online as ${client.user.tag}`);";
                    break;
                case "on_message":
                    actionCode = "    if (message.author.bot) return;";
                    break;
                case "on_member_join":
                    actionCode = "    console.log(`${member.user.tag} joined the server`);";
                    break;
                case "on_member_leave":
                    actionCode = "    console.log(`${member.user.tag} left the server`);";
                    break;
                case "on_reaction_add":
                    actionCode = "    console.log(`${user.tag} reacted with ${reaction.emoji.name}`);";
                    break;
                default:
                    actionCode = "    return;";
            }
        }

        return `const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "${name}",
  once: ${isOnce},
  execute(${paramsList}) {
${actionCode}
  },
};
`;
    }

    _generatePython(project, outputPath, token) {
        const commandsDir = path.join(outputPath, "commands");
        const eventsDir = path.join(outputPath, "events");
        fs.mkdirSync(commandsDir, { recursive: true });
        fs.mkdirSync(eventsDir, { recursive: true });

        fs.writeFileSync(
            path.join(outputPath, "requirements.txt"),
            "discord.py>=2.4.0\npython-dotenv>=1.0.0\naiosqlite>=0.20.0\n"
        );

        fs.writeFileSync(
            path.join(outputPath, ".env"),
            `DISCORD_TOKEN=${token || "YOUR_TOKEN_HERE"}\nPREFIX=${project.prefix || "!"}\n`
        );

        fs.writeFileSync(path.join(commandsDir, "__init__.py"), "");
        fs.writeFileSync(path.join(eventsDir, "__init__.py"), "");

        const slashCommands = (project.commands || []).filter(
            (c) => c.type === "slash"
        );
        const prefixCommands = (project.commands || []).filter(
            (c) => c.type === "prefix"
        );

        let cogLoads = "";
        const allCmds = [...slashCommands, ...prefixCommands];
        allCmds.forEach((cmd) => {
            cogLoads += `    await bot.load_extension("commands.${cmd.name}")\n`;
        });

        const enabledEvents = (project.events || []).filter((e) => e.enabled);
        enabledEvents.forEach((evt) => {
            const evtName = evt.type.replace("on_", "");
            cogLoads += `    await bot.load_extension("events.${evtName}")\n`;
        });

        let mainPy = `import discord
from discord.ext import commands
from discord import app_commands
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.reactions = True

bot = commands.Bot(command_prefix=os.getenv("PREFIX", "${project.prefix || "!"}"), intents=intents)

async def load_extensions():
${cogLoads || '    pass'}

@bot.event
async def on_ready():
    print(f"Bot logged in as {bot.user}")
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} slash commands")
    except Exception as e:
        print(f"Failed to sync commands: {e}")

async def main():
    async with bot:
        await load_extensions()
        await bot.start(os.getenv("DISCORD_TOKEN"))

asyncio.run(main())
`;
        fs.writeFileSync(path.join(outputPath, "main.py"), mainPy);

        slashCommands.forEach((cmd) => {
            const code = this._generatePythonSlashCommand(cmd);
            fs.writeFileSync(path.join(commandsDir, `${cmd.name}.py`), code);
        });

        prefixCommands.forEach((cmd) => {
            const code = this._generatePythonPrefixCommand(cmd);
            fs.writeFileSync(path.join(commandsDir, `${cmd.name}.py`), code);
        });

        enabledEvents.forEach((evt) => {
            const code = this._generatePythonEvent(evt);
            const evtName = evt.type.replace("on_", "");
            fs.writeFileSync(path.join(eventsDir, `${evtName}.py`), code);
        });
    }

    _generatePythonSlashCommand(cmd) {
        let params = "";
        if (cmd.arguments && cmd.arguments.length > 0) {
            params = cmd.arguments
                .map((arg) => {
                    const pyType = arg.type === "integer" ? "int" : "str";
                    return `${arg.name}: ${pyType}`;
                })
                .join(", ");
            if (params) params = ", " + params;
        }

        let actionCode = this._generatePythonActions(cmd.actions || [], "interaction");

        let permCheck = "";
        if (cmd.permissions && cmd.permissions.length > 0) {
            permCheck = `\n    if not interaction.user.guild_permissions.administrator:\n        await interaction.response.send_message("You lack permissions.", ephemeral=True)\n        return`;
        }

        return `import discord
from discord.ext import commands
from discord import app_commands

class ${this._capitalize(cmd.name)}(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="${cmd.name}", description="${cmd.description || cmd.name}")
    async def ${cmd.name}(self, interaction: discord.Interaction${params}):${permCheck}
${actionCode || '        await interaction.response.send_message("Command executed.")'}

async def setup(bot):
    await bot.add_cog(${this._capitalize(cmd.name)}(bot))
`;
    }

    _generatePythonPrefixCommand(cmd) {
        let actionCode = this._generatePythonActions(cmd.actions || [], "ctx");

        return `import discord
from discord.ext import commands

class ${this._capitalize(cmd.name)}(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="${cmd.name}")
    async def ${cmd.name}(self, ctx, *args):
${actionCode || '        await ctx.send("Command executed.")'}

async def setup(bot):
    await bot.add_cog(${this._capitalize(cmd.name)}(bot))
`;
    }

    _generatePythonActions(actions, ctx, indentAmount = 8) {
        if (!Array.isArray(actions)) throw new Error("Invalid project structure: actions block must be an array.");
        if (actions.length === 0) return "";
        return actions
            .map((action) => {
                const indent = " ".repeat(indentAmount);
                switch (action.type) {
                    case "send_message":
                        return ctx === "interaction"
                            ? `${indent}await interaction.response.send_message(${JSON.stringify(action.content || "Hello!")})`
                            : `${indent}await ctx.send(${JSON.stringify(action.content || "Hello!")})`;
                    case "reply":
                        return ctx === "interaction"
                            ? `${indent}await interaction.response.send_message(${JSON.stringify(action.content || "Reply!")})`
                            : `${indent}await ctx.reply(${JSON.stringify(action.content || "Reply!")})`;
                    case "create_embed": {
                        const embed = action.embed || {};
                        let code = `${indent}embed = discord.Embed(`;
                        const parts = [];
                        if (embed.title) parts.push(`title=${JSON.stringify(embed.title)}`);
                        if (embed.description) parts.push(`description=${JSON.stringify(embed.description)}`);
                        if (embed.color) parts.push(`color=0x${embed.color.replace("#", "")}`);
                        code += parts.join(", ") + ")";
                        if (embed.footer) code += `\n${indent}embed.set_footer(text=${JSON.stringify(embed.footer)})`;
                        if (embed.thumbnail) code += `\n${indent}embed.set_thumbnail(url=${JSON.stringify(embed.thumbnail)})`;
                        if (embed.image) code += `\n${indent}embed.set_image(url=${JSON.stringify(embed.image)})`;
                        if (embed.fields) {
                            embed.fields.forEach((f) => {
                                code += `\n${indent}embed.add_field(name=${JSON.stringify(f.name)}, value=${JSON.stringify(f.value)}, inline=${f.inline ? "True" : "False"})`;
                            });
                        }
                        code +=
                            ctx === "interaction"
                                ? `\n${indent}await interaction.response.send_message(embed=embed)`
                                : `\n${indent}await ctx.send(embed=embed)`;
                        return code;
                    }
                    case "kick_member":
                        return `${indent}member = ctx.message.mentions[0] if ctx.message.mentions else None\n${indent}if member:\n${indent}    await member.kick(reason=${JSON.stringify(action.reason || "Kicked")})`;
                    case "ban_member":
                        return `${indent}member = ctx.message.mentions[0] if ctx.message.mentions else None\n${indent}if member:\n${indent}    await member.ban(reason=${JSON.stringify(action.reason || "Banned")})`;
                    case "if_condition": {
                        const condition = action.condition || "True";
                        const thenActions = this._generatePythonActions(action.then || [], ctx, indentAmount + 4) || `${indent}    pass`;
                        const elseActions = this._generatePythonActions(action.else || [], ctx, indentAmount + 4);
                        return `${indent}if ${condition}:\n${thenActions}${elseActions ? `\n${indent}else:\n${elseActions}` : ""}`;
                    }
                    case "set_variable":
                        return `${indent}${action.name || "variable"} = ${JSON.stringify(action.value || "")}`;
                    case "api_request":
                        return `${indent}import aiohttp\n${indent}async with aiohttp.ClientSession() \x61s session:\n${indent}    async with session.request(${JSON.stringify(action.method || "GET")}, ${JSON.stringify(action.url || "https://api.example.com")}) \x61s response:\n${indent}        data = await response.json()`;
                    case "db_read":
                        return `${indent}import sqlite3\n${indent}db = sqlite3.connect("data.db")\n${indent}cursor = db.cursor()\n${indent}cursor.execute(${JSON.stringify(action.query || "SELECT * FROM data")})\n${indent}rows = cursor.fetchall()\n${indent}db.close()`;
                    case "db_write":
                        return `${indent}import sqlite3\n${indent}db = sqlite3.connect("data.db")\n${indent}cursor = db.cursor()\n${indent}cursor.execute(${JSON.stringify(action.query || "INSERT INTO data (key, value) VALUES (?, ?)")}, ${JSON.stringify(action.params || [])})\n${indent}db.commit()\n${indent}db.close()`;
                    case "send_await_interaction":
                        return `${indent}pass`;
                    case "ephemeral_message":
                        return ctx === "interaction"
                            ? `${indent}if interaction.response.is_done():\n${indent}    await interaction.followup.send(${JSON.stringify(action.content)}, ephemeral=True)\n${indent}else:\n${indent}    await interaction.response.send_message(${JSON.stringify(action.content)}, ephemeral=True)`
                            : `${indent}pass`;
                    case "wait":
                        return `${indent}await asyncio.sleep(${(action.time || 1000) / 1000})`;
                    case "raw_code":
                        return (action.code || "").split('\n').map(l => indent + l).join('\n') || "";
                    default:
                        return `${indent}pass`;
                }
            })
            .filter(Boolean)
            .join("\n");
    }

    _generatePythonEvent(evt) {
        let handlerCode;
        switch (evt.type) {
            case "on_ready":
                handlerCode = `    @commands.Cog.listener()
    async def on_ready(self):
        print(f"Bot is ready as {self.bot.user}")`;
                break;
            case "on_message":
                handlerCode = `    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return
        await self.bot.process_commands(message)`;
                break;
            case "on_member_join":
                handlerCode = `    @commands.Cog.listener()
    async def on_member_join(self, member):
        print(f"{member} joined the server")`;
                break;
            case "on_member_leave":
                handlerCode = `    @commands.Cog.listener()
    async def on_member_remove(self, member):
        print(f"{member} left the server")`;
                break;
            case "on_interaction":
                handlerCode = `    @commands.Cog.listener()
    async def on_interaction(self, interaction):
        pass`;
                break;
            case "on_reaction_add":
                handlerCode = `    @commands.Cog.listener()
    async def on_reaction_add(self, reaction, user):
        print(f"{user} reacted with {reaction.emoji}")`;
                break;
            default:
                handlerCode = `    pass`;
        }

        const className = this._capitalize(evt.type.replace("on_", "")) + "Event";

        return `import discord
from discord.ext import commands

class ${className}(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

${handlerCode}

async def setup(bot):
    await bot.add_cog(${className}(bot))
`;
    }

    _generateLua(project, outputPath, token) {
        const modulesDir = path.join(outputPath, "modules");
        fs.mkdirSync(modulesDir, { recursive: true });

        fs.writeFileSync(
            path.join(outputPath, "config.lua"),
            `return {
  token = os.getenv("DISCORD_TOKEN") or "${token || "YOUR_TOKEN_HERE"}",
  prefix = "${project.prefix || "!"}",
}
`
        );

        let moduleRequires = "";
        const allCmds = project.commands || [];
        allCmds.forEach((cmd) => {
            moduleRequires += `require("modules/${cmd.name}")(client, config)\n`;
        });

        let mainLua = `local discordia = require("discordia")
local client = discordia.Client()
local config = require("config")

${moduleRequires}
client:on("ready", function()
  print("Bot logged in as " .. client.user.tag)
end)

client:on("messageCreate", function(message)
  if message.author.bot then return end
  local prefix = config.prefix
  if not message.content:find(prefix, 1, true) then return end
  local content = message.content:sub(#prefix + 1)
  local args = {}
  for word in content:gmatch("%S+") do
    table.insert(args, word)
  end
  local cmdName = table.remove(args, 1)
  if cmdName then
    client:emit("command_" .. cmdName:lower(), message, args)
  end
end)

client:run("Bot " .. config.token)
`;
        fs.writeFileSync(path.join(outputPath, "main.lua"), mainLua);

        allCmds.forEach((cmd) => {
            let cmdLua = `return function(client, config)
  client:on("command_${cmd.name}", function(message, args)
    message:reply("${cmd.description || "Command executed."}")
  end)
end
`;
            fs.writeFileSync(path.join(modulesDir, `${cmd.name}.lua`), cmdLua);
        });
    }

    _capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

module.exports = { CodeGenerator };
