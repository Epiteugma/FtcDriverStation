<script lang="ts">
    import { onMount } from 'svelte';
    import { TELEMETRY_NUMBER_LINE_REGEX } from '../../util/robocol.svelte';
    import Telemetry from '../../librobocol/packets/telemetry';

    const HISTORY_TIME = 60e3;
    const DEFAULT_SET_COLORS = ['#0000ff', '#dc143c', '#008000', '#ffa500', '#4b0082', '#1e90ff'];

    let padding = {
        left: 60,
        right: 0,
        top: 0,
        bottom: 10,
    };

    let square = {
        width: 20,
        height: 20,
    };

    let marker = {
        horizontal: 10,
        vertical: 0,
    };

    let scale = {
        min: -1,
        step: 0.1,

        time: 500,
    };

    let datasets = $state([]);

    let pausedTime = $state(null);
    let lineWidth = 1;

    let tooltip = $state({
        points: [],
        time: null,
        element: null,
        show: false,

        x: 0,
        y: 0,

        alignRight: false,
        alignTop: false,
    });

    let graph: HTMLCanvasElement = $state(null);
    let ctx: CanvasRenderingContext2D = $state(null);

    onMount(() => {
        new ResizeObserver(resize).observe(graph);
        ctx = graph.getContext('2d')!;
        
        draw();
    });

    // DEBUG
    (() => {
        function fakeKey() {
            let alphabet = 'abcdefghijklmnopqrstuvwxyz';
            let key = '';

            for (let i = 0; i < 36; i++) {
                let rand = ~~(Math.random() * alphabet.length * 2);
                let char = alphabet[rand % alphabet.length];

                if (rand >= alphabet.length) char = char.toUpperCase();
                key += char;
            }

            return key;
        }

        function *fakeValidKey() {
            while (true) {
                let keys = [];

                for (let i = 0; i < 10; i++) {
                    keys.push(fakeKey());
                    yield keys[i];
                }

                let i = 0;

                while (i < keys.length * 150) {
                    yield keys[i % keys.length];
                    i++;
                }
            }
        }

        const validGen = fakeValidKey();

        function debug() {
            const fakeTelem = new Telemetry();

            for (let i = 0; i < 20; i++) {
                if (i >= 10) fakeTelem.dataStrings.set(~~(Math.random() * 255) + '', fakeKey() + ' : ' + fakeKey());
                else fakeTelem.dataStrings.set(~~(Math.random() * 255) + '', validGen.next().value + ' : ' + (Math.random() * 100).toFixed(4));
            }

            processTelemetry(fakeTelem);
        }

        setInterval(debug, 200);
    });

    function processTelemetry(telemetry: Telemetry) {        
        let data: { [key: string]: number; } = {};
        let time = Date.now();

        for (let [key, value] of telemetry.dataStrings) {
            if (key.startsWith('$') && key.endsWith('$')) continue;

            let match = Array.from(value.matchAll(TELEMETRY_NUMBER_LINE_REGEX))?.[0];
            if (!match) continue;

            data[match[1]] = parseFloat(match[2]);
        }

        for (let [key, value] of telemetry.dataNumbers) {
            data[key] = value;
        }

        for (let i = 0; i < datasets.length; i++) {
            let set = datasets[i];

            if (set.key in data) {
                set.data.unshift({
                    time,
                    value: data[set.key],
                });

                delete data[set.key];
            }

            for (let j = 0; j < set.data.length; j++) {
                let point = set.data[j];

                if ((pausedTime ?? time) - point.time > HISTORY_TIME) {
                    set.data.splice(j, 1);
                    j--;
                    continue;
                }
            }

            if (!set.data.length) {
                datasets.splice(i, 1);
                i--;
            }
        }

        for (let key in data) {
            datasets.push({
                key,
                enabled: false,
                color: DEFAULT_SET_COLORS[datasets.length % DEFAULT_SET_COLORS.length],
                data: [{ time, value: data[key] }]
            });
        }

        for (let i = 0; i < tooltip.points.length; i++) {
            let point = tooltip.points[i];
            let set = datasets[point.set];

            if (!set || !set.data[point.index]) {
                tooltip.points.splice(i, 1);
                i--;
                continue;
            }
        }
    }

    function updateScale(graphWidth: number, horizontalLines: number) {
        let max = null;
        let min = null;
        
        for (let i = 0; i < datasets.length; i++) {
            let set = datasets[i];

            if (!set.enabled) continue;

            for (let j = 0; j < set.data.length; j++) {
                let { value, time } = set.data[j];
                let x = ((pausedTime ?? Date.now()) - time) / scale.time * square.width;

                if (x < 0 || x > graphWidth) continue;

                if (max === null || value > max) max = value;
                if (min === null || value < min) min = value;
            }

        }

        let range = max - min;

        min -= range * 0.05;
        max += range * 0.05;

        scale.min = min;
        scale.step = range * 1.1 / horizontalLines;
    }

    function resize() {
        const size = graph.getBoundingClientRect();

        graph.width = size.width;
        graph.height = size.height;
    }

    function draw() {
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, graph.width, graph.height);
        ctx.fillStyle = 'black';

        let outerBounds = {
            x: padding.left,
            y: padding.top,
            width: graph.width - padding.left - padding.right,
            height: graph.height - padding.top - padding.bottom,
        };

        let innerBounds = {
            x: outerBounds.x + marker.horizontal,
            y: outerBounds.y,
            width: outerBounds.width - marker.horizontal,
            height: outerBounds.height - marker.vertical,
        };

        let horizontalLines = innerBounds.height / square.height;
        let verticalLines = innerBounds.width / square.width;

        updateScale(innerBounds.width, horizontalLines);

        for (let i = 0; i < horizontalLines; i++) {
            let y = innerBounds.y + innerBounds.height - lineWidth - square.height * i;

            lineStyle(i);
            ctx.fillRect(
                innerBounds.x, y,
                innerBounds.width,
                lineWidth
            );

            markerStyle(i);
            ctx.fillRect(
                outerBounds.x, y,
                marker.horizontal,
                lineWidth
            );

            label(outerBounds.x, y, i);
        }

        for (let i = 0; i < verticalLines; i++) {
            let x = innerBounds.x + square.width * i;

            lineStyle(i, true);
            ctx.fillRect(
                x, innerBounds.y,
                lineWidth,
                innerBounds.height
            );

            markerStyle(i, true);
            ctx.fillRect(
                x, outerBounds.y + outerBounds.height,
                lineWidth,
                -marker.vertical
            );

            label(x, outerBounds.y + outerBounds.height, i, true);
        }

        for (let i = 0; i < datasets.length; i++) {
            let set = datasets[i];
            let last: { x: number; y: number; };

            if (!set.enabled) continue;

            for (let j = 0; j < set.data.length; j++) {
                if (!j) ctx.beginPath();

                let point = set.data[j % set.data.length];
                last = plot(point, last, innerBounds);

                if (j == set.data.length - 1) {
                    ctx.strokeStyle = set.color;
                    ctx.lineCap = 'round';
                    ctx.lineWidth = ctx.globalAlpha = 1;
                    ctx.stroke();
                }
            }
        }

        if (tooltip.show) {
            updateTooltipPoints(innerBounds);

            if (tooltip.points.length) {
                drawTooltipLines(innerBounds);

                for (let i = 0; i < tooltip.points.length; i++) {
                    let point = tooltip.points[i];
                    let data = datasets[point.set].data[point.index];

                    plotPoint(data, innerBounds, datasets[point.set].color);
                }
            }
        }
    }

    function updateTooltipPoints(innerBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        let points = [];
        let progress = (innerBounds.x + innerBounds.width - tooltip.x) / innerBounds.width;

        if (
            0 > progress || progress > 1 ||
            innerBounds.y > tooltip.y || tooltip.y > innerBounds.y + innerBounds.height
        ) {
            tooltip.points = points;
            return;
        }

        let time = (pausedTime ?? Date.now()) - (progress * innerBounds.width) / square.width * scale.time;

        for (let i = 0; i < datasets.length; i++) {
            let set = datasets[i];
            if (!set.enabled) continue;

            let lowerIndex = -1;
            let upperIndex = -1;

            let lower = null;
            let upper = null;

            for (let j = 0; j < set.data.length; j++) {
                let point = set.data[j];

                if (point.time < time && (lower == null || point.time > lower.time)) {
                    lower = point;
                    lowerIndex = j;
                }

                if (point.time > time && (upper == null || point.time < upper.time)) {
                    upper = point;
                    upperIndex = j;
                }
            }
    
            if (!lower || !upper) continue;

            points.push({
                set: i,
                index: time - lower.time < upper.time - time ? lowerIndex : upperIndex,
            });
        }

        tooltip.time = new Date(time).toLocaleTimeString('en-US', { hour12: false });
        tooltip.points = points;
    }

    function drawTooltipLines(innerBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        ctx.globalAlpha = 1;

        ctx.fillRect(tooltip.x, innerBounds.y, lineWidth, innerBounds.height);
        ctx.fillRect(innerBounds.x, tooltip.y, innerBounds.width, lineWidth);
    }

    function plotPoint(point: {
        time: number;
        value: number;
    }, innerBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, color: string) {
        let elapsed = ((pausedTime ?? Date.now()) - point.time) / scale.time;

        let x = innerBounds.x + innerBounds.width - elapsed * square.width;
        let y = innerBounds.y + innerBounds.height - (point.value - scale.min) / scale.step * square.height;

        let oob = 
            innerBounds.x > x || x > innerBounds.x + innerBounds.width ||
            innerBounds.y > y || y > innerBounds.y + innerBounds.height
        ;

        if (oob) return;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.closePath();        

        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.stroke();
    }

    function plot(point: {
        time: number;
        value: number;
    }, last: {
        x: number;
        y: number;
    }, innerBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        let elapsed = ((pausedTime ?? Date.now()) - point.time) / scale.time;

        let x = innerBounds.x + innerBounds.width - elapsed * square.width;
        let y = innerBounds.y + innerBounds.height - (point.value - scale.min) / scale.step * square.height;

        let oob = 
            innerBounds.x > x || x > innerBounds.x + innerBounds.width ||
            innerBounds.y > y || y > innerBounds.y + innerBounds.height
        ;

        let lastOOB = last && (
            innerBounds.x > last.x || last.x > innerBounds.x + innerBounds.width ||
            innerBounds.y > last.y || last.y > innerBounds.y + innerBounds.height
        );

        if (
            oob && last && !lastOOB ||
            !oob && last && lastOOB
        ) {
            let dx = x - last.x;
            let dy = y - last.y;

            let tx1 = (innerBounds.x - last.x) / dx;
            let ty1 = (innerBounds.y - last.y) / dy;
            let tx2 = (innerBounds.x + innerBounds.width - last.x) / dx;
            let ty2 = (innerBounds.y + innerBounds.height - last.y) / dy;

            let tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2));
            let tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));

            let ix = last.x + (oob ? tmax : tmin) * dx;
            let iy = last.y + (oob ? tmax : tmin) * dy;

            if (oob) {
                ctx.lineTo(ix, iy);
            } else {
                ctx.moveTo(ix, iy);
                ctx.lineTo(x, y);
            }

            return { x, y };
        } else if (oob && !last || lastOOB) {
            return { x, y };
        }

        ctx.lineTo(x, y);
        return { x, y };
    }

    function label(x: number, y: number, i: number, isX = false) {
        if (isX && !marker.vertical) return;
        if (!isX && !marker.horizontal) return;
        if (i % 2 != 0) return;
        
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Poppins';

        let n = i * scale.step + scale.min;

        ctx.fillText(n % 1 == 0 ? n + '' : n.toFixed(2), x - 5, y + (isX ? 0 : 1));
    }

    function lineStyle(i: number, isVertical = false) {
        ctx.globalAlpha = !i ? 1 : i % 10 == 0 ? 0.5 : 0.3;
    }

    function markerStyle(i: number, isVertical = false) {
        ctx.globalAlpha = i % 2 == 0 ? 1 : 0.3;
    }

    function exportDatasets() {
        if (!hasData()) return;

        let rows = [['timestamp']];
        let timestamped = {};
        let timestamps = [];

        for (let i = 0; i < datasets.length; i++) {
            let set = datasets[i];
            rows[0].push(set.key);

            for (let j = 0; j < set.data.length; j++) {
                let point = set.data[j];
                
                if (!(point.time in timestamped)) {
                    timestamped[point.time] = {};
                    timestamps.push(point.time);
                }
                
                timestamped[point.time][i] = point.value;
            }
        }

        timestamps.sort((a, b) => a - b);

        for (let i = 0; i < timestamps.length; i++) {
            let time = timestamps[i];
            let data = timestamped[time];

            let row = [time];

            for (let j = 0; j < datasets.length; j++) {
                if (!(j in data)) row.push('');
                else row.push(data[j]);
            }

            rows.push(row);
        }

        let csv = '';

        for (let i = 0; i < rows.length; i++) {
            csv += rows[i].join(',') + '\n';
        }

        csv = csv.trim();

        let a = document.createElement('a');
        a.download = 'telemetry.csv';
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        
        a.click();
        a.remove();
    }

    function hasData() {
        if (!datasets.length) return false;

        for (let i = 0; i < datasets.length; i++) {
            if (datasets[i].data.length) return true;
        }

        return false;
    }

    function mousemove(event: MouseEvent) {
        let size = tooltip.element.getBoundingClientRect();

        tooltip.show = true;
        tooltip.x = event.offsetX;
        tooltip.y = event.offsetY;

        tooltip.alignRight = tooltip.x + size.width > graph.width;
        tooltip.alignTop = tooltip.y - size.height < 0;
    }
