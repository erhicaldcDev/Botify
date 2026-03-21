module.exports = {
    name: "Reaction Roles",
  dependencies: {},
    commands: [
        {
            name: "roles-panel",
  dependencies: {},
            description: "Send a reaction role panel.",
            type: "slash",
            arguments: [{ name: "role",
  dependencies: {}, type: "role", required: true }],
            actions: [
                {
                    type: "create_embed",
                    embed: {
                        title: "🎭 Claim your Role!",
                        description: "React with ✅ to get the <@&${role.id}> role.",
                        color: "#800080"
                    }
                },
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS reaction_roles (message_id TEXT, role_id TEXT)", params: [] }
            ]
        }
    ],
    events: [
        {
            type: "on_reaction_add",
            actions: [
                {
                    type: "if_condition",
                    condition: "reaction.emoji.name === '✅'",
                    then: [
                        { type: "add_role", roleId: "ROLE_ID_FROM_DB" }
                    ]
                }
            ]
        }
    ]
};
