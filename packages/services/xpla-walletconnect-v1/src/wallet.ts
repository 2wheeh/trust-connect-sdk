import { uuid } from '@walletconnect/utils'
import {
	type CaipProvider,
	type CaipSessionResponse,
	type ChainId,
	ConnectionFailedError,
	NoActiveSessionError,
	type NamespaceId,
	UnsupportedMethodError,
	WalletAdapterBase,
	type WalletType,
} from '@trustwallet/connect-core'
import type { CosmosSignDoc } from '@trustwallet/connect-cosmos-types'
import type { XplaWalletConnectV1Service } from './service'
import { caipReferenceForWcChainId } from './chain-map'
import { XPLA_WC1_WALLET } from './constants'
import { SIGN_MODE_DIRECT, decodeDirectSignDoc } from './decode-direct'

const COSMOS_NAMESPACE = 'cosmos' as NamespaceId

interface CachedSession {
	address: string
	/** CAIP-2 reference, e.g. `dimension_37-1`. */
	reference: string
}

interface ProtoPubKey {
	'@type'?: string
	type?: string
	value?: string
	key?: string
}

interface SignDirectParams {
	signerAddress: string
	signDoc: CosmosSignDoc
}

interface XplaSignResult {
	public_key?: string
	signature?: string
	recid?: number
	body?: unknown
	auth_info?: { signer_infos?: Array<{ public_key?: ProtoPubKey }> }
	signatures?: string[]
}

/**
 * Minimal port of cosmos-core's `extractSignatureFromSignFrame`. Duplicated
 * inline to keep this package strictly additive — cosmos-core requires no
 * export-surface change.
 */
function extractSignatureFromSignResult(result: XplaSignResult | undefined): {
	signature: string
	pub_key: { type: string; value: string }
} {
	if (!result) throw new Error('XPLA Vault Mobile: missing sign result')
	if (typeof result.signature === 'string' && typeof result.public_key === 'string') {
		return {
			signature: result.signature,
			pub_key: { type: 'cosmos-evm/PubKeyEthSecp256k1', value: result.public_key },
		}
	}
	if (Array.isArray(result.signatures)) {
		const signature = result.signatures[0]
		if (typeof signature !== 'string') throw new Error('XPLA Vault Mobile: empty signatures[]')
		const pkRaw = result.auth_info?.signer_infos?.[0]?.public_key
		const pub_key = pkRaw
			? typeof pkRaw.type === 'string'
				? { type: pkRaw.type, value: pkRaw.value ?? '' }
				: pkRaw['@type']?.includes('ethsecp256k1')
					? { type: 'cosmos-evm/PubKeyEthSecp256k1', value: pkRaw.key ?? '' }
					: { type: 'tendermint/PubKeySecp256k1', value: pkRaw.key ?? '' }
			: { type: '', value: '' }
		return { signature, pub_key }
	}
	throw new Error('XPLA Vault Mobile: unrecognized sign response shape')
}

/**
 * CAIP wallet adapter that proxies cosmos requests over WC v1 to XPLA Vault
 * Mobile. Connection lifecycle mirrors XPLA wallet-controller's reference
 * implementation (uuid-based clientId pre-assignment + transport with
 * `subscriptions: [clientId]`).
 */
export class XplaWcV1WalletAdapter extends WalletAdapterBase<'caip'> {
	public readonly id: string = XPLA_WC1_WALLET.ID
	public readonly name: string = XPLA_WC1_WALLET.NAME
	public readonly icon: string = XPLA_WC1_WALLET.ICON
	public readonly type: Extract<WalletType, 'caip'> = 'caip'
	public namespaceIds: NamespaceId[] = []

	private session: CachedSession | undefined

	constructor(private readonly options: { service: XplaWalletConnectV1Service }) {
		super()
	}

