<script lang="ts">
    let { options = [], label = '', selected = $bindable('' as any) } = $props();

    $effect(() => {
        selected = Number(selected) || selected;
    });
</script>

<div class="holder">
    <span class="label">{label}</span>

    <div class="selector-holder">
        <div class="selector">
            <select bind:value={selected}>
                {#each options as option}
                    {#if option.hr}
                        <hr>
                    {:else}
                        <option disabled={option.disabled} value="{option.value}">{option.name}</option>
                    {/if}
                {/each}
            </select>

            <div class="arrow"></div>

            <span class="title">{options.find(o => o.value == selected)?.name || ''}</span>
        </div>
    </div>
</div>

<style>
    .holder {
        display: flex;        
        flex-direction: column;
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
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;

        max-width: 200px;
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

    .label {
        font-size: 14px;
    }
</style>