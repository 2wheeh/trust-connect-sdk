import './App.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createWalletConnect } from '@trustwallet/connect-walletconnect'
// import { mainnet, polygon } from 'viem/chains'
import trustIcon from './assets/trust-icon.svg'
import { ActionsSection } from './components'
// import { Eip155Actions } from './namespaces/eip155'
// import { SolanaActions } from './namespaces/solana'
// import { BIP122Actions } from './namespaces/bip122'
import { CosmosActions } from './namespaces/cosmos'
import { ThemeToggle } from './components/ThemeToggle'
// import { createEIP155 } from '@trustwallet/connect-eip155-react'
// import { createBIP122, mainnet as bip122Mainnet } from '@trustwallet/connect-bip122-react'
// import { createSolana, mainnet as solanaMainnet } from '@trustwallet/connect-solana-react'
import { createCosmos, XPLA_TESTNET, FETCHHUB_TESTNET } from '@trustwallet/connect-cosmos-react'
import { createXplaWalletConnect } from '@trustwallet/connect-xpla-walletconnect-v1'
import { TrustConnectProvider, useConnections, useTrustModal, type NamespaceId } from '@trustwallet/connect-react'

const queryClient = new QueryClient()

const projectId = import.meta.env.VITE_WALLETCONNECT_ID

// const eip155 = createEIP155({
// 	chains: [mainnet, polygon],
// 	rpcUrls: { 'eip155:1': ['https://ethereum-rpc.publicnode.com'] },
// })

// const solana = createSolana({
// 	chain: solanaMainnet,
// })

// const bip122 = createBIP122({
// 	chain: bip122Mainnet,
// })

const cosmos = createCosmos({
	chains: [XPLA_TESTNET, FETCHHUB_TESTNET],
})

const walletConnect = createWalletConnect({
	projectId,
	metadata: {
		name: 'Trust Wallet',
		url: 'https://trustwallet.com',
		description: '',
		icons: [],
	},
})

const xplaWcV1 = createXplaWalletConnect({
	clientMeta: {
		name: 'TrustConnect Playground',
		description: 'TrustConnect SDK playground for XPLA Vault Mobile via WalletConnect v1',
		url: 'https://app.dezswap.io',
		icons: ['https://app.dezswap.io/favicon.svg'],
	},
})

function App() {
	return (
		<TrustConnectProvider
			config={{
				// namespaces: [eip155, solana, bip122, cosmos],
				namespaces: [cosmos],
				services: [walletConnect, xplaWcV1],
			}}
			// Optional: Set default theme ('light', 'dark', or 'auto')
			// theme="dark"
		>
			<QueryClientProvider client={queryClient}>
				<TrustDemo />
			</QueryClientProvider>
		</TrustConnectProvider>
	)
}

type NamespaceView = {
	id: NamespaceId
	title: string
	description: string
	chains: string[]
	// accent: 'evm' | 'solana' | 'bitcoin' | 'cosmos'
	accent: 'cosmos'
	renderActions?: () => React.JSX.Element
}

const namespaceViews: NamespaceView[] = [
	// {
	// 	id: 'eip155',
	// 	title: 'EVM (EIP-155)',
	// 	description: 'Sign messages and switch networks for Ethereum-compatible chains.',
	// 	chains: ['Mainnet', 'Polygon'],
	// 	accent: 'evm',
	// 	renderActions: () => <Eip155Actions />,
	// },
	// {
	// 	id: 'solana',
	// 	title: 'Solana',
	// 	description: 'Wallet Standard + CAIP session tracking for Solana dapps.',
	// 	chains: ['Mainnet'],
	// 	accent: 'solana',
	// 	renderActions: () => <SolanaActions />,
	// },
	// {
	// 	id: 'bip122',
	// 	title: 'Bitcoin',
	// 	description: 'Sign messages and transactions with Bitcoin wallets.',
	// 	chains: ['Mainnet'],
	// 	accent: 'bitcoin',
	// 	renderActions: () => <BIP122Actions />,
	// },
	{
		id: 'cosmos',
		title: 'Cosmos (XPLA Cube + Fetch.ai Dorado)',
		description: 'Sign direct/amino with Keplr or Cosmostation on cosmos-SDK testnets.',
		chains: ['XPLA Cube', 'Fetch.ai Dorado'],
		accent: 'cosmos',
		renderActions: () => <CosmosActions />,
	},
]

function TrustDemo() {
	const { open } = useTrustModal()

	return (
		<div className="page">
			<div className="orb orb-a" />
			<div className="orb orb-b" />
			<div className="trust-demo">
				<header className="demo-header">
					<div className="eyebrow with-icon">
						<img src={trustIcon} alt="Trust icon" />
						<span>Trust Playground</span>
					</div>
					<h1>TrustConnect SDK</h1>
					<p className="subtitle">Multi-chain wallet connections for EVM, Solana, and Bitcoin</p>
				</header>

				<section className="panel hero-panel">
					<div className="hero-actions">
						<div className="cta-stack">
							<button className="btn btn-primary" onClick={() => open()}>
								Open Trust Modal
							</button>

							<button className="btn btn-secondary" onClick={() => open({ type: 'namespace', namespaceId: 'eip155' })}>
								Open Network
							</button>
						</div>
						<div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: '20px' }}>
							<ThemeToggle variant="icon" />
						</div>
					</div>
				</section>

				<ConnectionStrip namespaces={namespaceViews} />
				<ActionsSection namespaces={namespaceViews} />
			</div>
		</div>
	)
}

function ConnectionStrip({ namespaces }: { namespaces: NamespaceView[] }) {
	const { connections } = useConnections()

	return (
		<section className="panel connection-status-panel">
			<div className="panel-header">
				<div>
					<p className="eyebrow">Live state</p>
					<h2>Namespace connections</h2>
					<p className="panel-copy">Track which wallets are connected and jump back into the modal if needed.</p>
				</div>
			</div>
			<div className="connection-status-grid">
				{namespaces.map((ns) => {
					const connection = connections[ns.id]
					const status = connection?.status ?? 'disconnected'
					return (
						<div key={ns.id} className="connection-status-card" data-accent={ns.accent}>
							<div className="connection-status-header">
								<h3 className="connection-status-title">{ns.title}</h3>
								<span className={`status-badge status-${status}`}>{status}</span>
							</div>
							<div className="connection-status-details">
								<div className="connection-status-row">
									<span className="connection-status-label">Wallet</span>
									<span className="connection-status-value">{connection?.wallet?.name ?? 'None'}</span>
								</div>
								<div className="connection-status-row">
									<span className="connection-status-label">Address</span>
									<span className="connection-status-value address">{connection?.address ?? '—'}</span>
								</div>
								<div className="connection-status-row">
									<span className="connection-status-label">Chain</span>
									<span className="connection-status-value pill pill-soft">{connection?.chain?.reference ?? '—'}</span>
								</div>
							</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}

export default App
