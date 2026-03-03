<script lang="ts">
    let { opModes = [], disabled = false, selected = $bindable('') } = $props();

    let sortedOpModes = $derived(opModes ? Array.from(opModes).sort(sortOpModes) : null);
    let teleOpModes: any[] = $derived(sortedOpModes ? sortedOpModes.filter((o: any) => o.flavor === 'TELEOP') : null);

    function sortOpModes(a: any, b: any) {
        return a.group.localeCompare(b.group) || a.name.localeCompare(b.name);
    }
</script>

<button class="preselect" {disabled} aria-label="pre-select TeleOp">
    <select bind:value={selected} {disabled}>
        {#if !opModes.length}
            <option disabled>No OpModes found</option>
        {:else}
            <option value="">None</option>
            <hr>

            {#each teleOpModes as opMode}
                <option value={opMode.name}>{opMode.name}</option>
            {/each}
        {/if}
    </select>

    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
        <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"></path>
    </svg>
</button>

<style>
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

    .preselect {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        width: min-content;
    }

    .preselect svg {
        fill: #fff;

        height: 18px;
        padding: 2px 0;
    }

    .preselect select {
        appearance: none;
        opacity: 0;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
</style>