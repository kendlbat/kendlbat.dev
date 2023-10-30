import { LAMPSTATES, Lamp } from "./lamp.mjs";
import { Signal, SignalstateCollection } from "./signal.mjs";

const { ON, OFF, FLASH } = LAMPSTATES;

const SignalnachahmerSignalStates = new SignalstateCollection(28);

SignalnachahmerSignalStates.addState("MAINSTOP", "Hauptsignal zeigt Halt",
[
    ON, ON, ON, ON, ON, ON,
    ON, ON, ON, ON, ON, ON,
    OFF, OFF, OFF, OFF, OFF, OFF,
    OFF, OFF, OFF, OFF, OFF, OFF,
    OFF, OFF, OFF, OFF
]);
SignalnachahmerSignalStates.addState("MAINFREE", "Hauptsignal zeigt Frei",
[
    ON, ON, ON, ON, ON, ON,
    OFF, OFF, OFF, OFF, OFF, OFF,
    ON, ON, ON, ON, ON, ON,
    OFF, OFF, OFF, OFF, OFF, OFF,
    OFF, OFF, OFF, OFF
]);
SignalnachahmerSignalStates.addState("MAINLIMITED", "Hauptsignal zeigt Frei mit Geschwindigkeitsbegrenzung",
[
    ON, ON, ON, ON, ON, ON,
    OFF, OFF, OFF, OFF, OFF, OFF,
    OFF, OFF, OFF, OFF, OFF, OFF,
    ON, ON, ON, ON, ON, ON,
    OFF, OFF, OFF, OFF
]);
SignalnachahmerSignalStates.addState("MAINREPLACEMENT", "Hauptsignal zeigt Ersatzsignal",
[
    ON, ON, ON, ON, ON, ON,
    ON, ON, ON, ON, ON, ON,
    OFF, OFF, OFF, OFF, OFF, OFF,
    OFF, OFF, OFF, OFF, OFF, OFF,
    FLASH, FLASH, FLASH, FLASH
]);

const HauptsignalStateZuSignalnachahmer = {
    "STOP": "MAINSTOP",
    "FREE": "MAINFREE",
    "FREE60": "MAINLIMITED",
    "FREE40": "MAINLIMITED",
    "REPLACEMENT": "MAINREPLACEMENT",
    "SHUNTINGALLOWED": "MAINSTOP",
    "DEPART": "MAINFREE"
};

const Signalnachahmer = new Signal(70, 106, [
    // Base vertical lamps, always on
    new Lamp("WHITE", "TINY", 10, 56),
    new Lamp("WHITE", "TINY", 10, 64),
    new Lamp("WHITE", "TINY", 10, 72),
    new Lamp("WHITE", "TINY", 10, 80),
    new Lamp("WHITE", "TINY", 10, 88),
    new Lamp("WHITE", "TINY", 10, 96),

    // Halt - horizontal line
    new Lamp("WHITE", "TINY", 20, 52),
    new Lamp("WHITE", "TINY", 28, 52),
    new Lamp("WHITE", "TINY", 36, 52),
    new Lamp("WHITE", "TINY", 44, 52),
    new Lamp("WHITE", "TINY", 52, 52),
    new Lamp("WHITE", "TINY", 60, 52),

    // Hauptsignal frei - Diagonal from middle to top right
    new Lamp("WHITE", "TINY", 18, 48),
    new Lamp("WHITE", "TINY", 26, 40),
    new Lamp("WHITE", "TINY", 34, 32),
    new Lamp("WHITE", "TINY", 42, 24),
    new Lamp("WHITE", "TINY", 50, 16),
    new Lamp("WHITE", "TINY", 58, 8),

    // Hauptsignal zeigt frei mit Geschwindigkeitsbeg. - Diagonal from middle to bottom right
    new Lamp("WHITE", "TINY", 18, 56),
    new Lamp("WHITE", "TINY", 26, 64),
    new Lamp("WHITE", "TINY", 34, 72),
    new Lamp("WHITE", "TINY", 42, 80),
    new Lamp("WHITE", "TINY", 50, 88),
    new Lamp("WHITE", "TINY", 58, 96),

    // Four lamps for replacement signal
    new Lamp("WHITE", "TINY", 36, 88),
    new Lamp("WHITE", "TINY", 44, 88),
    new Lamp("WHITE", "TINY", 36, 96),
    new Lamp("WHITE", "TINY", 44, 96),
], SignalnachahmerSignalStates, "1px");

export { Signalnachahmer, SignalnachahmerSignalStates, HauptsignalStateZuSignalnachahmer };