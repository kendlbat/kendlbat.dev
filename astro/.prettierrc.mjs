/** @type {import("prettier").Config} */
export default {
    plugins: [
        "prettier-plugin-astro",
        "prettier-plugin-svelte",
        "prettier-plugin-tailwindcss",
    ],
    overrides: [
        {
            files: "*.astro",
            options: {
                parser: "astro",
            },
        },
    ],
    tabWidth: 4,
    semi: true,
    bracketSameLine: true,
    htmlWhitespaceSensitivity: "css",
};
