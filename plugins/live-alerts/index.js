module.exports = {
    name: "Twitch & YouTube Live",
  dependencies: {},
    commands: [
        {
            name: "set-alerts",
  dependencies: {},
            description: "Set the channel for live stream alerts.",
            type: "slash",
            arguments: [
                { name: "channel",
  dependencies: {}, type: "channel", required: true },
                { name: "streamer",
  dependencies: {}, type: "string", required: true }
            ],
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS alerts (channel_id TEXT, streamer TEXT)", params: [] },
                { type: "db_write", query: "INSERT INTO alerts (channel_id, streamer) VALUES (?, ?)", params: ["channel.id", "streamer"] },
                { type: "send_message", content: "📺 Set up alerts for **${streamer}** in <#${channel.id}>." }
            ]
        }
    ],
    init() {
        console.log("📺 Live Alerts: Monitoring engine ready. Use /set-alerts to begin.");
    }
};
