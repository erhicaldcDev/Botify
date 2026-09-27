# Blocks & Actions reference

Every block in the visual editor compiles to an **action** object: `{ "type": "...", ...fields }`.
Commands and events store their logic as a list of actions; branch blocks keep their child
chains in `then` / `else` (or `body` for loops). Plugins can use exactly the same objects
in their `commands` and `events` arrays.

> This file is generated from `src/shared/blocks.js` - the single source of truth used by the editor and the code generator.

## Text, placeholders and variables

Any text field supports:

- **Placeholders** resolved when the bot runs: `{user}`, `{user.name}`, `{user.id}`, `{user.avatar}`, `{server}`, `{server.members}`, `{server.icon}`, `{channel}`, `{channel.name}`, `{bot.name}`, `{date}`, `{time}`, `{myVar}`.
- **Variables** - command arguments and any value saved by a block (`saveTo`), e.g. `{clicked}`, `{form.email}`, `{info.avatar}`, `{apiData.title}`.
- **Code expressions** `${...}` in the target language (advanced), e.g. `${client.ws.ping}`.

## 💬 Messages

### ↩️ Reply - `reply`

Reply to the command / message that triggered this flow.

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | textarea | `Hello {user}!` | Message content - Supports {user}, {server}, {variable} placeholders and **markdown** |
| `embedRef` | embedRef |  | Attach saved embed (optional) |
| `ephemeral` | checkbox | `false` | Only visible to the user (ephemeral, slash commands only) |

### 💬 Send Message - `send_message`

Send a message to the current channel or a specific channel.

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | textarea | `Hello!` | Message content - Supports {user}, {server}, {variable} placeholders and **markdown** |
| `channelId` | text |  | Channel (optional) - Channel ID or {variable} - empty = current channel |
| `embedRef` | embedRef |  | Attach saved embed (optional) |
| `ephemeral` | checkbox | `false` | Only visible to the user (ephemeral, slash commands only) |
| `saveTo` | variable |  | Save sent message to variable (optional) |

### 📋 Send Embed - `create_embed`

Design a rich embed and send it.

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `embed` | embed | `…` | Embed |
| `content` | text |  | Text above embed (optional) |
| `channelId` | text |  | Channel (optional) - Channel ID or {variable} - empty = current channel |
| `ephemeral` | checkbox | `false` | Only visible to the user (ephemeral, slash commands only) |

### 🗂️ Send Saved Embed - `send_saved_embed`

Send one of the embeds designed in the Embed Styler.

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `embedRef` | embedRef |  | Saved embed |
| `content` | text |  | Text above embed (optional) |
| `channelId` | text |  | Channel (optional) - Channel ID or {variable} - empty = current channel |
| `ephemeral` | checkbox | `false` | Only visible to the user (ephemeral, slash commands only) |

### 👻 Hidden Reply - `ephemeral_message`

Reply with a message only the user can see (slash commands).

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | textarea | `Only you can see this.` | Message content - Supports {user}, {server}, {variable} placeholders and **markdown** |

### 📩 Send DM - `send_dm`

Send a direct message to a user.

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `target` | text |  | Recipient (empty = command user) - Empty = first user argument / mention, else user ID or {variable} |
| `content` | textarea | `Hello in DMs!` | Message content - Supports {user}, {server}, {variable} placeholders and **markdown** |
| `embedRef` | embedRef |  | Attach saved embed (optional) |

### ✏️ Edit Last Reply - `edit_reply`

Edit the last message the bot sent in this flow.

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | textarea | `Updated!` | Message content - Supports {user}, {server}, {variable} placeholders and **markdown** |
| `embedRef` | embedRef |  | Attach saved embed (optional) |

### 🗑️ Delete Message - `delete_message`

Delete the triggering message (prefix) or the bot reply (slash).

Engines: JS · PY · Lua

### 😀 Add Reaction - `add_reaction`

React to the triggering message or the last bot reply.

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `emoji` | text | `✅` | Emoji (unicode or custom <:name:id>) |

## 🧩 Interactive (Buttons, Menus, Modals)

### 🔘 Buttons - `send_buttons`

Send a message with buttons and wait for a click. The clicked button ID is saved to a variable ('timeout' if nobody clicks).

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | textarea | `Choose an option:` | Message content - Supports {user}, {server}, {variable} placeholders and **markdown** |
| `embedRef` | embedRef |  | Attach saved embed (optional) |
| `buttons` | list | `…` | Buttons |
| `timeout` | number | `60` | Wait time (seconds) |
| `onlyAuthor` | checkbox | `true` | Only the command user can click |
| `saveTo` | variable | `clicked` | Save clicked button ID to |

