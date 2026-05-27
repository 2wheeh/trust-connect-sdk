export { useSignDirect } from './hooks/useSignDirect'
export { useSignAmino } from './hooks/useSignAmino'
export { useGetAccount } from './hooks/useGetAccount'

export type {
	UseSignDirectParams,
	UseSignDirectResult,
	UseSignDirectOptions,
	UseSignAminoParams,
	UseSignAminoResult,
	UseSignAminoOptions,
	UseGetAccountParams,
	UseGetAccountResult,
	UseGetAccountOptions,
} from './types'

export {
	createCosmos,
	XPLA_MAINNET,
	FETCHHUB_MAINNET,
	XPLA_TESTNET,
	FETCHHUB_TESTNET,
	COSMOS_SCOPE,
	type CreateCosmosOptions,
	type ChainInfo,
	type CosmosAddress,
	type CosmosChainId,
	type CosmosProvider,
	type CosmosSignDoc,
	type CosmosStdSignDoc,
	type CosmosAccount,
} from '@trustwallet/connect-cosmos-core'
