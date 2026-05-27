import {
	ChainNotSupportedError,
	ConnectionFailedError,
	ConnectedChain,
	NamespaceId,
	UnsupportedMethodError,
	WalletAdapterBase,
} from '@trustwallet/connect-core'
import type {
	CosmosAddress,
	CosmosProvider,
	CosmosRequestArguments,
	CosmosRequestParams,
	CosmosResponse,
	CosmosSignAminoParams,
	CosmosSignAminoResponse,
	CosmosSignDirectParams,
	CosmosSignDirectResponse,
} from '@trustwallet/connect-cosmos-types'
import { COSMOS_SCOPE } from './constants'
import type { ChainInfo } from './types/keplr'
import { XplaVaultBridge, extractSignatureFromSignFrame } from './xpla-vault-bridge'
import { SIGN_MODE_DIRECT, decodeDirectSignDoc } from './xpla-vault-direct'

const isXplaChain = (chainId: string): boolean =>
	chainId.startsWith('dimension_') || chainId.startsWith('cube_')

export type XplaVaultWalletInit = {
	id: string
	name: string
	icon: string
	chains: ChainInfo[]
	/** Override for tests; production callers omit this and the adapter constructs its own bridge. */
	bridgeFactory?: (identifier: string) => XplaVaultBridge
	identifier?: string
}

/**
 * Adapter for the XPLA Vault browser extension (legacy postMessage path).
 *
 * The extension does NOT expose a `connector` factory on `window.xplaWallets`;
 * it communicates over `window.postMessage` channels named `xplavault:inpage` /
 * `xplavault:content`. We talk to it via `XplaVaultBridge`, which ports the
 * minimal slice of `@xpla/xpla.js`'s `Extension` class without that dependency.
 *
 * Translation contract — same as the modern path:
 *   - `cosmos_signAmino` (StdSignDoc) → `bridge.sign({ msgs[], fee, memo, ... })`
 *     → extract `{ signature, pub_key }` → return `CosmosSignAminoResponse`.
 *   - `cosmos_signDirect` → `UnsupportedMethodError` (revisit when EVM-msg
 *     plumbing is in scope).
 *   - `cosmos_getAccounts` → returns the address known to the adapter; pubkey
 *     surfaces as an empty `Uint8Array` since the extension only emits it via
 *     sign responses.
 *
 * Non-XPLA chain references → `ChainNotSupportedError`.
 */
export class XplaVaultWallet extends WalletAdapterBase<'namespace', CosmosAddress, CosmosProvider> {
	public id: string
	public namespaceIds: [NamespaceId] = [COSMOS_SCOPE.ID]
	public type: 'namespace' = 'namespace'
	public name: string
	public icon: string

	private chains: ChainInfo[]
	private identifier: string
	private bridgeFactory: (identifier: string) => XplaVaultBridge
	private bridge: XplaVaultBridge | undefined
	private address: string | undefined

	constructor(init: XplaVaultWalletInit) {
		super()
		this.id = init.id
		this.name = init.name
		this.icon = init.icon
		this.chains = init.chains
		this.identifier = init.identifier ?? 'xplavault'
		this.bridgeFactory = init.bridgeFactory ?? ((id) => new XplaVaultBridge(id))
	}

	private get primaryChain(): ChainInfo {
		const [first] = this.chains
		if (!first) throw new ConnectionFailedError(this.name, 'No XPLA chains configured')
		return first
	}

	private assertXplaChain(reference: string): void {
		if (!isXplaChain(reference)) {
			throw new ChainNotSupportedError(
				`cosmos:${reference}`,
				this.chains.map((c) => `cosmos:${c.chainId}`),
			)
		}
	}

	private ensureBridge(): XplaVaultBridge {
		if (!this.bridge) {
			this.bridge = this.bridgeFactory(this.identifier)
		}
		return this.bridge
	}

