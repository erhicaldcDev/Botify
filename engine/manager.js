const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

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
    }

    start(engine, projectPath, token, logCallback) {
        if (this.running) {
            this.stop();
        }

        this.currentEngine = engine;
        this.currentPath = projectPath;
        this.currentToken = token;
        this.logCallback = logCallback;
        this.intentionalStop = false;
        this.autoRestart = true;

        this._spawn();
    }

    _spawn() {
        let command;
        let args;
        const env = { ...process.env };

        if (this.currentToken) {
            env.DISCORD_TOKEN = this.currentToken;
        }

        switch (this.currentEngine) {
            case "node":
                if (!fs.existsSync(path.join(this.currentPath, "node_modules"))) {
                    this._log("error", "Dependencies not found! Click 'Generate & Install' to install them first.");
                    return;
                }
                command = "node";
                args = ["index.js"];
                break;
            case "python": {
                const isWin = process.platform === "win32";
                const venvExt = isWin ? "Scripts" : "bin";
                const venvPath = path.join(this.currentPath, ".venv");
                if (!fs.existsSync(venvPath)) {
                    this._log("error", "Python virtual environment not found! Click 'Generate & Install' to create it first.");
                    return;
                }
                command = path.join(venvPath, venvExt, isWin ? "python.exe" : "python3");
                args = ["main.py"];
                break;
            }
            case "lua":
                command = "lua";
                args = ["main.lua"];
                break;
            default:
                this._log("error", `Unknown engine: ${this.currentEngine}`);
                return;
        }

        this._log("info", `Starting ${this.currentEngine} engine...`);

        try {
            this.process = spawn(command, args, {
                cwd: this.currentPath,
                env,
                shell: true,
                windowsHide: true,
            });

            this.running = true;

            this.process.stdout.on("data", (data) => {
                this._log("stdout", data.toString().trim());
            });

            this.process.stderr.on("data", (data) => {
                this._log("stderr", data.toString().trim());
            });

            this.process.on("error", (err) => {
                this._log("error", `Process error: ${err.message}`);
                this.running = false;
            });

            this.process.on("exit", (code) => {
                this.running = false;
                this.process = null;

                if (this.intentionalStop) {
                    this._log("info", "Bot stopped.");
                    return;
                }

                this._log("warn", `Process exited with code ${code}`);

                if (this.autoRestart) {
                    this._log("info", "Auto-restarting in 3 seconds...");
                    setTimeout(() => {
                        if (!this.intentionalStop) {
                            this._spawn();
                        }
                    }, 3000);
                }
            });
        } catch (err) {
            this._log("error", `Failed to start: ${err.message}`);
            this.running = false;
        }
    }

    stop() {
        this.intentionalStop = true;
        this.autoRestart = false;

        if (this.process) {
            try {
                if (process.platform === "win32") {
                    spawn("taskkill", ["/pid", this.process.pid, "/f", "/t"], {
                        shell: true,
                    });
                } else {
                    this.process.kill("SIGTERM");
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
        };
    }

    _log(type, message) {
        if (this.logCallback) {
            this.logCallback({
                type,
                message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}

module.exports = { EngineManager };
