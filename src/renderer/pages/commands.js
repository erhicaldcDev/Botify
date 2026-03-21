const LOGIC_BLOCKS = [
  { type: "send_message", label: "Send Message", icon: "💬" },
  { type: "reply", label: "Reply", icon: "↩️" },
  { type: "add_role", label: "Add Role", icon: "🛡️" },
  { type: "remove_role", label: "Remove Role", icon: "🚫" },
  { type: "kick_member", label: "Kick Member", icon: "👢" },
  { type: "ban_member", label: "Ban Member", icon: "🔨" },
  { type: "create_embed", label: "Create Embed", icon: "📋" },
  { type: "if_condition", label: "If Condition", icon: "❓" },
  { type: "set_variable", label: "Variable", icon: "📦" },
  { type: "mention_user", label: "Mention User", icon: "@" },
  { type: "mention_role", label: "Mention Role", icon: "🏷️" },
  { type: "mention_channel", label: "Mention Channel", icon: "#" },
  { type: "set_status", label: "Set Status", icon: "🎭" },
  { type: "api_request", label: "API Request", icon: "🌐" },
  { type: "db_read", label: "DB Read", icon: "📖" },
  { type: "db_write", label: "DB Write", icon: "✏️" },
  { type: "check_permission", label: "Check Permission", icon: "🔒" },
  { type: "has_role", label: "Has Role", icon: "👤" },
  { type: "cooldown", label: "User Cooldown", icon: "⏳" },
  { type: "get_user_info", label: "Get Member Info", icon: "🆔" },
  { type: "delete_message", label: "Delete Message", icon: "🗑️" },
  { type: "send_dm", label: "Send DM", icon: "📩" },
  { type: "add_reaction", label: "Add Reaction", icon: "😀" },
  { type: "random_chance", label: "Random Chance", icon: "🎲" },
];

