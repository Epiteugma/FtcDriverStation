<script lang="ts">
    let { width = 20, height = 20, on = $bindable(true), style = '' } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg {width} {height} {style} class:on onclick={() => (on = !on)} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    {#if on}
        <path d="M14 12C14 14.7614 11.7614 17 9 17H7C4.23858 17 2 14.7614 2 12C2 9.23858 4.23858 7 7 7H7.5M10 12C10 9.23858 12.2386 7 15 7H17C19.7614 7 22 9.23858 22 12C22 14.7614 19.7614 17 17 17H16.5" stroke-width="4" stroke-linecap="round"/>
    {:else}
        <path d="M7 7C4.23858 7 2 9.23858 2 12C2 14.7614 4.23858 17 7 17H9C11.1636 17 13.0062 15.6258 13.7026 13.7026M17 17H16.5M10 12C10 11.4021 10.1049 10.8288 10.2974 10.2974M21 21L13.7026 13.7026M3 3L10.2974 10.2974M10.2974 10.2974L13.7026 13.7026M13.0464 7.39604C13.6466 7.14106 14.3068 7 15 7H17C19.7614 7 22 9.23858 22 12C22 13.2151 21.5665 14.329 20.8458 15.1954" stroke-width="4" stroke-linecap="round"/>
    {/if}
</svg>

<style>
    svg path {
        transition: stroke .2s;
        stroke: #000;
    }

    svg:hover path {
        stroke: var(--green);
    }

    svg.on:hover path {
        stroke: var(--red);
    }
</style>