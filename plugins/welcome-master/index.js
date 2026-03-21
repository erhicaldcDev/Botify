module.exports = {
    name: "Welcome Master",
    dependencies: {},
    events: [
        {
            type: "on_member_join",
            actions: [
                {
                    type: "if_condition",
                    condition: "member.user.bot",
                    then: [
                        { type: "add_role", roleId: "rola_bota_tutaj" },
                        { type: "raw_code", code: "return;" }
                    ],
                    else: [
                        {
                            type: "create_embed",
                            embed: {
                                title: "Welcome to ${member.guild.name}! ✨",
                                description: "Hey <@${member.user.id}>, we're so happy to have you!\nMake sure to read the rules and verify.",
                                color: "#7c6aef",
                                image: "https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?q=80&w=2000",
                                thumbnail: "${member.user.displayAvatarURL()}",
                                footer: "Member #${member.guild.memberCount}"
                            }
                        },
                        { type: "wait", time: 2000 },
                        { type: "add_role", roleId: "rola_podstawowa_tutaj" }
                    ]
                }
            ]
        },
        {
            type: "on_member_leave",
            actions: [
                { type: "send_message", content: "😢 Goodbye **${member.user.tag}**, we'll miss you!" }
            ]
        }
    ],
    init() {
        console.log("🚀 Welcome Master: Advanced Bot Guard & Timed Roles Enabled.");
    }
};
