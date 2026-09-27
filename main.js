const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { EngineManager } = require("./engine/manager");
const { DependencyInstaller } = require("./engine/dependency");
const { CodeGenerator } = require("./engine/generator");
const { CryptoManager } = require("./engine/crypto");
const { DatabaseManager } = require("./engine/database");
const { PluginManager } = require("./engine/plugins");
const { migrateProject, createProject } = require("./engine/project");

let mainWindow;
let engineManager;
let dependencyInstaller;
let codeGenerator;
let cryptoManager;
let databaseManager;
let pluginManager;

let PROJECTS_DIR;
let PLUGINS_DIR;

function ensureDirectories() {
    [PROJECTS_DIR, PLUGINS_DIR].forEach((dir) => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        frame: false,
        backgroundColor: "#0d0f14",
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
        icon: path.join(__dirname, "src", "assets", "icon.svg"),
    });

    mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
    mainWindow.once("ready-to-show", () => mainWindow.show());

    // Never navigate the app window away; open links in the user's browser instead.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: "deny" };
    });
    mainWindow.webContents.on("will-navigate", (e, url) => {
        if (!url.startsWith("file://")) {
            e.preventDefault();
            if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        }
    });

    mainWindow.on("maximize", () => mainWindow.webContents.send("window:state", { maximized: true }));
    mainWindow.on("unmaximize", () => mainWindow.webContents.send("window:state", { maximized: false }));
    mainWindow.on("closed", () => { mainWindow = null; });
}

function initializeServices() {
    cryptoManager = new CryptoManager(app.getPath("userData"));
    engineManager = new EngineManager();
    dependencyInstaller = new DependencyInstaller();
    codeGenerator = new CodeGenerator();
    databaseManager = new DatabaseManager();
    pluginManager = new PluginManager(PLUGINS_DIR);
}

// ------------------------------------------------------------------ helpers
function projectDir(projectId) {
    if (typeof projectId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(projectId)) {
        throw new Error("Invalid project id");
    }
    return path.join(PROJECTS_DIR, projectId);
}

function outputDir(projectId) {
    return path.join(projectDir(projectId), "output");
}

/** Resolve a path inside a project's output folder, refusing anything that escapes it. */
function safeOutputPath(projectId, relPath) {
    const base = outputDir(projectId);
    const full = path.resolve(base, String(relPath || ""));
    if (full !== base && !full.startsWith(base + path.sep)) throw new Error("Path outside of project output");
    return full;
}

function readConfig(projectId) {
    const file = path.join(projectDir(projectId), "project.json");
    return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeConfig(projectId, config) {
    const file = path.join(projectDir(projectId), "project.json");
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
    fs.renameSync(tmp, file);
}

/** Project data sent to the renderer: never includes the (encrypted) token. */
function toRenderer(config, projectId) {
    const out = { ...config, path: projectDir(projectId), hasToken: !!config.token };
    delete out.token;
    return out;
}

function decryptToken(projectId) {
    try {
        const cfg = readConfig(projectId);
        return cfg.token ? cryptoManager.decrypt(cfg.token) : null;
    } catch {
        return null;
    }
}

function dbPath(projectId) {
    const out = outputDir(projectId);
    const target = path.join(out, "data.db");
    // Older versions stored the database next to project.json - move it where the bot reads it.
    const legacy = path.join(projectDir(projectId), "data.db");
    if (!fs.existsSync(target) && fs.existsSync(legacy)) {
        fs.mkdirSync(out, { recursive: true });
        fs.copyFileSync(legacy, target);
    }
    return target;
}

function sendLog(event) {
    mainWindow?.webContents.send("engine:log", event);
}

function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await fn(...args);
        } catch (err) {
            console.error(`[ipc ${channel}]`, err);
            throw err;
        }
    });
}

