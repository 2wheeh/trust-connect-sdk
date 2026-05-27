import './types/augmentation'

export { createCosmos } from './namespace'
export { CosmosKeplrLikeWallet } from './wallet'
export { XplaVaultWallet } from './xpla-vault'
export { CosmosInjectedRegistry } from './registry'
export { COSMOS_SCOPE, COSMOS_ICON } from './constants'
export { XPLA_MAINNET, FETCHHUB_MAINNET, XPLA_TESTNET, FETCHHUB_TESTNET } from './chains'

export type { ChainInfo, KeplrLikeProvider } from './types/keplr'
export type { CreateCosmosOptions } from './types/config'
export type {
	XplaVaultConnector,
	XplaWalletExtensionInfo,
	VaultStates,
	VaultSignPayload,
	VaultTxResult,
} from './types/xpla-vault'

export type {
	CosmosAddress,
	CosmosChainId,
	CosmosProvider,
	CosmosRequestArguments,
	CosmosRequestParams,
	CosmosResponse,
	CosmosSignDoc,
	CosmosSignDirectParams,
	CosmosSignDirectResponse,
	CosmosStdSignDoc,
	CosmosSignAminoParams,
	CosmosSignAminoResponse,
	CosmosAccount,
	CosmosGetAccountsParams,
	CosmosGetAccountsResponse,
} from '@trustwallet/connect-cosmos-types'
