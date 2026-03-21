# Engine Actions (Logic)

In Botify, plugins inject JavaScript code inside the main bot application during the build process. When creating an action or event handler, you interact with common methods like `send_message`, `api_request`, and `db_write`.

## Built-In Actions

The Botify generator expects a specific JSON structure when interpreting what code block to output. The `type` determines the action to execute.

### 1. `send_message`
Sends a message to an event channel or target user/channel.
- **channel_id** (optional): ID to send explicitly to a channel.
- **content**: The text to send back.

Example generated output:
```javascript
channel.send({ content: "Hello World" });
```

### 2. `api_request`
Allows your plugin block to talk to an external web service.
- **url**: The endpoint URL.
- **method**: GET, POST, DELETE, etc.
- **variables**: To map the response body directly to process variables.

### 3. `db_write` / `db_read`
Reads or writes to the local SQLite database used by User projects.
- **key**: The storage key to write/read.
- **value**: In `db_write`, the data string to store.

If writing custom plugins, you will format `require(...)` injections within the `generator.js` execution environment. Make sure your plugin logic relies strictly on Node.js/Electron APIs exposed by the framework.
