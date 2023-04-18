class WebConsole {
    static #hasInstance = false;

    #container;
    #env = {
        "prompt": "[kendlbat] $ "
    };
    #promptoverride = null;
    #input;
    #output;
    #promptelem;
    #stdindisable = false;
    #stdinbuffer = "";
    #stdin_prompt_id = 0;
    #cursor;
    #history = [];
    #historypos = 0;

    #notfound = (args, stdout) => {
        stdout("Command not found: " + args[0]);
    };

    /**
     * @type {Object.<string, Function>}
     */
    #commands = {
        "clear": () => this.#clear(),
        "echo": (args, stdout) => { stdout(args.slice(1).join(" ")) },
        "help": (args, stdout) => {
            stdout("Available commands:");
            for (let command in this.#commands)
                stdout("  " + command);
        },
        "cat": async (args, stdout) => {
            if (args.length < 2) {
                stdout("Usage: cat <file>");
                return;
            }

            let resp = await fetch(args[1]);
            let text = await resp.text();
            stdout(text);
        },
        "ls": async (args, stdout) => {
            // Get .index file from given / current directory
            if (args.length < 2)
                args.push(".");

            try {
                let resp = await fetch(args[1] + "/dir.json");
                (await resp.json())
                    .sort((a, b) => a.toLowerCase().localeCompare(b))
                    .forEach(element => {
                        if (element.startsWith("/") || element.endsWith("/")) {
                            element = element.replace(/\/$/, "").replace(/^\//, "");
                            stdout("<span style='color: #0000ff'>" + element + "</span>", true);
                        } else stdout(element, false);
                    });
            } catch (e) {
                stdout("Error: " + e);
                return;
            }
        },
        "html": async (args, stdout) => {
            // Cat but for html
            if (args.length < 2) {
                stdout("Usage: html <file>");
                return;
            }
            try {
                let resp = await fetch(args[1]);
                // Detect content type
                let type = resp.headers.get("content-type");

                if (type.startsWith("image/")) {
                    let blob = await resp.blob();
                    let url = URL.createObjectURL(blob);
                    stdout("<br><img src='" + url + "'><br>", true);
                } else {
                    let text = await resp.text();
                    text = text.replace(/(\r)?\n/g, "");
                    stdout("<br>" + text + "<br>", true);
                }
            } catch (e) {
                stdout("Error: " + e);
                return;
            }
        },
        "clearhistory": (args, stdout) => {
            let count = this.#history.length;
            this.#history = [];
            this.#historypos = 0;
            this.saveHistoryToLocalStorage("kendlportfolio");
            stdout("Cleared " + count + " history entries!");
        },
        "nav": async (args, stdout, stdin) => {
            // Interactive menu for navigating through articles (show in cli with stdout)
            // Get dir.json from ./pages
            try {
                let resp = await fetch("./pages/pageidx.json");
                let json = await resp.json();
                let pages = Object.keys(json);
                stdout("<br>", true);
                let count = 0;

                for (let page of pages) {
                    stdout(`  [${count++}] ${page}`, true);
                }
                // quit option
                stdout(`  [q] Cancel`, true);
                stdout("<br>", true);

                let input = await stdin("Enter selection: ");
                if (input === null)
                    return;
                let num = parseInt(input);
                if (input.toLowerCase() === "q")
                    return;
                if (isNaN(num) || num < 0 || num >= pages.length) {
                    stdout("Invalid selection");
                    return;
                }
                // Show html page
                // console.log(json);
                // console.log(pages);
                let pageres = await fetch("./pages/" + json[pages[num]]);
                let pagetext = await pageres.text();
                pagetext = pagetext.replace(/(\r)?\n/g, "");
                this.#clear();
                stdout("<br>" + pagetext + "<br>", true);
            } catch (e) {
                stdout("Error: " + e);
            }
        }
    }

    constructor(container) {
        if (WebConsole.#hasInstance)
            throw new Error("WebConsole already has an instance");
        WebConsole.#hasInstance = true;
        this.#container = container;
        this.#container.style.overflow = "scroll";

        // Whenever new content is added, scroll to bottom
        this.#container.addEventListener("DOMNodeInserted", () => {
            this.#container.scrollTop = this.#container.scrollHeight;
        });

        this.#container.classList.add("webconsole-container");
        this.#input = document.createElement("input");
        this.#input.type = "text";
        this.#input.classList.add("webconsole-input");

        document.addEventListener("DOMContentLoaded", () => {
            this.#input.focus();
        });

        document.addEventListener("keydown", () => {
            if (document.activeElement !== this.#input) {
                this.#input.focus();
                setTimeout(() => {
                    if (!this.#stdindisable) {
                        this.#stdinbuffer = this.#input.value;
                        if (this.#promptelem)
                            this.#promptelem.innerHTML = (this.#promptoverride || this.#env.prompt) + this.#stdinbuffer + "<span class='webconsole-cursor'></span>";
                    }
                }, 2);
            }
        });

        let currentTabMatch = -1;
        let beforeTab = null;

        this.#input.addEventListener("keydown", (e) => {
            // console.log((this.#promptoverride || this.#env.prompt));
            if (e.key !== "Tab") {
                currentTabMatch = -1;
                beforeTab = null;
            }
            let sync = () => {
                this.#stdinbuffer = this.#input.value;
                if (this.#promptelem)
                    this.#promptelem.innerHTML = (this.#promptoverride || this.#env.prompt) + this.#stdinbuffer + "<span class='webconsole-cursor'></span>";
            }
            if (e.key === "Enter") {
                if (this.#stdindisable) {
                    e.preventDefault();
                    return;
                }
                this.#promptelem.innerHTML = (this.#promptoverride || this.#env.prompt) + this.#stdinbuffer;
                this.#input.value = "";
                this.#stdindisable = true;
                let tempstdinbuf = this.#stdinbuffer;
                this.#stdinbuffer = "";
                this.#parseCommand(tempstdinbuf).then(() => {
                    if ((this.#history.length === 0 || this.#history[this.#history.length - 1] !== tempstdinbuf) && tempstdinbuf)
                        this.#history.push(tempstdinbuf);
                    this.#historypos = this.#history.length;
                    this.#newInputLine();
                    this.#stdindisable = false;
                });
            } else if (e.key === "ArrowUp") {
                if (this.#stdindisable)
                    return;
                if (this.#history.length > 0) {
                    this.#historypos = Math.max(0, this.#historypos - 1);
                    if (this.#history[this.#historypos] === "clearhistory")
                        return;
                    this.#stdinbuffer = this.#history[this.#historypos];
                    this.#input.value = this.#stdinbuffer;
                    sync();
                    return;
                }
            } else if (e.key === "ArrowDown") {
                if (this.#stdindisable)
                    return;
                // Go forward in history
                if (this.#history.length > 0) {
                    this.#historypos = Math.min(this.#history.length, this.#historypos + 1);
                    if (this.#historypos === this.#history.length)
                        this.#stdinbuffer = "";
                    else
                        this.#stdinbuffer = this.#history[this.#historypos];
                    this.#input.value = this.#stdinbuffer;
                    sync();
                    return;
                }
            } else if (e.key === "Tab") {
                if (this.#stdindisable)
                    return;
                // Tab completion (only for commands)
                if (this.#stdinbuffer.length === 0)
                    return;
                if (this.#stdinbuffer.split(" ").length > 1)
                    return;
                let matches = [];
                if (beforeTab === null)
                    beforeTab = this.#stdinbuffer;

                for (let cmd of Object.keys(this.#commands)) {
                    if (cmd.startsWith(beforeTab))
                        matches.push(cmd);
                }
                if (matches.length === 0)
                    return;
                if (matches.length === 1) {
                    this.#stdinbuffer = matches[0];
                    this.#input.value = this.#stdinbuffer;
                    sync();
                    return;
                }
                // Get next match
                // If shift, reverse
                if (e.shiftKey)
                    currentTabMatch--;
                else
                    currentTabMatch++;

                if (currentTabMatch >= matches.length)
                    currentTabMatch = 0;
                if (currentTabMatch < 0)
                    currentTabMatch = matches.length - 1;

                this.#stdinbuffer = matches[currentTabMatch];
                this.#input.value = this.#stdinbuffer;
                sync();
                e.preventDefault();
                return;
            }


            if (this.#historypos !== this.#history.length - 1)
                this.#historypos = this.#history.length - 1;

            // console.log(e.key);
            // Check for backspace
            // When event is done cascading, sync the input value with the stdin buffer

            e.target.addEventListener("input", sync, { once: true });
        });
        this.#container.addEventListener("focus", () => this.#input.focus());
        this.#container.addEventListener("click", () => this.#input.focus());
        this.#output = document.createElement("div");
        this.#output.classList.add("webconsole-output");
        this.#output.innerHTML = "WebConsole v0.1.0\n(c) Tobias Kendlbacher 2023 - MIT License\nType 'help' for a list of commands.\nType 'nav' for navigation.\n\n";
        this.#container.appendChild(this.#output);
        this.#container.appendChild(this.#input);
        this.#newInputLine();
        this.#container.scrollTop = this.#container.scrollHeight;
    }

    #newInputLine() {
        this.#promptelem = document.createElement("div");
        this.#promptelem.classList.add("webconsole-prompt");
        this.#promptelem.innerText = this.#env.prompt;
        this.#container.appendChild(this.#promptelem);
        this.#cursor = document.createElement("span");
        this.#cursor.classList.add("webconsole-cursor");
        this.#promptelem.appendChild(this.#cursor);
        this.#output = document.createElement("div");
        this.#output.classList.add("webconsole-output");
        this.#container.appendChild(this.#output);
        this.#container.scrollTop = this.#container.scrollHeight + 1000;
    }

    setEnv(key, value) {
        this.#env[key] = value;
    }

    #clear() {
        // Remove everything, recreate the input line
        while (this.#container.firstChild)
            this.#container.removeChild(this.#container.firstChild);
        this.#container.appendChild(this.#input);
        this.#input.focus();

    }

    stdout = async (text, htmlMode = false) => {
        let outelem = document.createElement("div");
        outelem.classList.add("webconsole-output-line");

        if (htmlMode) {
            outelem.innerHTML = text;
        } else {
            outelem.innerText = text;
        }

        this.#container.appendChild(outelem);
        this.#container.scrollTop = this.#container.scrollHeight;
    }

    stdin = async (prompt) => {
        // Set the input to the end of stdout 
        this.#promptelem = undefined;
        this.#promptelem = document.createElement("div");
        this.#promptelem.classList.add("webconsole-prompt");
        this.#promptelem.innerText = prompt;
        let tmppromtelem = this.#promptelem;
        this.#container.appendChild(this.#promptelem);
        this.#cursor = document.createElement("span");
        this.#cursor.classList.add("webconsole-cursor");
        this.#promptelem.appendChild(this.#cursor);

        // Get input
        this.#stdindisable = true;
        this.#promptoverride = prompt;
        let eldisabled = false;
        let input = await new Promise((resolve) => {
            let el = this.#input.addEventListener("keydown", (e) => {
                if (eldisabled)
                    return;
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();

                    if (tmppromtelem)
                        tmppromtelem.innerHTML = this.#promptoverride + this.#stdinbuffer;
                    if (tmppromtelem === this.#promptelem) {
                        this.#promptelem = undefined;
                    }
                    this.#input.removeEventListener("keydown", el);
                    this.eldisabled = true;
                    this.#promptoverride = null;
                    this.#input.value = "";
                    this.#stdindisable = false;
                    resolve(this.#stdinbuffer);
                }
            });
        });
        this.#stdindisable = false;
        return input;
    }

    async #parseCommand(command) {
        const args = command.split(" ");
        const name = args[0];
        if (this.#commands[name])
            await this.#commands[name](args, this.stdout, this.stdin);
        else
            this.#notfound(args, this.stdout, this.stdin);
    }

    /**
     * 
     * @param {string} name 
     * @param {Function} callback 
     */
    registerCommand(name, callback) {
        this.#commands[name] = callback;
    }

    /**
     * 
     * @param {string} name 
     */
    deregisterCommand(name) {
        delete this.#commands[name];
    }

    saveHistoryToLocalStorage(identifier) {
        localStorage.setItem("webconsole-history-" + identifier, JSON.stringify(this.#history));
    }

    loadHistoryFromLocalStorage(identifier) {
        let hist;
        try {
            hist = JSON.parse(localStorage.getItem("webconsole-history-" + identifier));
        } catch (e) {
            return;
        }
        if (Array.isArray(hist))
            this.#history = hist;
        this.#historypos = this.#history.length;
    }
}

/**
 * @type {WebConsole}
 */
let mainconsole;

document.addEventListener('DOMContentLoaded', () => {
    mainconsole = new WebConsole(document.querySelector('#webconsole-container'));
    mainconsole.loadHistoryFromLocalStorage("kendlportfolio");
});

window.addEventListener('beforeunload', (e) => {
    mainconsole.saveHistoryToLocalStorage("kendlportfolio");
});

