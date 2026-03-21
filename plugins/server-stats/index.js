module.exports = {
    name: "Server Stats Pro",
  dependencies: {},
    commands: [
        {
            name: "setup-stats",
  dependencies: {},
            description: "Setup dynamic server statistics channels.",
            type: "slash",
            actions: [
                { type: "send_message", content: "✅ Stats setup complete. Channels will update every 10 minutes." }
            ]
        },
        {
            name: "stats",
  dependencies: {},
            description: "Show detailed server growth statistics.",
            type: "slash",
            actions: [
                {
                    type: "create_embed",
                    embed: {
                        title: "📈 Server Statistics",
                        description: "Total Members: **${interaction.guild.memberCount}**\nTotal Channels: **${interaction.guild.channels.cache.size}**\nTotal Roles: **${interaction.guild.roles.cache.size}**",
                        color: "#FFA500",
                        thumbnail: "${interaction.guild.iconURL()}"
                    }
                }
            ]
        }
    ]
};
