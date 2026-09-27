# Plugin manifest.json

The `manifest.json` file is the heart of your plugin. It tells Botify everything it needs to know, such as its name, version, author, and essentially, what features or blocks it provides.

An empty or missing `manifest.json` will cause your plugin to be ignored by the engine.

## Basic Structure

```json
{
  "id": "my-plugin-id",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "author": "YourName",
  "description": "Does something totally awesome on the server.",
  "main": "index.js",
  "type": "js"
}
```

## Explanation of Fields

- **`id`** *(string)*: Unique identifier for your plugin. Usually lowercase, kebab-case (e.g., `cool-welcome-bot`).
- **`name`** *(string)*: The display name shown in the "Plugins" menu in Botify.
- **`version`** *(string)*: Semantic versioning string (e.g., `1.0.0`).
- **`author`** *(string)*: Your name or handle.
- **`description`** *(string)*: A short summary of what the plugin does. It appears in the plugin list.
- **`main`** *(string, optional)*: Entry file, defaults to `index.js`.
- **`type`** *(string)*: Plugin language. Currently only `js` plugins are supported and they are applied to Node.js (discord.js) projects.
- **`enabled`** *(boolean, optional)*: Set to `false` to hide the plugin from every project.

Plugins are switched on **per project** on the Plugins page (stored in the project's `plugins` list).

## Example File

```json
{
  "id": "ai-chat",
  "name": "AI Chat Bot",
  "version": "0.9.5",
  "author": "Botify Dev",
  "description": "Integrates GPT models for natural, conversational Discord replies.",
  "type": "js"
}
```

Once parsing succeeds, the plugin appears on the **Plugins** page with a list of the commands, events, hooks and blocks it provides.
