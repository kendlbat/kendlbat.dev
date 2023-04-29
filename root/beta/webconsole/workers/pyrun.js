/*
This worker can send the following messages:
 - "stdout": {data: string}
 - "stdin": {}
 - "exit": {code: number}

This worker can receive the following messages:
 - "stdin": {data: string}
*/

class PyrunWorkerAPI {
    static #stdinlistener = null;
    static #listener = (e) => {
        if (e.data.type == "stdin") {
            PyrunWorkerAPI.#stdinlistener(e.data.data);
            PyrunWorkerAPI.#stdinlistener = nulls;
        }
    };

    static loadScript(url) {
        importScripts(url);
    }

    static async stdin(prompt) {
        return await new Promise((resolve) => {
            prompt = JSON.stringify(prompt);
            PyrunWorkerAPI.#stdinlistener = (data) => { resolve(data); };
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
            let fun = PyrunWorkerAPI.specialListener(type, (e) => {
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
        self.postMessage({ type: "stdout", data: data });
    }

    static exit(code) {
        self.postMessage({ type: "exit", code: code });
        self.close();
    }

    static get listener() {
        return PyrunWorkerAPI.#listener;
    }

    static hasStdinListener() {
        return PyrunWorkerAPI.#stdinlistener !== null;
    }
}

async function stdin(prompt) {
    return await PyrunWorkerAPI.stdin(prompt);
}

async function stdout(data) {
    PyrunWorkerAPI.stdout(JSON.stringify(data));
}

async function main() {
    let pypackages = await PyrunWorkerAPI.requestResponse("pypackages", null);
    let args = JSON.parse(await PyrunWorkerAPI.requestResponse("args", null));
    let file = await PyrunWorkerAPI.requestResponse("file", null);

    console.log("Loading pyodide...");
    PyrunWorkerAPI.loadScript("https://cdn.jsdelivr.net/pyodide/v0.23.1/full/pyodide.js");

    let pyodide = await loadPyodide({
        stdout: stdout
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

    await PyrunWorkerAPI.requestResponse("ready", null);

    await pyodide.runPythonAsync(`print(f'Python {sys.version})] on WebConsole\\nType "help", "copyright", "credits" or "license" for more information.')`);

    let pyError = false;


    // Run python
    try {
        pyError = false;
        let hasResolved = false;

        // Replace all occurences of "input" without "await" before into "await input"
        file = file.replace(/(?<!await )input/g, "await input");

        let hangDetectionInterval = setInterval(() => {
            if (pyError) {
                clearInterval(hangDetectionInterval);
                PyrunWorkerAPI.exit(1);
            }
            if (!hasResolved) {
                if (pyodide.runPython("1") === 1 && !hasResolved && !PyrunWorkerAPI.hasStdinListener()) {
                    console.warn("Python killed by hang detection");
                    clearInterval(hangDetectionInterval);
                    PyrunWorkerAPI.exit(0);
                } else if (pyodide.runPython("1") !== 1) {
                    clearInterval(hangDetectionInterval);
                    PyrunWorkerAPI.exit(1);
                }
            }
        }, 200);

        let exec = pyodide.runPythonAsync(file);

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
            return;
        }
        // Remove pyodite error message from stack trace (Starts with "PythonError: Traceback (most recent call last):")
        // Up until File "<exec>", line 1, in <module>
        if (new String(e).match(/^PythonError: Traceback \(most recent call last\):/m)) {
            let lines = new String(e).split("\n");
            let i = 0;
            for (; i < lines.length; i++) {
                if (lines[i].match(/^[\s]*File "<exec>", line 1, in <module>/m))
                    return;
            }
            e = lines.slice(i + 1).join("\n");
        }
        console.log(e);
        stdout(e);
    }
    PyrunWorkerAPI.exit(0);
}

const starteventlistener = (e) => {
    if (e.data.type == "start") {
        main();
        self.removeEventListener("message", starteventlistener);
    }
};


self.addEventListener("message", PyrunWorkerAPI.listener);
self.addEventListener("message", starteventlistener);
