/*
 * Blueprint Visual Scripting (BVS) editor.
 *
 * A node graph that compiles to Botify action lists:
 *   Start ──next──▶ Block ──next──▶ Block ...
 *                     └─then/else/body──▶ branch chains
 */
(function () {
  const NODE_W = 236;
  const COL_W = 300;
  const START_ID = "start";
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2;

  const catColor = (id) => (BotifyBlocks.CATEGORIES.find((c) => c.id === id) || { color: "#00b0f4" }).color;

  function pinLabel(block, pin) {
    if (block && block.pinLabels && block.pinLabels[pin]) return block.pinLabels[pin];
    return { next: "Next", then: "True", else: "False", body: "Loop", true_next: "True", false_next: "False" }[pin] || pin;
  }

  /** Convert an action list (tree) into graph nodes + wires with a tidy tree layout. */
  function actionsToGraph(actions, extraBlocks) {
    const nodes = [{ id: START_ID, type: "__start", x: 60, y: 80, data: {} }];
    const wires = [];
    const state = { bottom: 80 };
    const ROW_H = 150;

    function build(list, x, y) {
      let prev = null;
      let first = null;
      let curX = x;
      state.bottom = Math.max(state.bottom, y + ROW_H);
      (list || []).forEach((raw) => {
        if (!raw || typeof raw !== "object") return;
        const action = { ...raw };
        const type = BotifyBlocks.ALIASES[action.type] || action.type;
        if (type !== action.type) Object.assign(action, normalizeLegacy(action), { type });
        const outputs = BotifyBlocks.outputsOf(type, extraBlocks);
        const data = { ...action };
        outputs.forEach((p) => { if (p !== "next") delete data[p]; });
        const node = { id: uid(), type, x: curX, y, data };
        nodes.push(node);
        if (!first) first = node;
        if (prev) wires.push({ from: prev.id, fromPin: "next", to: node.id });
        outputs.filter((p) => p !== "next").forEach((pin) => {
          if (Array.isArray(action[pin]) && action[pin].length) {
            const res = build(action[pin], curX + COL_W, state.bottom + 30);
            if (res) wires.push({ from: node.id, fromPin: pin, to: res.id });
          }
        });
        prev = outputs.includes("next") ? node : null;
        curX += COL_W;
      });
      return first;
    }

    const first = build(actions, 60 + COL_W, 80);
    if (first) wires.push({ from: START_ID, fromPin: "next", to: first.id });
    return { nodes, wires };
  }

  function normalizeLegacy(a) {
    if (a.type === "send_await_interaction") {
      return {
        buttons: (a.components || []).map((c) => ({ label: c.label, id: c.id, style: String(c.style || 1), emoji: "", url: "" })),
        timeout: a.time ? Math.round(a.time / 1000) : 60,
        onlyAuthor: true,
      };
    }
    return {};
  }

  /**
   * Mount the editor.
   * opts: { graph, actions, trigger: {label, sub, icon}, engine, project, pluginBlocks, variables: [], commandName, onChange }
   */
  function mount(root, opts) {
    const extraBlocks = (opts.pluginBlocks || []).map((b) => ({ ...b, category: "plugin", engines: ["node"] }));
    const allBlocks = [...BotifyBlocks.BLOCKS.filter((b) => !b.hidden), ...extraBlocks];
    const getBlock = (type) => BotifyBlocks.getBlock(type) || extraBlocks.find((b) => b.type === type) || null;
    const outputsOf = (type) => (type === "__start" ? ["next"] : BotifyBlocks.outputsOf(type, extraBlocks));

    let graph = opts.graph && Array.isArray(opts.graph.nodes) && opts.graph.nodes.some((n) => n.id === START_ID)
      ? clone(opts.graph) : actionsToGraph(opts.actions || [], extraBlocks);
    let view = { x: 0, y: 0, zoom: 1, ...(graph.view || {}) };
    let selected = null; // { kind: "node"|"wire", id }
    const history = [];
    const future = [];
    const ac = new AbortController();
    const on = (target, ev, fn, o = {}) => target.addEventListener(ev, fn, { ...o, signal: ac.signal });

    root.innerHTML = `
      <div class="bvs">
        <aside class="bvs-palette">
          <div class="bvs-search">${icon("search", 14)}<input class="input input-sm" placeholder="Search blocks..." data-el="search" /></div>
          <div class="bvs-palette-list" data-el="palette"></div>
        </aside>
        <div class="bvs-stage" data-el="stage" tabindex="0">
          <div class="bvs-viewport" data-el="viewport">
            <svg class="bvs-wires" data-el="wires"></svg>
            <div class="bvs-nodes" data-el="nodes"></div>
          </div>
          <div class="bvs-toolbar">
            <button class="icon-btn" data-act="undo" title="Undo (Ctrl+Z)">↶</button>
            <button class="icon-btn" data-act="redo" title="Redo (Ctrl+Y)">↷</button>
            <span class="bvs-toolbar-sep"></span>
            <button class="icon-btn" data-act="zoom-out" title="Zoom out">${icon("zoomOut", 16)}</button>
            <span class="bvs-zoom" data-el="zoom">100%</span>
            <button class="icon-btn" data-act="zoom-in" title="Zoom in">${icon("zoomIn", 16)}</button>
            <button class="icon-btn" data-act="fit" title="Fit to screen">${icon("fit", 16)}</button>
            <button class="icon-btn" data-act="layout" title="Auto-arrange">${icon("layout", 16)}</button>
          </div>
          <div class="bvs-hint">Drag blocks in • Drag from a <b>◆ pin</b> to connect (drop on empty space to add a block) • Right-click for menu • <kbd>Del</kbd> deletes • Scroll to zoom, drag background to pan</div>
        </div>
        <aside class="bvs-inspector" data-el="inspector"></aside>
      </div>`;

    const $ = (s) => root.querySelector(s);
    const stage = $('[data-el="stage"]');
    const viewport = $('[data-el="viewport"]');
    const svg = $('[data-el="wires"]');
    const nodesEl = $('[data-el="nodes"]');
    const inspector = $('[data-el="inspector"]');

    // ---------------------------------------------------------------- history
    const snapshot = () => JSON.stringify({ nodes: graph.nodes, wires: graph.wires });
    let lastSnap = snapshot();
    function commit() {
      const s = snapshot();
      if (s === lastSnap) return;
      history.push(lastSnap);
      if (history.length > 100) history.shift();
      future.length = 0;
      lastSnap = s;
      opts.onChange && opts.onChange();
    }
    const commitSoon = debounce(commit, 400);
    function restore(s) {
      const g = JSON.parse(s);
      graph.nodes = g.nodes;
      graph.wires = g.wires;
      lastSnap = s;
      if (selected && selected.kind === "node" && !graph.nodes.some((n) => n.id === selected.id)) selected = null;
      renderAll();
      opts.onChange && opts.onChange();
    }
    const undo = () => { if (history.length) { future.push(snapshot()); restore(history.pop()); } };
    const redo = () => { if (future.length) { history.push(snapshot()); restore(future.pop()); } };

    // ---------------------------------------------------------------- helpers
    const nodeById = (id) => graph.nodes.find((n) => n.id === id);
    function applyView() {
      viewport.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
      stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
      stage.style.backgroundSize = `${24 * view.zoom}px ${24 * view.zoom}px`;
      $('[data-el="zoom"]').textContent = Math.round(view.zoom * 100) + "%";
      graph.view = { ...view };
    }
    function toWorld(clientX, clientY) {
      const r = stage.getBoundingClientRect();
      return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
    }
    function pinPos(nodeId, pin) {
      const el = nodesEl.querySelector(`.bvs-node[data-id="${nodeId}"] .bvs-pin[data-pin="${pin}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const vr = viewport.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - vr.left) / view.zoom, y: (r.top + r.height / 2 - vr.top) / view.zoom };
    }
    function wirePath(a, b) {
      const dx = Math.max(60, Math.abs(b.x - a.x) * 0.5);
      return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
    }

    function reachable() {
      const seen = new Set([START_ID]);
      const queue = [START_ID];
      while (queue.length) {
        const id = queue.shift();
        graph.wires.filter((w) => w.from === id).forEach((w) => {
          if (!seen.has(w.to)) { seen.add(w.to); queue.push(w.to); }
        });
      }
      return seen;
    }

    function variables() {
      const set = new Set(opts.variables || []);
      graph.nodes.forEach((n) => {
        const d = n.data || {};
        if (d.saveTo) set.add(d.saveTo);
        if ((n.type === "set_variable" || n.type === "math") && d.name) set.add(d.name);
        if (n.type === "loop" && d.variable) set.add(d.variable);
        if (n.type === "show_modal") (d.inputs || []).forEach((inp) => inp.id && set.add(`${d.saveTo || "form"}.${inp.id}`));
      });
      return [...set];
    }

    function issuesFor(node) {
      if (node.type === "__start") return [];
      const out = [];
      const block = getBlock(node.type);
      const d = node.data || {};
      if (!block) out.push(`Unknown block "${node.type}" (plugin disabled?)`);
      else if (!BotifyBlocks.supports(node.type, opts.engine || "node") && !(extraBlocks.find((b) => b.type === node.type) && opts.engine === "node")) {
        out.push(`Not supported by the ${opts.engine} engine`);
      }
      if ((node.type === "add_role" || node.type === "remove_role" || node.type === "has_role") && !String(d.roleId || "").trim()) out.push("Role ID is empty");
      if (node.type === "send_saved_embed" && !d.embedRef) out.push("No saved embed selected");
      if (node.type === "show_modal" && !(d.inputs || []).length) out.push("Modal needs at least one input");
      if (node.type === "send_buttons" && !(d.buttons || []).length) out.push("Add at least one button");
      if (node.type === "send_select_menu" && !(d.options || []).length) out.push("Add at least one option");
      if (node.type === "show_modal" && opts.triggerKind === "event") out.push("Modals only work in commands");
      if (["api_request"].includes(node.type) && !/^https?:\/\//.test(String(d.url || "").replace(/^\$\{.*?\}/, "http://"))) out.push("URL should start with http(s)://");
      return out;
    }

    // ---------------------------------------------------------------- palette
    function renderPalette() {
      const q = $('[data-el="search"]').value.trim().toLowerCase();
      const list = $('[data-el="palette"]');
      list.innerHTML = "";
      BotifyBlocks.CATEGORIES.forEach((cat) => {
        const blocks = allBlocks.filter((b) => (b.category || "plugin") === cat.id && (!q || b.label.toLowerCase().includes(q) || b.type.includes(q) || (b.description || "").toLowerCase().includes(q)));
        if (!blocks.length) return;
        const section = document.createElement("div");
        section.className = "bvs-cat";
        section.innerHTML = `<div class="bvs-cat-title" style="--cat:${cat.color}">${cat.icon} ${escapeHtml(cat.label)}</div>`;
        blocks.forEach((b) => {
          const supported = BotifyBlocks.supports(b.type, opts.engine || "node") || (b.category === "plugin" && opts.engine === "node");
          const el = document.createElement("div");
          el.className = "bvs-block" + (supported ? "" : " unsupported");
          el.draggable = true;
          el.style.setProperty("--cat", cat.color);
          el.title = (b.description || b.label) + (supported ? "" : `\n⚠ Not supported by the ${opts.engine} engine`);
          el.innerHTML = `<span class="bvs-block-icon">${escapeHtml(b.icon || "⚡")}</span><span>${escapeHtml(b.label)}</span>`;
          el.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("application/x-bvs-block", b.type);
            e.dataTransfer.effectAllowed = "copy";
          });
          el.addEventListener("click", () => {
            // Click = add next to the selected node (and connect it), or at the centre of the view.
            const r = stage.getBoundingClientRect();
            const sel = selected && selected.kind === "node" ? nodeById(selected.id) : null;
            const pos = sel ? { x: sel.x + COL_W, y: sel.y } : toWorld(r.left + r.width / 2 - NODE_W / 2, r.top + r.height / 3);
            const node = addNode(b.type, pos.x, pos.y);
            if (sel && outputsOf(sel.type).includes("next") && !graph.wires.some((w) => w.from === sel.id && w.fromPin === "next")) {
              connect(sel.id, "next", node.id);
            }
            select({ kind: "node", id: node.id });
            ensureVisible(node.id);
          });
          section.appendChild(el);
        });
        list.appendChild(section);
      });
      if (!list.children.length) list.innerHTML = '<div class="text-muted text-sm" style="padding:12px">No blocks match.</div>';
    }
    on($('[data-el="search"]'), "input", renderPalette);

    // ---------------------------------------------------------------- nodes
    function summaryOf(node) {
      if (node.type === "__start") return opts.trigger && opts.trigger.sub ? opts.trigger.sub : "";
      const b = getBlock(node.type);
      try {
        return b && b.summary ? String(b.summary(node.data || {}) || "") : "";
      } catch {
        return "";
      }
    }

    function nodeHtml(node, isReachable) {
      const isStart = node.type === "__start";
      const b = isStart ? null : getBlock(node.type);
      const cat = isStart ? "#43b581" : catColor(b ? b.category : "plugin");
      const outputs = outputsOf(node.type);
      const issues = issuesFor(node);
      const label = isStart ? (opts.trigger && opts.trigger.label) || "Start" : (b ? b.label : node.type);
      const iconTxt = isStart ? (opts.trigger && opts.trigger.icon) || "▶" : (b ? b.icon : "⚡");
      const summary = summaryOf(node).replace(/\s+/g, " ").slice(0, 70);
      const inlineNext = outputs.length === 1 && outputs[0] === "next";
      return `
        <div class="bvs-node-header">
          ${isStart ? "" : `<div class="bvs-pin bvs-pin-in" data-pin="in" title="Input"></div>`}
          <span class="bvs-node-icon">${escapeHtml(iconTxt)}</span>
          <span class="bvs-node-title">${escapeHtml(label)}</span>
          ${issues.length ? `<span class="bvs-node-warn" title="${escapeHtml(issues.join("\n"))}">${icon("alert", 13)}</span>` : ""}
          ${inlineNext ? `<div class="bvs-pin bvs-pin-out" data-pin="next" title="Next"></div>` : ""}
        </div>
        ${summary ? `<div class="bvs-node-summary">${escapeHtml(summary)}</div>` : ""}
        ${!inlineNext && outputs.length ? `<div class="bvs-node-outputs">${outputs.map((p) => `
          <div class="bvs-out-row bvs-out-${p}"><span>${escapeHtml(pinLabel(b, p))}</span><div class="bvs-pin bvs-pin-out" data-pin="${p}" title="${escapeHtml(pinLabel(b, p))}"></div></div>`).join("")}</div>` : ""}
        ${!isReachable && !isStart ? '<div class="bvs-node-detached">Not connected - will not run</div>' : ""}`;
    }

    function renderNodes() {
      const reach = reachable();
      nodesEl.innerHTML = "";
      graph.nodes.forEach((node) => {
        const b = node.type === "__start" ? null : getBlock(node.type);
        const el = document.createElement("div");
        el.className = "bvs-node" + (node.type === "__start" ? " bvs-node-start" : "") + (reach.has(node.id) ? "" : " detached") +
          (selected && selected.kind === "node" && selected.id === node.id ? " selected" : "");
        el.dataset.id = node.id;
        el.style.left = node.x + "px";
        el.style.top = node.y + "px";
        el.style.width = NODE_W + "px";
        el.style.setProperty("--cat", node.type === "__start" ? "#43b581" : catColor(b ? b.category : "plugin"));
        el.innerHTML = nodeHtml(node, reach.has(node.id));
        nodesEl.appendChild(el);
      });
      markConnectedPins();
    }

    function markConnectedPins() {
      nodesEl.querySelectorAll(".bvs-pin").forEach((p) => p.classList.remove("connected"));
      graph.wires.forEach((w) => {
        nodesEl.querySelector(`.bvs-node[data-id="${w.from}"] .bvs-pin[data-pin="${w.fromPin}"]`)?.classList.add("connected");
        nodesEl.querySelector(`.bvs-node[data-id="${w.to}"] .bvs-pin[data-pin="in"]`)?.classList.add("connected");
      });
    }

    function drawWires(temp) {
      const parts = [];
      graph.wires.forEach((w, i) => {
        const a = pinPos(w.from, w.fromPin);
        const b = pinPos(w.to, "in");
        if (!a || !b) return;
        const from = nodeById(w.from);
        const color = w.fromPin === "else" || w.fromPin === "false_next" ? "#ed4245" : w.fromPin === "then" || w.fromPin === "true_next" ? "#3ba55c" : w.fromPin === "body" ? "#faa61a" : "#8b93ff";
        const sel = selected && selected.kind === "wire" && selected.id === i;
        const d = wirePath(a, b);
        parts.push(`<path class="bvs-wire-hit" data-wire="${i}" d="${d}"/><path class="bvs-wire${sel ? " selected" : ""}${from && from.type === "__start" ? " start" : ""}" style="--wire:${color}" d="${d}"/>`);
      });
      if (temp) parts.push(`<path class="bvs-wire temp" d="${wirePath(temp.a, temp.b)}"/>`);
      svg.innerHTML = parts.join("");
    }

    function renderAll() {
      renderNodes();
      requestAnimationFrame(() => drawWires());
      renderInspector();
    }

    // ---------------------------------------------------------------- graph ops
    function addNode(type, x, y) {
      const data = BotifyBlocks.createDefault(type, extraBlocks);
      const node = { id: uid(), type, x: Math.round(x), y: Math.round(y), data };
      graph.nodes.push(node);
      renderAll();
      commit();
      return node;
    }

    function connect(from, fromPin, to) {
      if (from === to) return;
      graph.wires = graph.wires.filter((w) => !(w.from === from && w.fromPin === fromPin));
      graph.wires.push({ from, fromPin, to });
      renderNodes();
      drawWires();
      commit();
    }

    function deleteNode(id) {
      if (id === START_ID) return showToast("The start block can't be removed", "info");
      // Keep the flow intact: reconnect the node's parent to its "next" child.
      const incoming = graph.wires.filter((w) => w.to === id);
      const next = graph.wires.find((w) => w.from === id && w.fromPin === "next");
      graph.nodes = graph.nodes.filter((n) => n.id !== id);
      graph.wires = graph.wires.filter((w) => w.from !== id && w.to !== id);
      if (next) incoming.forEach((w) => graph.wires.push({ from: w.from, fromPin: w.fromPin, to: next.to }));
      if (selected && selected.id === id) selected = null;
      renderAll();
      commit();
    }

    function duplicateNode(id) {
      const n = nodeById(id);
      if (!n || n.type === "__start") return;
      const copy = { id: uid(), type: n.type, x: n.x + 30, y: n.y + 30, data: clone(n.data) };
      graph.nodes.push(copy);
      select({ kind: "node", id: copy.id });
      commit();
    }

    function select(sel) {
      selected = sel;
      nodesEl.querySelectorAll(".bvs-node").forEach((el) => el.classList.toggle("selected", !!(sel && sel.kind === "node" && el.dataset.id === sel.id)));
      drawWires();
      renderInspector();
    }

    function autoLayout() {
      const actions = compile();
      const g = actionsToGraph(actions, extraBlocks);
      // Map new layout positions back onto existing nodes by walking both graphs in the same order.
      const order = [];
      const walk = (id, seen = new Set()) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        order.push(id);
        const n = nodeById(id);
        outputsOf(n ? n.type : "__start").forEach((p) => {
          const w = graph.wires.find((x) => x.from === id && x.fromPin === p);
          if (w) walk(w.to, seen);
        });
      };
      const orderNew = [];
      const walkNew = (id, seen = new Set()) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        orderNew.push(id);
        const n = g.nodes.find((x) => x.id === id);
        outputsOf(n.type).forEach((p) => {
          const w = g.wires.find((x) => x.from === id && x.fromPin === p);
          if (w) walkNew(w.to, seen);
        });
      };
      walk(START_ID);
      walkNew(START_ID);
      let maxY = 0;
      order.forEach((id, i) => {
        const target = g.nodes.find((x) => x.id === orderNew[i]);
        const n = nodeById(id);
        if (target && n) { n.x = target.x; n.y = target.y; maxY = Math.max(maxY, n.y); }
      });
      let x = 60;
      graph.nodes.filter((n) => !order.includes(n.id)).forEach((n) => { n.x = x; n.y = maxY + 220; x += COL_W; });
      renderAll();
      commit();
      setTimeout(() => fit(), 30);
    }

    function fit(initial = false) {
      if (!graph.nodes.length) return;
      const els = [...nodesEl.children];
      const minX = Math.min(...graph.nodes.map((n) => n.x));
      const minY = Math.min(...graph.nodes.map((n) => n.y));
      const maxX = Math.max(...graph.nodes.map((n) => n.x + NODE_W));
      const maxY = Math.max(...graph.nodes.map((n, i) => n.y + ((els[i] && els[i].offsetHeight) || 120)));
      const r = stage.getBoundingClientRect();
      const pad = 60;
      const fitted = Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2) / (maxY - minY));
      // On open keep blocks readable (the user can pan); the Fit button shows everything.
      view.zoom = Math.max(initial ? 0.8 : MIN_ZOOM, Math.min(1.05, fitted));
      view.x = pad - minX * view.zoom + Math.max(0, (r.width - pad * 2 - (maxX - minX) * view.zoom) / 2);
      view.y = pad - minY * view.zoom;
      applyView();
      drawWires();
    }

    function zoomAt(factor, cx, cy) {
      const r = stage.getBoundingClientRect();
      const px = cx === undefined ? r.width / 2 : cx - r.left;
      const py = cy === undefined ? r.height / 2 : cy - r.top;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
      view.x = px - ((px - view.x) * z) / view.zoom;
      view.y = py - ((py - view.y) * z) / view.zoom;
      view.zoom = z;
      applyView();
    }

    // ---------------------------------------------------------------- compile
    function compile() {
      const serialize = (id, path = new Set()) => {
        if (!id || path.has(id)) return [];
        const node = nodeById(id);
        if (!node) return [];
        const nextPath = new Set(path).add(id);
        if (node.type === "__start") {
          const w = graph.wires.find((x) => x.from === id && x.fromPin === "next");
          return w ? serialize(w.to, nextPath) : [];
        }
        const action = { ...clone(node.data), type: node.type };
        outputsOf(node.type).filter((p) => p !== "next").forEach((pin) => {
          const w = graph.wires.find((x) => x.from === id && x.fromPin === pin);
          action[pin] = w ? serialize(w.to, nextPath) : [];
        });
        const next = graph.wires.find((x) => x.from === id && x.fromPin === "next");
        return [action, ...(next ? serialize(next.to, nextPath) : [])];
      };
      return serialize(START_ID);
    }

    // ---------------------------------------------------------------- inspector
    function renderInspector() {
      const node = selected && selected.kind === "node" ? nodeById(selected.id) : null;
      if (!node || node.type === "__start") {
        const reach = reachable();
        const allIssues = [];
        graph.nodes.forEach((n) => {
          const b = getBlock(n.type);
          issuesFor(n).forEach((msg) => allIssues.push({ id: n.id, label: b ? b.label : n.type, msg }));
          if (!reach.has(n.id)) allIssues.push({ id: n.id, label: b ? b.label : n.type, msg: "Not connected to the start block" });
        });
        const vars = variables();
        inspector.innerHTML = `
          <div class="insp-header"><span class="insp-icon">${escapeHtml((opts.trigger && opts.trigger.icon) || "▶")}</span>
            <div><div class="insp-title">${escapeHtml((opts.trigger && opts.trigger.label) || "Flow")}</div><div class="insp-sub">${escapeHtml((opts.trigger && opts.trigger.sub) || "")}</div></div></div>
          <div class="insp-section">
            <div class="insp-section-title">How it works</div>
            <p class="text-sm text-muted">The flow starts at the green block and follows the wires. Click a block to edit it. Use <code>{variable}</code> in any text to insert values.</p>
          </div>
          <div class="insp-section">
            <div class="insp-section-title">Available variables</div>
            <div class="chip-list">${vars.map((v) => `<code class="chip" title="Click to copy">{${escapeHtml(v)}}</code>`).join("") || '<span class="text-muted text-sm">none yet</span>'}</div>
            <div class="chip-list mt-sm">${BotifyBlocks.PLACEHOLDERS.filter((p) => p.token !== "{myVar}").map((p) => `<code class="chip chip-muted" title="${escapeHtml(p.desc)}">${escapeHtml(p.token)}</code>`).join("")}</div>
          </div>
          <div class="insp-section">
            <div class="insp-section-title">Checks ${allIssues.length ? `<span class="badge badge-warn">${allIssues.length}</span>` : '<span class="badge badge-ok">OK</span>'}</div>
            ${allIssues.length ? allIssues.map((it) => `<div class="insp-issue" data-node="${it.id}">${icon("alert", 13)} <b>${escapeHtml(it.label)}</b>: ${escapeHtml(it.msg)}</div>`).join("") : '<p class="text-sm text-muted">No problems found. 🎉</p>'}
          </div>`;
        inspector.querySelectorAll(".chip").forEach((c) => { c.onclick = () => navigator.clipboard?.writeText(c.textContent).then(() => showToast(`Copied ${c.textContent}`, "info")); });
        inspector.querySelectorAll(".insp-issue").forEach((el) => { el.onclick = () => { select({ kind: "node", id: el.dataset.node }); centerOn(el.dataset.node); }; });
        return;
      }

      const b = getBlock(node.type);
      const issues = issuesFor(node);
      inspector.innerHTML = `
        <div class="insp-header" style="--cat:${catColor(b ? b.category : "plugin")}">
          <span class="insp-icon">${escapeHtml(b ? b.icon : "⚡")}</span>
          <div class="flex-1"><div class="insp-title">${escapeHtml(b ? b.label : node.type)}</div><div class="insp-sub">${escapeHtml(b && b.description ? b.description : node.type)}</div></div>
        </div>
        ${issues.length ? `<div class="insp-issues">${issues.map((m) => `<div class="insp-issue">${icon("alert", 13)} ${escapeHtml(m)}</div>`).join("")}</div>` : ""}
        <div class="insp-form" data-el="form"></div>
        <div class="insp-preview-wrap" data-el="preview-wrap"></div>
        <div class="insp-actions">
          <button class="btn btn-ghost btn-sm" data-act="dup">${icon("copy", 14)} Duplicate</button>
          <button class="btn btn-danger-ghost btn-sm" data-act="del">${icon("trash", 14)} Delete</button>
        </div>`;
      const formEl = inspector.querySelector('[data-el="form"]');
      const updatePreview = () => {
        const html = DiscordPreview.forAction({ ...node.data, type: node.type }, { project: opts.project, command: opts.commandName });
        const wrap = inspector.querySelector('[data-el="preview-wrap"]');
        wrap.innerHTML = html ? `<div class="preview-label">${icon("eye", 14)} Preview</div><div class="discord-surface discord-surface-sm">${html}</div>` : "";
      };
      const fields = (b && b.fields) || Object.keys(node.data || {}).filter((k) => k !== "type" && typeof node.data[k] !== "object").map((k) => ({ key: k, label: k, type: "text" }));
      FieldForm.render(formEl, fields, node.data, {
        project: opts.project,
        variables: variables(),
        onChange: () => {
          const el = nodesEl.querySelector(`.bvs-node[data-id="${node.id}"]`);
          if (el) {
            el.innerHTML = nodeHtml(node, reachable().has(node.id));
            markConnectedPins();
            drawWires();
          }
          updatePreview();
          commitSoon();
        },
      });
      updatePreview();
      inspector.querySelector('[data-act="dup"]').onclick = () => duplicateNode(node.id);
      inspector.querySelector('[data-act="del"]').onclick = () => deleteNode(node.id);
    }

    /** Pan just enough so a node is fully visible. */
    function ensureVisible(id) {
      const n = nodeById(id);
      const el = nodesEl.querySelector(`.bvs-node[data-id="${id}"]`);
      if (!n || !el) return;
      const r = stage.getBoundingClientRect();
      const pad = 40;
      const left = n.x * view.zoom + view.x;
      const top = n.y * view.zoom + view.y;
      const right = left + NODE_W * view.zoom;
      const bottom = top + el.offsetHeight * view.zoom;
      if (right > r.width - pad) view.x -= right - (r.width - pad);
      if (left < pad) view.x += pad - left;
      if (bottom > r.height - 60) view.y -= bottom - (r.height - 60);
      if (top < 70) view.y += 70 - top;
      applyView();
      drawWires();
    }

    function centerOn(id) {
      const n = nodeById(id);
      if (!n) return;
      const r = stage.getBoundingClientRect();
      view.x = r.width / 2 - (n.x + NODE_W / 2) * view.zoom;
      view.y = r.height / 3 - n.y * view.zoom;
      applyView();
      drawWires();
    }

    // ---------------------------------------------------------------- context menu
    function closeMenus() {
      root.querySelectorAll(".bvs-menu").forEach((m) => m.remove());
    }

    function openAddMenu(clientX, clientY, onPick) {
      closeMenus();
      const menu = document.createElement("div");
      menu.className = "bvs-menu";
      menu.innerHTML = `<div class="bvs-search">${icon("search", 14)}<input class="input input-sm" placeholder="Add block..." /></div><div class="bvs-menu-list"></div>`;
      root.appendChild(menu);
      const rr = root.getBoundingClientRect();
      menu.style.left = Math.min(clientX - rr.left, rr.width - 270) + "px";
      menu.style.top = Math.min(clientY - rr.top, rr.height - 360) + "px";
      const input = menu.querySelector("input");
      const list = menu.querySelector(".bvs-menu-list");
      const draw = () => {
        const q = input.value.trim().toLowerCase();
        const items = allBlocks.filter((b) => !q || b.label.toLowerCase().includes(q) || b.type.includes(q));
        list.innerHTML = items.slice(0, 60).map((b) => `<div class="bvs-menu-item" data-type="${b.type}" style="--cat:${catColor(b.category)}"><span>${escapeHtml(b.icon || "⚡")}</span>${escapeHtml(b.label)}</div>`).join("") || '<div class="text-muted text-sm" style="padding:8px">No match</div>';
        list.querySelectorAll(".bvs-menu-item").forEach((it) => {
          it.onclick = () => { closeMenus(); onPick(it.dataset.type); };
        });
      };
      input.oninput = draw;
      input.onkeydown = (e) => {
        if (e.key === "Enter") { const first = list.querySelector(".bvs-menu-item"); if (first) first.click(); }
        if (e.key === "Escape") { e.stopPropagation(); closeMenus(); }
      };
      draw();
      setTimeout(() => input.focus(), 10);
    }

    function openNodeMenu(clientX, clientY, id) {
      closeMenus();
      const menu = document.createElement("div");
      menu.className = "bvs-menu bvs-menu-small";
      const isStart = id === START_ID;
      menu.innerHTML = `
        ${isStart ? "" : `<div class="bvs-menu-item" data-a="dup">${icon("copy", 14)} Duplicate</div>`}
        <div class="bvs-menu-item" data-a="disconnect">${icon("x", 14)} Disconnect wires</div>
        ${isStart ? "" : `<div class="bvs-menu-item danger" data-a="delete">${icon("trash", 14)} Delete</div>`}`;
      root.appendChild(menu);
      const rr = root.getBoundingClientRect();
      menu.style.left = clientX - rr.left + "px";
      menu.style.top = clientY - rr.top + "px";
      menu.querySelectorAll("[data-a]").forEach((it) => {
        it.onclick = () => {
          closeMenus();
          if (it.dataset.a === "dup") duplicateNode(id);
          if (it.dataset.a === "delete") deleteNode(id);
          if (it.dataset.a === "disconnect") {
            graph.wires = graph.wires.filter((w) => w.from !== id && w.to !== id);
            renderAll();
            commit();
          }
        };
      });
    }

    // ---------------------------------------------------------------- interactions
    let drag = null; // {kind:"node"|"pan"|"wire", ...}

    on(stage, "mousedown", (e) => {
      closeMenus();
      stage.focus({ preventScroll: true });
      const pin = e.target.closest(".bvs-pin");
      const nodeEl = e.target.closest(".bvs-node");
      if (e.button === 1 || (e.button === 0 && !nodeEl && !e.target.closest(".bvs-wire-hit") && !e.target.closest(".bvs-toolbar"))) {
        drag = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
        stage.classList.add("panning");
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      if (pin && nodeEl) {
        e.stopPropagation();
        e.preventDefault();
        const id = nodeEl.dataset.id;
        if (pin.dataset.pin === "in") {
          // Grab an existing incoming wire (re-route it) or start a reverse wire.
          const existing = [...graph.wires].reverse().find((w) => w.to === id);
          if (existing) {
            graph.wires = graph.wires.filter((w) => w !== existing);
            drag = { kind: "wire", from: existing.from, fromPin: existing.fromPin };
            markConnectedPins();
          } else {
            drag = { kind: "wire-rev", to: id };
          }
        } else {
          drag = { kind: "wire", from: id, fromPin: pin.dataset.pin };
        }
        stage.classList.add("wiring");
        return;
      }
      if (nodeEl && (e.target.closest(".bvs-node-header") || e.target.closest(".bvs-node-summary") || e.target.closest(".bvs-node-detached"))) {
        const node = nodeById(nodeEl.dataset.id);
        const w = toWorld(e.clientX, e.clientY);
        drag = { kind: "node", node, el: nodeEl, ox: w.x - node.x, oy: w.y - node.y, moved: false };
        select({ kind: "node", id: node.id });
        e.preventDefault();
      } else if (nodeEl) {
        select({ kind: "node", id: nodeEl.dataset.id });
      }
    });

    on(svg, "mousedown", (e) => {
      const hit = e.target.closest(".bvs-wire-hit");
      if (hit) {
        e.stopPropagation();
        select({ kind: "wire", id: Number(hit.dataset.wire) });
      }
    });
    on(svg, "dblclick", (e) => {
      const hit = e.target.closest(".bvs-wire-hit");
      if (hit) {
        graph.wires.splice(Number(hit.dataset.wire), 1);
        selected = null;
        renderAll();
        commit();
      }
    });

    on(window, "mousemove", (e) => {
      if (!drag) return;
      if (drag.kind === "pan") {
        view.x = drag.vx + e.clientX - drag.sx;
        view.y = drag.vy + e.clientY - drag.sy;
        drag.moved = drag.moved || Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3;
        applyView();
      } else if (drag.kind === "node") {
        const w = toWorld(e.clientX, e.clientY);
        drag.node.x = Math.round((w.x - drag.ox) / 4) * 4;
        drag.node.y = Math.round((w.y - drag.oy) / 4) * 4;
        drag.el.style.left = drag.node.x + "px";
        drag.el.style.top = drag.node.y + "px";
        drag.moved = true;
        drawWires();
      } else if (drag.kind === "wire" || drag.kind === "wire-rev") {
        const m = toWorld(e.clientX, e.clientY);
        if (drag.kind === "wire") drawWires({ a: pinPos(drag.from, drag.fromPin), b: m });
        else drawWires({ a: m, b: pinPos(drag.to, "in") });
      }
    });

    on(window, "mouseup", (e) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      stage.classList.remove("panning", "wiring");
      if (d.kind === "pan") {
        if (!d.moved && (e.target === stage || e.target.closest(".bvs-viewport") === viewport && !e.target.closest(".bvs-node"))) select(null);
        return;
      }
      if (d.kind === "node") {
        if (d.moved) commit();
        return;
      }
      if (d.kind === "wire" || d.kind === "wire-rev") {
        const pin = e.target.closest && e.target.closest(".bvs-pin");
        const nodeEl = e.target.closest && e.target.closest(".bvs-node");
        if (pin && nodeEl) {
          if (d.kind === "wire" && pin.dataset.pin === "in") return connect(d.from, d.fromPin, nodeEl.dataset.id);
          if (d.kind === "wire-rev" && pin.dataset.pin !== "in") return connect(nodeEl.dataset.id, pin.dataset.pin, d.to);
        } else if (nodeEl && d.kind === "wire" && nodeEl.dataset.id !== d.from && nodeEl.dataset.id !== START_ID) {
          return connect(d.from, d.fromPin, nodeEl.dataset.id); // dropped on a node body
        } else if (!nodeEl && e.target.closest && e.target.closest(".bvs-stage") === stage) {
          // Dropped on empty canvas: pick a block to create & connect.
          const pos = toWorld(e.clientX, e.clientY);
          openAddMenu(e.clientX, e.clientY, (type) => {
            if (d.kind === "wire") {
              const n = addNode(type, pos.x, pos.y - 20);
              connect(d.from, d.fromPin, n.id);
              select({ kind: "node", id: n.id });
            } else {
              const n = addNode(type, pos.x - NODE_W, pos.y - 20);
              if (outputsOf(type).includes("next")) connect(n.id, "next", d.to);
              select({ kind: "node", id: n.id });
            }
          });
        }
        renderNodes();
        drawWires();
        commit();
      }
    });

    on(stage, "wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
      } else {
        view.x -= e.deltaX;
        applyView();
      }
    }, { passive: false });

    on(stage, "contextmenu", (e) => {
      e.preventDefault();
      const nodeEl = e.target.closest(".bvs-node");
      if (nodeEl) {
        select({ kind: "node", id: nodeEl.dataset.id });
        return openNodeMenu(e.clientX, e.clientY, nodeEl.dataset.id);
      }
      const pos = toWorld(e.clientX, e.clientY);
      openAddMenu(e.clientX, e.clientY, (type) => {
        const n = addNode(type, pos.x, pos.y);
        select({ kind: "node", id: n.id });
      });
    });

    on(stage, "dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    on(stage, "drop", (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/x-bvs-block");
      if (!type) return;
      const pos = toWorld(e.clientX, e.clientY);
      const n = addNode(type, pos.x - NODE_W / 2, pos.y - 20);
      // Auto-connect to the selected node's free "next" output for fast building.
      const sel = selected && selected.kind === "node" ? nodeById(selected.id) : null;
      if (sel && outputsOf(sel.type).includes("next") && !graph.wires.some((w) => w.from === sel.id && w.fromPin === "next")) {
        connect(sel.id, "next", n.id);
      }
      select({ kind: "node", id: n.id });
    });

    on(stage, "keydown", (e) => {
      if (e.target.closest("input, textarea, select")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        if (selected.kind === "node") deleteNode(selected.id);
        else if (selected.kind === "wire") {
          graph.wires.splice(selected.id, 1);
          selected = null;
          renderAll();
          commit();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selected && selected.kind === "node") {
        e.preventDefault();
        duplicateNode(selected.id);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    });

    root.querySelector('[data-act="zoom-in"]').onclick = () => { zoomAt(1.2); drawWires(); };
    root.querySelector('[data-act="zoom-out"]').onclick = () => { zoomAt(1 / 1.2); drawWires(); };
    root.querySelector('[data-act="fit"]').onclick = () => fit();
    root.querySelector('[data-act="layout"]').onclick = autoLayout;
    root.querySelector('[data-act="undo"]').onclick = undo;
    root.querySelector('[data-act="redo"]').onclick = redo;

    const ro = new ResizeObserver(() => drawWires());
    ro.observe(stage);

    renderPalette();
    applyView();
    renderAll();
    if (!opts.graph || !opts.graph.view) setTimeout(() => fit(true), 60);

    return {
      compile,
      getGraph: () => ({ nodes: clone(graph.nodes), wires: clone(graph.wires), view: { ...view } }),
      issues: () => {
        const reach = reachable();
        return graph.nodes.flatMap((n) => [...issuesFor(n), ...(reach.has(n.id) ? [] : ["not connected"])].map((m) => ({ node: n.id, msg: m })));
      },
      setTrigger: (t) => { opts.trigger = t; renderAll(); },
      setVariables: (vars) => { opts.variables = vars; renderInspector(); },
      setEngine: (engine) => { opts.engine = engine; renderPalette(); renderAll(); },
      destroy: () => { ac.abort(); ro.disconnect(); closeMenus(); },
    };
  }

  window.BVSEditor = { mount, actionsToGraph };
})();
