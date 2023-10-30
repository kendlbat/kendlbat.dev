import { z, defineCollection } from "astro:content";

const blogCollection = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        language: z.string(),
        date: z.date(),
        layout: z.string(),
    }),
});

export const collections = {
    blog: blogCollection,
};
