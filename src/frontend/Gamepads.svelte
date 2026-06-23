<script lang="ts">
    import GamepadPacket, { GamepadID } from '../librobocol/packets/gamepad';
    import { getKey, normalizeKey, reloadKeymap } from '../util/keymap';
    import { popouts } from '../util/robocol.svelte';
    import Gamepad from './Gamepad.svelte';

    const DEADZONE = 0.1;

    let {
        gamepad1 = $bindable({
            index: -1,
            latestData: null,
            needsUpdate: false,
            bindLock: false,
            keyboard: false,
        }),
        gamepad2 = $bindable({
            index: -1,
            latestData: null,
            needsUpdate: false,
            bindLock: false,
            keyboard: false,
        })
    } = $props();

    const pressedKeys = new Set<string>();

    function poll() {
        requestAnimationFrame(poll);

        let gamepads = navigator.getGamepads();

        bind(gamepads);

        if (gamepad1.keyboard) updateKeyboard(gamepad1, 1);
        else if (gamepad1.index >= 0) {
            if (gamepads[gamepad1.index]) update(gamepads, gamepad1);
            else {
                gamepad1.index = -1;
                gamepad1.needsUpdate = true;
            }
        }

        if (gamepad2.keyboard) updateKeyboard(gamepad2, 2);
        else if (gamepad2.index >= 0) {
            if (gamepads[gamepad2.index]) update(gamepads, gamepad2);
            else {
                gamepad2.index = -1;
                gamepad2.needsUpdate = true;
            }
        }
    }

    function cleanStickValue(v: number) {
        if (v > 0 && v < DEADZONE || v < 0 && v > -DEADZONE) v = 0;
        if (v < -1) v = -1;
        if (v > 1) v = 1;

        return v;
    }

    function update(gamepads: (globalThis.Gamepad | null)[], gamepad: any) {
        let data = gamepads[gamepad.index]!;

        let packet = gamepad.latestData ? gamepad.latestData as GamepadPacket : new GamepadPacket();
        let oldPacket = { ...packet } as GamepadPacket;

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

        if (!packet.start && (gamepad === gamepad1 && !packet.a || gamepad == gamepad2 && !packet.b)) {
            gamepad.bindLock = false;
        }

        if (gamepad.bindLock) {
            packet.start = false;

            if (gamepad === gamepad1) packet.a = false;
            else packet.b = false;
        }

        gamepad.needsUpdate = needsUpdate(packet, oldPacket);
        gamepad.latestData = packet;
    }

    function updateKeyboard(gamepad: any, user: number) {
        let packet = gamepad.latestData ? gamepad.latestData as GamepadPacket : new GamepadPacket();
        let oldPacket = { ...packet } as GamepadPacket;

        packet.user = user;
        packet.id = GamepadID.Synthetic;

        let axes: (keyof typeof packet)[] = ['leftStickX', 'leftStickY', 'rightStickX', 'rightStickY'];
        let buttons: (keyof typeof packet)[] = [
            'a', 'b', 'x', 'y',
            'leftBumper', 'rightBumper',
            'back', 'start',
            'leftStickButton', 'rightStickButton',
            'dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight'
        ];

        for (let i = 0; i < axes.length; i++) {
            let axisName = axes[i];
            (packet[axisName] as number) = axis(getKey(axisName + 'Minus'), getKey(axisName + 'Plus'));
        }

        for (let i = 0; i < buttons.length; i++) {
            let button = buttons[i];
            (packet[button] as boolean) = pressedKeys.has(getKey(button));
        }

        packet.leftTrigger = pressedKeys.has(getKey('leftTrigger')) ? 1 : 0;
        packet.rightTrigger = pressedKeys.has(getKey('rightTrigger')) ? 1 : 0;

        gamepad.needsUpdate = needsUpdate(packet, oldPacket);
        gamepad.latestData = packet;
    }

    function needsUpdate(packet: GamepadPacket, oldPacket: GamepadPacket) {
        for (let key in packet) {
            let k = key as keyof GamepadPacket;
            if (packet[k] !== oldPacket[k]) return true;
        }

        return false;
    }

    function axis(negativeKey: string, positiveKey: string) {
        let negative = pressedKeys.has(negativeKey) ? -1 : 0;
        let positive = pressedKeys.has(positiveKey) ? 1 : 0;

        return negative + positive;
    }

    function bind(gamepads: (globalThis.Gamepad | null)[]) {
        for (let i = 0; i < gamepads.length; i++) {
            let data = gamepads[i];

            if (!data || !data.buttons[9].pressed) continue;

            if (data.buttons[0].pressed) {
                if (gamepad1.keyboard) closeKeymap();

                gamepad1.keyboard = false;
                gamepad1.index = data.index;
                gamepad1.bindLock = true;

                if (gamepad2.index === data.index) {
                    gamepad2.index = -1;
                    gamepad2.needsUpdate = true;
                }
            } else if (data.buttons[1].pressed) {
                if (gamepad2.keyboard) closeKeymap();

                gamepad2.keyboard = false;
                gamepad2.index = data.index;
                gamepad2.bindLock = true;

                if (gamepad1.index === data.index) {
                    gamepad1.index = -1;
                    gamepad1.needsUpdate = true;
                }
            }
        }
    }

    function toggleKeyboard(gamepad: any) {
        gamepad.keyboard = !gamepad.keyboard;

        if (gamepad.keyboard) {
            gamepad.index = GamepadID.Synthetic;
            gamepad.bindLock = false;

            if (gamepad === gamepad1 && gamepad2.keyboard) disableKeyboard(gamepad2);
            if (gamepad === gamepad2 && gamepad1.keyboard) disableKeyboard(gamepad1);

            if (!popouts.keymap || popouts.keymap.closed) {
                popouts.keymap = window.open(window.location.href + '?keymap');
                popouts.keymap.onmessage = (event: MessageEvent) => {
                    if (event.data.type === 'reloadKeymap') return reloadKeymap();
                    onKeyEvent(event.data);
                };
            }
        } else {
            disableKeyboard(gamepad);
            closeKeymap();
        }

        gamepad.needsUpdate = true;
    }

    function disableKeyboard(gamepad: any) {
        gamepad.keyboard = false;
        gamepad.index = -1;
        gamepad.latestData = new GamepadPacket();
        gamepad.needsUpdate = true;
    }

    function closeKeymap() {
        popouts.keymap?.close();
        popouts.keymap = null;
    }

    function onKeyEvent(event: KeyboardEvent) {
        if (isTypingTarget(event.target)) return;

        let isDown = event.type === 'keydown';
        let normalizedKey = normalizeKey(event.key);

        if (isDown) pressedKeys.add(normalizedKey);
        else pressedKeys.delete(normalizedKey);
    }

    function isTypingTarget(target: EventTarget | null) {
        return target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLElement && target.isContentEditable;
    }

    poll();
</script>

<svelte:window onkeydown={onKeyEvent} onkeyup={onKeyEvent} />

<div class="gamepads">
    {#key gamepad1.needsUpdate}<Gamepad bind:keyboard={gamepad1.keyboard} onclick={() => toggleKeyboard(gamepad1)} style={gamepad1.index === -1 ? 'opacity: 0.5' : 'animation: gamepad-glow 1s'} />{/key}
    {#key gamepad2.needsUpdate}<Gamepad bind:keyboard={gamepad2.keyboard} onclick={() => toggleKeyboard(gamepad2)} style={gamepad2.index === -1 ? 'opacity: 0.5' : 'animation: gamepad-glow 1s'} />{/key}
</div>

<style>
    .gamepads {
        display: flex;
        gap: 6px;
        align-items: center;
    }
</style>
