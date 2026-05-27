/**
 * Direct-sign decode helper for XPLA Vault Mobile.
 *
 * XPLA Vault's WC v1 `sign` request expects each message to be a JSON string
 * conforming to **protobuf Any JSON** format (`@type` discriminator field +
 * camelCase property names) — NOT amino JSON. This is so the iOS app can
 * deserialize via `Google_Protobuf_Any(jsonString:)` and dispatch by typeURL.
 *
 * Similarly, `fee` is a JSON string of `Cosmos_Tx_V1beta1_Fee` (camelCase
 * `gasLimit`, NOT amino `gas`).
 *
 * Reference: xpla-games-app-ios `WalletConnectSignManager.swift:247-283`.
 *
 * To honor `cosmos_signDirect`, we decode the dApp's `bodyBytes` /
 * `authInfoBytes` and re-shape each message into proto-Any JSON.
 *
 * `cosmjs-types` is an optional peer dependency; lazy-imported.
 */

import type { CosmosSignDoc } from '@trustwallet/connect-cosmos-types'

/** Proto-Any JSON shape: `{ '@type': typeUrl, ...camelCase fields }`. */
export type ProtoAnyJson = { '@type': string } & Record<string, unknown>

/** Proto JSON shape of `cosmos.tx.v1beta1.Fee`. */
export interface ProtoFeeJson {
	amount: Array<{ denom: string; amount: string }>
	gasLimit: string
	payer?: string
	granter?: string
}

/** SIGN_MODE_DIRECT from sdk.proto. */
export const SIGN_MODE_DIRECT = 1

async function loadCosmjsTypes() {
	try {
		const tx = (await import('cosmjs-types/cosmos/tx/v1beta1/tx.js')) as typeof import('cosmjs-types/cosmos/tx/v1beta1/tx')
		const bank = (await import('cosmjs-types/cosmos/bank/v1beta1/tx.js')) as typeof import('cosmjs-types/cosmos/bank/v1beta1/tx')
		return { TxBody: tx.TxBody, AuthInfo: tx.AuthInfo, MsgSend: bank.MsgSend }
	} catch {
		throw new Error(
			'XPLA Vault Mobile cosmos_signDirect requires the `cosmjs-types` package. Install it as a dependency of your dApp.',
		)
	}
}

/**
 * Convert a single proto `Any` message (typeUrl + value bytes) to proto-Any
 * JSON. Currently supports `/cosmos.bank.v1beta1.MsgSend`; extend per msg type
 * as needed.
 *
 * Unknown typeUrls are passed through as a thin `{'@type': typeUrl}` object —
 * the iOS handler falls back to `Google_Protobuf_Any(jsonString:)` which can
 * decode any registered proto type from its `@type`. We omit `value` decoding
 * for unknown types so the handler can re-encode from JSON itself.
 */
async function protoMessageToAny(message: {
	typeUrl: string
	value: Uint8Array
}): Promise<ProtoAnyJson> {
	const { MsgSend } = await loadCosmjsTypes()
	switch (message.typeUrl) {
		case '/cosmos.bank.v1beta1.MsgSend': {
			const decoded = MsgSend.decode(message.value)
			return {
				'@type': '/cosmos.bank.v1beta1.MsgSend',
				fromAddress: decoded.fromAddress,
				toAddress: decoded.toAddress,
				amount: decoded.amount.map((c) => ({ denom: c.denom, amount: c.amount })),
			}
		}
		default:
			throw new Error(
				`XPLA Vault Mobile cosmos_signDirect: typeUrl "${message.typeUrl}" is not yet mapped to proto-Any JSON. ` +
					'Only `/cosmos.bank.v1beta1.MsgSend` is supported in this release.',
			)
	}
}

export interface DecodedDirectSignDoc {
	/** Each message stringified as proto-Any JSON for iOS `Google_Protobuf_Any(jsonString:)`. */
	msgs: string[]
	/** `Cosmos_Tx_V1beta1_Fee` JSON string with camelCase `gasLimit`. */
	fee: string
	memo: string
	sequence: number
	accountNumber: number
}

export async function decodeDirectSignDoc(signDoc: CosmosSignDoc): Promise<DecodedDirectSignDoc> {
	const { TxBody, AuthInfo } = await loadCosmjsTypes()
	const body = TxBody.decode(signDoc.bodyBytes)
	const authInfo = AuthInfo.decode(signDoc.authInfoBytes)

	const msgs = await Promise.all(
		body.messages.map(async (m) => JSON.stringify(await protoMessageToAny(m))),
	)
	const fee: ProtoFeeJson = {
		amount: authInfo.fee?.amount?.map((c) => ({ denom: c.denom, amount: c.amount })) ?? [],
		gasLimit: authInfo.fee?.gasLimit?.toString() ?? '0',
		payer: authInfo.fee?.payer ?? '',
		granter: authInfo.fee?.granter ?? '',
	}
	const sequence = Number(authInfo.signerInfos[0]?.sequence ?? 0)

	return {
		msgs,
		fee: JSON.stringify(fee),
		memo: body.memo,
		sequence,
		accountNumber: Number(signDoc.accountNumber),
	}
}
