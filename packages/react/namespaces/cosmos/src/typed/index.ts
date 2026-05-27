/**
 * Optional typed CosmWasm helpers.
 *
 * This subpath is only available when the consumer installs `schemos` as a peer
 * dependency. It re-exports schemos primitives plus a tiny `wrapExecuteMsg` helper
 * that produces an `EncodeObject`-shaped `MsgExecuteContract` body. The dApp pairs
 * this with `useSignDirect` from the main export — broadcast is its responsibility
 * (we do not ship a broadcast hook in v1).
 *
 * @example
 * ```ts
 * import { wrapExecuteMsg } from '@trustwallet/connect-cosmos-react/typed'
 * import { createMsgBuilder } from 'schemos'
 *
 * const cw20Schema = { execute: { ... } }
 * const builder = createMsgBuilder(cw20Schema)
 * const msg = wrapExecuteMsg({
 *   sender: 'xpla1...',
 *   contract: 'xpla1contract...',
 *   msg: builder.build('transfer', { recipient: 'xpla1...', amount: '1000' }),
 * })
 * // → { typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract', value: { ... } }
 * ```
 */

export const MSG_EXECUTE_CONTRACT_TYPE_URL = '/cosmwasm.wasm.v1.MsgExecuteContract' as const

export type CosmWasmCoin = { denom: string; amount: string }

export type WrappedExecuteMsg = {
	typeUrl: typeof MSG_EXECUTE_CONTRACT_TYPE_URL
	value: {
		sender: string
		contract: string
		msg: Uint8Array
		funds: CosmWasmCoin[]
	}
}

/**
 * Wrap a typed CosmWasm message (from schemos) into a `MsgExecuteContract` body
 * ready to be slotted into a SignDoc.
 */
export function wrapExecuteMsg(params: {
	sender: string
	contract: string
	msg: unknown
	funds?: CosmWasmCoin[]
}): WrappedExecuteMsg {
	return {
		typeUrl: MSG_EXECUTE_CONTRACT_TYPE_URL,
		value: {
			sender: params.sender,
			contract: params.contract,
			msg: new TextEncoder().encode(JSON.stringify(params.msg)),
			funds: params.funds ?? [],
		},
	}
}
