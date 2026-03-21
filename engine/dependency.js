const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

class DependencyInstaller {
    install(engine, projectPath, callback) {
        switch (engine) {
            case "node":
                this._installNode(projectPath, callback);
                break;
            case "python":
                this._installPython(projectPath, callback);
                break;
            case "lua":
                this._installLua(projectPath, callback);
                break;
            default:
                callback({ type: "error", message: `Unknown engine: ${engine}` });
        }
    }

    _installNode(projectPath, callback) {
        const packageJsonPath = path.join(projectPath, "package.json");
        if (!fs.existsSync(packageJsonPath)) {
            callback({ type: "error", message: "package.json not found" });
            return;
        }

        callback({ type: "log", message: "Installing Node.js dependencies..." });
        callback({ type: "progress", value: 10 });

        const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
        const proc = spawn(npmCmd, ["install", "--production"], {
            cwd: projectPath,
            shell: true,
            windowsHide: true,
        });

        proc.stdout.on("data", (data) => {
            callback({ type: "log", message: data.toString().trim() });
            callback({ type: "progress", value: 50 });
        });

        proc.stderr.on("data", (data) => {
            const msg = data.toString().trim();
            if (msg.includes("warn")) {
                callback({ type: "log", message: msg });
            } else {
                callback({ type: "log", message: msg });
            }
        });

        proc.on("error", (err) => {
            callback({ type: "error", message: `npm install failed: ${err.message}` });
        });

        proc.on("exit", (code) => {
            if (code === 0) {
                callback({ type: "progress", value: 100 });
                callback({ type: "done", message: "Dependencies installed successfully" });
            } else {
                callback({ type: "error", message: `npm install exited with code ${code}` });
            }
        });
    }

    _installPython(projectPath, callback) {
        const reqPath = path.join(projectPath, "requirements.txt");
        if (!fs.existsSync(reqPath)) {
            callback({ type: "error", message: "requirements.txt not found" });
            return;
        }

        callback({ type: "log", message: "Installing Python dependencies in .venv..." });
        callback({ type: "progress", value: 10 });

        const isWin = process.platform === "win32";
        const venvCmd = isWin ? "python" : "python3";
        const venvPath = path.join(projectPath, ".venv");

        const setupProc = spawn(venvCmd, ["-m", "venv", ".venv"], {
            cwd: projectPath,
            shell: true,
            windowsHide: true,
        });

        setupProc.on("exit", (code) => {
            if (code !== 0) {
                callback({ type: "error", message: "Failed to create python virtual environment (.venv)" });
                return;
            }

            callback({ type: "progress", value: 30 });

            const venvExt = isWin ? "Scripts" : "bin";
            const pipCmd = path.join(venvPath, venvExt, isWin ? "pip.exe" : "pip3");

            const proc = spawn(pipCmd, ["install", "-r", "requirements.txt", "--quiet"], {
                cwd: projectPath,
                shell: true,
                windowsHide: true,
            });

            proc.stdout.on("data", (data) => {
                callback({ type: "log", message: data.toString().trim() });
                callback({ type: "progress", value: 60 });
            });

            proc.stderr.on("data", (data) => {
                callback({ type: "log", message: data.toString().trim() });
            });

            proc.on("error", (err) => {
                callback({ type: "error", message: `pip install failed: ${err.message}` });
            });

            proc.on("exit", (code) => {
                if (code === 0) {
                    callback({ type: "progress", value: 100 });
                    callback({ type: "done", message: "Python dependencies installed successfully" });
                } else {
                    callback({ type: "error", message: `pip install exited with code ${code}` });
                }
            });
        });
    }

    _installLua(projectPath, callback) {
        callback({ type: "log", message: "Installing Lua dependencies..." });
        callback({ type: "progress", value: 10 });

        const proc = spawn("luarocks", ["install", "discordia"], {
            cwd: projectPath,
            shell: true,
            windowsHide: true,
        });

        proc.stdout.on("data", (data) => {
            callback({ type: "log", message: data.toString().trim() });
            callback({ type: "progress", value: 50 });
        });

        proc.stderr.on("data", (data) => {
            callback({ type: "log", message: data.toString().trim() });
        });

        proc.on("error", (err) => {
            callback({ type: "error", message: `luarocks install failed: ${err.message}` });
        });

        proc.on("exit", (code) => {
            if (code === 0) {
                callback({ type: "progress", value: 100 });
                callback({ type: "done", message: "Lua dependencies installed" });
            } else {
                callback({ type: "error", message: `luarocks exited with code ${code}` });
            }
        });
    }
}

module.exports = { DependencyInstaller };
