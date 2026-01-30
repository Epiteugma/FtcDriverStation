import { createSocket } from 'dgram';
import type { RemoteInfo } from 'dgram';

import { app, ipcMain, BrowserWindow } from 'electron';
import { join } from 'path';

const ROBOCOL_PORT = 20884;
let socket = createSocket('udp4').bind(ROBOCOL_PORT);

ipcMain.on('send', (_, packet, to) => _sendPacket(packet, to));
socket.on('message', (packet, from) => _onPacket(packet.buffer, from));

let window: BrowserWindow;

app.whenReady().then(init);
app.commandLine.appendSwitch('disable-renderer-backgrounding');

function init() {
    window = new BrowserWindow({
        resizable: false,
        frame: false,
        webPreferences: {
            preload: join(app.getAppPath(), 'dist/preload.js'),
        },
    });

    window.setMenu(null);
    window.loadFile('assets/index.html');

    window.webContents.setWindowOpenHandler((details) => {
        let url = new URL(details.url);
        if (url.protocol !== 'file:') return { action: 'deny' };

        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                frame: false,
                resizable: false,
                width: 800,
                height: 400,
                webPreferences: {
                    preload: join(app.getAppPath(), 'dist/preload.js'),
                },
            }
        };
    });
}

function _sendPacket(packet: ArrayBuffer, to: string) {
    socket.send(Buffer.from(packet), ROBOCOL_PORT, to);
}

function _onPacket(packet: ArrayBuffer, from: RemoteInfo) {
    if (window && !window.isDestroyed()) window.webContents.send('packet', packet, from.address);
}
