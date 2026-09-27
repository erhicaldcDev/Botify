/* Live console: bot process output, build warnings and dependency installs. */

let consoleLines = [];
const MAX_LINES = 2000;
const consoleState = { filter: "all", search: "", autoscroll: true };

function lineMatches(event) {
  const isErr = event.type === "error" || event.type === "stderr";
  if (consoleState.filter === "errors" && !isErr) return false;
  if (consoleState.filter === "warnings" && event.type !== "warn") return false;
  if (consoleState.search && !String(event.message).toLowerCase().includes(consoleState.search)) return false;
  return true;
}

function consoleLineEl(event) {
  const line = document.createElement("div");
  const isErr = event.type === "error" || event.type === "stderr";
  line.className = `console-line ${event.type}${isErr ? " is-error" : ""}`;
  const ts = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "";
  const time = document.createElement("span");
  time.className = "console-time";
  time.textContent = ts;
  const msg = document.createElement("span");
  msg.className = "console-msg";
  msg.textContent = event.message;
  // Make the invite link clickable.
  const invite = String(event.message).match(/https:\/\/discord\.com\/oauth2\/authorize\S+/);
  if (invite) {
    msg.textContent = event.message.replace(invite[0], "");
    const a = document.createElement("a");
    a.className = "console-link";
    a.textContent = "Invite bot to a server ↗";
    a.onclick = () => openExternal(invite[0]);
    msg.appendChild(a);
  }
  line.append(time, msg);
  return line;
}

function updateErrorBadge() {
  const count = consoleLines.filter((l) => l.type === "error" || l.type === "stderr").length;
  const nav = document.getElementById("nav-error-count");
  if (nav) {
    nav.textContent = count > 99 ? "99+" : count;
    nav.style.display = count ? "" : "none";
  }
  const tab = document.querySelector('[data-filter="errors"] .badge');
  if (tab) {
    tab.textContent = count;
    tab.style.display = count ? "" : "none";
  }
}

function addConsoleLine(event) {
  if (!event || event.message === undefined) return;
  consoleLines.push(event);
  if (consoleLines.length > MAX_LINES) consoleLines.splice(0, consoleLines.length - MAX_LINES);
  const out = document.getElementById("console-output");
  if (out && out.isConnected && lineMatches(event)) {
    out.querySelector(".console-empty")?.remove();
    out.appendChild(consoleLineEl(event));
    while (out.childElementCount > MAX_LINES) out.firstElementChild.remove();
    if (consoleState.autoscroll) out.scrollTop = out.scrollHeight;
  }
  updateErrorBadge();
}

function handleDepsProgress(event) {
  if (event.type === "log" || event.type === "error") {
    addConsoleLine({ type: event.type === "error" ? "error" : "info", message: event.message, timestamp: new Date().toISOString() });
  }
  const wrap = document.getElementById("deps-progress");
  const bar = document.getElementById("deps-progress-fill");
  if (event.type === "progress" && bar) {
    wrap.style.display = "block";
    bar.style.width = event.value + "%";
  }
  if (event.type === "done") {
    addConsoleLine({ type: "info", message: "✔ " + event.message, timestamp: new Date().toISOString() });
    showToast("Dependencies installed", "success");
  }
  if ((event.type === "done" || event.type === "error") && wrap) setTimeout(() => { wrap.style.display = "none"; }, 800);
}

function updateConsoleStatusPill() {
  const pill = document.querySelector('#page-console [data-el="pill"]');
  if (!pill) return;
  const { running, online } = AppState.bot;
  pill.className = "bot-pill " + (running ? (online ? "online" : "starting") : "");
  pill.innerHTML = `<span class="status-dot ${running ? (online ? "running" : "starting") : "stopped"}"></span> ${running ? (online ? "Online" : "Starting...") : "Offline"}`;
}
document.addEventListener("botify:status", updateConsoleStatusPill);