	public async getProvider(): Promise<CosmosProvider> {
		const bridge = this.ensureBridge()
		const self = this

		return {
			request: async <T extends CosmosRequestArguments>(args: CosmosRequestParams<T>): Promise<CosmosResponse<T>> => {
				const { chainId, request } = args
				const reference = chainId.split(':')[1] ?? ''
				self.assertXplaChain(reference)

				switch (request.method) {
					case 'cosmos_signAmino': {
						const params = request.params as CosmosSignAminoParams
						const { signDoc } = params
						const frame = await bridge.sign({
							msgs: signDoc.msgs.map((msg) => JSON.stringify(msg)),
							fee: JSON.stringify(signDoc.fee),
							memo: signDoc.memo,
							sequence: Number(signDoc.sequence),
							account_number: Number(signDoc.account_number),
							purgeQueue: true,
						})
						const { signature, pub_key } = extractSignatureFromSignFrame(frame)
						const response: CosmosSignAminoResponse = {
							signed: signDoc,
							signature: { pub_key, signature },
						}
						return response as CosmosResponse<T>
					}
					case 'cosmos_signDirect': {
						/**
						 * Best-effort direct sign via XPLA Vault.
						 *
						 * XPLA Vault's legacy postMessage API takes amino-style `msgs + fee`, not raw
						 * protobuf bytes. We decode the dApp's `bodyBytes` / `authInfoBytes`, translate
						 * each message to amino JSON, and forward with `signMode: 1` (DIRECT). The
						 * extension re-encodes internally before signing, so the resulting signature
						 * is over those re-encoded bytes — NOT necessarily over the dApp's input.
						 * We return the dApp's input as `signed.*` (protocol passthrough); for
						 * broadcast, the dApp should be prepared to re-build the tx envelope if the
						 * canonical bytes diverge.
						 */
						const params = request.params as CosmosSignDirectParams
						const { signDoc } = params
						const decoded = await decodeDirectSignDoc(signDoc)
						const frame = await bridge.sign({
							msgs: decoded.msgs.map((msg) => JSON.stringify(msg)),
							fee: JSON.stringify(decoded.fee),
							memo: decoded.memo,
							sequence: decoded.sequence,
							account_number: decoded.accountNumber,
							signMode: SIGN_MODE_DIRECT,
							purgeQueue: true,
						})
						const { signature, pub_key } = extractSignatureFromSignFrame(frame)
						const response: CosmosSignDirectResponse = {
							signed: signDoc,
							signature: { pub_key, signature },
						}
						return response as CosmosResponse<T>
					}
					case 'cosmos_getAccounts': {
						if (!self.address) throw new Error('XPLA Vault: not connected')
						return [
							{
								address: self.address,
								pubkey: new Uint8Array(),
								algo: 'ethsecp256k1',
							},
						] as CosmosResponse<T>
					}
					default:
						throw new UnsupportedMethodError((request as { method: string }).method, COSMOS_SCOPE.ID)
				}
			},
		}
	}

	protected async connect(): Promise<{ address: CosmosAddress | undefined; chain: ConnectedChain | undefined }> {
		const bridge = this.ensureBridge()
		const { address } = await bridge.connect()
		this.address = address
		return {
			address: address as CosmosAddress,
			chain: { namespace: COSMOS_SCOPE.ID, reference: this.primaryChain.chainId },
		}
	}

	protected async reconnect(): Promise<{ address: CosmosAddress | undefined; chain: ConnectedChain | undefined }> {
		try {
			return await this.connect()
		} catch {
			return { address: undefined, chain: undefined }
		}
	}

	protected async disconnect(): Promise<void> {
		this.bridge?.destroy()
		this.bridge = undefined
		this.address = undefined
		this.__internal.setAddress(undefined)
		this.__internal.setChain(undefined)
	}

	protected startListeners(): void {
		// The bridge runs request-response only; no state observer is available
		// over the legacy postMessage protocol, so address changes require a fresh
		// `connect()`. Nothing to attach here.
	}

	protected stopListeners(): void {
		this.bridge?.destroy()
		this.bridge = undefined
	}
}
