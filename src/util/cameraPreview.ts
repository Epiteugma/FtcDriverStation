// On-demand Robot Controller camera preview, like "Camera Stream" in the official Driver Station (FTC SDK 12.0).
// Not a live stream: every frame is requested with CMD_REQUEST_FRAME (open, Refresh, click on the image).
// This file has no Svelte or Electron dependencies so it can be unit tested.

import {
    FrameAssembler, isJpeg, DEFAULT_MAX_FRAME_BYTES,
    type ReceiveFrameBegin, type ReceiveFrameChunk,
} from '../librobocol/commands/cameraStream';

export const CAMERA_PREVIEW_TIMEOUT_MS = 5000;

export type CameraPreviewStatus = 'unavailable' | 'idle' | 'requesting' | 'receiving' | 'ready' | 'error';

export interface CameraPreviewState {
    /** the RC reported CMD_STREAM_CHANGE true */
    available: boolean;
    open: boolean;
    status: CameraPreviewStatus;
    message: string;

    imageUrl: string | null;
    width: number;
    height: number;
    byteLength: number;
    frameNum: number;
    receivedAt: number;

    /** progress of the frame being received */
    receivedBytes: number;
    totalBytes: number;
}

export interface CameraPreviewDeps {
    /** send CMD_REQUEST_FRAME; return false when not connected */
    sendRequestFrame(): boolean;
    /** block (true) / restore (false) gamepad packets */
    setGamepadsBlocked(blocked: boolean): void;
    createObjectURL(blob: Blob): string;
    revokeObjectURL(url: string): void;
    /** decode the JPEG, reject if it is not a valid image */
    decodeImage(blob: Blob): Promise<{ width: number; height: number }>;
    setTimeout(fn: () => void, ms: number): any;
    clearTimeout(handle: any): void;
    now(): number;
}

export function createCameraPreviewState(): CameraPreviewState {
    return {
        available: false,
        open: false,
        status: 'unavailable',
        message: '',

        imageUrl: null,
        width: 0,
        height: 0,
        byteLength: 0,
        frameNum: -1,
        receivedAt: 0,

        receivedBytes: 0,
        totalBytes: 0,
    };
}

export class CameraPreviewController {
    readonly state: CameraPreviewState;

    private readonly deps: CameraPreviewDeps;
    private readonly timeoutMs: number;
    private readonly assembler: FrameAssembler;

    /** id of the request in flight, or 0 */
    private inFlight = 0;
    private requestCounter = 0;
    private timer: any = null;

    constructor(state: CameraPreviewState, deps: CameraPreviewDeps, options: { timeoutMs?: number; maxFrameBytes?: number } = {}) {
        this.state = state;
        this.deps = deps;
        this.timeoutMs = options.timeoutMs ?? CAMERA_PREVIEW_TIMEOUT_MS;
        this.assembler = new FrameAssembler(options.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES);
    }

    get requestInFlight() {
        return this.inFlight !== 0;
    }

    /** CMD_STREAM_CHANGE */
    setAvailable(available: boolean) {
        this.state.available = available;

        if (!available) {
            this.close();
            this.state.status = 'unavailable';
            this.state.message = '';
        } else if (!this.state.open) {
            this.state.status = 'idle';
        }
    }

    open() {
        if (this.state.open) return true;
        if (!this.state.available) return false;

        this.state.open = true;
        this.deps.setGamepadsBlocked(true);
        this.request();

        return true;
    }

    /** Close the preview: drops any partial frame, revokes the image and always restores the gamepads. */
    close() {
        this.cancelRequest();
        this.revokeImage();

        this.state.open = false;
        this.state.status = this.state.available ? 'idle' : 'unavailable';
        this.state.message = '';

        // unconditionally: setGamepadsBlocked is idempotent and this guarantees nothing stays blocked
        this.deps.setGamepadsBlocked(false);
    }

    /** Request exactly one frame. Ignored while another request is in flight (no accidental live stream). */
    request() {
        if (!this.state.open || this.inFlight) return false;

        this.assembler.abort();

        // mark the request in flight before sending, so a (very) fast answer is not dropped
        let id = this.inFlight = ++this.requestCounter;

        this.state.status = 'requesting';
        this.state.message = 'Requesting frame…';
        this.state.receivedBytes = 0;
        this.state.totalBytes = 0;

        this.timer = this.deps.setTimeout(() => {
            if (this.inFlight !== id) return;
            this.fail(`No frame received within ${this.timeoutMs / 1000} s. Click Refresh to try again.`);
        }, this.timeoutMs);

        if (!this.deps.sendRequestFrame()) {
            this.fail('Not connected to a Robot Controller.');
            return false;
        }

        return true;
    }

    /** CMD_RECEIVE_FRAME_BEGIN; `undefined` means the payload could not be parsed */
    onBegin(msg: ReceiveFrameBegin | undefined) {
        if (!this.inFlight) return;

        let result = this.assembler.begin(msg);

        if (result.status === 'error') return this.fail('Bad frame: ' + result.reason + '.');
        if (result.status !== 'started') return;

        this.state.status = 'receiving';
        this.state.message = 'Receiving frame…';
        this.state.receivedBytes = 0;
        this.state.totalBytes = result.length;
    }

    /** CMD_RECEIVE_FRAME_CHUNK; `undefined` means the payload could not be parsed */
    onChunk(msg: ReceiveFrameChunk | undefined) {
        if (!this.inFlight) return;

        let result = this.assembler.chunk(msg);

        switch (result.status) {
            case 'error':
                return this.fail('Bad frame: ' + result.reason + '.');
            case 'progress':
                this.state.receivedBytes = result.received;
                return;
            case 'complete':
                return this.finish(result.frameNum, result.data);
        }
    }

    /** Connection lost (or a new one): forget availability and any frame state. */
    onDisconnect() {
        this.close();
        this.assembler.reset();
        this.state.available = false;
        this.state.status = 'unavailable';
        this.state.frameNum = -1;
    }

    private finish(frameNum: number, data: Uint8Array) {
        let id = this.inFlight;

        if (!isJpeg(data)) return this.fail('Bad frame: the received data is not a JPEG image.');

        this.state.receivedBytes = data.length;

        let blob = new Blob([data as BlobPart], { type: 'image/jpeg' });

        this.deps.decodeImage(blob).then(({ width, height }) => {
            if (this.inFlight !== id || !this.state.open) return; // closed or timed out meanwhile

            this.clearRequest();
            this.revokeImage();

            this.state.imageUrl = this.deps.createObjectURL(blob);
            this.state.width = width;
            this.state.height = height;
            this.state.byteLength = data.length;
            this.state.frameNum = frameNum;
            this.state.receivedAt = this.deps.now();
            this.state.status = 'ready';
            this.state.message = '';
        }, () => {
            if (this.inFlight !== id || !this.state.open) return;
            this.fail('Bad frame: the JPEG could not be decoded.');
        });
    }

    private fail(message: string) {
        this.clearRequest();
        this.assembler.abort();

        this.state.status = 'error';
        this.state.message = message;
        this.state.receivedBytes = 0;
        this.state.totalBytes = 0;
    }

    private cancelRequest() {
        this.clearRequest();
        this.assembler.abort();
        this.state.receivedBytes = 0;
        this.state.totalBytes = 0;
    }

    private clearRequest() {
        this.inFlight = 0;

        if (this.timer !== null) {
            this.deps.clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private revokeImage() {
        if (this.state.imageUrl) this.deps.revokeObjectURL(this.state.imageUrl);

        this.state.imageUrl = null;
        this.state.width = 0;
        this.state.height = 0;
        this.state.byteLength = 0;
    }
}