### 🔽 Select Menu - `send_select_menu`

Send a dropdown menu and wait for a choice. The chosen value is saved to a variable.

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | textarea | `Pick an option:` | Message content - Supports {user}, {server}, {variable} placeholders and **markdown** |
| `placeholder` | text | `Make a selection...` | Placeholder |
| `options` | list | `…` | Options |
| `minValues` | number | `1` | Min choices |
| `maxValues` | number | `1` | Max choices |
| `timeout` | number | `60` | Wait time (seconds) |
| `saveTo` | variable | `selected` | Save selected value to |

### 📝 Modal Form - `show_modal`

Open a pop-up form (modal) with up to 5 text inputs. Values are saved as {form.input_id}. In prefix commands a button is shown first.

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `title` | text | `Feedback form` | Modal title |
| `inputs` | list | `…` | Text inputs (max 5) |
| `timeout` | number | `300` | Wait time (seconds) |
| `saveTo` | variable | `form` | Save answers to |

### ⏳ Defer (Thinking...) - `defer_reply`

Show 'Bot is thinking...' - use before slow actions (API requests) so the interaction does not time out.

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `ephemeral` | checkbox | `false` | Only visible to the user (ephemeral, slash commands only) |

## 🛡️ Moderation

### 👢 Kick Member - `kick_member`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `target` | text |  | Target member - Empty = first user argument / mention, else user ID or {variable} |
| `reason` | text | `Kicked by bot` | Reason |

### 🔨 Ban Member - `ban_member`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `target` | text |  | Target member - Empty = first user argument / mention, else user ID or {variable} |
| `reason` | text | `Banned by bot` | Reason |
| `deleteDays` | number | `0` | Delete message history (days, 0-7) |

### 🔇 Timeout Member - `timeout_member`

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `target` | text |  | Target member - Empty = first user argument / mention, else user ID or {variable} |
| `minutes` | number | `10` | Duration (minutes) |
| `reason` | text | `Timed out by bot` | Reason |

### 🛡️ Add Role - `add_role`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `roleId` | text |  | Role ID - Role ID or {variable} |
| `target` | text |  | Member (empty = command user) - Empty = first user argument / mention, else user ID or {variable} |

### 🚫 Remove Role - `remove_role`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `roleId` | text |  | Role ID - Role ID or {variable} |
| `target` | text |  | Member (empty = command user) - Empty = first user argument / mention, else user ID or {variable} |

### 🏷️ Set Nickname - `set_nickname`

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `target` | text |  | Member (empty = command user) - Empty = first user argument / mention, else user ID or {variable} |
| `nickname` | text |  | New nickname (empty = reset) |

### 🧹 Purge Messages - `purge_messages`

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `amount` | text | `10` | Amount (1-100) - Number or {variable} |

### 🔒 Check Permission - `check_permission`

Branch on whether the user has a permission. If the Denied branch is empty, a message is sent and the flow stops.

Engines: JS · PY · Lua • Branches: `then` (Allowed), `else` (Denied)

| Field | Type | Default | Description |
|---|---|---|---|
| `permission` | select | `Administrator` | Permission |
| `denyMessage` | text | `You don't have permission to do that.` | Message when denied (if Denied branch is empty) |

### 👤 Has Role? - `has_role`

Branch on whether a member has a role. If the No branch is empty, a message is sent and the flow stops.

Engines: JS · PY · Lua • Branches: `then` (Yes), `else` (No)

| Field | Type | Default | Description |
|---|---|---|---|
| `roleId` | text |  | Role ID |
| `target` | text |  | Member (empty = command user) - Empty = first user argument / mention, else user ID or {variable} |
| `denyMessage` | text | `You are missing the required role.` | Message when missing (if No branch is empty) |

## 🔀 Logic & Flow

### ❓ If / Else - `if_condition`

Compare two values. Use the advanced expression for custom code conditions.

Engines: JS · PY · Lua • Branches: `then` (True), `else` (False)

| Field | Type | Default | Description |
|---|---|---|---|
| `left` | text |  | Value - e.g. {clicked} or {user.name} |
| `operator` | select | `==` | Operator |
| `right` | text |  | Compare to - e.g. yes |
| `condition` | code |  | Advanced: raw code expression (overrides above) - e.g. member.user.bot |

### 🎲 Random Chance - `random_chance`

Engines: JS · PY · Lua • Branches: `then` (Hit), `else` (Miss)

| Field | Type | Default | Description |
|---|---|---|---|
| `chance` | number | `50` | Chance (%) |

