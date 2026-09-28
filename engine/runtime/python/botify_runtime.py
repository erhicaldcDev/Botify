"""Botify runtime helpers (generated file - shared by all commands & events).

Keeps generated code short and handles the tricky Discord parts: replying to the
right interaction, buttons, select menus, modals and embeds.
"""
import asyncio
import datetime
import json
import os
import random
import re
import sqlite3
import time

import aiohttp
import discord

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db")
_db = None


def db():
    global _db
    if _db is None:
        _db = sqlite3.connect(DB_PATH, check_same_thread=False)
        _db.row_factory = sqlite3.Row
        _db.execute("CREATE TABLE IF NOT EXISTS botify_kv (key TEXT PRIMARY KEY, value TEXT)")
        _db.execute("CREATE TABLE IF NOT EXISTS data (key TEXT PRIMARY KEY, value TEXT)")
        _db.commit()
    return _db


class Context:
    def __init__(self, bot, interaction=None, message=None, args=None, member=None, user=None, guild=None, channel=None):
        self.bot = bot
        self.client = bot
        self.interaction = interaction
        self.message = message
        self.args = args or {}
        self.user = user or (interaction.user if interaction else None) or (message.author if message else None) or member
        self.member = member
        if self.member is None:
            candidate = interaction.user if interaction else (message.author if message else None)
            if isinstance(candidate, discord.Member):
                self.member = candidate
        self.guild = guild or (interaction.guild if interaction else None) or (message.guild if message else None) or (member.guild if member else None)
        self.channel = channel or (interaction.channel if interaction else None) or (message.channel if message else None)
        if self.channel is None and self.guild is not None:
            self.channel = self.guild.system_channel
        self.last_message = None

    @property
    def default_target(self):
        for v in self.args.values():
            if isinstance(v, (discord.Member, discord.User)):
                return v
        if self.message is not None and self.message.mentions:
            return self.message.mentions[0]
        return None


# ------------------------------------------------------------------ formatting
def _stringify(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, (discord.Member, discord.User, discord.Role)):
        return v.mention
    if isinstance(v, (discord.TextChannel, discord.VoiceChannel, discord.Thread)):
        return v.mention
    if isinstance(v, (dict, list)):
        try:
            return json.dumps(v, ensure_ascii=False, default=str)
        except Exception:
            return str(v)
    return str(v)


def _lookup(obj, parts):
    for p in parts:
        if obj is None:
            return None
        if isinstance(obj, dict):
            obj = obj.get(p)
        elif isinstance(obj, (list, tuple)) and p.isdigit():
            idx = int(p)
            obj = obj[idx] if idx < len(obj) else None
        else:
            obj = getattr(obj, p, None)
    return obj


def _builtin(ctx, token):
    u, g, c = ctx.user, ctx.guild, ctx.channel
    bot_user = ctx.bot.user if ctx.bot else None
    table = {
        "user": lambda: u.mention if u else "",
        "user.mention": lambda: u.mention if u else "",
        "user.name": lambda: u.name if u else "",
        "user.username": lambda: u.name if u else "",
        "user.tag": lambda: str(u) if u else "",
        "user.displayName": lambda: u.display_name if u else "",
        "user.id": lambda: str(u.id) if u else "",
        "user.avatar": lambda: str(u.display_avatar.url) if u else "",
        "server": lambda: g.name if g else "",
        "server.name": lambda: g.name if g else "",
        "server.id": lambda: str(g.id) if g else "",
        "server.members": lambda: str(g.member_count) if g else "",
        "server.icon": lambda: str(g.icon.url) if g and g.icon else "",
        "channel": lambda: c.mention if c and hasattr(c, "mention") else "",
        "channel.name": lambda: getattr(c, "name", "") if c else "",
        "channel.id": lambda: str(c.id) if c else "",
        "bot": lambda: bot_user.mention if bot_user else "",
        "bot.name": lambda: bot_user.name if bot_user else "",
        "bot.avatar": lambda: str(bot_user.display_avatar.url) if bot_user else "",
        "date": lambda: datetime.date.today().strftime("%x"),
        "time": lambda: datetime.datetime.now().strftime("%X"),
        "timestamp": lambda: f"<t:{int(time.time())}:f>",
    }
    fn = table.get(token)
    return fn() if fn else None


