import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'

/** Best-effort LCD REST endpoint mapping for the chains the playground configures. */
export function lcdForReference(reference: string): string | undefined {
	switch (reference) {
		case 'dimension_37-1':
			return 'https://dimension-lcd.xpla.dev'
		case 'cube_47-5':
			return 'https://cube-lcd.xpla.dev'
		case 'fetchhub-4':
			return 'https://rest-fetchhub.fetch.ai'
		case 'dorado-1':
			return 'https://rest-dorado.fetch.ai'
		default:
			return undefined
	}
}

export function fromBase64(s: string): Uint8Array {
	const binary = atob(s)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (const b of bytes) binary += String.fromCharCode(b)
	return btoa(binary)
}

export interface OnChainAccountInfo {
	accountNumber: number
	sequence: number
	pubKey: { typeUrl: string; keyBase64: string } | undefined
}

/**
 * Query `/cosmos/auth/v1beta1/accounts/{address}` and normalize the response.
 *
 * Cosmos-EVM chains (XPLA) wrap the base account in `EthAccount`; vanilla cosmos
 * uses `BaseAccount`. We unwrap both. Returns zero defaults when the account is
 * not yet present on chain (e.g., faucet hasn't dropped to the address).
 */
export async function fetchAccountInfo(reference: string, address: string): Promise<OnChainAccountInfo> {
	const lcd = lcdForReference(reference)
	if (!lcd) throw new Error(`No LCD endpoint for ${reference}`)
	const res = await fetch(`${lcd}/cosmos/auth/v1beta1/accounts/${address}`)
	if (!res.ok) return { accountNumber: 0, sequence: 0, pubKey: undefined }
	const data = (await res.json()) as {
		account?: {
			'@type'?: string
			base_account?: Record<string, unknown>
			account_number?: string
			sequence?: string
			pub_key?: { '@type': string; key: string } | null
		}
	}
	const acc = (data.account?.base_account ?? data.account) as
		| {
				account_number?: string
				sequence?: string
				pub_key?: { '@type': string; key: string } | null
		  }
		| undefined
	const pk = acc?.pub_key
	return {
		accountNumber: Number(acc?.account_number ?? 0),
		sequence: Number(acc?.sequence ?? 0),
		pubKey: pk ? { typeUrl: pk['@type'], keyBase64: pk.key } : undefined,
	}
}

/**
 * Build a protobuf `TxRaw` from the direct-sign inputs + base64 signature, then
 * POST it to the chain's `/cosmos/tx/v1beta1/simulate` endpoint.
 *
 * Simulate does NOT spend gas, but it DOES verify the signature against
 * `bodyBytes` + `authInfoBytes`. If XPLA Vault internally re-serialized the
 * msgs/fee, the signature will not match our input bytes and the simulate
 * call will report an authentication failure — useful diagnostic.
 */
export async function simulateDirectSignedTx(params: {
	chainReference: string
	bodyBytes: Uint8Array
	authInfoBytes: Uint8Array
	signatureBase64: string
}): Promise<{ ok: boolean; status: number; raw: unknown }> {
	const lcd = lcdForReference(params.chainReference)
	if (!lcd) throw new Error(`No REST endpoint configured for ${params.chainReference}`)

	const signatureBytes = fromBase64(params.signatureBase64)
	const txRaw = TxRaw.fromPartial({
		bodyBytes: params.bodyBytes,
		authInfoBytes: params.authInfoBytes,
		signatures: [signatureBytes],
	})
	const txRawBytes = TxRaw.encode(txRaw).finish()

	const res = await fetch(`${lcd}/cosmos/tx/v1beta1/simulate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ tx_bytes: bytesToBase64(txRawBytes) }),
	})
	const raw = await res.json().catch(() => ({ error: 'non-JSON response' }))
	return { ok: res.ok, status: res.status, raw }
}
