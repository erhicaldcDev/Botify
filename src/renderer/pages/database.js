/* Database: browse and edit the SQLite database your bot uses (output/data.db). */

function renderDatabase(el) {
  if (!AppState.currentProject) return noProjectState(el, "the database editor");
  const pid = AppState.currentProject.id;
  let current = el.dataset.table || null;

  el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Database</h1><p class="page-subtitle">The SQLite database your bot reads and writes (SQL blocks, Save/Load Data blocks).</p></div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary" data-act="refresh">${icon("restart", 14)} Refresh</button>
        <button class="btn btn-secondary" data-act="sql">${icon("code", 14)} Run SQL</button>
        <button class="btn btn-primary" data-act="add-table">${icon("plus", 15)} New table</button>
      </div>
    </div>
    <div class="db-layout">
      <aside class="db-tables" data-el="tables"></aside>
      <section class="db-view" data-el="view"></section>
    </div>`;

  const tablesEl = el.querySelector('[data-el="tables"]');
  const view = el.querySelector('[data-el="view"]');

  async function loadTables() {
    let tables = [];
    try {
      tables = await window.api.db.getTables(pid);
    } catch (err) {
      tablesEl.innerHTML = `<div class="notice notice-err notice-sm">${escapeHtml(err.message)}</div>`;
      return;
    }
    if (!tables.length) {
      tablesEl.innerHTML = '<div class="empty-state"><div class="empty-state-emoji">🗄️</div><div class="empty-state-title">No tables yet</div><div class="empty-state-text">They are created when your bot first uses a SQL / Save Data block, or add one here.</div></div>';
      view.innerHTML = "";
      return;
    }
    if (!current || !tables.some((t) => t.name === current)) current = tables[0].name;
    tablesEl.innerHTML = tables.map((t) => `
      <button class="db-table-item${t.name === current ? " active" : ""}" data-table="${escapeHtml(t.name)}">
        <span class="db-table-name">${escapeHtml(t.name)}</span>
        <span class="db-table-meta">${t.rowCount} rows • ${t.columns.length} cols</span>
      </button>`).join("");
    tablesEl.querySelectorAll("[data-table]").forEach((b) => {
      b.onclick = () => {
        current = b.dataset.table;
        el.dataset.table = current;
        tablesEl.querySelectorAll("[data-table]").forEach((x) => x.classList.toggle("active", x === b));
        viewTable(tables.find((t) => t.name === current));
      };
    });
    viewTable(tables.find((t) => t.name === current));
  }

  async function viewTable(table) {
    if (!table) return;
    let rows = [];
    try {
      rows = await window.api.db.getTableData(pid, table.name);
    } catch (err) {
      view.innerHTML = `<div class="notice notice-err">${escapeHtml(err.message)}</div>`;
      return;
    }
    const cols = table.columns;
    view.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(table.name)} <span class="text-muted text-sm">(${rows.length}${rows.length >= 1000 ? "+" : ""} rows)</span></div>
          <div class="flex gap-sm">
            <button class="btn btn-primary btn-sm" data-act="add-row">${icon("plus", 14)} Add row</button>
            <button class="btn btn-danger-ghost btn-sm" data-act="drop">${icon("trash", 14)} Drop table</button>
          </div>
        </div>
        ${rows.length === 0 ? '<p class="text-muted text-sm">No rows.</p>' : `
        <div class="table-wrapper">
          <table>
            <thead><tr>${cols.map((c) => `<th>${escapeHtml(c.name)}<small>${escapeHtml(c.type || "")}${c.pk ? " • PK" : ""}</small></th>`).join("")}<th></th></tr></thead>
            <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td title="${escapeHtml(r[c.name] ?? "")}">${r[c.name] === null || r[c.name] === undefined ? '<span class="text-muted">NULL</span>' : escapeHtml(String(r[c.name]).slice(0, 200))}</td>`).join("")}
              <td class="td-actions"><button class="icon-btn danger" data-rowid="${r.__rowid}" title="Delete row">${icon("trash", 14)}</button></td></tr>`).join("")}</tbody>
          </table>
        </div>`}
      </div>`;

    view.querySelector('[data-act="drop"]').onclick = async () => {
      if (!(await confirmDialog({ title: `Drop table "${table.name}"?`, message: "All rows will be deleted permanently.", confirmText: "Drop table", danger: true }))) return;
      await window.api.db.dropTable(pid, table.name);
      current = null;
      loadTables();
    };
    view.querySelector('[data-act="add-row"]').onclick = () => {
      const dataCols = cols.filter((c) => !(c.pk && /INT/i.test(c.type || "")));
      showModal(`
        <h2 class="modal-title">Add row to ${escapeHtml(table.name)}</h2>
        ${dataCols.map((c) => `<div class="input-group"><label class="input-label">${escapeHtml(c.name)} <small class="text-muted">${escapeHtml(c.type || "")}</small></label><input class="input" data-col="${escapeHtml(c.name)}" /></div>`).join("")}
        <div class="modal-actions"><button class="btn btn-secondary" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="ok">Insert</button></div>`, (c, close) => {
        c.querySelector('[data-act="cancel"]').onclick = close;
        c.querySelector('[data-act="ok"]').onclick = async () => {
          const data = {};
          c.querySelectorAll("[data-col]").forEach((inp) => {
            if (inp.value === "") return;
            const col = cols.find((x) => x.name === inp.dataset.col);
            data[inp.dataset.col] = /INT|REAL|NUM/i.test(col.type || "") && inp.value.trim() !== "" && !isNaN(Number(inp.value)) ? Number(inp.value) : inp.value;
          });
          try {
            await window.api.db.insertRow(pid, table.name, data);
            close();
            loadTables();
            showToast("Row added", "success");
          } catch (err) {
            showToast(err.message, "error");
          }
        };
      }, { size: "sm" });
    };
    view.querySelectorAll("[data-rowid]").forEach((b) => {
      b.onclick = async () => {
        await window.api.db.deleteRow(pid, table.name, Number(b.dataset.rowid));
        loadTables();
      };
    });
  }

  el.querySelector('[data-act="refresh"]').onclick = loadTables;

  el.querySelector('[data-act="sql"]').onclick = () => {
    showModal(`
      <h2 class="modal-title">Run SQL</h2>
      <textarea class="input input-code" rows="6" data-el="sql" placeholder="SELECT * FROM botify_kv LIMIT 20">${current ? `SELECT * FROM "${escapeHtml(current)}" LIMIT 50` : ""}</textarea>
      <div class="modal-actions"><button class="btn btn-secondary" data-act="cancel">Close</button><button class="btn btn-primary" data-act="run">${icon("play", 12)} Run</button></div>
      <div data-el="result" class="mt-md"></div>`, (c, close) => {
      c.querySelector('[data-act="cancel"]').onclick = close;
      c.querySelector('[data-act="run"]').onclick = async () => {
        const res = c.querySelector('[data-el="result"]');
        try {
          const out = await window.api.db.query(pid, c.querySelector('[data-el="sql"]').value, []);
          if (Array.isArray(out)) {
            const keys = out.length ? Object.keys(out[0]) : [];
            res.innerHTML = out.length ? `<div class="table-wrapper"><table><thead><tr>${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join("")}</tr></thead><tbody>${out.slice(0, 200).map((r) => `<tr>${keys.map((k) => `<td>${escapeHtml(r[k] ?? "NULL")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="text-muted text-sm">No rows.</p>';
          } else {
            res.innerHTML = `<div class="notice notice-ok notice-sm">${icon("check", 14)} ${out && out.changes !== undefined ? `${out.changes} row(s) changed` : "Done"}</div>`;
            loadTables();
          }
        } catch (err) {
          res.innerHTML = `<div class="notice notice-err notice-sm">${escapeHtml(err.message.replace(/^Error invoking remote method '[^']+': /, ""))}</div>`;
        }
      };
    }, { size: "lg" });
  };

  el.querySelector('[data-act="add-table"]').onclick = () => {
    const columns = [{ name: "", type: "TEXT" }];
    showModal(`
      <h2 class="modal-title">New table</h2>
      <div class="input-group"><label class="input-label">Table name</label><input class="input input-code" data-el="name" placeholder="my_table" autofocus /></div>
      <div class="input-label">Columns <small class="text-muted">(an "id" column is added automatically)</small></div>
      <div data-el="cols"></div>
      <button class="btn btn-ghost btn-sm" data-act="add-col">+ Add column</button>
      <div class="modal-actions"><button class="btn btn-secondary" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="create">Create table</button></div>`, (c, close) => {
      const drawCols = () => {
        const list = c.querySelector('[data-el="cols"]');
        list.innerHTML = columns.map((col, i) => `
          <div class="flex items-center gap-sm mb-sm">
            <input class="input input-code" value="${escapeHtml(col.name)}" placeholder="column_name" data-i="${i}" data-f="name" />
            <select class="input" data-i="${i}" data-f="type" style="width:140px">${["TEXT", "INTEGER", "REAL"].map((t) => `<option ${col.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
            <button class="icon-btn danger" data-del="${i}">${icon("x", 14)}</button>
          </div>`).join("");
        list.querySelectorAll("[data-f]").forEach((inp) => { inp.oninput = inp.onchange = () => { columns[inp.dataset.i][inp.dataset.f] = inp.value; }; });
        list.querySelectorAll("[data-del]").forEach((b) => { b.onclick = () => { columns.splice(Number(b.dataset.del), 1); drawCols(); }; });
      };
      drawCols();
      c.querySelector('[data-act="add-col"]').onclick = () => { columns.push({ name: "", type: "TEXT" }); drawCols(); };
      c.querySelector('[data-act="cancel"]').onclick = close;
      c.querySelector('[data-act="create"]').onclick = async () => {
        const name = c.querySelector('[data-el="name"]').value.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return showToast("Use letters, numbers and _ for the table name", "warning");
        const valid = columns.filter((col) => col.name.trim());
        if (!valid.length) return showToast("Add at least one column", "warning");
        try {
          await window.api.db.init(pid, [{ name, columns: valid }]);
          current = name;
          close();
          loadTables();
          showToast("Table created", "success");
        } catch (err) {
          showToast(err.message, "error");
        }
      };
    }, { size: "md" });
  };

  loadTables();
}
