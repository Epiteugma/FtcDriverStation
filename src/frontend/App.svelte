<script lang="ts">
    import Navbar from './Navbar.svelte';
    import Battery from './Battery.svelte';
    import Gamepads from './Gamepads.svelte';
    import Link from './Link.svelte';

    import RobotControl from './tabs/RobotControl.svelte';
    import Configuration from './tabs/Configuration.svelte';
    import ProgramManage from './tabs/ProgramManage.svelte';

    import { RobotState } from '../librobocol/types';
    import { connection, robot, loop, DEFAULT_OP_MODE_NAME } from '../util/robocol.svelte';

    const tabs = [RobotControl, Configuration, ProgramManage];

    let tab = $state(0);
    let pad = $derived(tab < 2);

    let Tab = $derived(tabs[tab]);

    function stringifyState(state: RobotState, opMode = DEFAULT_OP_MODE_NAME) {
        let map = {
            [RobotState.Unknown]: 'Unknown',
            [RobotState.NotStarted]: 'Not Started',
            [RobotState.Stopped]: 'Stopped',
            [RobotState.EmergencyStop]: 'Emergency Stop'
        };

        if (map[state]) return map[state];
        if (opMode === DEFAULT_OP_MODE_NAME) return 'Idle';

        return (state === RobotState.Running ? '[Running]' : '[Init]') + ' ' + opMode;
    }

    setInterval(loop);
</script>

<Navbar bind:tab />

<div class="content">
    <div class="status-bar">
        <div class="indicators">
            <span style="width: 120px">
                {#if !!connection.remote}
                    {stringifyState(robot.state, robot.activeOpMode)}
                {:else}
                    Disconnected
                {/if}
            </span>
            <Battery bind:voltage={robot.batteryLevel} />
            <Gamepads bind:gamepad1={connection.gamepad1} bind:gamepad2={connection.gamepad2} />
        </div>

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