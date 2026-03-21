const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { EngineManager } = require("./engine/manager");
const { DependencyInstaller } = require("./engine/dependency");
const { CodeGenerator } = require("./engine/generator");
const { CryptoManager } = require("./engine/crypto");
const { DatabaseManager } = require("./engine/database");
const { PluginManager } = require("./engine/plugins");
const { v4: uuidv4 } = require("uuid");

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
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        frame: false,
        backgroundColor: "#0d0f14",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        icon: path.join(__dirname, "src", "assets", "icon.png"),
    });

    mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

function initializeServices() {
    cryptoManager = new CryptoManager(app.getPath("userData"));
    engineManager = new EngineManager();
    dependencyInstaller = new DependencyInstaller();
    codeGenerator = new CodeGenerator();
    databaseManager = new DatabaseManager();
    pluginManager = new PluginManager(PLUGINS_DIR);
}

function registerIpcHandlers() {
    ipcMain.on("window:minimize", () => mainWindow?.minimize());
    ipcMain.on("window:maximize", () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });
    ipcMain.on("window:close", () => mainWindow?.close());

    ipcMain.handle("project:list", async () => {
        try {
            const dirs = fs.readdirSync(PROJECTS_DIR).filter((d) => {
                const configPath = path.join(PROJECTS_DIR, d, "project.json");
                return fs.existsSync(configPath);
            });
            return dirs.map((d) => {
                const config = JSON.parse(
                    fs.readFileSync(path.join(PROJECTS_DIR, d, "project.json"), "utf-8")
                );
                return { ...config, path: path.join(PROJECTS_DIR, d) };
            });
        } catch {
            return [];
        }
    });

    ipcMain.handle("project:create", async (_, data) => {
        const id = uuidv4();
        const projectPath = path.join(PROJECTS_DIR, id);
        fs.mkdirSync(projectPath, { recursive: true });

        const encryptedToken = data.token
            ? cryptoManager.encrypt(data.token)
            : null;

        const config = {
            id,
            name: data.name,
            engine: data.engine,
            token: encryptedToken,
            prefix: data.prefix || "!",
            commands: [],
            events: [
                { type: "on_ready", enabled: true, actions: [] },
                { type: "on_message", enabled: false, actions: [] },
                { type: "on_member_join", enabled: false, actions: [] },
                { type: "on_member_leave", enabled: false, actions: [] },
                { type: "on_interaction", enabled: true, actions: [] },
                { type: "on_reaction_add", enabled: false, actions: [] },
            ],
            embeds: [],
            database: { type: "sqlite", tables: [] },
            plugins: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        fs.writeFileSync(
            path.join(projectPath, "project.json"),
            JSON.stringify(config, null, 2)
        );

        return { ...config, path: projectPath };
    });

    ipcMain.handle("project:open", async (_, projectId) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const configPath = path.join(projectPath, "project.json");
        if (!fs.existsSync(configPath)) return null;
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        return { ...config, path: projectPath };
    });

    ipcMain.handle("project:save", async (_, projectData) => {
        const projectPath = path.join(PROJECTS_DIR, projectData.id);
        const config = { ...projectData };
        delete config.path;
        config.updatedAt = new Date().toISOString();
        fs.writeFileSync(
            path.join(projectPath, "project.json"),
            JSON.stringify(config, null, 2)
        );
        return true;
    });

    ipcMain.handle("project:delete", async (_, projectId) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
        return true;
    });

    ipcMain.handle("project:getToken", async (_, projectId) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const config = JSON.parse(
            fs.readFileSync(path.join(projectPath, "project.json"), "utf-8")
        );
        if (!config.token) return null;
        return cryptoManager.decrypt(config.token);
    });

    ipcMain.handle("project:setToken", async (_, projectId, token) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const configPath = path.join(projectPath, "project.json");
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        config.token = token ? cryptoManager.encrypt(token) : null;
        config.updatedAt = new Date().toISOString();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    });

    ipcMain.handle("token:validate", async (_, token) => {
        const tokenRegex =
            /^[A-Za-z0-9_-]{24,28}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}$/;
        return tokenRegex.test(token);
    });

    ipcMain.handle("generate:code", async (_, projectData) => {
        const projectPath = path.join(PROJECTS_DIR, projectData.id);
        const outputPath = path.join(projectPath, "output");
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        } else {
            
            try { if (fs.existsSync(path.join(outputPath, "commands"))) fs.rmSync(path.join(outputPath, "commands"), { recursive: true, force: true }); } catch (e) { }
            try { if (fs.existsSync(path.join(outputPath, "events"))) fs.rmSync(path.join(outputPath, "events"), { recursive: true, force: true }); } catch (e) { }
        }

        let token = null;
        if (projectData.token) {
            token = cryptoManager.decrypt(projectData.token);
        }

        const enabledPlugins = pluginManager.getEnabled();
        await codeGenerator.generate(projectData, outputPath, token, enabledPlugins);
        return outputPath;
    });

    ipcMain.handle("deps:install", async (_, projectData) => {
        const projectPath = path.join(PROJECTS_DIR, projectData.id);
        const outputPath = path.join(projectPath, "output");
        return new Promise((resolve) => {
            dependencyInstaller.install(projectData.engine, outputPath, (event) => {
                mainWindow?.webContents.send("deps:progress", event);
                if (event.type === "done" || event.type === "error") {
                    resolve(event.type === "done");
                }
            });
        });
    });

    ipcMain.handle("engine:start", async (_, projectData) => {
        const projectPath = path.join(PROJECTS_DIR, projectData.id);
        const outputPath = path.join(projectPath, "output");

        let token = null;
        if (projectData.token) {
            token = cryptoManager.decrypt(projectData.token);
        }

        engineManager.start(projectData.engine, outputPath, token, (event) => {
            mainWindow?.webContents.send("engine:log", event);
        });
        return true;
    });

    ipcMain.handle("engine:stop", async () => {
        engineManager.stop();
        return true;
    });

    ipcMain.handle("engine:restart", async (_, projectData) => {
        engineManager.stop();
        const projectPath = path.join(PROJECTS_DIR, projectData.id);
        const outputPath = path.join(projectPath, "output");

        let token = null;
        if (projectData.token) {
            token = cryptoManager.decrypt(projectData.token);
        }

        setTimeout(() => {
            engineManager.start(projectData.engine, outputPath, token, (event) => {
                mainWindow?.webContents.send("engine:log", event);
            });
        }, 500);
        return true;
    });

    ipcMain.handle("engine:status", async () => {
        return engineManager.getStatus();
    });

    ipcMain.handle("db:init", async (_, projectId, tables) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectPath, "data.db");
        databaseManager.init(dbPath, tables);
        return true;
    });

    ipcMain.handle("db:query", async (_, projectId, query, params) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectPath, "data.db");
        return databaseManager.query(dbPath, query, params);
    });

    ipcMain.handle("db:getTables", async (_, projectId) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectPath, "data.db");
        return databaseManager.getTables(dbPath);
    });

    ipcMain.handle("db:getTableData", async (_, projectId, tableName) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectPath, "data.db");
        return databaseManager.getTableData(dbPath, tableName);
    });

    ipcMain.handle("db:insertRow", async (_, projectId, tableName, data) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectPath, "data.db");
        return databaseManager.insertRow(dbPath, tableName, data);
    });

    ipcMain.handle("db:deleteRow", async (_, projectId, tableName, rowId) => {
        const projectPath = path.join(PROJECTS_DIR, projectId);
        const dbPath = path.join(projectPath, "data.db");
        return databaseManager.deleteRow(dbPath, tableName, rowId);
    });

    ipcMain.handle("plugins:list", async () => {
        return pluginManager.list();
    });

    ipcMain.handle("plugins:toggle", async (_, pluginId) => {
        return pluginManager.toggle(pluginId);
    });

    ipcMain.handle("plugins:reload", async () => {
        return pluginManager.reload();
    });

    ipcMain.handle("dialog:openFolder", async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"],
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle("shell:openPath", async (_, filePath) => {
        shell.openPath(filePath);
        return true;
    });

    ipcMain.handle("app:getPath", async () => {
        return {
            projects: PROJECTS_DIR,
            plugins: PLUGINS_DIR,
            userData: app.getPath("userData")
        };
    });



    ipcMain.handle("ide:listFiles", async (_, projectId) => {
        const projectPath = path.join(PROJECTS_DIR, projectId, "output");
        if (!fs.existsSync(projectPath)) return [];

        const getFiles = (dir, base = "") => {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                const relPath = path.join(base, file);
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) {
                    if (file !== "node_modules" && file !== ".venv" && file !== "__pycache__") {
                        results = results.concat(getFiles(fullPath, relPath));
                    }
                } else {
                    results.push({ name: relPath, type: file.split('.').pop() });
                }
            });
            return results;
        };

        return getFiles(projectPath);
    });

    ipcMain.handle("ide:readFile", async (_, projectId, fileName) => {
        const filePath = path.join(PROJECTS_DIR, projectId, "output", fileName);
        if (!fs.existsSync(filePath)) return "";
        return fs.readFileSync(filePath, "utf-8");
    });

    ipcMain.handle("ide:writeFile", async (_, projectId, fileName, content) => {
        const filePath = path.join(PROJECTS_DIR, projectId, "output", fileName);
        fs.writeFileSync(filePath, content, "utf-8");
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
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
