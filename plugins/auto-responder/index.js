module.exports = {
    name: "Auto-Responder",
  dependencies: {},
    commands: [
        {
            name: "add-response",
  dependencies: {},
            description: "Add a custom text response trigger.",
            type: "slash",
            arguments: [
                { name: "trigger",
  dependencies: {}, type: "string", required: true },
                { name: "response",
  dependencies: {}, type: "string", required: true }
            ],
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS auto_responses (trigger TEXT, response TEXT)", params: [] },
                { type: "db_write", query: "INSERT INTO auto_responses (trigger, response) VALUES (?, ?)", params: ["trigger", "response"] },
                { type: "send_message", content: "✅ Added trigger `${trigger}` -> `${response}`" }
            ]
        }
    ],
    hooks: {
        "on_message": async (message, client) => {
            if (message.author.bot) return;
            try {
                const Database = require("better-sqlite3");
                const db = new Database("./data.db");
                
                db.prepare("CREATE TABLE IF NOT EXISTS auto_responses (trigger TEXT, response TEXT)").run();
                const triggers = db.prepare("SELECT * FROM auto_responses").all();
                db.close();

                const content = message.content.toLowerCase();
                for (const t of triggers) {
                    if (content === t.trigger.toLowerCase()) {
                        await message.reply(t.response);
                        break;
                    }
                }
            } catch (err) {
                console.error("AutoResponder err", err);
            }
        }
    }
};
