import { RegistryBase } from '@trustwallet/connect-core'
import { EIP155Wallet } from './wallet'
import { EIP6963AnnounceProviderEvent } from './types/config'

export class EIP155Registry extends RegistryBase {
	protected wallets: EIP155Wallet[] = []

	constructor() {
		super()
		this.start()
	}
	onAnnouncement = (event: EIP6963AnnounceProviderEvent) => {
		const existingWallet = this.wallets.find((wallet) => wallet.id === event.detail.info.rdns)
		if (existingWallet) return

		const newWallet = new EIP155Wallet(event.detail)
		this.setWallets([...this.wallets, newWallet])
	}

	protected start(): Promise<void> | void {
		if (typeof window === 'undefined') return
		window.addEventListener('eip6963:announceProvider', this.onAnnouncement.bind(this))
		window.dispatchEvent(new Event('eip6963:requestProvider'))
	}
	protected stopListeners(): void {
		if (typeof window === 'undefined') return
		window.removeEventListener('eip6963:announceProvider', this.onAnnouncement.bind(this))
	}
}
