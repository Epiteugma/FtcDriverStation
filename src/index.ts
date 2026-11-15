import { createSocket } from 'dgram';
import type { RemoteInfo } from 'dgram';

import { app, ipcMain, BrowserWindow } from 'electron';
import { join } from 'path';
import { HidrawRumble } from './main/hidraw';

const ROBOCOL_PORT = 20884;
let socket = createSocket('udp4').bind(ROBOCOL_PORT);

ipcMain.on('send', (_, packet, to) => _sendPacket(packet, to));

// Rumble fallback for DS4-layout pads without kernel force-feedback (e.g. ZEROPLUS P4 on hid-generic).
// FTCDS_HIDRAW_SYSROOT / FTCDS_HIDRAW_DEVROOT only exist for testing against a fake /sys tree.
const rumbleDebug = process.env.FTCDS_RUMBLE_DEBUG === '1' || process.env.FTCDS_GAMEPAD_DEBUG === '1';
const hidrawRumble = new HidrawRumble(
    process.env.FTCDS_HIDRAW_SYSROOT || undefined,
    process.env.FTCDS_HIDRAW_DEVROOT || undefined,
    rumbleDebug ? (...args) => console.log(...args) : () => {},
);

ipcMain.handle('rumble', (_, vendor: string, product: string, large: number, small: number) => {
    // hidraw only exists on Linux; elsewhere the renderer uses Gamepad.vibrationActuator
    if (process.platform !== 'linux') return { ok: false, via: 'hidraw', error: 'unsupported-platform' };

    try {
        return hidrawRumble.rumble(String(vendor), String(product), Number(large) || 0, Number(small) || 0);
    } catch (e) {
        return { ok: false, via: 'hidraw', error: String(e) };
    }
});
socket.on('message', (packet, from) => _onPacket(packet.buffer, from));

let window: BrowserWindow;

app.setName('FTC Driver Station Desktop [by #13906]');
app.whenReady().then(init);

function init() {
    window = new BrowserWindow({
        resizable: false,
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
