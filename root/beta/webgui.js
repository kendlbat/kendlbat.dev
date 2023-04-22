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
     * @type {HTMLElement}
     */
    #taskbarButton;

    /**
     * 
     * @param {WebGui} webgui 
     * @param {string} source 
     * @param {HTMLElement} taskbarIcon
     */
    constructor(id, source) {
        this.#id = id;
        this.#frame = document.createElement("iframe");
        this.#frame.src = source;
        this.#frame.addEventListener("click", (e) => {
            if (e.target.tagName === "A") {
                e.preventDefault();
                window.open(e.target.href, "_blank");
            }
        });

        this.#frame.classList.add("webgui-window");
    }

    getId() {
        return this.#id;
    }

    getFrame() {
        return this.#frame;
    }
}

class WebGui {
    #taskbar = null;
    #container;
    #windowContainer;
    #activeWindow;

    /**
     * @type {{[id: number]: {source: string, taskbarIcon: HTMLImageElement, window: WebguiWindow | undefined}}}
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
    addWindow(source, taskbarIcon) {
        let id = this.#requestWindowId();
        this.#windows[id] = {source, taskbarIcon};
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
        if (this.#activeWindow?.getId() === id) {
            this.#activeWindow.getFrame().focus();
            return this.#activeWindow;
        }
        let prevActiveWindow = this.#activeWindow;

        if (!this.#windows[id].window) {
            let window = new WebguiWindow(id, this.#windows[id].source, this.#windows[id].taskbarIcon);
            this.#windows[id].window = window;
        }
        let window = this.#windows[id].window;
        this.#activeWindow = window;
        this.#windowContainer.innerHTML = "";
        this.#windowContainer.appendChild(window.getFrame());

        if (prevActiveWindow) {
            this.#taskbar.querySelector(".webgui-taskbar-elem-" + prevActiveWindow.getId()).classList.remove("active");
        }
        this.#windows[id].taskbarIcon.classList.add("active");

        this.#activeWindow.getFrame().focus();
        return window;
    }

    getActiveWindowId() {
        return this.#activeWindow?.getId();
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

    webgui.addWindow("webconsole", iconManager.createIcon("akonadiconsole"));
    //webgui.addWindow("https://browsergames.pages.dev/", createIcon(""));
    webgui.addWindow("misc/about.html", iconManager.createIcon("help-about"));

    /* ----- */

    let wasUsingOldVersion = false;

    let lastUsedVersion = localStorage.getItem("lastUsedVersion");
    if (lastUsedVersion !== globalThis.WEBCONSOLE_VERSIONID) {
        localStorage.setItem("lastUsedVersion", globalThis.WEBCONSOLE_VERSIONID);
        wasUsingOldVersion = true;
    }

    if (!wasUsingOldVersion) {
        let prevActiveWindow = localStorage.getItem("webguiActiveWindow");
        console.log(prevActiveWindow);
        if (prevActiveWindow) {
            prevActiveWindow = JSON.parse(prevActiveWindow);
            webgui.openWindow(prevActiveWindow.activeWindow);
        }
    }

    if (!webgui.getActiveWindowId()) {
        webgui.openWindow(0);
    }

    window.addEventListener("beforeunload", () => {
        localStorage.setItem("webguiActiveWindow", JSON.stringify({
            activeWindow: webgui.getActiveWindowId()
        }));
    });
};