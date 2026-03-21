module.exports = {
    name: "Reminders & Queues",
  dependencies: {},
    commands: [
        {
            name: "remind",
  dependencies: {},
            description: "Set a personal reminder.",
            type: "slash",
            arguments: [
                { name: "task",
  dependencies: {}, type: "string", required: true },
                { name: "minutes",
  dependencies: {}, type: "integer", required: true }
            ],
            actions: [
                { type: "db_write", query: "CREATE TABLE IF NOT EXISTS reminders (user_id TEXT, task TEXT, expiry INTEGER)", params: [] },
                { type: "set_variable", name: "expiry_time",
  dependencies: {}, value: "Date.now() + (minutes * 60000)" },
                { type: "db_write", query: "INSERT INTO reminders (user_id, task, expiry) VALUES (?, ?, ?)", params: ["interaction.user.id", "task", "expiry_time"] },
                { type: "send_message", content: "⏰ Got it! I will remind you about **${task}** in ${minutes} minutes." }
            ]
        }
    ],
    init(client) {
        console.log("⏰ Reminders: Clock engine started.");
        if (!client) return;

        
        setInterval(() => {
            try {
                const Database = require("better-sqlite3");
                const db = new Database("./data.db");
                db.prepare("CREATE TABLE IF NOT EXISTS reminders (user_id TEXT, task TEXT, expiry INTEGER)").run();

                const now = Date.now();
                const due = db.prepare("SELECT rowid, * FROM reminders WHERE expiry <= ?").all(now);

                for (const reminder of due) {
                    const user = client.users.cache.get(reminder.user_id);
                    if (user) {
                        user.send(`⏰ **REMINDER:** ${reminder.task}`).catch(() => { });
                    }
                    db.prepare("DELETE FROM reminders WHERE rowid = ?").run(reminder.rowid);
                }
                db.close();
            } catch (err) { }
        }, 30000);
    }
};
