// Main-process rumble fallback for DS4-layout controllers via /dev/hidrawN (no native modules).
// Needed for e.g. ZEROPLUS P4 (0c12:2e18) on hid-generic: no kernel force-feedback, so Gamepad.vibrationActuator can't work.
import * as fs from 'fs';
import * as path from 'path';

export const KNOWN_DS4_LAYOUT = new Set(['0c12:2e18', '054c:05c4', '054c:09cc']);

export interface HidrawDevice { name: string; devPath: string; vendor: string; product: string; hidName: string; known: boolean; ds4Descriptor: boolean; }

export function parseUevent(text: string) {
    const m = /^HID_ID=([0-9A-Fa-f]{4}):([0-9A-Fa-f]{8}):([0-9A-Fa-f]{8})$/m.exec(text);
    if (!m) return null;
    const name = /^HID_NAME=(.*)$/m.exec(text)?.[1] ?? '';
    return { bus: m[1].toLowerCase(), vendor: m[2].slice(4).toLowerCase(), product: m[3].slice(4).toLowerCase(), hidName: name };
}

// Walk HID report descriptor items; return total output bits per report ID.
export function outputReportBits(desc: Uint8Array): Map<number, number> {
    const bits = new Map<number, number>();
    let reportId = 0, reportSize = 0, reportCount = 0;
    const stack: number[][] = [];
    for (let i = 0; i < desc.length;) {
        const prefix = desc[i];
        if (prefix === 0xfe) { i += 3 + (desc[i + 1] ?? 0); continue; } // long item
        const size = [0, 1, 2, 4][prefix & 0x03];
        let data = 0;
        for (let b = 0; b < size; b++) data |= (desc[i + 1 + b] ?? 0) << (8 * b);
        const tag = prefix & 0xfc;
        switch (tag) {
            case 0x84: reportId = data; break;            // Report ID (global)
            case 0x74: reportSize = data; break;          // Report Size
            case 0x94: reportCount = data; break;         // Report Count
            case 0xa4: stack.push([reportId, reportSize, reportCount]); break; // Push
            case 0xb4: { const s = stack.pop(); if (s) [reportId, reportSize, reportCount] = s; break; } // Pop
            case 0x90: bits.set(reportId, (bits.get(reportId) ?? 0) + reportSize * reportCount); break; // Output
        }
        i += 1 + size;
    }
    return bits;
}

export function hasDs4OutputReport(desc: Uint8Array) {
    return outputReportBits(desc).get(0x05) === 31 * 8;
}

export function listHidraw(sysRoot = '/sys/class/hidraw', devRoot = '/dev'): HidrawDevice[] {
    let names: string[] = [];
    try { names = fs.readdirSync(sysRoot).filter(n => /^hidraw\d+$/.test(n)); } catch { return []; }
    names.sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
    const out: HidrawDevice[] = [];
    for (const name of names) {
        let ue;
        try { ue = parseUevent(fs.readFileSync(path.join(sysRoot, name, 'device', 'uevent'), 'utf8')); } catch { continue; }
        if (!ue) continue;
        let ds4Descriptor = false;
        try { ds4Descriptor = hasDs4OutputReport(fs.readFileSync(path.join(sysRoot, name, 'device', 'report_descriptor'))); } catch {}
        out.push({ name, devPath: path.join(devRoot, name), vendor: ue.vendor, product: ue.product, hidName: ue.hidName,
            known: KNOWN_DS4_LAYOUT.has(`${ue.vendor}:${ue.product}`), ds4Descriptor });
    }
    return out;
}

export function findDs4Hidraw(vendor: string, product: string, sysRoot?: string, devRoot?: string): HidrawDevice | null {
    vendor = vendor.toLowerCase(); product = product.toLowerCase();
    const matches = listHidraw(sysRoot, devRoot).filter(d => d.vendor === vendor && d.product === product && (d.known || d.ds4Descriptor));
    // prefer the interface whose descriptor really has output report 0x05/31 bytes
    matches.sort((a, b) => Number(b.ds4Descriptor) - Number(a.ds4Descriptor));
    return matches[0] ?? null;
}

// DS4 USB output report 0x05 (32 bytes): [0x05, 0x01 (rumble enable), 0, 0, weak/right/small, strong/left/large, 0...]
export function ds4RumbleReport(weak: number, strong: number): Buffer {
    const b = Buffer.alloc(32);
    b[0] = 0x05; b[1] = 0x01;
    b[4] = Math.max(0, Math.min(255, Math.round(weak)));
    b[5] = Math.max(0, Math.min(255, Math.round(strong)));
    return b;
}

export function writeRumble(devPath: string, weak: number, strong: number) {
    const fd = fs.openSync(devPath, 'w');
    try { fs.writeSync(fd, ds4RumbleReport(weak, strong)); } finally { fs.closeSync(fd); }
}

// Keeps a device cache and refreshes non-zero rumble every second (some clones time out).
export class HidrawRumble {
    private cache = new Map<string, HidrawDevice | null>();
    private refresh = new Map<string, any>();
    constructor(private sysRoot?: string, private devRoot?: string, private log: (...a: any[]) => void = () => {}) {}

    rumble(vendor: string, product: string, large: number, small: number): { ok: boolean; via: string; device?: string; error?: string } {
        const key = `${vendor}:${product}`.toLowerCase();
        let dev = this.cache.get(key);
        if (dev === undefined) { dev = findDs4Hidraw(vendor, product, this.sysRoot, this.devRoot); this.cache.set(key, dev); }
        if (!dev) { this.log('[rumble] no DS4-layout hidraw device for', key); return { ok: false, via: 'hidraw', error: 'no-device' }; }
        clearInterval(this.refresh.get(dev.devPath));
        try {
            writeRumble(dev.devPath, small, large);
            this.log('[rumble] hidraw', dev.devPath, 'strong', large, 'weak', small);
            if (large || small) this.refresh.set(dev.devPath, setInterval(() => { try { writeRumble(dev!.devPath, small, large); } catch {} }, 1000));
            return { ok: true, via: 'hidraw', device: dev.devPath };
        } catch (e: any) {
            this.cache.delete(key); // re-scan next time (unplugged / renumbered)
            this.log('[rumble] hidraw write failed', dev.devPath, e?.code || e?.message);
            return { ok: false, via: 'hidraw', device: dev.devPath, error: e?.code || String(e) };
        }
    }
}
