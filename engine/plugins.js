const fs = require("fs");
const path = require("path");

/** Deep copy that drops functions so the value can be sent over IPC. */
function serializable(value) {
    if (typeof value === "function") return undefined;
    if (Array.isArray(value)) return value.map(serializable).filter((v) => v !== undefined);
    if (value && typeof value === "object") {
        const out = {};
        Object.entries(value).forEach(([k, v]) => {
            const s = serializable(v);
            if (s !== undefined) out[k] = s;
        });
        return out;
    }
    return value;
}

class PluginManager {
    constructor(pluginsDir) {
        this.pluginsDir = pluginsDir;
        this.plugins = [];
        this._ensureDir();
        this._loadPlugins();
    }

    _ensureDir() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }
    }

    _loadPlugins() {
        this.plugins = [];
        let entries = [];
        try {
            entries = fs.readdirSync(this.pluginsDir);
        } catch (e) {
            console.error("Cannot read plugins directory:", e.message);
            return;
        }

        entries.forEach((entry) => {
            const pluginPath = path.join(this.pluginsDir, entry);
            const manifestPath = path.join(pluginPath, "manifest.json");
            let isDir = false;
            try { isDir = fs.statSync(pluginPath).isDirectory(); } catch { isDir = false; }
            if (!isDir || !fs.existsSync(manifestPath)) return;

            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                const mainFile = manifest.main || "index.js";
                const info = {
                    id: entry,
                    name: manifest.name || entry,
                    description: manifest.description || "",
                    version: manifest.version || "1.0.0",
                    author: manifest.author || "Unknown",
                    type: manifest.type || "js",
                    enabled: manifest.enabled !== false,
                    path: pluginPath,
                    main: mainFile,
                    blocks: [],
                    commands: [],
                    events: [],
                    hooks: [],
                    dependencies: {},
                };

                try {
                    const modulePath = path.join(pluginPath, mainFile);
                    if (fs.existsSync(modulePath)) {
                        delete require.cache[require.resolve(modulePath)];
                        const mod = require(modulePath);
                        info.blocks = Array.isArray(mod.blocks) ? mod.blocks.map((b) => ({ ...serializable(b), category: b.category || "plugin", plugin: entry, compiles: !!(b.compile && b.compile.node) })) : [];
                        info.commands = (mod.commands || []).map((c) => ({ name: c.name, description: c.description || "", type: c.type || "slash" }));
                        info.events = (mod.events || []).map((e) => e.type);
                        info.hooks = Object.keys(mod.hooks || {});
                        info.dependencies = mod.dependencies || {};
                    }
                } catch (e) {
                    info.error = `Failed to load: ${e.message}`;
                }

                this.plugins.push(info);
            } catch {
                this.plugins.push({
                    id: entry, name: entry, description: "Invalid manifest.json", version: "0.0.0", author: "Unknown",
                    enabled: false, path: pluginPath, error: "Invalid manifest.json", blocks: [], commands: [], events: [], hooks: [],
                });
            }
        });
        this.plugins.sort((a, b) => a.name.localeCompare(b.name));
    }

    list() {
        return this.plugins.map((p) => serializable(p));
    }

    /** Globally enable/disable a plugin (disabled plugins are hidden from projects). */
    toggle(pluginId) {
        const plugin = this.plugins.find((p) => p.id === pluginId);
        if (!plugin) return false;

        plugin.enabled = !plugin.enabled;
        const manifestPath = path.join(plugin.path, "manifest.json");
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            manifest.enabled = plugin.enabled;
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        }
        return plugin.enabled;
    }

    reload() {
        this._loadPlugins();
        return this.list();
    }

    /** Plugins a project has switched on (and that are installed, enabled and loadable). */
    getForProject(project) {
        const ids = new Set(Array.isArray(project && project.plugins) ? project.plugins : []);
        return this.plugins.filter((p) => ids.has(p.id) && p.enabled && !p.error);
    }
}

module.exports = { PluginManager };
