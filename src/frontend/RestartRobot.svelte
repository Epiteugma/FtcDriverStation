<script lang="ts">
    import { RobotState } from '../librobocol/types';
    import { connection, robot, sendCommand, Commands } from '../util/robocol.svelte';

    let { width = 24, height = 24, style = '' } = $props();

    let disabled = $derived(!connection.remote || ![RobotState.Init, RobotState.Running, RobotState.EmergencyStop].includes(robot.state));
    let restarting = $state(false);

    function restartRobot() {
        if (restarting || disabled) return;

        sendCommand(Commands.RestartRobot);
        restarting = true;
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<svg class:restarting class:disabled xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" {height} {width} {style} onclick={restartRobot} onanimationend={() => (restarting = false)}>
    <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
</svg>

<style>
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }

        to {
            transform: rotate(360deg);
        }
    }

    svg path {
        transition: fill .2s;
        fill: #000;
    }

    svg.restarting {
        animation: spin .5s;
    }

    svg.restarting, svg.disabled {
        opacity: .5;
    }

    svg:not(.disabled):not(.restarting):hover path {
        fill: #f50;
    }
</style>