_PLACEHOLDER = re.compile(r"\{([A-Za-z_]\w*(?:\.\w+)*)\}")


def text(ctx, value, variables=None):
    """Replace {placeholders} with variable values / built-ins. Unknown tokens are left untouched."""
    if value is None:
        return ""
    s = _stringify(value)
    variables = variables or {}

    def repl(m):
        token = m.group(1)
        parts = token.split(".")
        if parts[0] in variables and variables[parts[0]] is not None:
            val = _lookup(variables, parts)
            if val is not None:
                return _stringify(val)
        b = _builtin(ctx, token)
        return m.group(0) if b is None else _stringify(b)

    return _PLACEHOLDER.sub(repl, s)


def to_number(v):
    try:
        n = float(v)
        return int(n) if n.is_integer() else n
    except (TypeError, ValueError):
        return 0


def parse_value(v):
    if isinstance(v, str):
        t = v.strip()
        try:
            n = float(t)
            return int(n) if n.is_integer() else n
        except ValueError:
            return v
    return v


def compare(a, op, b):
    sa, sb = _stringify(a), _stringify(b)
    try:
        na, nb = float(sa), float(sb)
        numeric = sa != "" and sb != ""
    except ValueError:
        numeric = False
    if op == "==":
        return na == nb if numeric else sa == sb
    if op == "!=":
        return na != nb if numeric else sa != sb
    if op in (">", "<", ">=", "<="):
        x, y = (na, nb) if numeric else (sa, sb)
        return {">": x > y, "<": x < y, ">=": x >= y, "<=": x <= y}[op]
    la, lb = sa.lower(), sb.lower()
    if op == "contains":
        return lb in la
    if op == "not_contains":
        return lb not in la
    if op == "starts_with":
        return la.startswith(lb)
    if op == "ends_with":
        return la.endswith(lb)
    if op == "is_empty":
        return sa.strip() == ""
    if op == "not_empty":
        return sa.strip() != ""
    return False


# ---------------------------------------------------------------------- embeds
def _clip(s, n):
    return s if len(s) <= n else s[: n - 1] + "…"


def _is_url(s):
    return bool(re.match(r"^https?://\S+$", s or ""))


def embed(ctx, data, variables=None):
    if not data:
        return None
    t = lambda s: text(ctx, s, variables).strip()
    color = str(data.get("color") or "").replace("#", "")
    e = discord.Embed(color=int(color, 16) if re.fullmatch(r"[0-9a-fA-F]{6}", color) else None)
    has = False
    if data.get("title"):
        e.title = _clip(t(data["title"]), 256)
        has = True
    if data.get("url") and _is_url(t(data["url"])):
        e.url = t(data["url"])
    if data.get("description"):
        d = t(data["description"])
        if d:
            e.description = _clip(d, 4096)
            has = True
    if data.get("authorName"):
        icon = t(data.get("authorIcon", ""))
        link = t(data.get("authorUrl", ""))
        e.set_author(name=_clip(t(data["authorName"]), 256), icon_url=icon if _is_url(icon) else None, url=link if _is_url(link) else None)
        has = True
    if data.get("thumbnail") and _is_url(t(data["thumbnail"])):
        e.set_thumbnail(url=t(data["thumbnail"]))
    if data.get("image") and _is_url(t(data["image"])):
        e.set_image(url=t(data["image"]))
        has = True
    if data.get("footer"):
        icon = t(data.get("footerIcon", ""))
        e.set_footer(text=_clip(t(data["footer"]), 2048), icon_url=icon if _is_url(icon) else None)
        has = True
    if data.get("timestamp"):
        e.timestamp = discord.utils.utcnow()
    for fd in (data.get("fields") or [])[:25]:
        name, value = t(fd.get("name", "")), t(fd.get("value", ""))
        if not name and not value:
            continue
        e.add_field(name=_clip(name or "​", 256), value=_clip(value or "​", 1024), inline=bool(fd.get("inline")))
        has = True
    if not has:
        e.description = "​"
    return e


