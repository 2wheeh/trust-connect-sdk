import { RegistryBase, RpcUrls } from '@trustwallet/connect-core'
import type { ChainInfo } from './keplr'

export type CreateCosmosOptions = {
	/** Pre-baked Keplr-style `ChainInfo` objects (e.g. `XPLA_MAINNET`, `FETCHHUB_MAINNET`). */
	chains: ChainInfo[]
	/** Optional REST/RPC overrides per CAIP-2 chain id. */
	rpcUrls?: RpcUrls
	/** Extra registries (currently unused; reserved for WalletConnect later). */
	registries?: RegistryBase[]
}
