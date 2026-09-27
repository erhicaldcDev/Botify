const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const isWin = process.platform === "win32";

/**
 * Run a command and stream its output. Resolves with the exit code (or -1 if it could not start).
 * Windows .cmd shims (npm.cmd) must run through a shell; quoted args keep paths with spaces working.
 */
function run(command, args, cwd, callback, { shell = false } = {}) {
    return new Promise((resolve) => {
        let proc;
        try {
            proc = spawn(shell ? `"${command}"` : command, shell ? args.map((a) => `"${a}"`) : args, { cwd, shell, windowsHide: true, env: { ...process.env, FORCE_COLOR: "0" } });
        } catch (err) {
            callback({ type: "log", message: `Failed to run ${command}: ${err.message}` });
            resolve(-1);
            return;
        }
        const forward = (data) => {
            data.toString().split(/\r?\n/).filter((l) => l.trim()).forEach((line) => callback({ type: "log", message: line }));
        };
        proc.stdout.on("data", forward);
        proc.stderr.on("data", forward);
        proc.on("error", (err) => {
            callback({ type: "log", message: `${command}: ${err.code === "ENOENT" ? "not found - is it installed and on your PATH?" : err.message}` });
            resolve(-1);
        });
        proc.on("exit", (code) => resolve(code));
    });
}

class DependencyInstaller {
    /** Returns true when the generated project already has its dependencies installed. */
    isInstalled(engine, projectPath) {
        switch (engine) {
            case "node": return fs.existsSync(path.join(projectPath, "node_modules", "discord.js"));
            case "python": return fs.existsSync(path.join(projectPath, ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python3"));
            case "lua": return fs.existsSync(path.join(projectPath, "deps", "discordia"));
            default: return false;
        }
    }

    install(engine, projectPath, callback) {
        switch (engine) {
            case "node": return this._installNode(projectPath, callback);
            case "python": return this._installPython(projectPath, callback);
            case "lua": return this._installLua(projectPath, callback);
            default:
                callback({ type: "error", message: `Unknown engine: ${engine}` });
        }
    }

    async _installNode(projectPath, callback) {
        if (!fs.existsSync(path.join(projectPath, "package.json"))) {
            callback({ type: "error", message: "package.json not found - generate the code first." });
            return;
        }
        callback({ type: "log", message: "Installing Node.js dependencies (npm install)..." });
        callback({ type: "progress", value: 15 });
        const npm = isWin ? "npm.cmd" : "npm";
        const code = await run(npm, ["install", "--omit=dev", "--no-audit", "--no-fund"], projectPath, (e) => {
            callback(e);
            callback({ type: "progress", value: 60 });
        }, { shell: isWin });
        if (code === 0) {
            callback({ type: "progress", value: 100 });
            callback({ type: "done", message: "Dependencies installed successfully" });
        } else {
            callback({ type: "error", message: code === -1 ? "npm was not found. Install Node.js from https://nodejs.org" : `npm install exited with code ${code}` });
        }
    }

    async _installPython(projectPath, callback) {
        if (!fs.existsSync(path.join(projectPath, "requirements.txt"))) {
            callback({ type: "error", message: "requirements.txt not found - generate the code first." });
            return;
        }
        callback({ type: "log", message: "Creating Python virtual environment (.venv)..." });
        callback({ type: "progress", value: 10 });

        const venvPy = path.join(projectPath, ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python3");
        if (!fs.existsSync(venvPy)) {
            const candidates = isWin ? ["py", "python", "python3"] : ["python3", "python"];
            let created = false;
            for (const cmd of candidates) {
                const code = await run(cmd, ["-m", "venv", ".venv"], projectPath, callback);
                if (code === 0 && fs.existsSync(venvPy)) { created = true; break; }
            }
            if (!created) {
                callback({ type: "error", message: "Failed to create the Python virtual environment. Install Python 3.9+ from https://python.org (check 'Add to PATH')." });
                return;
            }
        }

        callback({ type: "progress", value: 35 });
        callback({ type: "log", message: "Installing Python dependencies (pip install -r requirements.txt)..." });
        const code = await run(venvPy, ["-m", "pip", "install", "--disable-pip-version-check", "-r", "requirements.txt"], projectPath, (e) => {
            callback(e);
            callback({ type: "progress", value: 70 });
        });
        if (code === 0) {
            callback({ type: "progress", value: 100 });
            callback({ type: "done", message: "Python dependencies installed successfully" });
        } else {
            callback({ type: "error", message: `pip install exited with code ${code}` });
        }
    }

    async _installLua(projectPath, callback) {
        callback({ type: "log", message: "Installing Discordia (lit install SinisterRectus/discordia)..." });
        callback({ type: "progress", value: 20 });
        const code = await run(isWin ? "lit.exe" : "lit", ["install", "SinisterRectus/discordia"], projectPath, (e) => {
            callback(e);
            callback({ type: "progress", value: 60 });
        });
        if (code === 0) {
            callback({ type: "progress", value: 100 });
            callback({ type: "done", message: "Lua dependencies installed" });
        } else {
            callback({ type: "error", message: code === -1 ? "'lit' was not found. Install Luvit from https://luvit.io (it includes lit)." : `lit exited with code ${code}` });
        }
    }
}

module.exports = { DependencyInstaller };
