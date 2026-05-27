import { RegistryBase, WalletAdapterBase } from '@trustwallet/connect-core'
import type { ChainInfo, KeplrLikeProvider } from './types/keplr'
import type { XplaWalletExtensionInfo } from './types/xpla-vault'
import { CosmosKeplrLikeWallet } from './wallet'
import { XplaVaultWallet } from './xpla-vault'
import { COSMOS_ICON } from './constants'

const POLL_INTERVAL_MS = 100
const POLL_MAX_ATTEMPTS = 50

type AnyWindow = typeof globalThis & {
	keplr?: KeplrLikeProvider
	cosmostation?: { providers?: { keplr?: KeplrLikeProvider } }
}

const getKeplrFromWindow = (): KeplrLikeProvider | undefined => {
	if (typeof window === 'undefined') return undefined
	return (window as AnyWindow).keplr
}

const getCosmostationFromWindow = (): KeplrLikeProvider | undefined => {
	if (typeof window === 'undefined') return undefined
	return (window as AnyWindow).cosmostation?.providers?.keplr
}

const getXplaVaultInfo = (): XplaWalletExtensionInfo | undefined => {
	if (typeof window === 'undefined') return undefined
	const list = window.xplaWallets
	if (Array.isArray(list) && list.length > 0) {
		// Prefer the first entry — modern extensions ship a `connector` factory but
		// the production extension (as of 2026) only populates name/icon/identifier
		// and communicates via postMessage. Either shape is acceptable; the adapter
		// uses the postMessage bridge regardless.
		return list[0]
	}
	if (window.isXplaExtensionAvailable === true) {
		return {
			name: 'XPLA Vault',
			identifier: 'xplavault',
			icon: 'https://assets.xpla.io/icon/extension/icon.png',
		}
	}
	return undefined
}

const isXplaChain = (chainId: string): boolean =>
	chainId.startsWith('dimension_') || chainId.startsWith('cube_')

export class CosmosInjectedRegistry extends RegistryBase<WalletAdapterBase> {
	protected wallets: WalletAdapterBase[] = []
	private chains: ChainInfo[]
	private xplaChains: ChainInfo[]
	private pollTimer: ReturnType<typeof setInterval> | undefined
	private attempts = 0

	constructor({ chains }: { chains: ChainInfo[] }) {
		super()
		this.chains = chains
		this.xplaChains = chains.filter((c) => isXplaChain(c.chainId))
		this.start()
	}

	private get maxWallets(): number {
		// Keplr + Cosmostation always candidates (2). XPLA Vault only when XPLA chains are configured (+1).
		return 2 + (this.xplaChains.length > 0 ? 1 : 0)
	}

	protected start(): void {
		// Run one scan synchronously so wallets injected before this point are detected immediately.
		this.scan()

		if (typeof window === 'undefined') return

		this.pollTimer = setInterval(() => {
			this.attempts += 1
			const found = this.scan()
			if (found || this.attempts >= POLL_MAX_ATTEMPTS) {
				this.stopPolling()
			}
		}, POLL_INTERVAL_MS)
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	/** Returns true when every candidate wallet has been registered (poll can stop). */
	private scan(): boolean {
		const next = [...this.wallets]
		let changed = false

		if (!next.find((w) => w.id === 'keplr') && getKeplrFromWindow()) {
			next.push(
				new CosmosKeplrLikeWallet({
					id: 'keplr',
					name: 'Keplr',
					icon: COSMOS_ICON,
					chains: this.chains,
					getProvider: getKeplrFromWindow,
				}),
			)
			changed = true
		}

		if (!next.find((w) => w.id === 'cosmostation') && getCosmostationFromWindow()) {
			next.push(
				new CosmosKeplrLikeWallet({
					id: 'cosmostation',
					name: 'Cosmostation',
					icon: COSMOS_ICON,
					chains: this.chains,
					getProvider: getCosmostationFromWindow,
				}),
			)
			changed = true
		}

		if (this.xplaChains.length > 0 && !next.find((w) => w.id === 'xpla-vault')) {
			const info = getXplaVaultInfo()
			if (info) {
				next.push(
					new XplaVaultWallet({
						id: 'xpla-vault',
						name: info.name ?? 'XPLA Vault',
						icon: info.icon ?? COSMOS_ICON,
						identifier: info.identifier ?? 'xplavault',
						chains: this.xplaChains,
					}),
				)
				changed = true
			}
		}

		if (changed) this.setWallets(next)

		return next.length >= this.maxWallets
	}

	protected stopListeners(): void {
		this.stopPolling()
	}
}
