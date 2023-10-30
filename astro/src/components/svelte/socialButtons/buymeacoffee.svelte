<script lang="ts">
    import { Button, Tooltip } from "flowbite-svelte";
    import BmcIcon from "../../../assets/icons/bmc-logo.svg";

    export let full: boolean = false;
</script>

<!-- Buy me a coffee -->
{#if full}
    <Button
        class="h-16 p-0"
        href="https://www.buymeacoffee.com/kendlbat"
        color="none">
        <img
            src="../../../../assets/icons/bmc-logo.svg"
            class="h-full"
            alt="Buy me a coffee" />
    </Button>
{:else}
    <Button
        class="h-16 w-16 bg-[#FFF]"
        href="https://www.buymeacoffee.com/kendlbat"
        color="none">
        <img src={BmcIcon.src} class="h-16 w-16" alt="Buy me a coffee" />
    </Button>
{/if}
<Tooltip>Buy me a coffee</Tooltip>
