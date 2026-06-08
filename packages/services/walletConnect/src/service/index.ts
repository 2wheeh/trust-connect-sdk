import { NamespaceId, Scope } from '@trustwallet/connect-core'
import type { SignClientInstance, WalletConnectOptions } from '../types'
import { WalletConnectService } from './service'
import { MissingProjectIdError } from '../errors'

export { WalletConnectService } from './service'

export function createWalletConnect(options: WalletConnectOptions) {
	if (!options.projectId) throw new MissingProjectIdError()

	/**
	 * Initialize SignClient once, outside of React's render cycle.
	 * This prevents double-initialization caused by React Strict Mode or re-renders,
	 * since createWalletConnect is called at module/app level.
	 */
	let signClientPromise: Promise<SignClientInstance> | undefined

	function getSignClientPromise(): Promise<SignClientInstance> {
		if (signClientPromise) return signClientPromise

		signClientPromise = (async () => {
			const { SignClient } = await import('@walletconnect/sign-client')

			return SignClient.init({
				projectId: options.projectId,
				metadata: options.metadata,
				storage: options.storage,
				logger: options.logger,
			})
		})()

		return signClientPromise
	}

	return {
		/**
		 * @internal
		 * Internal use only. Do not use directly.
		 */
		__createService: ({ scopes }: { scopes: Map<NamespaceId, Scope> }) => {
			return new WalletConnectService({
				projectId: options.projectId,
				metadata: options.metadata,
				scopes,
				signClientPromise: getSignClientPromise(),
			})
		},
	}
}
