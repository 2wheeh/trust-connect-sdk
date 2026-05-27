import { useState } from 'react'
import { useConnection } from '@trustwallet/connect-react'
import { useSignDirect, type CosmosSignDoc } from '@trustwallet/connect-cosmos-react'
import { ActionCard } from '../../components/ActionCard'
import { TxBody, AuthInfo, Fee, SignerInfo, ModeInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { PubKey as Secp256k1PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { fetchAccountInfo, fromBase64, simulateDirectSignedTx, type OnChainAccountInfo } from './simulate'

/**
 * Build a SignDoc with proper signer_info so that `/simulate` can actually
 * validate the signature. If the address has never touched the chain we still
 * populate sequence=0 / account_number=0 and skip the pubkey Any.
 *
 * The PubKey proto type for cosmos-EVM (ethsecp256k1) shares the same field
 * shape as `cosmos.crypto.secp256k1.PubKey` — just the typeUrl differs — so we
 * reuse the secp256k1 encoder and override the typeUrl when wrapping in Any.
 */
function buildDemoDirectDoc(
	address: string,
	chainId: string,
	denom: string,
	info: OnChainAccountInfo,
): CosmosSignDoc {
	const msgSend = MsgSend.fromPartial({
		fromAddress: address,
		toAddress: address,
		// `1` = one base unit (1 axpla / 1 atestfet / 1 afet). Sending 0 would be
		// rejected by the bank module as `invalid coins`, masking the signature check.
		amount: [{ denom, amount: '1' }],
	})
	const txBody = TxBody.fromPartial({
		messages: [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: MsgSend.encode(msgSend).finish() }],
		memo: 'TrustConnect demo',
	})

	const pubkeyAny = info.pubKey
		? Any.fromPartial({
				typeUrl: info.pubKey.typeUrl,
				value: Secp256k1PubKey.encode({ key: fromBase64(info.pubKey.keyBase64) }).finish(),
			})
		: undefined

	const signerInfo = SignerInfo.fromPartial({
		publicKey: pubkeyAny,
		modeInfo: ModeInfo.fromPartial({ single: { mode: SignMode.SIGN_MODE_DIRECT } }),
		sequence: BigInt(info.sequence),
	})

	const authInfo = AuthInfo.fromPartial({
		signerInfos: [signerInfo],
		fee: Fee.fromPartial({ gasLimit: 200000n, amount: [{ denom, amount: '0' }] }),
	})

	return {
		bodyBytes: TxBody.encode(txBody).finish(),
		authInfoBytes: AuthInfo.encode(authInfo).finish(),
		chainId,
		accountNumber: String(info.accountNumber),
	}
}

export function CosmosSignDirect() {
	const { isConnected, address, chain } = useConnection({ namespaceId: 'cosmos' })
	const { mutate, data, isPending, isSuccess, isError, error } = useSignDirect()
	const [lastSignDoc, setLastSignDoc] = useState<CosmosSignDoc | null>(null)
	const [prepError, setPrepError] = useState<string | null>(null)
	const [simState, setSimState] = useState<
		{ status: 'idle' } | { status: 'loading' } | { status: 'done'; ok: boolean; code: number; raw: unknown }
	>({ status: 'idle' })

	const handleSign = async () => {
		if (!isConnected || !address || !chain) return
		setPrepError(null)
		setSimState({ status: 'idle' })
		try {
			const reference = String(chain.reference)
			const isFetch = reference.startsWith('fetch') || reference.startsWith('dorado')
			const denom = isFetch ? (reference === 'dorado-1' ? 'atestfet' : 'afet') : 'axpla'
			const info = await fetchAccountInfo(reference, address)
			const signDoc = buildDemoDirectDoc(address, reference, denom, info)
			setLastSignDoc(signDoc)
			mutate({ signerAddress: address, signDoc })
		} catch (e) {
			setPrepError(e instanceof Error ? e.message : String(e))
		}
	}

	const handleSimulate = async () => {
		if (!data || !lastSignDoc || !chain) return
		setSimState({ status: 'loading' })
		try {
			const result = await simulateDirectSignedTx({
				chainReference: String(chain.reference),
				bodyBytes: lastSignDoc.bodyBytes,
				authInfoBytes: lastSignDoc.authInfoBytes,
				signatureBase64: data.signature.signature,
			})
			setSimState({ status: 'done', ok: result.ok, code: result.status, raw: result.raw })
		} catch (e) {
			setSimState({
				status: 'done',
				ok: false,
				code: 0,
				raw: { error: e instanceof Error ? e.message : String(e) },
			})
		}
	}

	const sigBytesLen = data ? fromBase64(data.signature.signature).length : null
	const reference = chain ? String(chain.reference) : ''
	const isCosmosEvm = reference.startsWith('dimension') || reference.startsWith('cube')

	return (
		<ActionCard
			eyebrow="Signature"
			title="Sign Direct + Simulate"
			copy="Queries account info from LCD, signs a MsgSend, then optionally simulates the tx to verify the signature against the chain."
		>
			<button className="btn btn-primary" onClick={handleSign} disabled={isPending || !isConnected}>
				{isPending ? 'Signing...' : 'Fetch account, sign demo SignDoc'}
			</button>

			{prepError && <div className="status-message error">Setup error: {prepError}</div>}

			{isSuccess && data && (
				<div className="status-message success">
					Signed.
					<div>
						<strong>signature length:</strong> <code>{sigBytesLen} bytes</code>
						{isCosmosEvm && sigBytesLen === 64 && <span> ✓ XPLA compact ethsecp256k1</span>}
					</div>
					<details className="signature-details">
						<summary>signature (base64)</summary>
						<code>{data.signature.signature}</code>
					</details>
					<details className="signature-details">
						<summary>pub_key</summary>
						<code>{JSON.stringify(data.signature.pub_key)}</code>
					</details>

					<button
						className="btn btn-secondary"
						onClick={handleSimulate}
						disabled={simState.status === 'loading'}
						style={{ marginTop: '8px' }}
					>
						{simState.status === 'loading' ? 'Simulating...' : 'Simulate against chain LCD'}
					</button>

					{simState.status === 'done' && (
						<div className={simState.ok ? 'status-message success' : 'status-message error'}>
							<div>
								<strong>simulate status:</strong> HTTP {simState.code} {simState.ok ? '✓' : '✗'}
							</div>
							<details className="signature-details">
								<summary>response</summary>
								<code>
									<pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(simState.raw, null, 2)}</pre>
								</code>
							</details>
						</div>
					)}
				</div>
			)}

			{isError && <div className="status-message error">Error: {error?.message}</div>}
		</ActionCard>
	)
}
