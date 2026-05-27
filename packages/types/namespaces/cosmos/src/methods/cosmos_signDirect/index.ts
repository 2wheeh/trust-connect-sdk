import type { CosmosAddress } from '../../address'

export type CosmosSignDirectMethod = 'cosmos_signDirect'

/**
 * Direct (protobuf) sign doc. Matches the shape Keplr's `signDirect` accepts.
 *
 * `bodyBytes` and `authInfoBytes` are raw protobuf-encoded bytes. `accountNumber`
 * is a string here (not bigint) so the SDK boundary stays JSON-serializable;
 * the wallet adapter converts to bigint if its underlying API requires.
 */
export type CosmosSignDoc = {
	bodyBytes: Uint8Array
	authInfoBytes: Uint8Array
	chainId: string
	accountNumber: string
}

export type CosmosSignDirectParams = {
	signerAddress: CosmosAddress
	signDoc: CosmosSignDoc
}

export type CosmosSignDirectResponse = {
	signed: CosmosSignDoc
	signature: {
		pub_key: { type: string; value: string }
		signature: string
	}
}
