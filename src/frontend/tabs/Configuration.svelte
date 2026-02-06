<script lang="ts">
    import { robot } from '../../util/robocol.svelte';

    let editing = $state(null);
</script>

{#if editing}
    TODO
{:else}
    <button>New</button>

    {#each robot.configurations as config}
        {config.name}

        <button>Activate</button>
        <button>Edit</button>
        <button>Delete</button>
    {/each}
{/if}