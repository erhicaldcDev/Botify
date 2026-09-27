const fs = require("fs");
const path = require("path");

const VALID_TYPES = new Set(["TEXT", "INTEGER", "REAL", "BLOB", "NUMERIC"]);

/** Quote an SQLite identifier (table / column name). */
function q(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
}

let Database = null;
let loadError = null;
function driver() {
    if (Database || loadError) return Database;
    try {
        Database = require("better-sqlite3");
    } catch (e) {
        loadError = e;
        console.error("better-sqlite3 unavailable, using JSON fallback:", e.message);
    }
    return Database;
}

class DatabaseManager {
    _open(dbPath) {
        const D = driver();
        if (!D) return null;
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        const db = new D(dbPath);
        db.pragma("journal_mode = WAL");
        return db;
    }

    _with(dbPath, fn, fallbackOp, fallbackArgs) {
        const db = this._open(dbPath);
        if (!db) return this._jsonFallback(dbPath, fallbackOp, fallbackArgs);
        try {
            return fn(db);
        } finally {
            db.close();
        }
    }

    init(dbPath, tables) {
        return this._with(dbPath, (db) => {
            (tables || []).forEach((table) => {
                const columns = (table.columns || [])
                    .filter((c) => c.name && c.name.toLowerCase() !== "id")
                    .map((c) => `${q(c.name)} ${VALID_TYPES.has(String(c.type).toUpperCase()) ? String(c.type).toUpperCase() : "TEXT"}`);
                db.exec(`CREATE TABLE IF NOT EXISTS ${q(table.name)} (id INTEGER PRIMARY KEY AUTOINCREMENT${columns.length ? ", " + columns.join(", ") : ""})`);
            });
            return true;
        }, "init", { tables });
    }

    getTables(dbPath) {
        if (driver() && !fs.existsSync(dbPath)) return [];
        return this._with(dbPath, (db) => {
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((t) => t.name);
            return tables.map((name) => {
                const info = db.prepare(`PRAGMA table_info(${q(name)})`).all();
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${q(name)}`).get();
                return {
                    name,
                    columns: info.map((c) => ({ name: c.name, type: c.type, pk: !!c.pk })),
                    rowCount: count.count,
                };
            });
        }, "getTables");
    }

    getTableData(dbPath, tableName) {
        return this._with(dbPath, (db) => db.prepare(`SELECT rowid AS __rowid, * FROM ${q(tableName)} LIMIT 1000`).all(), "getTableData", { tableName });
    }

    insertRow(dbPath, tableName, data) {
        return this._with(dbPath, (db) => {
            const keys = Object.keys(data);
            if (keys.length === 0) {
                db.prepare(`INSERT INTO ${q(tableName)} DEFAULT VALUES`).run();
                return true;
            }
            db.prepare(`INSERT INTO ${q(tableName)} (${keys.map(q).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).run(...Object.values(data));
            return true;
        }, "insertRow", { tableName, data });
    }

    deleteRow(dbPath, tableName, rowId) {
        return this._with(dbPath, (db) => {
            db.prepare(`DELETE FROM ${q(tableName)} WHERE rowid = ?`).run(rowId);
            return true;
        }, "deleteRow", { tableName, rowId });
    }

    dropTable(dbPath, tableName) {
        return this._with(dbPath, (db) => {
            db.exec(`DROP TABLE IF EXISTS ${q(tableName)}`);
            return true;
        }, "dropTable", { tableName });
    }

    query(dbPath, sql, params = []) {
        return this._with(dbPath, (db) => {
            const stmt = db.prepare(sql);
            return stmt.reader ? stmt.all(...params) : stmt.run(...params);
        }, "query");
    }

    _jsonFallback(dbPath, operation, args = {}) {
        const jsonPath = dbPath.replace(/\.db$/, ".json");
        const loadData = () => (fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, "utf-8")) : { tables: {} });
        const saveData = (data) => fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

        switch (operation) {
            case "init": {
                const data = loadData();
                (args.tables || []).forEach((table) => {
                    if (!data.tables[table.name]) data.tables[table.name] = { columns: [{ name: "id", type: "INTEGER" }, ...table.columns], rows: [] };
                });
                saveData(data);
                return true;
            }
            case "getTables":
                return Object.entries(loadData().tables).map(([name, t]) => ({ name, columns: t.columns, rowCount: t.rows.length }));
            case "getTableData":
                return (loadData().tables[args.tableName]?.rows || []).map((r) => ({ __rowid: r.id, ...r }));
            case "insertRow": {
                const data = loadData();
                const t = data.tables[args.tableName];
                if (t) {
                    const id = t.rows.length ? Math.max(...t.rows.map((r) => r.id)) + 1 : 1;
                    t.rows.push({ id, ...args.data });
                    saveData(data);
                }
                return true;
            }
            case "deleteRow": {
                const data = loadData();
                const t = data.tables[args.tableName];
                if (t) {
                    t.rows = t.rows.filter((r) => r.id !== args.rowId);
                    saveData(data);
                }
                return true;
            }
            case "dropTable": {
                const data = loadData();
                delete data.tables[args.tableName];
                saveData(data);
                return true;
            }
            default:
                throw new Error("Database engine unavailable (better-sqlite3 failed to load). Run 'npm run rebuild' in the Botify folder.");
        }
    }
}

module.exports = { DatabaseManager };
