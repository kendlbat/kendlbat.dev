class StdWorker {
    #source;
    #stdout;
    #stdin;
    #listeners = [];
    #worker;
    #logging = false;

    constructor(source, stdout, stdin) {
        this.#stdout = stdout;
        this.#stdin = stdin;
        this.#source = source;
    }

    onRequest(type, cbf) {
        let fun = (e) => {
            if (e.data.type == type) {
                cbf(e.data);
            }
        }
        this.#listeners.push(fun);
        return fun;
    }

    removeRequest(fun) {
        this.#listeners.splice(this.#listeners.indexOf(fun), 1);
    }

    sendMessage(type, data) {
        if (!this.#worker) throw new Error("Worker not started");
        if (this.#logging) console.log({ type: type, data: data });
        this.#worker.postMessage({ type: type, data: data });
    }

    enableLogging() {
        this.#logging = true;
    }

    disableLogging() {
        this.#logging = false;
    }

    async run() {
        return await new Promise((resolve) => {
            let worker = new Worker(this.#source);
            this.#worker = worker;

            let stdoutinterrupt = null;

            this.#listeners.push(async (e) => {
                if (this.#logging) console.log(e.data);
                if (e.data.type == "stdout") {
                    let out;
                    if (!e.data.data) out = "";
                    else out = JSON.parse(e.data.data);
                    if (typeof out == "object") {
                        out = JSON.stringify(out);
                    }
                    this.#stdout(out);
                } else if (e.data.type == "stdin") {
                    let prompt = JSON.parse(e.data.data);
                    if (prompt === undefined) prompt = "";

                    let input = await this.#stdin(prompt);

                    worker.postMessage({ type: "stdin", data: input });
                } else if (e.data.type == "exit") {
                    resolve();
                }
            });

            this.#listeners.forEach((listener) => {
                worker.addEventListener("message", listener);
            });
            worker.postMessage({ type: "start" });
        });
    }
}

class WebConsole {
    static VERSION = VERSIONID || "N/A";

    static #pyoditeURL = "https://cdn.jsdelivr.net/pyodide/v0.23.1/full/pyodide.js";

