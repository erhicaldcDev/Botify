/*
 * Botify runtime helpers (generated file - shared by all commands & events).
 * Keeps generated command code short and handles the tricky Discord parts:
 * replying to the right interaction, buttons, select menus, modals, embeds.
 */
const path = require("path");
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActivityType, MessageFlags, PermissionsBitField,
} = require("discord.js");

const DB_PATH = path.join(__dirname, "data.db");
let _db = null;
function db() {
  if (!_db) {
    const Database = require("better-sqlite3");
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec("CREATE TABLE IF NOT EXISTS botify_kv (key TEXT PRIMARY KEY, value TEXT)");
    _db.exec("CREATE TABLE IF NOT EXISTS data (key TEXT PRIMARY KEY, value TEXT)");
  }
  return _db;
}

const EPHEMERAL = MessageFlags ? MessageFlags.Ephemeral : 64;

class Context {
  constructor(opts) {
    this.client = opts.client;
    this.interaction = opts.interaction || null;
    this.message = opts.message || null;
    this.args = opts.args || {};
    this.user = opts.user || this.interaction?.user || this.message?.author || opts.member?.user || null;
    this.member = opts.member || this.interaction?.member || this.message?.member || null;
    this.guild = opts.guild || this.interaction?.guild || this.message?.guild || this.member?.guild || null;
    this.channel = opts.channel || this.interaction?.channel || this.message?.channel || this.guild?.systemChannel || null;
    this.extra = opts.extra || {};
    this.lastMessage = null;
  }

  /** First user/member argument (or first mention) - used as default moderation target. */
  get defaultTarget() {
    for (const v of Object.values(this.args)) {
      if (v && typeof v === "object" && (v.user || v.username)) return v;
    }
    if (this.message?.mentions?.members?.size) return this.message.mentions.members.first();
    if (this.message?.mentions?.users?.size) return this.message.mentions.users.first();
    return null;
  }
}

function context(opts) {
  return new Context(opts);
}

/** Convert prefix command words into typed arguments. The last text argument takes the rest of the message. */
async function prefixArgs(message, words, specs) {
  const out = {};
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const raw = i === specs.length - 1 && s.type === "string" ? words.slice(i).join(" ") : words[i];
    if (raw === undefined || raw === "") { out[s.name] = null; continue; }
    const id = (String(raw).match(/\d{15,25}/) || [])[0];
    switch (s.type) {
      case "integer": { const n = parseInt(raw, 10); out[s.name] = Number.isNaN(n) ? null : n; break; }
      case "number": { const n = parseFloat(raw); out[s.name] = Number.isNaN(n) ? null : n; break; }
      case "boolean": out[s.name] = /^(true|yes|y|1|on)$/i.test(raw); break;
      case "user":
        out[s.name] = id ? ((await message.guild?.members.fetch(id).catch(() => null)) || (await message.client.users.fetch(id).catch(() => null))) : null;
        break;
      case "channel": out[s.name] = id ? message.client.channels.cache.get(id) || null : null; break;
      case "role": out[s.name] = id ? message.guild?.roles.cache.get(id) || null : null; break;
      case "attachment": out[s.name] = message.attachments.first() || null; break;
      default: out[s.name] = raw;
    }
  }
  return out;
}

