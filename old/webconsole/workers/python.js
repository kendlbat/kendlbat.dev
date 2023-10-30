/*
This worker can send the following messages:
 - "stdout": {data: string}
 - "stdin": {}
 - "exit": {code: number}

This worker can receive the following messages:
 - "stdin": {data: string}
*/

class PythonWorkerAPI {
    static #stdinlistener = null;

    static #listener = (e) => {
        if (e.data.type == "stdin") {
            PythonWorkerAPI.#stdinlistener(e.data.data);
            PythonWorkerAPI.#stdinlistener = null;
        }
    };

    static loadScript(url) {
        importScripts(url);
    }

    static async stdin(prompt) {
        return await new Promise((resolve) => {
            prompt = JSON.stringify(prompt);
            PythonWorkerAPI.#stdinlistener = (data) => { resolve(data); };
            self.postMessage({ type: "stdin", data: prompt });
        });
    }

    static specialListener(type, cbf) {
        let fun = (e) => {
            if (e.data.type == type) {
                cbf(e.data);
            }
        }
        self.addEventListener("message", fun);
        return fun;
    }

    static async requestResponse(type, data) {
        return await new Promise((resolve) => {
            let fun = PythonWorkerAPI.specialListener(type, (e) => {
                resolve(e.data);
                self.removeEventListener("message", fun);
            });
            self.postMessage({ type: type, data: data });
        });
    }

    static async sendMessage(type, data) {
        self.postMessage({ type: type, data: data });
    }

    static removeSpecialListener(fun) {
        self.removeEventListener("message", fun);
    }
    
    static stdout(data) {
        self.postMessage({ type: "stdout", data: JSON.stringify(data) });
    }
    
    static exit(code) {
        self.postMessage({ type: "exit", code: code });
        self.close();
    }
    
    static get listener() {
        return PythonWorkerAPI.#listener;
    }

    static hasStdinListener() {
        return PythonWorkerAPI.#stdinlistener !== null;
    }
}

async function stdin(prompt) {
    return await PythonWorkerAPI.stdin(prompt);
}

async function stdout(data) {
    PythonWorkerAPI.stdout(data);
}

async function main() {
    let pypackages = await PythonWorkerAPI.requestResponse("pypackages", null);
    console.log("Loading pyodide...");
    PythonWorkerAPI.loadScript("https://cdn.jsdelivr.net/pyodide/v0.23.1/full/pyodide.js");

    let pyodide = await loadPyodide({
        stdout: stdout,
        stderr: (e) => {
            alert("Printed to stderr: " + e);
            if (new String(e).match(/\nSystemExit/m)) {
                PythonWorkerAPI.exit(0);
            }
        }
    });

    await pyodide.loadPackage("micropip");
    await pyodide.runPythonAsync("import micropip");
    console.log("Python packages to install: " + pypackages);
    let installpromises = pypackages.map((pkg) => {
        return (async () => {
            try {
                await pyodide.runPythonAsync(`await micropip.install("${pkg}")`);
            } catch (e) {
                stdout('Error while installing python package "' + pkg + '"');
            }
        })();
    });
    await Promise.all(installpromises);

    await pyodide.runPythonAsync("import sys");
    await pyodide.runPythonAsync("from time import sleep");
    await pyodide.runPythonAsync("from js import stdin");
    // Import pyodide webloop
    await pyodide.runPythonAsync("import asyncio");

    await pyodide.runPythonAsync("async def input(prompt=''): return await asyncio.get_event_loop().run_until_complete(stdin(prompt))");
    await pyodide.runPythonAsync("__builtins__.input = input");

    await PythonWorkerAPI.requestResponse("ready", null);

    await pyodide.runPythonAsync(`print(f'Python {sys.version})] on WebConsole\\nType "copyright()", "credits()" or "license()" for more information.')`);

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
            let hasResolved = false;

            // Replace all occurences of "input" without "await" before into "await input"
            code = code.replace(/(?<!await )input\(/g, "await input(");

            let hangDetectionInterval = setInterval(() => {
                if (!hasResolved) {
                    if (pyodide.runPython("1") === 1 && !hasResolved && !PythonWorkerAPI.hasStdinListener()) {
                        console.warn("Python killed by hang detection");
                        clearInterval(hangDetectionInterval);
                        PythonWorkerAPI.exit(0);
                    } else if (pyodide.runPython("1") !== 1) {
                        clearInterval(hangDetectionInterval);
                        PythonWorkerAPI.exit(1);
                    }
                }
            }, 200);

            let exec = pyodide.runPythonAsync(code);

            // If anything happens in exec, immediately log
            exec.then((output) => {
                hasResolved = true;
                if (output !== undefined && output !== {})
                    stdout(output);
            });

            exec.catch((e) => {
                if (new String(e).match(/\nSystemExit/m)) {
                    pyError = true;
                    return;
                }
                hasResolved = true;
            });

            await exec;

            hasResolved = true;
            clearInterval(hangDetectionInterval);
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
            console.log(e);
            stdout(e);
        }


    } while (!pyError);
}

const starteventlistener = (e) => {
    if (e.data.type == "start") {
        main();
        self.removeEventListener("message", starteventlistener);
    }
};


self.addEventListener("message", PythonWorkerAPI.listener);
self.addEventListener("message", starteventlistener);
