/**
 * 
 * @param {string} url 
 * @returns {Promise<string>}
 */
async function iconManagerCacheURL(url) {
    let data = localStorage.getItem("iconManagerCache" + url);
    if (data) {
        return data;
    }

    let response = await fetch(url);
    data = await response.arrayBuffer();
    let blob = new Blob([data], {type: response.headers.get("content-type")});
    let dataUrl = await new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
    localStorage.setItem("iconManagerCache" + url, dataUrl);
    return dataUrl;
}

window.initIconManager = async () => {
    let url = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.4/font/";
    let stylefile = "bootstrap-icons.css";

    let version = localStorage.getItem("lastVersion");
    if (version !== window.WEBCONSOLE_VERSIONID) {
        localStorage.clear();
        localStorage.setItem("lastVersion", window.WEBCONSOLE_VERSIONID);
    }

    let icons = localStorage.getItem("icons");
    if (!icons) {
        let response = await fetch(url + stylefile);
        icons = await response.text();
        localStorage.setItem("icons", icons);
    } else {
        console.log("Using cached icons");
    }

    // Create a list of replacements
    let matches = [];
    let iconMatches = icons.matchAll(/url\(([\"\']?)([^\"\')]+)([\"\']?)\)/g);

    for (let match of iconMatches) {
        matches.push({
            match: match[0],
            url: match[2]
        });
    }

    for (let match of matches) {
        icons = icons.replace(match.match, "url(" + await iconManagerCacheURL(url + match.url) + ")");
    }

    let style = document.createElement("style");
    style.innerHTML = icons;

    document.head.appendChild(style);
};

window.iconManager = {
    createIcon: (iconName) => {
        let icon = document.createElement("i");
        icon.classList.add("bi");
        icon.classList.add("bi-" + iconName);
        return icon;
    }
};