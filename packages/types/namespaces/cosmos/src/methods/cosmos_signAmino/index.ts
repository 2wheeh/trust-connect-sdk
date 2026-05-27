import type { CosmosAddress } from '../../address'

export type CosmosSignAminoMethod = 'cosmos_signAmino'

/**
 * Amino (legacy JSON) sign doc. Matches `StdSignDoc` from `@cosmjs/amino`.
 */
export type CosmosStdSignDoc = {
	chain_id: string
	account_number: string
	sequence: string
	fee: {
		amount: ReadonlyArray<{ denom: string; amount: string }>
		gas: string
		granter?: string
		payer?: string
	}
	msgs: ReadonlyArray<{ type: string; value: unknown }>
	memo: string
	timeout_height?: string
}

export type CosmosSignAminoParams = {
	signerAddress: CosmosAddress
	signDoc: CosmosStdSignDoc
}

export type CosmosSignAminoResponse = {
	signed: CosmosStdSignDoc
	signature: {
		pub_key: { type: string; value: string }
		signature: string
	}
}
