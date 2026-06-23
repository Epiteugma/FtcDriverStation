<script lang="ts">
    import { cachedKeymap, getKey, normalizeKey } from '../util/keymap';

    let { mapping, center = [0, 0], offset = [0, 0] } = $props();

    function remapKey(key: string) {
        cachedKeymap[mapping] = normalizeKey(key);
        localStorage.keymap_config = cachedKeymap;

        window.postMessage({ type: 'reloadKeymap' }, '*');
    }
</script>

<span style="left: {center[0]}px; top: {center[1]}px; translate: {offset[0]}px {offset[1]}px">{getKey(mapping)}</span>

<style>
    span {
        position: absolute;
        transform: translate(-50%, -50%);
        text-align: center;

        background: white;
        border-radius: 5px;
        padding: 0 5px;
        border: 1px solid;
    }
</style>
