let consoleLines = [];
let errorLines = [];
let consoleRendered = false;

function addConsoleLine(event) {
    consoleLines.push(event);
    if (consoleLines.length > 500) consoleLines.shift();
    if (consoleRendered) appendConsoleLineToDOM(event, "console-output");

    
    if (event.type === 'error') {
        errorLines.push(event);
        if (errorLines.length > 100) errorLines.shift();
        if (consoleRendered) {
            appendConsoleLineToDOM(event, "console-errors");
            updateErrorBadge();
        }
    }
}

function handleDepsProgress(event) {
    if (event.type === "log" || event.type === "error") {
        addConsoleLine({ type: event.type === "error" ? "error" : "info", message: event.message, timestamp: new Date().toISOString() });
    }
    if (event.type === "progress") {
        const bar = document.getElementById("deps-progress-fill");
        if (bar) bar.style.width = event.value + "%";
    }
    if (event.type === "done") {
        addConsoleLine({ type: "info", message: event.message, timestamp: new Date().toISOString() });
        showToast("Dependencies installed", "success");
    }
}

function appendConsoleLineToDOM(event, targetId = "console-output") {
    const output = document.getElementById(targetId);
    if (!output || !output.isConnected) return;
    const line = document.createElement("span");
    line.className = `console-line ${event.type}`;
    const ts = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "";
    line.textContent = `[${ts}] ${event.message}`;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

function updateErrorBadge() {
    const badge = document.getElementById("error-badge");
    if (!badge) return;
    if (errorLines.length > 0) {
        badge.style.display = "inline-block";
        badge.textContent = errorLines.length;
    } else {
        badge.style.display = "none";
    }
}

document.addEventListener('botify:generator_error', (e) => {
    addConsoleLine({ type: "error", message: "GENERATOR ERROR: " + e.detail, timestamp: new Date().toISOString() });
});

function renderConsole(el) {
    if (!AppState.currentProject) {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div></div>';
        return;
    }

    el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Live Console</h1><p class="page-subtitle">Bot process output</p></div>
      <div class="status-indicator">
        <div class="status-dot" id="console-status-dot"></div>
        <span id="console-status-text">Stopped</span>
      </div>
    </div>
    <div class="console-controls">
      <button class="btn btn-success btn-sm" id="con-start">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        Start
      </button>
      <button class="btn btn-danger btn-sm" id="con-stop">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        Stop
      </button>
      <button class="btn btn-secondary btn-sm" id="con-restart">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        Restart
      </button>
      <button class="btn btn-ghost btn-sm" id="con-clear">Clear</button>
      <button class="btn btn-secondary btn-sm" id="con-generate">Generate & Install</button>
    </div>
    
    <div style="display: flex; gap: 8px; margin-bottom: 8px; margin-top: 16px;">
        <div class="console-tab active" data-target="console-output" style="cursor: pointer; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 13px; color: var(--text-primary); border-bottom: 2px solid var(--primary); text-transform: uppercase;">Terminal Logs</div>
        <div class="console-tab" data-target="console-errors" style="cursor: pointer; padding: 6px 12px; border-radius: 4px; font-weight: 600; font-size: 13px; color: var(--text-muted); text-transform: uppercase;">Bot Errors <span id="error-badge" style="background: var(--error); color: white; border-radius: 12px; padding: 2px 6px; font-size: 10px; display: none;">0</span></div>
    </div>

    <div class="progress-bar" id="deps-progress" style="display:none">
      <div class="progress-bar-fill" id="deps-progress-fill"></div>
    </div>
    <div class="console-output" id="console-output"></div>
    <div class="console-output" id="console-errors" style="display:none; background: rgba(255,0,0,0.05);"></div>
  `;

    consoleRendered = true;
    const output = el.querySelector("#console-output");
    const errorsTarget = el.querySelector("#console-errors");
    consoleLines.forEach((line) => appendConsoleLineToDOM(line, "console-output"));
    errorLines.forEach((line) => appendConsoleLineToDOM(line, "console-errors"));

    updateErrorBadge();
    updateConsoleStatus();

    el.querySelectorAll(".console-tab").forEach(tab => {
        tab.onclick = () => {
            el.querySelectorAll(".console-tab").forEach(t => {
                t.classList.remove("active");
                t.style.borderBottom = "none";
                t.style.color = "var(--text-muted)";
            });
            tab.classList.add("active");
            tab.style.borderBottom = "2px solid var(--primary)";
            tab.style.color = "var(--text-primary)";

            el.querySelectorAll(".console-output").forEach(c => c.style.display = "none");
            el.querySelector("#" + tab.dataset.target).style.display = "block";
        };
    });

    el.querySelector("#con-start").onclick = async () => {
        addConsoleLine({ type: "info", message: "Starting bot...", timestamp: new Date().toISOString() });
        await window.api.engine.start(AppState.currentProject);
        setTimeout(updateConsoleStatus, 500);
    };

    el.querySelector("#con-stop").onclick = async () => {
        await window.api.engine.stop();
        addConsoleLine({ type: "info", message: "Bot stopped.", timestamp: new Date().toISOString() });
        setTimeout(updateConsoleStatus, 500);
    };

    el.querySelector("#con-restart").onclick = async () => {
        addConsoleLine({ type: "info", message: "Restarting bot...", timestamp: new Date().toISOString() });
        await window.api.engine.restart(AppState.currentProject);
        setTimeout(updateConsoleStatus, 500);
    };

    el.querySelector("#con-clear").onclick = () => {
        consoleLines = [];
        errorLines = [];
        output.innerHTML = "";
        errorsTarget.innerHTML = "";
        updateErrorBadge();
    };

    el.querySelector("#con-generate").onclick = async () => {
        addConsoleLine({ type: "info", message: "Generating code...", timestamp: new Date().toISOString() });
        try {
            await window.api.generate.code(AppState.currentProject);
            addConsoleLine({ type: "info", message: "Code generated. Installing dependencies...", timestamp: new Date().toISOString() });
            const progressBar = el.querySelector("#deps-progress");
            progressBar.style.display = "block";
            await window.api.deps.install(AppState.currentProject);
            progressBar.style.display = "none";
        } catch (err) {
            addConsoleLine({ type: "error", message: "Failed: " + err.message, timestamp: new Date().toISOString() });
        }
    };

    async function updateConsoleStatus() {
        const status = await window.api.engine.status();
        const dot = el.querySelector("#console-status-dot");
        const text = el.querySelector("#console-status-text");
        if (dot && text) {
            dot.className = `status-dot ${status.running ? "running" : "stopped"}`;
            text.textContent = status.running ? `Running (${status.engine})` : "Stopped";
        }
    }
}
