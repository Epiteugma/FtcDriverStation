import { ipcRenderer, contextBridge } from 'electron';

export function sendPacket(packet: ArrayBuffer, to: string) {
    ipcRenderer.send('send', packet, to);
}

export function onPacket(listener: (packet: ArrayBuffer, from: string) => any) {
    ipcRenderer.on('packet', (_, packet, from) => listener(packet, from));
}

contextBridge.exposeInMainWorld('robocol', {
    gamepadDebug: (() => { try { return process.env.FTCDS_GAMEPAD_DEBUG === '1'; } catch { return false; } })(),
    rumbleDebug: (() => { try { return process.env.FTCDS_RUMBLE_DEBUG === '1' || process.env.FTCDS_GAMEPAD_DEBUG === '1'; } catch { return false; } })(),
    rumble: (vendor: string, product: string, large: number, small: number) => ipcRenderer.invoke('rumble', vendor, product, large, small),
    sendPacket,
    onPacket,
});