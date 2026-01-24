<script lang="ts">
    let stackTrace = new URLSearchParams(window.location.search).get('stackTrace');
</script>

<div class="holder">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="close" onclick={() => window.close()}></div>

    <h1>Uncaught exception</h1>
    <div class="stacktrace-holder">
        <pre>{stackTrace}</pre>
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

    .stacktrace-holder {
        position: relative;
        display: flex;
        flex: 1;

        border-radius: 10px;
        overflow: hidden;

        box-shadow: 0 0 6px #0005;
    
        font-size: 14px;
    }

    pre {
        flex: 1;

        padding: 10px;
        margin: 0;

        overflow: auto;
    }

    pre {
        user-select: text;
    }

    pre::selection {
        background: #aaa;
        color: #fff;
    }

    pre::-webkit-scrollbar {
        width: 1px;
        height: 1px;
        appearance: none;
    }

    pre::-webkit-scrollbar-thumb {
        box-shadow: inset 0 0 1px #000;
        backdrop-filter: blur(5px);
    }

    .close {
        position: absolute;
        width: 12px;
        height: 12px;

        top: 15px;
        right: 20px;

        transform: rotate(45deg);

        margin-left: auto;
    }

    .close::before, .close::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        background: #000;
        transition: background .2s;
        border-radius: 2px;
    }

    .close:hover::before, .close:hover::after {
        background: var(--red);
    }

    .close::before {
        width: 4px;
        height: 100%;
    }

    .close::after {
        width: 100%;
        height: 4px;
    }
</style>