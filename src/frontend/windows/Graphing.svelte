<script lang="ts">
    import { onMount } from 'svelte';
    import { TELEMETRY_NUMBER_REGEX } from '../../util/robocol.svelte';

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
    };

    let history = $state([
        { key: 'sin t', enabled: true, color: '#ff0000', data: [] },
        { key: 'cos t', enabled: true, color: '#0000ff', data: [] },
        { key: 'tan t', enabled: true, color: '#00ff00', data: [] },
    ]);

    let lineWidth = 1;

    let tooltip = $state({
        points: [],
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
        window.addEventListener('message', (event) => processTelemetry(event.data));
        window.addEventListener('resize', resize);
        window.addEventListener('load', resize);

        ctx = graph.getContext('2d')!;

        draw();

        setInterval(() => {
            history[0].data.unshift({
                time: Date.now(),
                value: Math.sin(Date.now() % 10000 / 10000 * 2 * Math.PI)
            });

            history[1].data.unshift({
                time: Date.now(),
                value: Math.cos(Date.now() % 10000 / 10000 * 2 * Math.PI)
            });

            history[2].data.unshift({
                time: Date.now(),
                value: Math.tan(Date.now() % 10000 / 10000 * 2 * Math.PI)
            });
        }, 50);
    });

    function processTelemetry(telemetry: any) {

    }

    function updateScale(horizontalLines: number) {
        let max = null;
        let min = null;
        
        for (let i = 0; i < history.length; i++) {
            let set = history[i];

            if (!set.enabled) continue;

            for (let j = 0; j < set.data.length; j++) {
                let { value } = set.data[j];

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

        updateScale(horizontalLines);

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

        for (let i = 0; i < history.length; i++) {
            let set = history[i];
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

                    ctx.strokeStyle = 'black';
                }
            }
        }

        if (tooltip.show) {
            updateTooltipPoints(innerBounds);            
            if (tooltip.points.length) drawTooltipLines(innerBounds);
        }
    }

    function updateTooltipPoints(innerBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        
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
        let elapsed = (Date.now() - point.time) / 1000;

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

    function mousemove(event: MouseEvent) {
        let size = tooltip.element.getBoundingClientRect();

        tooltip.show = true;
        tooltip.x = event.offsetX;
        tooltip.y = event.offsetY;

        tooltip.alignRight = tooltip.x + size.width > graph.width;
        tooltip.alignTop = tooltip.y - size.height < 0;
    }
</script>

<div class="holder">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="close" onclick={() => window.close()}></div>

    <h1>Graphing</h1>

    <span>Select keys to graph below.</span>

    <div class="keys">
        {#each history as set}
            <div class="key">
                <input type="checkbox" bind:checked={set.enabled}>
                <input type="color" bind:value={set.color}>
                <span>{set.key}</span>
            </div>
        {/each}
    </div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="graph-holder" onmousemove={mousemove} onmouseleave={() => (tooltip.show = false)}>
        <div
            class="tooltip {tooltip.show && tooltip.points.length ? 'show' : ''} {tooltip.alignRight ? 'align-right' : ''} {tooltip.alignTop ? 'align-top' : ''}"
            bind:this={tooltip.element} style="left: {tooltip.x}px; top: {tooltip.y}px"
        >
            Tooltip
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
        transform: translateY(-100%);
        padding: 10px;

        visibility: hidden;
    }

    .tooltip.show {
        visibility: visible;
    }

    .tooltip.align-top {
        transform: none;
    }

    .tooltip.align-right {
        transform: translate(-100%, -100%);
    }

    .tooltip.align-top.align-right {
        transform: translateX(-100%);
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
        border-radius: 50%;
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