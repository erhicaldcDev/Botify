# Botify - Discord Bot Maker

<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Electron_Software_Framework_Logo.svg" alt="Electron Logo" width="150"/>
</p>

Botify is an advanced, Electron-based desktop application that allows you to create, manage, and host Discord bots without needing to write complex code from scratch. With its powerful **Blueprint Visual Scripting (BVS)**, you can design bot logic using a node-based graph editor similar to Unreal Engine Blueprints. For advanced users, Botify features a built-in **Code IDE** to manually edit generated code.

## 🚀 Key Features

*   **Blueprint Visual Scripting (BVS):** Build slash & prefix commands and event handlers as node graphs. Pan/zoom canvas, drag blocks from the palette, drag wires between ◆ pins (drop a wire on empty space to create the next block), right-click menus, undo/redo, auto-arrange and live validation. Every graph compiles to working bot code.
*   **45+ blocks:** replies, embeds, DMs, reactions, moderation (kick, ban, timeout, roles, nicknames, purge), conditions & loops, variables, random values, persistent storage, SQL, HTTP requests, bot status and custom code.
*   **Interactive modules:** **Buttons**, **Select menus** and **Modal forms** (pop-up text inputs) that wait for the user and store the answer in a variable - `{clicked}`, `{selected}`, `{form.email}`.
*   **Embed Styler:** design embeds (author, title, description with markdown toolbar, fields, images, footer, timestamp, colors) with a **live Discord-accurate preview**, then send them from any flow with *Send Saved Embed*. Import/export Discord embed JSON.
*   **Components V2 Layouts:** design Discord's new component messages - containers with accent colors, sections with thumbnails or buttons, media galleries, separators and button rows - in a tree designer with live preview, templates and limit checks. Send them with *Send Layout* / *Send Saved Layout* and optionally wait for a button click.
*   **Live previews everywhere:** the block inspector shows exactly how messages, embeds, buttons, menus and modals will look in Discord.
*   **Placeholders & variables:** `{user}`, `{server}`, `{channel}`, command arguments and saved values work in every text field.
*   **Multi-engine output:** `Discord.JS` (Node.js), `Discord.PY` (Python) and `Discordia` (Lua, prefix commands). Generated bots ship with a small runtime helper, are syntax-checked on build and report clear errors (bad token, missing intents).
*   **One-click Build & Run:** saves, generates, installs dependencies when needed and starts the bot; live console with filters and a clickable invite link.
*   **Help Menu designer:** generates an interactive `/help` with a select menu, buttons or a single embed.
*   **Plugins:** enable per project; plugins add commands, events, hooks and new visual blocks.
*   **Customizable look:** 7 themes (Dark, Midnight, Discord, Light, Cyberpunk, Forest, Sunset), custom accent color, compact density, icon-only sidebar, reduced motion and Dark/Light/Onyx Discord previews.
*   **Code IDE, Database editor and English/Polish UI.**

## 📦 How to run / Installation

Botify is packaged as a standard Windows desktop application. 

### Running from source (Development)

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

1. Clone or download this repository.
2. Open a terminal in the project directory.
3. Install dependencies (this also rebuilds the SQLite module for Electron):
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

Plugins are folders inside `plugins/` with a `manifest.json` and an entry file. They can provide commands, events, hooks and **new visual blocks** that compile to code:

```javascript
module.exports = {
    blocks: [
        {
            type: "hello_shout", label: "Shout", icon: "📣",
            fields: [{ key: "text", label: "Text", type: "text", default: "hello {user.name}" }],
            compile: { node: (action, h) => `await B.reply(ctx, String(${h.text(action.text)}).toUpperCase());` }
        }
    ],
    commands: [ /* same action objects as the visual editor */ ]
};
```

See [`docs/`](docs/README.md) - especially [`docs/ACTIONS.md`](docs/ACTIONS.md) (all blocks) and [`docs/EXAMPLE.md`](docs/EXAMPLE.md).

## 🤖 Getting your bot online

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications), open **Bot** and click **Reset Token**.
2. Enable **Message Content** and **Server Members** under *Privileged Gateway Intents* (or turn them off in Botify Settings).
3. Paste the token in Botify → **Settings → Bot token**.
4. Click **Run bot**. The console prints an invite link - open it to add the bot to your server.
5. Optional: set a *Test server ID* in Settings so slash commands update instantly while you build.

## 🛠 Tech Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript, Monaco Editor, Electron Renderer
*   **Backend:** Electron (Main Process), Node.js `fs` module, IPC communication
*   **UI/UX:** Custom dark-mode "Glassmorphism" interface with pure CSS and SVG elements for node connections.

## 📄 License & Credits

This project is created to democratize Discord bot creation. 
MIT License.
