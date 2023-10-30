<script lang="ts">
    import { Button, Tooltip } from "flowbite-svelte";
    import SocialGithub from "./socialButtons/github.svelte";
    import SocialLinkedin from "./socialButtons/linkedin.svelte";
    import SocialBuymeacoffee from "./socialButtons/buymeacoffee.svelte";
    import SocialInstagram from "./socialButtons/instagram.svelte";
    import SocialMastodon from "./socialButtons/mastodon.svelte";

    export let outerClass: string = "h-16";
</script>

<div class={outerClass}>
    <div class="flex h-full flex-row flex-wrap gap-2">
        <SocialGithub />

        <SocialLinkedin />

        <SocialBuymeacoffee />

        <SocialInstagram />

        <SocialMastodon />
    </div>
</div>
