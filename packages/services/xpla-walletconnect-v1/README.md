# @trustwallet/connect-xpla-walletconnect-v1

WalletConnect v1 service for **XPLA Vault Mobile**, plugging into TrustConnect SDK's cosmos namespace.

Strictly additive: zero edits to existing SDK packages. The modal keeps its WC v2 button untouched — this service ships its own `<XplaWalletConnectButton />` React component the dApp drops outside the modal.

## Install

```sh
pnpm add @trustwallet/connect-xpla-walletconnect-v1 cosmjs-types
```

> `cosmjs-types` is an optional peer dependency — required only when calling `cosmos_signDirect` (which is the default path for XPLA Vault Mobile).

## Wire into the provider

```tsx
import { createXplaWalletConnect } from '@trustwallet/connect-xpla-walletconnect-v1'

const xplaWcV1 = createXplaWalletConnect({
  clientMeta: { name: 'My dApp' },
})

<TrustConnectProvider config={{ namespaces: [cosmos], services: [walletConnect, xplaWcV1] }}>
  …
</TrustConnectProvider>
```

## Render the button (outside the modal)

```tsx
import { XplaWalletConnectButton } from '@trustwallet/connect-xpla-walletconnect-v1/react'

<XplaWalletConnectButton
  renderQr={(uri) => <YourQrCode value={uri} />}
/>
```

## Vite / browser bundler note

`@walletconnect/client@1.x` predates ESM and assumes a Node runtime (`global`, `Buffer`, `process`, `events`, `stream`, …). The cleanest fix for Vite is `vite-plugin-node-polyfills`:

```sh
pnpm add -D vite-plugin-node-polyfills
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process', 'events', 'stream', 'util'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
})
```

Without these polyfills you'll see runtime errors like `Uncaught ReferenceError: global is not defined` or `Buffer is not defined`. Other bundlers (Next.js, webpack, Parcel) need equivalent polyfill plugins.

## Supported methods

| Method | Notes |
|---|---|
| `cosmos_signDirect` | Decodes `bodyBytes` (via `cosmjs-types`), translates to amino-shaped `msgs + fee`, forwards over WC v1 with `signMode: 1`. Only `/cosmos.bank.v1beta1.MsgSend` is currently mapped — other typeUrls throw. |
| `cosmos_getAccounts` | Returns the cached session account. `pubkey` is empty `Uint8Array` (Vault doesn't expose it via the legacy protocol). |
| `cosmos_signAmino` | **Unsupported** — XPLA Vault Mobile is direct-only here. Throws `UnsupportedMethodError`. |

## Chains

| WC numeric chainId | CAIP-2 reference |
|---|---|
| `1` | `cosmos:dimension_37-1` (XPLA mainnet) |
| `0` | `cosmos:cube_47-5` (XPLA testnet) |

Other chain ids surface a `ConnectionFailedError` with the unknown id in the message.

## License

Apache-2.0
