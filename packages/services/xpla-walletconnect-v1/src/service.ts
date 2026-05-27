import Connector from '@walletconnect/core'
import * as cryptoLib from '@walletconnect/iso-crypto'
import { Emitter, type NamespaceId, ServiceBase, type Scope, type ServiceConstructor } from '@trustwallet/connect-core'
import {
	XPLA_WC1_BRIDGE,
	XPLA_WC1_STORAGE_ID,
	XPLA_WC1_WALLET,
	XPLA_WALLET_SCHEMES,
	buildXplaDeepLink,
	type XplaWalletScheme,
} from './constants'
import { SocketTransport } from './transport/socket-transport'
import { XplaWcV1WalletAdapter } from './wallet'

export interface ClientMeta {
	name: string
	description: string
	url: string
	icons: string[]
}

export interface CreateXplaWalletConnectOptions {
	clientMeta?: Partial<ClientMeta>
	/**
	 * URL scheme of the target XPLA wallet app. Defaults to `'xplavault'`.
	 * Use `'xgameswallet'` for XPLA Games wallet, `'xplayz'` for XPLAYZ, or any
	 * custom string for other XPLA-derived wallets.
	 */
	walletScheme?: XplaWalletScheme
}

/**
 * Service for XPLA Vault Mobile via WalletConnect v1.
 *
 * Mirrors XPLA wallet-controller's exact connection pattern:
 *   - `Connector` from `@walletconnect/core` (NOT the `@walletconnect/client`
 *     wrapper — the wrapper handled subscriptions in a different order and
 *     the XPLA bridge rejects sessions whose subscription frame arrives late).
 *   - Explicit `cryptoLib` from `@walletconnect/iso-crypto`.
 *   - Custom `SocketTransport` with `subscriptions: [clientId]` so the
 *     transport pre-subscribes to our clientId topic from the very first
 *     open, ensuring wallet → dApp messages reach us.
 *
 * Connector instantiation is deferred to `createConnector()` so the wallet
 * adapter can set `clientId` before the first transport open.
 */
export class XplaWalletConnectV1Service extends ServiceBase {
	public readonly id: string = XPLA_WC1_WALLET.ID
	public caipWallet: XplaWcV1WalletAdapter

	private uri: string | undefined
	private wcEvents = new Emitter<{ uri: string | undefined }>()
	private connectorInstance: Connector | undefined

	constructor(
		public readonly scopes: Map<NamespaceId, Scope>,
		public readonly clientMeta: ClientMeta,
		public readonly walletScheme: XplaWalletScheme,
	) {
		super()
		this.caipWallet = new XplaWcV1WalletAdapter({ service: this })
	}

	/**
	 * Build a fresh `Connector` with `clientId` pre-subscribed at the transport
	 * layer. Caller must assign `connector.clientId = clientId` immediately
	 * after to keep the connector and transport in sync.
	 */
	createConnector(clientId: string): Connector {
		const connectorOpts = {
			bridge: XPLA_WC1_BRIDGE,
			clientMeta: this.clientMeta,
			storageId: XPLA_WC1_STORAGE_ID,
		}
		const draftConnector = new Connector({
			connectorOpts,
			cryptoLib,
			transport: new SocketTransport({
				protocol: 'wc',
				version: 1,
				url: XPLA_WC1_BRIDGE,
				subscriptions: [clientId],
			}),
		})
		// HOTFIX for @walletconnect/core@1.6.6 line:
		//   this._clientMeta = getClientMeta() || opts.connectorOpts.clientMeta || null
		// `getClientMeta()` auto-detects from `document.title` / favicon /
		// `location.origin` and TAKES PRECEDENCE over the value we pass in
		// `connectorOpts.clientMeta`. The setter is a no-op, so we have to overwrite
		// the private `_clientMeta` field directly. Without this, the wallet
		// receives the dApp's window metadata (e.g. localhost:5173, Vite default
		// title) instead of the explicit peerMeta the caller configured — and
		// XPLA Vault rejects sessions that don't match its expected origin.
		;(draftConnector as unknown as { _clientMeta: ClientMeta })._clientMeta = this.clientMeta
		this.connectorInstance = draftConnector
		return draftConnector
	}

	/** Existing connector (post-construct). Returns undefined before `createConnector()`. */
	getConnector(): Connector | undefined {
		return this.connectorInstance
	}

	resetConnector(): void {
		this.connectorInstance = undefined
	}

	getCaipWallet(): XplaWcV1WalletAdapter {
		return this.caipWallet
	}

	getUri(): string | undefined {
		return this.uri
	}

	setUri(uri: string | undefined): void {
		// Wrap bare `wc:` URI in XPLA's deep-link format so the QR scanner /
		// camera dispatches directly to the target wallet app. Empty/undefined
		// passes through unchanged so consumers can clear the URI.
		this.uri = uri && uri.startsWith('wc:') ? buildXplaDeepLink(this.walletScheme, uri) : uri
		this.wcEvents.emit('uri', this.uri)
	}

	onUri(cb: (uri: string | undefined) => void): () => void {
		return this.wcEvents.on('uri', cb)
	}
}

/** Factory matching the `ServiceConstructor` contract used by `TrustConnectProvider({ services })`. */
export function createXplaWalletConnect(opts: CreateXplaWalletConnectOptions = {}): ServiceConstructor {
	const clientMeta: ClientMeta = {
		name: opts.clientMeta?.name ?? 'TrustConnect',
		description: opts.clientMeta?.description ?? 'XPLA Vault Mobile via WalletConnect v1',
		url: opts.clientMeta?.url ?? (typeof location !== 'undefined' ? location.origin : ''),
		icons: opts.clientMeta?.icons ?? [],
	}
	const walletScheme = opts.walletScheme ?? XPLA_WALLET_SCHEMES.XPLA_VAULT
	return {
		__createService: ({ scopes }) => new XplaWalletConnectV1Service(scopes, clientMeta, walletScheme),
	}
}
