// Browser globals needed by src/util/robocol.svelte.ts; must be imported before it.
import { MockRobotController } from './mockRobotController';

export const mockRc = new MockRobotController();

(globalThis as any).window = {
    robocol: mockRc.bridge(),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: any) => clearTimeout(id),
    open: () => null,
    location: { href: 'file:///index.html' },
};
(globalThis as any).requestAnimationFrame = () => 0;
