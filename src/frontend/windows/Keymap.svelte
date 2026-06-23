<script lang="ts">
    import { cachedKeymap, normalizeKey } from '../../util/keymap';
    import Keybind from '../Keybind.svelte';

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

    <div class="mapping-holder">
        <Keybind center={[119, 97]} offset={[-26, 0]} mapping="leftStickXMinus" />
        <Keybind center={[119, 97]} offset={[26, 0]} mapping="leftStickXPlus" />
        <Keybind center={[119, 97]} offset={[0, -26]} mapping="leftStickYMinus" />
        <Keybind center={[119, 97]} offset={[0, 26]} mapping="leftStickYPlus" />

        <Keybind center={[298, 168]} offset={[-26, 0]} mapping="rightStickXMinus" />
        <Keybind center={[298, 168]} offset={[26, 0]} mapping="rightStickXPlus" />
        <Keybind center={[298, 168]} offset={[0, -26]} mapping="rightStickYMinus" />
        <Keybind center={[298, 168]} offset={[0, 26]} mapping="rightStickYPlus" />

        <Keybind center={[359, 97]} offset={[-31, 0]} mapping="x" />
        <Keybind center={[359, 97]} offset={[31, 0]} mapping="b" />
        <Keybind center={[359, 97]} offset={[0, -31]} mapping="y" />
        <Keybind center={[359, 97]} offset={[0, 31]} mapping="a" />

        <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 549.31 367.99" width="100%"> <defs> <clipPath id="a"> <path d="m0 294.39h439.45v-294.39h-439.45v294.39z"/> </clipPath> </defs> <g transform="matrix(1.25 0 0 -1.25 0 367.99)"> <g clip-path="url(#a)"> <g transform="translate(291.61 74.1)"> <path d="m0 0c12.566-4e-3 24.723-4.474 34.3-12.61 0.226-0.192 0.443-0.396 0.649-0.61l49.151-51.259c0.15-0.151 0.299-0.301 0.46-0.451 15.29-14 39.54-11.75 51.669 5.11 30.55 42.46-4.5 145.09-43.609 235.94-0.845 1.916-2.417 3.417-4.37 4.17l-2.521 1c-2.458 0.96-4.272 3.089-4.83 5.67-1.569 7.229-6.358 13.343-13 16.6-40.389 19.86-65.7 21.27-79.109 8.13-1.479-1.499-3.485-2.36-5.591-2.4h-110.17c-2.127 0.035-4.154 0.908-5.64 2.43-13.4 13.14-38.71 11.73-79.1-8.13-6.642-3.257-11.431-9.371-13-16.6-0.542-2.585-2.345-4.726-4.8-5.7l-2.52-1c-1.963-0.765-3.537-2.285-4.37-4.22-39.1-90.78-74.15-193.43-43.6-235.89 12.13-16.89 36.39-19.09 51.669-5.11 0.161 0.14 0.31 0.29 0.461 0.451l49.15 51.259c0.206 0.214 0.423 0.418 0.65 0.61 9.576 8.136 21.733 12.606 34.299 12.61h143.77z" fill="#1f1f21"/> </g> <g transform="translate(278.88 161.81)"> <path d="m0 0c13.481 0 24.41-10.929 24.41-24.41 0-13.482-10.929-24.41-24.41-24.41s-24.41 10.928-24.41 24.41c0 13.481 10.929 24.41 24.41 24.41" fill="#383838"/> </g> <g transform="translate(278.88 112.99)"> <path d="m0 0c-13.481 0-24.41 10.929-24.41 24.41 0 13.482 10.929 24.41 24.41 24.41s24.41-10.928 24.41-24.41v-0.01c-6e-3 -13.477-10.932-24.4-24.41-24.4m0 51.92c-15.193 0-27.51-12.316-27.51-27.51 0-15.193 12.317-27.51 27.51-27.51 15.189 0 27.505 12.311 27.51 27.5 6e-3 15.194-12.307 27.515-27.5 27.52h-0.01z" fill="#191919"/> </g> <g transform="translate(166.26 170.55)"> <path d="m0 0c19.452 0 35.22-15.769 35.22-35.22 0-19.452-15.768-35.22-35.22-35.22-19.451 0-35.22 15.768-35.22 35.22 0 19.451 15.769 35.22 35.22 35.22" fill="#383838"/> </g> <g transform="translate(166.26 100.11)"> <path d="m0 0c-19.451 0-35.22 15.769-35.22 35.221 0 19.451 15.769 35.219 35.22 35.219 19.452 0 35.22-15.768 35.22-35.219 0-19.452-15.768-35.221-35.22-35.221m0 74.521c-21.705 0-39.3-17.596-39.3-39.3 0-21.705 17.595-39.301 39.3-39.301s39.3 17.596 39.3 39.301c0 21.704-17.595 39.3-39.3 39.3" fill="#191919"/> </g> <g transform="translate(188.51 145.71)"> <path d="m0 0h-11.88v11.87c0 3.314-2.686 6-6 6h-8.79c-3.313 0-6-2.686-6-6v-11.87h-11.84c-3.313 0-6-2.687-6-6v-8.79c0-3.314 2.687-6 6-6h11.87v-11.87c0-3.314 2.686-6 6-6h8.79c3.314 0 6 2.686 6 6v11.899h11.87c3.314 0 6 2.687 6 6v8.79c-0.016 3.311-2.71 5.982-6.02 5.971" fill="#898989"/> </g> <g transform="translate(189.68 213.72)"> <path d="m0 0c5.225 0 9.46-4.235 9.46-9.46s-4.235-9.46-9.46-9.46-9.46 4.235-9.46 9.46 4.235 9.46 9.46 9.46" fill="#383838"/> </g> <g transform="translate(219.72 273.37)"> <path d="m0 0c11.151 0 20.19-9.04 20.19-20.19 0-11.151-9.039-20.19-20.19-20.19s-20.19 9.039-20.19 20.19c0 11.15 9.039 20.19 20.19 20.19" fill="#fff"/> </g> <g transform="translate(254.48 213.72)"> <path d="m0 0c5.225 0 9.46-4.235 9.46-9.46s-4.235-9.46-9.46-9.46-9.461 4.235-9.461 9.46 4.236 9.46 9.461 9.46" fill="#383838"/> </g> <g transform="translate(111.34 230.94)"> <path d="m0 0c14.735 0 26.68-11.945 26.68-26.68s-11.945-26.68-26.68-26.68-26.68 11.945-26.68 26.68 11.945 26.68 26.68 26.68" fill="#191919"/> </g> <g transform="translate(111.34 228.31)"> <path d="m0 0c13.283 0 24.05-10.768 24.05-24.05 0-13.283-10.767-24.05-24.05-24.05-13.282 0-24.05 10.767-24.05 24.05 0 13.282 10.768 24.05 24.05 24.05" fill="#383838"/> </g> <g transform="translate(306.39 219)"> <path d="m0 0c8.141 0 14.74-6.599 14.74-14.74 0-8.14-6.599-14.74-14.74-14.74s-14.739 6.6-14.739 14.74c0 8.141 6.598 14.74 14.739 14.74" fill="#16b7ef"/> </g> <g transform="translate(335.87 189.37)"> <path d="m0 0c8.141 0 14.74-6.599 14.74-14.74s-6.599-14.74-14.74-14.74-14.74 6.599-14.74 14.74 6.599 14.74 14.74 14.74" fill="#00e530"/> </g> <g transform="translate(335.87 248.63)"> <path d="m0 0c8.141 0 14.74-6.6 14.74-14.74 0-8.141-6.599-14.74-14.74-14.74s-14.74 6.599-14.74 14.74c0 8.14 6.599 14.74 14.74 14.74" fill="#ffef22"/> </g> <g transform="translate(365.35 219)"> <path d="m0 0c8.141 0 14.74-6.599 14.74-14.74 0-8.14-6.599-14.74-14.74-14.74s-14.739 6.6-14.739 14.74c0 8.141 6.598 14.74 14.739 14.74" fill="#ea3b3b"/> </g> </g> </g> </svg>
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

    h1 {
        -webkit-app-region: drag;
        width: calc(100% - 20px);

        margin: 0;
        margin-bottom: 15px;
    }

    .mapping-holder {
        position: relative;
        width: 100%;
        margin-top: auto;
        display: flex;
    }

    svg {
        -webkit-app-region: drag;
    }
</style>
