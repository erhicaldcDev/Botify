-- Botify runtime helpers for Discordia (generated file)
local discordia = require("discordia")
local timer = require("timer")

local B = {}

-- Load .env (KEY=value) into a table; environment variables win.
function B.loadEnv(path)
  local env = {}
  local f = io.open(path or ".env", "r")
  if f then
    for line in f:lines() do
      local k, v = line:match("^%s*([%w_]+)%s*=%s*(.-)%s*$")
      if k then env[k] = v end
    end
    f:close()
  end
  return setmetatable({}, { __index = function(_, k) return os.getenv(k) or env[k] end })
end

function B.context(opts)
  local ctx = {
    client = opts.client, message = opts.message, args = opts.args or {},
    user = opts.user, member = opts.member, guild = opts.guild, channel = opts.channel,
  }
  if ctx.message then
    ctx.user = ctx.user or ctx.message.author
    ctx.member = ctx.member or ctx.message.member
    ctx.guild = ctx.guild or ctx.message.guild
    ctx.channel = ctx.channel or ctx.message.channel
  end
  if ctx.member then
    ctx.user = ctx.user or ctx.member.user
    ctx.guild = ctx.guild or ctx.member.guild
  end
  if not ctx.channel and ctx.guild and ctx.guild.systemChannel then
    ctx.channel = ctx.guild.systemChannel
  end
  return ctx
end

function B.s(v)
  if v == nil then return "" end
  if type(v) == "table" then
    if v.mentionString then return v.mentionString end
    if v.id then return tostring(v.id) end
    return "[table]"
  end
  return tostring(v)
end

local function builtin(ctx, token)
  local u, g, c = ctx.user, ctx.guild, ctx.channel
  local map = {
    ["user"] = function() return u and u.mentionString end,
    ["user.mention"] = function() return u and u.mentionString end,
    ["user.name"] = function() return u and u.username end,
    ["user.tag"] = function() return u and u.tag end,
    ["user.id"] = function() return u and u.id end,
    ["user.avatar"] = function() return u and u.avatarURL end,
    ["server"] = function() return g and g.name end,
    ["server.name"] = function() return g and g.name end,
    ["server.id"] = function() return g and g.id end,
    ["server.members"] = function() return g and tostring(g.totalMemberCount) end,
    ["server.icon"] = function() return g and g.iconURL end,
    ["channel"] = function() return c and c.mentionString end,
    ["channel.name"] = function() return c and c.name end,
    ["channel.id"] = function() return c and c.id end,
    ["bot"] = function() return ctx.client.user.mentionString end,
    ["bot.name"] = function() return ctx.client.user.username end,
    ["date"] = function() return os.date("%x") end,
    ["time"] = function() return os.date("%X") end,
  }
  local fn = map[token]
  if fn then return fn() end
  return nil
end

function B.text(ctx, str, vars)
  if str == nil then return "" end
  str = B.s(str)
  vars = vars or {}
  return (str:gsub("{([%a_][%w_%.]*)}", function(token)
    local root = token:match("^[^%.]+")
    if vars[root] ~= nil then
      local val = vars
      for part in token:gmatch("[^%.]+") do
        if type(val) ~= "table" then val = nil break end
        val = val[part]
      end
      if val ~= nil then return B.s(val) end
    end
    local b = builtin(ctx, token)
    if b ~= nil then return B.s(b) end
    return "{" .. token .. "}"
  end))
end

function B.toNumber(v)
  return tonumber(v) or 0
end

