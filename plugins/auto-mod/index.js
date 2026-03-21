module.exports = {
    name: "Auto-Moderator",
  dependencies: {},
    hooks: {
        "on_message": async (message, client) => {
            const badWords = ["spam", "badword", "offensive", "scam"];
            const content = message.content.toLowerCase();

            
            if (badWords.some(word => content.includes(word))) {
                message.delete().catch(() => { });
                return message.channel.send(`⚠️ ${message.author}, watch your language!`);
            }

            
            const capsCount = message.content.replace(/[^A-Z]/g, "").length;
            if (message.content.length > 15 && capsCount / message.content.length > 0.7) {
                message.delete().catch(() => { });
                return message.channel.send(`🚫 ${message.author}, please stop shouting (excessive caps).`);
            }

            
            if (content.includes("discord.gg/") || content.includes("discord.com/invite/")) {
                if (!message.member.permissions.has("ManageMessages")) {
                    message.delete().catch(() => { });
                    return message.channel.send(`🚫 ${message.author}, sending invite links is strictly prohibited!`);
                }
            }
        }
    },
    commands: [
        {
            name: "automod-status",
  dependencies: {},
            description: "View the status of the auto-moderation systems.",
            type: "slash",
            actions: [
                {
                    type: "create_embed",
                    embed: {
                        title: "🛡️ AutoMod Status",
                        description: "All systems are operational.\n\n✅ **Anti-Spam**\n✅ **Anti-Caps**\n✅ **Anti-Invite Links**\n✅ **Bad Word Filter**",
                        color: "#0000FF"
                    }
                }
            ]
        }
    ]
};
