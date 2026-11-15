// FTC SDK 12 rumble: RC sends Command "CMD_RUMBLE_EFFECT" with extra = Gson of Gamepad.RumbleEffect:
//   {"user":1,"steps":[{"large":255,"small":0,"duration":250}, ...]}
// user: 1 = gamepad1, 2 = gamepad2 (GamepadUser.ONE/TWO); large = rumble1 (left/strong motor), small = rumble2 (right/weak), 0..255;
// duration in ms, -1 = continuous (Gamepad.RUMBLE_DURATION_CONTINUOUS; stopRumble() = single step 0,0,-1).

export interface RumbleStep { large: number; small: number; duration: number; }
export interface RumbleEffect { user: number; steps: RumbleStep[]; }
export type RumbleOutput = (user: number, large: number, small: number, durationMs: number) => void;

const clampByte = (v: any) => Math.max(0, Math.min(255, Math.round(Number(v) || 0)));

export function parseRumbleEffect(extra: unknown): RumbleEffect | null {
    let obj: any = extra;
    if (typeof extra === 'string') {
        try { obj = JSON.parse(extra); } catch { return null; }
    }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.steps)) return null;
    const user = Number(obj.user);
    if (user !== 1 && user !== 2) return null;
    const steps: RumbleStep[] = [];
    for (const s of obj.steps) {
        if (!s || typeof s !== 'object') continue;
        let duration = Math.round(Number(s.duration));
        if (!isFinite(duration)) continue;
        if (duration < 0) duration = -1;
        steps.push({ large: clampByte(s.large), small: clampByte(s.small), duration });
    }
    return { user, steps };
}

interface Timers { setTimeout: (fn: () => void, ms: number) => any; clearTimeout: (h: any) => void; }

// Plays step sequences per user; a new effect for a user pre-empts the running one (like the SDK DS).
export class RumblePlayer {
    private timers: { [user: number]: any } = {};
    constructor(private output: RumbleOutput, private t: Timers = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: h => clearTimeout(h) }) {}

    play(effect: RumbleEffect) {
        this.cancel(effect.user);
        const steps = effect.steps;
        if (!steps.length) { this.output(effect.user, 0, 0, -1); return; }
        const run = (i: number) => {
            if (i >= steps.length) { delete this.timers[effect.user]; this.output(effect.user, 0, 0, -1); return; }
            const s = steps[i];
            this.output(effect.user, s.large, s.small, s.duration);
            if (s.duration === -1) { delete this.timers[effect.user]; return; } // continuous: hold until next effect
            this.timers[effect.user] = this.t.setTimeout(() => run(i + 1), s.duration);
        };
        run(0);
    }

    pulse(user: number, ms = 250, level = 160) {
        this.play({ user, steps: [{ large: level, small: level, duration: ms }] });
    }

    cancel(user: number) {
        if (this.timers[user] !== undefined) { this.t.clearTimeout(this.timers[user]); delete this.timers[user]; }
    }

    stopAll() {
        for (const u of [1, 2]) { this.cancel(u); this.output(u, 0, 0, -1); }
    }
}

// Chromium Linux gamepad id: "ZEROPLUS P4 Wired Gamepad (Vendor: 0c12 Product: 2e18)"
export function parseVendorProduct(id: string): { vendor: string; product: string } | null {
    const m = /Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})/i.exec(id || '');
    return m ? { vendor: m[1].toLowerCase(), product: m[2].toLowerCase() } : null;
}

export function gamepadDisplayName(id: string) {
    return (id || '').replace(/\s*\((?:STANDARD GAMEPAD\s*)?Vendor:.*\)\s*$/i, '').trim() || 'gamepad';
}
