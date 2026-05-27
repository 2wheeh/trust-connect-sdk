import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // @walletconnect/client@1.x predates ESM and assumes a Node runtime
    // (Buffer, process, events, stream, …). Polyfill those for the browser bundle.
    nodePolyfills({
      include: ['buffer', 'process', 'events', 'stream', 'util'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
})