    #container;
    #env = {
        "prompt": "[kendlbat] $ "
    };
    #pypackages = [];
    #promptoverride = null;
    #input;
    #output;
    #promptelem;
    #stdindisable = false;
    #stdinbuffer = "";
    #history = [];
    #historypos = 0;
    #inputcontainer;

    #cdncache = {};

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
            for (let command in this.#commands) {
                if (new String(command).startsWith("_")) continue;
                stdout("  " + command);
            }
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
        "iframe": async (args, stdout) => {
            // Load argument as iframe
            if (args.length < 2) {
                stdout("Usage: iframe <url>");
                return;
            }

            /**
             * @type {string}
             */
            let url = args[1];
            // Check if youtube
            if (url.match("^(https?://)?(www.)?youtu.be/")) {
                url = url.replace("youtu.be/", "youtube.com/watch?v=");
            }
            if (url.match("^(https?://)?(www.)?youtube.com/watch")) {
                let id = url.split("v=")[1];
                stdout(`<br><div style='display:inline-flex; margin:0; padding:0; resize:both; overflow:hidden; max-width: 100%;'><iframe style=style='flex-grow:1; margin:0; padding:0; border:0;' width="560" height="${window.innerHeight * 0.9}" src="https://youtube.com/embed/${id}?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><br>`, true);
                return;
            }
            stdout("<br><div style='display:inline-flex; margin:0; padding:0; resize:both; overflow:hidden; max-width: 100%;'><iframe width='1920' height='" + window.innerHeight * 0.9 + "' src='" + url + "' style='flex-grow:1; margin:0; padding:0; border:0;'></iframe></div><br>", true);
        },
        "python": async (args, stdout, stdin) => {
            // Load pyodide from CDN
            // Insert script tag
            let outpercentelem = document.createElement("div");
            outpercentelem.classList.add("webconsole-output-line");
            outpercentelem.innerHTML = "Loading pyodide...";
            this.#container.appendChild(outpercentelem);
            this.#container.scrollTop = this.#container.scrollHeight;

            let animateLoadingBar = async (text, runCheck) => {
                let i = 0;
                let j = 0;
                let chars = ["/", "-", "\\", "|"];
                while (runCheck()) {
                    outpercentelem.innerHTML = text + " " + chars[i];
                    // Increment i every 10 iterations
                    if (j++ % 10 === 0)
                        i = (i + 1) % chars.length;
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }
                outpercentelem.innerHTML = text + " DONE";
            };

            let removeLoadingBar = () => {
                this.#container.removeChild(outpercentelem);
            };

            let showLoading = true;
            let loadingAnim = animateLoadingBar("Loading pyodide... ", () => showLoading);

            let worker = new StdWorker("workers/python.js", stdout, stdin);
            worker.enableLogging();
            worker.onRequest("pypackages", async () => {
                worker.sendMessage("pypackages", this.#pypackages);
            });

            worker.onRequest("ready", async () => {
                showLoading = false;
                await loadingAnim;
                removeLoadingBar();
                worker.sendMessage("ready");
            });

            await worker.run();
        },
        "pyrun": async (args, stdout, stdin) => {
            let file;

            let outpercentelem = document.createElement("div");
            outpercentelem.classList.add("webconsole-output-line");
            outpercentelem.innerHTML = "Loading pyodide...";
            this.#container.appendChild(outpercentelem);
            this.#container.scrollTop = this.#container.scrollHeight;

            let showLoading = true;
            let loadingAnim;

            let animateLoadingBar = async (text, runCheck) => {
                let i = 0;
                let j = 0;
                let chars = ["/", "-", "\\", "|"];
                while (runCheck()) {
                    outpercentelem.innerHTML = text + " " + chars[i];
                    // Increment i every 10 iterations
                    if (j++ % 10 === 0)
                        i = (i + 1) % chars.length;
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }
                outpercentelem.innerHTML = text + " DONE";
            };

            let removeLoadingBar = () => {
                this.#container.removeChild(outpercentelem);
            };

            if (args.length > 2) {
                stdout("Usage: pyrun [file]");
                return;
            } else if (args.length === 2) {
                file = args[1];
                showLoading = true;
                loadingAnim = animateLoadingBar("Fetching file... ", () => showLoading);
                let response = await fetch(file);
                if (!response.ok) {
                    stdout("Error while fetching file: " + response.status + " " + response.statusText);
                    showLoading = false;
                    await loadingAnim;
                    removeLoadingBar();
                    return;
                }
                file = await response.text();
                showLoading = false;
                await loadingAnim;
            } else {
                showLoading = true;
                loadingAnim = animateLoadingBar("Awaiting file upload... ", () => showLoading);
                try {
                    file = await this.#fileSelect([".py", ".pyw"]);
                } catch (e) {
                    stdout("Error while selecting file.");
                    showLoading = false;
                    await loadingAnim;
                    removeLoadingBar();
                    return;
                }
                showLoading = false;
                await loadingAnim;

                showLoading = true;
                loadingAnim = animateLoadingBar("Reading file... ", () => showLoading);
                let fileReader = new FileReader();
                fileReader.readAsText(file);
                await new Promise((resolve) => fileReader.onloadend = resolve);
                file = fileReader.result;
                showLoading = false;
                await loadingAnim;
            }

            showLoading = true;
            loadingAnim = animateLoadingBar("Loading pyodide... ", () => showLoading);
            
            let worker = new StdWorker("workers/pyrun.js", stdout, stdin);
            worker.enableLogging();
            worker.onRequest("pypackages", async () => {
                worker.sendMessage("pypackages", this.#pypackages);
            });

            worker.onRequest("ready", async () => {
                showLoading = false;
                await loadingAnim;
                removeLoadingBar();
                worker.sendMessage("ready");
            });

            worker.onRequest("args", async () => {
                worker.sendMessage("args", JSON.stringify(args));
            });

            worker.onRequest("file", async () => {
                worker.sendMessage("file", file);
            });

            await worker.run();

            showLoading = true;
            loadingAnim = animateLoadingBar("Loading pyodide... ", () => showLoading);
        },
        "pypkg": async (args, stdout) => {
            if (args.length < 3) {
                stdout("Usage: pypkg <add|remove> <package> [package2] [package3] ...");
                return;
            }

            let add;
            let action = args[1];
            switch (action) {
                case "add": add = true; break;
                case "remove": add = false; break;
                default:
                    stdout("Usage: pypkg <add|remove> <package> [package2] [package3] ...");
                    return;
            }


            let packages = args.slice(2);
            for (let pkg of packages) {
                if (pkg === "")
                    continue;
                if (this.#pypackages.includes(pkg))
                    if (add)
                        stdout("Package " + pkg + " is already installed.");
                    else {
                        this.#pypackages.splice(this.#pypackages.indexOf(pkg), 1);
                        stdout("Package " + pkg + " removed from install list.");
                    }
                else {
                    if (add) {
                        this.#pypackages.push(pkg);
                        stdout("Package " + pkg + " added to install list.");
                    } else {
                        stdout("Package " + pkg + " is not installed.");
                    }
                }
            }
        },
        "_amogus": async (args, stdout) => {
            let audio = document.createElement("audio");
            audio.src = "https://static.kendlbat.dev/audio/amogus.mp3";
            document.body.appendChild(audio);
            audio.onended = () => {
                document.body.removeChild(audio);
            };
            audio.play();
            stdout("            ⠀⣠⣤⣤⣤⣤⣤⣤⣤⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⡿⠛⠉⠙⠛⠛⠛⠛⠻⢿⣿⣷⣤⡀⠀⠀⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⠋⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⠈⢻⣿⣿⡄⠀⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⣸⣿⡏⠀⠀⠀⣠⣶⣾⣿⣿⣿⠿⠿⠿⢿⣿⣿⣿⣄⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⣿⣿⠁⠀⠀⢰⣿⣿⣯⠁⠀⠀⠀⠀⠀⠀⠀⠈⠙⢿⣷⡄⠀ ");
            stdout("⠀⠀⣀⣤⣴⣶⣶⣿⡟⠀⠀⠀⢸⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣷⠀ ");
            stdout("⠀⢰⣿⡟⠋⠉⣹⣿⡇⠀⠀⠀⠘⣿⣿⣿⣿⣷⣦⣤⣤⣤⣶⣶⣶⣶⣿⣿⣿⠀ ");
            stdout("⠀⢸⣿⡇⠀⠀⣿⣿⡇⠀⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠀ ");
            stdout("⠀⣸⣿⡇⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠉⠻⠿⣿⣿⣿⣿⡿⠿⠿⠛⢻⣿⡇⠀⠀ ");
            stdout("⠀⣿⣿⠁⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣧⠀⠀ ");
            stdout("⠀⣿⣿⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀ ");
            stdout("⠀⣿⣿⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀ ");
            stdout("⠀⢿⣿⡆⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⡇⠀⠀ ");
            stdout("⠀⠸⣿⣧⡀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⠃⠀⠀ ");
            stdout("⠀⠀⠛⢿⣿⣿⣿⣿⣇⠀⠀⠀⠀⠀⣰⣿⣿⣷⣶⣶⣶⣶⠶⢠⣿⣿⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⣿⣿⡇⠀⣽⣿⡏⠁⠀⠀⢸⣿⡇⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⣿⣿⡇⠀⢹⣿⡆⠀⠀⠀⣸⣿⠇⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⢿⣿⣦⣄⣀⣠⣴⣿⣿⠁⠀⠈⠻⣿⣿⣿⣿⡿⠏⠀⠀⠀⠀ ");
            stdout("⠀⠀⠀⠀⠀⠀⠀⠈⠛⠻⠿⠿⠿⠿⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀");
        },
        "exit": async (args, stdout, stdin) => {
            while (!(await stdin("Please press Ctrl+W to exit...")) != "^W") { }
        },
        "": () => { }
    }

    constructor(container) {
        this.#container = container;

        this.#container.classList.add("webconsole-container");
        this.#input = document.createElement("input");
        // this.#input.type = "text";
        this.#input.classList.add("webconsole-input");

        this.#inputcontainer = document.createElement("div");
        this.#inputcontainer.classList.add("webconsole-input-container");
        this.#inputcontainer.appendChild(this.#input);


        this.#input.focus();

        document.addEventListener("keydown", () => {
            if (document.activeElement !== this.#input) {
                setTimeout(() => {
                    if (!this.#stdindisable) {
                        this.#stdinbuffer = this.#input.value;
                        if (this.#promptelem) {
                            this.#promptelem.innerHTML = (this.#promptoverride || this.#env.prompt);
                            this.#promptelem.appendChild(this.#inputcontainer);
                            if (window.getSelection().toString() !== "")
                                return;
                            this.#input.focus();
                        }
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
                // if (this.#promptelem)
                //     this.#stdinbuffer = this.#input.value;
                //     this.#promptelem.innerHTML = (this.#promptoverride || this.#env.prompt);
                //     this.#promptelem.appendChild(this.#input);
            }
            // Log key
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
                    setTimeout(() => {
                        this.#input.selectionStart = this.#input.selectionEnd = this.#stdinbuffer.length;
                    }, 2);
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
                    this.#input.selectionStart = this.#input.selectionEnd = this.#input.value.length;
                    sync();
                    return;
                }
            } else if (e.key === "Tab") {
                if (this.#stdindisable)
                    return;
                e.preventDefault();
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
                    // Set cursor in input to end
                    this.#input.selectionStart = this.#input.selectionEnd = this.#input.value.length;
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
                // Set cursor in input to end
                this.#input.selectionStart = this.#input.selectionEnd = this.#input.value.length;
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
        this.#container.addEventListener("focus", () => {
            setTimeout(() => {
                if (window.getSelection().toString() !== "")
                    return;
                this.#input.focus();
            }, 2);
        });
        this.#container.addEventListener("click", () => {
            setTimeout(() => {
                if (window.getSelection().toString() !== "")
                    return;
                this.#input.focus();
            }, 2);
        });
        this.#output = document.createElement("div");
        this.#output.classList.add("webconsole-output");
        this.#output.innerHTML = "WebConsole v" + WebConsole.VERSION + "\n(c) Tobias Kendlbacher 2023 - MIT License\nType 'help' for a list of commands.\n";
        // Detect mobile
        if (window.innerWidth < 800) {
            this.#output.innerHTML += "Mobile detected. This console is currently unsupported on mobile devices and you may experience issues.\n";
        }
        this.#output.innerHTML += "\n";
        this.#container.appendChild(this.#output);
        this.#container.appendChild(this.#inputcontainer);
        this.#newInputLine();
        this.#container.scrollTop = this.#container.scrollHeight;
    }

    #newInputLine() {
        this.#promptelem = document.createElement("div");
        this.#promptelem.classList.add("webconsole-prompt");
        this.#promptelem.innerText = this.#env.prompt;
        this.#container.appendChild(this.#promptelem);
        this.#promptelem.appendChild(this.#inputcontainer);
        if (window.getSelection().toString() === "")
            this.#input.focus();
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
        this.#container.appendChild(this.#inputcontainer);
        if (window.getSelection().toString() === "")
            this.#input.focus();
    }

    /**
     * 
     * @param {Array<String>} allowed
     * @returns {Promise<FileHandle> | Promise<undefined>}
     */
    #fileSelect(allowed = []) {
        // // Get file upload via File System Access API
        // let types = [];
        // for (let [key, value] of Object.entries(allowed)) {
        //     types.push({
        //         description: key,
        //         accept: value
        //     });
        // }

        // const [fileHandle] = await window.showOpenFilePicker({
        //     types: types,
        //     multiple: false
        // });
        // return fileHandle;

        // Get file upload via input, because File System Access API is not supported
        let input = document.createElement("input");
        input.type = "file";
        input.multiple = false;
        input.accept =
            input.click();
        return new Promise((resolve, reject) => {
            input.addEventListener("change", () => {
                if (input.files.length === 0)
                    resolve(undefined);
                else
                    resolve(input.files[0]);
            });

            input.addEventListener("error", () => {
                reject();
            });

            input.addEventListener("abort", () => {
                reject();
            });

            input.addEventListener("cancel", () => {
                reject();
            });
        });

    }

    stdout = async (text, htmlMode = false) => {
        let outelem = document.createElement("div");
        outelem.classList.add("webconsole-output-line");
        if (text === undefined)
            text = "";

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
        this.#promptelem.appendChild(this.#inputcontainer);
        let tmppromtelem = this.#promptelem;
        this.#container.appendChild(this.#promptelem);
        if (window.getSelection().toString() === "")
            this.#input.focus();

        // Get input
        this.#stdindisable = true;
        this.#promptoverride = prompt;
        let eldisabled = false;
        let input = await new Promise((resolve) => {
            let eventlistfunc = (e) => {
                if (eldisabled === true)
                    return;
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();

                    if (tmppromtelem)
                        tmppromtelem.innerHTML = this.#promptoverride + this.#stdinbuffer;
                    if (tmppromtelem === this.#promptelem) {
                        this.#promptelem = undefined;
                    }

                    // CLEAR THE EVENT LISTENER
                    this.#input.removeEventListener("keydown", eventlistfunc);

                    this.eldisabled = true;
                    this.#promptoverride = null;
                    this.#input.value = "";
                    this.#stdindisable = false;
                    resolve(this.#stdinbuffer);
                    this.#stdinbuffer = "";
                } else if (e.key === "Tab") {
                    // Should enter a tab
                    e.preventDefault();
                    e.stopPropagation();
                    // Type tab
                    let cursorstart = this.#input.selectionStart;
                    let cursorend = this.#input.selectionEnd;
                    this.#input.value = this.#input.value.substring(0, cursorstart) + "\t" + this.#input.value.substring(cursorend);
                    this.#input.selectionStart = this.#input.selectionEnd = cursorstart + 1;
                    this.#stdinbuffer = this.#input.value;
                    // Set tab width to 4 spaces
                    // Set cursor in input to appropriate position
                } else if (e.ctrlKey) {
                    // Do not override CTRL+V
                    if (e.shiftKey) {
                        return;
                    }
                    // If letter key
                    if (e.key.length === 1) {
                        if (tmppromtelem)
                            tmppromtelem.innerHTML = this.#promptoverride + this.#stdinbuffer;
                        if (tmppromtelem === this.#promptelem) {
                            this.#promptelem = undefined;
                        }

                        // CLEAR THE EVENT LISTENER
                        this.#input.removeEventListener("keydown", eventlistfunc);

                        this.eldisabled = true;
                        this.#promptoverride = null;
                        this.#input.value = "";
                        this.#stdindisable = false;
                        resolve("^" + e.key.toUpperCase());
                        this.#stdinbuffer = "";
                    }
                }
            }
            this.#input.addEventListener("keydown", eventlistfunc);
        });
        this.#stdindisable = false;
        return input;
    }

    async #parseCommand(command) {
        const args = command.split(" ");
        const name = args[0];
        if (this.#commands["_" + name])
            await this.#commands["_" + name](args, this.stdout, this.stdin);
        else if (this.#commands[name])
            await this.#commands[name](args, this.stdout, this.stdin);
        else
            this.#notfound(args, this.stdout, this.stdin);
    }

    async sendCommand(command) {
        if (this.#stdindisable)
            return;
        this.#stdinbuffer = command;
        this.#input.value = command;
        this.#input.dispatchEvent(new KeyboardEvent("keydown", {
            key: "Enter"
        }));
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
     * @param {string} url 
     * @param {Function} percentageCallback 
     * @returns 
     */
    async #loadScript(url, percentageCallback = (perc) => { }) {
        if (!this.#cdncache[url]) {

            // Load script
            let scriptelem = document.createElement("script");
            scriptelem.src = url;
            scriptelem.type = "text/javascript";
            scriptelem.async = false;
            scriptelem.addEventListener("progress", (e) => {
                percentageCallback(e.loaded / e.total * 100);
            });
            document.head.appendChild(scriptelem);
            await new Promise((resolve) => {
                scriptelem.addEventListener("load", resolve);
            });
            this.#cdncache[url] = true;
        }
        percentageCallback(100);
        return;
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

function initMainWebconsole() {
    mainconsole = new WebConsole(document.querySelector('#webconsole-container'));
    mainconsole.loadHistoryFromLocalStorage("kendlportfolio");

    window.addEventListener('beforeunload', (e) => {
        mainconsole.saveHistoryToLocalStorage("kendlportfolio");
    });

    let url = new URL(window.location.href);
    let command = decodeURIComponent(url.hash.substring(1));
    if (command) {
        mainconsole.sendCommand(command);
    }

    window.addEventListener("hashchange", (e) => {
        let url = new URL(window.location.href);
        let command = decodeURIComponent(url.hash.substring(1));
        if (command) {
            mainconsole.sendCommand(command);
        }
    });
}

globalThis.initMainWebconsole = initMainWebconsole;
