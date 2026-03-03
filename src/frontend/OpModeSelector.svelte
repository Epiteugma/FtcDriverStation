<script lang="ts">
    let { opModes = [], selected = $bindable('') } = $props();

    let sortedOpModes = $derived(opModes ? Array.from(opModes).sort(sortOpModes) : null);

    let autoOpModes: any[] = $derived(sortedOpModes ? sortedOpModes.filter((o: any) => o.flavor === 'AUTONOMOUS') : null);
    let teleOpModes: any[] = $derived(sortedOpModes ? sortedOpModes.filter((o: any) => o.flavor === 'TELEOP') : null);

    function sortOpModes(a: any, b: any) {
        return a.group.localeCompare(b.group) || a.name.localeCompare(b.name);
    }
</script>

<div class="holder">
    <div class="selector-holder">
        <div class="selector">
            <select bind:value={selected}>
                {#if !autoOpModes.length}
                    <option disabled>No OpModes found</option>
                {:else}
                    {#each autoOpModes as opMode}
                        <option value={opMode.name}>{opMode.name}</option>
                    {/each}
                {/if}
            </select>

            <div class="arrow l"></div>

            <span class="title">Autonomous</span>
        </div>

        <div class="sep"></div>

        <div class="selector">
            <select bind:value={selected}>
                {#if !teleOpModes.length}
                    <option disabled>No OpModes found</option>
                {:else}
                    {#each teleOpModes as opMode}
                        <option value={opMode.name}>{opMode.name}</option>
                    {/each}
                {/if}
            </select>

            <span class="title">TeleOp</span>

            <div class="arrow r"></div>
        </div>
    </div>

    {#if selected}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="x-holder" onclick={(() => (selected = ''))}>
            <div class="x"></div>
        </div>
    {/if}

    <div class="selected">{selected || 'No OpMode selected'}</div>
</div>

<style>
    .holder {
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .selector-holder {
        display: flex;
        box-shadow: 0 1px 2px #777;
        width: fit-content;
        border-radius: 5px;
    }

    .selector {
        display: flex;
        position: relative;
        align-items: center;
    }

    .title {
        padding: 0 5px;
    }

    .arrow {
        pointer-events: none;
        
        width: 25px;
        height: 25px;
        position: relative;
    }

    .arrow::before {
        content: '';
        position: absolute;

        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        width: 20px;
        height: 20px;
 
        border-radius: 5px;
        background: var(--primary);
    }

    .arrow::after {
        content: '';
        position: absolute;

        width: 4px;
        height: 4px;

        top: 50%;
        left: 50%;

        border-left: 2px solid #fff;
        border-top: 2px solid #fff;

        transform: translate(-50%, -50%) rotate(-135deg) translate(1px, 1px);
    }

    select {
        position: absolute;
        appearance: none;
        opacity: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .sep {
        width: 1px;
        margin: 0 5px;

        background: linear-gradient(#0000 0%, #0000 10%, #ccc 30%, #ccc 70%, #0000 90%, #0000 100%);
    }

    .x-holder {
        position: relative;

        width: 20px;
        height: 20px;

        border-radius: 5px;
        background: var(--red);

        margin-right: -10px;
    }

    .x {
        position: absolute;

        width: 8px;
        height: 8px;

        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(45deg);
    }

    .x::before, .x::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        background: #fff;
        transition: background .2s;
        border-radius: 2px;
    }

    .x::before {
        width: 2px;
        height: 100%;
    }

    .x::after {
        width: 100%;
        height: 2px;
    }
</style>