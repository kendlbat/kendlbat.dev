<script lang="ts">
    import { onDestroy, onMount } from "svelte";

    interface Track {
        track_name: string;
        artist_name: string;
        release_name?: string;
        image_url?: string;
        image_srcset?: string;
    }

    let track: Track | null = null;

    const searchCache = new Map<string, string | undefined>();

    const COVERART_BASE = "https://coverartarchive.org/release/";

    function coverArtUrl(mbid: string, size: "250" | "500"): string {
        return `${COVERART_BASE}${mbid}/front-${size}`;
    }

    async function searchReleaseOnMusicBrainz(
        artist: string,
        track: string,
    ): Promise<string | undefined> {
        const key = `${artist}::${track}`;
        if (searchCache.has(key)) {
            return searchCache.get(key);
        }
        try {
            const query = `artist:"${encodeURIComponent(
                artist,
            )}" AND recording:"${encodeURIComponent(track)}"`;
            const res = await fetch(
                `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&inc=releases&limit=1`,
                {
                    headers: {
                        Accept: "application/json",
                        "User-Agent":
                            "kendlbat.dev/1.0.0 (https://kendlbat.dev)",
                    },
                },
            );
            if (!res.ok) {
                searchCache.set(key, undefined);
                return undefined;
            }
            const data = await res.json();
            const release = data?.recordings?.[0]?.releases?.[0]?.id;
            if (typeof release === "string") {
                searchCache.set(key, release);
                return release;
            }
            searchCache.set(key, undefined);
            return undefined;
        } catch {
            searchCache.set(key, undefined);
            return undefined;
        }
    }

    async function getImageUrl(
        meta: Record<string, unknown> | undefined,
        additional_info: Record<string, unknown> | undefined,
    ): Promise<{ src: string; srcset?: string } | undefined> {
        if (additional_info?.cover_art_url) {
            return { src: additional_info.cover_art_url as string };
        }

        const originUrl = additional_info?.origin_url;
        if (typeof originUrl === "string") {
            const match = originUrl.match(
                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            );
            if (match) {
                return {
                    src: `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`,
                };
            }
        }

        const releaseMbid =
            typeof meta?.release_mbid === "string"
                ? meta.release_mbid
                : typeof additional_info?.release_mbid === "string"
                ? additional_info.release_mbid
                : typeof additional_info?.release_group_mbid === "string"
                ? additional_info.release_group_mbid
                : undefined;
        if (releaseMbid) {
            return {
                src: coverArtUrl(releaseMbid, "250"),
                srcset: `${coverArtUrl(releaseMbid, "250")} 250w, ${coverArtUrl(
                    releaseMbid,
                    "500",
                )} 500w`,
            };
        }

        const artistName = meta?.artist_name;
        const trackName = meta?.track_name;
        if (typeof artistName === "string" && typeof trackName === "string") {
            const searchRelease = await searchReleaseOnMusicBrainz(
                artistName,
                trackName,
            );
            if (searchRelease) {
                return {
                    src: coverArtUrl(searchRelease, "250"),
                    srcset: `${coverArtUrl(
                        searchRelease,
                        "250",
                    )} 250w, ${coverArtUrl(searchRelease, "500")} 500w`,
                };
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
                        Accept: "application/json",
                    },
                },
            );
            const data = await res.json();
            const listens = data?.payload?.listens;
            if (listens && listens.length > 0) {
                const meta = listens[0].track_metadata;
                const img = await getImageUrl(meta, meta.additional_info);
                track = {
                    track_name: meta.track_name,
                    artist_name: meta.artist_name,
                    release_name: meta.release_name,
                    image_url: img?.src,
                    image_srcset: img?.srcset,
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
        intervalId = setInterval(fetchNowPlaying, 10000);
    });

    onDestroy(() => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    });
</script>

{#if track}
    <a
        href="https://listenbrainz.org/user/kendlbat/"
        class="mb-2 block max-w-md break-inside-avoid flex-col divide-gray-200 rounded-lg border border-gray-200 bg-white text-gray-500 shadow-md transition-all duration-300 hover:scale-[1.05] hover:bg-gray-100 dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700">
        <div
            class="relative w-full overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-700">
            <div class="aspect-square">
                {#if track.image_url}
                    <img
                        src={track.image_url}
                        srcset={track.image_srcset}
                        sizes="(max-width: 448px) 100vw, 448px"
                        alt="{track.track_name} cover art"
                        class="h-full w-full object-cover"
                        loading="lazy"
                        on:error={(e) => {
                            if (e?.target instanceof HTMLImageElement) {
                                e.target.style.display = "none";
                            }
                        }} />
                {:else}
                    <div class="flex h-full w-full items-center justify-center">
                        <svg
                            class="h-12 w-12 text-gray-400"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                        </svg>
                    </div>
                {/if}
            </div>
        </div>

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
    </a>
{/if}
