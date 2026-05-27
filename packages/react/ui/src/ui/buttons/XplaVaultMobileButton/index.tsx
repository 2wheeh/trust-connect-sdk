import { useMemo } from 'react'
import { useConnect, useConnections, useTrustConnectContext, type Cast } from '@trustwallet/connect-headless'
import { XPLA_WC1_WALLET } from '@trustwallet/connect-xpla-walletconnect-v1'
import { useXplaWalletConnect } from '@trustwallet/connect-xpla-walletconnect-v1/react'
import { useTrustModal } from '@trustwallet/connect-ui-logic'
import { WalletButton } from '../WalletButton'
import { WCGrid } from '../WalletConnectButton/components/WCGrid'

/**
 * XPLA Vault Mobile (WC v1) button rendered directly under the existing
 * WalletConnect (v2) button — same `WalletButton` look-and-feel, same
 * `walletconnect` variant, same WCGrid wrapper. Click navigates to the
 * dedicated XPLA QR sub-view.
 *
 * Returns null when the XPLA WC v1 service isn't registered, so non-XPLA
 * dApps using `@trustwallet/connect-react` see no change.
 */
export function XplaVaultMobileButton() {
	const { client } = useTrustConnectContext()
	const isRegistered = useMemo(() => client.services.some((s) => s.id === XPLA_WC1_WALLET.ID), [client])
	if (!isRegistered) return null
	return <XplaVaultMobileInner />
}

function XplaVaultMobileInner() {
	const { wallet, generateUri, isUriLoading } = useXplaWalletConnect()
	const { connections } = useConnections()
	const { disconnect } = useConnect()
	const { setView } = useTrustModal()

	if (!wallet) return null

	const cosmosConnection = (connections as Cast['connections']).cosmos
	const isConnected =
		cosmosConnection?.status === 'connected' && cosmosConnection.wallet?.id === wallet.id

	const handleClick = async () => {
		if (isConnected) {
			disconnect()
			return
		}
		setView('qr-xpla')
		await generateUri().catch(() => {})
	}

	return (
		<WCGrid>
			<WalletButton
				key={wallet.id}
				name={wallet.name}
				icon={wallet.icon}
				active={isConnected}
				variant="walletconnect"
				actionLabel={isConnected ? 'Disconnect' : 'Connect'}
				onClick={handleClick}
				disabled={false}
				loading={isUriLoading}
			/>
		</WCGrid>
	)
}
