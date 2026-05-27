import type {
	INetworkMonitor,
	ISocketMessage,
	ISocketTransportOptions,
	ITransportEvent,
	ITransportLib,
} from '@walletconnect/types'
import { appendToQueryString, detectEnv, getLocation, getQueryString, isBrowser } from '@walletconnect/utils'
import { NetworkMonitor } from './network-monitor'

/**
 * Direct port of XPLA wallet-controller's custom `SocketTransport`
 * (`modules/walletconnect/impl/socket-transport/index.ts`).
 *
 * Why we ship our own instead of `@walletconnect/socket-transport@1.x`:
 *   - The default transport defers `subscriptions` until after Connector's
 *     `clientId` setter fires. With our explicit `clientId = uuid()` pre-set
 *     pattern (mirroring XPLA), we want the transport to subscribe to
 *     `[clientId]` immediately on open so any message addressed to us is
 *     received from the first frame.
 *   - XPLA-shipped builds use this exact transport in production against
 *     `walletconnect.xpla.io`; using anything else risks bridge incompat.
 *
 * Note: `const WS = typeof global.WebSocket !== 'undefined' ? global.WebSocket : require('ws')`
 * relies on the dApp's bundler providing `global` as an alias for `globalThis`
 * (vite-plugin-node-polyfills does this when `globals.global = true`).
 */
const WS: typeof WebSocket =
	typeof globalThis !== 'undefined' && (globalThis as { WebSocket?: typeof WebSocket }).WebSocket
		? (globalThis as { WebSocket: typeof WebSocket }).WebSocket
		: window.WebSocket

interface ConcreteWebSocket {
	readyState: number
	close(): void
	send(data: string): void
	onmessage: ((event: MessageEvent) => void) | null
	onopen: (() => void) | null
	onerror: ((event: Event) => void) | null
	onclose: (() => void) | null
}

export class SocketTransport implements ITransportLib {
	private _protocol: string
	private _version: number
	private _url: string
	private _netMonitor: INetworkMonitor | null
	private _socket: ConcreteWebSocket | null
	private _nextSocket: ConcreteWebSocket | null
	private _queue: ISocketMessage[] = []
	private _events: ITransportEvent[] = []
	private _subscriptions: string[] = []

	constructor(private opts: ISocketTransportOptions) {
		this._protocol = opts.protocol
		this._version = opts.version
		this._url = ''
		this._netMonitor = null
		this._socket = null
		this._nextSocket = null
		this._subscriptions = opts.subscriptions || []
		this._netMonitor = opts.netMonitor || new NetworkMonitor()

		if (!opts.url || typeof opts.url !== 'string') {
			throw new Error('Missing or invalid WebSocket url')
		}
		this._url = opts.url

		this._netMonitor.on('online', () => this._socketCreate())
	}

	get readyState(): number {
		return this._socket ? this._socket.readyState : -1
	}
	get connecting(): boolean {
		return this.readyState === 0
	}
	get connected(): boolean {
		return this.readyState === 1
	}
	get closing(): boolean {
		return this.readyState === 2
	}
	get closed(): boolean {
		return this.readyState === 3
	}

	public open = (): void => {
		this._socketCreate()
	}

	public close = (): void => {
		this._socketClose()
	}

	public send = (message: string, topic?: string, silent?: boolean): void => {
		if (!topic || typeof topic !== 'string') {
			throw new Error('Missing or invalid topic field')
		}
		this._socketSend({ topic, type: 'pub', payload: message, silent: !!silent })
	}

	public subscribe = (topic: string): void => {
		this._socketSend({ topic, type: 'sub', payload: '', silent: true })
	}

	public on = (event: string, callback: (payload: unknown) => void): void => {
		this._events.push({ event, callback })
	}

	private _socketCreate = (): void => {
		if (this._nextSocket) return

		const url = getWebSocketUrl(this._url, this._protocol, this._version)
		this._nextSocket = new WS(url) as unknown as ConcreteWebSocket
		if (!this._nextSocket) throw new Error('Failed to create socket')

		this._nextSocket.onmessage = (event: MessageEvent) => this._socketReceive(event)
		this._nextSocket.onopen = () => this._socketOpen()
		this._nextSocket.onerror = (event: Event) => this._socketError(event)
		this._nextSocket.onclose = () => {
			this._nextSocket = null
			setTimeout(this._socketCreate, 500)
		}
	}

	private _socketOpen = (): void => {
		this._socketClose()
		this._socket = this._nextSocket
		this._nextSocket = null
		this._queueSubscriptions()
		this._pushQueue()
	}

	private _socketClose = (): void => {
		if (this._socket) {
			this._socket.onclose = () => {}
			this._socket.close()
		}
	}

	private _socketSend = (socketMessage: ISocketMessage): void => {
		const message = JSON.stringify(socketMessage)
		if (this._socket && this._socket.readyState === 1) {
			this._socket.send(message)
		} else {
			this._setToQueue(socketMessage)
			this._socketCreate()
		}
	}

	private _socketReceive = (event: MessageEvent): void => {
		let socketMessage: ISocketMessage
		try {
			socketMessage = JSON.parse(event.data)
		} catch {
			return
		}

		this._socketSend({ topic: socketMessage.topic, type: 'ack', payload: '', silent: true })

		if (this._socket && this._socket.readyState === 1) {
			const events = this._events.filter((e) => e.event === 'message')
			events.forEach((e) => e.callback(socketMessage))
		}
	}

	private _socketError = (e: Event): void => {
		const events = this._events.filter((event) => event.event === 'error')
		events.forEach((event) => event.callback(e))
	}

	private _queueSubscriptions = (): void => {
		this._subscriptions.forEach((topic) =>
			this._queue.push({ topic, type: 'sub', payload: '', silent: true }),
		)
		this._subscriptions = this.opts.subscriptions || []
	}

	private _setToQueue = (socketMessage: ISocketMessage): void => {
		this._queue.push(socketMessage)
	}

	private _pushQueue = (): void => {
		this._queue.forEach((socketMessage) => this._socketSend(socketMessage))
		this._queue = []
	}
}

function getWebSocketUrl(webUrl: string, protocol: string, version: number): string {
	const url = webUrl.startsWith('https')
		? webUrl.replace('https', 'wss')
		: webUrl.startsWith('http')
			? webUrl.replace('http', 'ws')
			: webUrl
	const splitUrl = url.split('?')
	const params = isBrowser()
		? { protocol, version, env: 'browser', host: getLocation()?.host || '' }
		: { protocol, version, env: detectEnv()?.name || '' }
	const queryString = appendToQueryString(getQueryString(splitUrl[1] || ''), params)
	return splitUrl[0] + '?' + queryString
}
