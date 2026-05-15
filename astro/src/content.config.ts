import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "zod";

const blogCollection = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
    schema: z.object({
        title: z.string(),
        language: z.string(),
        date: z.date(),
        layout: z.string(),
        image: z.string().optional(),
    }),
});

export const collections = {
    blog: blogCollection,
};
