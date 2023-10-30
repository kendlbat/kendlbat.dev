<script lang="ts">
    import {
        DarkMode,
        NavBrand,
        NavHamburger,
        NavUl,
        Navbar,
        NavLi,
    } from "flowbite-svelte";
    import { SunSolid, MoonSolid } from "flowbite-svelte-icons";

    export let activeUrl: string;
</script>

<Navbar class="bg-slate-200">
    <NavBrand href="/">
        <span
            class="self-center whitespace-nowrap pl-3 text-xl font-semibold dark:text-white sm:pl-0">
            Tobias Kendlbacher</span>
    </NavBrand>
    <div class="flex items-center md:order-2">
        <DarkMode />
        <NavHamburger />
    </div>
    <NavUl {activeUrl}>
        <NavLi href="/">Home</NavLi>
        <NavLi href="/blog/">Blog</NavLi>
    </NavUl>
</Navbar>