# -------------------------------------------------------------------- messages
async def reply(ctx, content=None, embed=None, view=None, ephemeral=False):
    kwargs = {}
    if content:
        kwargs["content"] = str(content)[:2000]
    if embed is not None:
        kwargs["embed"] = embed
    if view is not None:
        kwargs["view"] = view
    if not kwargs:
        kwargs["content"] = "​"
    it = ctx.interaction
    msg = None
    if it is not None:
        if not it.response.is_done():
            await it.response.send_message(ephemeral=ephemeral, **kwargs)
            try:
                msg = await it.original_response()
            except discord.HTTPException:
                msg = None
        else:
            msg = await it.followup.send(ephemeral=ephemeral, wait=True, **kwargs)
    elif ctx.message is not None:
        msg = await ctx.message.reply(**kwargs)
    elif ctx.channel is not None:
        msg = await ctx.channel.send(**kwargs)
    else:
        print("[Botify] Nowhere to send the reply in this context.")
    if msg is not None:
        ctx.last_message = msg
    return msg


def _snowflake(value):
    m = re.search(r"\d{15,25}", _stringify(value))
    return int(m.group(0)) if m else None


async def resolve_channel(ctx, value):
    if hasattr(value, "send"):
        return value
    cid = _snowflake(value)
    if not cid:
        return ctx.channel
    ch = ctx.bot.get_channel(cid)
    if ch is None:
        try:
            ch = await ctx.bot.fetch_channel(cid)
        except discord.HTTPException:
            ch = None
    return ch


async def send(ctx, channel_value, content=None, embed=None, ephemeral=False, view=None):
    if not _stringify(channel_value).strip():
        return await reply(ctx, content, embed, view, ephemeral=ephemeral)
    ch = await resolve_channel(ctx, channel_value)
    if ch is None:
        print(f"[Botify] Channel not found: {channel_value}")
        return None
    kwargs = {}
    if content:
        kwargs["content"] = str(content)[:2000]
    if embed is not None:
        kwargs["embed"] = embed
    if view is not None:
        kwargs["view"] = view
    msg = await ch.send(**(kwargs or {"content": "​"}))
    ctx.last_message = msg
    return msg


async def resolve_user(ctx, value):
    if isinstance(value, (discord.Member, discord.User)):
        return value
    if not _stringify(value).strip():
        return ctx.user
    uid = _snowflake(value)
    if not uid:
        return None
    try:
        return ctx.bot.get_user(uid) or await ctx.bot.fetch_user(uid)
    except discord.HTTPException:
        return None


async def resolve_member(ctx, value, fallback_self=False):
    if isinstance(value, discord.Member):
        return value
    if isinstance(value, discord.User) and ctx.guild:
        value = value.id
    if not _stringify(value).strip():
        target = ctx.default_target
        if target is not None:
            return await resolve_member(ctx, target)
        return ctx.member if fallback_self else None
    uid = _snowflake(value)
    if not uid or ctx.guild is None:
        return None
    member = ctx.guild.get_member(uid)
    if member is None:
        try:
            member = await ctx.guild.fetch_member(uid)
        except discord.HTTPException:
            member = None
    return member


async def dm(ctx, target, content=None, embed=None):
    user = await resolve_user(ctx, target)
    if user is None:
        return None
    try:
        kwargs = {}
        if content:
            kwargs["content"] = content
        if embed is not None:
            kwargs["embed"] = embed
        return await user.send(**(kwargs or {"content": "​"}))
    except discord.HTTPException:
        print(f"[Botify] Could not DM {user} (DMs closed?)")
        return None


async def edit_reply(ctx, content=None, embed=None):
    kwargs = {}
    if content is not None:
        kwargs["content"] = content
    if embed is not None:
        kwargs["embed"] = embed
    if ctx.last_message is not None:
        return await ctx.last_message.edit(**kwargs)
    if ctx.interaction is not None and ctx.interaction.response.is_done():
        return await ctx.interaction.edit_original_response(**kwargs)
    return await reply(ctx, content, embed)


async def defer(ctx, ephemeral=False):
    it = ctx.interaction
    if it is not None and not it.response.is_done():
        await it.response.defer(ephemeral=ephemeral, thinking=True)
    elif ctx.channel is not None and hasattr(ctx.channel, "typing"):
        try:
            await ctx.channel.typing()
        except discord.HTTPException:
            pass