// --------------------------------------------------------------- formatting
function _lookup(obj, pathStr) {
  return pathStr.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function _builtin(ctx, token) {
  const u = ctx.user, g = ctx.guild, c = ctx.channel;
  switch (token) {
    case "user": case "user.mention": return u ? `<@${u.id}>` : "";
    case "user.name": case "user.username": return u?.username ?? "";
    case "user.tag": return u?.tag ?? "";
    case "user.displayName": return ctx.member?.displayName ?? u?.globalName ?? u?.username ?? "";
    case "user.id": return u?.id ?? "";
    case "user.avatar": return u?.displayAvatarURL?.() ?? "";
    case "server": case "server.name": case "guild": case "guild.name": return g?.name ?? "";
    case "server.id": case "guild.id": return g?.id ?? "";
    case "server.members": case "guild.members": return g?.memberCount ?? "";
    case "server.icon": return g?.iconURL?.() ?? "";
    case "channel": case "channel.mention": return c ? `<#${c.id}>` : "";
    case "channel.name": return c?.name ?? "";
    case "channel.id": return c?.id ?? "";
    case "bot": case "bot.mention": return ctx.client?.user ? `<@${ctx.client.user.id}>` : "";
    case "bot.name": return ctx.client?.user?.username ?? "";
    case "bot.avatar": return ctx.client?.user?.displayAvatarURL?.() ?? "";
    case "date": return new Date().toLocaleDateString();
    case "time": return new Date().toLocaleTimeString();
    case "timestamp": return `<t:${Math.floor(Date.now() / 1000)}:f>`;
    default: return undefined;
  }
}

function _stringify(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if (typeof v.toString === "function" && v.toString !== Object.prototype.toString) return v.toString();
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

/** Replace {placeholders} with variable values / built-ins. Unknown tokens are left untouched. */
function text(ctx, str, vars = {}) {
  if (str == null) return "";
  str = _stringify(str);
  return str.replace(/\{([a-zA-Z_][\w]*(?:\.[\w]+)*)\}/g, (match, token) => {
    const root = token.split(".")[0];
    if (Object.prototype.hasOwnProperty.call(vars, root) && vars[root] !== undefined) {
      const val = _lookup(vars, token);
      if (val !== undefined) return _stringify(val);
    }
    const b = _builtin(ctx, token);
    return b === undefined ? match : _stringify(b);
  });
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function compare(a, op, b) {
  const na = Number(a), nb = Number(b);
  const numeric = a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb);
  const sa = _stringify(a), sb = _stringify(b);
  switch (op) {
    case "==": return numeric ? na === nb : sa === sb;
    case "!=": return numeric ? na !== nb : sa !== sb;
    case ">": return numeric ? na > nb : sa > sb;
    case "<": return numeric ? na < nb : sa < sb;
    case ">=": return numeric ? na >= nb : sa >= sb;
    case "<=": return numeric ? na <= nb : sa <= sb;
    case "contains": return sa.toLowerCase().includes(sb.toLowerCase());
    case "not_contains": return !sa.toLowerCase().includes(sb.toLowerCase());
    case "starts_with": return sa.toLowerCase().startsWith(sb.toLowerCase());
    case "ends_with": return sa.toLowerCase().endsWith(sb.toLowerCase());
    case "is_empty": return sa.trim() === "";
    case "not_empty": return sa.trim() !== "";
    default: return false;
  }
}

// -------------------------------------------------------------------- embeds
const LIMITS = { title: 256, description: 4096, fieldName: 256, fieldValue: 1024, footer: 2048, author: 256 };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const isUrl = (s) => /^https?:\/\/\S+$/i.test(s || "");

function embed(ctx, data, vars = {}) {
  if (!data) return null;
  const t = (s) => text(ctx, s, vars).trim();
  const e = new EmbedBuilder();
  let hasContent = false;
  if (data.title) { e.setTitle(clip(t(data.title), LIMITS.title)); hasContent = true; }
  if (data.url && isUrl(t(data.url))) e.setURL(t(data.url));
  if (data.description) { const d = t(data.description); if (d) { e.setDescription(clip(d, LIMITS.description)); hasContent = true; } }
  if (data.color) {
    const c = String(data.color).replace("#", "");
    if (/^[0-9a-f]{6}$/i.test(c)) e.setColor(parseInt(c, 16));
  }
  if (data.authorName) {
    e.setAuthor({ name: clip(t(data.authorName), LIMITS.author), iconURL: isUrl(t(data.authorIcon)) ? t(data.authorIcon) : undefined, url: isUrl(t(data.authorUrl)) ? t(data.authorUrl) : undefined });
    hasContent = true;
  }
  if (data.thumbnail && isUrl(t(data.thumbnail))) e.setThumbnail(t(data.thumbnail));
  if (data.image && isUrl(t(data.image))) { e.setImage(t(data.image)); hasContent = true; }
  if (data.footer) {
    e.setFooter({ text: clip(t(data.footer), LIMITS.footer), iconURL: isUrl(t(data.footerIcon)) ? t(data.footerIcon) : undefined });
    hasContent = true;
  }
  if (data.timestamp) e.setTimestamp();
  (data.fields || []).slice(0, 25).forEach((fd) => {
    const name = t(fd.name), value = t(fd.value);
    if (!name && !value) return;
    e.addFields({ name: clip(name || "​", LIMITS.fieldName), value: clip(value || "​", LIMITS.fieldValue), inline: !!fd.inline });
    hasContent = true;
  });
  if (!hasContent) e.setDescription("​");
  return e;
}

// ------------------------------------------------------------------ messages
function _payload(p) {
  if (p == null) return { content: "​" };
  if (typeof p === "string") return { content: p.slice(0, 2000) || "​" };
  const out = { ...p };
  if (typeof out.content === "string") out.content = out.content.slice(0, 2000);
  if (!out.content) delete out.content;
  if (out.embed) { out.embeds = [out.embed]; delete out.embed; }
  if (out.embeds) out.embeds = out.embeds.filter(Boolean);
  if (!out.content && !(out.embeds && out.embeds.length) && !(out.components && out.components.length)) out.content = "​";
  return out;
}

/** Reply to whatever triggered the flow (slash command, button, modal, message) - always safe to call. */
async function reply(ctx, p, opts = {}) {
  const payload = _payload(p);
  const it = ctx.interaction;
  let msg = null;
  if (it && it.isRepliable && it.isRepliable()) {
    if (opts.ephemeral) payload.flags = EPHEMERAL;
    if (it.replied || it.deferred) {
      msg = await it.followUp(payload);
    } else {
      await it.reply(payload);
      msg = await it.fetchReply().catch(() => null);
    }
  } else if (ctx.message) {
    msg = await ctx.message.reply(payload);
  } else if (ctx.channel && ctx.channel.send) {
    msg = await ctx.channel.send(payload);
  } else {
    console.warn("[Botify] Nowhere to send the reply in this context.");
  }
  if (msg) ctx.lastMessage = msg;
  return msg;
}

async function resolveChannel(ctx, value) {
  const v = _stringify(value).trim();
  if (!v) return ctx.channel;
  if (typeof value === "object" && value.send) return value;
  const id = (v.match(/\d{15,25}/) || [])[0];
  if (!id) return ctx.channel;
  return ctx.client.channels.cache.get(id) || (await ctx.client.channels.fetch(id).catch(() => null));
}

async function send(ctx, channelValue, p, opts = {}) {
  if (!_stringify(channelValue).trim()) return reply(ctx, p, opts);
  const ch = await resolveChannel(ctx, channelValue);
  if (!ch || !ch.send) {
    console.warn(`[Botify] Channel not found: ${channelValue}`);
    return null;
  }
  const msg = await ch.send(_payload(p));
  ctx.lastMessage = msg;
  return msg;
}

async function resolveUser(ctx, value) {
  if (value && typeof value === "object") return value.user || value;
  const v = _stringify(value).trim();
  if (!v) return ctx.user;
  const id = (v.match(/\d{15,25}/) || [])[0];
  if (!id) return null;
  return ctx.client.users.fetch(id).catch(() => null);
}

async function resolveMember(ctx, value, fallbackToSelf = false) {
  if (value && typeof value === "object") {
    if (value.roles && value.guild) return value;
    if (value.id && ctx.guild) return ctx.guild.members.fetch(value.id).catch(() => null);
  }
  const v = _stringify(value).trim();
  if (!v) {
    const def = ctx.defaultTarget;
    if (def) return resolveMember(ctx, def);
    return fallbackToSelf ? ctx.member : null;
  }
  const id = (v.match(/\d{15,25}/) || [])[0];
  if (!id || !ctx.guild) return null;
  return ctx.guild.members.fetch(id).catch(() => null);
}

async function dm(ctx, target, p) {
  const user = await resolveUser(ctx, target);
  if (!user) return null;
  return user.send(_payload(p)).catch(() => { console.warn(`[Botify] Could not DM ${user.tag || user.id} (DMs closed?)`); return null; });
}

async function editReply(ctx, p) {
  const payload = _payload(p);
  const it = ctx.interaction;
  if (ctx.lastMessage && ctx.lastMessage.editable) return ctx.lastMessage.edit(payload);
  if (it && (it.replied || it.deferred)) return it.editReply(payload);
  return reply(ctx, p);
}

async function defer(ctx, ephemeral = false) {
  const it = ctx.interaction;
  if (it && it.deferReply && !it.replied && !it.deferred) await it.deferReply(ephemeral ? { flags: EPHEMERAL } : {});
  else if (ctx.message) await ctx.channel?.sendTyping?.().catch(() => {});
}

async function deleteMessage(ctx) {
  if (ctx.message && ctx.message.deletable) return ctx.message.delete().catch(() => {});
  if (ctx.interaction && (ctx.interaction.replied || ctx.interaction.deferred)) return ctx.interaction.deleteReply().catch(() => {});
  if (ctx.lastMessage) return ctx.lastMessage.delete().catch(() => {});
}

async function react(ctx, emoji) {
  const target = ctx.message || ctx.lastMessage || (ctx.interaction && (ctx.interaction.replied || ctx.interaction.deferred) ? await ctx.interaction.fetchReply().catch(() => null) : null);
  if (target) await target.react(emoji).catch((e) => console.warn(`[Botify] Could not react with ${emoji}: ${e.message}`));
}

// ------------------------------------------------------- interactive modules
function _autoAck(interaction) {
  // If nothing responds to a click / modal submit in time, acknowledge it so Discord doesn't show "interaction failed".
  setTimeout(() => {
    if (interaction.replied || interaction.deferred) return;
    if (interaction.isModalSubmit?.() && !interaction.isFromMessage?.()) {
      interaction.reply({ content: "✅ Submitted.", flags: EPHEMERAL }).catch(() => {});
    } else {
      interaction.deferUpdate().catch(() => {});
    }
  }, 2500);
}

function _disableRows(rows) {
  return rows.map((row) => {
    const r = ActionRowBuilder.from(row);
    r.components.forEach((c) => c.setDisabled(true));
    return r;
  });
}

function _style(s) {
  const n = Number(s) || 1;
  return [ButtonStyle.Primary, ButtonStyle.Secondary, ButtonStyle.Success, ButtonStyle.Danger, ButtonStyle.Link].includes(n) ? n : ButtonStyle.Primary;
}

function buttonRows(buttons, vars, ctx) {
  const rows = [];
  (buttons || []).slice(0, 25).forEach((b, i) => {
    if (i % 5 === 0) rows.push(new ActionRowBuilder());
    const btn = new ButtonBuilder().setStyle(_style(b.style));
    const label = text(ctx, b.label || "", vars).slice(0, 80);
    if (label) btn.setLabel(label);
    if (b.emoji) btn.setEmoji(b.emoji);
    if (_style(b.style) === ButtonStyle.Link) btn.setURL(text(ctx, b.url || "https://discord.com", vars));
    else btn.setCustomId(String(b.id || `btn_${i}`).slice(0, 100));
    if (!label && !b.emoji) btn.setLabel("Button");
    rows[rows.length - 1].addComponents(btn);
  });
  return rows;
}

async function _awaitComponent(ctx, msg, timeoutSec, onlyAuthor) {
  if (!msg) return null;
  try {
    return await msg.awaitMessageComponent({
      filter: (i) => !onlyAuthor || i.user.id === ctx.user?.id,
      time: Math.max(1, Number(timeoutSec) || 60) * 1000,
    });
  } catch {
    return null;
  }
}

/** Send buttons and wait for a click. Returns the clicked button id or "timeout". */
async function askButtons(ctx, opts, vars = {}) {
  const rows = buttonRows(opts.buttons, vars, ctx);
  const msg = await reply(ctx, { content: opts.content, embeds: opts.embed ? [opts.embed] : undefined, components: rows }, opts);
  const hasClickable = (opts.buttons || []).some((b) => _style(b.style) !== ButtonStyle.Link);
  if (!hasClickable) return "sent";
  const clicked = await _awaitComponent(ctx, msg, opts.timeout, opts.onlyAuthor !== false);
  msg?.edit({ components: _disableRows(rows) }).catch(() => {});
  if (!clicked) return "timeout";
  ctx.interaction = clicked;
  _autoAck(clicked);
  return clicked.customId;
}

/** Send a select menu and wait for a choice. Returns the value (or array when max > 1), or "timeout". */
async function askSelect(ctx, opts, vars = {}) {
  const options = (opts.options || []).slice(0, 25).map((o, i) => {
    const opt = { label: text(ctx, o.label || `Option ${i + 1}`, vars).slice(0, 100), value: String(o.value || `option_${i}`).slice(0, 100) };
    if (o.description) opt.description = text(ctx, o.description, vars).slice(0, 100);
    if (o.emoji) opt.emoji = o.emoji;
    return opt;
  });
  const max = Math.min(Math.max(1, Number(opts.maxValues) || 1), options.length || 1);
  const min = Math.min(Math.max(0, Number(opts.minValues) || 1), max);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`botify_select_${Date.now()}`)
    .setPlaceholder(text(ctx, opts.placeholder || "Make a selection...", vars).slice(0, 150))
    .setMinValues(min).setMaxValues(max)
    .addOptions(options);
  const rows = [new ActionRowBuilder().addComponents(menu)];
  const msg = await reply(ctx, { content: opts.content, components: rows }, opts);
  const picked = await _awaitComponent(ctx, msg, opts.timeout, true);
  msg?.edit({ components: _disableRows(rows) }).catch(() => {});
  if (!picked) return "timeout";
  ctx.interaction = picked;
  _autoAck(picked);
  return max > 1 ? picked.values : picked.values[0];
}

/** Show a modal form and wait for it. Returns { inputId: value } or null on timeout. */
async function askModal(ctx, opts, vars = {}) {
  let it = ctx.interaction;
  if (!it || !it.showModal || it.replied || it.deferred || it.isModalSubmit?.()) {
    // Modals can only be opened in response to a fresh interaction - show a button first.
    const clicked = await askButtons(ctx, {
      content: `📝 ${text(ctx, opts.title || "Form", vars)} - click the button to open the form.`,
      buttons: [{ id: "botify_open_modal", label: "Open form", style: "1", emoji: "📝" }],
      timeout: opts.timeout || 300,
      onlyAuthor: true,
    }, vars);
    if (clicked === "timeout") return null;
    it = ctx.interaction;
  }
  const id = `botify_modal_${Date.now()}`;
  const modal = new ModalBuilder().setCustomId(id).setTitle(text(ctx, opts.title || "Form", vars).slice(0, 45) || "Form");
  const inputs = (opts.inputs || []).slice(0, 5);
  inputs.forEach((inp, i) => {
    const ti = new TextInputBuilder()
      .setCustomId(String(inp.id || `input_${i}`).slice(0, 100))
      .setLabel(text(ctx, inp.label || `Input ${i + 1}`, vars).slice(0, 45) || `Input ${i + 1}`)
      .setStyle(inp.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(inp.required !== false);
    if (inp.placeholder) ti.setPlaceholder(text(ctx, inp.placeholder, vars).slice(0, 100));
    if (inp.value) ti.setValue(text(ctx, inp.value, vars).slice(0, 4000));
    if (Number(inp.minLength) > 0) ti.setMinLength(Math.min(4000, Number(inp.minLength)));
    if (Number(inp.maxLength) > 0) ti.setMaxLength(Math.min(4000, Number(inp.maxLength)));
    modal.addComponents(new ActionRowBuilder().addComponents(ti));
  });
  await it.showModal(modal);
  let submitted;
  try {
    submitted = await it.awaitModalSubmit({
      filter: (i) => i.customId === id && i.user.id === it.user.id,
      time: Math.max(10, Number(opts.timeout) || 300) * 1000,
    });
  } catch {
    return null;
  }
  ctx.interaction = submitted;
  _autoAck(submitted);
  const values = {};
  inputs.forEach((inp, i) => {
    const cid = String(inp.id || `input_${i}`).slice(0, 100);
    values[cid] = submitted.fields.getTextInputValue(cid);
  });
  return values;
}

// ---------------------------------------------------------------- moderation
async function kick(ctx, target, reason) {
  const m = await resolveMember(ctx, target);
  if (!m) return reply(ctx, "⚠️ Could not find that member.", { ephemeral: true });
  if (!m.kickable) return reply(ctx, "⚠️ I can't kick that member (missing permission or higher role).", { ephemeral: true });
  await m.kick(reason || undefined);
  return m;
}

async function ban(ctx, target, reason, deleteDays = 0) {
  const m = await resolveMember(ctx, target);
  if (!m) return reply(ctx, "⚠️ Could not find that member.", { ephemeral: true });
  if (!m.bannable) return reply(ctx, "⚠️ I can't ban that member (missing permission or higher role).", { ephemeral: true });
  const seconds = Math.min(7, Math.max(0, Number(deleteDays) || 0)) * 86400;
  await m.ban({ reason: reason || undefined, deleteMessageSeconds: seconds });
  return m;
}

async function timeout(ctx, target, minutes, reason) {
  const m = await resolveMember(ctx, target);
  if (!m) return reply(ctx, "⚠️ Could not find that member.", { ephemeral: true });
  if (!m.moderatable) return reply(ctx, "⚠️ I can't timeout that member.", { ephemeral: true });
  await m.timeout(Math.max(1, toNumber(minutes)) * 60 * 1000, reason || undefined);
  return m;
}

async function role(ctx, target, roleId, add = true) {
  const m = await resolveMember(ctx, target, true);
  const id = (_stringify(roleId).match(/\d{15,25}/) || [])[0];
  if (!m || !id) { console.warn(`[Botify] Role action skipped: member or role ID "${roleId}" not found.`); return null; }
  try {
    return add ? await m.roles.add(id) : await m.roles.remove(id);
  } catch (e) {
    console.warn(`[Botify] Could not ${add ? "add" : "remove"} role ${id}: ${e.message}`);
    return null;
  }
}

async function nickname(ctx, target, nick) {
  const m = await resolveMember(ctx, target, true);
  if (!m) return null;
  return m.setNickname(nick || null).catch((e) => console.warn(`[Botify] Could not change nickname: ${e.message}`));
}

async function purge(ctx, amount) {
  const n = Math.min(100, Math.max(1, Math.floor(toNumber(amount))));
  if (!ctx.channel || !ctx.channel.bulkDelete) return 0;
  const deleted = await ctx.channel.bulkDelete(n, true).catch((e) => { console.warn(`[Botify] Purge failed: ${e.message}`); return null; });
  return deleted ? deleted.size : 0;
}

async function hasPermission(ctx, perm) {
  const m = ctx.member;
  if (!m || !m.permissions) return false;
  const flag = PermissionsBitField.Flags[perm];
  return flag ? m.permissions.has(flag) : false;
}

async function hasRole(ctx, target, roleId) {
  const m = await resolveMember(ctx, target, true);
  const id = (_stringify(roleId).match(/\d{15,25}/) || [])[0];
  return !!(m && id && m.roles.cache.has(id));
}

// --------------------------------------------------------------------- misc
const _cooldowns = new Map();
/** Returns 0 if allowed, otherwise the remaining seconds. */
function cooldown(key, seconds) {
  const now = Date.now();
  const until = _cooldowns.get(key) || 0;
  if (now < until) return Math.ceil((until - now) / 1000);
  _cooldowns.set(key, now + toNumber(seconds) * 1000);
  return 0;
}

async function userInfo(ctx, target) {
  const u = await resolveUser(ctx, target);
  if (!u) return null;
  const m = ctx.guild ? await ctx.guild.members.fetch(u.id).catch(() => null) : null;
  return {
    id: u.id, name: u.username, username: u.username, tag: u.tag, displayName: m?.displayName || u.globalName || u.username,
    mention: `<@${u.id}>`, avatar: u.displayAvatarURL(), bot: u.bot,
    created: `<t:${Math.floor(u.createdTimestamp / 1000)}:D>`,
    joined: m?.joinedTimestamp ? `<t:${Math.floor(m.joinedTimestamp / 1000)}:D>` : "",
    roles: m ? m.roles.cache.filter((r) => r.id !== ctx.guild.id).map((r) => `<@&${r.id}>`).join(" ") : "",
    toString() { return `<@${u.id}>`; },
  };
}

async function http(url, method = "GET", headers = "", body = "") {
  let h = {};
  if (headers && String(headers).trim()) {
    try { h = JSON.parse(headers); } catch { console.warn("[Botify] Invalid headers JSON in HTTP request block."); }
  }
  const opts = { method, headers: h };
  if (body && method !== "GET" && method !== "HEAD") {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!Object.keys(h).some((k) => k.toLowerCase() === "content-type")) {
      try { JSON.parse(opts.body); opts.headers["Content-Type"] = "application/json"; } catch { /* plain text */ }
    }
  }
  const res = await fetch(url, opts);
  const raw = await res.text();
  try { return JSON.parse(raw); } catch { return raw; }
}

function _sqlParams(params) {
  return params.map((p) => (p && typeof p === "object" && p.id ? p.id : typeof p === "boolean" ? Number(p) : p === undefined ? null : p));
}

function sqlAll(query, params = []) {
  try {
    return db().prepare(query).all(..._sqlParams(params));
  } catch (e) {
    console.error(`[Botify] SQL error: ${e.message}\n  in: ${query}`);
    return [];
  }
}

function sqlRun(query, params = []) {
  try {
    const stmt = db().prepare(query);
    return stmt.reader ? stmt.all(..._sqlParams(params)) : stmt.run(..._sqlParams(params));
  } catch (e) {
    console.error(`[Botify] SQL error: ${e.message}\n  in: ${query}`);
    return null;
  }
}

function kvGet(key, def = null) {
  const row = db().prepare("SELECT value FROM botify_kv WHERE key = ?").get(String(key));
  if (!row) return def;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function kvSet(key, value) {
  db().prepare("INSERT INTO botify_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(key), JSON.stringify(value));
}

function parseValue(v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (t !== "" && Number.isFinite(Number(t))) return Number(t);
  return v;
}

function randomInt(min, max) {
  let a = Math.ceil(toNumber(min)), b = Math.floor(toNumber(max));
  if (a > b) [a, b] = [b, a];
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function pick(list) {
  const arr = (Array.isArray(list) ? list : String(list).split("\n")).map((s) => String(s).trim()).filter(Boolean);
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : "";
}

const ACTIVITY = { Playing: ActivityType.Playing, Streaming: ActivityType.Streaming, Listening: ActivityType.Listening, Watching: ActivityType.Watching, Competing: ActivityType.Competing };
function setStatus(client, textValue, type = "Playing", status = "online") {
  const key = Object.keys(ACTIVITY).find((k) => k.toLowerCase() === String(type).toLowerCase()) || "Playing";
  client.user.setPresence({ activities: [{ name: String(textValue).slice(0, 128), type: ACTIVITY[key] }], status });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, toNumber(ms))));
}

/** Interactive help menu (Help System page). */
async function helpMenu(ctx, settings, commands) {
  const cats = (settings.categories || []).filter((c) => c.name);
  const color = settings.color || "#5865f2";
  const fieldFor = (c) => ({ name: `${c.icon || ""} ${c.name}`.trim(), value: (c.commands || []).map((n) => `\`${n}\` - ${commands[n] || ""}`.trim()).join("\n") || "No commands", inline: false });
  const home = embed(ctx, {
    title: settings.title || "Help", description: settings.description || "", color,
    fields: settings.style === "simple" ? cats.map(fieldFor) : cats.map((c) => ({ name: `${c.icon || ""} ${c.name}`.trim(), value: `${(c.commands || []).length} commands`, inline: true })),
    footer: settings.footer || "", timestamp: true,
  });
  if (settings.style === "simple" || cats.length === 0) return reply(ctx, { embeds: [home] });

  const makeRows = () => {
    if (settings.style === "select") {
      return [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("botify_help").setPlaceholder("Select a category...")
        .addOptions(cats.slice(0, 25).map((c, i) => ({ label: c.name.slice(0, 100), value: String(i), emoji: c.icon || undefined }))))];
    }
    return buttonRows(cats.map((c, i) => ({ id: `botify_help_${i}`, label: c.name, emoji: c.icon, style: "2" })), {}, ctx);
  };
  const msg = await reply(ctx, { embeds: [home], components: makeRows() });
  if (!msg) return;
  const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });
  collector.on("collect", async (i) => {
    const idx = Number(i.isStringSelectMenu() ? i.values[0] : i.customId.replace("botify_help_", ""));
    const c = cats[idx];
    if (!c) return i.deferUpdate().catch(() => {});
    const e = embed(ctx, { title: `${c.icon || ""} ${c.name}`.trim(), description: fieldFor(c).value, color, footer: settings.title || "Help" });
    await i.update({ embeds: [e], components: makeRows() }).catch(() => {});
  });
  collector.on("end", () => msg.edit({ components: _disableRows(makeRows()) }).catch(() => {}));
}

module.exports = {
  context, prefixArgs, text, compare, toNumber, parseValue, embed, reply, send, dm, editReply, defer, deleteMessage, react,
  askButtons, askSelect, askModal, buttonRows, kick, ban, timeout, role, nickname, purge, hasPermission, hasRole,
  cooldown, userInfo, http, sqlAll, sqlRun, kvGet, kvSet, randomInt, pick, setStatus, sleep, helpMenu,
  resolveUser, resolveMember, resolveChannel, db,
};
