import { deserialize, type DeserializeResult } from '../librobocol/serialization';
import PeerDiscovery, { PeerType } from '../librobocol/packets/peerDiscovery';
import Heartbeat from '../librobocol/packets/heartbeat';
import Telemetry from '../librobocol/packets/telemetry';
import { RobotState } from '../librobocol/types';
import Command from '../librobocol/packets/command';
import Gamepad from '../librobocol/packets/gamepad';

export const connection = $state({
    remote: null,
    overridden: false,
    active: true,

    commandQueue: new Map<Command, number[]>(),

    seqNum: 0,
    lastPing: 0,
    lastHeartbeat: 0,

    gamepad1: {
        index: -1,
        latestData: null,
        needsUpdate: false,
        bindLock: false,
    },

    gamepad2: {
        index: -1,
        latestData: null,
        needsUpdate: false,
        bindLock: false,
    },
});

export const DEFAULT_OP_MODE_NAME = '$Stop$Robot$';

export enum OpModeState {
    Init, Looping
}

export const robot = $state({
    batteryLevel: 0,
    state: RobotState.Unknown,

    opModes: null,
    opModeState: OpModeState.Looping,
    activeOpMode: DEFAULT_OP_MODE_NAME,

    configurations: [],
    activeConfiguration: null,

    systemTelemetry: null,
    telemetry: null,
});

export const popouts = $state({
    stackTrace: null,
    graphing: null,
});

export const TELEMETRY_SYSTEM_NONE_KEY = '$System$None$';
export const TELEMETRY_SYSTEM_ERROR_KEY = '$System$Error$';
export const TELEMETRY_SYSTEM_WARNING_KEY = '$System$Warning$';
export const TELEMETRY_NUMBER_REGEX = /0*([0-9]+(?:\.[0-9]+)?)$/g;

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
    RequestUserDeviceTypes = 'CMD_REQUEST_USER_DEVICE_TYPES',
    RequestOpModeList = 'CMD_REQUEST_OP_MODE_LIST',
    RestartRobot = 'CMD_RESTART_ROBOT',

    Scan = 'CMD_SCAN',
    ScanResp = 'CMD_SCAN_RESP',

    NotifyActiveConfiguration = 'CMD_NOTIFY_ACTIVE_CONFIGURATION',
    NotifyOpModeList = 'CMD_NOTIFY_OP_MODE_LIST',
    NotifyInitOpMode = 'CMD_NOTIFY_INIT_OP_MODE',
    NotifyRunOpMode = 'CMD_NOTIFY_RUN_OP_MODE',
    ShowStacktrace = 'CMD_SHOW_STACKTRACE',
}

export function loop() {
    requestAnimationFrame(loop);

    if (!connection.active || Date.now() - connection.lastHeartbeat > ASSUME_DISCONNECT_TIMER && !!connection.remote) {
        connection.remote = null;
        connection.seqNum = 0;

        robot.state = RobotState.Unknown;
        robot.batteryLevel = 0;
        return;
    }

    if (Date.now() - connection.lastPing > 200) {
        connection.lastPing = Date.now();

        if (!!connection.remote) {
            const heartbeat = new Heartbeat();
            heartbeat.seqNum = ++connection.seqNum;
            heartbeat.timestamp = BigInt(Date.now()) * 1000000n;
            heartbeat.t0 = BigInt(Date.now());
            heartbeat.timezoneId = 'GMT';

            window.robocol.sendPacket(heartbeat.serialize().buffer, connection.remote);
        } else {
            window.robocol.sendPacket(discovery.buffer, '192.168.43.1');
            window.robocol.sendPacket(discovery.buffer, '192.168.49.1');
        }
    }

    processQueuedCommands();

    if (connection.gamepad1.latestData && connection.gamepad1.needsUpdate) {        
        if (connection.gamepad1.index === -1) {
            connection.gamepad1.latestData = new Gamepad();
            connection.gamepad1.latestData.user = 1;
            connection.gamepad1.latestData.id = -2;
        }
        
        connection.gamepad1.latestData.seqNum = ++connection.seqNum;
        connection.gamepad1.latestData.timestamp = BigInt(Date.now());

        window.robocol.sendPacket(connection.gamepad1.latestData.serialize().buffer, connection.remote);
        connection.gamepad1.needsUpdate = false;
    }

    if (connection.gamepad2.latestData && connection.gamepad2.needsUpdate) {
        if (connection.gamepad2.index === -1) {
            connection.gamepad2.latestData = new Gamepad();
            connection.gamepad2.latestData.user = 2;
            connection.gamepad2.latestData.id = -2;
        }

        connection.gamepad2.latestData.seqNum = ++connection.seqNum;
        connection.gamepad2.latestData.timestamp = BigInt(Date.now());

        window.robocol.sendPacket(connection.gamepad2.latestData.serialize().buffer, connection.remote);
        connection.gamepad2.needsUpdate = false;
    }
}

export function sendCommand(name: string, extra?: any) {
    if (!connection.remote) return;

    let command = new Command();

    command.timestamp = BigInt(Date.now());
    command.seqNum = ++connection.seqNum;
    command.name = name;
    command.extra = extra || '';

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

    robot.telemetry = packet;
}

function handleCommand(packet: Command) {
    if (packet.acknowledged) { // incoming ACK
        for (let [command] of connection.commandQueue) {
            if (command.name !== packet.name || command.timestamp !== packet.timestamp) continue;

            connection.commandQueue.delete(command);
            break;
        }

        return;
    }

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
            robot.activeOpMode = packet.extra;
            robot.opModeState = OpModeState.Init;
            break;
        case Commands.NotifyRunOpMode:
            robot.activeOpMode = packet.extra;
            robot.opModeState = OpModeState.Looping;
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
            break;
    }
}

window.robocol.onPacket((raw, from) => {
    let packet = deserialize(new Uint8Array(raw));
    if (packet) handle(packet, from);
});
