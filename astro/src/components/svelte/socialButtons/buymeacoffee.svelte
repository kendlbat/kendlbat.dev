<script lang="ts">
    import { Button } from "flowbite-svelte";
    import BmcIcon from "@assets/icons/bmc-logo.svg";
    import WideBmcIcon from "@assets/icons/buymeacoffee.png";

    export let full: boolean = false;
</script>

<!-- Buy me a coffee -->

{#if full}
    <Button
        class="h-[calc(100%+1px)] p-0"
        href="https://www.buymeacoffee.com/kendlbat"
        color="none">
        <img src={WideBmcIcon.src} class="h-full" alt="Buy me a coffee" />
    </Button>
{:else}
    <div class="aspect-square h-full">
        <Button
            class="aspect-square h-full border border-gray-600 bg-[#FFF] p-0 dark:border-none"
            href="https://www.buymeacoffee.com/kendlbat"
            color="none">
            <img
                src={BmcIcon.src}
                class="aspect-square h-2/3 w-2/3"
                alt="Buy me a coffee" />
        </Button>
    </div>
{/if}
