/**
 * Decode helpers for XPLA Vault `cosmos_signDirect`.
 *
 * XPLA Vault's legacy extension API does not accept raw protobuf bytes — it
 * wants amino-JSON `msgs` + `fee`. To honor a `cosmos_signDirect` request we
 * decode the dApp's `bodyBytes` / `authInfoBytes` back to plain JSON, translate
 * each protobuf message to its amino shape, and forward `signMode: 1` (DIRECT)
 * so the extension produces a direct signature.
 *
 * **Lossiness warning**: the extension re-encodes the messages internally before
 * signing. The resulting signature is over those re-encoded bytes, not the
 * dApp's input `bodyBytes`. The adapter returns the dApp's input as `signed.*`
 * for protocol compatibility, but the dApp should expect to use the
 * extension's signed envelope when broadcasting. This trade-off is documented
 * on every call.
 *
 * `cosmjs-types` is an **optional peer dependency**; we lazy-import it so that
 * dApps not using XPLA Vault direct sign do not pay the bundle cost.
 */

import type { CosmosSignDoc } from '@trustwallet/connect-cosmos-types'

export interface AminoMsg {
	type: string
	value: Record<string, unknown>
}
export interface AminoFee {
	amount: Array<{ denom: string; amount: string }>
	gas: string
}

/** Direct sign mode (SIGN_MODE_DIRECT from sdk.proto). */
export const SIGN_MODE_DIRECT = 1

async function loadCosmjsTypes() {
	try {
		const tx = (await import('cosmjs-types/cosmos/tx/v1beta1/tx.js')) as typeof import('cosmjs-types/cosmos/tx/v1beta1/tx')
		const bank = (await import('cosmjs-types/cosmos/bank/v1beta1/tx.js')) as typeof import('cosmjs-types/cosmos/bank/v1beta1/tx')
		return { TxBody: tx.TxBody, AuthInfo: tx.AuthInfo, MsgSend: bank.MsgSend }
	} catch {
		throw new Error(
			'XPLA Vault cosmos_signDirect requires the `cosmjs-types` package. Install it as a dependency of your dApp.',
		)
	}
}

/**
 * Convert a single proto `Any` message (typeUrl + value bytes) to amino JSON.
 *
 * Only message types we explicitly know how to translate are supported. Unknown
 * typeUrls throw with a clear error so dApps can extend or fall back.
 */
async function protoMessageToAmino(message: {
	typeUrl: string
	value: Uint8Array
}): Promise<AminoMsg> {
	const { MsgSend } = await loadCosmjsTypes()
	switch (message.typeUrl) {
		case '/cosmos.bank.v1beta1.MsgSend': {
			const decoded = MsgSend.decode(message.value)
			return {
				type: 'cosmos-sdk/MsgSend',
				value: {
					from_address: decoded.fromAddress,
					to_address: decoded.toAddress,
					amount: decoded.amount.map((c) => ({ denom: c.denom, amount: c.amount })),
				},
			}
		}
		default:
			throw new Error(
				`XPLA Vault cosmos_signDirect: typeUrl "${message.typeUrl}" is not mapped to amino. ` +
					'Only `/cosmos.bank.v1beta1.MsgSend` is supported in this release.',
			)
	}
}

export interface DecodedDirectSignDoc {
	msgs: AminoMsg[]
	fee: AminoFee
	memo: string
	sequence: number
	accountNumber: number
}

/** Decode a `CosmosSignDoc` (protobuf bytes) into amino-shaped inputs for XPLA Vault. */
export async function decodeDirectSignDoc(signDoc: CosmosSignDoc): Promise<DecodedDirectSignDoc> {
	const { TxBody, AuthInfo } = await loadCosmjsTypes()
	const body = TxBody.decode(signDoc.bodyBytes)
	const authInfo = AuthInfo.decode(signDoc.authInfoBytes)

	const msgs = await Promise.all(body.messages.map((m) => protoMessageToAmino(m)))
	const fee: AminoFee = {
		amount: authInfo.fee?.amount?.map((c) => ({ denom: c.denom, amount: c.amount })) ?? [],
		gas: authInfo.fee?.gasLimit?.toString() ?? '0',
	}
	// Sequence sits on the signer info, not the SignDoc — pull the first signer's seq (matches the signer address).
	const sequence = Number(authInfo.signerInfos[0]?.sequence ?? 0)

	return {
		msgs,
		fee,
		memo: body.memo,
		sequence,
		accountNumber: Number(signDoc.accountNumber),
	}
}
