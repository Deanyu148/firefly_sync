import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
	},
	resolve: {
		alias: {
			obsidian: new URL("./tests/obsidian-mock.ts", import.meta.url).pathname,
		},
	},
});
