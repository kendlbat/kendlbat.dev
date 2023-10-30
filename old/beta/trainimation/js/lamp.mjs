export const LAMPCOLORS = {
    RED: "#f00",
    GREEN: "#4f4",
    YELLOW: "#ffeb2a",
    WHITE: "#fff"
};

export const LAMPOFF = "#222";

export const LAMPSIZES = {
    TINY: 2,
    SMALL: 8,
    NORMAL: 15
}

export const LAMPSTATES = {
    "OFF": 0,
    "ON": 1,
    "FLASH": 2
};

let customstyles = document.createElement("style");
customstyles.innerHTML = `
@keyframes trainsignallingjslampflash {
    50% {
        background-color: ${LAMPOFF};
    }
}
`;

document.head.appendChild(customstyles);

export class Lamp {
    #color;
    #state = LAMPSTATES.OFF;
    #size;
    #left;
    #top;
    #element;

    /**
     * 
     * @param {string} color 
     * @param {number} state 
     * @param {string} size 
     * @param {number} left center x
     * @param {number} top center y
     */
    constructor(color, size, left, top) {
        if (!(Object.keys(LAMPCOLORS).includes(color)))
            throw new Error("Invalid color");
        if (!(Object.keys(LAMPSIZES).includes(size)))
            throw new Error("Invalid size");

        this.#color = color;
        this.#size = size;
        this.#left = left;
        this.#top = top;
    }

    get color() {
        return this.#color;
    }

    set color(color) {
        this.#color = color;
        container.style.backgroundColor = this.#state > 0 ? LAMPCOLORS[this.#color] : LAMPOFF;
    }

    set state(state) {
        if (!(Object.values(LAMPSTATES).includes(state)))
            throw new Error("Invalid lampstate");
        this.#state = state;
        if (this.#element) {
            this.#element.style.animation = "";
            this.#element.style.backgroundColor = this.#state > 0 ? LAMPCOLORS[this.#color] : LAMPOFF;
            if (this.#state == LAMPSTATES.FLASH) {
                this.#element.style.animation = "trainsignallingjslampflash 2s steps(1, end) infinite";
            }
        }
    }

    get state() {
        return this.#state;
    }

    get size() {
        return this.#size;
    }

    get left() {
        return this.#left;
    }

    get top() {
        return this.#top;
    }



    #generateElement() {
        let container = document.createElement("div");
        container.style.width = `${LAMPSIZES[this.#size] * 2}px`;
        container.style.height = `${LAMPSIZES[this.#size] * 2}px`;
        container.style.left = `${this.#left}px`;
        container.style.top = `${this.#top}px`;
        container.style.transform = "translate(-50%, -50%)";
        container.style.borderRadius = "50%";
        container.style.backgroundColor = this.#state > 0 ? LAMPCOLORS[this.#color] : LAMPOFF;
        container.style.zIndex = this.#state;
        if (this.#state == LAMPSTATES.FLASH)
            container.style.animation = "trainsignallingjslampflash 2s steps(1, end) infinite";
        container.style.position = "absolute";
        container.style.display = "inline-block";
        container.style.border = `${LAMPSIZES[this.#size] / 2.8}px solid rgba(0, 0, 0, 0.15)`;
        return container;
    }

    getElement() {
        if (this.#element == undefined)
            this.#element = this.#generateElement();
        return this.#element;
    }
}