module.exports = {
    name: "Leveling Pro",
  dependencies: {},
    hooks: {
        "on_message": async (message, client) => {
            if (message.author.bot) return;
            const Database = require("better-sqlite3");
            const db = new Database("./data.db");
            db.prepare("CREATE TABLE IF NOT EXISTS levels (user_id TEXT PRIMARY KEY, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1)").run();

            const xpToAdd = Math.floor(Math.random() * 15) + 10;
            db.prepare("INSERT INTO levels (user_id, xp, level) VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET xp = xp + ?").run(message.author.id, xpToAdd, xpToAdd);

            const userLevel = db.prepare("SELECT xp, level FROM levels WHERE user_id = ?").get(message.author.id);
            const nextLevelXp = userLevel.level * 100;

            if (userLevel.xp >= nextLevelXp) {
                db.prepare("UPDATE levels SET level = level + 1, xp = 0 WHERE user_id = ?").run(message.author.id);
                message.channel.send(`🎉 Congratulations ${message.author}! You leveled up to **Level ${userLevel.level + 1}**!`);
            }
            db.close();
        }
    },
    commands: [
        {
            name: "rank",
  dependencies: {},
            description: "Check your current level and XP.",
            type: "slash",
            actions: [
                { type: "db_read", query: "SELECT level, xp FROM levels WHERE user_id = ?", params: ["interaction.user.id"] },
                {
                    type: "create_embed",
                    embed: {
                        title: "📊 Level Stats",
                        description: "**Level:** ${rows[0]?.level || 1}\n**XP:** ${rows[0]?.xp || 0} / ${(rows[0]?.level || 1) * 100}",
                        color: "#00FF00"
                    }
                }
            ]
        }
    ]
};
