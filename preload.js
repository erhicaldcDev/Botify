const { contextBridge, ipcRenderer } = require("electron");

const listen = (channel, callback) => {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_, event) => callback(event));
};

contextBridge.exposeInMainWorld("api", {
    window: {
        minimize: () => ipcRenderer.send("window:minimize"),
        maximize: () => ipcRenderer.send("window:maximize"),
        close: () => ipcRenderer.send("window:close"),
        onState: (callback) => listen("window:state", callback),
    },

    project: {
        list: () => ipcRenderer.invoke("project:list"),
        create: (data) => ipcRenderer.invoke("project:create", data),
        open: (id) => ipcRenderer.invoke("project:open", id),
        save: (data) => ipcRenderer.invoke("project:save", data),
        delete: (id) => ipcRenderer.invoke("project:delete", id),
        getToken: (id) => ipcRenderer.invoke("project:getToken", id),
        setToken: (id, token) => ipcRenderer.invoke("project:setToken", id, token),
        export: (id) => ipcRenderer.invoke("project:export", id),
        import: () => ipcRenderer.invoke("project:import"),
    },

    token: {
        validate: (token) => ipcRenderer.invoke("token:validate", token),
    },

    generate: {
        code: (data) => ipcRenderer.invoke("generate:code", data),
    },

    deps: {
        install: (data) => ipcRenderer.invoke("deps:install", data),
        check: (data) => ipcRenderer.invoke("deps:check", data),
        onProgress: (callback) => listen("deps:progress", callback),
    },

    engine: {
        start: (data) => ipcRenderer.invoke("engine:start", data),
        stop: () => ipcRenderer.invoke("engine:stop"),
        restart: (data) => ipcRenderer.invoke("engine:restart", data),
        status: () => ipcRenderer.invoke("engine:status"),
        onLog: (callback) => listen("engine:log", callback),
    },

    db: {
        init: (projectId, tables) => ipcRenderer.invoke("db:init", projectId, tables),
        query: (projectId, query, params) => ipcRenderer.invoke("db:query", projectId, query, params),
        getTables: (projectId) => ipcRenderer.invoke("db:getTables", projectId),
        getTableData: (projectId, tableName) => ipcRenderer.invoke("db:getTableData", projectId, tableName),
        insertRow: (projectId, tableName, data) => ipcRenderer.invoke("db:insertRow", projectId, tableName, data),
        deleteRow: (projectId, tableName, rowId) => ipcRenderer.invoke("db:deleteRow", projectId, tableName, rowId),
        dropTable: (projectId, tableName) => ipcRenderer.invoke("db:dropTable", projectId, tableName),
    },

    plugins: {
        list: () => ipcRenderer.invoke("plugins:list"),
        toggle: (id) => ipcRenderer.invoke("plugins:toggle", id),
        reload: () => ipcRenderer.invoke("plugins:reload"),
    },

    dialog: {
        openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
    },

    shell: {
        openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
        openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
    },

    app: {
        getPath: () => ipcRenderer.invoke("app:getPath"),
        version: () => ipcRenderer.invoke("app:version"),
    },

    ide: {
        listFiles: (projectId) => ipcRenderer.invoke("ide:listFiles", projectId),
        readFile: (projectId, fileName) => ipcRenderer.invoke("ide:readFile", projectId, fileName),
        writeFile: (projectId, fileName, content) => ipcRenderer.invoke("ide:writeFile", projectId, fileName, content),
    },
});
