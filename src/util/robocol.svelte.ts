import { deserialize, type DeserializeResult } from '../librobocol/serialization';
import PeerDiscovery, { PeerType } from '../librobocol/packets/peerDiscovery';
import Heartbeat from '../librobocol/packets/heartbeat';
import Telemetry from '../librobocol/packets/telemetry';
import { RobotState } from '../librobocol/types';
import Command from '../librobocol/packets/command';
import Gamepad from '../librobocol/packets/gamepad';
import { ReceiveFrameBegin, ReceiveFrameChunk, StreamChange } from '../librobocol/commands/cameraStream';
import { CameraPreviewController, createCameraPreviewState } from './cameraPreview';

export const connection = $state({
    remote: null,
    overridden: false,
    active: true,

    commandQueue: new Map<Command, number[]>(),

    seqNum: 0,
    lastPing: 0,
    lastHeartbeat: 0,

    /** no gamepad packets are sent while true (camera preview open, like the official DS) */
    gamepadsBlocked: false,

    gamepad1: {
        index: -1,
        latestData: null,
        needsUpdate: false,
        bindLock: false,
        keyboard: false,
    },

    gamepad2: {
        index: -1,
        latestData: null,
        needsUpdate: false,
        bindLock: false,
        keyboard: false,
    },
});

export const DEFAULT_OP_MODE_NAME = '$Stop$Robot$';

export enum OpModeState {
    Init, Looping
}

export const robot = $state({
    batteryLevel: 0,
    state: RobotState.Unknown,

    opModes: [],
    opModeState: OpModeState.Looping,
    activeOpMode: DEFAULT_OP_MODE_NAME,

    configurations: [],
    deviceList: {},
    activeConfiguration: null,
    onConfigurationResponse: null,
    onScanResponse: null,
    onModuleDiscoveryResponse: null,

    systemTelemetry: null,
    telemetry: null,
});

export const robotControl = $state({
    selectedOpMode: '',
    queuedOpMode: '',

    timer: {
        useAuto: false,
        useTeleOp: false,
        initTeleOp: false,

        start: null,
        time: 0,
        formatted: '0:00',
    },
});

export const cameraPreviewState = $state(createCameraPreviewState());

