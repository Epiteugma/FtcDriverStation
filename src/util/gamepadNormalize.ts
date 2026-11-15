// Normalizes any browser Gamepad into the W3C "standard" layout:
// buttons[17] {pressed, value}, axes[4] (LX, LY, RX, RY).
// Needed for controllers Chromium doesn't map (mapping === ''), e.g. ZEROPLUS P4 (0c12:2e18)
// on Linux bound to hid-generic, which exposes a DS4-style raw HID layout.

export interface NormButton { pressed: boolean; value: number; }
export interface NormGamepad { id: string; index: number; mapping: string; layout: 'standard' | 'ds4-generic' | 'generic'; buttons: NormButton[]; axes: number[]; }
interface RawButton { pressed?: boolean; value?: number; }
export interface RawGamepad { id?: string; index?: number; mapping?: string; buttons?: ArrayLike<RawButton | null | undefined>; axes?: ArrayLike<number | null | undefined>; }

// Per-gamepad memory: Chromium reports 0 for analog axes until the first event arrives,
// which would make a resting trigger (-1..1 axis) read as 50 %. Only trust an analog trigger axis after it moved off 0.
const seenTriggerAxis = new Map<string, boolean[]>();

const NOT_PRESSED: NormButton = { pressed: false, value: 0 };

function btn(raw: RawGamepad, i: number): NormButton {
    const b = raw.buttons && i < raw.buttons.length ? raw.buttons[i] : null;
    if (!b) return { ...NOT_PRESSED };
    const value = typeof b.value === 'number' && isFinite(b.value) ? b.value : (b.pressed ? 1 : 0);
    return { pressed: !!b.pressed, value };
}

function axis(raw: RawGamepad, i: number): number {
    const v = raw.axes && i < raw.axes.length ? raw.axes[i] : 0;
    return typeof v === 'number' && isFinite(v) ? v : 0;
}

const digital = (pressed: boolean): NormButton => ({ pressed, value: pressed ? 1 : 0 });

export function isDs4Generic(raw: RawGamepad): boolean {
    const nb = raw.buttons?.length ?? 0, na = raw.axes?.length ?? 0;
    return raw.mapping !== 'standard' && nb >= 13 && na >= 6;
}

// Chromium "POV hat" axis encoding: up=-1, then clockwise in steps of 2/7; neutral ~ +9/7 (1.2857)
export function decodePovHat(v: number): { up: boolean; down: boolean; left: boolean; right: boolean } {
    const none = { up: false, down: false, left: false, right: false };
    if (!isFinite(v) || v < -1.05 || v > 1.05) return none;
    const dir = Math.round((v + 1) * 3.5); // 0..7
    if (Math.abs((v + 1) * 3.5 - dir) > 0.1) return none; // only exact POV steps (rejects Chromium's initial 0)
    switch (dir) {
        case 0: return { up: true, down: false, left: false, right: false };
        case 1: return { up: true, down: false, left: false, right: true };
        case 2: return { up: false, down: false, left: false, right: true };
        case 3: return { up: false, down: true, left: false, right: true };
        case 4: return { up: false, down: true, left: false, right: false };
        case 5: return { up: false, down: true, left: true, right: false };
        case 6: return { up: false, down: false, left: true, right: false };
        case 7: return { up: true, down: false, left: true, right: false };
    }
    return none;
}

function trigger(raw: RawGamepad, key: string, slot: number, axisIndex: number, buttonIndex: number): NormButton {
    const b = btn(raw, buttonIndex);
    let seen = seenTriggerAxis.get(key);
    if (!seen) seenTriggerAxis.set(key, seen = [false, false]);
    const a = axis(raw, axisIndex);
    if (a !== 0) seen[slot] = true;
    let value = seen[slot] ? Math.min(1, Math.max(0, (a + 1) / 2)) : 0;
    if (b.pressed && value < 0.5) value = Math.max(b.value, 1); // digital fallback
    return { pressed: b.pressed || value > 0.5, value };
}

export function normalize(raw: RawGamepad): NormGamepad {
    const id = raw.id ?? '', index = raw.index ?? -1, mapping = raw.mapping ?? '';

    if (mapping === 'standard') {
        const buttons: NormButton[] = [];
        for (let i = 0; i < 17; i++) buttons.push(btn(raw, i));
        return { id, index, mapping, layout: 'standard', buttons, axes: [axis(raw, 0), axis(raw, 1), axis(raw, 2), axis(raw, 3)] };
    }

    if (isDs4Generic(raw)) {
        const key = `${id}#${index}`;
        const na = raw.axes?.length ?? 0;
        // D-pad: separate hat axes 6/7 (evdev ABS_HAT0X/HAT0Y) and/or a POV-hat axis 9
        let up = false, down = false, left = false, right = false;
        if (na >= 8) {
            const hx = axis(raw, 6), hy = axis(raw, 7);
            if (Math.abs(hx) <= 1.01 && Math.abs(hy) <= 1.01) {
                left = hx < -0.5; right = hx > 0.5; up = hy < -0.5; down = hy > 0.5;
            }
        }
        if (na >= 10) {
            const p = decodePovHat(axis(raw, 9));
            up ||= p.up; down ||= p.down; left ||= p.left; right ||= p.right;
        }
        const buttons: NormButton[] = [
            btn(raw, 1),            // 0 A      <- cross
            btn(raw, 2),            // 1 B      <- circle
            btn(raw, 0),            // 2 X      <- square
            btn(raw, 3),            // 3 Y      <- triangle
            btn(raw, 4),            // 4 LB     <- L1
            btn(raw, 5),            // 5 RB     <- R1
            trigger(raw, key, 0, 3, 6), // 6 LT <- L2 analog (axis 3) / button 6
            trigger(raw, key, 1, 4, 7), // 7 RT <- R2 analog (axis 4) / button 7
            btn(raw, 8),            // 8 back   <- share
            btn(raw, 9),            // 9 start  <- options
            btn(raw, 10),           // 10 L3
            btn(raw, 11),           // 11 R3
            digital(up),            // 12
            digital(down),          // 13
            digital(left),          // 14
            digital(right),         // 15
            btn(raw, 12),           // 16 guide <- PS
        ];
        return { id, index, mapping, layout: 'ds4-generic', buttons, axes: [axis(raw, 0), axis(raw, 1), axis(raw, 2), axis(raw, 5)] };
    }

    // Unknown non-standard device: best effort, never index past the end
    const buttons: NormButton[] = [];
    for (let i = 0; i < 17; i++) buttons.push(btn(raw, i));
    return { id, index, mapping, layout: 'generic', buttons, axes: [axis(raw, 0), axis(raw, 1), axis(raw, 2), axis(raw, 3)] };
}

let lastDebug = new Map<number, string>();
export function debugLog(raw: RawGamepad | null) {
    if (!raw) return;
    const snap = JSON.stringify({
        id: raw.id, mapping: raw.mapping,
        buttons: Array.from(raw.buttons ?? [], b => (b?.pressed ? 1 : 0)).join(''),
        axes: Array.from(raw.axes ?? [], a => +(a ?? 0).toFixed(2)),
    });
    if (lastDebug.get(raw.index ?? -1) === snap) return;
    lastDebug.set(raw.index ?? -1, snap);
    console.log('[gamepad-debug]', raw.index, snap, '->', normalize(raw).layout);
}
