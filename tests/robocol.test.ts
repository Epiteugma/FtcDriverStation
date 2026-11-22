import { mockRc, objectUrls, revokedUrls } from './setupGlobals';

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { connection, robot, cameraPreview, cameraPreviewState as preview, loop, sendCommand, Commands, OpModeState } from '../src/util/robocol.svelte';
import Gamepad from '../src/librobocol/packets/gamepad';
import { CHUNK_SIZE, ReceiveFrameBegin, ReceiveFrameChunk } from '../src/librobocol/commands/cameraStream';
import { fixture, fromHex, sdkJpeg, chunksOf, flush } from './helpers';

const OP_MODES = [
    { flavor: 'SYSTEM', group: '$$$$$$$', name: '$Stop$Robot$', source: 'BUILTIN' },
    { flavor: 'AUTONOMOUS', group: 'BIOBUZZ', name: 'VisionAuto', source: 'BLOCKLY' },
];

function sendFrame(data: Uint8Array, frameNum: number, skip: number[] = []) {
    mockRc.sendCommand('CMD_RECEIVE_FRAME_BEGIN', new ReceiveFrameBegin(frameNum, data.length).serialize());
    chunksOf(data, frameNum).forEach((c, i) => {
        if (!skip.includes(i)) mockRc.sendCommand('CMD_RECEIVE_FRAME_CHUNK', c.serialize());
    });
}

function setGamepad1(leftStickY: number) {
    let gp = new Gamepad();
    gp.user = 1;
    gp.id = 3;
    gp.leftStickY = leftStickY;
    connection.gamepad1.index = 3;
    connection.gamepad1.latestData = gp;
    connection.gamepad1.needsUpdate = true;
}

function initOpMode() {
    mockRc.sendCommand('CMD_NOTIFY_INIT_OP_MODE', 'VisionAuto');
    assert.equal(robot.opModeState, OpModeState.Init);
}

