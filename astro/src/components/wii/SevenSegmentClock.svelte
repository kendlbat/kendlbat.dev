<script lang="ts">
    import SevenSegmentNumber from "./SevenSegmentNumber.svelte";

    let time =
        new Date().getHours().toString().padStart(2, "0") +
        new Date().getMinutes().toString().padStart(2, "0");
    let date =
        new Date().toLocaleString("en-UK", {
            weekday: "short",
        }) +
        ", " +
        new Date().getDate() +
        "." +
        (new Date().getMonth() + 1) +
        ".";
    let colon: SVGTextElement;

    setInterval(() => {
        if (!colon) return;
        console.log(colon.textContent);
        if (colon.textContent == ":") colon.textContent = " ";
        else colon.textContent = ":";
        time =
            new Date().getHours().toString().padStart(2, "0") +
            new Date().getMinutes().toString().padStart(2, "0");
    }, 1000);
</script>

<div class="absolute left-1/2 top-0 h-[100%] -translate-x-1/2 text-nowrap">
    <SevenSegmentNumber value={parseInt(time.charAt(0))} />
    <SevenSegmentNumber value={parseInt(time.charAt(1))} />
    <span class={`relative -mx-[0.1em] inline-block aspect-[40/100] h-[100%]`}>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 80 200"
            class="h-full w-full"
            fill="#999">
            <text x="15" y="185" bind:this={colon} font-size="250px">:</text
            ></svg
        ></span>
    <SevenSegmentNumber value={parseInt(time.charAt(2))} />
    <SevenSegmentNumber value={parseInt(time.charAt(3))} />
</div>
<div
    class="absolute left-1/2 top-[140%] h-[100%] -translate-x-1/2 text-nowrap text-[50px] font-semibold text-[#777]">
    {date}
</div>
