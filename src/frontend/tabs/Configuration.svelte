<script lang="ts">
    import { onMount } from 'svelte';
    import { Commands, robot, sendCommand } from '../../util/robocol.svelte';
    import HardwareView from '../HardwareView.svelte';
    import { jsonToXML, xmlToJSON, type DeviceConfiguration } from '../../util/configuration';

    let editing: {
        isDirty: boolean;
        name: string;
    } | null = $state(null);

    let config: DeviceConfiguration | null = $state(null);
    let children: number[] = $state([]);

    function onConfigurationReceived(xml: string) {
        config = xmlToJSON(xml);
        children = [];
    }

    onMount(() => {
        robot.onConfigurationReceived = onConfigurationReceived;
        return () => (robot.onConfigurationReceived = null);
    });
</script>

{#if editing && config}
    <div>
        {#if !children.length}
            <input type="text" placeholder="name" bind:value={editing.name}>
            <button onclick={() => {
                sendCommand(Commands.SaveConfiguration, JSON.stringify(editing) + ';' + jsonToXML(config!));

                editing = null;
                config = null;
            }}>Save</button>
            <button onclick={() => sendCommand(Commands.Scan)}>Scan</button>
        {:else}
            <button>Done</button>
        {/if}
        <button class="danger" onclick={() => {
            if (children.length) children.pop();
            else {
                editing = null;
                config = null;
            }
        }}>Cancel</button>
    </div>

    <HardwareView bind:config bind:children />
{:else if editing}
    <button class="danger" onclick={() => (editing = null)}>Cancel</button>

    Awaiting configuation from robot controller...
{:else}
    <div>
        <button onclick={() => {
            editing = { isDirty: false, name: '' };
            config = xmlToJSON('');
        }}>New</button>
        <span style="margin-left: 10px">Active configuration: {robot.activeConfiguration?.name || 'None'}</span>
    </div>

    {#each robot.configurations as config, i}
        <div class="config">
            {config.name}

            <div class="buttons">
                <button class="green" onclick={() => {
                    sendCommand(Commands.ActivateConfig, config);
                }}>Activate</button>
                <button onclick={() => {
                    editing = config;
                    sendCommand(Commands.RequestParticularConfiguration, config);
                }}>Edit</button>
                <button class="danger" onclick={() => {
                    if (!confirm('Are you sure that you want to delete ' + config.name + '?')) return;

                    sendCommand(Commands.DeleteConfig, config);
                    robot.configurations.splice(i, 1);
                }}>Delete</button>
            </div>
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
        justify-content: space-between;
        gap: 5px;
    }
</style>
