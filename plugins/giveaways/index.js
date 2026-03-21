module.exports = {
    name: "Giveaway System",
  dependencies: {},
    commands: [
        {
            name: "gstart",
  dependencies: {},
            description: "Start a new giveaway.",
            type: "slash",
            arguments: [
                { name: "prize",
  dependencies: {}, type: "string", required: true },
                { name: "winners",
  dependencies: {}, type: "integer", required: true }
            ],
            actions: [
                {
                    type: "create_embed",
                    embed: {
                        title: "🎉 **GIVEAWAY** 🎉",
                        description: "**Prize:** ${prize}\n**Winners:** ${winners}\n\n*React with 🎉 to enter!*",
                        color: "#FFD700"
                    }
                },
                {
                    type: "db_write",
                    query: "CREATE TABLE IF NOT EXISTS giveaways (message_id TEXT, prize TEXT, winners INTEGER)",
                    params: []
                }
                
            ]
        },
        {
            name: "gend",
  dependencies: {},
            description: "End a giveaway and roll winners (Simulation).",
            type: "slash",
            actions: [
                { type: "send_message", content: "🎉 Giveaway ended! The winners will be announced soon." }
            ]
        }
    ],
    events: [
        {
            type: "on_reaction_add",
            actions: [
                { type: "if_condition", condition: "reaction.emoji.name === '🎉'", then: [] }
            ]
        }
    ],
    init() {
        console.log("🎁 Giveaway System ready - Prize rolling engine active.");
    }
};
