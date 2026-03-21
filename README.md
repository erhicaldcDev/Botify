# Botify - Discord Bot Maker

<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Electron_Software_Framework_Logo.svg" alt="Electron Logo" width="150"/>
</p>

Botify is an advanced, Electron-based desktop application that allows you to create, manage, and host Discord bots without needing to write complex code from scratch. With its powerful **Blueprint Visual Scripting (BVS)**, you can design bot logic using a node-based graph editor similar to Unreal Engine Blueprints. For advanced users, Botify features a built-in **Code IDE** to manually edit generated code.

## 🚀 Key Features

*   **Blueprint Visual Scripting (BVS):** Create slash commands visually using drag-and-drop nodes. Connect nodes with bezier curve wires to define complex logic flows (If Conditions, API Requests, Database interactions, etc.).
*   **Multi-Engine Support:** Generate bot code for your preferred ecosystem:
    *   `Discord.JS` (Node.js)
    *   `Discord.PY` (Python)
    *   `Discordia` (Lua)
*   **Plugin Ecosystem:** Extend the platform's functionality with custom plugins. Plugins can introduce new bot commands, system integrations, and even add completely custom BVS visual blocks/nodes to the Visual Editor!
*   **Integrated Code IDE:** A fully functional Monaco-based editor (the same engine powering VS Code) integrated right into the app. Edit the automatically generated code directly, complete with syntax highlighting and syntax error checking.
*   **Live Console & Testing:** Run your bot directly from the app. View real-time output, errors, and terminal logs in the integrated Live Console.
*   **Internationalization (i18n):** Full support for multiple languages (currently English and Polish), instantly switchable from the Settings page.
*   **Dashboard & Built-in Services:** Manage your Project Token, manage visual Embeds, configure Database inputs, and view Analytics all in one place.

## 📦 How to run / Installation

Botify is packaged as a standard Windows desktop application. 

### Running from source (Development)

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

1. Clone or download this repository.
2. Open a terminal in the project directory.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

### Building the Executable

To compile Botify into a standalone Windows executable (`.exe`), run:
```bash
npm run package
```
This will generate the built application in the `dist/Botify-win32-x64/` directory using Electron Packager.

## 🧩 Developing Plugins

Plugins are structured as simple folders inside the `plugins/` directory. A plugin must contain an `index.js` (or other entry point) and a `manifest.json`.

**Adding Custom BVS Blocks:**
Your plugin can inject custom nodes into the Visual Editor by exposing a `blocks` array in its `module.exports`:

```javascript
module.exports = {
    name: "My Custom Plugin",
    dependencies: {},
    blocks: [
        { type: "send_meme", label: "Send Meme", label_pl: "Wyślij Mema", icon: "🐸" },
        { type: "random_chance", label: "50/50 Chance", label_pl: "Szansa 50/50", icon: "🎲", pins: ["true_next", "false_next", "next"] }
    ],
    commands: [
        // ... command configurations
    ]
};
```

## 🛠 Tech Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript, Monaco Editor, Electron Renderer
*   **Backend:** Electron (Main Process), Node.js `fs` module, IPC communication
*   **UI/UX:** Custom dark-mode "Glassmorphism" interface with pure CSS and SVG elements for node connections.

## 📄 License & Credits

This project is created to democratize Discord bot creation. 
MIT License.