function B.compare(a, op, b)
  local sa, sb = B.s(a), B.s(b)
  local na, nb = tonumber(sa), tonumber(sb)
  local numeric = na ~= nil and nb ~= nil
  if op == "==" then if numeric then return na == nb end return sa == sb end
  if op == "!=" then if numeric then return na ~= nb end return sa ~= sb end
  if op == ">" then if numeric then return na > nb end return sa > sb end
  if op == "<" then if numeric then return na < nb end return sa < sb end
  if op == ">=" then if numeric then return na >= nb end return sa >= sb end
  if op == "<=" then if numeric then return na <= nb end return sa <= sb end
  local la, lb = sa:lower(), sb:lower()
  if op == "contains" then return la:find(lb, 1, true) ~= nil end
  if op == "not_contains" then return la:find(lb, 1, true) == nil end
  if op == "starts_with" then return la:sub(1, #lb) == lb end
  if op == "ends_with" then return lb == "" or la:sub(-#lb) == lb end
  if op == "is_empty" then return sa:match("^%s*$") ~= nil end
  if op == "not_empty" then return sa:match("^%s*$") == nil end
  return false
end

local function isUrl(s) return type(s) == "string" and s:match("^https?://%S+$") ~= nil end

function B.embed(ctx, data, vars)
  local t = function(s) return B.text(ctx, s, vars) end
  local e = {}
  if data.title and data.title ~= "" then e.title = t(data.title):sub(1, 256) end
  if data.url and isUrl(t(data.url)) then e.url = t(data.url) end
  if data.description and data.description ~= "" then e.description = t(data.description):sub(1, 4096) end
  if data.color then
    local hex = tostring(data.color):gsub("#", "")
    e.color = tonumber(hex, 16)
  end
  if data.authorName and data.authorName ~= "" then
    e.author = { name = t(data.authorName), icon_url = isUrl(t(data.authorIcon or "")) and t(data.authorIcon) or nil, url = isUrl(t(data.authorUrl or "")) and t(data.authorUrl) or nil }
  end
  if data.thumbnail and isUrl(t(data.thumbnail)) then e.thumbnail = { url = t(data.thumbnail) } end
  if data.image and isUrl(t(data.image)) then e.image = { url = t(data.image) } end
  if data.footer and data.footer ~= "" then
    e.footer = { text = t(data.footer), icon_url = isUrl(t(data.footerIcon or "")) and t(data.footerIcon) or nil }
  end
  if data.timestamp then e.timestamp = discordia.Date():toISO("T", "Z") end
  if data.fields and #data.fields > 0 then
    e.fields = {}
    for _, f in ipairs(data.fields) do
      table.insert(e.fields, { name = t(f.name or "\226\128\139"), value = t(f.value or "\226\128\139"), inline = f.inline and true or false })
    end
  end
  if not e.title and not e.description and not e.fields and not e.image then e.description = "\226\128\139" end
  return e
end

local function payload(content, embed)
  local p = {}
  if content and content ~= "" then p.content = content:sub(1, 2000) end
  if embed then p.embed = embed end
  if not p.content and not p.embed then p.content = "\226\128\139" end
  return p
end

function B.reply(ctx, content, embed)
  local msg
  if ctx.message then
    msg = ctx.message:reply(payload(content, embed))
  elseif ctx.channel then
    msg = ctx.channel:send(payload(content, embed))
  else
    print("[Botify] Nowhere to send the reply in this context.")
  end
  ctx.lastMessage = msg or ctx.lastMessage
  return msg
end

local function snowflake(v)
  return B.s(v):match("%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d+")
end

function B.send(ctx, channelValue, content, embed)
  if B.s(channelValue):match("^%s*$") then return B.reply(ctx, content, embed) end
  local ch = ctx.client:getChannel(snowflake(channelValue) or "")
  if not ch then
    print("[Botify] Channel not found: " .. B.s(channelValue))
    return nil
  end
  local msg = ch:send(payload(content, embed))
  ctx.lastMessage = msg or ctx.lastMessage
  return msg
end

function B.resolveMember(ctx, value, fallbackSelf)
  local id = snowflake(value)
  if not id and ctx.message and ctx.message.mentionedUsers then
    local first = ctx.message.mentionedUsers:iter()()
    if first then id = first.id end
  end
  if not id then
    for _, v in pairs(ctx.args) do
      local sid = snowflake(v)
      if sid then id = sid break end
    end
  end
  if not id then return fallbackSelf and ctx.member or nil end
  return ctx.guild and ctx.guild:getMember(id) or nil
end

function B.dm(ctx, target, content, embed)
  local id = snowflake(target)
  local user = id and ctx.client:getUser(id) or ctx.user
  if not user then return nil end
  local ok, res = pcall(function() return user:send(payload(content, embed)) end)
  if not ok or not res then print("[Botify] Could not DM " .. B.s(user.tag)) end
  return res
end

function B.deleteMessage(ctx)
  if ctx.message then ctx.message:delete() elseif ctx.lastMessage then ctx.lastMessage:delete() end
end

function B.react(ctx, emoji)
  local m = ctx.message or ctx.lastMessage
  if m then m:addReaction(emoji) end
end

function B.kick(ctx, target, reason)
  local m = B.resolveMember(ctx, target)
  if not m then return B.reply(ctx, "⚠️ Could not find that member.") end
  if not m:kick(reason) then B.reply(ctx, "⚠️ I can't kick that member.") end
end

function B.ban(ctx, target, reason, days)
  local m = B.resolveMember(ctx, target)
  if not m then return B.reply(ctx, "⚠️ Could not find that member.") end
  if not m:ban(reason, days or 0) then B.reply(ctx, "⚠️ I can't ban that member.") end
end

function B.role(ctx, target, roleId, add)
  local m = B.resolveMember(ctx, target, true)
  local rid = snowflake(roleId)
  if not m or not rid then
    print("[Botify] Role action skipped: member or role not found.")
    return
  end
  if add then m:addRole(rid) else m:removeRole(rid) end
end

function B.hasPermission(ctx, perm)
  return ctx.member ~= nil and ctx.member:hasPermission(perm)
end

function B.hasRole(ctx, target, roleId)
  local m = B.resolveMember(ctx, target, true)
  local rid = snowflake(roleId)
  return m ~= nil and rid ~= nil and m:hasRole(rid)
end

function B.userInfo(ctx, target)
  local id = snowflake(target)
  local u = id and ctx.client:getUser(id) or ctx.user
  if not u then return nil end
  return { id = u.id, name = u.username, tag = u.tag, mention = u.mentionString, avatar = u.avatarURL }
end

local ACTIVITY = { Playing = 0, Streaming = 1, Listening = 2, Watching = 3, Competing = 5 }
function B.setStatus(client, text, kind, status)
  client:setGame({ name = text, type = ACTIVITY[kind] or 0 })
  client:setStatus(status or "online")
end

function B.randomInt(a, b)
  a, b = math.floor(B.toNumber(a)), math.floor(B.toNumber(b))
  if a > b then a, b = b, a end
  return math.random(a, b)
end

function B.pick(text)
  local items = {}
  for line in B.s(text):gmatch("[^\n]+") do
    if not line:match("^%s*$") then table.insert(items, line) end
  end
  if #items == 0 then return "" end
  return items[math.random(1, #items)]
end

function B.sleep(ms)
  timer.sleep(math.max(0, B.toNumber(ms)))
end

function B.prefixArgs(message, words, specs)
  local out = {}
  for i, s in ipairs(specs) do
    local raw = words[i]
    if i == #specs and s.type == "string" then
      local rest = {}
      for j = i, #words do table.insert(rest, words[j]) end
      raw = #rest > 0 and table.concat(rest, " ") or nil
    end
    if raw ~= nil and (s.type == "integer" or s.type == "number") then raw = tonumber(raw) end
    if raw ~= nil and s.type == "user" and message.guild then raw = message.guild:getMember(snowflake(raw) or "") or raw end
    out[s.name] = raw
  end
  return out
end

math.randomseed(os.time())

return B
