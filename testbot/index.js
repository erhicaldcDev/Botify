const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require("discord.js");
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
const prefix = process.env.PREFIX || "!";

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
  console.log(`Bot logged in as ${client.user.tag}`);
  registerSlashCommands();
});

client.login(process.env.DISCORD_TOKEN);
