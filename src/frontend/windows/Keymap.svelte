<script lang="ts">
    import { cachedKeymap, normalizeKey } from '../../util/keymap';

    function onKeyEvent(event: KeyboardEvent) {
        window.postMessage({
            type: event.type,
            key: event.key,
        }, '*');
    }

    function remapKey(mapping: string, key: string) {
        cachedKeymap[mapping] = normalizeKey(key);
        localStorage.keymap_config = cachedKeymap;

        window.postMessage({ type: 'reloadKeymap' }, '*');
    }
</script>

<svelte:window onkeydown={onKeyEvent} onkeyup={onKeyEvent} />

<div class="holder">
    <h1>Keyboard Mappings</h1>
</div>

<style>
    .holder {
        display: flex;
        flex: 1;
        flex-direction: column;
        padding: 15px;

        overflow: auto;
    }

    h1 {
        -webkit-app-region: drag;
        width: calc(100% - 20px);

        margin: 0;
        margin-bottom: 15px;
    }
</style>
