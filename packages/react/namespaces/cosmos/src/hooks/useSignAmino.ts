import { useMutation } from '@tanstack/react-query'
import {
	buildChainId,
	useTrustConnectContext,
	NoWalletConnectedError,
	WalletNotFoundInConnectionError,
} from '@trustwallet/connect-headless'
import { COSMOS_SCOPE, type CosmosChainId } from '@trustwallet/connect-cosmos-core'
import type { UseSignAminoOptions, UseSignAminoParams, UseSignAminoResult } from '../types'

export function useSignAmino(options: UseSignAminoOptions = {}) {
	const { client } = useTrustConnectContext()
	const { mutationOptions } = options

	const connection = client.connections[COSMOS_SCOPE.ID]

	const mutationFn = async (params: UseSignAminoParams): Promise<UseSignAminoResult> => {
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
				method: 'cosmos_signAmino',
				params: {
					signerAddress: params.signerAddress,
					signDoc: params.signDoc,
				},
			},
		})
	}

	return useMutation<UseSignAminoResult, Error, UseSignAminoParams, unknown>({
		mutationKey: ['cosmos', 'signAmino'],
		mutationFn,
		...mutationOptions,
	})
}
