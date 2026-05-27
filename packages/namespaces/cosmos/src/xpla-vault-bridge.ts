/**
 * Minimal port of `@xpla/xpla.js`'s `Extension` class + `PostMessageStream`,
 * stripped to just the message types we need (`connect`, `info`, `sign`).
 *
 * Wire protocol (legacy XPLA Vault extension):
 *   - page → content: `window.postMessage({ target: 'xplavault:content', data: { id, type, ...payload } })`
 *   - content → page: `window.postMessage({ target: 'xplavault:inpage',  data: { name, payload } })`
 *   - SYN/ACK handshake initiates the channel before real frames are accepted.
 *
 * We do NOT depend on `@xpla/xpla.js` / `readable-stream` / `rxjs`. The whole
 * bridge is ~120 LOC of plain DOM + a tiny request-response router.
 *
 * Reference: xpla wallet-provider node_modules/@xpla/xpla.js/dist/extension/index.js
 *            and modules/legacy-extension/createFixedExtension.ts (resolver maps).
 */

type EventName = 'onConnect' | 'onInfo' | 'onSign' | 'onPost'
type SendType = 'connect' | 'info' | 'sign' | 'post'

interface BridgeFrame {
	id?: number
	name?: EventName
	payload?: Record<string, unknown>
	success?: boolean
	result?: Record<string, unknown>
	error?: { code?: number; message?: string; data?: unknown }
	[key: string]: unknown
}

/**
 * Plain page-side half of the duplex. Performs the SYN/ACK handshake then forwards
 * incoming data frames to the registered listeners.
 */
class PageMessageStream {
	private readonly name: string
	private readonly target: string
	private readonly origin: string
	private init = false
	private haveSyn = false
	private queue: unknown[] = []
	private listeners = new Set<(data: BridgeFrame) => void>()
	private readonly onMessage: (event: MessageEvent) => void

	constructor({ name, target }: { name: string; target: string }) {
		this.name = name
		this.target = target
		this.origin = typeof location !== 'undefined' ? location.origin : '*'
		this.onMessage = (event) => this.handle(event)
		if (typeof window !== 'undefined') {
			window.addEventListener('message', this.onMessage, false)
			this.postRaw('SYN')
		}
	}

	private postRaw(data: unknown): void {
		if (typeof window === 'undefined') return
		window.postMessage({ target: this.target, data }, this.origin)
	}

	private handle(event: MessageEvent): void {
		if (this.origin !== '*' && event.origin !== this.origin) return
		if (event.source !== window) return
		const msg = event.data as { target?: string; data?: unknown } | undefined
		if (!msg || typeof msg !== 'object') return
		if (msg.target !== this.name) return
		if (msg.data === undefined || msg.data === null) return

		if (!this.init) {
			if (msg.data === 'SYN') {
				this.haveSyn = true
				this.postRaw('ACK')
			} else if (msg.data === 'ACK') {
				this.init = true
				if (!this.haveSyn) this.postRaw('ACK')
				this.flushQueue()
			}
			return
		}

		const frame = msg.data as BridgeFrame
		for (const listener of this.listeners) listener(frame)
	}

	private flushQueue(): void {
		while (this.queue.length > 0) {
			this.postRaw(this.queue.shift())
		}
	}

	write(data: unknown): void {
		if (!this.init) {
			this.queue.push(data)
			return
		}
		this.postRaw(data)
	}

	on(listener: (data: BridgeFrame) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	destroy(): void {
		if (typeof window === 'undefined') return
		window.removeEventListener('message', this.onMessage, false)
		this.listeners.clear()
	}
}

/**
 * Per-request resolver maps, keyed by the numeric id we attach to outgoing
 * frames. `connect` / `info` have no id, so they share a single FIFO set.
 */
export class XplaVaultBridge {
	private readonly stream: PageMessageStream
	private readonly signResolvers = new Map<
		number,
		{ resolve: (frame: BridgeFrame) => void; reject: (err: Error) => void }
	>()
	private readonly connectResolvers = new Set<{
		resolve: (frame: BridgeFrame) => void
		reject: (err: Error) => void
	}>()
	private readonly infoResolvers = new Set<{
		resolve: (frame: BridgeFrame) => void
		reject: (err: Error) => void
	}>()
	private idCounter = 0

	constructor(identifier = 'xplavault') {
		this.stream = new PageMessageStream({
			name: `${identifier}:inpage`,
			target: `${identifier}:content`,
		})
		this.stream.on((frame) => this.dispatch(frame))
	}

	private dispatch(frame: BridgeFrame): void {
		if (frame.name === 'onConnect') {
			for (const { resolve, reject } of this.connectResolvers) {
				if (frame.error) reject(makeError(frame.error))
				else resolve(frame)
			}
			this.connectResolvers.clear()
			return
		}
		if (frame.name === 'onInfo') {
			for (const { resolve, reject } of this.infoResolvers) {
				if (frame.error) reject(makeError(frame.error))
				else resolve(frame)
			}
			this.infoResolvers.clear()
			return
		}
		if (frame.name === 'onSign' || frame.name === 'onPost') {
			const id = typeof frame.id === 'number' ? frame.id : (frame.payload?.id as number | undefined)
			if (typeof id !== 'number') return
			const resolver = this.signResolvers.get(id)
			if (!resolver) return
			this.signResolvers.delete(id)
			if (frame.error || frame.success === false) {
				resolver.reject(makeError(frame.error))
			} else {
				resolver.resolve(frame)
			}
		}
	}

