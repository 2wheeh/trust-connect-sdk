import type { CosmosProvider, CosmosChainId, CosmosAddress } from '@trustwallet/connect-cosmos-types'

declare module '@trustwallet/connect-core' {
	interface NamespaceSpecs {
		cosmos: {
			provider: CosmosProvider
			address: CosmosAddress
			chain: CosmosChainId
		}
	}
}
