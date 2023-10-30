<script lang="ts">
    import { Button, Tooltip } from "flowbite-svelte";
    import { GithubSolid, LinkedinSolid } from "flowbite-svelte-icons";

    export let outerClass: string = "";
</script>

<div class={outerClass}>
    <div class="flex flex-row gap-3">
        <!-- GitHub -->
        <Button
            class="bg-[#171515]"
            href="https://github.com/kendlbat"
            color="none">
            <GithubSolid class="h-12 w-12 text-white" />
        </Button>
        <Tooltip>GitHub</Tooltip>

        <!-- LinkedIn -->
        <Button
            class="bg-[#0077b5]"
            href="https://www.linkedin.com/in/kendlbat"
            color="none">
            <LinkedinSolid class="h-12 w-12 text-white" />
        </Button>
        <Tooltip>LinkedIn</Tooltip>

        <!-- Buy me a coffee -->
        <Button
            class="p-0"
            href="https://www.buymeacoffee.com/kendlbat"
            color="none">
            <img
                src="/assets/icons/buymeacoffee.png"
                class="h-[4.2rem]"
                alt="Buy me a coffee" />
        </Button>
        <Tooltip>Buy me a coffee</Tooltip>

        <!-- Instagram -->
        <Button
            class="p-0"
            href="https://www.instagram.com/kendlbat"
            color="none">
            <img
                src="/assets/icons/instagram.png"
                class="h-[4.2rem]"
                alt="Instagram" />
        </Button>
        <Tooltip>Instagram</Tooltip>

        <!-- Mastodon -->
        <Button
            class="p-0"
            href="https://mastodon.social/@kendlbat"
            color="none">
            <img
                src="/assets/icons/mastodon.svg"
                class="h-[4.2rem]"
                alt="Mastodon" />
        </Button>
        <Tooltip>Mastodon</Tooltip>
    </div>
</div>
