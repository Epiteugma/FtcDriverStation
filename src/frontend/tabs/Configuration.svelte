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
    <div>
        <button onclick={() => (editing = { isDirty: false, name: '' })}>New</button>
        <span style="margin-left: 10px">Active configuration: {robot.activeConfiguration?.name || 'None'}</span>
    </div>

    {#each robot.configurations as config, i}
        <div class="config">
            {config.name}

            <button class="green" onclick={() => sendCommand(Commands.ActivateConfig, config)}>Activate</button>
            <button onclick={() => (editing = config)}>Edit</button>
            <button class="danger" onclick={() => {
                if (!confirm('Are you sure that you want to delete ' + config.name + '?')) return;

                sendCommand(Commands.DeleteConfig, config);
                robot.configurations.splice(i, 1);
            }}>Delete</button>
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