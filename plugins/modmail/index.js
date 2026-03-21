module.exports = {
    name: "Mod-Mail Pro",
  dependencies: {},
    hooks: {
        "on_message": async (message, client) => {
            if (message.author.bot) return;

            
            if (message.channel.type === 1) {
                
                console.log(`[MOD-MAIL] New DM from ${message.author.tag}: ${message.content}`);

                const Database = require("better-sqlite3");
                const db = new Database("./data.db");
                db.prepare("CREATE TABLE IF NOT EXISTS modmail_config (guild_id TEXT, channel_id TEXT)").run();

                
                const config = db.prepare("SELECT * FROM modmail_config LIMIT 1").get();
                if (config) {
                    try {
                        const guild = client.guilds.cache.get(config.guild_id);
                        const channel = guild.channels.cache.get(config.channel_id);
                        if (channel) {
                            const { EmbedBuilder } = require("discord.js");
                            const embed = new EmbedBuilder()
                                .setTitle(`New Mod-Mail from ${message.author.tag}`)
                                .setDescription(message.content)
                                .setColor("#ff0044")
                                .setFooter({ text: `User ID: ${message.author.id}` });

                            await channel.send({ embeds: [embed] });
                            await message.react("✅");
                        }
                    } catch (e) {
                        console.error("ModMail Forwarding Error", e);
                    }
                }
                db.close();
            }
        }
    },
    commands: [
        {
            name: "modmail-setup",
  dependencies: {},
            description: "Set the channel where mod mails will be delivered.",
            type: "slash",
            arguments: [{ name: "channel",
  dependencies: {}, type: "channel", required: true }],
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS modmail_config (guild_id TEXT, channel_id TEXT)", params: [] },
                { type: "db_write", query: "DELETE FROM modmail_config", params: [] },
                { type: "db_write", query: "INSERT INTO modmail_config (guild_id, channel_id) VALUES (?, ?)", params: ["interaction.guildId", "channel.id"] },
                { type: "send_message", content: "📬 Mod-Mail setup complete! DMs will be routed to <#${channel.id}>." }
            ]
        }
    ]
};
