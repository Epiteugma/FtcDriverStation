import { XMLParser } from 'fast-xml-parser';
import XMLBuilder from 'fast-xml-builder';
import { robot as robotState } from './robocol.svelte';

export enum DeviceFlavor {
    BuiltIn = 'BUILT_IN',
    I2C = 'I2C',
    Motor = 'MOTOR',
    AnalogSensor = 'ANALOG_SENSOR',
    Servo = 'SERVO',
    DigitalIO = 'DIGITAL_IO',
    AnalogOutput = 'ANALOG_OUTPUT',
    EthernetOverUSB = 'ETHERNET_OVER_USB',
}

export enum ConfigFileLocation {
    None = 'NONE',
    LocalStorage = 'LOCAL_STORAGE',
    Resource = 'RESOURCE',
}

export interface DeviceConfiguration {
    flavor: DeviceFlavor;
    xmlTag: string;
    name: string;
    children: DeviceConfiguration[];
    port?: number;
    detached?: boolean;
}

export interface SerialDevice extends DeviceConfiguration {
    serialNumber: string;
    parentModuleAddress?: number;
    ipAddress?: string;
}

export interface LynxModule extends DeviceConfiguration {
    motors: DeviceConfiguration[];
    servos: DeviceConfiguration[];
    digital: DeviceConfiguration[];
    analog: DeviceConfiguration[];
    i2c0: DeviceConfiguration[];
    i2c1: DeviceConfiguration[];
    i2c2: DeviceConfiguration[];
    i2c3: DeviceConfiguration[];
}

export enum DiscoveredLynxModuleImuType {
    Unknown = 'unknown',
    None = 'none',
    BNO055 = 'BNO055',
    BHI260 = 'BHI260',
}

export const EXPANSION_HUB_PRODUCT_NUMBER = 0x311152;
export const SERVO_HUB_PRODUCT_NUMBER = 0x111855;
export const CONTROL_HUB_INTERNAL_ADDRESS = 173;

export interface DiscoveredLynxModule {
    imuType: DiscoveredLynxModuleImuType;
    moduleAddress: number;
    revProductNumber: number;
    isParent: boolean;
}

export enum UsbDeviceType {
    FtdiUsbUnknown = 'FTDI_USB_UNKNOWN_DEVICE',
    LynxUsb = 'LYNX_USB_DEVICE',
    Webcam = 'WEBCAM',
    Ethernet = 'ETHERNET_DEVICE',
    Unknown = 'UNKNOWN_DEVICE',
}

const fxp = new XMLParser({ ignoreAttributes: false });
const fxb = new XMLBuilder({ ignoreAttributes: false, suppressEmptyNode: true, format: true });

function parseDevice(parent: DeviceConfiguration, tag: string, root: any) {
    let deviceInfo = robotState.deviceList[tag];

    if (!deviceInfo) {
        console.warn('Unknown device encoutered: ' + tag + ', skipped.');
        return;
    }

    let device: DeviceConfiguration = {
        xmlTag: tag,
        name: root['@_name'],
        flavor: deviceInfo.flavor,
        children: [],
    };

    if (!device.name) {
        console.warn('Unnamed device encountered: ' + tag + ', skipped.');
        return;
    }

    if (root['@_serialNumber']) {
        let serial = device as unknown as SerialDevice;
        let pma = Number(root['@_parentModuleAddress']);

        serial.serialNumber = root['@_serialNumber'];
        serial.ipAddress = root['@_ipAddress'];

        if (!isNaN(pma)) serial.parentModuleAddress = pma;
    }

    if (tag === 'LynxModule') {
        let mod = device as unknown as LynxModule;

        mod.port = Number(root['@_port']);
        mod.motors = [];
        mod.servos = [];
        mod.digital = [];
        mod.analog = [];
        mod.i2c0 = [];
        mod.i2c1 = [];
        mod.i2c2 = [];
        mod.i2c3 = [];
    }

    if (parent.xmlTag === 'LynxModule') {
        let mod = parent as unknown as LynxModule;

        device.port = Number(root['@_port']);

        switch (device.flavor) {
            case DeviceFlavor.Motor:
                mod.motors.push(device);
                break;
            case DeviceFlavor.Servo:
                mod.servos.push(device);
                break;
            case DeviceFlavor.DigitalIO:
                mod.digital.push(device);
                break;
            case DeviceFlavor.AnalogSensor:
                mod.analog.push(device);
                break;
            case DeviceFlavor.I2C:
                let bus = Number(root['@_bus']);

                if (bus < 0 || bus > 3) {
                    console.warn('I2C device on unknown bus: ' + bus + ', skipped.');
                    return;
                }

                let buses = [mod.i2c0, mod.i2c1, mod.i2c2, mod.i2c3];
                buses[bus].push(device);

                break;
            default:
                console.warn('Unknown flavor device on LynxModule: ' + tag + ' (' + device.flavor + '), skipped.');
                break;
        }

        return;
    }

    for (let tag in root) {
        if (tag.startsWith('@_')) continue; // skip attributes
        let child = root[tag];

        if (!Array.isArray(child)) {
            parseDevice(device, tag, child);
            continue;
        }

        for (let i = 0; i < child.length; i++) parseDevice(device, tag, child[i]);
    }

    parent.children.push(device);
}

