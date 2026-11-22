import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { CameraPreviewController, createCameraPreviewState, type CameraPreviewState } from '../src/util/cameraPreview';
import { ReceiveFrameChunk } from '../src/librobocol/commands/cameraStream';
import { FakeTimers, beginOf, chunksOf, decodeJpegSize, flush, sdkJpeg } from './helpers';

let state: CameraPreviewState;
let timers: FakeTimers;
let requests: number;
let connected: boolean;
let blocked: boolean[];
let urls: Map<string, Blob>;
let revoked: string[];
let decodeImpl: (blob: Blob) => Promise<{ width: number; height: number }>;
let preview: CameraPreviewController;
let urlCounter = 0;

function setup(options = {}) {
    state = createCameraPreviewState();
    timers = new FakeTimers();
    requests = 0;
    connected = true;
    blocked = [];
    urls = new Map();
    revoked = [];
    decodeImpl = decodeJpegSize;

    preview = new CameraPreviewController(state, {
        sendRequestFrame: () => {
            if (!connected) return false;
            requests++;
            return true;
        },
        setGamepadsBlocked: b => blocked.push(b),
        createObjectURL: blob => {
            let url = 'blob:test/' + ++urlCounter;
            urls.set(url, blob);
            return url;
        },
        revokeObjectURL: url => {
            revoked.push(url);
            urls.delete(url);
        },
        decodeImage: blob => decodeImpl(blob),
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
        now: () => timers.now,
    }, options);
}

async function deliver(data: Uint8Array, frameNum: number, order?: number[]) {
    preview.onBegin(beginOf(data, frameNum));
    let chunks = chunksOf(data, frameNum);
    for (let i of order ?? chunks.map((_, i) => i)) preview.onChunk(chunks[i]);
    await flush();
}

const isGamepadBlocked = () => blocked.at(-1) === true;

