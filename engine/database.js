const fs = require("fs");
const path = require("path");

class DatabaseManager {
    init(dbPath, tables) {
        try {
            const Database = require("better-sqlite3");
            const db = new Database(dbPath);
            db.pragma("journal_mode = WAL");

            if (tables && tables.length > 0) {
                tables.forEach((table) => {
                    const columns = table.columns
                        .map((col) => `${col.name} ${col.type}`)
                        .join(", ");
                    db.exec(
                        `CREATE TABLE IF NOT EXISTS ${table.name} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${columns})`
                    );
                });
            }

            db.close();
            return true;
        } catch {
            return this._jsonFallback(dbPath, "init", { tables });
        }
    }

    getTables(dbPath) {
        try {
            const Database = require("better-sqlite3");
            const db = new Database(dbPath);
            const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table'")
                .all()
                .map((t) => t.name);

            const result = tables.map((name) => {
                const info = db.prepare(`PRAGMA table_info(${name})`).all();
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${name}`).get();
                return {
                    name,
                    columns: info.map((c) => ({ name: c.name, type: c.type })),
                    rowCount: count.count,
                };
            });

            db.close();
            return result;
        } catch {
            return this._jsonFallback(dbPath, "getTables");
        }
    }

    getTableData(dbPath, tableName) {
        try {
            const Database = require("better-sqlite3");
            const db = new Database(dbPath);
            const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
            db.close();
            return rows;
        } catch {
            return this._jsonFallback(dbPath, "getTableData", { tableName });
        }
    }

    insertRow(dbPath, tableName, data) {
        try {
            const Database = require("better-sqlite3");
            const db = new Database(dbPath);
            const keys = Object.keys(data);
            const placeholders = keys.map(() => "?").join(", ");
            const values = Object.values(data);
            db.prepare(
                `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`
            ).run(...values);
            db.close();
            return true;
        } catch {
            return this._jsonFallback(dbPath, "insertRow", { tableName, data });
        }
    }

    deleteRow(dbPath, tableName, rowId) {
        try {
            const Database = require("better-sqlite3");
            const db = new Database(dbPath);
            db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(rowId);
            db.close();
            return true;
        } catch {
            return this._jsonFallback(dbPath, "deleteRow", { tableName, rowId });
        }
    }

    query(dbPath, sql, params = []) {
        try {
            const Database = require("better-sqlite3");
            const db = new Database(dbPath);
            let result;
            const trimmed = sql.trim().toUpperCase();
            if (
                trimmed.startsWith("SELECT") ||
                trimmed.startsWith("PRAGMA")
            ) {
                result = db.prepare(sql).all(...params);
            } else {
                result = db.prepare(sql).run(...params);
            }
            db.close();
            return result;
        } catch {
            return [];
        }
    }

    _jsonFallback(dbPath, operation, args = {}) {
        const jsonPath = dbPath.replace(".db", ".json");

        const loadData = () => {
            if (fs.existsSync(jsonPath)) {
                return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
            }
            return { tables: {} };
        };

        const saveData = (data) => {
            fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        };

        switch (operation) {
            case "init": {
                const data = loadData();
                if (args.tables) {
                    args.tables.forEach((table) => {
                        if (!data.tables[table.name]) {
                            data.tables[table.name] = { columns: table.columns, rows: [] };
                        }
                    });
                }
                saveData(data);
                return true;
            }
            case "getTables": {
                const data = loadData();
                return Object.entries(data.tables).map(([name, table]) => ({
                    name,
                    columns: table.columns,
                    rowCount: table.rows.length,
                }));
            }
            case "getTableData": {
                const data = loadData();
                return data.tables[args.tableName]?.rows || [];
            }
            case "insertRow": {
                const data = loadData();
                if (data.tables[args.tableName]) {
                    const newId =
                        data.tables[args.tableName].rows.length > 0
                            ? Math.max(...data.tables[args.tableName].rows.map((r) => r.id)) + 1
                            : 1;
                    data.tables[args.tableName].rows.push({ id: newId, ...args.data });
                    saveData(data);
                }
                return true;
            }
            case "deleteRow": {
                const data = loadData();
                if (data.tables[args.tableName]) {
                    data.tables[args.tableName].rows = data.tables[args.tableName].rows.filter(
                        (r) => r.id !== args.rowId
                    );
                    saveData(data);
                }
                return true;
            }
            default:
                return [];
        }
    }
}

module.exports = { DatabaseManager };