// ------------------------------------------------------------------- IPC
function registerIpcHandlers() {
    ipcMain.on("window:minimize", () => mainWindow?.minimize());
    ipcMain.on("window:maximize", () => {
        if (mainWindow?.isMaximized()) mainWindow.unmaximize();
        else mainWindow?.maximize();
    });
    ipcMain.on("window:close", () => mainWindow?.close());

    handle("project:list", async () => {
        const list = [];
        for (const d of fs.readdirSync(PROJECTS_DIR)) {
            try {
                if (!fs.existsSync(path.join(PROJECTS_DIR, d, "project.json"))) continue;
                list.push(toRenderer(migrateProject(readConfig(d)), d));
            } catch (e) {
                console.error(`Skipping unreadable project ${d}:`, e.message);
            }
        }
        return list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    });

    handle("project:create", async (data) => {
        const config = createProject(data);
        if (data.token) config.token = cryptoManager.encrypt(data.token);
        fs.mkdirSync(projectDir(config.id), { recursive: true });
        writeConfig(config.id, config);
        return toRenderer(config, config.id);
    });

    handle("project:open", async (projectId) => {
        if (!fs.existsSync(path.join(projectDir(projectId), "project.json"))) return null;
        return toRenderer(migrateProject(readConfig(projectId)), projectId);
    });

    handle("project:save", async (projectData) => {
        const existing = readConfig(projectData.id);
        const config = { ...projectData };
        delete config.path;
        delete config.hasToken;
        config.token = existing.token || null; // the token is only changed through project:setToken
        config.updatedAt = new Date().toISOString();
        writeConfig(projectData.id, config);
        return true;
    });

    handle("project:delete", async (projectId) => {
        if (engineManager.getStatus().running && engineManager.currentPath === outputDir(projectId)) engineManager.stop();
        const dir = projectDir(projectId);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        return true;
    });

    handle("project:getToken", async (projectId) => decryptToken(projectId));

    handle("project:setToken", async (projectId, token) => {
        const config = readConfig(projectId);
        config.token = token ? cryptoManager.encrypt(token) : null;
        config.updatedAt = new Date().toISOString();
        writeConfig(projectId, config);
        return true;
    });

    handle("project:export", async (projectId) => {
        const config = readConfig(projectId);
        delete config.token;
        const result = await dialog.showSaveDialog(mainWindow, {
            title: "Export Botify project",
            defaultPath: `${(config.name || "project").replace(/[^\w-]+/g, "_")}.botify.json`,
            filters: [{ name: "Botify project", extensions: ["json"] }],
        });
        if (result.canceled || !result.filePath) return null;
        fs.writeFileSync(result.filePath, JSON.stringify({ botify: 1, project: config }, null, 2));
        return result.filePath;
    });

    handle("project:import", async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: "Import Botify project",
            properties: ["openFile"],
            filters: [{ name: "Botify project", extensions: ["json"] }],
        });
        if (result.canceled || !result.filePaths[0]) return null;
        const raw = JSON.parse(fs.readFileSync(result.filePaths[0], "utf-8"));
        const imported = raw.project || raw;
        if (!imported || typeof imported !== "object" || !imported.name) throw new Error("This file is not a Botify project.");
        const fresh = createProject({ name: imported.name, engine: imported.engine, prefix: imported.prefix, template: "empty" });
        const config = migrateProject({ ...imported, id: fresh.id, token: null, createdAt: fresh.createdAt, updatedAt: fresh.updatedAt });
        fs.mkdirSync(projectDir(config.id), { recursive: true });
        writeConfig(config.id, config);
        return toRenderer(config, config.id);
    });

    handle("token:validate", async (token) => /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{20,}$/.test(String(token || "").trim()));

    handle("generate:code", async (projectData) => {
        const output = outputDir(projectData.id);
        const token = decryptToken(projectData.id);
        const plugins = pluginManager.getForProject(projectData);
        const result = await codeGenerator.generate(projectData, output, token, plugins);
        return { outputPath: result.outputPath, files: result.files, warnings: result.warnings };
    });

    handle("deps:check", async (projectData) => dependencyInstaller.isInstalled(projectData.engine, outputDir(projectData.id)));

    handle("deps:install", async (projectData) => {
        const output = outputDir(projectData.id);
        return new Promise((resolve) => {
            dependencyInstaller.install(projectData.engine, output, (event) => {
                mainWindow?.webContents.send("deps:progress", event);
                if (event.type === "done" || event.type === "error") resolve(event.type === "done");
            });
        });
    });

    handle("engine:start", async (projectData) => {
        return engineManager.start(projectData.engine, outputDir(projectData.id), decryptToken(projectData.id), sendLog);
    });

    handle("engine:stop", async () => {
        engineManager.stop();
        return true;
    });

    handle("engine:restart", async (projectData) => {
        engineManager.stop();
        await new Promise((r) => setTimeout(r, 600));
        return engineManager.start(projectData.engine, outputDir(projectData.id), decryptToken(projectData.id), sendLog);
    });

    handle("engine:status", async () => engineManager.getStatus());

    handle("db:init", async (projectId, tables) => databaseManager.init(dbPath(projectId), tables));
    handle("db:query", async (projectId, query, params) => databaseManager.query(dbPath(projectId), query, params || []));
    handle("db:getTables", async (projectId) => databaseManager.getTables(dbPath(projectId)));
    handle("db:getTableData", async (projectId, tableName) => databaseManager.getTableData(dbPath(projectId), tableName));
    handle("db:insertRow", async (projectId, tableName, data) => databaseManager.insertRow(dbPath(projectId), tableName, data));
    handle("db:deleteRow", async (projectId, tableName, rowId) => databaseManager.deleteRow(dbPath(projectId), tableName, rowId));
    handle("db:dropTable", async (projectId, tableName) => databaseManager.dropTable(dbPath(projectId), tableName));

    handle("plugins:list", async () => pluginManager.list());
    handle("plugins:toggle", async (pluginId) => pluginManager.toggle(pluginId));
    handle("plugins:reload", async () => pluginManager.reload());

    handle("dialog:openFolder", async () => {
        const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
        return result.canceled ? null : result.filePaths[0];
    });

    handle("shell:openPath", async (target) => {
        const full = path.resolve(String(target));
        if (!full.startsWith(path.resolve(PROJECTS_DIR)) && !full.startsWith(path.resolve(PLUGINS_DIR))) throw new Error("Refusing to open path outside Botify folders");
        fs.mkdirSync(full, { recursive: true });
        await shell.openPath(full);
        return true;
    });

    handle("shell:openExternal", async (url) => {
        if (!/^https?:\/\//i.test(String(url))) throw new Error("Only http(s) links can be opened");
        await shell.openExternal(url);
        return true;
    });

    handle("app:getPath", async () => ({ projects: PROJECTS_DIR, plugins: PLUGINS_DIR, userData: app.getPath("userData") }));
    handle("app:version", async () => app.getVersion());

    const IGNORED = new Set(["node_modules", ".venv", "__pycache__", "deps", ".git"]);
    handle("ide:listFiles", async (projectId) => {
        const base = outputDir(projectId);
        if (!fs.existsSync(base)) return [];
        const walk = (dir, rel = "") => {
            let results = [];
            fs.readdirSync(dir, { withFileTypes: true })
                .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? 1 : -1))
                .forEach((entry) => {
                    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
                    if (entry.isDirectory()) {
                        if (!IGNORED.has(entry.name)) results = results.concat(walk(path.join(dir, entry.name), relPath));
                    } else if (!/\.(db|db-wal|db-shm|pyc)$/.test(entry.name)) {
                        results.push({ name: relPath, type: entry.name.split(".").pop() });
                    }
                });
            return results;
        };
        return walk(base);
    });

    handle("ide:readFile", async (projectId, fileName) => {
        const file = safeOutputPath(projectId, fileName);
        return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
    });

    handle("ide:writeFile", async (projectId, fileName, content) => {
        const file = safeOutputPath(projectId, fileName);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content, "utf-8");
        return true;
    });
}

app.whenReady().then(() => {
    PROJECTS_DIR = path.join(app.getPath("userData"), "projects");

    const localPlugins = path.join(__dirname, "plugins");
    PLUGINS_DIR = fs.existsSync(localPlugins) ? localPlugins : path.join(app.getPath("userData"), "plugins");

    ensureDirectories();
    initializeServices();
    registerIpcHandlers();
    createWindow();
});

app.on("window-all-closed", () => {
    if (engineManager) engineManager.stop();
    app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