	private send(type: SendType, data?: Record<string, unknown>): number {
		const id = ++this.idCounter
		this.stream.write({ ...(data ?? {}), id, type })
		return id
	}

	connect(timeoutMs = 60_000): Promise<{ address: string }> {
		return new Promise((resolve, reject) => {
			const entry = {
				resolve: (frame: BridgeFrame) => {
					clearTimeout(timer)
					const addr = (frame.payload as { address?: string } | undefined)?.address
					if (!addr) reject(new Error('XPLA Vault: connect returned no address'))
					else resolve({ address: addr })
				},
				reject: (err: Error) => {
					clearTimeout(timer)
					reject(err)
				},
			}
			this.connectResolvers.add(entry)
			const timer = setTimeout(() => {
				this.connectResolvers.delete(entry)
				reject(new Error('XPLA Vault: connect timed out'))
			}, timeoutMs)
			this.send('connect')
		})
	}

	info(timeoutMs = 10_000): Promise<{ name: string; chainID: string; lcd: string; ecd?: string }> {
		return new Promise((resolve, reject) => {
			const entry = {
				resolve: (frame: BridgeFrame) => {
					clearTimeout(timer)
					resolve((frame.payload ?? {}) as { name: string; chainID: string; lcd: string; ecd?: string })
				},
				reject: (err: Error) => {
					clearTimeout(timer)
					reject(err)
				},
			}
			this.infoResolvers.add(entry)
			const timer = setTimeout(() => {
				this.infoResolvers.delete(entry)
				reject(new Error('XPLA Vault: info timed out'))
			}, timeoutMs)
			this.send('info')
		})
	}

	/**
	 * Send a `sign` request. `payload.msgs` must be an array of JSON-string-encoded
	 * messages and `payload.fee` a JSON-string-encoded fee — both produced by the
	 * caller from the amino StdSignDoc.
	 */
	sign(
		payload: {
			msgs: string[]
			fee?: string
			memo?: string
			gasPrices?: string
			gasAdjustment?: string
			account_number?: number
			sequence?: number
			purgeQueue?: boolean
			waitForConfirmation?: boolean
			/** SignMode value: 1=DIRECT, 127=LEGACY_AMINO_JSON. Older extensions may ignore. */
			signMode?: number
		},
		timeoutMs = 120_000,
	): Promise<BridgeFrame> {
		return new Promise((resolve, reject) => {
			const id = this.send('sign', payload)
			const timer = setTimeout(() => {
				if (this.signResolvers.has(id)) {
					this.signResolvers.delete(id)
					reject(new Error('XPLA Vault: sign timed out'))
				}
			}, timeoutMs)
			this.signResolvers.set(id, {
				resolve: (frame) => {
					clearTimeout(timer)
					resolve(frame)
				},
				reject: (err) => {
					clearTimeout(timer)
					reject(err)
				},
			})
		})
	}

	destroy(): void {
		this.stream.destroy()
		this.signResolvers.clear()
		this.connectResolvers.clear()
		this.infoResolvers.clear()
	}
}

function makeError(error: unknown): Error {
	if (!error) return new Error('XPLA Vault: unknown error')
	if (typeof error === 'string') return new Error(error)
	const e = error as { code?: number; message?: string }
	if (e.code === 1) return new Error('XPLA Vault: user denied the request')
	if (typeof e.message === 'string') return new Error(e.message)
	try {
		return new Error(JSON.stringify(error))
	} catch {
		return new Error(String(error))
	}
}

/**
 * Extract `{ signature, pub_key }` from the legacy sign response.
 *
 * The extension may return either:
 *   (a) `result: { public_key, signature, recid, stdSignMsgData }`  — flat shape
 *   (b) `result: <Tx.Data envelope>`                                 — modern shape
 *
 * We accept both. Pubkey is normalized to amino `{type, value}` form.
 */
export function extractSignatureFromSignFrame(frame: BridgeFrame): {
	signature: string
	pub_key: { type: string; value: string }
} {
	const payload = frame.payload as Record<string, unknown> | undefined
	const result = (payload?.result ?? frame.result) as Record<string, unknown> | undefined
	if (!result) throw new Error('XPLA Vault: missing result in sign response')

	if (typeof result.signature === 'string' && typeof result.public_key === 'string') {
		return {
			signature: result.signature,
			pub_key: { type: 'cosmos-evm/PubKeyEthSecp256k1', value: result.public_key },
		}
	}

	if (Array.isArray(result.signatures)) {
		const signature = result.signatures[0] as string | undefined
		if (typeof signature !== 'string') throw new Error('XPLA Vault: empty signatures[]')

		const authInfo = result.auth_info as
			| { signer_infos?: Array<{ public_key?: { '@type'?: string; key?: string; type?: string; value?: string } }> }
			| undefined
		const pkRaw = authInfo?.signer_infos?.[0]?.public_key
		const pub_key = pkRaw
			? 'type' in pkRaw && pkRaw.type
				? { type: pkRaw.type, value: pkRaw.value ?? '' }
				: pkRaw['@type'] === '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey' ||
					  pkRaw['@type'] === '/ethermint.crypto.v1.ethsecp256k1.PubKey'
					? { type: 'cosmos-evm/PubKeyEthSecp256k1', value: pkRaw.key ?? '' }
					: { type: 'tendermint/PubKeySecp256k1', value: pkRaw.key ?? '' }
			: { type: '', value: '' }
		return { signature, pub_key }
	}

	throw new Error('XPLA Vault: unrecognized sign response shape')
}