function renderConsole(el) {
  if (!AppState.currentProject) return noProjectState(el, "the console");

  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Console</h1><p class="page-subtitle">Live output from your bot, build warnings and install logs.</p></div>
      <div class="bot-pill" data-el="pill"></div>
    </div>
    <div class="console-controls">
      <button class="btn btn-success btn-sm" data-act="run">${icon("play", 13)} Build & run</button>
      <button class="btn btn-danger btn-sm" data-act="stop">${icon("stop", 13)} Stop</button>
      <button class="btn btn-secondary btn-sm" data-act="restart">${icon("restart", 14)} Restart</button>
      <span class="toolbar-sep"></span>
      <button class="btn btn-ghost btn-sm" data-act="generate">${icon("code", 14)} Generate code</button>
      <button class="btn btn-ghost btn-sm" data-act="install">${icon("download", 14)} Reinstall dependencies</button>
      <button class="btn btn-ghost btn-sm" data-act="folder">${icon("folder", 14)} Open folder</button>
    </div>
    <div class="progress-bar" id="deps-progress" style="display:none"><div class="progress-bar-fill" id="deps-progress-fill"></div></div>
    <div class="console-panel">
      <div class="console-toolbar">
        <div class="tabs tabs-sm">
          <button class="tab ${consoleState.filter === "all" ? "active" : ""}" data-filter="all">All</button>
          <button class="tab ${consoleState.filter === "errors" ? "active" : ""}" data-filter="errors">Errors <span class="badge badge-err" style="display:none"></span></button>
          <button class="tab ${consoleState.filter === "warnings" ? "active" : ""}" data-filter="warnings">Warnings</button>
        </div>
        <div class="search-box search-box-sm">${icon("search", 13)}<input class="input input-sm" data-el="search" placeholder="Filter output..." value="${escapeHtml(consoleState.search)}" /></div>
        <div class="flex-1"></div>
        <label class="toggle-row toggle-row-sm"><div class="toggle toggle-sm ${consoleState.autoscroll ? "active" : ""}" data-el="autoscroll"></div><span>Auto-scroll</span></label>
        <button class="icon-btn" data-act="copy" title="Copy output">${icon("copy", 15)}</button>
        <button class="icon-btn" data-act="clear" title="Clear">${icon("trash", 15)}</button>
      </div>
      <div class="console-output" id="console-output"></div>
    </div>`;

  const out = el.querySelector("#console-output");
  const redraw = () => {
    out.innerHTML = "";
    const lines = consoleLines.filter(lineMatches);
    if (!lines.length) {
      out.innerHTML = `<div class="console-empty">${consoleLines.length ? "No lines match the filter." : "No output yet. Click <b>Build & run</b> to start your bot."}</div>`;
    }
    const frag = document.createDocumentFragment();
    lines.forEach((l) => frag.appendChild(consoleLineEl(l)));
    out.appendChild(frag);
    out.scrollTop = out.scrollHeight;
    updateErrorBadge();
  };
  redraw();

  updateConsoleStatusPill();

  el.querySelectorAll("[data-filter]").forEach((tab) => {
    tab.onclick = () => {
      consoleState.filter = tab.dataset.filter;
      el.querySelectorAll("[data-filter]").forEach((t) => t.classList.toggle("active", t === tab));
      redraw();
    };
  });
  el.querySelector('[data-el="search"]').oninput = debounce((e) => { consoleState.search = e.target.value.toLowerCase(); redraw(); }, 150);
  el.querySelector('[data-el="autoscroll"]').onclick = (e) => {
    consoleState.autoscroll = !consoleState.autoscroll;
    e.currentTarget.classList.toggle("active", consoleState.autoscroll);
  };
  el.querySelector('[data-act="clear"]').onclick = () => { consoleLines = []; redraw(); };
  el.querySelector('[data-act="copy"]').onclick = async () => {
    const text = consoleLines.filter(lineMatches).map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}`).join("\n");
    try { await navigator.clipboard.writeText(text); showToast("Output copied", "success"); } catch { showToast("Clipboard unavailable", "error"); }
  };
  el.querySelector('[data-act="run"]').onclick = () => BotRunner.buildAndRun();
  el.querySelector('[data-act="stop"]').onclick = () => BotRunner.stop();
  el.querySelector('[data-act="restart"]').onclick = async () => {
    addConsoleLine({ type: "info", message: "Restarting bot...", timestamp: new Date().toISOString() });
    await window.api.engine.restart(AppState.currentProject);
    setTimeout(refreshBotStatus, 800);
  };
  el.querySelector('[data-act="generate"]').onclick = async () => {
    try {
      const r = await BotRunner.generate();
      addConsoleLine({ type: "info", message: `✔ Generated ${r.files.length} files in ${r.outputPath}`, timestamp: new Date().toISOString() });
    } catch (err) {
      addConsoleLine({ type: "error", message: "Generation failed: " + err.message, timestamp: new Date().toISOString() });
    }
  };
  el.querySelector('[data-act="install"]').onclick = async () => {
    try {
      await BotRunner.generate({ quiet: true });
      await BotRunner.install();
    } catch (err) {
      addConsoleLine({ type: "error", message: "Install failed: " + err.message, timestamp: new Date().toISOString() });
    }
  };
  el.querySelector('[data-act="folder"]').onclick = async () => {
    const paths = await window.api.app.getPath();
    const sep = paths.projects.includes("\\") ? "\\" : "/";
    window.api.shell.openPath([paths.projects, AppState.currentProject.id, "output"].join(sep)).catch((e) => showToast(e.message, "error"));
  };
}
