<script lang="ts">
    import { Button, Tooltip } from "flowbite-svelte";
    import { GithubSolid } from "flowbite-svelte-icons";

    import InstagramIcon from "@assets/icons/instagram.png";
</script>

<!-- Instagram -->
<Button class="p-0" href="https://www.instagram.com/kendlbat" color="none">
    <img src={InstagramIcon.src} class="h-[4.2rem]" alt="Instagram" />
</Button>
<Tooltip>Instagram</Tooltip>