async def delete_message(ctx):
    try:
        if ctx.message is not None:
            await ctx.message.delete()
        elif ctx.interaction is not None and ctx.interaction.response.is_done():
            await ctx.interaction.delete_original_response()
        elif ctx.last_message is not None:
            await ctx.last_message.delete()
    except discord.HTTPException:
        pass


async def react(ctx, emoji):
    target = ctx.message or ctx.last_message
    if target is None and ctx.interaction is not None and ctx.interaction.response.is_done():
        try:
            target = await ctx.interaction.original_response()
        except discord.HTTPException:
            target = None
    if target is not None:
        try:
            await target.add_reaction(emoji)
        except discord.HTTPException as e:
            print(f"[Botify] Could not react with {emoji}: {e}")


# ------------------------------------------------------------ interactive modules
def _auto_ack(interaction):
    async def _ack():
        await asyncio.sleep(2.5)
        if not interaction.response.is_done():
            try:
                if interaction.type == discord.InteractionType.modal_submit and interaction.message is None:
                    await interaction.response.send_message("✅ Submitted.", ephemeral=True)
                else:
                    await interaction.response.defer()
            except discord.HTTPException:
                pass

    asyncio.ensure_future(_ack())


_BUTTON_STYLES = {
    "1": discord.ButtonStyle.primary, "2": discord.ButtonStyle.secondary, "3": discord.ButtonStyle.success,
    "4": discord.ButtonStyle.danger, "5": discord.ButtonStyle.link,
}


class _WaitView(discord.ui.View):
    def __init__(self, author_id, timeout):
        super().__init__(timeout=timeout)
        self.author_id = author_id
        self.result = None
        self.clicked = None

    async def interaction_check(self, interaction):
        if self.author_id is None or interaction.user.id == self.author_id:
            return True
        await interaction.response.send_message("This isn't for you.", ephemeral=True)
        return False


async def _finish(ctx, view, msg):
    for item in view.children:
        item.disabled = True
    if msg is not None:
        try:
            await msg.edit(view=view)
        except discord.HTTPException:
            pass
    if view.clicked is not None:
        ctx.interaction = view.clicked
        _auto_ack(view.clicked)