	protected async connect(): Promise<CaipSessionResponse> {
		// Re-use an existing connected session if the connector already has one
		const existing = this.options.service.getConnector()
		if (existing?.connected) {
			return this.buildSessionResponse(existing.accounts ?? [], Number(existing.chainId ?? 0))
		}

		// XPLA pattern: generate clientId, build connector + transport with
		// `subscriptions: [clientId]`, then assign clientId on the connector
		// BEFORE registering events / opening session.
		const clientId = uuid() as string
		const connector = this.options.service.createConnector(clientId)
		;(connector as unknown as { clientId: string }).clientId = clientId

		// Register all events BEFORE calling createSession so we never miss the
		// first frame from the wallet (XPLA wallet-controller calls initEvents()
		// alongside the fire-and-forget createSession()).
		const resultPromise = new Promise<{ accounts: string[]; chainId: number }>((resolve, reject) => {
			connector.on('connect', (err, payload) => {
				if (err) return reject(err)
				const p = payload?.params?.[0] as { accounts?: string[]; chainId?: number } | undefined
				if (!p?.accounts || p.accounts.length === 0) {
					return reject(new Error('XPLA Vault Mobile: WC v1 connect returned no accounts'))
				}
				resolve({ accounts: p.accounts, chainId: Number(p.chainId ?? 1) })
			})
			connector.on('session_update', (err, payload) => {
				if (err) return reject(err)
				const p = payload?.params?.[0] as { accounts?: string[]; chainId?: number } | undefined
				if (!p?.accounts || p.accounts.length === 0) {
					return reject(new Error('XPLA Vault Mobile: WC v1 session_update returned no accounts'))
				}
				resolve({ accounts: p.accounts, chainId: Number(p.chainId ?? 1) })
			})
			connector.on('disconnect', (err) => {
				if (err) return reject(err)
				reject(new Error('XPLA Vault Mobile: WC v1 session disconnected before approval'))
			})
		})

		// MUST `await` createSession. Internally it does `await _generateKey()`
		// then sets `handshakeTopic = uuid()` — only AFTER awaiting are `_key` and
		// `handshakeTopic` set, so `connector.uri` returns the full
		// `wc:<topic>@1?bridge=...&key=...` URI. Fire-and-forget yields an empty
		// `wc:@1?bridge=...&key=` URI (topic/key blank).
		//
		// XPLA wallet-controller fire-and-forgets only because it passes a
		// `qrcodeModal` whose `open(uri, cb)` is called from inside Connector after
		// the display_uri event fires — bypassing the need to read `connector.uri`
		// directly. We don't pass a qrcodeModal, so we await instead.
		await connector.createSession()
		this.options.service.setUri((connector as unknown as { uri?: string }).uri ?? '')

		const result = await resultPromise
		this.options.service.setUri('')
		return this.buildSessionResponse(result.accounts, result.chainId)
	}

	protected async reconnect(): Promise<CaipSessionResponse | undefined> {
		const connector = this.options.service.getConnector()
		if (!connector?.connected) return undefined
		return this.buildSessionResponse(connector.accounts ?? [], Number(connector.chainId ?? 0))
	}

	protected async disconnect(): Promise<void> {
		const connector = this.options.service.getConnector()
		try {
			if (connector?.connected) await connector.killSession()
		} catch {
			// best effort
		}
		this.session = undefined
		this.namespaceIds = []
		this.options.service.setUri('')
		this.options.service.resetConnector()
	}

	private buildSessionResponse(accounts: string[], chainId: number): CaipSessionResponse {
		const reference = caipReferenceForWcChainId(chainId)
		if (!reference) {
			throw new ConnectionFailedError(this.name, `Unsupported XPLA walletconnectID ${chainId}`)
		}
		const address = accounts[0]
		if (!address) {
			throw new ConnectionFailedError(this.name, 'No account in WC v1 session')
		}
		this.session = { address, reference }
		this.namespaceIds = [COSMOS_NAMESPACE]

		return {
			namespaces: {
				[COSMOS_NAMESPACE]: {
					accounts: [`cosmos:${reference}:${address}` as ChainId],
					chains: [`cosmos:${reference}` as ChainId],
					methods: ['cosmos_signDirect', 'cosmos_getAccounts'],
					events: [],
				},
			},
		}
	}

	public async getProvider(): Promise<CaipProvider> {
		if (!this.session) throw new NoActiveSessionError()
		const connector = this.options.service.getConnector()
		if (!connector) throw new NoActiveSessionError()
		const session = this.session

		return {
			request: async <T = unknown>(args: {
				request: { method: string; params?: unknown }
				chainId: ChainId
			}): Promise<T> => {
				switch (args.request.method) {
					case 'cosmos_signDirect': {
						const params = args.request.params as SignDirectParams
						const { signDoc } = params
						const decoded = await decodeDirectSignDoc(signDoc)
						const result = (await connector.sendCustomRequest({
							method: 'sign',
							params: [
								{
									// `decodeDirectSignDoc` already returns JSON strings in proto-Any /
									// Cosmos_Tx_V1beta1_Fee shape for iOS `Google_Protobuf_Any(jsonString:)`.
									msgs: decoded.msgs,
									fee: decoded.fee,
									memo: decoded.memo,
									sequence: decoded.sequence,
									accountNumber: decoded.accountNumber,
									signMode: SIGN_MODE_DIRECT,
									purgeQueue: true,
								},
							],
						})) as XplaSignResult
						const { signature, pub_key } = extractSignatureFromSignResult(result)
						return {
							signed: signDoc,
							signature: { pub_key, signature },
						} as T
					}
					case 'cosmos_getAccounts': {
						return [
							{
								address: session.address,
								pubkey: new Uint8Array(),
								algo: 'ethsecp256k1',
							},
						] as T
					}
					case 'cosmos_signAmino': {
						throw new UnsupportedMethodError(
							'cosmos_signAmino (XPLA Vault Mobile is direct-only; use cosmos_signDirect)',
							COSMOS_NAMESPACE,
						)
					}
					default:
						throw new UnsupportedMethodError(args.request.method, COSMOS_NAMESPACE)
				}
			},
		}
	}

	protected startListeners(): void {
		// WC v1 emits `disconnect` via `connector.on('disconnect')`; the connect()
		// promise observer already catches it. No additional subscriptions needed.
	}

	protected stopListeners(): void {
		// No subscriptions to clean up beyond `disconnect()`'s killSession + reset.
	}
}
