// Minimal mock Robot Controller that talks Robocol to the DS renderer code through the `window.robocol` bridge.
// Commands from the DS are acknowledged like the SDK does (echo with acknowledged = true).

import { deserialize } from '../src/librobocol/serialization';
import Command from '../src/librobocol/packets/command';
import Gamepad from '../src/librobocol/packets/gamepad';
import PeerDiscovery, { PeerType } from '../src/librobocol/packets/peerDiscovery';
import { RobotState } from '../src/librobocol/types';

export const RC_ADDRESS = '192.168.43.1';

export class MockRobotController {
    commands: Command[] = [];
    acks: Command[] = [];
    gamepads: Gamepad[] = [];
    onCommand: (cmd: Command) => void = () => {};

    private listener: ((packet: ArrayBuffer, from: string) => any) | null = null;
    private seq = 0;
    private ts = 1000n;

    /** install as `window.robocol` */
    bridge() {
        return {
            sendPacket: (packet: ArrayBuffer, to: string) => this.receive(new Uint8Array(packet), to),
            onPacket: (listener: (packet: ArrayBuffer, from: string) => any) => { this.listener = listener; },
            debug: {},
        };
    }

    sendRaw(bytes: Uint8Array) {
        this.listener!(bytes.slice().buffer, RC_ADDRESS);
    }

    sendCommand(name: string, extra: string) {
        let cmd = new Command();
        cmd.name = name;
        cmd.extra = extra;
        cmd.timestamp = ++this.ts;
        cmd.seqNum = ++this.seq;
        this.sendRaw(cmd.serialize());
    }

    announce() {
        let discovery = new PeerDiscovery();
        discovery.peerType = PeerType.Peer;
        this.sendRaw(discovery.serialize());
    }

    /** TelemetryMessage.toByteArray() layout of SDK 12.0 (librobocol's Telemetry.serialize() is only used by tests) */
    sendTelemetry(lines: Record<string, string>, tag = '') {
        let enc = new TextEncoder();
        let tagBytes = enc.encode(tag);
        let entries = Object.entries(lines).map(([k, v]) => [enc.encode(k), enc.encode(v)]);
        let payload = 8 + 1 + 1 + 1 + tagBytes.length + 1 + 1 + entries.reduce((n, [k, v]) => n + 4 + k.length + v.length, 0);

        let buf = new Uint8Array(5 + payload);
        let view = new DataView(buf.buffer);
        let o = 0;

        buf[o++] = 5; // TELEMETRY
        view.setUint16(o, payload); o += 2;
        view.setUint16(o, ++this.seq); o += 2;
        view.setBigInt64(o, ++this.ts); o += 8;
        buf[o++] = 0; // sorted
        buf[o++] = RobotState.Running;
        buf[o++] = tagBytes.length; buf.set(tagBytes, o); o += tagBytes.length;
        buf[o++] = entries.length;
        for (let [k, v] of entries) {
            view.setUint16(o, k.length); o += 2; buf.set(k, o); o += k.length;
            view.setUint16(o, v.length); o += 2; buf.set(v, o); o += v.length;
        }
        buf[o++] = 0; // numbers

        this.sendRaw(buf);
    }

    namesReceived() {
        return this.commands.map(c => c.name);
    }

    private receive(bytes: Uint8Array, to: string) {
        if (to !== RC_ADDRESS) return;

        let packet = deserialize(bytes);

        if (packet instanceof Gamepad) this.gamepads.push(packet);
        else if (packet instanceof Command) {
            if (packet.acknowledged) {
                this.acks.push(packet);
                return;
            }

            this.commands.push(packet);

            let ack = new Command();
            ack.name = packet.name;
            ack.timestamp = packet.timestamp;
            ack.acknowledged = true;
            this.sendRaw(ack.serialize());

            this.onCommand(packet);
        }
    }
}
