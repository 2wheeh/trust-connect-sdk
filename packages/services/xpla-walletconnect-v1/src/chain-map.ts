/**
 * XPLA assigns a numeric `walletconnectID` per network for WC v1.
 *   - `1` → mainnet (`dimension_37-1`)
 *   - `0` → testnet (`cube_47-5`)
 *
 * Source: xpla wallet-provider `getChainOptions.ts:9-30`.
 */
export const XPLA_WC_CHAIN_IDS = {
	MAINNET: 1,
	TESTNET: 0,
} as const

/** Convert XPLA's WC v1 numeric chain id to the CAIP-2 reference for the cosmos namespace. */
export function caipReferenceForWcChainId(chainId: number): string | undefined {
	switch (chainId) {
		case XPLA_WC_CHAIN_IDS.MAINNET:
			return 'dimension_37-1'
		case XPLA_WC_CHAIN_IDS.TESTNET:
			return 'cube_47-5'
		default:
			return undefined
	}
}
