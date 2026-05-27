import type { ReactNode } from 'react'
import { useConnect, useConnections, type Cast } from '@trustwallet/connect-headless'
import { useXplaWalletConnect } from './useXplaWalletConnect'

interface Props {
	className?: string
	/** Optional QR renderer. Receives the WC v1 URI string. */
	renderQr?: (uri: string) => ReactNode
	/** Override default button labels. */
	labels?: {
		connect?: string
		connecting?: string
		disconnect?: string
	}
}

/**
 * Drop-in connect button for XPLA Vault Mobile via WC v1.
 *
 * Place this anywhere in your app (OUTSIDE the TrustConnect modal — the modal
 * deliberately hardcodes the WC v2 button to stay backward-compatible). Clicking
 * generates a WC v1 URI, exposes it via `renderQr` for QR rendering.
 */
export function XplaWalletConnectButton({ className, renderQr, labels }: Props) {
	const { uri, wallet, generateUri, isUriLoading, error } = useXplaWalletConnect()
	const { connections } = useConnections()
	const { disconnect } = useConnect()

	if (!wallet) return null

	const cosmosConnection = (connections as Cast['connections']).cosmos
	const isConnected = cosmosConnection?.status === 'connected' && cosmosConnection.wallet?.id === wallet.id

	const handleClick = async () => {
		if (isConnected) {
			disconnect()
			return
		}
		try {
			await generateUri()
		} catch {
			// generateUri propagates via the `error` field; nothing to do here.
		}
	}

	const label = isConnected
		? (labels?.disconnect ?? 'Disconnect XPLA WalletConnect v1')
		: isUriLoading
			? (labels?.connecting ?? 'Generating QR…')
			: (labels?.connect ?? 'Connect XPLA WalletConnect v1')

	return (
		<div className={className}>
			<button type="button" onClick={handleClick} disabled={isUriLoading}>
				{label}
			</button>
			{uri && (renderQr ? renderQr(uri) : <code style={{ display: 'block', wordBreak: 'break-all' }}>{uri}</code>)}
			{error && <div role="alert">{error.message}</div>}
		</div>
	)
}
