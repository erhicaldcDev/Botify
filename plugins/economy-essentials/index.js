module.exports = {
    name: "Economy Essentials",
    dependencies: {},
    commands: [
        {
            name: "balance",
            description: "Check your current wallet balance.",
            type: "slash",
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS economy (user_id TEXT PRIMARY KEY, wallet INTEGER DEFAULT 0, next_claim INTEGER DEFAULT 0)", params: [] },
                { type: "db_read", query: "SELECT wallet FROM economy WHERE user_id = ?", params: ["interaction.user.id"] },
                { type: "send_message", content: "💰 **Your Balance:** `${rows[0]?.wallet || 0}` coins" }
            ]
        },
        {
            name: "work",
            description: "Work to earn some coins.",
            type: "slash",
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS economy (user_id TEXT PRIMARY KEY, wallet INTEGER DEFAULT 0, next_claim INTEGER DEFAULT 0)", params: [] },
                { type: "set_variable", name: "earn", value: "Math.floor(Math.random()*150)+50" },
                { type: "db_write", query: "INSERT INTO economy (user_id, wallet, next_claim) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET wallet = wallet + ?", params: ["interaction.user.id", "earn", "earn"] },
                { type: "send_message", content: "🔨 You worked a shift and earned `💰${earn}`!" }
            ]
        },
        {
            name: "pay",
            description: "Send coins to another user.",
            type: "slash",
            arguments: [
                { name: "user", type: "user", required: true },
                { name: "amount", type: "integer", required: true }
            ],
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS economy (user_id TEXT PRIMARY KEY, wallet INTEGER DEFAULT 0, next_claim INTEGER DEFAULT 0)", params: [] },
                { type: "db_write", query: "UPDATE economy SET wallet = wallet - ? WHERE user_id = ?", params: ["amount", "interaction.user.id"] },
                { type: "db_write", query: "INSERT INTO economy (user_id, wallet, next_claim) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET wallet = wallet + ?", params: ["user.id", "amount", "amount"] },
                { type: "send_message", content: "💸 You paid `💰${amount}` to <@${user.id}>." }
            ]
        },
        {
            name: "daily",
            description: "Claim your daily reward.",
            type: "slash",
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS economy (user_id TEXT PRIMARY KEY, wallet INTEGER DEFAULT 0, next_claim INTEGER DEFAULT 0)", params: [] },
                { type: "db_read", query: "SELECT next_claim FROM economy WHERE user_id = ?", params: ["interaction.user.id"] },
                { type: "set_variable", name: "next_claim", value: "rows[0]?.next_claim || 0" },
                {
                    type: "if_condition", condition: "Date.now() > next_claim",
                    then: [
                        { type: "set_variable", name: "reward", value: "Math.floor(Math.random() * 400) + 100" },
                        { type: "set_variable", name: "new_claim", value: "Date.now() + 86400000" },
                        { type: "db_write", query: "INSERT INTO economy (user_id, wallet, next_claim) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET wallet = wallet + ?, next_claim = ?", params: ["interaction.user.id", "reward", "new_claim", "reward", "new_claim"] },
                        { type: "send_message", content: "🎁 You claimed your daily reward of `💰${reward}` coins! Come back in 24 hours." }
                    ],
                    else: [
                        { type: "set_variable", name: "remaining", value: "Math.ceil((next_claim - Date.now()) / 3600000)" },
                        { type: "send_message", content: "⏳ You already claimed your reward. Please wait `${remaining}` hours." }
                    ]
                }
            ]
        }
    ],
    init() {
        console.log("🏦 Economy Essentials: Working with DB schema automatically.");
    }
};
