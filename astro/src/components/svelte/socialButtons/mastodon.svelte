<script lang="ts">
    import { Button, Tooltip } from "flowbite-svelte";
    import MastodonIcon from "@assets/icons/mastodon.svg";
</script>

<!-- Mastodon -->
<div class="aspect-square h-full">
    <Button
        class="h-full p-0"
        href="https://mastodon.social/@kendlbat"
        color="none">
        <img src={MastodonIcon.src} class="h-full w-full" alt="Mastodon" />
    </Button>
</div>
