<script lang="ts">
    export let value: number;
    export let className: string = "";
    export let color: string = "#999";
</script>

<span class={`relative inline-block aspect-[55/100] h-[100%] ${className}`}>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 110 200"
        class="h-full w-full"
        fill="none">
        {#if (0x3ed >> value) & 1}
            <!-- top dash -->
            <path
                d="M 10 10 l 10 -10 h 70 l 10 10 l -10 10 h -70 z"
                fill={color}></path>
        {/if}
        {#if (0x39f >> value) & 1}
            <!-- top right pillar -->
            <path
                d="M 100 10 l 10 10 v 70 l -10 10 l -10 -10 v -70 z"
                fill={color}></path>
        {/if}
        {#if (0x3fb >> value) & 1}
            <!-- bottom right pillar -->
            <path
                d="M 100 100 l 10 10 v 70 l -10 10 l -10 -10 v -70 z"
                fill={color}></path>
        {/if}
        {#if (0x36d >> value) & 1}
            <!-- bottom dash -->
            <path
                d="M 10 190 l 10 -10 h 70 l 10 10 l -10 10 h -70 z"
                fill={color}></path>
        {/if}
        {#if (0x145 >> value) & 1}
            <!-- bottom left pillar -->
            <path
                d="M 10 100 l 10 10 v 70 l -10 10 l -10 -10 v -70 z"
                fill={color}></path>
        {/if}
        {#if (0x371 >> value) & 1}
            <!-- top left pillar -->
            <path
                d="M 10 10 l 10 10 v 70 l -10 10 l -10 -10 v -70 z"
                fill={color}></path>
        {/if}
        {#if (0x37c >> value) & 1}
            <!-- middle dash -->
            <path
                d="M 10 100 l 10 -10 h 70 l 10 10 l -10 10 h -70 z"
                fill={color}></path>
        {/if}
    </svg>
</span>
