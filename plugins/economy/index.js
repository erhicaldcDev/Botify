// Economy System - adds visual blocks for a simple coin wallet stored in the bot database.
const TABLE = "CREATE TABLE IF NOT EXISTS botify_economy (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0)";

const targetField = { key: "target", label: "User (empty = command user)", type: "text", default: "" };
const amountField = { key: "amount", label: "Amount", type: "text", default: "100", placeholder: "Number or {variable}" };

// Shared JS snippet: resolves the user id for the block's "target" field.
const userId = (h, a) => `((await B.resolveUser(ctx, ${h.text(a.target)}))?.id || ctx.user.id)`;

module.exports = {
    name: "Economy System",
    dependencies: {},
    blocks: [
        {
            type: "eco_get_balance", label: "Get Balance", icon: "💰", category: "plugin",
            description: "Load a user's coin balance into a variable.",
            fields: [targetField, { key: "saveTo", label: "Save balance to", type: "variable", default: "balance" }],
            compile: {
                node: (a, h) => `B.sqlRun(${JSON.stringify(TABLE)});\n${a.saveTo || "balance"} = (B.sqlAll("SELECT balance FROM botify_economy WHERE user_id = ?", [${userId(h, a)}])[0] || { balance: 0 }).balance;`,
            },
        },
        {
            type: "eco_add_money", label: "Add Money", icon: "💸", category: "plugin",
            fields: [targetField, amountField],
            compile: {
                node: (a, h) => `B.sqlRun(${JSON.stringify(TABLE)});\nB.sqlRun("INSERT INTO botify_economy (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance", [${userId(h, a)}, B.toNumber(${h.text(a.amount)})]);`,
            },
        },
        {
            type: "eco_remove_money", label: "Remove Money", icon: "📉", category: "plugin",
            fields: [targetField, amountField],
            compile: {
                node: (a, h) => `B.sqlRun(${JSON.stringify(TABLE)});\nB.sqlRun("INSERT INTO botify_economy (user_id, balance) VALUES (?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = MAX(0, balance - ?)", [${userId(h, a)}, B.toNumber(${h.text(a.amount)})]);`,
            },
        },
        {
            type: "eco_set_balance", label: "Set Balance", icon: "🏦", category: "plugin",
            fields: [targetField, amountField],
            compile: {
                node: (a, h) => `B.sqlRun(${JSON.stringify(TABLE)});\nB.sqlRun("INSERT INTO botify_economy (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = excluded.balance", [${userId(h, a)}, B.toNumber(${h.text(a.amount)})]);`,
            },
        },
    ],
};
