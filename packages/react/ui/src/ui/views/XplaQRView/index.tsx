import { useEffect, useMemo } from 'react'
import { useConnections, type Cast } from '@trustwallet/connect-headless'
import { useTrustModal } from '@trustwallet/connect-ui-logic'
import { XPLA_WC1_WALLET } from '@trustwallet/connect-xpla-walletconnect-v1'
import { useXplaWalletConnect } from '@trustwallet/connect-xpla-walletconnect-v1/react'
import { Cuer } from 'cuer'
import { QRWrapper } from '../QRView/components/QRWrapper'
import { QRPlaceholder } from '../QRView/components/QRPlaceholder'
import { QRActions } from '../QRView/components/QRActions'
import { QRButton } from '../QRView/components/QRButton'
import { QRError } from '../QRView/components/QRError'
import { Spinner } from '../../icons/Spinner'

/**
 * QR view for the XPLA Vault Mobile (WC v1) flow. Mirrors the existing
 * `QRView` (which is tied to WC v2's `useWalletConnect`) but reads URI from
 * `useXplaWalletConnect` and auto-closes when the cosmos connection lands on
 * our wallet id.
 */
export function XplaQRView() {
	const { uri, isUriLoading, error, wallet } = useXplaWalletConnect()
	const { connections } = useConnections()
	const { close } = useTrustModal()

	const cosmosConnection = (connections as Cast['connections']).cosmos
	const isConnected =
		cosmosConnection?.status === 'connected' && cosmosConnection.wallet?.id === XPLA_WC1_WALLET.ID

	useEffect(() => {
		if (isConnected) close()
	}, [isConnected, close])

	const arena = useMemo(() => wallet?.icon ?? XPLA_WC1_WALLET.ICON, [wallet])

	const handleCopy = async () => {
		if (!uri) return
		try {
			await navigator.clipboard.writeText(uri)
		} catch {
			// Ignore — older browsers may block clipboard outside user gesture.
		}
	}

	return (
		<QRWrapper>
			{isUriLoading || !uri ? (
				<QRPlaceholder>
					<Spinner />
				</QRPlaceholder>
			) : (
				<Cuer arena={arena} value={uri} />
			)}

			<QRActions>
				<QRButton onClick={handleCopy} disabled={!uri || isUriLoading}>
					Copy to clipboard
				</QRButton>
			</QRActions>

			{error && <QRError message={error.message} />}
		</QRWrapper>
	)
}
