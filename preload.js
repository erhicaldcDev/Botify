const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    window: {
        minimize: () => ipcRenderer.send("window:minimize"),
        maximize: () => ipcRenderer.send("window:maximize"),
        close: () => ipcRenderer.send("window:close"),
    },

    project: {
        list: () => ipcRenderer.invoke("project:list"),
        create: (data) => ipcRenderer.invoke("project:create", data),
        open: (id) => ipcRenderer.invoke("project:open", id),
        save: (data) => ipcRenderer.invoke("project:save", data),
        delete: (id) => ipcRenderer.invoke("project:delete", id),
        getToken: (id) => ipcRenderer.invoke("project:getToken", id),
        setToken: (id, token) => ipcRenderer.invoke("project:setToken", id, token),
    },

    token: {
        validate: (token) => ipcRenderer.invoke("token:validate", token),
    },

    generate: {
        code: (data) => ipcRenderer.invoke("generate:code", data),
    },

    deps: {
        install: (data) => ipcRenderer.invoke("deps:install", data),
        onProgress: (callback) => {
            ipcRenderer.removeAllListeners("deps:progress");
            ipcRenderer.on("deps:progress", (_, event) => callback(event));
        },
    },

    engine: {
        start: (data) => ipcRenderer.invoke("engine:start", data),
        stop: () => ipcRenderer.invoke("engine:stop"),
        restart: (data) => ipcRenderer.invoke("engine:restart", data),
        status: () => ipcRenderer.invoke("engine:status"),
        onLog: (callback) => {
            ipcRenderer.removeAllListeners("engine:log");
            ipcRenderer.on("engine:log", (_, event) => callback(event));
        },
    },

    db: {
        init: (projectId, tables) => ipcRenderer.invoke("db:init", projectId, tables),
        query: (projectId, query, params) => ipcRenderer.invoke("db:query", projectId, query, params),
        getTables: (projectId) => ipcRenderer.invoke("db:getTables", projectId),
        getTableData: (projectId, tableName) => ipcRenderer.invoke("db:getTableData", projectId, tableName),
        insertRow: (projectId, tableName, data) => ipcRenderer.invoke("db:insertRow", projectId, tableName, data),
        deleteRow: (projectId, tableName, rowId) => ipcRenderer.invoke("db:deleteRow", projectId, tableName, rowId),
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
    },

    app: {
        getPath: () => ipcRenderer.invoke("app:getPath"),
    },

    ide: {
        listFiles: (projectId) => ipcRenderer.invoke("ide:listFiles", projectId),
        readFile: (projectId, fileName) => ipcRenderer.invoke("ide:readFile", projectId, fileName),
        writeFile: (projectId, fileName, content) => ipcRenderer.invoke("ide:writeFile", projectId, fileName, content),
    },
});
