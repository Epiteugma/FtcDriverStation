<script lang="ts">
    import GamepadPacket from '../librobocol/packets/gamepad';
    import Gamepad from './Gamepad.svelte';

    const DEADZONE = 0.05;

    let {
        gamepad1 = $bindable({
            index: -1,
            latestData: null,
            lastSent: 0,
            bindLock: false,
        }),
        gamepad2 = $bindable({
            index: -1,
            latestData: null,
            lastSent: 0,
            bindLock: false,
        })
    } = $props();

    function poll() {
        requestAnimationFrame(poll);

        let gamepads = navigator.getGamepads();
        
        bind(gamepads);

        if (gamepad1.index >= 0) {
            if (gamepads[gamepad1.index]) update(gamepads, gamepad1);
            else {
                gamepad1.index = -1;
                gamepad1.latestData.timestamp = BigInt(Date.now());
            }
        }

        if (gamepad2.index >= 0) {
            if (gamepads[gamepad2.index]) update(gamepads, gamepad2);
            else {
                gamepad2.index = -1;
                gamepad2.latestData.timestamp = BigInt(Date.now());
            }
        }
    }

    function cleanStickValue(v: number) {
        if (v > 0 && v < DEADZONE || v < 0 && v > -DEADZONE) v = 0;
        if (v < -1) v = -1;
        if (v > 1) v = 1;

        return v;
    }

    function update(gamepads: globalThis.Gamepad[], gamepad: any) {
        let data = gamepads[gamepad.index];
        let packet = gamepad.latestData ? gamepad.latestData as GamepadPacket : new GamepadPacket();

        packet.user = gamepad === gamepad1 ? 1 : 2;
        packet.id = gamepad.index;

        packet.a = data.buttons[0].pressed;
        packet.b = data.buttons[1].pressed;
        packet.x = data.buttons[2].pressed;
        packet.y = data.buttons[3].pressed;

        packet.leftBumper = data.buttons[4].pressed;
        packet.rightBumper = data.buttons[5].pressed;
        packet.leftTrigger = data.buttons[6].value;
        packet.rightTrigger = data.buttons[7].value;
        
        packet.back = data.buttons[8].pressed;
        packet.start = data.buttons[9].pressed;

        packet.leftStickButton = data.buttons[10].pressed;
        packet.rightStickButton = data.buttons[11].pressed;

        packet.dpadUp = data.buttons[12].pressed;
        packet.dpadDown = data.buttons[13].pressed;
        packet.dpadLeft = data.buttons[14].pressed;
        packet.dpadRight = data.buttons[15].pressed;

        packet.leftStickX = cleanStickValue(data.axes[0]);
        packet.leftStickY = cleanStickValue(data.axes[1]);
        packet.rightStickX = cleanStickValue(data.axes[2]);
        packet.rightStickY = cleanStickValue(data.axes[3]);

        if (!gamepad.start && (gamepad === gamepad1 && !gamepad.a || gamepad == gamepad2 && !gamepad.b)) {
            gamepad.bindLock = false;
        }

        if (gamepad.bindLock) {
            gamepad.start = false;

            if (gamepad === gamepad1) gamepad.a = false;
            else gamepad.b = false;
        }

        packet.timestamp = BigInt(Date.now() - ~~performance.now()) + BigInt(~~data.timestamp);
        gamepad.latestData = packet;
    }

    function bind(gamepads: globalThis.Gamepad[]) {
        for (let i = 0; i < gamepads.length; i++) {
            let data = gamepads[i];

            if (!data || !data.buttons[9].pressed) continue;

            if (data.buttons[0].pressed) {
                gamepad1.index = data.index;
                gamepad1.bindLock = true;

                if (gamepad2.index === data.index) {
                    gamepad2.index = -1;
                    if (gamepad2.latestData) gamepad2.latestData.timestamp = BigInt(Date.now());
                }
            } else if (data.buttons[1].pressed) {
                gamepad2.index = data.index;
                gamepad2.bindLock = true;

                if (gamepad1.index === data.index) {
                    gamepad1.index = -1;
                    if (gamepad1.latestData) gamepad1.latestData.timestamp = BigInt(Date.now());
                }
            }
        }
    }

    poll();
</script>

<div class="gamepads">
    <Gamepad style={gamepad1.index === -1 ? 'opacity: 0.5' : ''} />
    <Gamepad style={gamepad2.index === -1 ? 'opacity: 0.5' : ''} />
</div>

<style>
    .gamepads {
        display: flex;
        gap: 10px;
        align-items: center;
    }
</style>