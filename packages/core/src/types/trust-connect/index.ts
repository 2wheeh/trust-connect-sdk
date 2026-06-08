import { NamespaceEngine } from '../../02-namespace/engine'
import { ServiceBase } from '../../03-services/base'
import { WalletAdapterBase } from '../../05-wallet/base'
import { NamespaceId } from '../caip'
import { NamespaceConnection, NamespaceSpecs, Scope } from '../namespace'
import type { StorageBackend } from '../../utils/storage'

export interface TrustConnectOptions {
	namespaces: NamespaceConstructor[]
	services?: ServiceConstructor[]
	/**
	 * Optional sync key/value backend used to persist trust-connect's own
	 * `lastConnectedWalletId` pointer (the CAIP/WalletConnect reconnect pointer).
	 * Defaults to `window.localStorage` in the browser; in Node, provide an
	 * fs-backed backend to enable reconnect across restarts. Without it, the
	 * pointer is not persisted (no-op).
	 */
	storage?: StorageBackend
}

export type NamespaceConstructor = {
	__createNamespace: () => {
		namespace: NamespaceEngine
		scope: Scope
	}
}

export type ServiceConstructor = {
	__createService: ({ scopes }: { scopes: Map<NamespaceId, Scope> }) => ServiceBase
}

/**
 * Connection states for all namespaces, typed correctly per namespace.
 * Each namespace (eip155, solana, bitcoin) has its own specific connection state with proper types.
 */
export type Connections = {
	[K in keyof NamespaceSpecs]?: NamespaceConnection<
		NamespaceSpecs[K]['address'],
		WalletAdapterBase<'namespace', NamespaceSpecs[K]['address'], NamespaceSpecs[K]['provider']>
	>
}
