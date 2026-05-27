import {
	MissingChainError,
	NamespaceConstructor,
	NamespaceEngine,
	Scope,
} from '@trustwallet/connect-core'
import { COSMOS_ICON, COSMOS_SCOPE } from './constants'
import { CosmosInjectedRegistry } from './registry'
import type { CreateCosmosOptions } from './types/config'

export function createCosmos(config: CreateCosmosOptions): NamespaceConstructor {
	if (!config.chains?.length) throw new MissingChainError(COSMOS_SCOPE.ID)

	const scope: Scope = { ...COSMOS_SCOPE, CHAINS: config.chains.map((c) => c.chainId) }

	return {
		__createNamespace: () => {
			const registry = new CosmosInjectedRegistry({ chains: config.chains })

			return {
				namespace: new NamespaceEngine({
					registries: [...(config.registries ?? []), registry],
					id: scope.ID,
					name: scope.NAME,
					icon: COSMOS_ICON,
					rpcUrls: config.rpcUrls,
				}),
				scope,
			}
		},
	}
}
