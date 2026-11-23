import { createSocket } from 'dgram';
import type { RemoteInfo } from 'dgram';

import { app, ipcMain, BrowserWindow, screen } from 'electron';
import { join } from 'path';

const ROBOCOL_PORT = 20884;

// Room for the controls, the camera preview and a readable telemetry panel, but never larger than the screen
// (a 1366x768 laptop has ~728 px of usable height, so the height is clamped to the work area).
const WINDOW_WIDTH = 900;
const WINDOW_HEIGHT = 860;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
let socket = createSocket('udp4').bind(ROBOCOL_PORT);

ipcMain.on('send', (_, packet, to) => _sendPacket(packet, to));
socket.on('message', (packet, from) => _onPacket(packet.buffer, from));

let window: BrowserWindow;

app.setName('FTC Driver Station Desktop [by #13906]');
app.whenReady().then(init);

function init() {
    let workArea = screen.getPrimaryDisplay().workAreaSize;

    window = new BrowserWindow({
        width: Math.max(MIN_WIDTH, Math.min(WINDOW_WIDTH, workArea.width)),
        height: Math.max(MIN_HEIGHT, Math.min(WINDOW_HEIGHT, workArea.height)),
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        resizable: true,
        frame: false,
        webPreferences: {
            preload: join(app.getAppPath(), 'build/preload.js'),
            backgroundThrottling: false,
        },
    });

    // window.setMenu(null);
    window.loadFile('assets/index.html');

    window.webContents.setWindowOpenHandler((details) => {
        let url = new URL(details.url);
        if (url.protocol !== 'file:') return { action: 'deny' };

        let isFieldView = url.searchParams.has('fieldView');
        let isGraphing = url.searchParams.has('graphing');

        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                frame: false,
                resizable: isGraphing,
                minWidth: isGraphing ? 800 : 0,
                minHeight: isGraphing ? 600 : 0,
                width: isFieldView ? 650 : isGraphing ? 800 : 800,
                height: isFieldView ? 800 : isGraphing ? 600 : 400,
                webPreferences: {
                    preload: join(app.getAppPath(), 'build/preload.js'),
                    backgroundThrottling: !isGraphing,
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
