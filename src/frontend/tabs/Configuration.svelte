<script lang="ts">
    import { onMount } from 'svelte';
    import { Commands, robot, sendCommand } from '../../util/robocol.svelte';
    import HardwareView from '../HardwareView.svelte';
    import { chooseName, ConfigFileLocation, CONTROL_HUB_INTERNAL_ADDRESS, DeviceFlavor, DiscoveredLynxModuleImuType, EXPANSION_HUB_PRODUCT_NUMBER, jsonToXML, SERVO_HUB_PRODUCT_NUMBER, UsbDeviceType, validateConfig, xmlToJSON, type DeviceConfiguration, type DiscoveredLynxModule, type LynxModule, type SerialDevice } from '../../util/configuration';

    let editing: {
        isDirty: boolean;
        location: ConfigFileLocation;
        name: string;
        resourceId?: number;
    } | null = $state(null);

    let config: DeviceConfiguration | null = $state(null);
    let children: number[] = $state([]);

    let scanning = $state(false);
    let silentScan = $state(false);
    let discovery: string[] = $state([]);

    let exporting = $state(null);

    function onConfigurationReceived(xml: string) {
        if (exporting) {
            let a = document.createElement('a');
            a.download = exporting.name + '.xml';
            a.href = URL.createObjectURL(new Blob([xml], { type: 'text/xml' }));

            a.click();
            a.remove();

            exporting = null;
            return;
        }

        config = xmlToJSON(xml);
        children = [];
    }

    function onScanResponse(devices: { errorMessage: string; map: { key: string; value: UsbDeviceType }[] }) {
        scanning = false;
        discovery = [];

        if (!config) return;

        let names = config.children.map(dev => dev.name);
        let children = [...config.children];

        for (let i = 0; i < devices.map.length; i++) {
            let device = devices.map[i];
            let childIndex = config.children.findIndex(dev => (dev as SerialDevice).serialNumber == device.key);

            if (childIndex < 0) {
                let xmlTag = '';
                let name = '';

                switch (device.value) {
                    case UsbDeviceType.LynxUsb:
                        xmlTag = 'LynxUsbDevice';

                        name = device.key === '(embedded)' ?
                            chooseName(names, 'Control Hub Portal', 'Expansion Hub Portal %d', 0) :
                            chooseName(names, undefined, 'Expansion Hub Portal %d');

                        sendCommand(Commands.DiscoverLynxModules, device.key);
                        break;
                    case UsbDeviceType.Webcam:
                        xmlTag = 'Webcam';
                        name = chooseName(names, undefined, 'Webcam %d');
                        break;
                    case UsbDeviceType.Ethernet:
                        xmlTag = 'EthernetDevice';
                        name = 'Ethernet Device';
                        break;
                }

                if (!xmlTag) continue;

                let child = {
                    xmlTag,
                    name,
                    serialNumber: device.key,
                    flavor: DeviceFlavor.BuiltIn,
                    children: [],
                } as SerialDevice;

                if (device.value === UsbDeviceType.Ethernet) {
                    let ip = child.serialNumber.split(':')[2] || '127.0.0.1';
                    let split = ip.split('.');

                    if (split.length !== 4) split = '127.0.0.1'.split('.');
                    split[3] = '1';

                    child.ipAddress = split.join('.');
                }

                names.push(child.name);
                children.push(child);

                child.detached = false;
                if (silentScan) config.children.push(child);
            } else {
                config.children[childIndex].detached = false;
            }

            if (device.value === UsbDeviceType.LynxUsb) {
                sendCommand(Commands.DiscoverLynxModules, device.key);
                discovery.push(device.key);
            }
        }

        if (silentScan) {
            for (let i = 0; i < config.children.length; i++) {
                let child = config.children[i];
                if (!children.includes(child)) child.detached = true;
            }
        } else {
            config.children = children;
        }
    }

    function onModuleDiscoveryResponse(response: { serialNumber: string; modules: DiscoveredLynxModule[]; }) {
        discovery.splice(discovery.indexOf(response.serialNumber), 1);

        let isSilent = silentScan;

        if (!discovery.length && !scanning && editing) {
            if (silentScan) silentScan = false;
            else editing.isDirty = true;
        }

        let usbModule = config?.children.find(dev => (dev as SerialDevice).serialNumber == response.serialNumber) as SerialDevice | undefined;
        if (!usbModule) return;

        let names = usbModule.children.map(dev => dev.name);
        let modules = [...usbModule.children];

        for (let i = 0; i < response.modules.length; i++) {
            let module = response.modules[i];
            let existing = usbModule.children.find(dev => dev.port == module.moduleAddress);

            if (existing) {
                existing.detached = false;
                continue;
            }

            let isEmbeddedControlHub =
                usbModule.serialNumber === '(embedded)' &&
                module.revProductNumber === EXPANSION_HUB_PRODUCT_NUMBER &&
                module.isParent &&
                module.moduleAddress === CONTROL_HUB_INTERNAL_ADDRESS
            ;

            let device: DeviceConfiguration | null = null;

            if (module.revProductNumber === EXPANSION_HUB_PRODUCT_NUMBER) {
                device = {
                    xmlTag: 'LynxModule',
                    name: isEmbeddedControlHub ?
                        chooseName(names, 'Control Hub', 'Expansion Hub %d', 0) :
                        chooseName(names, undefined, 'Expansion Hub %d', module.moduleAddress),
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
                } as LynxModule;

                if (module.isParent) usbModule.parentModuleAddress = module.moduleAddress;

                switch (module.imuType) {
                    case DiscoveredLynxModuleImuType.BNO055:
                    case DiscoveredLynxModuleImuType.BHI260:
                        (device as LynxModule).i2c0.push({
                            xmlTag: module.imuType == DiscoveredLynxModuleImuType.BNO055 ?
                                'LynxEmbeddedIMU' :
                                'ControlHubImuBHI260AP',
                            name: 'imu',
                            flavor: DeviceFlavor.I2C,
                            port: 0,
                            children: [],
                        });
                        break;
                }
            } else if (module.revProductNumber === SERVO_HUB_PRODUCT_NUMBER) {
                device = {
                    xmlTag: 'ServoHub',
                    name: chooseName(names, undefined, 'Servo Hub %d'),
                    flavor: DeviceFlavor.BuiltIn,
                    children: [],
                };
            }

            if (device) {
                names.push(device.name);
                modules.push(device);

                if (isSilent) usbModule.children.push(device);
            }
        }

        if (isSilent) {
            for (let i = 0; i < usbModule.children.length; i++) {
                let module = usbModule.children[i];
                if (!modules.includes(module)) module.detached = true;
            }
        } else {
            usbModule.children = modules;
        }
    }

    onMount(() => {
        robot.onConfigurationResponse = onConfigurationReceived;
        robot.onScanResponse = onScanResponse;
        robot.onModuleDiscoveryResponse = onModuleDiscoveryResponse;

        return () => {
            robot.onConfigurationResponse = null;
            robot.onScanResponse = null;
            robot.onModuleDiscoveryResponse = null;
        };
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

    let importInput: HTMLInputElement | null = $state(null);

    async function importConfig() {
        let file = importInput!.files![0];

        if (!file) {
            console.warn('No file.');
            return;
        }

        let name = file.name.replace(/\.xml$/, '');
        let xml = await file.text().catch(() => '');

        if (!validateConfig(xml)) {
            alert('Failed to parse configuration.');
            return;
        }

        let meta = {
            name,
            isDirty: true,
            location: ConfigFileLocation.LocalStorage,
        };

        sendCommand(Commands.SaveConfiguration, JSON.stringify(meta) + ';' + xml);
    }
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
            <button disabled={scanning || !!discovery.length} onclick={() => {
                if (!confirm('Are you sure you want to scan for devices? Unsaved changed may be lost.')) return;

                scanning = true;
                sendCommand(Commands.Scan);
            }}>{scanning || discovery.length ? 'Scanning' : 'Scan'}</button>
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
    <div class="active-config-holder">
        <button onclick={() => {
            editing = { isDirty: false, location: ConfigFileLocation.LocalStorage, name: '' };
            config = xmlToJSON('');
            scanning = true;

            sendCommand(Commands.Scan);
        }}>New</button>

        <input type="file" accept=".xml" hidden bind:this={importInput} oninput={importConfig}>
        <button onclick={() => importInput!.click()}>Import</button>

        <span class="active-config">Active configuration: {robot.activeConfiguration?.name || 'None'}</span>
    </div>

    {#each robot.configurations as config, i}
        <div class="config">
            <span class="name">{config.name}</span>

            <div class="buttons">
                <button class="green" onclick={() => {
                    sendCommand(Commands.ActivateConfig, config);
                }}>Activate</button>
                <button onclick={() => {
                    editing = config;
                    scanning = silentScan = true;

                    sendCommand(Commands.RequestParticularConfiguration, config);
                    sendCommand(Commands.Scan);
                }}>Edit</button>
                <button onclick={() => {
                    exporting = config;
                    sendCommand(Commands.RequestParticularConfiguration, config);
                }}>Export</button>
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
        padding: 1px 0;
        border-radius: 5px;
        border: none;
        outline: none;

        flex-shrink: 0;

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

    .buttons {
        display: flex;
        gap: 5px;
    }

    .config {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 5px;
    }

    .config .name {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: auto;
    }

    .active-config-holder {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .active-config {
        text-overflow: ellipsis;
        overflow: auto;
        white-space: nowrap;
    }
</style>
