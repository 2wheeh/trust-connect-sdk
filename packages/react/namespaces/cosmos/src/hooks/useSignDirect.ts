import { useMutation } from '@tanstack/react-query'
import {
	buildChainId,
	useTrustConnectContext,
	NoWalletConnectedError,
	WalletNotFoundInConnectionError,
} from '@trustwallet/connect-headless'
import { COSMOS_SCOPE, type CosmosChainId } from '@trustwallet/connect-cosmos-core'
import type { UseSignDirectOptions, UseSignDirectParams, UseSignDirectResult } from '../types'

export function useSignDirect(options: UseSignDirectOptions = {}) {
	const { client } = useTrustConnectContext()
	const { mutationOptions } = options

	const connection = client.connections[COSMOS_SCOPE.ID]

	const mutationFn = async (params: UseSignDirectParams): Promise<UseSignDirectResult> => {
		if (connection?.status !== 'connected') throw new NoWalletConnectedError(COSMOS_SCOPE.ID)
		const wallet = connection.wallet
		if (!wallet) throw new WalletNotFoundInConnectionError()

		const provider = await wallet.getProvider()

		const reference = params.chainReference ?? connection.chain.reference
		const chainId = buildChainId({
			namespace: COSMOS_SCOPE.ID,
			reference,
		}) as CosmosChainId

		return provider.request({
			chainId,
			request: {
				method: 'cosmos_signDirect',
				params: {
					signerAddress: params.signerAddress,
					signDoc: params.signDoc,
				},
			},
		})
	}

	return useMutation<UseSignDirectResult, Error, UseSignDirectParams, unknown>({
		mutationKey: ['cosmos', 'signDirect'],
		mutationFn,
		...mutationOptions,
	})
}
