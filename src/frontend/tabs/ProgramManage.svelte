<script lang="ts">
    import { connection } from "../../util/robocol.svelte";

    let iframe: HTMLIFrameElement = $state(null);

    let lastRemote = $state(null);
    let errored = $state(false);
    let loaded = $state(false);

    $effect(() => {
        if (!loaded && connection.remote && (lastRemote != connection.remote || errored)) {
            iframe.src = 'http://' + connection.remote + ':8080';
        }

        lastRemote = connection.remote;
    });
</script>

{#if errored}
    <span>Disconnected</span>
{/if}

<iframe
    bind:this={iframe}
    onerror={() => (loaded = false, errored = true)}
    onload={() => (loaded = true, errored = false)}
    title="Program and manage"
    src="https://example.com"
    frameborder="0"
    style="visibility: {!!connection.remote && !errored ? 'visible' : 'hidden'}"
></iframe>

<style>
    span {
        padding: 15px;
    }

    iframe {
        width: 100%;
        height: 100%;
    }
</style>