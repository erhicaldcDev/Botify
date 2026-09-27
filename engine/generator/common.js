const Blocks = require("../../src/shared/blocks");

const JS_RESERVED = new Set(("break case catch class const continue debugger default delete do else enum export extends false finally for " +
    "function if import in instanceof let new null return static super switch this throw true try typeof undefined var void while with yield await " +
    "arguments eval").split(" "));

const PY_RESERVED = new Set(("False None True and as assert async await break class continue def del elif else except finally for from global if " +
    "import in is lambda nonlocal not or pass raise return try while with yield print self discord commands app_commands").split(" "));

/** Split a string into literal parts and ${expression} parts (brace-depth aware). */
function splitTemplate(str) {
    const parts = [];
    let i = 0;
    let lit = "";
    str = String(str ?? "");
    while (i < str.length) {
        if (str[i] === "$" && str[i + 1] === "{") {
            let depth = 1;
            let j = i + 2;
            let quote = null;
            while (j < str.length && depth > 0) {
                const ch = str[j];
                if (quote) {
                    if (ch === "\\") j++;
                    else if (ch === quote) quote = null;
                } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
                else if (ch === "{") depth++;
                else if (ch === "}") depth--;
                j++;
            }
            if (depth !== 0) {
                // Unbalanced - treat the rest as literal text.
                lit += str.slice(i);
                break;
            }
            if (lit) parts.push({ lit });
            lit = "";
            parts.push({ expr: str.slice(i + 2, j - 1) });
            i = j;
        } else {
            lit += str[i];
            i++;
        }
    }
    if (lit) parts.push({ lit });
    return parts;
}

function hasTemplate(str) {
    return typeof str === "string" && splitTemplate(str).some((p) => p.expr !== undefined);
}

/** Turn an arbitrary string into a safe identifier. */
function identifier(name, fallback = "value", reserved = JS_RESERVED) {
    let id = String(name || "").trim().replace(/[^A-Za-z0-9_]/g, "_");
    if (!id) id = fallback;
    if (/^[0-9]/.test(id)) id = "_" + id;
    if (reserved.has(id)) id = id + "_";
    return id;
}

function commandName(name) {
    return String(name || "command").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "command";
}

function optionName(name) {
    return String(name || "option").toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 32) || "option";
}

function clampDescription(d, fallback) {
    const s = String(d || "").trim() || fallback || "No description";
    return s.slice(0, 100);
}

/** Normalize legacy action shapes into the current format (non-destructive). */
function normalizeAction(action) {
    if (!action || typeof action !== "object") return null;
    const a = { ...action };
    if (a.type === "send_await_interaction") {
        a.type = "send_buttons";
        a.buttons = a.buttons || (a.components || []).map((c) => ({ label: c.label, id: c.id, style: String(c.style || 1), emoji: c.emoji || "", url: c.url || "" }));
        if (a.timeout === undefined && a.time) a.timeout = Math.round(Number(a.time) / 1000);
    }
    if (a.type === "get_user_info" && !a.saveTo) a.saveTo = "userInfo";
    if (a.type === "api_request" && !a.saveTo) a.saveTo = "apiData";
    if (a.type === "db_read" && !a.saveTo) a.saveTo = "rows";
    if (a.type === "check_permission" && !a.denyMessage) a.denyMessage = `Missing permission: ${a.permission || "Administrator"}`;
    if (a.type === "has_role" && !a.denyMessage) a.denyMessage = "Missing required role.";
    if (a.type === "set_status" && a.statusType) {
        const s = String(a.statusType);
        a.statusType = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }
    if ((a.type === "db_read" || a.type === "db_write") && typeof a.params === "string") {
        a.params = a.params.split(",").map((p) => p.trim()).filter(Boolean);
    }
    return a;
}

