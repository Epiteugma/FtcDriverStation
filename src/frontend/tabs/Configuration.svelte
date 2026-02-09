<script lang="ts">
    import { Commands, robot, sendCommand } from '../../util/robocol.svelte';

    let editing = $state(null);
</script>

{#if editing}
    <div>
        <input type="text" placeholder="name">
        <button>Save</button>
        <button onclick={() => sendCommand(Commands.Scan)}>Scan</button>
        <button class="danger" onclick={() => (editing = null)}>Cancel</button>
    </div>

    TODO
{:else}
    <button onclick={() => (editing = { isDirty: false, name: '' })}>New</button>

    {#each robot.configurations as config}
        <div class="config">
            {config.name}

            <button class="green">Activate</button>
            <button onclick={() => (editing = config)}>Edit</button>
            <button class="danger">Delete</button>
        </div>
    {/each}

    {#if !robot.configurations.length}
        No configurations found.
    {/if}
{/if}

<style>
    input {
        outline: none;
        padding: 0 2px;
        border: 1px solid #000;
        border-radius: 5px;
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

    button.green {
        background: var(--green);
        margin-left: 10px;
    }

    button.danger {
        background: var(--red);
    }

    .config {
        display: flex;
        align-items: center;
        gap: 5px;
    }
</style>