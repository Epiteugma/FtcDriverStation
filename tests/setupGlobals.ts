// Browser globals needed by src/util/robocol.svelte.ts; must be imported before it.
import { MockRobotController } from './mockRobotController';
import { decodeJpegSize } from './helpers';

export const mockRc = new MockRobotController();
export const objectUrls = new Map<string, Blob>();
export const revokedUrls: string[] = [];

let urlCounter = 0;

(globalThis as any).window = {
    robocol: mockRc.bridge(),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: any) => clearTimeout(id),
    open: () => null,
    location: { href: 'file:///index.html' },
};
(globalThis as any).requestAnimationFrame = () => 0;
(globalThis as any).createImageBitmap = async (blob: Blob) => ({ ...(await decodeJpegSize(blob)), close() {} });

URL.createObjectURL = (blob: Blob) => {
    let url = 'blob:ds/' + ++urlCounter;
    objectUrls.set(url, blob);
    return url;
};
URL.revokeObjectURL = (url: string) => {
    revokedUrls.push(url);
    objectUrls.delete(url);
};