### 🔁 Repeat - `loop`

Run the Loop branch several times. The current iteration number is stored in the variable.

Engines: JS · PY · Lua • Branches: `body` (Loop)

| Field | Type | Default | Description |
|---|---|---|---|
| `times` | text | `3` | Times - Number or {variable} |
| `variable` | variable | `i` | Counter variable |

### ⏱️ User Cooldown - `cooldown`

Stop the flow if the user used it less than N seconds ago.

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `time` | number | `5` | Cooldown (seconds) |
| `message` | text | `Slow down! Try again in {remaining}s.` | Message while on cooldown |

### ⏲️ Wait - `wait`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `time` | number | `1000` | Delay (milliseconds) |

### ⛔ Stop - `stop`

Stop running this flow.

Engines: JS · PY · Lua

## 📦 Variables & Data

### 📦 Set Variable - `set_variable`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | variable | `myVar` | Variable name |
| `mode` | select | `text` | Value type |
| `value` | text |  | Value |

### ➕ Change Number - `math`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | variable | `count` | Variable |
| `op` | select | `+` | Operation |
| `amount` | text | `1` | Amount |

### 🔢 Random Number - `random_number`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `min` | number | `1` | Min |
| `max` | number | `100` | Max |
| `saveTo` | variable | `number` | Save result to variable |

### 🎰 Random Choice - `random_choice`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `choices` | textarea | `Heads\nTails` | Choices (one per line) |
| `saveTo` | variable | `choice` | Save result to variable |

### 🆔 Get User Info - `get_user_info`

Stores {info.name}, {info.id}, {info.mention}, {info.avatar}, {info.created}, {info.joined}.

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `target` | text |  | User (empty = command user) - Empty = first user argument / mention, else user ID or {variable} |
| `saveTo` | variable | `info` | Save result to variable |

### 🌐 HTTP Request - `api_request`

Call a web API. JSON responses are parsed ({apiData.field}).

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `url` | text | `https://api.example.com` | URL |
| `method` | select | `GET` | Method |
| `headers` | code |  | Headers (JSON, optional) |
| `body` | code |  | Body (optional) |
| `saveTo` | variable | `apiData` | Save result to variable |

### 💾 Save Data - `kv_set`

Save a value permanently (built-in key/value storage).

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `key` | text | `points_{user.id}` | Key |
| `value` | text | `{points}` | Value |

### 📂 Load Data - `kv_get`

Load a value saved with Save Data.

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `key` | text | `points_{user.id}` | Key |
| `default` | text | `0` | Default if missing |
| `saveTo` | variable | `points` | Save result to variable |

### 📖 SQL Read - `db_read`

Run a SELECT query. Rows are stored in the variable (list).

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `query` | code | `SELECT * FROM data` | SQL query |
| `params` | params | `…` | Parameters (code expressions, one per ?) |
| `saveTo` | variable | `rows` | Save result to variable |

### ✏️ SQL Write - `db_write`

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `query` | code | `INSERT INTO data (key, value) VALUES (?, ?)` | SQL query |
| `params` | params | `…` | Parameters (code expressions, one per ?) |

### @ Mention User - `mention_user` *(legacy)*

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `userId` | text | `{user.id}` | User ID |
| `saveTo` | variable | `mention` | Save to variable |

### 🏷️ Mention Role - `mention_role` *(legacy)*

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `roleId` | text |  | Role ID |
| `saveTo` | variable | `mention` | Save to variable |

### # Mention Channel - `mention_channel` *(legacy)*

Engines: JS · PY

| Field | Type | Default | Description |
|---|---|---|---|
| `channelId` | text | `{channel.id}` | Channel ID |
| `saveTo` | variable | `mention` | Save to variable |

## ⚙️ Bot & Advanced

### 🎭 Set Bot Status - `set_status`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `text` | text | `with Botify` | Activity text |
| `statusType` | select | `Playing` | Activity type |
| `status` | select | `online` | Status |

### 🖨️ Console Log - `log`

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `message` | text | `Command used by {user.name}` | Message |

### 🧑‍💻 Custom Code - `raw_code`

Insert raw code for the selected engine (JavaScript / Python / Lua).

Engines: JS · PY · Lua

| Field | Type | Default | Description |
|---|---|---|---|
| `code` | code | `// your code here` | Code |

## Legacy actions

- `send_await_interaction` (old button block) is still accepted and compiled as `send_buttons` (`components` → `buttons`, `time` in ms → `timeout` in seconds).
- `set_variable` without `mode` is treated as a code expression (old behaviour).
