import { Scope } from '@trustwallet/connect-core'

/**
 * Cosmos namespace scope (CAIP-275 baseline methods).
 *
 * `CHAINS` is populated dynamically by `createCosmos` from the user's chain list.
 * `KEYSTORE_CHANGE` is the window event Keplr / Cosmostation fire when the active
 * account changes; the wallet adapter re-fetches the key and re-emits address.
 */
export const COSMOS_SCOPE = {
	ID: 'cosmos',
	NAME: 'Cosmos',
	CHAINS: [],
	METHODS: {
		SIGN_DIRECT: 'cosmos_signDirect',
		SIGN_AMINO: 'cosmos_signAmino',
		GET_ACCOUNTS: 'cosmos_getAccounts',
	},
	EVENTS: {
		KEYSTORE_CHANGE: 'keplr_keystorechange',
	},
} as const satisfies Scope

/** ATOM-style minimal mark; replace with real SVG before release. */
export const COSMOS_ICON =
	'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDk2IDk2IiBmaWxsPSJub25lIj48Y2lyY2xlIGN4PSI0OCIgY3k9IjQ4IiByPSI0OCIgZmlsbD0iIzJFM0E1OSIvPjxwYXRoIGQ9Ik00OCAxNmwxNCAyNC0xNCAyNC0xNC0yNHoiIGZpbGw9IiNGRkYiLz48L3N2Zz4='
