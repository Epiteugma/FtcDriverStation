<script lang="ts">
    import { DeviceFlavor } from '../util/configuration';
    import HardwareSelect from './HardwareSelect.svelte';

    let { ports = $bindable(0), devices = $bindable([]), flavor = DeviceFlavor.BuiltIn, pairs = false } = $props();
</script>

{#each new Array(ports / (pairs ? 2 : 1)) as _, i}
    <div class="port">
        {#each new Array(pairs ? 2 : 1) as _, j}
            {@const port = i * (pairs ? 2 : 1) + j}
            {@const device = devices.find(dev => dev.port == port)}

            <div class="port-number">{port}</div>

            {#if device}
                <HardwareSelect bind:value={device.xmlTag} {flavor} onchange={(value: string) => {
                    if (value) return;
                    devices.splice(devices.indexOf(device), 1);
                }} />
                <input type="text" placeholder="Device name" bind:value={device.name} />
            {:else}
                <HardwareSelect {flavor} onchange={(value: string) => {
                    if (!value) return;

                    let device = $state({ xmlTag: value, flavor, port, children: [] });
                    devices.push(device);
                }} />
                <input type="text" placeholder="Device name" disabled />
            {/if}
        {/each}
    </div>
{/each}

<style>
    input {
        outline: none;
        padding: 0 2px;
        border: 1px solid #000;
        border-radius: 5px;

        min-width: 100px;
        flex: 1;
    }

    .port {
        display: flex;
        gap: 10px;
    }

    .port-number {
        flex-shrink: 0;
        display: inline-block;
        padding: 1px 0;
        border-radius: 5px;
        font-size: 13px;
        width: 50px;
        text-align: center;
        background: var(--primary);
        color: #fff;
    }
</style>
