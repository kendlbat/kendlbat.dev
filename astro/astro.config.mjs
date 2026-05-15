import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import robotsTxt from "astro-robots-txt";
import { defineConfig, passthroughImageService } from "astro/config";

import rehypePrettyCode from "rehype-pretty-code";

// https://astro.build/config
export default defineConfig({
    site: "https://kendlbat.dev",
    // Disable Astro's default Sharp-based image processing by using a passthrough/no-op service.
    // This prevents Astro from attempting to load `sharp` during the build.
    image: {
        service: passthroughImageService(),
    },
    markdown: {
        remarkPlugins: ["remark-math"],
        rehypePlugins: [
            ["rehype-katex", { strict: false }],
            [rehypePrettyCode, {}],
        ],
    },
    integrations: [tailwind(), svelte(), robotsTxt(), sitemap()],
});
