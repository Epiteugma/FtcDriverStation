<script lang="ts">
    let { voltage = $bindable(0) } = $props();
</script>

<div class="battery-holder">
    <div class="battery">
        <div class="battery-inner">
            <div class="battery-bar" style="--progress: {~~(voltage/15 * 100)}%"></div>
        </div>
    </div>
    {voltage.toFixed(2)}V
</div>

<style>
    .battery-holder {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .battery {
        position: relative;
        width: 20px;
        height: 8px;
        border-radius: 4px;
        border: 2px solid black;
    }

    .battery-inner {
        position: absolute;
        width: calc(100% - 2px);
        height: calc(100% - 2px);

        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    .battery-bar {
        width: var(--progress, 0%);
        height: 100%;
        border-radius: 2px;
        transition: width .2s;
        background: black;
    }
</style>