<script lang="ts">
    import { onMount } from 'svelte';
    import { Commands, robot, sendCommand } from '../../util/robocol.svelte';
    import HardwareView from '../HardwareView.svelte';
    import { CONTROL_HUB_INTERNAL_ADDRESS, DeviceFlavor, DiscoveredLynxModuleImuType, jsonToXML, UsbDeviceType, xmlToJSON, type DeviceConfiguration, type DiscoveredLynxModule, type LynxModule, type SerialDevice } from '../../util/configuration';

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

    function onScanResponse(devices: { errorMessage: string; map: { [key: string]: UsbDeviceType } }) {
        if (!config) return;
        let keys = Object.keys(devices.map);

        for (let i = 0; i < keys.length; i++) {
            let serialNumber = keys[i];
            let type = devices.map[serialNumber];
            let childIndex = config.children.findIndex(dev => (dev as SerialDevice).serialNumber == serialNumber);

            if (childIndex < 0) {
                let xmlTag = '';

                switch (type) {
                    case UsbDeviceType.FtdiUsbUnknown:
                        // TODO: ignore? check DS code
                        break;
                    case UsbDeviceType.LynxUsb:
                        xmlTag = 'LynxModule';
                        sendCommand(Commands.DiscoverLynxModules, serialNumber);
                        break;
                    case UsbDeviceType.Webcam:
                        xmlTag = 'Webcam';
                        break;
                    case UsbDeviceType.Ethernet:
                        xmlTag = 'EthernetDevice';
                        break;
                }

                if (!xmlTag) continue;

                config.children.push({
                    xmlTag,
                    name: 'Scanned ' + ~~(Math.random() * 1024),
                    serialNumber,
                    flavor: DeviceFlavor.BuiltIn,
                    children: [],
                } as SerialDevice);
            }

            if (type === UsbDeviceType.LynxUsb) sendCommand(Commands.DiscoverLynxModules, serialNumber);
        }
    }

    function onModuleDiscoveryResponse(response: { serialNumber: string; modules: DiscoveredLynxModule[]; }) {
        let usbModule = config?.children.find(dev => (dev as SerialDevice).serialNumber == response.serialNumber);
        if (!config || !usbModule) return;

        for (let i = 0; i < response.modules.length; i++) {
            let module = response.modules[i];
            let existing = usbModule.children.find(dev => dev.port == module.moduleAddress);

            if (existing) continue;

            let mod: LynxModule = {
                xmlTag: 'LynxModule',
                name: module.moduleAddress == CONTROL_HUB_INTERNAL_ADDRESS ? 'Control Hub' : 'Expansion Hub ' + module.moduleAddress, // todo: double check how real DS does this
                port: module.moduleAddress,
                flavor: DeviceFlavor.BuiltIn,
                children: [],
                motors: [],
                servos: [],
                digital: [],
                analog: [],
                i2c0: [],
                i2c1: [],
                i2c2: [],
                i2c3: [],
            };

            switch (module.imuType) {
                case DiscoveredLynxModuleImuType.BNO055:
                case DiscoveredLynxModuleImuType.BHI260:
                    mod.i2c0.push({
                        xmlTag: module.imuType == DiscoveredLynxModuleImuType.BNO055 ? 'LynxEmbeddedIMU' : 'ControlHubImuBHI260AP',
                        name: 'imu',
                        flavor: DeviceFlavor.I2C,
                        port: 0,
                        children: [],
                    });
                    break;
            }

            usbModule.children.push(mod);
        }
    }

    onMount(() => {
        robot.onConfigurationResponse = onConfigurationReceived;
        robot.onScanResponse = onScanResponse;
        robot.onModuleDiscoveryResponse = onModuleDiscoveryResponse;

        return () => (robot.onConfigurationResponse = null);
    });

    let savedDevice: DeviceConfiguration | null = $state(null);

    $effect(() => {
        if (!config || !children.length) return;

        let device = config;

        for (let i = 0; i < children.length; i++) {
            device = device.children[children[i]];
        }

        savedDevice = JSON.parse(JSON.stringify(device));
    });
</script>

{#if editing && config}
    <div>
        {#if !children.length}
            <input type="text" placeholder="name" bind:value={editing.name}>
            <button disabled={!editing.name} onclick={() => {
                sendCommand(Commands.SaveConfiguration, JSON.stringify(editing) + ';' + jsonToXML(config!));

                editing = null;
                config = null;
                savedDevice = null;
            }}>Save</button>
            <button onclick={() => sendCommand(Commands.Scan)}>Scan</button>
        {:else}
            <button onclick={() => {
                children.pop();
                editing!.isDirty = true;
            }}>Done</button>
        {/if}
        <button class="danger" onclick={() => {
            if (children.length) {
                let child = children.pop()!;
                let root = config;

                if (savedDevice) {
                    for (let i = 0; i < children.length; i++) {
                        root = root!.children[children[i]];
                    }

                    root!.children[child] = savedDevice;
                }
            } else {
                if (editing!.isDirty && !confirm('You have unsaved changes, are you sure you want to exit?')) return;

                editing = null;
                config = null;
                savedDevice = null;
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
