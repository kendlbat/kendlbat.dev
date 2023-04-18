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

