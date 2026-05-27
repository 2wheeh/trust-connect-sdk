export const XPLA_WC1_WALLET = {
	ID: 'xpla-vault-mobile',
	NAME: 'XPLA WC (v1)',
	ICON: 'https://assets.xpla.io/icon/extension/icon.png',
} as const

/** XPLA-hosted WC v1 bridge URL. */
export const XPLA_WC1_BRIDGE = 'https://walletconnect.xpla.io/'

/** Custom localStorage key prefix to avoid collision with other WC clients. */
export const XPLA_WC1_STORAGE_ID = 'xpla-wc-v1'

/**
 * URL scheme prefix for the target XPLA wallet app. The wallet expects the QR
 * to contain a deep-link of the form
 * `{scheme}://wallet_connect?action=wallet_connect&payload=<doubly-encoded WC URI>`
 * rather than the bare `wc:` URI — that's how XPLA's mobile router dispatches
 * the WC v1 handshake.
 *
 * Source: xpla wallet-provider's `XplaWalletconnectQrcodeModal` (`modules/walletconnect/modal.ts`).
 */
export const XPLA_WALLET_SCHEMES = {
	XPLA_VAULT: 'xplavault',
	XPLA_GAMES: 'xgameswallet',
	XPLAYZ: 'xplayz',
} as const

export type XplaWalletScheme = (typeof XPLA_WALLET_SCHEMES)[keyof typeof XPLA_WALLET_SCHEMES] | (string & {})

/**
 * Wrap a bare WC v1 URI in XPLA's deep-link format. The mobile QR scanner /
 * camera reads this URL, dispatches via OS scheme handler, the wallet app
 * receives it and extracts the WC URI from the doubly-encoded payload.
 */
export function buildXplaDeepLink(scheme: XplaWalletScheme, wcUri: string): string {
	const inner = `action=wallet_connect&payload=${encodeURIComponent(wcUri)}`
	return `${scheme}://wallet_connect?action=wallet_connect&payload=${encodeURIComponent(inner)}`
}

