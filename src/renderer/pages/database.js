function renderDatabase(el) {
    if (!AppState.currentProject) {
        el.innerHTML = '<div class="empty-state"><div class="empty-state-title">No project selected</div></div>';
        return;
    }

    el.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Database</h1><p class="page-subtitle">SQLite data editor</p></div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary" id="db-refresh">Refresh</button>
        <button class="btn btn-primary" id="db-add-table">Add Table</button>
      </div>
    </div>
    <div id="db-tables-list"></div>
    <div id="db-table-view" class="mt-lg"></div>
  `;

    loadTables();

    el.querySelector("#db-refresh").onclick = loadTables;
    el.querySelector("#db-add-table").onclick = () => showAddTableModal();

    async function loadTables() {
        try {
            const tables = await window.api.db.getTables(AppState.currentProject.id);
            const list = el.querySelector("#db-tables-list");
            if (!tables || tables.length === 0) {
                list.innerHTML = '<div class="empty-state"><div class="empty-state-title">No tables</div><div class="empty-state-text">Add a table to store data for your bot</div></div>';
                return;
            }
            list.innerHTML = `<div class="card-grid">${tables.map((t) => `
        <div class="stat-card" style="cursor:pointer" data-table="${t.name}">
          <div class="stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          </div>
          <div>
            <div class="stat-value" style="font-size:18px">${t.name}</div>
            <div class="stat-label">${t.rowCount} rows · ${t.columns.length} columns</div>
          </div>
        </div>
      `).join("")}</div>`;
            list.querySelectorAll("[data-table]").forEach((card) => {
                card.onclick = () => viewTable(card.dataset.table);
            });
        } catch {
            el.querySelector("#db-tables-list").innerHTML = '<div class="empty-state"><div class="empty-state-title">Database not initialized</div></div>';
        }
    }

    async function viewTable(tableName) {
        const view = el.querySelector("#db-table-view");
        try {
            const rows = await window.api.db.getTableData(AppState.currentProject.id, tableName);
            const tables = await window.api.db.getTables(AppState.currentProject.id);
            const table = tables.find((t) => t.name === tableName);
            const cols = table ? table.columns : [];

            view.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title">${tableName}</div>
            <button class="btn btn-primary btn-sm" id="db-add-row">Add Row</button>
          </div>
          ${rows.length === 0 ? '<p style="color:var(--text-muted)">No data</p>' : `
          <div class="table-wrapper">
            <table>
              <thead><tr>${cols.map((c) => `<th>${c.name}</th>`).join("")}<th>Actions</th></tr></thead>
              <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c.name] !== undefined ? r[c.name] : ""}</td>`).join("")}
                <td><button class="btn btn-danger btn-sm row-del" data-id="${r.id}">Delete</button></td>
              </tr>`).join("")}</tbody>
            </table>
          </div>`}
        </div>
      `;

            view.querySelector("#db-add-row").onclick = () => {
                const dataCols = cols.filter((c) => c.name !== "id");
                showModal(`
          <h2 class="modal-title">Add Row to ${tableName}</h2>
          ${dataCols.map((c) => `<div class="input-group"><label class="input-label">${c.name}</label><input class="input" data-col="${c.name}" /></div>`).join("")}
          <div class="modal-actions">
            <button class="btn btn-secondary" id="row-cancel">Cancel</button>
            <button class="btn btn-primary" id="row-save">Insert</button>
          </div>
        `, (container) => {
                    container.querySelector("#row-cancel").onclick = hideModal;
                    container.querySelector("#row-save").onclick = async () => {
                        const data = {};
                        container.querySelectorAll("[data-col]").forEach((inp) => { data[inp.dataset.col] = inp.value; });
                        await window.api.db.insertRow(AppState.currentProject.id, tableName, data);
                        hideModal();
                        viewTable(tableName);
                        showToast("Row added", "success");
                    };
                });
            };

            view.querySelectorAll(".row-del").forEach((btn) => {
                btn.onclick = async () => {
                    await window.api.db.deleteRow(AppState.currentProject.id, tableName, parseInt(btn.dataset.id));
                    viewTable(tableName);
                    showToast("Row deleted", "success");
                };
            });
        } catch {
            view.innerHTML = '<p style="color:var(--text-muted)">Error loading table data</p>';
        }
    }

    function showAddTableModal() {
        let columns = [{ name: "", type: "TEXT" }];

        showModal(`
      <h2 class="modal-title">Add Table</h2>
      <div class="input-group">
        <label class="input-label">Table Name</label>
        <input class="input" id="table-name" placeholder="my_table" />
      </div>
      <div class="section-title mt-md">Columns</div>
      <div id="table-cols"></div>
      <button class="btn btn-ghost btn-sm mt-sm" id="add-col-btn">+ Add Column</button>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="tbl-cancel">Cancel</button>
        <button class="btn btn-primary" id="tbl-create">Create Table</button>
      </div>
    `, (container) => {
            function renderCols() {
                const list = container.querySelector("#table-cols");
                list.innerHTML = columns.map((c, i) => `
          <div class="flex items-center gap-sm mb-md">
            <input class="input" value="${c.name}" placeholder="column_name" data-i="${i}" data-f="name" style="flex:1" />
            <select class="input" data-i="${i}" data-f="type" style="width:120px">
              <option value="TEXT" ${c.type === "TEXT" ? "selected" : ""}>Text</option>
              <option value="INTEGER" ${c.type === "INTEGER" ? "selected" : ""}>Integer</option>
              <option value="REAL" ${c.type === "REAL" ? "selected" : ""}>Real</option>
            </select>
            <button class="btn btn-danger btn-sm col-del" data-i="${i}">×</button>
          </div>
        `).join("");
                list.querySelectorAll("input, select").forEach((inp) => {
                    if (inp.dataset.f) inp.onchange = () => { columns[inp.dataset.i][inp.dataset.f] = inp.value; };
                });
                list.querySelectorAll(".col-del").forEach((btn) => {
                    btn.onclick = () => { columns.splice(parseInt(btn.dataset.i), 1); renderCols(); };
                });
            }
            renderCols();

            container.querySelector("#add-col-btn").onclick = () => { columns.push({ name: "", type: "TEXT" }); renderCols(); };
            container.querySelector("#tbl-cancel").onclick = hideModal;
            container.querySelector("#tbl-create").onclick = async () => {
                const name = container.querySelector("#table-name").value.trim();
                if (!name) { showToast("Enter a table name", "warning"); return; }
                const validCols = columns.filter((c) => c.name.trim());
                if (validCols.length === 0) { showToast("Add at least one column", "warning"); return; }
                await window.api.db.init(AppState.currentProject.id, [{ name, columns: validCols }]);
                hideModal();
                loadTables();
                showToast("Table created", "success");
            };
        });
    }
}
