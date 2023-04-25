class WebguiWindow {
    /**
     * @type {HTMLIFrameElement}
     */
    #frame;

    /**
     * @type {number}
     */
    #id;

    /**
     * @type {string}
     */
    #humanReadableId;

    /**
     * @type {HTMLElement}
     */
    #taskbarButton;

    /**
     * 
     * @param {WebGui} webgui 
     * @param {string} source 
     * @param {HTMLElement} taskbarIcon
     */
    constructor(id, humanReadableId, source) {
        this.#id = id;
        this.#humanReadableId = humanReadableId;
        this.#frame = document.createElement("iframe");
        this.#frame.src = source;
        this.#frame.addEventListener("load", () => {
            let base = this.#frame.contentDocument.createElement("base");
            base.target = "_blank";
            this.#frame.contentDocument.head.appendChild(base);
        });
        this.#frame.classList.add("webgui-window");
    }

    get id() {
        return this.#id;
    }

    get humanReadableId() {
        return this.#humanReadableId;
    }

    getFrame() {
        return this.#frame;
    }
}

class WebGui {
    #taskbar = null;

    /**
     * @type {HTMLElement}
     */
    #container;

    /**
     * @type {HTMLIFrameElement}
     */
    #windowContainer;

    /**
     * @type {WebguiWindow}
     */
    #activeWindow;

    /**
     * @type {{[id: number]: {source: string, humanReadableId: string, taskbarIcon: HTMLImageElement, window: WebguiWindow | undefined}}}
     */
    #windows = {};

    /**
     * @type {{[id: number]: WebguiWindow}}
     */ 

    #webguiIdCnt = 0;

    #requestWindowId() {
        return this.#webguiIdCnt++;
    }

    /**
     * 
     * @param {HTMLElement} container 
     */
    constructor(container) {
        this.#container = container;
        this.#taskbar = document.createElement("div");
        this.#taskbar.classList.add("webgui-taskbar");
        this.#windowContainer = document.createElement("div");
        this.#windowContainer.classList.add("webgui-window-container");
        this.#container.appendChild(this.#windowContainer);
        this.#container.appendChild(this.#taskbar);
    }

    /**
     * 
     * @param {WebguiWindow} window 
     */
    addWindow(source, humanReadableId, taskbarIcon) {
        let id = this.#requestWindowId();
        if (Object.values(this.#windows).find((window) => window.humanReadableId === humanReadableId)) {
            throw new Error("Human readable id already exists");
        }

        this.#windows[id] = {source, humanReadableId, taskbarIcon};
        taskbarIcon.addEventListener("click", () => {
            this.openWindow(id);
        });
        taskbarIcon.classList.add("webgui-taskbar-elem");
        taskbarIcon.classList.add("webgui-taskbar-elem-" + id);
        this.#taskbar.appendChild(taskbarIcon);
    }

    /**
     * @param {number} id
     * @returns {WebguiWindow}
     */
    openWindow(id) {
        // console.log("Opening window " + id);
        if (this.#activeWindow?.id === id) {
            this.#activeWindow.getFrame().focus();
            return this.#activeWindow;
        }
        let prevActiveWindow = this.#activeWindow;

        if (!this.#windows[id].window) {
            let window = new WebguiWindow(id, this.#windows[id].humanReadableId,this.#windows[id].source, this.#windows[id].taskbarIcon);
            this.#windows[id].window = window;
        }
        let windownew = this.#windows[id].window;
        this.#activeWindow = windownew;
        this.#windowContainer.innerHTML = "";
        this.#windowContainer.appendChild(windownew.getFrame());

        if (prevActiveWindow) {
            this.#taskbar.querySelector(".webgui-taskbar-elem-" + prevActiveWindow.id).classList.remove("active");
        }
        this.#windows[id].taskbarIcon.classList.add("active");

        // Push window id to anchor
        
        this.#activeWindow.getFrame().focus();
        window.location.hash = "#" + this.#activeWindow.humanReadableId;
        return windownew;
    }

    /**
     * 
     * @param {string} humanReadableId 
     * @returns {WebguiWindow}
     */
    openWindowHRID(humanReadableId) {
        // Open window by human readable id
        let id = Object.keys(this.#windows).find((id) => this.#windows[id].humanReadableId === humanReadableId);
        if (id !== undefined) {
            return this.openWindow(id);
        }
        return null;
    }

    /**
     * 
     * @returns {number}
     */
    getActiveWindowId() {
        return this.#activeWindow?.id;
    }

    /**
     * 
     * @returns {WebguiWindow}
     */
    getActiveWindow() {
        return this.#activeWindow;
    }

    static createWindowIconFromURL(src) {
        let img = document.createElement("img");
        img.src = src;
        return img;
    }
}

globalThis.initWebGui = async () => {
    console.log("Webgui v" + globalThis.WEBCONSOLE_VERSIONID + "\n(c) Tobias Kendlbacher 2023");

    const iconManager = globalThis.iconManager;

    /**
     * @type {WebGui}
     */
    let webgui = new WebGui(document.querySelector("#webgui-container"));


    /* ADD WINDOWS HERE */

    webgui.addWindow("webconsole/index.html", "webconsole", iconManager.createIcon("akonadiconsole"));
    webgui.addWindow("https://edu.kendlbat.dev/", "eduweb", iconManager.createIcon("education"));
    //webgui.addWindow("https://browsergames.pages.dev/", createIcon(""));
    webgui.addWindow("misc/about.html", "about", iconManager.createIcon("help-about"));

    /* ----- */

    let wasUsingOldVersion = false;

    let lastUsedVersion = localStorage.getItem("lastUsedVersion");
    if (lastUsedVersion !== globalThis.WEBCONSOLE_VERSIONID) {
        localStorage.setItem("lastUsedVersion", globalThis.WEBCONSOLE_VERSIONID);
        wasUsingOldVersion = true;
    }

    if (!wasUsingOldVersion) {
        let prevActiveWindow = localStorage.getItem("webguiActiveWindow");
        if (prevActiveWindow) {
            prevActiveWindow = JSON.parse(prevActiveWindow);
            webgui.openWindow(prevActiveWindow.activeWindow);
        }
    }

    window.addEventListener("hashchange", () => {
        if (window.location.hash) {
            let hash = new String(window.location.hash).substring(1);
            let newwindow = webgui.openWindowHRID(hash);
        }
    });

    if (window.location.hash) {
        let hash = new String(window.location.hash).substring(1);
        let newwindow = webgui.openWindowHRID(hash);
        if (newwindow == null) {
            webgui.openWindow(0);
        }
    } else {
        webgui.openWindow(0);
    }

    window.addEventListener("beforeunload", () => {
        localStorage.setItem("webguiActiveWindow", JSON.stringify({
            activeWindow: webgui.getActiveWindowId()
        }));
    });
};