const SAVE_DEFAULTS = {
    send_buttons: "clicked", send_select_menu: "selected", show_modal: "form", random_number: "number",
    random_choice: "choice", get_user_info: "userInfo", api_request: "apiData", kv_get: "value", db_read: "rows",
    mention_user: "mention", mention_role: "mention", mention_channel: "mention",
};

function saveTarget(a) {
    if (a.saveTo) return a.saveTo;
    return SAVE_DEFAULTS[a.type] || null;
}

/** Walk an action tree and collect every variable name that gets assigned. */
function collectVariables(actions, out = new Set()) {
    (actions || []).forEach((raw) => {
        const a = normalizeAction(raw);
        if (!a) return;
        if (a.type === "set_variable" || a.type === "math") out.add(a.name || "variable");
        if (a.type === "loop") out.add(a.variable || "i");
        const st = saveTarget(a);
        if (st && a.type !== "send_message") out.add(st);
        if (a.type === "send_message" && a.saveTo) out.add(a.saveTo);
        ["then", "else", "body"].forEach((k) => { if (Array.isArray(a[k])) collectVariables(a[k], out); });
    });
    return out;
}

/** Walk every action (including nested branches). */
function walkActions(actions, fn) {
    (actions || []).forEach((a) => {
        if (!a) return;
        fn(a);
        ["then", "else", "body"].forEach((k) => { if (Array.isArray(a[k])) walkActions(a[k], fn); });
    });
}

function findEmbed(project, ref) {
    if (!ref) return null;
    const list = project.embeds || [];
    return list.find((e) => e.id === ref) || list.find((e) => (e.name || e.title) === ref) || null;
}

function indentLines(code, indent) {
    return String(code || "").split("\n").map((l) => (l.trim() ? indent + l : l)).join("\n");
}

/** Strip common leading whitespace from a block of user code. */
function dedent(code) {
    const lines = String(code || "").replace(/\t/g, "    ").split("\n");
    const widths = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
    const min = widths.length ? Math.min(...widths) : 0;
    return lines.map((l) => l.slice(min)).join("\n").replace(/\s+$/, "");
}

function hexColor(c, fallback = "5865f2") {
    const s = String(c || "").replace("#", "");
    return /^[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}

function camelToSnake(s) {
    return String(s).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

module.exports = {
    Blocks, JS_RESERVED, PY_RESERVED, splitTemplate, hasTemplate, identifier, commandName, optionName, clampDescription,
    normalizeAction, collectVariables, walkActions, saveTarget, findEmbed, indentLines, dedent, hexColor, camelToSnake,
};

/** Apply replacements to the code parts of an expression, leaving string literals untouched. */
function mapCode(expr, fn) {
    const s = String(expr);
    let out = "";
    let code = "";
    let i = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'" || ch === "`") {
            out += fn(code);
            code = "";
            let j = i + 1;
            while (j < s.length && s[j] !== ch) j += s[j] === "\\" ? 2 : 1;
            out += s.slice(i, j + 1);
            i = j + 1;
        } else {
            code += ch;
            i++;
        }
    }
    return out + fn(code);
}

/** Best-effort translation of simple JavaScript expressions (from Node projects/plugins) to Python. */
function toPythonExpr(expr) {
    return mapCode(expr, (c) => c
        .replace(/===/g, "==").replace(/!==/g, "!=")
        .replace(/&&/g, " and ").replace(/\|\|/g, " or ")
        .replace(/!(?!=)/g, " not ")
        .replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\b(null|undefined)\b/g, "None"));
}

/** Best-effort translation of simple JavaScript expressions to Lua. */
function toLuaExpr(expr) {
    return mapCode(expr, (c) => c
        .replace(/===/g, "==").replace(/!==/g, "~=").replace(/!=/g, "~=")
        .replace(/&&/g, " and ").replace(/\|\|/g, " or ")
        .replace(/!(?!=)/g, " not ")
        .replace(/\b(null|undefined)\b/g, "nil"));
}

module.exports.toPythonExpr = toPythonExpr;
module.exports.toLuaExpr = toLuaExpr;
