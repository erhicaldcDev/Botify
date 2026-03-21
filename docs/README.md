# Botify Plugins Documentation

Welcome to the Botify Plugins Documentation! This guide will help you understand how to extend the functionality of the Botify Discord Bot Maker. 

Plugins in Botify allow developers to add new commands, hooks, events, and logic blocks to the visual builder, giving users the power to create advanced bots without writing raw code every time.

## Directory Structure

A typical plugin folder should be placed inside the `plugins/` directory of your Botify project or global installation and look like this:

```
plugins/
└── my-awesome-plugin/
    ├── index.js        # Main plugin logic
    └── manifest.json   # Plugin metadata
```

## What can Plugins do?
- **Register new Slash Commands:** Provide complete slash commands directly to the user's bot.
- **Listen to Discord Events:** Hook into events like `on_message`, `on_member_join`, etc.
- **Add custom Logic Blocks:** Provide new "Blocks" that users can connect visually in the Logic Builder.
- **Manage Databases:** Execute local SQLite database reads/writes seamlessly.
- **Make API Requests:** Easily fetch or send data to external APIs.

Check out the other files in this documentation to dive deeper into building your own extensions!

- `MANIFEST.md` - Learn how to define your plugin metadata.
- `ACTIONS.md` - Discover all the built-in action types you can use.
- `EXAMPLE.md` - See a complete, working example of a plugin.
