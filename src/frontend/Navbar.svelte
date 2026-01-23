<script lang="ts">
    let { tab = $bindable(0) } = $props();
</script>

<div class="nav">
    <button class={tab == 0 && 'active'} onclick={() => (tab = 0)}>
        <svg style="background: #6030fe" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
            <path d="M320-200v-560l440 280-440 280Z"/>
        </svg>

        Robot Control
    </button>

    <button class={tab == 1 && 'active'} onclick={() => (tab = 1)}>
        <svg style="background: #027afe" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960">
            <path d="m234-480-12-60q-12-5-22.5-10.5T178-564l-58 18-40-68 46-40q-2-13-2-26t2-26l-46-40 40-68 58 18q11-8 21.5-13.5T222-820l12-60h80l12 60q12 5 22.5 10.5T370-796l58-18 40 68-46 40q2 13 2 26t-2 26l46 40-40 68-58-18q-11 8-21.5 13.5T326-540l-12 60h-80Zm40-120q33 0 56.5-23.5T354-680q0-33-23.5-56.5T274-760q-33 0-56.5 23.5T194-680q0 33 23.5 56.5T274-600ZM592-40l-18-84q-17-6-31.5-14.5T514-158l-80 26-56-96 64-56q-2-18-2-36t2-36l-64-56 56-96 80 26q14-11 28.5-19.5T574-516l18-84h112l18 84q17 6 31.5 14.5T782-482l80-26 56 96-64 56q2 18 2 36t-2 36l64 56-56 96-80-26q-14 11-28.5 19.5T722-124l-18 84H592Zm56-160q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Z"/>
        </svg>

        Configuration
    </button>

    <button class={tab == 2 && 'active'} onclick={() => (tab = 2)}>
        <svg style="background: #34aa8f" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
            <path d="M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z"/>
        </svg>
        
        Program & Manage
    </button>

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

    .nav::after {
        content: '';
        position: absolute;
        right: 0;
        top: 0;

        width: 3px;
        height: 100%;

        background: linear-gradient(to right, #0000, #aaaa);
    }

    button {
        -webkit-app-region: no-drag;
        font-size: 14px;

        background: none;
        outline: none;
        border: none;
        padding: 5px;
        margin: 2px 15px;
        border-radius: 5px;
        transition: background .2s;

        display: flex;
        text-align: left;
        align-items: center;
        gap: 15px;
    }
    
    span {
        font-size: 12px;
        margin-top: auto;
        margin-bottom: 5px;
        margin-left: 15px;
    }

    button.active {
        background: #00000015;
    }

    svg {
        border-radius: 5px;
        width: 24px;
        height: 24px;
        padding: 5px;
        fill: #fff;
    }
</style>