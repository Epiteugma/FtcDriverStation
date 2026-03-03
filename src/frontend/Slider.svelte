<script lang="ts">
    let { value = $bindable(false) } = $props();
</script>

<label class="slider">
    <input type="checkbox" bind:checked={value}>
    <div class="thumb"></div>
</label>

<style>
    .slider {
        display: inline-block;
        position: relative;
        height: 22px;
        width: 40px;
        border-radius: 22px;
        background: #e0e0e0;
        box-shadow: inset 0 0 2px #ccc;
    }

    .thumb {
        position: absolute;

        top: 50%;
        left: 1px;

        transform: translateY(-50%);

        width: 20px;
        height: 20px;

        border-radius: 50%;
        box-shadow: 0 0 2px #222;
        background: #fff;

        transition: .2s left;
    }

    label:has(input:checked) {
        background: #027afe;
        box-shadow: none;
    }

    input:checked + .thumb {
        left: calc(100% - 20px - 1px);
    }

    input {
        display: none;
    }
</style>