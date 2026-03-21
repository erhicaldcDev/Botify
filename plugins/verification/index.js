module.exports = {
    name: "Verification Guard",
  dependencies: {},
    events: [
        {
            type: "on_member_join",
            actions: [
                { type: "send_message", content: "🛡️ <@${member.user.id}>, welcome! Please type `/verify` to gain access to the rest of the server." }
            ]
        }
    ],
    commands: [
        {
            name: "verify",
  dependencies: {},
            description: "Solve a captcha to prove you are human.",
            type: "slash",
            actions: [
                { type: "set_variable", name: "num1",
  dependencies: {}, value: "Math.floor(Math.random() * 10) + 1" },
                { type: "set_variable", name: "num2",
  dependencies: {}, value: "Math.floor(Math.random() * 10) + 1" },
                { type: "set_variable", name: "answer",
  dependencies: {}, value: "num1 + num2" },
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS captchas (user_id TEXT, answer INTEGER)", params: [] },
                { type: "db_write", query: "INSERT INTO captchas (user_id, answer) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET answer = ?", params: ["interaction.user.id", "answer", "answer"] },
                { type: "create_embed", embed: { title: "🤖 Anti-Bot Verification", description: "Please use `/answer [number]` to solve: **${num1} + ${num2} = ?**", color: "#FF0000" } }
            ]
        },
        {
            name: "answer",
  dependencies: {},
            description: "Submit your verification answer.",
            type: "slash",
            arguments: [{ name: "value",
  dependencies: {}, type: "integer", required: true }],
            actions: [
                { type: "db_read", query: "SELECT answer FROM captchas WHERE user_id = ?", params: ["interaction.user.id"] },
                {
                    type: "if_condition", condition: "rows.length && rows[0].answer === value", then: [
                        { type: "send_message", content: "✅ Verification successful! Welcome to the server." },
                        { type: "db_write", query: "DELETE FROM captchas WHERE user_id = ?", params: ["interaction.user.id"] },
                        { type: "add_role", roleId: "VERIFIED_ROLE_ID_HERE" }
                    ],
                    else: [
                        { type: "send_message", content: "❌ Incorrect answer. Try `/verify` again." }
                    ]
                }
            ]
        }
    ]
};
