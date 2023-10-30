import { Hauptsignal, HauptsignalSignalStates } from "./js/hauptsignal.mjs";
import { HauptsignalStateZuSignalnachahmer, Signalnachahmer } from "./js/signalnachahmer.mjs";
import { HauptsignalStateZuVorsignal, Vorsignal } from "./js/vorsignal.mjs";

let sigidx = 1;

let select = document.createElement("select");

function setSignalStates(mainsignalstate) {
    Hauptsignal.applyState(mainsignalstate);
    Vorsignal.applyState(HauptsignalStateZuVorsignal[mainsignalstate]);
    Signalnachahmer.applyState(HauptsignalStateZuSignalnachahmer[mainsignalstate]);
}

for (let statekey of Hauptsignal.sigstatecoll.getKeys()) {
    let opt = document.createElement("option");
    opt.innerText = Hauptsignal.sigstatecoll.getStateName(statekey);
    opt.value = statekey;
    select.appendChild(opt);
}

select.addEventListener("change", () => {
    setSignalStates(select.value);
});

select.selectedIndex = 0;
select.style.marginBottom = "10px";

document.body.appendChild(select);
document.body.appendChild(document.createElement("br"));

document.body.appendChild(Hauptsignal.getElement());
document.body.appendChild(document.createElement("br"));
document.body.appendChild(Vorsignal.getElement());
document.body.appendChild(document.createElement("br"));
document.body.appendChild(Signalnachahmer.getElement());
setSignalStates(select.value);



// setTimeout(testSignalLoop, 1000);