function renderCommands(el) {
  if (!AppState.currentProject) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div></div>';
    return;
  }
  const commands = AppState.currentProject.commands || [];
  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Commands</h1><p class="page-subtitle">Visual command builder</p></div>
      <button class="btn btn-primary" id="add-cmd-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Command
      </button>
    </div>
    <div class="command-list" id="cmd-list">
      ${commands.length === 0 ? '<div class="empty-state"><div class="empty-state-title">No commands</div><div class="empty-state-text">Add slash or prefix commands</div></div>' :
      commands.map((cmd, i) => `
        <div class="command-item" data-index="${i}">
          <div class="command-info">
            <span class="tag ${cmd.type === "slash" ? "tag-slash" : "tag-prefix"}">${cmd.type}</span>
            <div>
              <div class="command-name">${cmd.type === "slash" ? "/" : AppState.currentProject.prefix}${cmd.name}</div>
              <div class="command-desc">${cmd.description || "No description"}</div>
            </div>
          </div>
          <div class="command-actions">
            <button class="btn btn-secondary btn-sm cmd-edit" data-index="${i}">Edit</button>
            <button class="btn btn-danger btn-sm cmd-delete" data-index="${i}">Delete</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  el.querySelector("#add-cmd-btn").onclick = () => showCommandEditor();

  el.querySelectorAll(".cmd-edit").forEach((btn) => {
    btn.onclick = (e) => { e.stopPropagation(); showCommandEditor(parseInt(btn.dataset.index)); };
  });

  el.querySelectorAll(".cmd-delete").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      AppState.currentProject.commands.splice(parseInt(btn.dataset.index), 1);
      await saveProject();
      renderCommands(el);
      showToast("Command deleted", "success");
    };
  });
}

function showCommandEditor(editIndex) {
  const isEdit = editIndex !== undefined;
  const cmd = isEdit ? JSON.parse(JSON.stringify(AppState.currentProject.commands[editIndex])) : {
    type: "slash", name: "", description: "", permissions: [], cooldown: 0, arguments: [], actions: [],
  };
  if (!cmd.actions) cmd.actions = [];
  if (!cmd.arguments) cmd.arguments = [];

  
  let nodes = [];
  let wires = [];
  let canvasOffset = { x: 0, y: 0 };
  let isDraggingCanvas = false;
  let activeWire = null;

  
  function deserializeActions(actions, startX = 50, startY = 100) {
    const createdNodes = [];

    function processList(actionList, x, y) {
      let lastNode = null;
      let firstNodeInList = null;
      actionList.forEach((action, i) => {
        const actionData = { ...action };
        
        if (action.type === "if_condition") {
          delete actionData.then;
          delete actionData.else;
        }
        const node = {
          id: crypto.randomUUID(),
          type: action.type,
          data: actionData,
          x: x + (i * 280),
          y: y,
          inputs: ["in"],
          outputs: action.type === "if_condition" ? ["then", "else"] : ["next"]
        };
        createdNodes.push(node);
        if (i === 0) firstNodeInList = node;
        if (lastNode) {
          wires.push({ from: lastNode.id, fromPin: "next", to: node.id, toPin: "in" });
        }
        lastNode = node;

        if (action.type === "if_condition") {
          if (action.then && action.then.length > 0) {
            const firstThen = processList(action.then, x + (i * 280) + 280, y - 150);
            if (firstThen) wires.push({ from: node.id, fromPin: "then", to: firstThen.id, toPin: "in" });
          }
          if (action.else && action.else.length > 0) {
            const firstElse = processList(action.else, x + (i * 280) + 280, y + 150);
            if (firstElse) wires.push({ from: node.id, fromPin: "else", to: firstElse.id, toPin: "in" });
          }
        }
      });
      return firstNodeInList;
    }

    processList(actions, startX, startY);
    nodes = createdNodes;
  }

  deserializeActions(cmd.actions);

  showModal(`
    <style>
      .modal-container { max-width: 95vw !important; width: 95vw; height: 90vh; display: flex; flex-direction: column; padding: 0 !important; overflow: hidden !important; }
      .bvs-header { padding: 15px 25px; border-bottom: 1px solid var(--border-medium); display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary); }
      .bvs-split { flex: 1; display: flex; overflow: hidden; }
      .bvs-sidebar { width: 300px; padding: 20px; border-right: 1px solid var(--border-medium); overflow-y: auto; background: var(--bg-secondary); }
      .bvs-workspace { flex: 1; position: relative; overflow: hidden; background: #0b0c11; }
    </style>
    <div class="bvs-header">
      <div class="flex items-center gap-md">
        <h2 class="modal-title" style="margin:0">${isEdit ? "Edit" : "New"} Command (BVS Editor)</h2>
        <div class="tag tag-slash">BVS Visual Mode</div>
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary" id="cmd-cancel">Cancel</button>
        <button class="btn btn-primary" id="cmd-save">Compile & Save</button>
      </div>
    </div>
    <div class="bvs-split">
      <div class="bvs-sidebar">
        <div class="input-group">
          <label class="input-label">Command Name</label>
          <input class="input" id="cmd-name" value="${cmd.name}" placeholder="e.g. kick-member" />
        </div>
        <div class="grid-2">
            <div class="input-group">
                <label class="input-label">Type</label>
                <select class="input" id="cmd-type"><option value="slash" ${cmd.type === "slash" ? "selected" : ""}>Slash</option><option value="prefix" ${cmd.type === "prefix" ? "selected" : ""}>Prefix</option></select>
            </div>
            <div class="input-group">
                <label class="input-label">Cooldown</label>
                <input class="input" type="number" id="cmd-cooldown" value="${cmd.cooldown || 0}" />
            </div>
        </div>
        <div class="section mt-md">
          <div class="section-title">Logic Palette (Drag nodes)</div>
          <div class="logic-blocks" style="border:none; padding:0; background:none" id="logic-palette">
            ${LOGIC_BLOCKS.map(b => `<div class="logic-block" draggable="true" data-type="${b.type}"><span class="logic-block-icon">${b.icon}</span>${b.label}</div>`).join("")}
          </div>
        </div>
        <div class="section mt-md">
           <div class="section-title">Arguments</div>
           <div id="cmd-args-list"></div>
           <button class="btn btn-ghost btn-sm mt-sm" id="add-arg-btn" style="width:100%">+ Add Argument</button>
        </div>
      </div>
      <div class="bvs-workspace" id="bvs-workspace">
        <div class="bvs-canvas" id="bvs-canvas">
          <svg class="bvs-connections" id="bvs-svg"></svg>
          <div id="bvs-nodes-container"></div>
        </div>
        <div class="bvs-overlay">
          <div class="status-indicator"><div class="status-dot running"></div> Visual Logic Active</div>
        </div>
      </div>
    </div>
  `, (container) => {
    const canvas = container.querySelector("#bvs-canvas");
    const svg = container.querySelector("#bvs-svg");
    const nodesContainer = container.querySelector("#bvs-nodes-container");
    const argsList = container.querySelector("#cmd-args-list");
    let args = [...cmd.arguments];

    
    const bvsAbort = new AbortController();

    function renderArgs() {
      argsList.innerHTML = args.map((a, i) => `
                <div class="flex items-center gap-sm mb-md card" style="padding:10px; border-radius:8px">
                    <input class="input" value="${a.name}" placeholder="name" data-i="${i}" data-f="name" style="flex:1; padding:5px 8px; font-size:12px"/>
                    <button class="btn btn-danger btn-sm arg-remove" data-i="${i}" style="padding:4px 8px">×</button>
                </div>
            `).join("");
      argsList.querySelectorAll("input").forEach(inp => {
        inp.onchange = () => { args[inp.dataset.i][inp.dataset.f] = inp.value; };
      });
      argsList.querySelectorAll(".arg-remove").forEach(btn => {
        btn.onclick = () => { args.splice(parseInt(btn.dataset.i), 1); renderArgs(); };
      });
    }
    renderArgs();

    container.querySelector("#add-arg-btn").onclick = () => {
      args.push({ name: "arg" + args.length, type: "string" });
      renderArgs();
    };

    
    container.querySelectorAll("#logic-palette .logic-block").forEach(block => {
      block.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", block.dataset.type);
        e.dataTransfer.effectAllowed = "copy";
      });
    });

    function drawWires() {
      svg.innerHTML = "";
      wires.forEach(w => {
        const fromNode = nodes.find(n => n.id === w.from);
        const toNode = nodes.find(n => n.id === w.to);
        if (!fromNode || !toNode) return;

        const x1 = fromNode.x + 240;
        const y1 = fromNode.y + 40 + (fromNode.outputs.indexOf(w.fromPin) * 30);
        const x2 = toNode.x;
        const y2 = toNode.y + 40;

        const cp1x = x1 + (x2 - x1) / 2;
        const cp2x = x1 + (x2 - x1) / 2;

        const pathD = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;

        const shadow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        shadow.setAttribute("d", pathD);
        shadow.setAttribute("class", "bvs-wire-shadow");
        svg.appendChild(shadow);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.setAttribute("d", pathD);
        line.setAttribute("class", "bvs-wire");
        svg.appendChild(line);
      });
    }

    
    let draggingNodeState = null;

    
    window.addEventListener("mousemove", (e) => {
      if (draggingNodeState) {
        const { node, nodeEl, startPos } = draggingNodeState;
        node.x = e.clientX - startPos.x;
        node.y = e.clientY - startPos.y;
        nodeEl.style.left = node.x + "px";
        nodeEl.style.top = node.y + "px";
        drawWires();
      }
    }, { signal: bvsAbort.signal });

    window.addEventListener("mouseup", () => {
      if (draggingNodeState) {
        draggingNodeState.nodeEl.style.zIndex = 10;
        draggingNodeState = null;
      }
      activeWire = null;
    }, { signal: bvsAbort.signal });

    function renderNodes() {
      nodesContainer.innerHTML = "";
      nodes.forEach(node => {
        const block = LOGIC_BLOCKS.find(b => b.type === node.type) || { icon: "⚡", label: node.type };
        const nodeEl = document.createElement("div");
        nodeEl.className = `bvs-node bvs-node-color-${node.type === "if_condition" ? "logic" : node.type.includes("variable") ? "var" : "action"}`;
        nodeEl.style.left = node.x + "px";
        nodeEl.style.top = node.y + "px";
        nodeEl.id = `node-${node.id}`;

        nodeEl.innerHTML = `
                    <div class="bvs-node-header">
                        <span>${block.icon}</span>
                        <div class="bvs-node-title">${block.label}</div>
                    </div>
                    <div class="bvs-node-content">
                        <div class="bvs-row">
                            <div class="bvs-pin-container">
                                <div class="bvs-pin bvs-pin-exec" data-node="${node.id}" data-pin="in" data-type="input"></div>
                                <span>In</span>
                            </div>
                            <div class="bvs-pin-container">
                                <span>Out</span>
                                <div class="bvs-pin bvs-pin-exec" data-node="${node.id}" data-pin="next" data-type="output"></div>
                            </div>
                        </div>
                        ${node.type === "if_condition" ? `
                            <div class="bvs-row">
                                <div class="bvs-pin-container"></div>
                                <div class="bvs-pin-container">
                                    <span>True</span>
                                    <div class="bvs-pin bvs-pin-exec" data-node="${node.id}" data-pin="then" data-type="output"></div>
                                </div>
                            </div>
                            <div class="bvs-row">
                                <div class="bvs-pin-container"></div>
                                <div class="bvs-pin-container">
                                    <span>False</span>
                                    <div class="bvs-pin bvs-pin-exec" data-node="${node.id}" data-pin="else" data-type="output"></div>
                                </div>
                            </div>
                        ` : ""}
                        <button class="btn btn-ghost btn-sm node-config" style="width:100%; margin-top:5px">Configure</button>
                        <button class="btn btn-danger btn-sm node-delete" style="width:100%; margin-top:2px; font-size:11px">Remove</button>
                    </div>
                `;

        
        nodeEl.querySelector(".bvs-node-header").onmousedown = (e) => {
          draggingNodeState = {
            node,
            nodeEl,
            startPos: { x: e.clientX - node.x, y: e.clientY - node.y }
          };
          nodeEl.style.zIndex = 1000;
          e.preventDefault();
        };

        nodeEl.querySelector(".node-config").onclick = () => configureAction(node);
        nodeEl.querySelector(".node-delete").onclick = () => {
          nodes = nodes.filter(n => n.id !== node.id);
          wires = wires.filter(w => w.from !== node.id && w.to !== node.id);
          renderNodes();
        };

        nodesContainer.appendChild(nodeEl);
      });
      drawWires();
      setupPins();
    }

    function setupPins() {
      container.querySelectorAll(".bvs-pin").forEach(pin => {
        pin.onmousedown = (e) => {
          e.stopPropagation();
          const nodeId = pin.dataset.node;
          const pinId = pin.dataset.pin;
          const type = pin.dataset.type;

          activeWire = { fromNode: nodeId, fromPin: pinId, type: type };
        };

        pin.onmouseup = (e) => {
          if (activeWire && activeWire.fromNode !== pin.dataset.node) {
            if (activeWire.type === "output" && pin.dataset.type === "input") {
              wires = wires.filter(w => !(w.to === pin.dataset.node && w.toPin === pin.dataset.pin));
              wires.push({ from: activeWire.fromNode, fromPin: activeWire.fromPin, to: pin.dataset.node, toPin: pin.dataset.pin });
            } else if (activeWire.type === "input" && pin.dataset.type === "output") {
              wires = wires.filter(w => !(w.from === pin.dataset.node && w.fromPin === pin.dataset.pin));
              wires.push({ from: pin.dataset.node, fromPin: pin.dataset.pin, to: activeWire.fromNode, toPin: activeWire.fromPin });
            }
            drawWires();
          }
          activeWire = null;
        };
      });
    }

    function configureAction(node) {
      const block = LOGIC_BLOCKS.find(b => b.type === node.type);
      let fields = getActionFields(node.data);

      
      const existing = container.querySelector(".bvs-config-overlay");
      if (existing) existing.remove();

      
      const overlay = document.createElement("div");
      overlay.className = "bvs-config-overlay";
      overlay.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:500;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-xl);";

      const panel = document.createElement("div");
      panel.style.cssText = "background:var(--bg-secondary);border:1px solid var(--border-medium);border-radius:var(--radius-lg);padding:24px;min-width:400px;max-width:520px;max-height:70vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,0.5);animation:scaleIn 0.2s ease;";
      panel.innerHTML = `
        <h2 class="modal-title">Configure: ${block ? block.label : node.type}</h2>
        <div class="card" style="padding:20px">${fields}</div>
        <div class="modal-actions">
            <button class="btn btn-secondary" id="action-conf-cancel">Cancel</button>
            <button class="btn btn-primary" id="action-conf-save">Apply Settings</button>
        </div>
      `;
      overlay.appendChild(panel);

      
      const modalContainer = container.closest(".modal-container") || container;
      modalContainer.style.position = "relative";
      modalContainer.appendChild(overlay);

      
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });

      panel.querySelector("#action-conf-cancel").onclick = () => overlay.remove();
      panel.querySelector("#action-conf-save").onclick = () => {
        panel.querySelectorAll("[data-field]").forEach(inp => {
          const field = inp.dataset.field;
          if (field.includes('.')) {
            const [p1, p2] = field.split('.');
            if (!node.data[p1]) node.data[p1] = {};
            node.data[p1][p2] = inp.value;
          } else {
            node.data[field] = inp.value;
          }
        });
        overlay.remove();
        showToast("Node settings applied", "success");
      };
    }

    
    canvas.ondragover = (e) => e.preventDefault();
    canvas.ondrop = (e) => {
      const type = e.dataTransfer.getData("text/plain");
      if (type) {
        const rect = canvas.getBoundingClientRect();
        const node = {
          id: crypto.randomUUID(),
          type: type,
          data: createDefaultAction(type),
          x: e.clientX - rect.left - 100,
          y: e.clientY - rect.top - 20,
          inputs: ["in"],
          outputs: type === "if_condition" ? ["then", "else"] : ["next"]
        };
        nodes.push(node);
        renderNodes();
      }
    };

    renderNodes();

    container.querySelector("#cmd-cancel").onclick = () => { bvsAbort.abort(); hideModal(); };
    container.querySelector("#cmd-save").onclick = async () => {
      const name = container.querySelector("#cmd-name").value.trim().toLowerCase().replace(/\s+/g, "-");
      if (!name) { showToast("Enter a command name", "warning"); return; }

      
      
      const getIncoming = (id) => wires.filter(w => w.to === id);
      const roots = nodes.filter(n => getIncoming(n.id).length === 0);
      const root = roots[0] || nodes[0];

      function serialize(nodeId, visited = new Set()) {
        if (!nodeId || visited.has(nodeId)) return [];
        visited.add(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return [];

        const action = { ...node.data };

        if (node.type === "if_condition") {
          const thenWire = wires.find(w => w.from === nodeId && w.fromPin === "then");
          const elseWire = wires.find(w => w.from === nodeId && w.fromPin === "else");
          action.then = serialize(thenWire ? thenWire.to : null, new Set(visited));
          action.else = serialize(elseWire ? elseWire.to : null, new Set(visited));
        }

        const nextWire = wires.find(w => w.from === nodeId && w.fromPin === "next");
        const nextActions = serialize(nextWire ? nextWire.to : null, visited);

        return [action, ...nextActions];
      }

      const finalActions = serialize(root ? root.id : null);

      const data = {
        type: container.querySelector("#cmd-type").value,
        name,
        description: "Compiled BVS Logic",
        cooldown: parseInt(container.querySelector("#cmd-cooldown").value) || 0,
        permissions: [],
        arguments: args,
        actions: finalActions,
      };

      if (isEdit) AppState.currentProject.commands[editIndex] = data;
      else AppState.currentProject.commands.push(data);

      await saveProject();
      bvsAbort.abort();
      hideModal();
      renderCommands(document.getElementById("page-commands"));
      showToast("Success: Visual Logic Compiled", "success");
    };
  });
}

function createDefaultAction(type) {
  const defaults = {
    send_message: { type, content: "Hello!" },
    reply: { type, content: "Reply!" },
    add_role: { type, roleId: "" },
    remove_role: { type, roleId: "" },
    kick_member: { type, reason: "Kicked" },
    ban_member: { type, reason: "Banned" },
    create_embed: { type, embed: { title: "Embed", description: "", color: "#7c6aef", fields: [], footer: "" } },
    if_condition: { type, condition: "true", then: [], else: [] },
    set_variable: { type, name: "myVar", value: "" },
    mention_user: { type, userId: "${interaction.user.id}", saveTo: "mention" },
    mention_role: { type, roleId: "", saveTo: "mention" },
    mention_channel: { type, channelId: "${interaction.channel.id}", saveTo: "mention" },
    set_status: { type, text: "Watching you", statusType: "WATCHING", status: "online" },
    api_request: { type, url: "https://api.example.com", method: "GET" },
    db_read: { type, query: "SELECT * FROM data" },
    db_write: { type, query: "INSERT INTO data (key, value) VALUES (?, ?)", params: [] },
  };
  return defaults[type] || { type };
}

function getActionFields(action) {
  switch (action.type) {
    case "send_message":
    case "reply":
      return `<div class="input-group"><label class="input-label">Content</label><textarea class="input" data-field="content">${action.content || ""}</textarea></div>`;
    case "add_role":
    case "remove_role":
      return `<div class="input-group"><label class="input-label">Role ID</label><input class="input" data-field="roleId" value="${action.roleId || ""}" /></div>`;
    case "kick_member":
    case "ban_member":
      return `<div class="input-group"><label class="input-label">Reason</label><input class="input" data-field="reason" value="${action.reason || ""}" /></div>`;
    case "set_variable":
      return `<div class="input-group"><label class="input-label">Variable Name</label><input class="input" data-field="name" value="${action.name || ""}" /></div>
              <div class="input-group"><label class="input-label">Value</label><input class="input" data-field="value" value="${action.value || ""}" /></div>`;
    case "mention_user":
      return `<div class="input-group"><label class="input-label">User ID (or use \${...})</label><input class="input" data-field="userId" value="${action.userId || ""}" /></div>
              <div class="input-group"><label class="input-label">Save To Variable</label><input class="input" data-field="saveTo" value="${action.saveTo || "mention"}" /></div>`;
    case "mention_role":
      return `<div class="input-group"><label class="input-label">Role ID</label><input class="input" data-field="roleId" value="${action.roleId || ""}" /></div>
              <div class="input-group"><label class="input-label">Save To Variable</label><input class="input" data-field="saveTo" value="${action.saveTo || "mention"}" /></div>`;
    case "mention_channel":
      return `<div class="input-group"><label class="input-label">Channel ID</label><input class="input" data-field="channelId" value="${action.channelId || ""}" /></div>
              <div class="input-group"><label class="input-label">Save To Variable</label><input class="input" data-field="saveTo" value="${action.saveTo || "mention"}" /></div>`;
    case "set_status":
      return `<div class="input-group"><label class="input-label">Status Text</label><input class="input" data-field="text" value="${action.text || ""}" /></div>
              <div class="input-group"><label class="input-label">Activity Type</label>
                <select class="input" data-field="statusType">
                  <option value="PLAYING" ${action.statusType === "PLAYING" ? "selected" : ""}>Playing</option>
                  <option value="STREAMING" ${action.statusType === "STREAMING" ? "selected" : ""}>Streaming</option>
                  <option value="LISTENING" ${action.statusType === "LISTENING" ? "selected" : ""}>Listening</option>
                  <option value="WATCHING" ${action.statusType === "WATCHING" ? "selected" : ""}>Watching</option>
                  <option value="COMPETING" ${action.statusType === "COMPETING" ? "selected" : ""}>Competing</option>
                </select></div>
              <div class="input-group"><label class="input-label">Status</label>
                <select class="input" data-field="status">
                  <option value="online" ${action.status === "online" ? "selected" : ""}>Online</option>
                  <option value="idle" ${action.status === "idle" ? "selected" : ""}>Idle</option>
                  <option value="dnd" ${action.status === "dnd" ? "selected" : ""}>DND</option>
                  <option value="invisible" ${action.status === "invisible" ? "selected" : ""}>Invisible</option>
                </select></div>`;
    case "api_request":
      return `<div class="input-group"><label class="input-label">URL</label><input class="input" data-field="url" value="${action.url || ""}" /></div>
              <div class="input-group"><label class="input-label">Method</label><select class="input" data-field="method"><option value="GET" ${action.method === "GET" ? "selected" : ""}>GET</option><option value="POST" ${action.method === "POST" ? "selected" : ""}>POST</option></select></div>`;
    case "db_read":
    case "db_write":
      return `<div class="input-group"><label class="input-label">Query</label><input class="input" data-field="query" value="${action.query || ""}" /></div>`;
    case "if_condition":
      return `<div class="input-group"><label class="input-label">Condition</label><input class="input" data-field="condition" value="${action.condition || "true"}" /></div>`;
    case "create_embed":
      return `<div class="input-group"><label class="input-label">Title</label><input class="input" data-field="embed.title" value="${(action.embed && action.embed.title) || ""}" /></div>
              <div class="input-group"><label class="input-label">Description</label><textarea class="input" data-field="embed.description">${(action.embed && action.embed.description) || ""}</textarea></div>`;
    case "check_permission":
      return `<div class="input-group"><label class="input-label">Permission</label>
              <select class="input" data-field="permission">
                <option value="Administrator" ${action.permission === "Administrator" ? "selected" : ""}>Administrator</option>
                <option value="ManageMessages" ${action.permission === "ManageMessages" ? "selected" : ""}>Manage Messages</option>
                <option value="BanMembers" ${action.permission === "BanMembers" ? "selected" : ""}>Ban Members</option>
                <option value="KickMembers" ${action.permission === "KickMembers" ? "selected" : ""}>Kick Members</option>
                <option value="ModerateMembers" ${action.permission === "ModerateMembers" ? "selected" : ""}>Timeout Members</option>
              </select></div>`;
    case "has_role":
      return `<div class="input-group"><label class="input-label">Role ID</label><input class="input" data-field="roleId" value="${action.roleId || ""}" /></div>`;
    case "cooldown":
      return `<div class="input-group"><label class="input-label">Time (seconds)</label><input class="input" type="number" data-field="time" value="${action.time || 5}" /></div>`;
    case "get_user_info":
      return `<div class="input-group"><label class="input-label">Store In Variable</label><input class="input" data-field="saveTo" value="${action.saveTo || "userInfo"}" /></div>`;
    case "send_dm":
      return `<div class="input-group"><label class="input-label">Content</label><textarea class="input" data-field="content">${action.content || ""}</textarea></div>`;
    case "add_reaction":
      return `<div class="input-group"><label class="input-label">Emoji (ID or Unicode)</label><input class="input" data-field="emoji" value="${action.emoji || "✅"}" /></div>`;
    case "random_chance":
      return `<div class="input-group"><label class="input-label">Chance Percentage (1-100)</label><input class="input" type="number" data-field="chance" value="${action.chance || 50}" /></div>`;
    case "delete_message":
      return `<p class="text-muted">Deletes the trigger message/interaction</p>`;
    default:
      return '<p class="text-muted">No configuration available</p>';
  }
}
