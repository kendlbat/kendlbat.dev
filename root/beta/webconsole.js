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
        },
        "iframe": async (args, stdout) => {
            // Load argument as iframe
            if (args.length < 2) {
                stdout("Usage: iframe <url>");
                return;
            }
            let url = args[1];
            // Check if youtube
            if (url.startsWith("https://www.youtube.com/watch?v=")) {
                let id = url.split("v=")[1];
                stdout(`<br><iframe width="560" height="315" src="https://youtube.com/embed/${id}?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br>`, true);
                return;
            }
            stdout("<br><iframe src='" + url + "'></iframe><br>", true);
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
            let loadingAnim = animateLoadingBar("Loading pyodide script... ", () => showLoading);
            await this.#loadScript(WebConsole.#pyoditeURL);
            showLoading = false;
            await loadingAnim;

            showLoading = true;
            loadingAnim = animateLoadingBar("Loading pyodide... ", () => showLoading);
            // Run python interpreter on console, until it exits
            let pyodide = await loadPyodide({
                stdin: stdin,
                stdout: stdout
            });
            showLoading = false;
            await loadingAnim;

            showLoading = true;
            loadingAnim = animateLoadingBar("Installing python packages... ", () => showLoading);
            // Install packages with micropip
            await pyodide.loadPackage("micropip");
            await pyodide.runPythonAsync("import micropip");
            let installpromises = this.#pypackages.map((pkg) => {
                return (async () => {
                    try {
                        await pyodide.runPythonAsync(`await micropip.install("${pkg}")`);
                    } catch (e) {
                        stdout('Error while installing python package "' + pkg + '"');
                    }
                })();
            });
            await Promise.all(installpromises);
            showLoading = false;
            await loadingAnim;

            showLoading = true;
            loadingAnim = animateLoadingBar("Loading python packages... ", () => showLoading);
            await pyodide.runPythonAsync("import sys");
            showLoading = false;
            await loadingAnim;
            removeLoadingBar();
            pyodide.runPython(`print(f'Python {sys.version})] on WebConsole\\nType "help", "copyright", "credits" or "license" for more information.')`);

            let pyError = false;

            do {
                let code = "";
                let input = await stdin(">>> ");

                // If input starts with "^", ctrl command

                if (input.startsWith("^")) {
                    let cmd = input.substring(1);
                    switch (cmd) {
                        case "C":
                            // Send keyboard interrupt
                            code = "raise KeyboardInterrupt()";
                            break;
                        default:
                            // Just type it in
                            code = input;
                            break;
                    }
                } else code = input;

                if (input.endsWith(":")) {
                    // next line
                    let nextline = await stdin("... ");
                    code += nextline;

                    // if empty line is found
                    while (nextline !== "") {
                        nextline = await stdin("... ");
                        if (nextline.startsWith("^")) {
                            code = "raise KeyboardInterrupt()";
                            break;
                        } else
                            code += "\n" + nextline;
                    }
                }

                // Run python
                try {
                    pyError = false;
                    let output = pyodide.runPython(code);
                    if (output !== undefined)
                        stdout(output);
                } catch (e) {
                    if (new String(e).match(/\nSystemExit/m)) {
                        pyError = true;
                        break;
                    }
                    // Remove pyodite error message from stack trace (Starts with "PythonError: Traceback (most recent call last):")
                    // Up until File "<exec>", line 1, in <module>
                    if (new String(e).match(/^PythonError: Traceback \(most recent call last\):/m)) {
                        let lines = new String(e).split("\n");
                        let i = 0;
                        for (; i < lines.length; i++) {
                            if (lines[i].match(/^[\s]*File "<exec>", line 1, in <module>/m))
                                break;
                        }
                        e = lines.slice(i + 1).join("\n");
                    }
                    stdout(e);
                }


            } while (!pyError);

        },
        "pyrun": async (args, stdout, stdin) => {
            let outpercentelem = document.createElement("div");
            outpercentelem.classList.add("webconsole-output-line");
            outpercentelem.innerHTML = "Loading pyodide...";
            this.#container.appendChild(outpercentelem);
            this.#container.scrollTop = this.#container.scrollHeight;

            let showLoading = true;

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

            showLoading = true;
            let loadingAnim = animateLoadingBar("Awaiting file upload... ", () => showLoading);
            let file;
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

            showLoading = true;
            loadingAnim = animateLoadingBar("Loading pyodide script... ", () => showLoading);
            await this.#loadScript(WebConsole.#pyoditeURL);
            showLoading = false;
            await loadingAnim;

            showLoading = true;
            loadingAnim = animateLoadingBar("Loading pyodide... ", () => showLoading);
            // Run python interpreter on console, until it exits
            let pyodide = await loadPyodide({
                stdin: stdin,
                stdout: stdout
            });
            showLoading = false;
            await loadingAnim;

            showLoading = true;
            loadingAnim = animateLoadingBar("Installing python packages... ", () => showLoading);
            // Install packages with micropip
            await pyodide.loadPackage("micropip");
            await pyodide.runPythonAsync("import micropip");
            let installpromises = this.#pypackages.map((pkg) => {
                return (async () => {

                    try {
                        await pyodide.runPythonAsync(`await micropip.install("${pkg}")`);
                    } catch (e) {
                        stdout("Error while installing python package " + pkg + ": " + e);
                    }
                })();
            });
            await Promise.all(installpromises);

            showLoading = false;
            await loadingAnim;


            showLoading = true;
            loadingAnim = animateLoadingBar("Loading python packages... ", () => showLoading);
            await pyodide.runPythonAsync("import sys");
            showLoading = false;
            await loadingAnim;

            // Run python file
            try {
                let output = pyodide.runPython(file);
                if (output !== undefined)
                    stdout(output);
            } catch (e) {
                // Remove pyodite error message from stack trace (Starts with "PythonError: Traceback (most recent call last):")
                // Up until File "<exec>", line 1, in <module>
                if (new String(e).match(/^PythonError: Traceback \(most recent call last\):/m)) {
                    let lines = new String(e).split("\n");
                    let i = 0;
                    for (; i < lines.length; i++) {
                        if (lines[i].match(/^[\s]*File "<exec>", line 1, in <module>/m))
                            break;
                    }
                    e = lines.slice(i + 1).join("\n");
                }
                stdout(e);
            }

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
        "exit": async (args, stdout, stdin) => {
            while (!(await stdin("Please press Ctrl+W to exit...")) != "^W") { }
        },
        "": () => { }
    }

    constructor(container) {
        this.#container = container;

        // Whenever new content is added, scroll to bottom
        this.#container.addEventListener("DOMNodeInserted", () => {
            this.#container.scrollTop = this.#container.scrollHeight;
        });

        this.#container.classList.add("webconsole-container");
        this.#input = document.createElement("input");
        // this.#input.type = "text";
        this.#input.classList.add("webconsole-input");

        this.#inputcontainer = document.createElement("div");
        this.#inputcontainer.classList.add("webconsole-input-container");
        this.#inputcontainer.appendChild(this.#input);

        document.addEventListener("DOMContentLoaded", () => {
            this.#input.focus();
        });

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
        this.#output.innerHTML = "WebConsole v" + WebConsole.VERSION + "\n(c) Tobias Kendlbacher 2023 - MIT License\nType 'help' for a list of commands.\nType 'nav' for navigation.\n\n";
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
}

globalThis.initMainWebconsole = initMainWebconsole;
