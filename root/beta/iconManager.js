
document.addEventListener("DOMContentLoaded", async () => {
    let url = "https://cdn.kde.org/breeze-icons/";
    let stylefile = "icons.css";
    console.log("ICONS:\nBreeze icons copyright KDE and licenced under the GNU LGPL version 3 or later\nhttps://develop.kde.org/frameworks/breeze-icons/");

    let icons = localStorage.getItem("icons");
    if (!icons) {
        let response = await fetch(url + stylefile);
        icons = await response.text();
        localStorage.setItem("icons", icons);
    } else {
        console.log("Using cached icons");
    }

    icons = icons.replace(/url\(([\"\']?)([^\"\')]+)([\"\']?)\)/g, (match, p1, p2, p3) => {
        return "url(" + url + p2 + ")";
    });
    let style = document.createElement("style");
    style.innerHTML = icons;

    document.head.appendChild(style);
});

globalThis.iconManager = {
    createIcon: (iconName) => {
        let icon = document.createElement("i");
        icon.classList.add("icon");
        icon.classList.add("icon_" + iconName);
        return icon;
    }
};