import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useConnect, useTrustConnectContext } from '@trustwallet/connect-headless'
import type { CaipWallet } from '@trustwallet/connect-core'
import { XPLA_WC1_WALLET } from '../constants'
import type { XplaWalletConnectV1Service } from '../service'

interface UseXplaWalletConnectResult {
	uri: string | undefined
	wallet: CaipWallet | undefined
	generateUri: () => Promise<void>
	isUriLoading: boolean
	error: Error | null
}

/**
 * Mirror of `useWalletConnect` (WC v2) for the XPLA-specific WC v1 service.
 * Resolves the service from the TrustConnect client by id (no separate context provider needed).
 */
export function useXplaWalletConnect(): UseXplaWalletConnectResult {
	const { client } = useTrustConnectContext()
	const { connect, isLoading, error } = useConnect()

	const service = useMemo(() => {
		return client.services.find((s) => s.id === XPLA_WC1_WALLET.ID) as XplaWalletConnectV1Service | undefined
	}, [client])

	const wallet = useMemo(() => service?.getCaipWallet() as CaipWallet | undefined, [service])

	const uri = useSyncExternalStore(
		(callback) => {
			if (!service) return () => {}
			return service.onUri(() => callback())
		},
		() => service?.getUri(),
		() => service?.getUri(),
	)

	const generateUri = useCallback(async () => {
		if (!service || !wallet) throw new Error('XPLA WalletConnect v1 service not registered')
		service.setUri('')
		await connect({ wallet })
	}, [service, wallet, connect])

	return {
		uri,
		wallet,
		generateUri,
		isUriLoading: isLoading && !uri,
		error,
	}
}
