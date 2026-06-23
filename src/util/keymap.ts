const defaultKeys = {
    leftStickXMinus: 'A',
    leftStickXPlus: 'D',
    leftStickYMinus: 'W',
    leftStickYPlus: 'S',
    rightStickXMinus: 'ArrowLeft',
    rightStickXPlus: 'ArrowRight',
    rightStickYMinus: 'ArrowUp',
    rightStickYPlus: 'ArrowDown',
    a: 'Space',
    b: 'B',
    x: 'X',
    y: 'Y',
    leftBumper: 'Q',
    rightBumper: 'E',
    leftTrigger: 'Z',
    rightTrigger: 'C',
    back: 'Backspace',
    start: 'Enter',
    leftStickButton: 'Shift',
    rightStickButton: 'Control',
    dpadUp: 'I',
    dpadDown: 'K',
    dpadLeft: 'J',
    dpadRight: 'L',
};

export let cachedKeymap: { [key: string]: string } = {};

export function reloadKeymap() {
    try {
        cachedKeymap = JSON.parse(localStorage.keymap_config);

        if (!cachedKeymap || typeof cachedKeymap !== 'object' || Array.isArray(cachedKeymap)) {
            throw 'bad keymap_config data';
        }
    } catch {
        cachedKeymap = {};
    }
}

export function getKey(mapping: string) {
    return cachedKeymap[mapping] || defaultKeys[mapping];
}

export function normalizeKey(key: string) {
    return key.length > 1 ? key : key.toUpperCase();
}

export default defaultKeys;
