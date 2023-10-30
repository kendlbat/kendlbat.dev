<script lang="ts">
    import { Button, Tooltip } from "flowbite-svelte";
    import MastodonIcon from "../../../assets/icons/mastodon.svg";
</script>

<!-- Mastodon -->
<Button class="p-0" href="https://mastodon.social/@kendlbat" color="none">
    <img src={MastodonIcon.src} class="h-[4.2rem]" alt="Mastodon" />
</Button>
<Tooltip>Mastodon</Tooltip>
