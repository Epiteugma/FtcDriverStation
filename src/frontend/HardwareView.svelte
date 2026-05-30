<script>
    import { onMount } from 'svelte';
    import { DeviceFlavor } from '../util/configuration';
    import HardwarePorts from './HardwarePorts.svelte';

    let lastDevice = $state(null);
    let { device = $bindable(null) } = $props();

    let i2cBuses = $derived(
        device.xmlTag === 'LynxModule' ? [device.i2c0, device.i2c1, device.i2c2, device.i2c3] : []
    );

    let i2cMinPorts = $derived(i2cBuses.map(
        bus => bus.reduce((prev, curr) => Math.max(prev, curr.port + 1), 0)
    ));

    let i2cPorts = $state([]);

    $effect(() => {
        if (lastDevice === device) return;

        i2cPorts = [];
        lastDevice = device;

        for (let i = 0; i < i2cBuses.length; i++) {
            let bus = i2cBuses[i];
            i2cPorts[i] = bus.reduce((prev, curr) => Math.max(prev, curr.port + 1), 0);
        }
    });

</script>

<h2>
    {#if device.xmlTag === 'Robot'}
        USB Devices in configuration
    {:else}
        <input type="text" class="header" bind:value={device.name}>
    {/if}
</h2>

{#if device.xmlTag === 'LynxModule'}
    <div class="device">Motors</div>
    <HardwarePorts bind:parent={device} bind:devices={device.motors} flavor={DeviceFlavor.Motor} ports={4} />

    <div class="device">Servos</div>
    <HardwarePorts bind:parent={device} bind:devices={device.servos} flavor={DeviceFlavor.Servo} ports={6} />

    <div class="device">Digital Devices</div>
    <HardwarePorts bind:parent={device} bind:devices={device.digital} flavor={DeviceFlavor.DigitalIO} ports={8} pairs />

    <div class="device">Analog Input Devices</div>
    <HardwarePorts bind:parent={device} bind:devices={device.analog} flavor={DeviceFlavor.AnalogSensor} ports={4} pairs />

    {#each i2cPorts as count, i}
        <div class="device">
            I²C Bus {i}
            <div>
                <button onclick={() => i2cPorts[i]++}>Add</button>
                <button class="danger" onclick={() => {
                    i2cPorts[i] = Math.max(i2cMinPorts[i], count - 1);
                }}>Delete</button>
            </div>
        </div>
        <HardwarePorts bind:parent={device} bind:devices={i2cBuses[i]} flavor={DeviceFlavor.I2C} bind:ports={i2cPorts[i]} />
    {/each}
{/if}

{#each device.children as dev, i}
    <div class="device">
        {dev.name}
        <button onclick={() => (device = dev)}>Configure</button>
    </div>
{/each}

<style>
    h2 {
        margin: 0;
    }

    input.header {
        font-size: inherit;
        outline: none;
        border: none;
        border-bottom: 1px solid #000;
        border-radius: 0;
        background: none;
        width: 100%;
    }

    button {
        padding: 0 10px;
        border-radius: 5px;
        border: none;
        outline: none;

        background: var(--primary);
        color: #fff;
    }

    button.danger {
        background: var(--red);
    }

    .device {
        display: flex;
        gap: 10px;
        justify-content: space-between;
    }
</style>
