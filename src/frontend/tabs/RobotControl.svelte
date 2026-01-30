<script lang="ts">
    import OpModeSelector from '../OpModeSelector.svelte';
    import { sendCommand, robot, DEFAULT_OP_MODE_NAME, Commands, TELEMETRY_SYSTEM_NONE_KEY, TELEMETRY_SYSTEM_WARNING_KEY, OpModeState } from '../../util/robocol.svelte';
    import { RobotState } from '../../librobocol/types';

    let selected = $state('');

    let systemTelemetry = $derived.by(() => {
        if (!robot.systemTelemetry || robot.systemTelemetry.tag === TELEMETRY_SYSTEM_NONE_KEY) return '';
        return robot.systemTelemetry.dataStrings.get(robot.systemTelemetry.tag) + '\n\n';
    });

    let userTelemetry = $derived.by(() => {
        if (!robot.telemetry) return '';

        let out = '';

        for (let [key, value] of robot.telemetry.dataStrings) {
            if (key.startsWith('$') && key.endsWith('$')) continue;
            
            out += value + '\n';
        }

        for (let [key, value] of robot.telemetry.dataNumbers) {
            out += key + ' : ' + value.toFixed(4) + '\n';
        }

        return out;
    });
</script>

<OpModeSelector opModes={robot.opModes} bind:selected />

<div class="controls">
    <button class="{robot.opModeState === OpModeState.Init && robot.activeOpMode !== DEFAULT_OP_MODE_NAME ? 'run' : ''}" disabled={
        robot.opModes?.findIndex((o: any) => o.name === selected) < 0 || robot.state !== RobotState.Running || robot.opModeState !== OpModeState.Init && (robot.opModeState !== OpModeState.Looping || robot.activeOpMode !== DEFAULT_OP_MODE_NAME)
    } onclick={() => {
        sendCommand(robot.opModeState === OpModeState.Init && robot.activeOpMode !== DEFAULT_OP_MODE_NAME ? Commands.RunOpMode : Commands.InitOpMode, selected);
    }}>{robot.opModeState === OpModeState.Init && robot.activeOpMode !== DEFAULT_OP_MODE_NAME ? 'Run' : 'Init'}</button>

    <button class="danger" disabled={
        robot.state !== RobotState.Running || (robot.opModeState !== OpModeState.Init && robot.opModeState !== OpModeState.Looping) || robot.activeOpMode === DEFAULT_OP_MODE_NAME
    } onclick={() => sendCommand(Commands.InitOpMode, DEFAULT_OP_MODE_NAME)}>Stop</button>
</div>

<h2>Telemetry</h2>

<div class="telemetry">
    <pre><span
        style="font-weight: bold; color: {robot.systemTelemetry?.tag === TELEMETRY_SYSTEM_WARNING_KEY ? 'var(--orange)' : 'var(--red)'}"
    >{systemTelemetry}</span>{userTelemetry}</pre>
</div>

<style>
    .controls {
        display: flex;
        gap: 10px;
    }

    button {
        width: 75px;
        border-radius: 5px;
        border: none;
        outline: none;

        background: var(--primary);
        color: #fff;
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .run {
        background: var(--green);
    }

    .danger {
        background: var(--red);
    }

    h2 {
        margin-bottom: 0;
    }

    .telemetry {
        position: relative;
        display: flex;
        flex: 1;

        border-radius: 10px;
        overflow: hidden;

        box-shadow: 0 0 6px #0005;
    
        font-size: 14px;
    }

    pre {
        flex: 1;

        padding: 10px;
        margin: 0;

        overflow: auto;
    }

    pre, pre * {
        user-select: text;
    }

    pre::selection, pre ::selection {
        background: #aaa;
        color: #fff;
    }

    pre::-webkit-scrollbar {
        width: 1px;
        height: 1px;
        appearance: none;
    }

    pre::-webkit-scrollbar-thumb {
        box-shadow: inset 0 0 1px #000;
        backdrop-filter: blur(5px);
    }
</style>