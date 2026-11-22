<script lang="ts">
    import { cameraPreview, cameraPreviewState as preview } from '../util/robocol.svelte';
    import { onDestroy } from 'svelte';

    // leaving the tab (or the window) must never leave the gamepads blocked
    onDestroy(() => cameraPreview.close());

    const STATUS_LABELS = {
        unavailable: 'Unavailable',
        idle: 'Idle',
        requesting: 'Requesting',
        receiving: 'Receiving',
        ready: 'Ready',
        error: 'Error',
    };

    let busy = $derived(preview.status === 'requesting' || preview.status === 'receiving');

    function formatBytes(bytes: number) {
        return bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB';
    }
</script>

<div class="preview">
    <div class="header">
        <h2>Camera Preview</h2>
        <span class="status {preview.status}">{STATUS_LABELS[preview.status]}</span>
    </div>

    <div class="notice">
        Not a live stream: click the image or Refresh for a new frame. Gamepads and Run are disabled while the preview is open.
    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="frame" class:clickable={!busy} onclick={() => cameraPreview.request()} title={busy ? '' : 'Click to refresh'}>
        {#if preview.imageUrl}
            <img src={preview.imageUrl} alt="Robot Controller camera frame" class:stale={busy || preview.status === 'error'} />
        {/if}

        {#if preview.status !== 'ready'}
            <div class="overlay" class:error={preview.status === 'error'}>
                {#if preview.status === 'receiving' && preview.totalBytes}
                    {preview.message} {formatBytes(preview.receivedBytes)} / {formatBytes(preview.totalBytes)}
                {:else}
                    {preview.message}
                {/if}
            </div>
        {/if}
    </div>

    <div class="footer">
        <button disabled={busy} onclick={() => cameraPreview.request()}>Refresh</button>
        <button class="close-preview" onclick={() => cameraPreview.close()}>Close</button>

        {#if preview.imageUrl}
            <span class="info">
                {preview.width}×{preview.height} · {formatBytes(preview.byteLength)} · frame {preview.frameNum} · {new Date(preview.receivedAt).toLocaleTimeString()}
            </span>
        {/if}
    </div>
</div>

<style>
    .preview {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        gap: 6px;
    }

    .header {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    h2 {
        margin: 0;
        font-size: 20px;
    }

    .status {
        padding: 1px 8px;
        border-radius: 5px;
        font-size: 12px;
        color: #fff;
        background: #888;
    }

    .status.requesting, .status.receiving {
        background: var(--orange);
    }

    .status.ready {
        background: var(--green);
    }

    .status.error {
        background: var(--red);
    }

    .notice {
        font-size: 12px;
        color: #555;
    }

    .frame {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;

        /* scale with the window, leaving room for the telemetry below */
        height: clamp(140px, calc(100vh - 540px), 340px);
        flex-shrink: 0;
        border-radius: 10px;
        overflow: hidden;
        background: #111;
        box-shadow: 0 0 6px #0005;
    }

    .frame.clickable {
        cursor: pointer;
    }

    img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    img.stale {
        opacity: 0.4;
    }

    .overlay {
        position: absolute;
        padding: 0 20px;
        text-align: center;
        color: #fff;
    }

    .overlay.error {
        color: #ff8080;
    }

    .footer {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    button {
        width: 75px;
        height: 22px;
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

    .close-preview {
        background: #888;
    }

    .info {
        margin-left: auto;
        font-size: 12px;
        color: #555;
    }
</style>
