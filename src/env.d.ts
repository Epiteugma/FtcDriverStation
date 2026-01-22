declare interface Window {
    robocol: {
        sendPacket(packet: ArrayBuffer, to: string): void;
        onPacket(listener: (packet: ArrayBuffer, from: string) => any): void;
        debug: {
            [key: string]: any;
        };
    };
}