async def ask_buttons(ctx, content=None, buttons=None, timeout=60, only_author=True, embed=None, variables=None, ephemeral=False):
    view = _WaitView(ctx.user.id if only_author and ctx.user else None, max(1, to_number(timeout) or 60))
    clickable = False
    for i, b in enumerate((buttons or [])[:25]):
        style = _BUTTON_STYLES.get(str(b.get("style", "1")), discord.ButtonStyle.primary)
        label = text(ctx, b.get("label", ""), variables)[:80] or None
        emoji = b.get("emoji") or None
        if style == discord.ButtonStyle.link:
            view.add_item(discord.ui.Button(label=label or "Link", url=text(ctx, b.get("url") or "https://discord.com", variables), emoji=emoji, row=i // 5))
            continue
        clickable = True
        btn = discord.ui.Button(label=label or (None if emoji else "Button"), style=style, emoji=emoji, custom_id=str(b.get("id") or f"btn_{i}")[:100], row=i // 5)

        async def callback(interaction, _id=btn.custom_id):
            view.result = _id
            view.clicked = interaction
            view.stop()

        btn.callback = callback
        view.add_item(btn)
    msg = await reply(ctx, content, embed, view, ephemeral=ephemeral)
    if not clickable:
        return "sent"
    await view.wait()
    await _finish(ctx, view, msg)
    return view.result or "timeout"


async def ask_select(ctx, content=None, placeholder="Make a selection...", options=None, min_values=1, max_values=1, timeout=60, variables=None):
    opts = []
    for i, o in enumerate((options or [])[:25]):
        opts.append(discord.SelectOption(
            label=text(ctx, o.get("label") or f"Option {i + 1}", variables)[:100],
            value=str(o.get("value") or f"option_{i}")[:100],
            description=text(ctx, o.get("description"), variables)[:100] or None,
            emoji=o.get("emoji") or None,
        ))
    max_v = min(max(1, int(to_number(max_values) or 1)), max(1, len(opts)))
    min_v = min(max(0, int(to_number(min_values) or 1)), max_v)
    view = _WaitView(ctx.user.id if ctx.user else None, max(1, to_number(timeout) or 60))
    select = discord.ui.Select(placeholder=text(ctx, placeholder, variables)[:150], min_values=min_v, max_values=max_v, options=opts)

    async def callback(interaction):
        view.result = select.values if max_v > 1 else select.values[0]
        view.clicked = interaction
        view.stop()

    select.callback = callback
    view.add_item(select)
    msg = await reply(ctx, content, None, view)
    await view.wait()
    await _finish(ctx, view, msg)
    return view.result if view.result is not None else "timeout"


class _Form(discord.ui.Modal):
    def __init__(self, title, inputs, timeout, ctx, variables):
        super().__init__(title=(text(ctx, title, variables)[:45] or "Form"), timeout=timeout)
        self.values = None
        self.submitted = None
        self._inputs = []
        for i, inp in enumerate((inputs or [])[:5]):
            ti = discord.ui.TextInput(
                label=text(ctx, inp.get("label") or f"Input {i + 1}", variables)[:45] or f"Input {i + 1}",
                custom_id=str(inp.get("id") or f"input_{i}")[:100],
                style=discord.TextStyle.paragraph if inp.get("style") == "paragraph" else discord.TextStyle.short,
                placeholder=text(ctx, inp.get("placeholder"), variables)[:100] or None,
                default=text(ctx, inp.get("value"), variables)[:4000] or None,
                required=inp.get("required", True) is not False,
                min_length=int(to_number(inp.get("minLength"))) or None,
                max_length=int(to_number(inp.get("maxLength"))) or None,
            )
            self._inputs.append(ti)
            self.add_item(ti)

    async def on_submit(self, interaction):
        self.values = {ti.custom_id: ti.value for ti in self._inputs}
        self.submitted = interaction
        self.stop()


async def ask_modal(ctx, title="Form", inputs=None, timeout=300, variables=None):
    it = ctx.interaction
    if it is None or it.response.is_done() or it.type == discord.InteractionType.modal_submit:
        clicked = await ask_buttons(ctx, f"📝 {text(ctx, title, variables)} - click the button to open the form.",
                                    [{"id": "botify_open_modal", "label": "Open form", "style": "1", "emoji": "📝"}], timeout)
        if clicked == "timeout":
            return None
        it = ctx.interaction
    modal = _Form(title, inputs, max(10, to_number(timeout) or 300), ctx, variables)
    await it.response.send_modal(modal)
    await modal.wait()
    if modal.submitted is None:
        return None
    ctx.interaction = modal.submitted
    _auto_ack(modal.submitted)
    return modal.values


# ------------------------------------------------------------- Components V2
def _layout_view(ctx, comps, variables, timeout, on_click=None, author_id=None):
    t = lambda v: text(ctx, v, variables)

    class _View(discord.ui.LayoutView):
        async def interaction_check(self, interaction):
            if author_id is None or interaction.user.id == author_id:
                return True
            await interaction.response.send_message("This isn't for you.", ephemeral=True)
            return False

    view = _View(timeout=timeout)

    def button(b):
        style = _BUTTON_STYLES.get(str(b.get("style", "1")), discord.ButtonStyle.primary)
        label = t(b.get("label", ""))[:80] or None
        emoji = b.get("emoji") or None
        if style == discord.ButtonStyle.link:
            url = t(b.get("url"))
            return discord.ui.Button(label=label or "Link", url=url if _is_url(url) else "https://discord.com", emoji=emoji)
        btn = discord.ui.Button(label=label or (None if emoji else "Button"), style=style, emoji=emoji, custom_id=str(b.get("id") or "btn")[:100])
        if on_click:
            async def cb(interaction, _id=btn.custom_id):
                await on_click(interaction, _id)
            btn.callback = cb
        return btn

    def node(n):
        kind = n.get("type")
        if kind == "text":
            return discord.ui.TextDisplay(_clip(t(n.get("content")) or "​", 4000))
        if kind == "section":
            content = _clip(t(n.get("content")) or "​", 4000)
            acc = n.get("accessory") or {}
            if acc.get("kind") == "button":
                return discord.ui.Section(content, accessory=button(acc))
            url = t(acc.get("url"))
            if _is_url(url):
                kw = {"spoiler": bool(acc.get("spoiler"))}
                if acc.get("description"):
                    kw["description"] = t(acc["description"])[:1024]
                return discord.ui.Section(content, accessory=discord.ui.Thumbnail(url, **kw))
            return discord.ui.TextDisplay(content)
        if kind == "separator":
            return discord.ui.Separator(visible=n.get("divider", True) is not False,
                                        spacing=discord.SeparatorSpacing.large if n.get("spacing") == "large" else discord.SeparatorSpacing.small)
        if kind == "gallery":
            items = []
            for it in (n.get("items") or [])[:10]:
                url = t(it.get("url"))
                if _is_url(url):
                    kw = {"spoiler": bool(it.get("spoiler"))}
                    if it.get("description"):
                        kw["description"] = t(it["description"])[:1024]
                    items.append(discord.MediaGalleryItem(url, **kw))
            return discord.ui.MediaGallery(*items) if items else None
        if kind == "buttons":
            buttons = [button(b) for b in (n.get("buttons") or [])[:5]]
            return discord.ui.ActionRow(*buttons) if buttons else None
        if kind == "container":
            children = [c for c in (node(x) for x in (n.get("children") or []) if x.get("type") != "container") if c is not None]
            if not children:
                return None
            color = str(n.get("accentColor") or "").replace("#", "")
            kw = {"spoiler": bool(n.get("spoiler"))}
            if re.fullmatch(r"[0-9a-fA-F]{6}", color):
                kw["accent_colour"] = int(color, 16)
            return discord.ui.Container(*children, **kw)
        return None

    for n in comps or []:
        item = node(n)
        if item is not None:
            view.add_item(item)
    if not view.children:
        view.add_item(discord.ui.TextDisplay("​"))
    return view


async def send_layout(ctx, channel_value, comps, variables=None, ephemeral=False, wait=False, timeout=60, only_author=True):
    """Send a Components V2 layout. With wait=True returns the clicked button id ("timeout" if none)."""
    state = {"id": None, "interaction": None}
    holder = {}

    async def on_click(interaction, custom_id):
        state["id"], state["interaction"] = custom_id, interaction
        holder["view"].stop()

    view = _layout_view(ctx, comps, variables, max(1, to_number(timeout) or 60) if wait else None,
                        on_click if wait else None, ctx.user.id if (wait and only_author and ctx.user) else None)
    holder["view"] = view
    msg = await send(ctx, channel_value, ephemeral=ephemeral, view=view)
    if not wait:
        return "sent"
    await view.wait()
    for item in view.walk_children():
        if isinstance(item, discord.ui.Button) and item.style != discord.ButtonStyle.link:
            item.disabled = True
    if msg is not None:
        try:
            await msg.edit(view=view)
        except discord.HTTPException:
            pass
    if state["interaction"] is None:
        return "timeout"
    ctx.interaction = state["interaction"]
    _auto_ack(state["interaction"])
    return state["id"]


# ------------------------------------------------------------------ moderation
async def kick(ctx, target, reason=None):
    m = await resolve_member(ctx, target)
    if m is None:
        return await reply(ctx, "⚠️ Could not find that member.", ephemeral=True)
    try:
        await m.kick(reason=reason or None)
    except discord.HTTPException:
        await reply(ctx, "⚠️ I can't kick that member (missing permission or higher role).", ephemeral=True)
    return m


async def ban(ctx, target, reason=None, delete_days=0):
    m = await resolve_member(ctx, target)
    if m is None:
        return await reply(ctx, "⚠️ Could not find that member.", ephemeral=True)
    try:
        await m.ban(reason=reason or None, delete_message_seconds=int(min(7, max(0, to_number(delete_days)))) * 86400)
    except discord.HTTPException:
        await reply(ctx, "⚠️ I can't ban that member (missing permission or higher role).", ephemeral=True)
    return m


async def timeout(ctx, target, minutes, reason=None):
    m = await resolve_member(ctx, target)
    if m is None:
        return await reply(ctx, "⚠️ Could not find that member.", ephemeral=True)
    try:
        await m.timeout(datetime.timedelta(minutes=max(1, to_number(minutes))), reason=reason or None)
    except discord.HTTPException:
        await reply(ctx, "⚠️ I can't timeout that member.", ephemeral=True)
    return m


async def role(ctx, target, role_id, add=True):
    m = await resolve_member(ctx, target, True)
    rid = _snowflake(role_id)
    if m is None or not rid or ctx.guild is None:
        print(f"[Botify] Role action skipped: member or role ID '{role_id}' not found.")
        return None
    r = ctx.guild.get_role(rid)
    if r is None:
        print(f"[Botify] Role {rid} does not exist in this server.")
        return None
    try:
        if add:
            await m.add_roles(r)
        else:
            await m.remove_roles(r)
    except discord.HTTPException as e:
        print(f"[Botify] Could not change role {rid}: {e}")
    return m


async def nickname(ctx, target, nick):
    m = await resolve_member(ctx, target, True)
    if m is None:
        return None
    try:
        await m.edit(nick=nick or None)
    except discord.HTTPException as e:
        print(f"[Botify] Could not change nickname: {e}")
    return m


async def purge(ctx, amount):
    n = int(min(100, max(1, to_number(amount))))
    if ctx.channel is None or not hasattr(ctx.channel, "purge"):
        return 0
    try:
        deleted = await ctx.channel.purge(limit=n)
        return len(deleted)
    except discord.HTTPException as e:
        print(f"[Botify] Purge failed: {e}")
        return 0


def has_permission(ctx, perm):
    m = ctx.member
    if m is None:
        return False
    return bool(getattr(m.guild_permissions, perm, False))


async def has_role(ctx, target, role_id):
    m = await resolve_member(ctx, target, True)
    rid = _snowflake(role_id)
    return bool(m and rid and any(r.id == rid for r in m.roles))


# ------------------------------------------------------------------------ misc
_cooldowns = {}


def cooldown(key, seconds):
    """Return 0 if allowed, otherwise the remaining seconds."""
    now = time.time()
    until = _cooldowns.get(key, 0)
    if now < until:
        return int(until - now) + 1
    _cooldowns[key] = now + to_number(seconds)
    return 0


async def user_info(ctx, target):
    u = await resolve_user(ctx, target)
    if u is None:
        return None
    m = ctx.guild.get_member(u.id) if ctx.guild else None
    return {
        "id": str(u.id), "name": u.name, "username": u.name, "tag": str(u), "displayName": u.display_name,
        "mention": u.mention, "avatar": str(u.display_avatar.url), "bot": u.bot,
        "created": f"<t:{int(u.created_at.timestamp())}:D>",
        "joined": f"<t:{int(m.joined_at.timestamp())}:D>" if m and m.joined_at else "",
        "roles": " ".join(r.mention for r in m.roles[1:]) if m else "",
    }


async def http(url, method="GET", headers="", body=""):
    h = {}
    if headers and str(headers).strip():
        try:
            h = json.loads(headers)
        except ValueError:
            print("[Botify] Invalid headers JSON in HTTP request block.")
    kwargs = {"headers": h}
    if body and method not in ("GET", "HEAD"):
        try:
            kwargs["json"] = json.loads(body)
        except ValueError:
            kwargs["data"] = body
    async with aiohttp.ClientSession() as session:
        async with session.request(method, url, **kwargs) as resp:
            raw = await resp.text()
    try:
        return json.loads(raw)
    except ValueError:
        return raw


def _sql_params(params):
    return tuple(p.id if hasattr(p, "id") and not isinstance(p, (str, int, float)) else p for p in params)


def sql_all(query, params=()):
    try:
        cur = db().execute(query, _sql_params(params))
        return [dict(r) for r in cur.fetchall()]
    except sqlite3.Error as e:
        print(f"[Botify] SQL error: {e}\n  in: {query}")
        return []


def sql_run(query, params=()):
    try:
        cur = db().execute(query, _sql_params(params))
        db().commit()
        return cur.rowcount
    except sqlite3.Error as e:
        print(f"[Botify] SQL error: {e}\n  in: {query}")
        return None


def kv_get(key, default=None):
    row = db().execute("SELECT value FROM botify_kv WHERE key = ?", (str(key),)).fetchone()
    if row is None:
        return default
    try:
        return json.loads(row["value"])
    except ValueError:
        return row["value"]


def kv_set(key, value):
    db().execute("INSERT INTO botify_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (str(key), json.dumps(value, default=str)))
    db().commit()


def random_int(a, b):
    a, b = int(to_number(a)), int(to_number(b))
    if a > b:
        a, b = b, a
    return random.randint(a, b)


def pick(value):
    items = [s.strip() for s in _stringify(value).split("\n") if s.strip()]
    return random.choice(items) if items else ""


_ACTIVITY = {
    "playing": discord.ActivityType.playing, "streaming": discord.ActivityType.streaming,
    "listening": discord.ActivityType.listening, "watching": discord.ActivityType.watching,
    "competing": discord.ActivityType.competing,
}
_STATUS = {"online": discord.Status.online, "idle": discord.Status.idle, "dnd": discord.Status.dnd, "invisible": discord.Status.invisible}


async def set_status(bot, value, kind="Playing", status="online"):
    activity = discord.Activity(type=_ACTIVITY.get(str(kind).lower(), discord.ActivityType.playing), name=str(value)[:128])
    await bot.change_presence(activity=activity, status=_STATUS.get(status, discord.Status.online))


async def prefix_args(ctx_, words, specs):
    out = {}
    for i, s in enumerate(specs):
        raw = " ".join(words[i:]) if i == len(specs) - 1 and s["type"] == "string" else (words[i] if i < len(words) else None)
        if raw is None or raw == "":
            out[s["name"]] = None
            continue
        sid = _snowflake(raw)
        t = s["type"]
        if t == "integer":
            try:
                out[s["name"]] = int(raw)
            except ValueError:
                out[s["name"]] = None
        elif t == "number":
            try:
                out[s["name"]] = float(raw)
            except ValueError:
                out[s["name"]] = None
        elif t == "boolean":
            out[s["name"]] = raw.lower() in ("true", "yes", "y", "1", "on")
        elif t == "user":
            member = ctx_.guild.get_member(sid) if (sid and ctx_.guild) else None
            if member is None and sid:
                try:
                    member = await ctx_.bot.fetch_user(sid)
                except discord.HTTPException:
                    member = None
            out[s["name"]] = member
        elif t == "channel":
            out[s["name"]] = ctx_.bot.get_channel(sid) if sid else None
        elif t == "role":
            out[s["name"]] = ctx_.guild.get_role(sid) if (sid and ctx_.guild) else None
        else:
            out[s["name"]] = raw
    return out


async def help_menu(ctx, settings, commands):
    cats = [c for c in settings.get("categories", []) if c.get("name")]
    color = settings.get("color") or "#5865f2"

    def field_for(c):
        lines = [f"`{n}` - {commands.get(n, '')}".strip() for n in c.get("commands", [])]
        return {"name": f"{c.get('icon', '')} {c['name']}".strip(), "value": "\n".join(lines) or "No commands", "inline": False}

    simple = settings.get("style") == "simple" or not cats
    home = embed(ctx, {
        "title": settings.get("title") or "Help", "description": settings.get("description", ""), "color": color,
        "fields": [field_for(c) for c in cats] if simple else
        [{"name": f"{c.get('icon', '')} {c['name']}".strip(), "value": f"{len(c.get('commands', []))} commands", "inline": True} for c in cats],
        "footer": settings.get("footer", ""), "timestamp": True,
    })
    if simple:
        return await reply(ctx, None, home)

    class HelpView(discord.ui.View):
        def __init__(self):
            super().__init__(timeout=300)
            if settings.get("style") == "select":
                select = discord.ui.Select(placeholder="Select a category...", options=[
                    discord.SelectOption(label=c["name"][:100], value=str(i), emoji=c.get("icon") or None) for i, c in enumerate(cats[:25])])

                async def on_select(interaction):
                    await show(interaction, int(select.values[0]))

                select.callback = on_select
                self.add_item(select)
            else:
                for i, c in enumerate(cats[:25]):
                    b = discord.ui.Button(label=c["name"][:80], emoji=c.get("icon") or None, style=discord.ButtonStyle.secondary, row=i // 5)

                    async def on_click(interaction, _i=i):
                        await show(interaction, _i)

                    b.callback = on_click
                    self.add_item(b)

    async def show(interaction, idx):
        c = cats[idx]
        e = embed(ctx, {"title": f"{c.get('icon', '')} {c['name']}".strip(), "description": field_for(c)["value"], "color": color,
                        "footer": settings.get("title") or "Help"})
        await interaction.response.edit_message(embed=e, view=HelpView())

    await reply(ctx, None, home, HelpView())
