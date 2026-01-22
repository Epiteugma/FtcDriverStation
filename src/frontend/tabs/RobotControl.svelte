<script lang="ts">
    import { sendCommand } from '../../util/robocol.svelte';

    let name = $state('');
</script>

<input type="text" bind:value={name} placeholder="OpMode name xD">
<button onclick={() => sendCommand('CMD_INIT_OP_MODE', name)}>Init</button>
<button onclick={() => sendCommand('CMD_RUN_OP_MODE', name)}>Start</button>