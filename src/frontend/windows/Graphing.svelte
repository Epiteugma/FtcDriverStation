<script lang="ts">
    import { onMount } from 'svelte';
    import { TELEMETRY_NUMBER_REGEX } from '../../util/robocol.svelte';

    let padding = {
        left: 40,
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
        min: 0,
        step: 1,
    };

    let lineWidth = 1;
    let points = $state([]);
    let pointsB = $state([]);

    let tooltip = $state({
        point: 'hi',

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
            points.unshift({
                time: Date.now(),
                value: Math.sin(Date.now() % 30000 / 30000 * Math.PI * 2) * 12.5 + 12.5
            });

            pointsB.unshift({
                time: Date.now(),
                value: Math.sin(Date.now() % 30000 / 30000 * Math.PI * 2 - Math.PI) * 12.5 + 12.5
            });
        }, 200);
    });

    function processTelemetry(telemetry: any) {

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

        let pointSets = [
            { color: 'blue', points },
            { color: 'red', points: pointsB },
        ];

        for (let i = 0; i < pointSets.length; i++) {
            let set = pointSets[i];

            for (let j = 0; j < set.points.length; j++) {
                if (!j) ctx.beginPath();

                let point = set.points[j % points.length];
                plot(point, innerBounds, Math.floor(j / set.points.length), set.color);

                if (j == set.points.length - 1) {
                    ctx.strokeStyle = set.color;
                    ctx.lineCap = 'round';
                    ctx.lineWidth = ctx.globalAlpha = 1;
                    ctx.stroke();

                    ctx.strokeStyle = 'black';
                }
            }
        }

        if (tooltip.show && tooltip.point) drawTooltipLines(innerBounds);
    }

    function drawTooltipLines(innerBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        ctx.globalAlpha = 1;

        console.log(graph.height);

        ctx.fillRect(tooltip.x, innerBounds.y, lineWidth, innerBounds.height);
        ctx.fillRect(innerBounds.x, tooltip.y, innerBounds.width, lineWidth);
    }

    function plot(point: {
        time: number;
        value: number;
    }, innerBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, iteration: number, color: string) {
        let elapsed = (Date.now() - point.time) / 1000;

        let x = innerBounds.x + innerBounds.width - elapsed * square.width;
        let y = innerBounds.y + innerBounds.height - (point.value - scale.min) / scale.step * square.height;

        // TODO: handle points that are out of bounds (clamping)
        if (
            innerBounds.x > x || x > innerBounds.x + innerBounds.width ||
            innerBounds.y > y || y > innerBounds.y + innerBounds.height
        ) return;

        if (!iteration) {
            ctx.lineTo(x, y);
            return;
        }

        // Draw individual points if on second iteration

        ctx.fillStyle = ctx.strokeStyle = color;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.closePath();

        ctx.globalAlpha = 1;
        ctx.stroke();

        ctx.globalAlpha = 0.5;
        ctx.fill();

        ctx.fillStyle = ctx.strokeStyle = 'black';
    }

    function label(x: number, y: number, i: number, isX = false) {
        if (isX && !marker.vertical) return;
        if (!isX && !marker.horizontal) return;
        if (i % 2 != 0) return;
        
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '14px Poppins';

        ctx.fillText(i * scale.step + scale.min + '', x - 5, y + (isX ? 0 : 1));
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
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="graph-holder" onmousemove={mousemove} onmouseleave={() => (tooltip.show = false)}>
        <div
            class="tooltip {tooltip.show && tooltip.point ? 'show' : ''} {tooltip.alignRight ? 'align-right' : ''} {tooltip.alignTop ? 'align-top' : ''}"
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
        margin-bottom: 15px;
        padding-left: 5px;
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
</style>