const fs = require("fs");
const path = require("path");

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
        const entries = fs.readdirSync(this.pluginsDir);

        entries.forEach((entry) => {
            const pluginPath = path.join(this.pluginsDir, entry);
            const manifestPath = path.join(pluginPath, "manifest.json");

            if (fs.statSync(pluginPath).isDirectory() && fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
                    const mainFile = manifest.main || "index.js";
                    let customBlocks = [];

                    try {
                        const pluginModulePath = path.join(pluginPath, mainFile);
                        if (fs.existsSync(pluginModulePath)) {
                            
                            delete require.cache[require.resolve(pluginModulePath)];
                            const mod = require(pluginModulePath);
                            if (mod.blocks && Array.isArray(mod.blocks)) {
                                customBlocks = mod.blocks;
                            }
                        }
                    } catch (e) {
                        console.error("Plugin block load error for", pluginPath, e.message);
                    }

                    this.plugins.push({
                        id: entry,
                        name: manifest.name || entry,
                        description: manifest.description || "",
                        version: manifest.version || "1.0.0",
                        author: manifest.author || "Unknown",
                        type: manifest.type || "js",
                        enabled: manifest.enabled !== false,
                        path: pluginPath,
                        main: mainFile,
                        blocks: customBlocks
                    });
                } catch {
                    this.plugins.push({
                        id: entry,
                        name: entry,
                        description: "Invalid manifest",
                        version: "0.0.0",
                        author: "Unknown",
                        enabled: false,
                        path: pluginPath,
                        error: true,
                    });
                }
            }
        });
    }

    list() {
        return this.plugins;
    }

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
        return this.plugins;
    }

    getEnabled() {
        return this.plugins.filter((p) => p.enabled);
    }
}

module.exports = { PluginManager };
