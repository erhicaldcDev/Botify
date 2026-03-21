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
  "type": "js" // Or "py" / "lua" depending on the project language
}
```

## Explanation of Fields

- **`id`** *(string)*: Unique identifier for your plugin. Usually lowercase, kebab-case (e.g., `cool-welcome-bot`).
- **`name`** *(string)*: The display name shown in the "Plugins" menu in Botify.
- **`version`** *(string)*: Semantic versioning string (e.g., `1.0.0`).
- **`author`** *(string)*: Your name or handle.
- **`description`** *(string)*: A short summary of what the plugin does. It appears in the plugin list.
- **`type`** *(string)*: Defines what language or environment the plugin supports (`js`, `py`, `lua`). This must match the engine being used by the user's project to successfully load the code natively.

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

Once parsing succeeds, the UI will present the file neatly with a switchbox in the **Plugins** dashboard!
