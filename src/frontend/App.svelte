<script lang="ts">
    import Navbar from './Navbar.svelte';
    import Battery from './Battery.svelte';
    import Gamepads from './Gamepads.svelte';
    import Link from './Link.svelte';
    import RestartRobot from './RestartRobot.svelte';

    import RobotControl from './tabs/RobotControl.svelte';
    import Configuration from './tabs/Configuration.svelte';

    import { RobotState } from '../librobocol/types';
    import { connection, robot, popouts, loop, DEFAULT_OP_MODE_NAME, OpModeState } from '../util/robocol.svelte';
    import { onMount } from 'svelte';

    const tabs = [RobotControl, Configuration];

    let tab = $state(0);
    let pad = $derived(tab < 2);

    let Tab = $derived(tabs[tab]);

    function stringifyState(state: RobotState, opMode = DEFAULT_OP_MODE_NAME) {
        let map = {
            [RobotState.Unknown]: 'Unknown',
            [RobotState.NotStarted]: 'Not Started',
            [RobotState.Init]: 'Init',
            [RobotState.Stopped]: 'Stopped',
            [RobotState.EmergencyStop]: 'Emergency Stop'
        };

        if (map[state]) return map[state];
        if (opMode === DEFAULT_OP_MODE_NAME) return 'Idle';

        return opMode;
    }

    onMount(() => loop());
</script>

<svelte:window onbeforeunload={() => {
    if (popouts.stackTrace && !popouts.stackTrace.closed) popouts.stackTrace.close();
    if (popouts.graphing && !popouts.graphing.closed) popouts.graphing.close();
    if (popouts.fieldView && !popouts.fieldView.closed) popouts.fieldView.close();
}} />

<Navbar bind:tab />

<div class="content">
    <div class="status-bar">
        <div class="indicators">
            <span class="robot-state">
                {#if !!connection.remote}
                    {#if robot.state == RobotState.Running && robot.activeOpMode !== DEFAULT_OP_MODE_NAME}
                        {#if robot.opModeState == OpModeState.Init}
                            <svg class="init" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                                <path d="M360-320h80v-320h-80v320Zm160 0h80v-320h-80v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                            </svg>
                        {:else}
                            <svg class="running" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                                <path d="m380-300 280-180-280-180v360ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
                            </svg>
                        {/if}
                    {/if}
                    <span class="text">{stringifyState(robot.state, robot.activeOpMode)}</span>
                {:else}
                    {#if connection.active && connection.overridden}
                        <span style="color: var(--red)">Overridden</span>
                    {:else}
                        Disconnected
                    {/if}
                {/if}
            </span>
            <Battery bind:voltage={robot.batteryLevel} />
            <Gamepads bind:gamepad1={connection.gamepad1} bind:gamepad2={connection.gamepad2} />
        </div>

        <RestartRobot height={20} width={20} style="margin-right: 20px" />
        <Link bind:on={connection.active} style="margin-right: 20px" />

        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="close" onclick={() => window.close()}></div>
    </div>

    <div class="holder" class:pad>
        <Tab />
    </div>
</div>

<style>
    .content {
        flex: 1;
        overflow: auto;
        display: flex;
        flex-direction: column;
    }

    .status-bar {
        height: 40px;
        margin: 0 15px;
    }

    .status-bar, .indicators {
        display: flex;
        align-items: center;
        margin-right: 20px;
        user-select: none;
    }

    .indicators {
        -webkit-app-region: drag;
        justify-content: space-around;
        flex: 1;
    }

    .robot-state {
        width: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 5px;
    }

    .robot-state .text {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .robot-state svg {
        height: 24px;
    }

    .close {
        width: 12px;
        height: 12px;
        position: relative;
        transform: rotate(45deg);

        margin-left: auto;
    }

    .close::before, .close::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        background: #000;
        transition: background .2s;
        border-radius: 2px;
    }

    .close:hover::before, .close:hover::after {
        background: var(--red);
    }

    .close::before {
        width: 4px;
        height: 100%;
    }

    .close::after {
        width: 100%;
        height: 4px;
    }

    .holder {
        flex: 1;
        overflow-x: hidden;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .pad {
        padding: 15px;
    }
</style>
