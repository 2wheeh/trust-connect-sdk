/**
 * Minimal subset of Keplr's wallet API consumed by the cosmos namespace.
 *
 * We hand-roll these types rather than depending on `@keplr-wallet/types` to keep
 * the SDK slim. Cosmostation exposes a compatible shim at `window.cosmostation.providers.keplr`,
 * so a single `KeplrLikeProvider` interface covers both wallets.
 */

import type {
	CosmosSignDoc,
	CosmosSignDirectResponse,
	CosmosStdSignDoc,
	CosmosSignAminoResponse,
} from '@trustwallet/connect-cosmos-types'

/**
 * Native Keplr `Key` shape — note `pubKey` is camelCase with capital K, NOT `pubkey`.
 * The wallet adapter maps this to our CAIP-275 `CosmosAccount` (which uses `pubkey`).
 */
export interface KeplrKey {
	name: string
	algo: 'secp256k1' | 'ed25519' | 'sr25519' | 'ethsecp256k1'
	pubKey: Uint8Array
	address: Uint8Array
	bech32Address: string
	isNanoLedger?: boolean
	isKeystone?: boolean
}

/**
 * Keplr-compatible `ChainInfo`. Only the fields TrustConnect needs to register a chain.
 *
 * For XPLA (cosmos-evm) set `bip44.coinType=60` and include `'eth-address-gen'` +
 * `'eth-key-sign'` in `features`. For vanilla cosmos (Fetch.ai), `coinType=118` and
 * no features required.
 */
export interface ChainInfo {
	chainId: string
	chainName: string
	rpc: string
	rest: string
	bip44: { coinType: number }
	bech32Config: {
		bech32PrefixAccAddr: string
		bech32PrefixAccPub: string
		bech32PrefixValAddr: string
		bech32PrefixValPub: string
		bech32PrefixConsAddr: string
		bech32PrefixConsPub: string
	}
	currencies: ReadonlyArray<{
		coinDenom: string
		coinMinimalDenom: string
		coinDecimals: number
		coinGeckoId?: string
	}>
	feeCurrencies: ReadonlyArray<{
		coinDenom: string
		coinMinimalDenom: string
		coinDecimals: number
		coinGeckoId?: string
		gasPriceStep?: { low: number; average: number; high: number }
	}>
	stakeCurrency: {
		coinDenom: string
		coinMinimalDenom: string
		coinDecimals: number
		coinGeckoId?: string
	}
	features?: string[]
}

/**
 * The narrow subset of the Keplr global we depend on. Cosmostation's
 * `window.cosmostation.providers.keplr` shim implements the same surface.
 */
export interface KeplrLikeProvider {
	enable(chainIds: string | string[]): Promise<void>
	disable?(chainIds?: string | string[]): Promise<void>
	experimentalSuggestChain(chainInfo: ChainInfo): Promise<void>
	getKey(chainId: string): Promise<KeplrKey>
	signDirect(
		chainId: string,
		signer: string,
		signDoc: { bodyBytes: Uint8Array; authInfoBytes: Uint8Array; chainId: string; accountNumber: bigint },
	): Promise<{
		signed: { bodyBytes: Uint8Array; authInfoBytes: Uint8Array; chainId: string; accountNumber: bigint }
		signature: { pub_key: { type: string; value: string }; signature: string }
	}>
	signAmino(
		chainId: string,
		signer: string,
		signDoc: CosmosStdSignDoc,
	): Promise<CosmosSignAminoResponse>
}

/**
 * Bridge helpers to convert between our string-based `CosmosSignDoc` (JSON-safe)
 * and Keplr's bigint-based shape.
 */
export const toKeplrSignDoc = (doc: CosmosSignDoc) => ({
	bodyBytes: doc.bodyBytes,
	authInfoBytes: doc.authInfoBytes,
	chainId: doc.chainId,
	accountNumber: BigInt(doc.accountNumber),
})

export const fromKeplrSignDoc = (doc: {
	bodyBytes: Uint8Array
	authInfoBytes: Uint8Array
	chainId: string
	accountNumber: bigint
}): CosmosSignDoc => ({
	bodyBytes: doc.bodyBytes,
	authInfoBytes: doc.authInfoBytes,
	chainId: doc.chainId,
	accountNumber: doc.accountNumber.toString(),
})

export const fromKeplrDirectResponse = (response: {
	signed: { bodyBytes: Uint8Array; authInfoBytes: Uint8Array; chainId: string; accountNumber: bigint }
	signature: { pub_key: { type: string; value: string }; signature: string }
}): CosmosSignDirectResponse => ({
	signed: fromKeplrSignDoc(response.signed),
	signature: response.signature,
})
