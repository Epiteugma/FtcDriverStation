<script lang="ts">
    import { onMount } from 'svelte';
    import LabeledSelect from '../LabeledSelect.svelte';
    import Telemetry from '../../librobocol/packets/telemetry';
    import { TELEMETRY_NUMBER_LINE_REGEX } from '../../util/robocol.svelte';

    const FIELD_SIZE = 3.6;

    let field: HTMLCanvasElement = $state(null);
    let ctx: CanvasRenderingContext2D = $state(null);

    let fieldImage: HTMLImageElement = $state(null);

    let config = $state({
        origin: '0, 0',
        front: 0,

        x: {
            unit: 1,
            direction: 1,
        },

        y: {
            unit: 1,
            direction: 1,
        },

        heading: {
            unit: 1,
            direction: 1,
        }
    });

    let keys = $state({
        x: '',
        y: '',
        heading: '',
    });

    let originVec = $derived.by(() => {
        let split = config.origin.split(',');
        if (split.length != 2) return [0, 0];

        return [Number(split[0].trim()) || 0, Number(split[1].trim()) || 0];
    });

    let telemetryNumberKeys = $state([
        { name: 'None', value: '' },
        { hr: true },
    ]);

    let lastPosition = { x: 0, y: 0, heading: 0, recv: 0 };
    let position = { x: 0, y: 0, heading: 0, recv: 0 };

    function recursiveApply(src: any, dst: any) {
        for (let k in dst) {
            if (typeof dst[k] === 'object' && !Array.isArray(dst[k])) recursiveApply(src[k], dst[k]);
            dst[k] = src[k];
        }
    }

    onMount(() => {
        try {
            let savedConfig = JSON.parse(localStorage.getItem('fieldView_config'));
            recursiveApply(savedConfig, config);
        } catch {  }

        new ResizeObserver(resize).observe(field);

        ctx = field.getContext('2d')!;

        draw();
    });

    function saveConfig() {
        localStorage.setItem('fieldView_config', JSON.stringify(config));
    }

    function processTelemetry(telemetry: Telemetry) {        
        let data: { [key: string]: number; } = {};

        for (let [key, value] of telemetry.dataStrings) {
            if (key.startsWith('$') && key.endsWith('$')) continue;

            let match = Array.from(value.matchAll(TELEMETRY_NUMBER_LINE_REGEX))?.[0];
            if (!match) continue;

            data[match[1]] = parseFloat(match[2]);
        }

        for (let [key, value] of telemetry.dataNumbers) {
            data[key] = value;
        }

        telemetryNumberKeys = telemetryNumberKeys.slice(0, 2);

        let newPosition = {
            x: undefined,
            y: undefined,
            heading: undefined,
            recv: Date.now()
        };

        for (let key in data) {
            telemetryNumberKeys.push({ name: key, value: key });

            if (key === keys.x) newPosition.x = data[key] * config.x.unit * config.x.direction;
            if (key === keys.y) newPosition.y = data[key] * config.y.unit * config.y.direction;
            if (key === keys.heading) newPosition.heading = data[key] * config.heading.unit * config.heading.direction;
        }

        if (newPosition.x != undefined || newPosition.y != undefined || newPosition.heading != undefined) {
            newPosition.x ||= lastPosition.x;
            newPosition.y ||= lastPosition.y;
            newPosition.heading ||= lastPosition.heading;

            lastPosition = position;
            position = newPosition;
        }
    }

    function resize() {
        const size = field.getBoundingClientRect();

        field.width = size.width;
        field.height = size.height;
    }

    function canvasHeuristics() {
        let x0 = field.width * 0.5 - field.width * 0.5;
        let x1 = field.width * 0.5 + field.width * 0.5;
        let y0 = field.height * 0.5 - field.height * 0.5;
        let y1 = field.height * 0.5 + field.height * 0.5;

        return {
            x0, x1, y0, y1,

            origin: {
                x: (x0 + x1) * 0.5,
                y: (y0 + y1) * 0.5,
            },

            scale: {
                x: (x1 - x0) / FIELD_SIZE,
                y: (y1 - y0) / FIELD_SIZE,
            },
        };
    }

    function toCanvasVec(x: number, y: number) {
        let { origin, scale } = canvasHeuristics();

        return {
            x: origin.x + (originVec[0] + x) * scale.x,
            y: origin.y - (originVec[1] + y) * scale.y,
        };
    }

    function toCanvasDistance(x: number, y?: number) {
        let { scale } = canvasHeuristics();
        return { x: x * scale.x, y: (y ?? x) * scale.y };
    }

    function rotate(vec: { x: number; y: number; }, theta: number) {
        let x = Math.cos(theta) * vec.x - Math.sin(theta) * vec.y;
        let y = Math.sin(theta) * vec.x + Math.cos(theta) * vec.y;

        return { x, y };
    }

    function draw() {
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, field.width, field.height);

        let x0 = field.width * 0.5 - field.width * 0.5;
        let y0 = field.height * 0.5 - field.height * 0.5;

        ctx.drawImage(fieldImage, x0, y0, field.width, field.height);

        let interp = (Date.now() - position.recv) / (position.recv - lastPosition.recv);
        if (interp > 1) interp = 1;

        let interpPosition = {
            x: lastPosition.x + (position.x - lastPosition.x) * interp,
            y: lastPosition.y + (position.y - lastPosition.y) * interp,
            heading: lastPosition.heading + (position.heading - lastPosition.heading) * interp,
        };

        let robot = toCanvasVec(interpPosition.x, interpPosition.y);
        let size = toCanvasDistance(0.4572);
        
        ctx.translate(robot.x, robot.y);
        ctx.rotate(-interpPosition.heading - config.front);

        ctx.lineWidth = field.width * 0.01;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.roundRect(-size.x / 2, -size.y / 2, size.x, size.y, 4);

        ctx.moveTo(0, 0);
        ctx.lineTo(0, -size.y / 2);

        ctx.stroke();

        ctx.rotate(interpPosition.heading + config.front);
        ctx.translate(-robot.x, -robot.y);
    }
