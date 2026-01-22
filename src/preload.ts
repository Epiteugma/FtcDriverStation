import { ipcRenderer, contextBridge } from 'electron';

export function sendPacket(packet: ArrayBuffer, to: string) {
    ipcRenderer.send('send', packet, to);
}

export function onPacket(listener: (packet: ArrayBuffer, from: string) => any) {
    ipcRenderer.on('packet', (_, packet, from) => listener(packet, from));
}

contextBridge.exposeInMainWorld('robocol', {
    sendPacket,
    onPacket,
});