export const cameraPreview = new CameraPreviewController(cameraPreviewState, {
    sendRequestFrame: () => {
        if (!connection.remote) return false;

        sendCommand(Commands.RequestFrame, '');
        return true;
    },
    setGamepadsBlocked,
    createObjectURL: blob => URL.createObjectURL(blob),
    revokeObjectURL: url => URL.revokeObjectURL(url),
    decodeImage: async blob => {
        let bitmap = await createImageBitmap(blob);
        let size = { width: bitmap.width, height: bitmap.height };

        bitmap.close();
        return size;
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: handle => window.clearTimeout(handle),
    now: () => Date.now(),
});

export const popouts = $state({
    stackTrace: null,
    graphing: null,
    fieldView: null,
});

export const TELEMETRY_SYSTEM_NONE_KEY = '$System$None$';
export const TELEMETRY_SYSTEM_ERROR_KEY = '$System$Error$';
export const TELEMETRY_SYSTEM_WARNING_KEY = '$System$Warning$';
export const TELEMETRY_NUMBER_LINE_REGEX = /^(.*) : 0*(-?[0-9]+(?:\.[0-9]+)?)$/g;

const BATTERY_LEVEL_KEY = '$Robot$Battery$Level$';
const NO_VOLTAGE_SENSOR_KEY = '$no$voltage$sensor$';
const ASSUME_DISCONNECT_TIMER = 2000;

const discovery = new PeerDiscovery().serialize();

export enum Commands {
    InitOpMode = 'CMD_INIT_OP_MODE',
    RunOpMode = 'CMD_RUN_OP_MODE',

    RequestActiveConfig = 'CMD_REQUEST_ACTIVE_CONFIG',
    RequestConfigurations = 'CMD_REQUEST_CONFIGURATIONS',
    RequestConfigurationsResp = 'CMD_REQUEST_CONFIGURATIONS_RESP',
    RequestParticularConfiguration = 'CMD_REQUEST_PARTICULAR_CONFIGURATION',
    RequestParticularConfigurationResp = 'CMD_REQUEST_PARTICULAR_CONFIGURATION_RESP',
    RequestUserDeviceTypes = 'CMD_REQUEST_USER_DEVICE_TYPES',
    RequestOpModeList = 'CMD_REQUEST_OP_MODE_LIST',
    SaveConfiguration = 'CMD_SAVE_CONFIGURATION',
    RestartRobot = 'CMD_RESTART_ROBOT',

    Scan = 'CMD_SCAN',
    ScanResp = 'CMD_SCAN_RESP',
    DiscoverLynxModules = 'CMD_DISCOVER_LYNX_MODULES',
    DiscoverLynxModulesResp = 'CMD_DISCOVER_LYNX_MODULES_RESP',

    ActivateConfig = 'CMD_ACTIVATE_CONFIGURATION',
    DeleteConfig = 'CMD_DELETE_CONFIGURATION',

    NotifyActiveConfiguration = 'CMD_NOTIFY_ACTIVE_CONFIGURATION',
    NotifyUserDeviceList = 'CMD_NOTIFY_USER_DEVICE_LIST',
    NotifyOpModeList = 'CMD_NOTIFY_OP_MODE_LIST',
    NotifyInitOpMode = 'CMD_NOTIFY_INIT_OP_MODE',
    NotifyRunOpMode = 'CMD_NOTIFY_RUN_OP_MODE',
    ShowStacktrace = 'CMD_SHOW_STACKTRACE',

    StreamChange = 'CMD_STREAM_CHANGE',
    RequestFrame = 'CMD_REQUEST_FRAME',
    ReceiveFrameBegin = 'CMD_RECEIVE_FRAME_BEGIN',
    ReceiveFrameChunk = 'CMD_RECEIVE_FRAME_CHUNK',
}

function onTimerEnd() {
    let runningOpMode = robot.opModes.find(o => o.name === robot.activeOpMode);
    if (runningOpMode.flavor === 'SYSTEM') return;

    robotControl.timer.start = null;

    switch (runningOpMode.flavor) {
        case 'TELEOP':
            if (robotControl.timer.time === 120 && robot.opModeState === OpModeState.Looping) {
                sendCommand(Commands.InitOpMode, DEFAULT_OP_MODE_NAME);
            } else if (robotControl.timer.time === 8 && robot.opModeState === OpModeState.Init) {
                sendCommand(Commands.RunOpMode, robot.activeOpMode);
            }

            break;
        case 'AUTONOMOUS':
            if (robot.opModeState !== OpModeState.Looping) return;

            if (robotControl.timer.initTeleOp && robotControl.queuedOpMode) {
                robotControl.timer.time = 8;
                robotControl.timer.start = Date.now();

                robotControl.selectedOpMode = robotControl.queuedOpMode;
                sendCommand(Commands.InitOpMode, robotControl.selectedOpMode);
            } else {
                sendCommand(Commands.InitOpMode, DEFAULT_OP_MODE_NAME);
            }

            break;
    }
}

function tickTimer() {
    let selectedOpMode = robot.opModes.find(o => o.name === robotControl.selectedOpMode);
    let queuedOpMode = robot.opModes.find(o => o.name === robotControl.queuedOpMode);

    let time: number;

    if (!robotControl.timer.start) {
        robotControl.timer.time = time = robotControl.timer.useAuto && selectedOpMode && selectedOpMode.flavor === 'AUTONOMOUS' ? 30 : robotControl.timer.useTeleOp && selectedOpMode && selectedOpMode.flavor === 'TELEOP' ? 120 : 0;
    } else {
        let elapsed = (Date.now() - robotControl.timer.start) / 1e3;
        time = robotControl.timer.time - elapsed;

        if (time <= 0) {
            time = 0;
            onTimerEnd();
        }

        time++;
    }

    time += robotControl.timer.useTeleOp && queuedOpMode ? 120 : 0;
    robotControl.timer.formatted = ~~(time / 60) + ':' + (~~(time % 60) + '').padStart(2, '0');
}

export function loop() {
    requestAnimationFrame(loop);
    tickTimer();

    if (!connection.active || Date.now() - connection.lastHeartbeat > ASSUME_DISCONNECT_TIMER && !!connection.remote) {
        // resetCameraPreview never throws, so the connection state below is always reset. Cleanup that can throw
        // (e.g. gamepad rumble) must run in a try with this in its finally.
        if (connection.remote || cameraPreviewState.open || cameraPreviewState.available) resetCameraPreview();

        connection.remote = null;
        connection.seqNum = 0;

        robot.state = RobotState.Unknown;
        robot.batteryLevel = 0;

        robotControl.timer.start = null;
        return;
    }

    if (Date.now() - connection.lastPing > 200) {
        connection.lastPing = Date.now();

        if (!!connection.remote) {
            const heartbeat = new Heartbeat();
            heartbeat.seqNum = ++connection.seqNum;
            heartbeat.timestamp = BigInt(Date.now()) * 1000000n;
            heartbeat.t0 = BigInt(Date.now());
            heartbeat.timezoneId = Intl.DateTimeFormat().resolvedOptions().timeZone || 'GMT';

            window.robocol.sendPacket(heartbeat.serialize().buffer, connection.remote);
        } else {
            window.robocol.sendPacket(discovery.buffer, '192.168.43.1');
            window.robocol.sendPacket(discovery.buffer, '192.168.49.1');
        }
    }

    processQueuedCommands();

    if (connection.gamepadsBlocked) return;

    flushGamepad(connection.gamepad1, 1);
    flushGamepad(connection.gamepad2, 2);
}

function flushGamepad(gamepad: typeof connection.gamepad1, user: number, force = false) {
    if (!gamepad.latestData || !gamepad.needsUpdate && !force) return;

    if (gamepad.index === -1) {
        gamepad.latestData = new Gamepad();
        gamepad.latestData.user = user;
        gamepad.latestData.id = -2;
    }

    sendGamepadPacket(gamepad.latestData);
    gamepad.needsUpdate = false;
}

function sendGamepadPacket(gamepad: Gamepad) {
    gamepad.seqNum = ++connection.seqNum;
    gamepad.timestamp = BigInt(Date.now());

    window.robocol.sendPacket(gamepad.serialize().buffer, connection.remote);
}

/**
 * Drop all camera preview state for a lost or new connection. Never throws: the preview state is reset even if
 * restoring the gamepads fails, and a failure must not abort the rest of the disconnect/connect handling.
 */
function resetCameraPreview() {
    try {
        cameraPreview.onDisconnect();
    } catch (e) {
        console.error('Camera preview cleanup failed', e);
    }
}

/**
 * Central switch for gamepad input. The official DS stops sending gamepads while its camera stream is open
 * (DriverStationGamepadManager.setEnabled(false)). We additionally send one neutral packet per gamepad when
 * blocking so the RC does not keep the last stick/button state, and resend the real state when unblocking.
 */
export function setGamepadsBlocked(blocked: boolean) {
    if (connection.gamepadsBlocked === blocked) return;
    connection.gamepadsBlocked = blocked;

    if (!connection.remote) return;

    if (!blocked) {
        flushGamepad(connection.gamepad1, 1, true);
        flushGamepad(connection.gamepad2, 2, true);
        return;
    }

    for (let gamepad of [connection.gamepad1, connection.gamepad2]) {
        let latest = gamepad.latestData as Gamepad | null;
        if (!latest) continue;

        let neutral = new Gamepad();

        neutral.user = latest.user;
        neutral.id = latest.id;
        neutral.type = latest.type;

        sendGamepadPacket(neutral);
    }
}

export function sendCommand(name: string, extra?: any) {
    if (!connection.remote) return;

    // never start or re-init an op mode with the camera preview open (it blocks the gamepads)
    if (name === Commands.RunOpMode || name === Commands.InitOpMode) cameraPreview.close();

    let command = new Command();

    command.timestamp = BigInt(Date.now());
    command.seqNum = ++connection.seqNum;
    command.name = name;
    command.extra = extra || '';

    console.log('%c -> ', 'background-color: hotpink; color: white', command);

    window.robocol.sendPacket(command.serialize().buffer as ArrayBuffer, connection.remote);
    connection.commandQueue.set(command, [1, Date.now()]);
}

function processQueuedCommands() {
    let commandQueue = connection.commandQueue.entries();

    for (let [command, [attempts, lastSent]] of commandQueue) {
        if (Date.now() - lastSent < 100) continue;

        window.robocol.sendPacket(command.serialize().buffer as ArrayBuffer, connection.remote);
        connection.commandQueue.set(command, [++attempts, Date.now()]);

        if (attempts > 10) connection.commandQueue.delete(command);
    }
}

function handle(packet: DeserializeResult, from: string) {
    if (packet instanceof PeerDiscovery && !connection.remote) {
        connection.overridden = packet.peerType === PeerType.NotConnectedDueToPreexistingConnection;
        if (packet.peerType !== PeerType.Peer) return;

        resetCameraPreview(); // fresh connection: the RC re-announces the stream on its next INIT

        connection.remote = from;
        connection.seqNum = 0;
        connection.lastPing = 0;
        connection.lastHeartbeat = Date.now();

        sendCommand(Commands.RequestActiveConfig);
        sendCommand(Commands.RequestConfigurations);
        sendCommand(Commands.RequestUserDeviceTypes);
        sendCommand(Commands.RequestOpModeList);
    }

    if (connection.remote !== from) return;

    if (packet instanceof Telemetry) handleTelemetry(packet);
    else if (packet instanceof Command) handleCommand(packet);
    else if (packet instanceof Heartbeat) {
        connection.lastHeartbeat = Date.now();
        robot.state = packet.robotState;
    }
}

function handleTelemetry(packet: Telemetry) {
    robot.state = packet.robotState;

    if (packet.tag === TELEMETRY_SYSTEM_ERROR_KEY || packet.tag === TELEMETRY_SYSTEM_WARNING_KEY || packet.tag === TELEMETRY_SYSTEM_NONE_KEY) {
        robot.systemTelemetry = packet;
        return;
    }

    if (packet.dataStrings.has(BATTERY_LEVEL_KEY)) {
        let batteryLevel = packet.dataStrings.get(BATTERY_LEVEL_KEY);
        robot.batteryLevel = batteryLevel === NO_VOLTAGE_SENSOR_KEY ? 0 : (parseFloat(batteryLevel) || 0);
    }

    // SDK sends standalone battery packets (tag == key) on every command; don't let them blank the user telemetry view
    if (packet.tag === BATTERY_LEVEL_KEY) return;

    robot.telemetry = packet;

    if (popouts.graphing && !popouts.graphing.closed) popouts.graphing.postMessage(packet);
    if (popouts.fieldView && !popouts.fieldView.closed) popouts.fieldView.postMessage(packet);
}

function handleCommand(packet: Command) {
    if (packet.acknowledged) { // incoming ACK
        for (let [command] of connection.commandQueue) {
            if (command.name !== packet.name || command.timestamp !== packet.timestamp) continue;

            connection.commandQueue.delete(command);
            break;
        }

        // configuration change ACK
        if (packet.name === Commands.SaveConfiguration || packet.name === Commands.ActivateConfig) {
            sendCommand(Commands.RestartRobot);
        }

        return;
    }

    if (packet.name !== Commands.ReceiveFrameChunk) console.log('%c <- ', 'background-color: orange; color: white', packet);

    let ack = new Command(); // outgoing ACK

    ack.timestamp = packet.timestamp;
    ack.seqNum = packet.seqNum;
    ack.name = packet.name;
    ack.acknowledged = true;

    window.robocol.sendPacket(ack.serialize().buffer as ArrayBuffer, connection.remote);

    switch (packet.name) {
        case Commands.NotifyOpModeList:
            robot.opModes = packet.extra;
            break;
        case Commands.NotifyInitOpMode:
            cameraPreview.close();
            robot.activeOpMode = packet.extra;
            robot.opModeState = OpModeState.Init;

            if (robot.activeOpMode === DEFAULT_OP_MODE_NAME) {
                robotControl.timer.start = null;
            }

            break;
        case Commands.NotifyRunOpMode:
            cameraPreview.close(); // the official DS closes the stream when the op mode starts
            robot.activeOpMode = packet.extra;
            robot.opModeState = OpModeState.Looping;

            let opMode = robot.opModes.find(o => o.name === robot.activeOpMode);

            if (
                opMode.flavor === 'AUTONOMOUS' && robotControl.timer.useAuto ||
                opMode.flavor === 'TELEOP' && robotControl.timer.useTeleOp
            ) {
                robotControl.timer.start = Date.now();
                robotControl.timer.time = opMode.flavor === 'AUTONOMOUS' ? 30 : 120;
            }

            break;
        case Commands.ShowStacktrace:
            if (popouts.stackTrace && !popouts.stackTrace.closed) return;

            popouts.stackTrace = window.open(window.location.href + '?' + new URLSearchParams({
                stackTrace: packet.extra
            }).toString());
            break;
        case Commands.RequestConfigurationsResp:
            robot.configurations = packet.extra;
            break;
        case Commands.NotifyActiveConfiguration:
            robot.activeConfiguration = packet.extra;

            if (!robot.configurations.find(cfg => cfg.name === packet.extra.name)) {
                robot.configurations.push(packet.extra);
            }

            break;
        case Commands.NotifyUserDeviceList:
            let deviceList = {};

            for (let i = 0; i < packet.extra?.length; i++) {
                let device = packet.extra[i];
                deviceList[device.xmlTag] = device;
            }

            robot.deviceList = deviceList;
            break;
        case Commands.RequestParticularConfigurationResp:
            robot.onConfigurationResponse?.(packet.extra);
            break;
        case Commands.ScanResp:
            robot.onScanResponse?.(packet.extra);
            break;
        case Commands.DiscoverLynxModulesResp:
            robot.onModuleDiscoveryResponse?.(packet.extra);
            break;
        case Commands.StreamChange:
            cameraPreview.setAvailable(StreamChange.deserialize(packet.extra).streamAvailable);
            break;
        case Commands.ReceiveFrameBegin:
            cameraPreview.onBegin(ReceiveFrameBegin.deserialize(packet.extra));
            break;
        case Commands.ReceiveFrameChunk:
            cameraPreview.onChunk(ReceiveFrameChunk.deserialize(packet.extra));
            break;
    }
}

window.robocol.onPacket((raw, from) => {
    let packet = deserialize(new Uint8Array(raw));
    if (packet) handle(packet, from);
});
