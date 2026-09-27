# Build Your First Plugin

This walks through a complete plugin that adds a command, an event, a message hook and a
brand-new visual block. Plugins currently target the **Node.js (discord.js)** engine.

## Step 1: Create the folder

```
plugins/
└── hello-plugin/
    ├── index.js
    └── manifest.json
```

## Step 2: The manifest

`plugins/hello-plugin/manifest.json` (see [MANIFEST.md](MANIFEST.md)):

```json
{
  "name": "Hello Plugin",
  "version": "1.0.0",
  "author": "Botify Beginner",
  "description": "Says hello in several ways.",
  "main": "index.js"
}
```

## Step 3: The main file

Everything is optional - export only what you need.

```javascript
module.exports = {
  // npm packages added to the generated bot's package.json
  dependencies: {},

  // Commands use the same action objects as the visual editor (see ACTIONS.md)
  commands: [
    {
      name: "hello",
      description: "Say hello",
      type: "slash", // "slash", "prefix" or "both"
      arguments: [{ name: "friend", type: "user", description: "Who to greet", required: false }],
      actions: [
        { type: "reply", content: "👋 Hello {friend}! Greetings from {user}." }
      ]
    }
  ],

  // Events - one entry per event type
  events: [
    {
      type: "on_member_join",
      actions: [{ type: "send_message", content: "Welcome {user} to **{server}**!" }]
    }
  ],

  // Raw hooks injected into the generated index.js
  hooks: {
    on_init: (client) => console.log("Hello plugin loaded"),
    on_message: async (message, client) => {
      if (message.content === "hi bot") await message.reply("hi human");
    }
  },

  // New blocks for the visual editor
  blocks: [
    {
      type: "hello_shout",
      label: "Shout",
      icon: "📣",
      description: "Replies with the text in capital letters",
      fields: [{ key: "text", label: "Text", type: "text", default: "hello {user.name}" }],
      compile: {
        // Return JavaScript for the generated command/event.
        // h.text(str) turns user text (with {placeholders}) into a JS expression.
        node: (action, h) => `await B.reply(ctx, String(${h.text(action.text)}).toUpperCase());`
      }
    }
  ]
};
```

Inside `compile.node` code you can use:

- `ctx` - the current context (`ctx.user`, `ctx.member`, `ctx.guild`, `ctx.channel`, `ctx.client`, `ctx.interaction`, `ctx.message`)
- `B` - the Botify runtime (`B.reply`, `B.send`, `B.embed`, `B.askButtons`, `B.askModal`, `B.kvGet`, `B.kvSet`, `B.sqlAll`, …, see `engine/runtime/node/botify.js`)
- any variable created by earlier blocks

Field types available for `fields`: `text`, `textarea`, `code`, `number`, `select` (with `options`),
`checkbox`, `variable`, `color`, `embed`, `embedRef`, `params` and `list` (with an `item` schema).

## Step 4: Enable it

1. Put the folder into `plugins/`.
2. Open Botify → **Plugins** → **Reload**.
3. Toggle the plugin on for your project. Its commands are added to the bot and its blocks
   appear in the **Plugin Blocks** section of the editor palette.
4. Click **Run bot**.

If a project already has a command with the same name, the project's command wins.
