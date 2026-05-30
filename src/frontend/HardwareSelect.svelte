<script lang="ts">
    import { DeviceFlavor } from '../util/configuration';
    import { robot } from '../util/robocol.svelte';

    let { flavor = DeviceFlavor.BuiltIn, value = $bindable(''), onchange = null } = $props();

    let devices = $derived(
        Object.values(robot.deviceList)
            .filter(dev => dev.flavor === flavor)
            .sort((a, b) => a.name.localeCompare(b.name))
    );
</script>

<select bind:value onchange={() => onchange?.(value)}>
    <option value="">None</option>

    {#each devices as device}
        <option value={device.xmlTag}>{device.name}</option>
    {/each}
</select>

<style>
    select {
        outline: none;
        padding: 0 2px;
        font-size: 13px;
        border: 1px solid #000;
        border-radius: 5px;

        min-width: 60px;
        flex: 1;
    }
</style>
