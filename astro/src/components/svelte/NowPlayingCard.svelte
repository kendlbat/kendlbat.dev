<script lang="ts">
    import { onDestroy, onMount } from "svelte";

    interface Track {
        track_name: string;
        artist_name: string;
        release_name?: string;
        image_url?: string;
    }

    let track: Track | null = null;

    function getImageUrl(
        additional_info: Record<string, unknown> | undefined,
    ): string | undefined {
        if (additional_info?.cover_art_url) {
            return additional_info.cover_art_url;
        }
        const originUrl = additional_info?.origin_url;
        if (typeof originUrl === "string") {
            const match = originUrl.match(
                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            );
            if (match) {
                return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
            }
        }
        return undefined;
    }

    async function fetchNowPlaying() {
        try {
            const res = await fetch(
                "https://api.listenbrainz.org/1/user/kendlbat/playing-now",
                {
                    credentials: "omit",
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0",
                        Accept: "*/*",
                    },
                },
            );
            const data = await res.json();
            const listens = data?.payload?.listens;
            if (listens && listens.length > 0) {
                const meta = listens[0].track_metadata;
                track = {
                    track_name: meta.track_name,
                    artist_name: meta.artist_name,
                    release_name: meta.release_name,
                    image_url: getImageUrl(meta.additional_info),
                };
            } else {
                track = null;
            }
        } catch {
            track = null;
        }
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    onMount(() => {
        fetchNowPlaying();
        intervalId = setInterval(fetchNowPlaying, 30000);
    });

    onDestroy(() => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });
</script>

{#if track}
    <div
        class="mb-2 flex max-w-md break-inside-avoid flex-col divide-gray-200 rounded-lg border border-gray-200 bg-white text-gray-500 shadow-md dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        {#if track.image_url}
            <img
                src={track.image_url}
                alt="{track.track_name} cover art"
                class="w-full rounded-t-lg"
                loading="lazy"
                onerror={(e) => {
                    e.target.style.display = "none";
                }} />
        {/if}

        <div class="p-4 sm:p-6">
            <div class="mb-2 flex items-center gap-2">
                <span
                    class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-green-500">
                    <span class="relative flex h-2 w-2">
                        <span
                            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
                        ></span>
                        <span
                            class="relative inline-flex h-2 w-2 rounded-full bg-green-500"
                        ></span>
                    </span>
                    Now Playing
                </span>
            </div>

            <p
                class="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Currently listening to
            </p>

            <h4
                class="mb-1 text-lg font-bold leading-tight text-gray-900 dark:text-white">
                {track.track_name}
            </h4>

            <p class="text-sm text-gray-600 dark:text-gray-400">
                {track.artist_name}
            </p>

            {#if track.release_name}
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                    {track.release_name}
                </p>
            {/if}
        </div>
    </div>
{/if}