describe('DS <-> mock Robot Controller (SDK 12.0 camera stream)', () => {
    before(() => {
        // the mock answers CMD_REQUEST_FRAME with the datagrams produced by the real SDK 12.0 classes
        mockRc.onCommand = cmd => {
            if (cmd.name === 'CMD_REQUEST_FRAME' && respondWithSdkFrame) {
                mockRc.sendRaw(fromHex(fixture.begin.packet));
                for (let c of fixture.chunks) mockRc.sendRaw(fromHex(c.packet));
                mockRc.sendRaw(fromHex(fixture.chunks[1].packet)); // retransmission
            }
        };
    });

    let respondWithSdkFrame = true;

    test('connects, op mode list and telemetry still work', () => {
        mockRc.announce();
        assert.equal(connection.remote, '192.168.43.1');
        assert.ok(mockRc.namesReceived().includes('CMD_REQUEST_OP_MODE_LIST'));

        mockRc.sendCommand('CMD_NOTIFY_OP_MODE_LIST', JSON.stringify(OP_MODES));
        assert.equal(robot.opModes.length, 2);

        mockRc.sendTelemetry({ a: 'Status : Initialized' });
        assert.equal(robot.telemetry.dataStrings.get('a'), 'Status : Initialized');
        assert.equal(preview.status, 'unavailable');
        assert.equal(cameraPreview.open(), false);
    });

    test('CMD_STREAM_CHANGE true (SDK datagram) is acknowledged and makes the preview available', () => {
        let acksBefore = mockRc.acks.length;
        mockRc.sendRaw(fromHex(fixture.streamChangeTrue.packet));

        assert.equal(preview.available, true);
        assert.equal(preview.status, 'idle');
        assert.equal(mockRc.acks.length, acksBefore + 1);
        assert.equal(mockRc.acks.at(-1)!.name, 'CMD_STREAM_CHANGE');
    });

    test('open: one CMD_REQUEST_FRAME with empty extra, SDK frame shown, gamepads blocked with a neutral packet', async () => {
        initOpMode();
        setGamepad1(-1);
        loop();
        assert.equal(mockRc.gamepads.at(-1)!.leftStickY, -1);

        let requestsBefore = mockRc.namesReceived().filter(n => n === 'CMD_REQUEST_FRAME').length;
        let gamepadsBefore = mockRc.gamepads.length;

        cameraPreview.open();
        cameraPreview.request(); // fast double click
        await flush();

        let requests = mockRc.commands.filter(c => c.name === 'CMD_REQUEST_FRAME');
        assert.equal(requests.length - requestsBefore, 1);
        assert.equal(requests.at(-1)!.extra, '');

        assert.equal(preview.status, 'ready');
        assert.deepEqual([preview.width, preview.height], [fixture.jpegWidth, fixture.jpegHeight]);
        assert.equal(preview.frameNum, fixture.frameNum);
        assert.deepEqual(new Uint8Array(await objectUrls.get(preview.imageUrl!)!.arrayBuffer()), sdkJpeg);

        // exactly one neutral packet when blocking
        assert.equal(connection.gamepadsBlocked, true);
        assert.equal(mockRc.gamepads.length, gamepadsBefore + 1);
        assert.equal(mockRc.gamepads.at(-1)!.leftStickY, 0);
        assert.equal(mockRc.gamepads.at(-1)!.user, 1);

        // stick moves while the preview is open: nothing is sent
        setGamepad1(0.5);
        loop();
        loop();
        assert.equal(mockRc.gamepads.length, gamepadsBefore + 1);
    });

    test('Run closes the preview first and the gamepads resume immediately', () => {
        let url = preview.imageUrl!;
        let gamepadsBefore = mockRc.gamepads.length;

        sendCommand(Commands.RunOpMode, 'VisionAuto');

        assert.equal(preview.open, false);
        assert.equal(connection.gamepadsBlocked, false);
        assert.ok(revokedUrls.includes(url));
        assert.equal(objectUrls.size, 0);
        assert.equal(mockRc.gamepads.length, gamepadsBefore + 1);
        assert.equal(mockRc.gamepads.at(-1)!.leftStickY, 0.5);
        assert.equal(mockRc.commands.at(-1)!.name, 'CMD_RUN_OP_MODE');

        setGamepad1(0.25);
        loop();
        assert.equal(mockRc.gamepads.at(-1)!.leftStickY, 0.25);
    });

    test('CMD_NOTIFY_RUN_OP_MODE closes an open preview (official DS behaviour)', () => {
        initOpMode();
        cameraPreview.open();
        mockRc.sendCommand('CMD_NOTIFY_RUN_OP_MODE', 'VisionAuto');

        assert.equal(preview.open, false);
        assert.equal(connection.gamepadsBlocked, false);
    });

    test('Stop (re-init of $Stop$Robot$) closes the preview; the RC then reports the stream unavailable', () => {
        initOpMode();
        cameraPreview.open();
        sendCommand(Commands.InitOpMode, '$Stop$Robot$');
        assert.equal(preview.open, false);

        mockRc.sendRaw(fromHex(fixture.streamChangeFalse.packet));
        assert.equal(preview.available, false);
        assert.equal(preview.status, 'unavailable');
    });

    test('stream becomes unavailable while a frame is being received', () => {
        respondWithSdkFrame = false;
        mockRc.sendRaw(fromHex(fixture.streamChangeTrue.packet));
        initOpMode();
        cameraPreview.open();
        sendFrame(sdkJpeg, 100, [2]);
        assert.equal(preview.status, 'receiving');

        mockRc.sendCommand('CMD_STREAM_CHANGE', 'false');
        assert.equal(preview.open, false);
        assert.equal(preview.receivedBytes, 0);
        assert.equal(connection.gamepadsBlocked, false);
    });

    test('corrupt chunk payload -> error, retry works', async () => {
        mockRc.sendCommand('CMD_STREAM_CHANGE', 'true');
        cameraPreview.open();
        mockRc.sendCommand('CMD_RECEIVE_FRAME_BEGIN', new ReceiveFrameBegin(200, sdkJpeg.length).serialize());
        mockRc.sendCommand('CMD_RECEIVE_FRAME_CHUNK', '{"frameNum":200,"chunkNum":0,"encodedData":"%%%"}');
        assert.equal(preview.status, 'error');

        cameraPreview.request();
        sendFrame(sdkJpeg, 201);
        await flush();
        assert.equal(preview.status, 'ready');
    });

    test('disconnect during reception: preview closed, gamepads restored, stream unavailable', () => {
        cameraPreview.request();
        sendFrame(sdkJpeg, 202, [1, 2]);
        assert.equal(preview.status, 'receiving');
        assert.equal(preview.receivedBytes, CHUNK_SIZE);

        connection.lastHeartbeat = 0; // heartbeat timeout
        loop();

        assert.equal(connection.remote, null);
        assert.equal(preview.open, false);
        assert.equal(preview.available, false);
        assert.equal(connection.gamepadsBlocked, false);
        assert.equal(objectUrls.size, 0);
    });

    test('reconnect: preview needs a new CMD_STREAM_CHANGE, frame counter may restart at 0', async () => {
        mockRc.announce();
        assert.equal(connection.remote, '192.168.43.1');
        assert.equal(cameraPreview.open(), false);

        mockRc.sendCommand('CMD_STREAM_CHANGE', 'true');
        cameraPreview.open();
        sendFrame(sdkJpeg, 0);
        await flush();
        assert.equal(preview.status, 'ready');

        cameraPreview.close();
        assert.equal(objectUrls.size, 0);
        assert.equal(connection.gamepadsBlocked, false);
    });
});
