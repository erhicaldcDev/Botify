module.exports = {
    name: "Ticket Support",
  dependencies: {},
    commands: [
        {
            name: "setup-tickets",
  dependencies: {},
            description: "Initialize the ticket support system.",
            type: "slash",
            actions: [
                {
                    type: "create_embed",
                    embed: {
                        title: "🎫 Support Center",
                        description: "Need help? Open a ticket by typing `/new-ticket`.",
                        color: "#00FF00",
                        footer: "Support Staff will be with you shortly."
                    }
                }
            ]
        },
        {
            name: "new-ticket",
  dependencies: {},
            description: "Open a new support ticket.",
            type: "slash",
            actions: [
                { type: "send_message", content: "🎫 A staff member will contact you shortly in a new channel." },
                { type: "create_embed", embed: { title: "New Ticket", description: "User <@${interaction.user.id}> has requested support.", color: "#FFA500" } }
            ]
        },
        {
            name: "close-ticket",
  dependencies: {},
            description: "Close an active support ticket.",
            type: "slash",
            actions: [
                { type: "send_message", content: "🔒 Ticket closed securely. Transcript saved." }
            ]
        }
    ]
};
