import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import robotsTxt from "astro-robots-txt";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";

import rehypePrettyCode from "rehype-pretty-code";

// https://astro.build/config
export default defineConfig({
  site: "https://kendlbat.dev",
  markdown: {
    remarkPlugins: [
      "remark-math",
    ],
    rehypePlugins: [
      ["rehype-katex", { strict: false }],
      [rehypePrettyCode, {}]
    ]
  },
  integrations: [tailwind(), svelte(), robotsTxt(), sitemap()]
});