module.exports = {
    name: "Flash Gear Sync",
  dependencies: {},
    syncMode: "turbo",
    priority: 1000,
    init() {
        process.env.SYNC_TURBO = "true";
        console.log("⚡ Flash Gear Sync: TURBO mode engaged. Botify engine is synchronized.");
    },
    commands: [
        {
            name: "ping-botify",
  dependencies: {},
            description: "Check the reaction time of the Botify engine.",
            type: "slash",
            actions: [
                { type: "send_message", content: "⚡ **Flash Sync Active:** Pong! Latency is `${client.ws.ping}ms`" }
            ]
        }
    ]
};
