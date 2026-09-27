const fs = require("fs");
const path = require("path");
const vm = require("vm");
const C = require("./common");
const { NodeGenerator } = require("./node");
const { PythonGenerator } = require("./python");
const { LuaGenerator } = require("./lua");

/** Directories/files the generator owns and may wipe before regenerating. */
const GENERATED_DIRS = ["commands", "events", "modules", "cogs"];

class CodeGenerator {
    /**
     * Generate a runnable bot project.
     * @returns {{ outputPath: string, files: string[], warnings: string[] }}
     */
    async generate(project, outputPath, token, plugins = []) {
        const warnings = [];
        const engine = project.engine || "node";

        this._cleanOutput(outputPath);

        const pluginLogics = engine === "node" ? this._loadPlugins(plugins, warnings) : [];
        if (engine !== "node" && plugins.length) {
            warnings.push(`Plugins are only supported by the Node.js engine - ${plugins.length} enabled plugin(s) were skipped.`);
        }

        const pluginBlocks = new Map();
        pluginLogics.forEach((l) => (l.blocks || []).forEach((b) => { if (b && b.type && !C.Blocks.getBlock(b.type)) pluginBlocks.set(b.type, b); }));

        // Commands: project commands win over plugin commands with the same name.
        const commands = [];
        const seen = new Set();
        (project.commands || []).forEach((cmd) => {
            if (!cmd || !cmd.name || cmd.enabled === false) return;
            const key = `${cmd.type || "slash"}:${C.commandName(cmd.name)}`;
            if (seen.has(key)) {
                warnings.push(`Duplicate command "${cmd.name}" - only the first one is used.`);
                return;
            }
            seen.add(key);
            commands.push(cmd);
        });
        pluginLogics.forEach((l) => (l.commands || []).forEach((cmd) => {
            const key = `${cmd.type || "slash"}:${C.commandName(cmd.name)}`;
            if (seen.has(key)) {
                warnings.push(`Plugin "${l.__name}" command "${cmd.name}" skipped (a command with that name already exists).`);
                return;
            }
            seen.add(key);
            commands.push(cmd);
        }));

        const events = (project.events || []).filter((e) => e && e.enabled).map((e) => ({ ...e }));
        pluginLogics.forEach((l) => (l.events || []).forEach((e) => {
            events.push({ ...e, enabled: true, __source: C.commandName(l.__id), __label: `Plugin "${l.__name}" event ${e.type}` });
        }));

        const help = project.helpSettings && project.helpSettings.enabled !== false && !commands.some((c) => C.commandName(c.name) === "help")
            ? project.helpSettings : null;

        let files = [];
        const options = { warnings, pluginBlocks };
        const data = { commands, events, pluginLogics, help };
        switch (engine) {
            case "python":
                files = new PythonGenerator(project, options).write(outputPath, data);
                break;
            case "lua":
                files = new LuaGenerator(project, options).write(outputPath, data);
                break;
            default:
                files = new NodeGenerator(project, options).write(outputPath, data);
                this._checkJsSyntax(outputPath, files, warnings);
        }

        this._writeEnv(project, outputPath, token, engine);
        fs.writeFileSync(path.join(outputPath, ".gitignore"), ".env\nnode_modules/\n.venv/\n__pycache__/\ndeps/\ndata.db*\n");

        return { outputPath, files, warnings: [...new Set(warnings)] };
    }

    _cleanOutput(outputPath) {
        fs.mkdirSync(outputPath, { recursive: true });
        GENERATED_DIRS.forEach((d) => {
            const p = path.join(outputPath, d);
            try {
                if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
            } catch (e) {
                console.error(`Failed to clean ${p}:`, e.message);
            }
        });
    }

    _loadPlugins(plugins, warnings) {
        return (plugins || []).map((p) => {
            try {
                const mainPath = path.join(p.path, p.main || "index.js");
                if (!fs.existsSync(mainPath)) return null;
                delete require.cache[require.resolve(mainPath)];
                const logic = require(mainPath);
                return { ...logic, __name: p.name || p.id, __id: p.id };
            } catch (e) {
                warnings.push(`Plugin "${p.name}" failed to load: ${e.message}`);
                return null;
            }
        }).filter(Boolean);
    }

    _writeEnv(project, outputPath, token, engine) {
        const s = project.settings || {};
        const lines = [
            `DISCORD_TOKEN=${token || "YOUR_TOKEN_HERE"}`,
            `PREFIX=${project.prefix || "!"}`,
            `DEV_GUILD_ID=${s.devGuildId || ""}`,
        ];
        fs.writeFileSync(path.join(outputPath, ".env"), lines.join("\n") + "\n");
    }

    /** Compile (without running) every generated JS file so broken blocks are reported before the bot starts. */
    _checkJsSyntax(outputPath, files, warnings) {
        files.filter((f) => f.endsWith(".js")).forEach((rel) => {
            const code = fs.readFileSync(path.join(outputPath, rel), "utf-8");
            try {
                new vm.Script(`(async function (exports, require, module, __filename, __dirname) {\n${code}\n})`, { filename: rel });
            } catch (e) {
                warnings.push(`Syntax error in ${rel}: ${e.message} (check Custom Code / expression fields)`);
            }
        });
    }
}

module.exports = { CodeGenerator };
