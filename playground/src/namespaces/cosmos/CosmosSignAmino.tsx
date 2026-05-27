import { useConnection } from '@trustwallet/connect-react'
import { useSignAmino, type CosmosStdSignDoc } from '@trustwallet/connect-cosmos-react'
import { ActionCard } from '../../components/ActionCard'

/**
 * Builds a minimal amino StdSignDoc for a zero-amount `MsgSend` self-transfer.
 * Pure JSON — no protobuf encoding needed, so this demo works without CosmJS.
 *
 * NOTE: this is a *signable* doc but the resulting tx would not broadcast
 * (sequence/account_number/fees are placeholders). The point is to exercise
 * the wallet's amino-sign UX and surface the returned signature.
 */
function buildDemoAminoDoc(address: string, chainId: string, denom: string): CosmosStdSignDoc {
	return {
		chain_id: chainId,
		account_number: '0',
		sequence: '0',
		fee: { amount: [{ denom, amount: '0' }], gas: '200000' },
		msgs: [
			{
				type: 'cosmos-sdk/MsgSend',
				value: {
					from_address: address,
					to_address: address,
					amount: [{ denom, amount: '0' }],
				},
			},
		],
		memo: 'TrustConnect demo',
	}
}

export function CosmosSignAmino() {
	const { isConnected, address, chain } = useConnection({ namespaceId: 'cosmos' })
	const { mutate, data, isPending, isSuccess, isError, error } = useSignAmino()

	const handleSign = () => {
		if (!isConnected || !address || !chain) return
		const reference = String(chain.reference)
		const isFetch = reference.startsWith('fetch') || reference.startsWith('dorado')
		const denom = isFetch ? (reference === 'dorado-1' ? 'atestfet' : 'afet') : 'axpla'
		const signDoc = buildDemoAminoDoc(address, reference, denom)
		mutate({ signerAddress: address, signDoc })
	}

	return (
		<ActionCard
			eyebrow="Signature"
			title="Sign Amino"
			copy="Sign a demo MsgSend (zero-amount self-transfer) with the wallet's amino-JSON path."
		>
			<button className="btn btn-primary" onClick={handleSign} disabled={isPending || !isConnected}>
				{isPending ? 'Signing...' : 'Sign demo MsgSend'}
			</button>

			{isSuccess && data && (
				<div className="status-message success">
					Signed.
					<details className="signature-details">
						<summary>signature</summary>
						<code>{data.signature.signature}</code>
					</details>
					<details className="signature-details">
						<summary>pub_key</summary>
						<code>{JSON.stringify(data.signature.pub_key)}</code>
					</details>
				</div>
			)}

			{isError && <div className="status-message error">Error: {error?.message}</div>}
		</ActionCard>
	)
}
