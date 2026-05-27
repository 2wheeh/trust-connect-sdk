import { useMutation } from '@tanstack/react-query'
import {
	buildChainId,
	useTrustConnectContext,
	NoWalletConnectedError,
	WalletNotFoundInConnectionError,
	InvalidResponseError,
} from '@trustwallet/connect-headless'
import { COSMOS_SCOPE, type CosmosChainId } from '@trustwallet/connect-cosmos-core'
import type { UseGetAccountOptions, UseGetAccountParams, UseGetAccountResult } from '../types'

export function useGetAccount(options: UseGetAccountOptions = {}) {
	const { client } = useTrustConnectContext()
	const { mutationOptions } = options

	const connection = client.connections[COSMOS_SCOPE.ID]

	const mutationFn = async (params: UseGetAccountParams = {}): Promise<UseGetAccountResult> => {
		if (connection?.status !== 'connected') throw new NoWalletConnectedError(COSMOS_SCOPE.ID)
		const wallet = connection.wallet
		if (!wallet) throw new WalletNotFoundInConnectionError()

		const provider = await wallet.getProvider()

		const reference = params.chainReference ?? connection.chain.reference
		const chainId = buildChainId({
			namespace: COSMOS_SCOPE.ID,
			reference,
		}) as CosmosChainId

		const accounts = await provider.request({
			chainId,
			request: { method: 'cosmos_getAccounts', params: {} },
		})

		const [account] = accounts
		if (!account) throw new InvalidResponseError('wallet')
		return account
	}

	return useMutation<UseGetAccountResult, Error, UseGetAccountParams | undefined, unknown>({
		mutationKey: ['cosmos', 'getAccount'],
		mutationFn,
		...mutationOptions,
	})
}
