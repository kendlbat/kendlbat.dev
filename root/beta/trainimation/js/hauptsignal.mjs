import { Lamp, LAMPSTATES } from "./lamp.mjs";
import { SignalstateCollection, Signal } from "./signal.mjs";

const { ON, OFF, FLASH } = LAMPSTATES;

const HauptsignalSignalStates = new SignalstateCollection(8);

HauptsignalSignalStates.addState("STOP", "Halt",
    [OFF, OFF, OFF, OFF, OFF, OFF, OFF, ON]);
HauptsignalSignalStates.addState("FREE", "Frei",
    [OFF, ON, OFF, OFF, OFF, OFF, OFF, OFF]);
HauptsignalSignalStates.addState("FREE60", "Frei mit 60km/h",
    [OFF, ON, OFF, OFF, OFF, OFF, ON, OFF]);
HauptsignalSignalStates.addState("FREE40", "Frei mit 40km/h",
    [OFF, ON, OFF, OFF, OFF, ON, OFF, OFF]);
HauptsignalSignalStates.addState("REPLACEMENT", "Ersatzsignal",
    [FLASH, OFF, OFF, OFF, OFF, OFF, OFF, ON]);
HauptsignalSignalStates.addState("SHUNTINGALLOWED", "Verschubverbot aufgehoben",
    [OFF, OFF, ON, ON, OFF, OFF, OFF, ON]);
HauptsignalSignalStates.addState("DEPART", "Abfahrt",
    [OFF, ON, OFF, OFF, FLASH, OFF, OFF, OFF]);

const Hauptsignal = new Signal(120, 270, [
    new Lamp("WHITE", "SMALL", 30, 30),
    new Lamp("GREEN", "NORMAL", 90, 30),
    new Lamp("WHITE", "SMALL", 90, 90),
    new Lamp("WHITE", "SMALL", 30, 150),
    new Lamp("GREEN", "SMALL", 90, 135),
    new Lamp("YELLOW", "NORMAL", 90, 180),
    new Lamp("GREEN", "NORMAL", 90, 240),
    new Lamp("RED", "NORMAL", 30, 240)
], HauptsignalSignalStates);

Hauptsignal.applyState("STOP");

export { Hauptsignal, HauptsignalSignalStates };