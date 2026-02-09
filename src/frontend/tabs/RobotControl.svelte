<script lang="ts">
    import OpModeSelector from '../OpModeSelector.svelte';
    import { sendCommand, robot, popouts, DEFAULT_OP_MODE_NAME, Commands, TELEMETRY_SYSTEM_NONE_KEY, TELEMETRY_SYSTEM_WARNING_KEY, OpModeState } from '../../util/robocol.svelte';
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

<h2>
    Telemetry

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg class="graphing" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" onclick={() => {
        if (popouts.graphing && !popouts.graphing.closed) return;
        popouts.graphing = window.open(window.location.href + '?graphing');
    }}>
        <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm406-80h85l69-69v-51h-34L606-200ZM306-400l121-120 80 80 203-204-56-56-147 147-80-80-177 177 56 56ZM200-200h34l120-120h-85l-69 69v51Zm341 0 120-120h-85L456-200h85Zm-149 0 120-120h-85L307-200h85Z"/>
    </svg>
</h2>

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
        display: flex;
        align-items: center;
    }

    .graphing {
        height: 30px;
        width: 30px;
        margin-left: auto;
        transition: .2s;
    }
    .graphing:hover {
        fill: #04991c;
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