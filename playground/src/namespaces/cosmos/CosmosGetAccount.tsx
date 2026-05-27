import { useConnection } from '@trustwallet/connect-react'
import { useGetAccount } from '@trustwallet/connect-cosmos-react'
import { ActionCard } from '../../components/ActionCard'

function toBase64(bytes: Uint8Array): string {
	let binary = ''
	for (const b of bytes) binary += String.fromCharCode(b)
	return btoa(binary)
}

export function CosmosGetAccount() {
	const { isConnected, chain } = useConnection({ namespaceId: 'cosmos' })
	const { mutate, data: account, isPending, isSuccess, isError, error } = useGetAccount()

	const handleClick = () => {
		if (!isConnected) return
		mutate(undefined)
	}

	return (
		<ActionCard
			eyebrow="Account"
			title="Get Account"
			copy="Read the connected account info (address, algo, pubkey) from the wallet."
		>
			<button className="btn btn-primary" onClick={handleClick} disabled={isPending || !isConnected}>
				{isPending ? 'Loading...' : `Get account on ${chain?.reference ?? 'cosmos'}`}
			</button>

			{isSuccess && account && (
				<div className="status-message success">
					<div>
						<strong>Address:</strong> <code>{account.address}</code>
					</div>
					<div>
						<strong>Algo:</strong> <code>{account.algo}</code>
					</div>
					<details className="signature-details">
						<summary>Pubkey (base64)</summary>
						<code>{account.pubkey.length > 0 ? toBase64(account.pubkey) : '(not exposed by this wallet)'}</code>
					</details>
				</div>
			)}

			{isError && <div className="status-message error">Error: {error?.message}</div>}
		</ActionCard>
	)
}
