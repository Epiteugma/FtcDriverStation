import { deserialize, type DeserializeResult } from '../librobocol/serialization';
import PeerDiscovery, { PeerType } from '../librobocol/packets/peerDiscovery';
import Heartbeat from '../librobocol/packets/heartbeat';
import Telemetry from '../librobocol/packets/telemetry';
import Gamepad from '../librobocol/packets/gamepad';
import { RobotState } from '../librobocol/types';
import Command from '../librobocol/packets/command';

export const connection = $state({
    remote: null,
    active: true,

    commandQueue: new Map<Command, number>(),

    seqNum: 0,
    lastPing: 0,
    lastHeartbeat: 0,

    gamepad1: {
        index: -1,
        latestData: null,
        lastSent: 0,
        bindLock: false,
    },

    gamepad2: {
        index: -1,
        latestData: null,
        lastSent: 0,
        bindLock: false,
    },
});

export const robot = $state({
    batteryLevel: 0,
    state: RobotState.Unknown,
})

const BATTERY_LEVEL_KEY = '$Robot$Battery$Level$';
const NO_VOLTAGE_SENSOR_KEY = '$no$voltage$sensor$';
const ASSUME_DISCONNECT_TIMER = 2000;

const discovery = new PeerDiscovery().serialize();
const unassignedGamepad = new Gamepad(); unassignedGamepad.id = -1;

export function loop() {
    requestAnimationFrame(loop);

    if (!connection.active || Date.now() - connection.lastHeartbeat > ASSUME_DISCONNECT_TIMER && !!connection.remote) {
        connection.remote = null;
        connection.seqNum = 0;

        robot.state = RobotState.Unknown;
        robot.batteryLevel = 0;
        return;
    }

    if (Date.now() - connection.lastPing > 100) {
        connection.lastPing = Date.now();

        if (!!connection.remote) {
            const heartbeat = new Heartbeat();
            heartbeat.seqNum = ++connection.seqNum;
            heartbeat.timestamp = BigInt(Date.now()) * 1000000n;
            heartbeat.t0 = BigInt(Date.now());
            heartbeat.timezoneId = 'GMT';

            window.robocol.sendPacket(heartbeat.serialize().buffer, connection.remote);
            retryQueuedCommands();
        } else {
            window.robocol.sendPacket(discovery.buffer, '192.168.43.1');
            window.robocol.sendPacket(discovery.buffer, '192.168.49.1');
        }
    }

    if (connection.gamepad1.latestData && connection.gamepad1.lastSent < Number(connection.gamepad1.latestData.timestamp)) {
        if (connection.gamepad1.index === -1) {
            unassignedGamepad.timestamp = BigInt(Date.now());
            unassignedGamepad.seqNum = ++connection.seqNum;
            unassignedGamepad.user = 1;

            window.robocol.sendPacket(unassignedGamepad.serialize().buffer, connection.remote);
        } else {
            connection.gamepad1.latestData.seqNum = ++connection.seqNum;
            window.robocol.sendPacket(connection.gamepad1.latestData.serialize().buffer, connection.remote);
        }

        connection.gamepad1.lastSent = Date.now();
    }

    if (connection.gamepad2.latestData && connection.gamepad2.lastSent < Number(connection.gamepad2.latestData.timestamp)) {
        if (connection.gamepad2.index === -1) {
            unassignedGamepad.timestamp = BigInt(Date.now());
            unassignedGamepad.seqNum = ++connection.seqNum;
            unassignedGamepad.user = 2;

            window.robocol.sendPacket(unassignedGamepad.serialize().buffer, connection.remote);
        } else {
            connection.gamepad2.latestData.seqNum = ++connection.seqNum;
            window.robocol.sendPacket(connection.gamepad2.latestData.serialize().buffer, connection.remote);
        }

        connection.gamepad2.lastSent = Date.now();
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
    connection.commandQueue.set(command, 1);
}

function retryQueuedCommands() {
    let commandQueue = connection.commandQueue.entries();

    for (let [command, attempts] of commandQueue) {
        window.robocol.sendPacket(command.serialize().buffer as ArrayBuffer, connection.remote);
        connection.commandQueue.set(command, ++attempts);

        if (attempts > 10) connection.commandQueue.delete(command);
    }
}

function handle(packet: DeserializeResult, from: string) {
    if (packet instanceof PeerDiscovery && !connection.remote) {
        if (packet.peerType !== PeerType.Peer) return;

        connection.remote = from;
        connection.seqNum = 0;
        connection.lastPing = 0;
        connection.lastHeartbeat = Date.now();

        sendCommand('CMD_REQUEST_OP_MODE_LIST', '');
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

    if (packet.dataStrings.has(BATTERY_LEVEL_KEY)) {
        let batteryLevel = packet.dataStrings.get(BATTERY_LEVEL_KEY);
        robot.batteryLevel = batteryLevel === NO_VOLTAGE_SENSOR_KEY ? 0 : (parseFloat(batteryLevel) || 0);
    }
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

    console.log('got command:', packet.name, packet.extra);

    switch (packet.name) {
        case 'CMD_NOTIFY_OP_MODE_LIST':
            
            break;
    }
}

window.robocol.onPacket((raw, from) => {
    let packet = deserialize(new Uint8Array(raw));
    if (packet) handle(packet, from);
});