</script>

<svelte:window onmessage={(event) => processTelemetry(event.data)} onbeforeunload={saveConfig} />
<img src="./field.png" alt="Field preview" hidden bind:this={fieldImage}>

<div class="holder">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="close" onclick={() => window.close()}></div>

    <h1>Field View</h1>

    <div class="row">
        <span>Origin</span>

        <LabeledSelect options={[
            { name: 'Center', value: '0, 0' },
            { name: 'Bottom Left', value: '-1.8, -1.8' },
            { name: 'Bottom Right', value: '1.8, -1.8' },
            { name: 'Top Left', value: '-1.8, 1.8' },
            { name: 'Top Right', value: '1.8, 1.8' },
        ]} bind:selected={config.origin} />

        <LabeledSelect options={[
            { name: 'Facing +X', value: -Math.PI * 0.5 },
            { name: 'Facing -X', value: Math.PI * 0.5 },
            { name: 'Facing +Y', value: 0 },
            { name: 'Facing -Y', value: Math.PI },
        ]} bind:selected={config.front} />
    </div>

    <div class="row">
        <span>X-axis</span>
        
        <LabeledSelect label="DIRECTION" options={[
            { name: 'Right', value: 1 },
            { name: 'Left', value: -1 },
        ]} bind:selected={config.x.direction} />

        <LabeledSelect label="UNIT" options={[
            { name: 'Millimeters', value: 0.001 },
            { name: 'Centimeters', value: 0.01 },
            { name: 'Meters', value: 1 },
            { name: 'Inches', value: 0.0254 },
        ]} bind:selected={config.x.unit} />

        <LabeledSelect options={telemetryNumberKeys} label="TELEMETRY KEY" bind:selected={keys.x} />
    </div>

    <div class="row">
        <span>Y-axis</span>

        <LabeledSelect label="DIRECTION" options={[
            { name: 'Up', value: 1 },
            { name: 'Down', value: -1 },
        ]} bind:selected={config.y.direction} />

        <LabeledSelect label="UNIT" options={[
            { name: 'Millimeters', value: 0.001 },
            { name: 'Centimeters', value: 0.01 },
            { name: 'Meters', value: 1 },
            { name: 'Inches', value: 0.0254 },
        ]} bind:selected={config.y.unit} />

        <LabeledSelect options={telemetryNumberKeys} label="TELEMETRY KEY" bind:selected={keys.y} />
    </div>

    <div class="row">
        <span>Heading</span>

        <LabeledSelect label="DIRECTION" options={[
            { name: 'Clockwise', value: -1 },
            { name: 'Anti-clockwise', value: 1 },
        ]} bind:selected={config.heading.direction} />

        <LabeledSelect label="UNIT" options={[
            { name: 'Degrees', value: 1 / 180 * Math.PI },
            { name: 'Radians', value: 1 },
        ]} bind:selected={config.heading.unit} />

        <LabeledSelect options={telemetryNumberKeys} label="TELEMETRY KEY" bind:selected={keys.heading} />
    </div>

    <div class="field-holder">
        <canvas class="field" bind:this={field}></canvas>
    </div>
</div>

<style>
    .holder {
        display: flex;
        flex: 1;
        flex-direction: column;
        padding: 15px;

        overflow: auto;
    }

    .field-holder {
        position: relative;
        display: flex;
        justify-content: center;
        margin-top: 10px;

        flex: 1;
        flex-shrink: 0;
        overflow: hidden;
    }

    .field {
        aspect-ratio: 1;
    }

    h1 {
        -webkit-app-region: drag;
        width: calc(100% - 20px);
        
        margin: 0;
        margin-bottom: 10px;
    }

    .close {
        position: absolute;
        width: 12px;
        height: 12px;

        top: 15px;
        right: 20px;

        transform: rotate(45deg);

        margin-left: auto;
    }

    .close::before, .close::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        background: #000;
        transition: background .2s;
        border-radius: 2px;
    }

    .close:hover::before, .close:hover::after {
        background: var(--red);
    }

    .close::before {
        width: 4px;
        height: 100%;
    }

    .close::after {
        width: 100%;
        height: 4px;
    }

    .row {
        display: flex;
        align-items: flex-end;
        gap: 20px;
        margin-bottom: 10px;
    }
</style>