const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/** Exit code used by generated bots for configuration errors (bad token / intents) - never auto-restarted. */
const CONFIG_ERROR_EXIT = 78;
const MAX_QUICK_CRASHES = 3;
const QUICK_CRASH_MS = 15000;

class EngineManager {
    constructor() {
        this.process = null;
        this.running = false;
        this.autoRestart = true;
        this.currentEngine = null;
        this.currentPath = null;
        this.currentToken = null;
        this.logCallback = null;
        this.intentionalStop = false;
        this.startedAt = 0;
        this.quickCrashes = 0;
        this.restartTimer = null;
    }

    start(engine, projectPath, token, logCallback) {
        if (this.running) this.stop();
        clearTimeout(this.restartTimer);

        this.currentEngine = engine;
        this.currentPath = projectPath;
        this.currentToken = token;
        this.logCallback = logCallback;
        this.intentionalStop = false;
        this.autoRestart = true;
        this.quickCrashes = 0;

        return this._spawn();
    }

    _resolveCommand() {
        const isWin = process.platform === "win32";
        switch (this.currentEngine) {
            case "node": {
                if (!fs.existsSync(path.join(this.currentPath, "index.js"))) {
                    return { error: "Bot code not generated yet. Click 'Build & Run' (or 'Generate & Install') first." };
                }
                if (!fs.existsSync(path.join(this.currentPath, "node_modules", "discord.js"))) {
                    return { error: "Dependencies not installed! Click 'Generate & Install' to install them first." };
                }
                return { command: isWin ? "node.exe" : "node", args: ["index.js"] };
            }
            case "python": {
                const venvPy = path.join(this.currentPath, ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python3");
                if (!fs.existsSync(path.join(this.currentPath, "main.py"))) {
                    return { error: "Bot code not generated yet. Click 'Build & Run' first." };
                }
                if (!fs.existsSync(venvPy)) {
                    return { error: "Python virtual environment not found! Click 'Generate & Install' to create it first." };
                }
                return { command: venvPy, args: ["-u", "main.py"] };
            }
            case "lua":
                if (!fs.existsSync(path.join(this.currentPath, "main.lua"))) {
                    return { error: "Bot code not generated yet. Click 'Build & Run' first." };
                }
                return { command: isWin ? "luvit.exe" : "luvit", args: ["main.lua"] };
            default:
                return { error: `Unknown engine: ${this.currentEngine}` };
        }
    }

    _spawn() {
        const resolved = this._resolveCommand();
        if (resolved.error) {
            this._log("error", resolved.error);
            this.running = false;
            return false;
        }

        const env = { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8", FORCE_COLOR: "0" };
        if (this.currentToken) env.DISCORD_TOKEN = this.currentToken;

        this._log("info", `Starting ${this.currentEngine} engine...`);

        try {
            this.process = spawn(resolved.command, resolved.args, {
                cwd: this.currentPath,
                env,
                shell: false,
                windowsHide: true,
            });
            this.running = true;
            this.startedAt = Date.now();

            const pipe = (stream, type) => {
                let buffer = "";
                stream.setEncoding("utf-8");
                stream.on("data", (chunk) => {
                    buffer += chunk;
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop();
                    lines.filter((l) => l.trim()).forEach((l) => this._log(type, this._redact(l)));
                });
                stream.on("end", () => {
                    if (buffer.trim()) this._log(type, this._redact(buffer));
                    buffer = "";
                });
            };
            pipe(this.process.stdout, "stdout");
            pipe(this.process.stderr, "stderr");

            this.process.on("error", (err) => {
                const hint = err.code === "ENOENT"
                    ? ` - '${resolved.command}' was not found. Make sure it is installed and on your PATH.`
                    : "";
                this._log("error", `Process error: ${err.message}${hint}`);
                this.running = false;
                this.autoRestart = false;
            });

            this.process.on("exit", (code, signal) => this._onExit(code, signal));
            return true;
        } catch (err) {
            this._log("error", `Failed to start: ${err.message}`);
            this.running = false;
            return false;
        }
    }

    _onExit(code, signal) {
        this.running = false;
        this.process = null;

        if (this.intentionalStop) {
            this._log("info", "Bot stopped.");
            return;
        }

        this._log("warn", `Process exited with code ${code}${signal ? ` (${signal})` : ""}`);

        if (code === CONFIG_ERROR_EXIT) {
            this._log("error", "Configuration problem (token / intents) - fix it in Settings, then start again.");
            return;
        }

        if (Date.now() - this.startedAt < QUICK_CRASH_MS) this.quickCrashes++;
        else this.quickCrashes = 0;

        if (this.quickCrashes >= MAX_QUICK_CRASHES) {
            this._log("error", `The bot crashed ${MAX_QUICK_CRASHES} times in a row right after starting - auto-restart disabled. Check the errors above.`);
            return;
        }

        if (this.autoRestart) {
            this._log("info", "Auto-restarting in 3 seconds...");
            this.restartTimer = setTimeout(() => {
                if (!this.intentionalStop) this._spawn();
            }, 3000);
        }
    }

    stop() {
        this.intentionalStop = true;
        this.autoRestart = false;
        clearTimeout(this.restartTimer);

        if (this.process) {
            const proc = this.process;
            try {
                if (process.platform === "win32") {
                    spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], { windowsHide: true });
                } else {
                    proc.kill("SIGTERM");
                    setTimeout(() => { try { proc.kill("SIGKILL"); } catch { /* already gone */ } }, 4000);
                }
            } catch (err) {
                this._log("error", `Error stopping process: ${err.message}`);
            }
            this.process = null;
            this.running = false;
        }
    }

    getStatus() {
        return {
            running: this.running,
            engine: this.currentEngine,
            uptime: this.running ? Date.now() - this.startedAt : 0,
        };
    }

    _redact(line) {
        if (this.currentToken && this.currentToken.length > 10) return line.split(this.currentToken).join("[TOKEN]");
        return line;
    }

    _log(type, message) {
        if (this.logCallback) {
            this.logCallback({ type, message, timestamp: new Date().toISOString() });
        }
    }
}

module.exports = { EngineManager };
