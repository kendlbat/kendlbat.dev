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
        this.#frame.style.backgroundColor = "black";
        this.#frame.classList.add("webgui-iframe");
        this.#frame.src = source;
        this.#frame.title = humanReadableId;
        this.#frame.addEventListener("load", () => {
            if (this.#frame.contentDocument) {
                let base = this.#frame.contentDocument.createElement("base");
                base.target = "_blank";
                this.#frame.contentDocument.head.appendChild(base);
            }
            this.#frame.backgroundColor = "";
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

    setHash(hash) {
        let url = new URL(this.#frame.src);
        url.hash = hash;
        this.#frame.src = url.toString();
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

        if (humanReadableId.includes("/")) {
            throw new Error("Human readable id cannot contain slash");
        }

        this.#windows[id] = { source, humanReadableId, taskbarIcon };
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

        let hash = window.location.hash;
        let windowhash = "";
        if (hash.includes("/")) {
            windowhash = hash.substring(hash.indexOf("/") + 1);
        }

        if (this.#activeWindow?.id === id) {
            this.#activeWindow.getFrame().focus();
            if (windowhash) {
                this.#activeWindow.setHash(windowhash);
            }
            return this.#activeWindow;
        }

        // Whow loading animation on cursor
        document.body.style.cursor = "wait";

        let prevActiveWindow = this.#activeWindow;

        if (!this.#windows[id].window) {
            let window = new WebguiWindow(id, this.#windows[id].humanReadableId, this.#windows[id].source, this.#windows[id].taskbarIcon);
            window.getFrame().addEventListener("load", () => {
                document.body.style.cursor = "";
            });
            this.#windows[id].window = window;
        }
        let windownew = this.#windows[id].window;
        if (windowhash) {
            windownew.setHash(windowhash);
        }
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
        humanReadableId = humanReadableId.split("/")[0];
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
    console.log("Webgui v" + globalThis.WEBGUI_VERSIONID + "\n(c) Tobias Kendlbacher 2023");

    const iconManager = globalThis.iconManager;

    /**
     * @type {WebGui}
     */
    let webgui = new WebGui(document.querySelector("#webgui-container"));


    /* ADD WINDOWS HERE */

    webgui.addWindow("misc/startpage.html", "", iconManager.createIcon("house"));
    webgui.addWindow("webconsole/index.html", "webconsole", iconManager.createIcon("terminal"));
    webgui.addWindow("https://edu.kendlbat.dev/", "eduweb", iconManager.createIcon("book"));
    webgui.addWindow("https://edu.kendlbat.dev/clockjs/", "clockjs", iconManager.createIcon("clock"));
    webgui.addWindow("https://browsergames.pages.dev/", "browsergames", iconManager.createIcon("controller"));
    webgui.addWindow("misc/about.html", "about", iconManager.createIcon("info-circle"));

    /* ----- */

    let wasUsingOldVersion = false;

    let lastUsedVersion = localStorage.getItem("lastUsedVersion");
    if (lastUsedVersion !== globalThis.WEBGUI_VERSIONID) {
        localStorage.setItem("lastUsedVersion", globalThis.WEBGUI_VERSIONID);
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
            if (newwindow == null) {
                webgui.openWindow(0);
            }
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