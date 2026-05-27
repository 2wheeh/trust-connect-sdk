import type { CosmosAddress } from '../../address'

export type CosmosGetAccountsMethod = 'cosmos_getAccounts'

export type CosmosGetAccountsParams = Record<string, never>

/**
 * Single account entry. Mirrors the CAIP-275 / Keplr `Key` shape: bech32 address,
 * compressed pubkey (33 bytes), and the pubkey algorithm. XPLA reports `ethsecp256k1`
 * when the chain is registered with `eth-key-sign`; vanilla cosmos reports `secp256k1`.
 */
export type CosmosAccount = {
	address: CosmosAddress
	pubkey: Uint8Array
	algo: 'secp256k1' | 'ed25519' | 'sr25519' | 'ethsecp256k1'
}

export type CosmosGetAccountsResponse = CosmosAccount[]
