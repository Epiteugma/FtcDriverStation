import fixture from '../src/librobocol/tests/fixtures/sdk12-camera-stream.json';
import { CHUNK_SIZE, ReceiveFrameBegin, ReceiveFrameChunk, decodeBase64 } from '../src/librobocol/commands/cameraStream';

export { fixture };

/** JPEG produced for the SDK 12.0 fixtures (240x180, 3 chunks) */
export const sdkJpeg = decodeBase64(fixture.jpegBase64)!;

export const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map(h => parseInt(h, 16)));

export function chunksOf(data: Uint8Array, frameNum: number) {
    let chunks: ReceiveFrameChunk[] = [];
    for (let i = 0; i * CHUNK_SIZE < data.length; i++) chunks.push(new ReceiveFrameChunk(frameNum, i, data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)));
    return chunks;
}

export function beginOf(data: Uint8Array, frameNum: number) {
    return new ReceiveFrameBegin(frameNum, data.length);
}

/** Reads width/height from the JPEG SOFn marker, like a real decoder would need to. Rejects anything else. */
export async function decodeJpegSize(blob: Blob) {
    let b = new Uint8Array(await blob.arrayBuffer());
    if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('not a JPEG');

    let i = 2;
    while (i + 9 < b.length) {
        if (b[i] !== 0xff) throw new Error('corrupt JPEG');
        let marker = b[i + 1];
        let len = (b[i + 2] << 8) | b[i + 3];

        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
        }

        i += 2 + len;
    }

    throw new Error('no SOF marker');
}

/** Deterministic fake timers */
export class FakeTimers {
    now = 1_000_000;
    private nextId = 1;
    private timers = new Map<number, { at: number; fn: () => void }>();

    setTimeout = (fn: () => void, ms: number) => {
        let id = this.nextId++;
        this.timers.set(id, { at: this.now + ms, fn });
        return id;
    };

    clearTimeout = (id: number) => {
        this.timers.delete(id);
    };

    get pending() {
        return this.timers.size;
    }

    advance(ms: number) {
        this.now += ms;

        for (let [id, t] of [...this.timers].sort((a, b) => a[1].at - b[1].at)) {
            if (t.at > this.now) continue;
            this.timers.delete(id);
            t.fn();
        }
    }
}

export const flush = () => new Promise(resolve => setTimeout(resolve, 0));
