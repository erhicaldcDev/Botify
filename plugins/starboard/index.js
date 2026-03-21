module.exports = {
    name: "Starboard Suite",
  dependencies: {},
    events: [
        {
            type: "on_reaction_add",
            actions: [
                {
                    type: "if_condition",
                    condition: "reaction.emoji.name === '⭐' && reaction.count >= 3",
                    then: [
                        { type: "db_write", query: "CREATE TABLE IF NOT EXISTS starboard (message_id TEXT)", params: [] },
                        { type: "db_read", query: "SELECT * FROM starboard WHERE message_id = ?", params: ["reaction.message.id"] },
                        {
                            type: "if_condition",
                            condition: "!rows.length",
                            then: [
                                { type: "db_write", query: "INSERT INTO starboard (message_id) VALUES (?)", params: ["reaction.message.id"] },
                                {
                                    type: "create_embed",
                                    embed: {
                                        title: "⭐ New Starboard Highlight",
                                        description: "${reaction.message.content}\n\n[Jump to message](${reaction.message.url})",
                                        color: "#FFD700",
                                        footer: "⭐ ${reaction.count} | ${reaction.message.author.tag}"
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    init() {
        console.log("⭐ Starboard Suite is tracking reactions.");
    }
};
