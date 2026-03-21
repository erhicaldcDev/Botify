module.exports = {
    name: "Audit Logs",
  dependencies: {},
    events: [
        {
            type: "on_member_join",
            actions: [
                {
                    type: "create_embed",
                    embed: {
                        title: "📥 Member Joined",
                        description: "<@${member.user.id}> joined the server.",
                        color: "#00FF00",
                        footer: "User ID: ${member.user.id}"
                    }
                }
            ]
        },
        {
            type: "on_member_leave",
            actions: [
                {
                    type: "create_embed",
                    embed: {
                        title: "📤 Member Left",
                        description: "<@${member.user.id}> left the server.",
                        color: "#FF0000",
                        footer: "User ID: ${member.user.id}"
                    }
                }
            ]
        }
    ],
    hooks: {
        "on_message": async (message, client) => {
            
            
        }
    },
    init() {
        console.log("📜 Audit Logs: Tracking member joins and leaves via robust embeds.");
    }
};
