# Build Your First Plugin

This file walks you through a simple, complete plugin implementation. This plugin listens for `!ping` and replies with `Pong!`.

## Step 1: Create the Folder

Create a folder inside the `plugins/` directory:

```bash
mkdir my-plugin
```

## Step 2: The Manifest

Create `plugins/my-plugin/manifest.json`:

```json
{
  "id": "ping-plugin",
  "name": "Ping Pong",
  "version": "1.0.0",
  "author": "Botify Beginner",
  "description": "A basic ping command to test the plugin system.",
  "type": "js"
}
```

## Step 3: Main File

Create `plugins/my-plugin/index.js`. This code is executed when the bot starts, so make sure it uses Discord.js correctly to inject logic.

```javascript
module.exports = {
  // Executed before the bot logs in, can register logic blocks
  init: function (bot) {
    console.log("Ping plugin initializing!");
  },

  // Event listener hook
  onMessage: function (message) {
    if (message.content === "!ping") {
      message.reply("Pong!");
    }
  }
};
```

## Step 4: Loading

1. Place the folder into the `plugins/` directory.
2. Open the Botify Desktop app.
3. Click the **Plugins** tab in the sidebar.
4. Locate your new "Ping Pong" box and toggle the **Switchbox** to Enable it!
5. Build and launch your project! The code injected will seamlessly listen to messages.
