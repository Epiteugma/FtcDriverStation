<script lang="ts">
    import { DeviceFlavor, type DeviceConfiguration } from '../util/configuration';
    import HardwarePorts from './HardwarePorts.svelte';

    let { config = $bindable(null), children = $bindable([]) } = $props();

    let lastDevice = $state(null);
    let device = $derived.by(() => {
        let current = config;

        for (let i = 0; i < children.length; i++) {
            current = current.children[children[i]];
        }

        return current;
    });


    let i2cBuses = $derived(
        device.xmlTag === 'LynxModule' ? [device.i2c0, device.i2c1, device.i2c2, device.i2c3] : []
    );

    let i2cMinPorts = $derived(i2cBuses.map(
        bus => bus.reduce((prev: number, curr: DeviceConfiguration) => Math.max(prev, curr.port! + 1), 0)
    ));

    let i2cPorts: number[] = $state([]);

    $effect(() => {
        if (lastDevice === device) return;

        i2cPorts = [];
        lastDevice = device;

        for (let i = 0; i < i2cBuses.length; i++) {
            let bus = i2cBuses[i];
            i2cPorts[i] = bus.reduce((prev: number, curr: DeviceConfiguration) => Math.max(prev, curr.port! + 1), 0);
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
    <HardwarePorts bind:devices={device.motors} flavor={DeviceFlavor.Motor} ports={4} />

    <div class="device">Servos</div>
    <HardwarePorts bind:devices={device.servos} flavor={DeviceFlavor.Servo} ports={6} />

    <div class="device">Digital Devices</div>
    <HardwarePorts bind:devices={device.digital} flavor={DeviceFlavor.DigitalIO} ports={8} pairs />

    <div class="device">Analog Input Devices</div>
    <HardwarePorts bind:devices={device.analog} flavor={DeviceFlavor.AnalogSensor} ports={4} pairs />

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
        <HardwarePorts bind:devices={i2cBuses[i]} flavor={DeviceFlavor.I2C} bind:ports={i2cPorts[i]} />
    {/each}
{:else if device.xmlTag === 'ServoHub'}
    <div class="device">Servos</div>
    <HardwarePorts devices={device.children} flavor={DeviceFlavor.Servo} ports={6} />
{:else if device.xmlTag === 'EthernetDevice'}
    <input type="text" placeholder={(() => {
        let ip = device.serialNumber.split(':')[2] || '127.0.0.1';
        let split = ip.split('.');

        if (split.length !== 4) split = '127.0.0.1'.split('.');
        split[3] = '1';

        return split.join('.');
    })()} bind:value={device.ipAddress}>
    <span class="eth-tooltip">Enter the IP address of the target device</span>
{:else}
    {#each device.children as dev, i}
        <div class="device">
            <span>
                {dev.name}
                {#if device.xmlTag === 'Robot'}
                    <span class="serial-number">
                        {#if dev.xmlTag === 'EthernetDevice'}
                            {dev.serialNumber.split(':').slice(1).join(':')}
                        {:else}
                            {dev.serialNumber}
                        {/if}
                    </span>
                {/if}
            </span>
            <button onclick={() => children.push(i)}>Configure</button>
        </div>
    {/each}
{/if}

{#if device.xmlTag === 'Robot' && !device.children.length}
    No devices found; try pressing 'Scan' to run discovery.
{/if}

<style>
    h2 {
        margin: 0;
    }

    input {
        outline: none;
        padding: 0 2px;
        border: 1px solid #000;
        border-radius: 5px;

        min-width: 100px;
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

    .eth-tooltip {
        margin-top: -10px;
        font-size: 12px;
    }

    .serial-number {
        color: #777;
        font-size: 12px;
    }
</style>