</script>

<svelte:window onmessage={(event) => processTelemetry(event.data)} />

<div class="holder">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="close" onclick={() => window.close()}></div>

    <h1>Graphing</h1>

    <span>Select keys to graph below.</span>

    <div class="keys">
        {#each datasets as set}
            <div class="key">
                <input type="checkbox" bind:checked={set.enabled}>
                <input type="color" bind:value={set.color}>
                <span>{set.key}</span>
            </div>
        {/each}
    </div>

    <div class="controls-holder">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <svg class="pause" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" onclick={() => (pausedTime = pausedTime ? null : Date.now())}>
            {#if pausedTime != null}
                <path d="M320-200v-560l440 280-440 280Z"/>
            {:else}
                <path d="M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z"/>
            {/if}
        </svg>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <svg class="export {hasData() ? '' : 'disabled'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" onclick={exportDatasets}>
            <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
        </svg>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <svg class="clear {hasData() ? '' : 'disabled'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" onclick={() => {
            for (let i = 0; i < datasets.length; i++) datasets[i].data = [];
            tooltip.points = [];
        }}>
            <path d="M690-240h190v80H610l80-80Zm-500 80-85-85q-23-23-23.5-57t22.5-58l440-456q23-24 56.5-24t56.5 23l199 199q23 23 23 57t-23 57L520-160H190Z"/>
        </svg>
    </div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="graph-holder" onmousemove={mousemove} onmouseleave={() => (tooltip.show = false)}>
        <div
            class="tooltip {tooltip.show && tooltip.points.length ? 'show' : ''} {tooltip.alignRight ? 'align-right' : ''} {tooltip.alignTop ? 'align-top' : ''}"
            bind:this={tooltip.element} style="left: {tooltip.x}px; top: {tooltip.y}px"
        >
            <span class="time">{tooltip.time}</span>

            {#each tooltip.points as point}
                {@const { key, color } = datasets[point.set]}
                {@const { value } = datasets[point.set].data[point.index]}

                <div class="point">
                    <div class="color" style="--color: {color}"></div>
                    <span class="name">
                        {key} : {value % 1 == 0 ? value : value.toFixed(2)}
                    </span>
                </div>
            {/each}
        </div>
        <canvas class="graph" bind:this={graph}></canvas>
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

    .controls-holder {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        gap: 10px;
        margin-bottom: 10px;
    }

    .controls-holder svg {
        background: var(--primary);
        padding: 6px;
        border-radius: 4px;

        width: 20px;
        height: 20px;

        fill: #fff;
    }

    .controls-holder .clear {
        background: var(--red);
    }

    .controls-holder .disabled {
        opacity: .5;
        cursor: not-allowed;
    }

    .graph-holder {
        position: relative;

        flex: 1;
        overflow: hidden;
    }

    .graph {
        width: 100%;
        height: 100%;
    }

    .tooltip {
        position: absolute;
        pointer-events: none;
        transform: translateY(calc(-100% - 10px));

        display: flex;
        flex-direction: column;
        padding: 10px;
        
        margin: 5px;
        box-sizing: border-box;

        background: #f6f6f6;
        visibility: hidden;
    }

    .tooltip.show {
        visibility: visible;
    }

    .tooltip.align-top {
        transform: none;
    }

    .tooltip.align-right {
        transform: translate(calc(-100% - 10px), calc(-100% - 10px));
    }

    .tooltip.align-top.align-right {
        transform: translateX(calc(-100% - 10px));
    }

    .point {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .point .color {
        background: var(--color);
        width: 10px;
        height: 10px;
        border-radius: 2px;
    }

    .point .name {
        display: flex;
        align-items: center;

        width: max-content;
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

    .keys {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        overflow: auto;
        max-height: 200px;
        gap: 10px;
        margin: 10px 0;
    }

    .key {
        display: flex;
        align-items: center;
    }

    .key > span {
        margin-left: 5px;
    }

    .key input[type=checkbox] {
        width: 14px;
        height: 14px;
        border-radius: 5px;
    }

    .key input[type=color] {
        appearance: none;
        padding: 0;
        border-radius: 2px;
        width: 14px;
        height: 14px;
    }

    .key input[type=color]::-webkit-color-swatch-wrapper {
        padding: 0;
    }

    .key input[type=color]::-webkit-color-swatch {
        border: none;
    }
</style>