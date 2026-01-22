<script lang="ts">
    let { tab = $bindable(0) } = $props();
</script>

<div class="nav">
    <button class={tab == 0 && 'active'} onclick={() => (tab = 0)}>Robot control</button>
    <button class={tab == 1 && 'active'} onclick={() => (tab = 1)}>Configuration</button>
    <button class={tab == 2 && 'active'} onclick={() => (tab = 2)}>Program & manage</button>

    <span>
        by Team #13906 <br>
        Epiteugma Revved Up
    </span>
</div>

<style>
    :global(body) {
        backdrop-filter: blur(20px);
    }

    .nav {
        -webkit-app-region: drag;
        user-select: none;

        overflow: hidden;
        position: relative;
        z-index: 1;

        display: flex;
        flex-direction: column;

        width: 240px;
        padding: 10px 0;

        border-right: 2px solid #aaaa;
        box-shadow: inset 1px;
    }

    .nav::before {
        content: '';
        position: absolute;
        width: 200%;
        height: 200%;
        z-index: -1;

        background-image: linear-gradient(#fffa, #fffa), url(../../assets/gradient.jpg);
        background-position: center;

        filter: blur(20px);
    }

    button {
        -webkit-app-region: no-drag;
        font-size: 16px;

        background: none;
        outline: none;
        border: none;
        padding: 10px;
        margin: 5px 20px;
        border-radius: 5px;
        transition: background .2s;
    }
    
    span {
        font-size: 12px;
        margin-top: auto;
        margin-bottom: 5px;
        margin-left: 15px;
    }

    button.active {
        background: #0001;
    }
</style>