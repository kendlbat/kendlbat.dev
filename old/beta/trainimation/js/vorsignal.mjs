import { LAMPSTATES, Lamp } from "./lamp.mjs";
import { Signal, SignalstateCollection } from "./signal.mjs";

const { ON, OFF, FLASH } = LAMPSTATES;

const VorsignalSignalStates = new SignalstateCollection(4);

VorsignalSignalStates.addState("CAUTION", "Vorsicht",
    [ON, ON, OFF, OFF]);
VorsignalSignalStates.addState("MAINFREE", "Hauptsignal frei",
    [OFF, OFF, ON, ON]);
VorsignalSignalStates.addState("MAINFREE60", "Hauptsignal frei mit 60km/h",
    [ON, OFF, ON, ON]);
VorsignalSignalStates.addState("MAINFREE40", "Hauptsignal frei mit 40km/h",
    [ON, ON, ON, OFF]);

const HauptsignalStateZuVorsignal = {
    "STOP": "CAUTION",
    "FREE": "MAINFREE",
    "FREE60": "MAINFREE60",
    "FREE40": "MAINFREE40",
    "REPLACEMENT": "CAUTION",
    "SHUNTINGALLOWED": "CAUTION",
    "DEPART": "MAINFREE"
};

const Vorsignal = new Signal(120, 120, [
    new Lamp("YELLOW", "NORMAL", 30, 30),
    new Lamp("YELLOW", "NORMAL", 90, 30),
    new Lamp("GREEN", "NORMAL", 30, 90),
    new Lamp("GREEN", "NORMAL", 90, 70)
], VorsignalSignalStates);

export { Vorsignal, VorsignalSignalStates, HauptsignalStateZuVorsignal };