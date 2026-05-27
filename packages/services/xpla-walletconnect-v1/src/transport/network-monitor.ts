import type { INetworkEventEmitter, INetworkMonitor, NetworkEvent } from '@walletconnect/types'

/**
 * Browser-only `NetworkMonitor` — direct port of XPLA wallet-controller's
 * `modules/walletconnect/impl/socket-transport/network.ts`. Listens for
 * `online` / `offline` events on the global `window` and re-broadcasts to
 * subscribers.
 */
export class NetworkMonitor implements INetworkMonitor {
	private _eventEmitters: INetworkEventEmitter[]

	constructor() {
		this._eventEmitters = []
		if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
			window.addEventListener('online', () => this.trigger('online'))
			window.addEventListener('offline', () => this.trigger('offline'))
		}
	}

	public on(event: NetworkEvent, callback: () => void): void {
		this._eventEmitters.push({ event, callback })
	}

	public trigger(event: NetworkEvent): void {
		const emitters = event ? this._eventEmitters.filter((e) => e.event === event) : []
		emitters.forEach((e) => e.callback())
	}
}
