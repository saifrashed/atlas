// Build config used for the Docker image: emits a standalone Node server
// instead of the default Cloudflare Worker output.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node",
    output: { dir: "dist-node" },
  },
});
