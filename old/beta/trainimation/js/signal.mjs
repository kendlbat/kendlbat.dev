import { Lamp } from "./lamp.mjs";

export class Signal {
    #width;
    #height;
    #lamps;
    #sigstatecoll;
    #element;
    #borderradius;

    /**
     * 
     * @param {number} width 
     * @param {number} height 
     * @param {[Lamp]} lamps 
     * @param {SignalstateCollection} signalstatecoll
     * @param {string | undefined}
     */
    constructor(width, height, lamps, signalstatecoll, borderradius) {
        this.#width = width;
        this.#height = height;
        this.#lamps = lamps;
        if (!(signalstatecoll instanceof SignalstateCollection))
            throw new Error("signalstatecoll has to be of type SignalstateColl");
        if (this.#lamps.length != signalstatecoll.lampamount)
            throw new Error("SignalstateCollection has wrong lamp amount");
        this.#sigstatecoll = signalstatecoll;
        this.#borderradius = borderradius || "20px";
    }

    get width() {
        return this.#width;
    }

    get height() {
        return this.#height;
    }

    get lamps() {
        return this.#lamps;
    }

    get lampamount() {
        return this.#lamps.length;
    }

    #generateElement() {
        const container = document.createElement("div");
        container.style.width = `${this.#width}px`;
        container.style.height = `${this.#height}px`;
        container.style.borderRadius = this.#borderradius;
        container.style.backgroundColor = "black";
        container.style.position = "relative";
        container.style.left = 0;
        container.style.top = 0;
        container.style.display = "inline-block";
        container.classList.add("trainsignallingjssignal");

        for (let lamp of this.#lamps) {
            container.appendChild(lamp.getElement());
        }

        return container;
    }

    /**
     * 
     * @param {[boolean]} statelist 
     */
    applyCustomStatelist(statelist) {
        if (!Array.isArray(statelist)) throw new Error("Argument needs to be of type Array<boolean>");
        if (statelist.length != this.lampamount) throw new Error("Argument has wrong lamp amount");

        for (let i in this.#lamps) {
            this.#lamps[i].state = statelist[i];
        }
    }

    applyState(discriminator) {
        this.applyCustomStatelist(this.#sigstatecoll.getStatelist(discriminator));
    }

    get sigstatecoll() {
        return this.#sigstatecoll;
    }

    getElement() {
        if (this.#element == undefined)
            this.#element = this.#generateElement();
        return this.#element;
    }
}

export class SignalstateCollection {
    #lampamount;
    #states = {};

    /**
     * 
     * @param {number} lampamount 
     */
    constructor(lampamount) {
        this.#lampamount = lampamount;
    }

    addState(discriminator, name, statelist) {
        if (statelist.length != this.#lampamount)
            throw new Error("statelist has wrong length");
        this.#states[discriminator] = { name, statelist};
    }

    getStateName(discriminator) {
        return this.#states[discriminator]["name"];
    }

    getStatelist(discriminator) {
        if (!Object.keys(this.#states).includes(discriminator)) throw new Error("Invalid discriminator");
        return this.#states[discriminator]["statelist"];
    }

    getKeys() {
        return Object.keys(this.#states);
    }

    get lampamount() {
        return this.#lampamount;
    }
}