export function xmlToJSON(xml: string): DeviceConfiguration {
    let parsed = fxp.parse(xml);
    let root = parsed.Robot;

    let robot = {
        xmlTag: 'Robot',
        name: '',
        flavor: DeviceFlavor.BuiltIn,
        children: [],
    };

    if (!root) return robot;

    for (let tag in root) {
        if (tag.startsWith('@_')) continue; // skip attributes
        let child = root[tag];

        if (!Array.isArray(child)) {
            parseDevice(robot, tag, child);
            continue;
        }

        for (let i = 0; i < child.length; i++) parseDevice(robot, tag, child[i]);
    }

    return robot;
}

function serializeDevice(parent: any, parentTag: string, device: DeviceConfiguration, bus?: number) {
    let xml = { '@_name': device.name };

    if (!device.name) {
        console.warn('Unnamed device: ', device.xmlTag, ', skipped.');
        return;
    }

    if ('serialNumber' in device) {
        xml['@_serialNumber'] = device.serialNumber;

        if ('parentModuleAddress' in device) {
            xml['@_parentModuleAddress'] = device.parentModuleAddress.toString();
        }

        if ('ipAddress' in device) {
            xml['@_ipAddress'] = device.ipAddress;
        }
    }

    if (parentTag === 'LynxModule') {
        xml['@_port'] = device.port.toString();

        switch (device.flavor) {
            case DeviceFlavor.Motor:
            case DeviceFlavor.Servo:
            case DeviceFlavor.DigitalIO:
            case DeviceFlavor.AnalogSensor:
                break;
            case DeviceFlavor.I2C:
                xml['@_bus'] = bus.toString();
                break;
            default:
                console.warn('Unknown flavor device on LynxModule: ' + device.xmlTag + ' (' + device.flavor + '), skipped.');
                return;
        }

        if (!parent[device.xmlTag]) parent[device.xmlTag] = xml;
        else if (Array.isArray(parent[device.xmlTag])) parent[device.xmlTag].push(xml);
        else parent[device.xmlTag] = [parent[device.xmlTag], xml];

        return;
    }

    if (device.xmlTag === 'LynxModule') {
        xml['@_port'] = device.port.toString();

        let mod = device as unknown as LynxModule;

        for (let i = 0; i < mod.motors.length; i++) serializeDevice(xml, device.xmlTag, mod.motors[i]);
        for (let i = 0; i < mod.servos.length; i++) serializeDevice(xml, device.xmlTag, mod.servos[i]);
        for (let i = 0; i < mod.digital.length; i++) serializeDevice(xml, device.xmlTag, mod.digital[i]);
        for (let i = 0; i < mod.analog.length; i++) serializeDevice(xml, device.xmlTag, mod.analog[i]);

        let buses = [mod.i2c0, mod.i2c1, mod.i2c2, mod.i2c3];

        for (let i = 0; i < buses.length; i++) {
            for (let j = 0; j < buses[i].length; j++) serializeDevice(xml, device.xmlTag, buses[i][j], i);
        }
    } else {
        for (let i = 0; i < device.children.length; i++) serializeDevice(xml, device.xmlTag, device.children[i]);
    }

    if (!parent[device.xmlTag]) parent[device.xmlTag] = xml;
    else if (Array.isArray(parent[device.xmlTag])) parent[device.xmlTag].push(xml);
    else parent[device.xmlTag] = [parent[device.xmlTag], xml];
}

export function jsonToXML(json: DeviceConfiguration) {
    let xml = {
        '?xml': {
            '@_version': '1.0',
            '@_encoding': 'UTF-8',
            '@_standalone': 'yes',
        },
        Robot: {},
    };

    if (json.xmlTag !== 'Robot') return fxb.build(xml);

    for (let i = 0; i < json.children.length; i++) {
        serializeDevice(xml.Robot, 'Robot', json.children[i]);
    }

    return fxb.build(xml);
}

function validateDevice(parent: DeviceConfiguration, device: DeviceConfiguration) {
    if (parent.xmlTag === 'Robot') {
        const topLevelDevices = ['LynxUsbDevice', 'Webcam', 'EthernetDevice'];
        if (!topLevelDevices.includes(device.xmlTag)) return false;

        let serial = device as SerialDevice;
        if (!serial.serialNumber) return false;

        if (serial.xmlTag === 'LynxUsbModule' && (
            serial.parentModuleAddress == undefined ||
            serial.children.findIndex(dev => dev.port === serial.parentModuleAddress) < 0
        )) return false;

        return true;
    }

    if (parent.xmlTag === 'LynxUsbModule') {
        const lynxChildren = ['LynxModule', 'ServoHub'];
        if (!lynxChildren.includes(device.xmlTag)) return false;
    }

    return device.port != undefined;
}

export function validateConfig(xml: string) {
    let robot = xmlToJSON(xml);
    if (!robot.children.length) return false;

    for (let i = 0; i < robot.children.length; i++) {
        if (!validateDevice(robot, robot.children[i])) return false;
    }

    return true;
}

export function chooseName(names: string[], firstChoice: string | undefined, format: string, id = 1) {
    if (firstChoice && !names.includes(firstChoice)) return firstChoice;

    let formatted = format.replace('%d', id + '');

    if (!names.includes(formatted)) return formatted;

    let i = 0;

    do {
        i++;
        formatted = format.replace('%d', i + '');
    } while (names.includes(formatted));

    return formatted;
}
