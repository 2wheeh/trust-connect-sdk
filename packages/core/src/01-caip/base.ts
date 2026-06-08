import { Storage, type StorageBackend } from '../utils/storage'

const STORAGE_KEY_PREFIX = 'trust-connect.caip'

export abstract class CaipControllerBase {
	private lastConnectedWalletId: Storage

	constructor({ storage }: { storage?: StorageBackend } = {}) {
		this.lastConnectedWalletId = new Storage({
			key: `${STORAGE_KEY_PREFIX}.lastWallet`,
			version: '0.0.0',
			backend: storage,
		})
	}

	// Storage
	protected saveLastConnectedWalletId(walletId: string): void {
		this.lastConnectedWalletId.set(walletId)
	}
	protected getLastConnectedWalletId(): string | null {
		return this.lastConnectedWalletId.get()
	}
	protected clearLastConnectedWalletId(): void {
		this.lastConnectedWalletId.remove()
	}
}