describe('camera preview controller', () => {
    beforeEach(() => setup());

    test('cannot open before the RC reports CMD_STREAM_CHANGE true', () => {
        assert.equal(state.status, 'unavailable');
        assert.equal(preview.open(), false);
        assert.equal(requests, 0);

        preview.setAvailable(true);
        assert.equal(state.status, 'idle');
        assert.equal(preview.open(), true);
        assert.equal(requests, 1);
        assert.equal(state.status, 'requesting');
        assert.equal(state.message, 'Requesting frame…');
    });

    test('complete frame appears (chunks in normal order) and shows its size', async () => {
        preview.setAvailable(true);
        preview.open();

        preview.onBegin(beginOf(sdkJpeg, 7));
        assert.equal(state.status, 'receiving');
        assert.equal(state.totalBytes, sdkJpeg.length);

        let chunks = chunksOf(sdkJpeg, 7);
        preview.onChunk(chunks[0]);
        assert.equal(state.receivedBytes, 4096);
        preview.onChunk(chunks[1]);
        preview.onChunk(chunks[2]);
        await flush();

        assert.equal(state.status, 'ready');
        assert.ok(state.imageUrl);
        assert.deepEqual([state.width, state.height], [240, 180]);
        assert.equal(state.byteLength, sdkJpeg.length);
        assert.equal(state.frameNum, 7);
        assert.equal(urls.get(state.imageUrl!)!.type, 'image/jpeg');
        assert.deepEqual(new Uint8Array(await urls.get(state.imageUrl!)!.arrayBuffer()), sdkJpeg);
        assert.equal(timers.pending, 0);
    });

    test('chunks out of order (SDK offset = chunkNum * 4096)', async () => {
        preview.setAvailable(true);
        preview.open();
        await deliver(sdkJpeg, 1, [2, 0, 1]);

        assert.equal(state.status, 'ready');
        assert.deepEqual(new Uint8Array(await urls.get(state.imageUrl!)!.arrayBuffer()), sdkJpeg);
    });

    test('duplicate chunk (RC retransmission) is harmless', async () => {
        preview.setAvailable(true);
        preview.open();
        await deliver(sdkJpeg, 1, [0, 0, 1, 1, 2]);

        assert.equal(state.status, 'ready');
    });

    test('missing chunk -> timeout after 5 s, partial frame dropped, retry possible', async () => {
        preview.setAvailable(true);
        preview.open();
        await deliver(sdkJpeg, 1, [0, 2]);

        assert.equal(state.status, 'receiving');
        timers.advance(4999);
        assert.equal(state.status, 'receiving');
        timers.advance(1);

        assert.equal(state.status, 'error');
        assert.match(state.message, /No frame received within 5 s/);
        assert.equal(state.receivedBytes, 0);

        // the missing chunk arriving late does not resurrect the frame
        preview.onChunk(chunksOf(sdkJpeg, 1)[1]);
        await flush();
        assert.equal(state.status, 'error');

        // retry
        assert.equal(preview.request(), true);
        assert.equal(requests, 2);
        await deliver(sdkJpeg, 2);
        assert.equal(state.status, 'ready');
        assert.equal(state.frameNum, 2);
    });

    test('no response at all -> timeout', () => {
        preview.setAvailable(true);
        preview.open();
        timers.advance(5000);
        assert.equal(state.status, 'error');
        assert.equal(preview.requestInFlight, false);
    });

    test('wrong frameNum is ignored; late chunks of an old frame never end up in a new one', async () => {
        preview.setAvailable(true);
        preview.open();

        // frame 1 partially received, then timeout
        preview.onBegin(beginOf(sdkJpeg, 1));
        preview.onChunk(chunksOf(sdkJpeg, 1)[0]);
        timers.advance(5000);

        preview.request();
        let other = sdkJpeg.map(b => b ^ 0x55);
        let late = chunksOf(other, 1);

        preview.onChunk(late[1]); // late chunk of frame 1, before the BEGIN of frame 2
        preview.onBegin(beginOf(sdkJpeg, 2));
        preview.onChunk(late[2]); // late chunk of frame 1 during frame 2
        preview.onBegin(beginOf(sdkJpeg, 1)); // late (retransmitted) BEGIN of frame 1
        for (let c of chunksOf(sdkJpeg, 2)) preview.onChunk(c);
        await flush();

        assert.equal(state.status, 'ready');
        assert.equal(state.frameNum, 2);
        assert.deepEqual(new Uint8Array(await urls.get(state.imageUrl!)!.arrayBuffer()), sdkJpeg);
    });

    test('announced length does not match the data -> error, retry possible', async () => {
        preview.setAvailable(true);
        preview.open();

        preview.onBegin(beginOf(sdkJpeg.slice(0, sdkJpeg.length - 100), 1));
        for (let c of chunksOf(sdkJpeg, 1)) preview.onChunk(c);
        await flush();

        assert.equal(state.status, 'error');
        assert.match(state.message, /Bad frame: chunk 2 has/);
        assert.equal(timers.pending, 0);
        assert.equal(preview.request(), true);
    });

    test('frame larger than the limit is refused before allocating it', () => {
        setup({ maxFrameBytes: 8000 });
        preview.setAvailable(true);
        preview.open();
        preview.onBegin(beginOf(sdkJpeg, 1));

        assert.equal(state.status, 'error');
        assert.match(state.message, /frame too large/);

        setup();
        preview.setAvailable(true);
        preview.open();
        preview.onBegin(beginOf(new Uint8Array(10 * 1024 * 1024 + 1), 1));
        assert.match(state.message, /frame too large/);
    });

    test('malformed BEGIN / CHUNK payloads give an error, not an exception', () => {
        preview.setAvailable(true);
        preview.open();
        preview.onBegin(undefined);
        assert.equal(state.status, 'error');

        preview.request();
        preview.onBegin(beginOf(sdkJpeg, 3));
        preview.onChunk(undefined);
        assert.equal(state.status, 'error');
    });

    test('data that is not a JPEG, or does not decode, is rejected', async () => {
        preview.setAvailable(true);
        preview.open();
        let png = new Uint8Array(5000).fill(7);
        png.set([0x89, 0x50, 0x4e, 0x47]);
        await deliver(png, 1);
        assert.equal(state.status, 'error');
        assert.match(state.message, /not a JPEG/);
        assert.equal(state.imageUrl, null);

        decodeImpl = () => Promise.reject(new Error('decode failed'));
        preview.request();
        await deliver(sdkJpeg, 2);
        assert.equal(state.status, 'error');
        assert.match(state.message, /could not be decoded/);
        assert.equal(urls.size, 0);
    });

    test('two quick refresh clicks -> only one active request', async () => {
        preview.setAvailable(true);
        preview.open();
        assert.equal(preview.request(), false);
        assert.equal(preview.request(), false);
        assert.equal(requests, 1);

        await deliver(sdkJpeg, 1);
        assert.equal(preview.request(), true);
        assert.equal(preview.request(), false);
        assert.equal(requests, 2);
    });

    test('never requests frames by itself (no live stream)', async () => {
        preview.setAvailable(true);
        preview.open();
        await deliver(sdkJpeg, 1);

        timers.advance(60_000);
        await flush();
        assert.equal(requests, 1);
        assert.equal(state.status, 'ready');
    });

    test('previous object URL is revoked on refresh and on close', async () => {
        preview.setAvailable(true);
        preview.open();
        await deliver(sdkJpeg, 1);
        let first = state.imageUrl!;

        preview.request();
        await deliver(sdkJpeg, 2);
        let second = state.imageUrl!;

        assert.notEqual(first, second);
        assert.deepEqual(revoked, [first]);

        preview.close();
        assert.deepEqual(revoked, [first, second]);
        assert.equal(urls.size, 0);
        assert.equal(state.imageUrl, null);
    });

    test('close during reception drops the partial frame; nothing arrives afterwards', async () => {
        preview.setAvailable(true);
        preview.open();
        preview.onBegin(beginOf(sdkJpeg, 1));
        preview.onChunk(chunksOf(sdkJpeg, 1)[0]);

        preview.close();
        assert.equal(state.open, false);
        assert.equal(state.status, 'idle');
        assert.equal(timers.pending, 0);

        for (let c of chunksOf(sdkJpeg, 1).slice(1)) preview.onChunk(c);
        await flush();
        assert.equal(state.imageUrl, null);
        assert.equal(urls.size, 0);
    });

    test('close while the JPEG is being decoded does not leak an object URL', async () => {
        preview.setAvailable(true);
        preview.open();
        await (async () => {
            preview.onBegin(beginOf(sdkJpeg, 1));
            for (let c of chunksOf(sdkJpeg, 1)) preview.onChunk(c);
        })();
        preview.close(); // before the decode promise resolves
        await flush();

        assert.equal(urls.size, 0);
        assert.equal(state.imageUrl, null);
    });

    test('disconnect during reception', async () => {
        preview.setAvailable(true);
        preview.open();
        preview.onBegin(beginOf(sdkJpeg, 5));
        preview.onChunk(chunksOf(sdkJpeg, 5)[0]);

        preview.onDisconnect();
        assert.equal(state.open, false);
        assert.equal(state.available, false);
        assert.equal(state.status, 'unavailable');
        assert.equal(isGamepadBlocked(), false);
        assert.equal(timers.pending, 0);

        for (let c of chunksOf(sdkJpeg, 5)) preview.onChunk(c);
        await flush();
        assert.equal(urls.size, 0);
        assert.equal(preview.open(), false); // needs a new CMD_STREAM_CHANGE

        // after reconnecting the RC frame counter may start at 0 again
        preview.setAvailable(true);
        preview.open();
        await deliver(sdkJpeg, 0);
        assert.equal(state.status, 'ready');
    });

    test('request while not connected shows an error', () => {
        preview.setAvailable(true);
        connected = false;
        preview.open();
        assert.equal(state.status, 'error');
        assert.match(state.message, /Not connected/);
    });

    test('stream becomes unavailable during reception', async () => {
        preview.setAvailable(true);
        preview.open();
        await deliver(sdkJpeg, 1);
        preview.request();
        preview.onBegin(beginOf(sdkJpeg, 2));

        preview.setAvailable(false);
        assert.equal(state.open, false);
        assert.equal(state.status, 'unavailable');
        assert.equal(state.imageUrl, null);
        assert.equal(urls.size, 0);
        assert.equal(isGamepadBlocked(), false);
        assert.equal(timers.pending, 0);
    });

    test('gamepads: blocked while open, always restored on close / disconnect / unavailable', async () => {
        preview.setAvailable(true);
        preview.open();
        assert.equal(isGamepadBlocked(), true);

        timers.advance(5000); // timeout keeps the preview open (like the official DS) -> still blocked
        assert.equal(state.open, true);
        assert.equal(isGamepadBlocked(), true);

        preview.close();
        assert.equal(isGamepadBlocked(), false);

        preview.open();
        preview.onDisconnect();
        assert.equal(isGamepadBlocked(), false);

        preview.setAvailable(true);
        preview.open();
        preview.setAvailable(false);
        assert.equal(isGamepadBlocked(), false);
    });
});
