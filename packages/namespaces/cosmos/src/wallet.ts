import {
	ConnectedChain,
	NamespaceId,
	WalletAdapterBase,
	UnsupportedMethodError,
	ConnectionFailedError,
	ChainNotSupportedError,
} from '@trustwallet/connect-core'
import type {
	CosmosProvider,
	CosmosRequestArguments,
	CosmosRequestParams,
	CosmosResponse,
	CosmosAddress,
	CosmosChainId,
} from '@trustwallet/connect-cosmos-types'
import type { ChainInfo, KeplrLikeProvider } from './types/keplr'
import { fromKeplrDirectResponse, toKeplrSignDoc } from './types/keplr'
import { COSMOS_SCOPE } from './constants'

const KEYSTORE_CHANGE_EVENT = COSMOS_SCOPE.EVENTS.KEYSTORE_CHANGE

export type CosmosKeplrLikeWalletInit = {
	id: string
	name: string
	icon: string
	chains: ChainInfo[]
	/** Lazy accessor — re-reads the global on each call so we tolerate late injection. */
	getProvider: () => KeplrLikeProvider | undefined
}

export class CosmosKeplrLikeWallet extends WalletAdapterBase<'namespace', CosmosAddress, CosmosProvider> {
	public id: string
	public namespaceIds: [NamespaceId] = [COSMOS_SCOPE.ID]
	public type: 'namespace' = 'namespace'
	public name: string
	public icon: string

	private chains: ChainInfo[]
	private resolveProvider: () => KeplrLikeProvider | undefined
	private onKeystoreChange: (() => void) | undefined

	constructor(init: CosmosKeplrLikeWalletInit) {
		super()
		this.id = init.id
		this.name = init.name
		this.icon = init.icon
		this.chains = init.chains
		this.resolveProvider = init.getProvider
	}

	private requireProvider(): KeplrLikeProvider {
		const provider = this.resolveProvider()
		if (!provider) throw new ConnectionFailedError(this.name, `${this.name} provider not detected`)
		return provider
	}

	private get primaryChain(): ChainInfo {
		const [first] = this.chains
		if (!first) throw new ConnectionFailedError(this.name, 'No cosmos chains configured')
		return first
	}

	public async getProvider(): Promise<CosmosProvider> {
		const wallet = this.requireProvider()

		return {
			request: async <T extends CosmosRequestArguments>(args: CosmosRequestParams<T>): Promise<CosmosResponse<T>> => {
				const { request, chainId } = args
				const reference = chainId.split(':')[1] ?? ''

				switch (request.method) {
					case 'cosmos_signDirect': {
						const { signerAddress, signDoc } = request.params
						const response = await wallet.signDirect(reference, signerAddress, toKeplrSignDoc(signDoc))
						return fromKeplrDirectResponse(response) as CosmosResponse<T>
					}
					case 'cosmos_signAmino': {
						const { signerAddress, signDoc } = request.params
						const response = await wallet.signAmino(reference, signerAddress, signDoc)
						return response as CosmosResponse<T>
					}
					case 'cosmos_getAccounts': {
						const key = await wallet.getKey(reference)
						const account = {
							address: key.bech32Address,
							pubkey: key.pubKey,
							algo: key.algo,
						}
						return [account] as CosmosResponse<T>
					}
					default:
						throw new UnsupportedMethodError((request as { method: string }).method, COSMOS_SCOPE.ID)
				}
			},
		}
	}

	protected async connect(): Promise<{ address: CosmosAddress | undefined; chain: ConnectedChain | undefined }> {
		const wallet = this.requireProvider()
		const primary = this.primaryChain
		const allRefs = this.chains.map((c) => c.chainId)

		try {
			await wallet.enable(allRefs)
		} catch {
			// Likely "chain not registered" — suggest each chain, then retry.
			for (const chain of this.chains) {
				try {
					await wallet.experimentalSuggestChain(chain)
				} catch (suggestError) {
					// Cosmostation often rejects cosmos-evm chains here.
					if (chain.features?.includes('eth-key-sign')) {
						throw new ChainNotSupportedError(
							`cosmos:${chain.chainId}`,
							this.chains.filter((c) => !c.features?.includes('eth-key-sign')).map((c) => `cosmos:${c.chainId}`),
						)
					}
					throw new ConnectionFailedError(
						this.name,
						suggestError instanceof Error ? suggestError.message : 'experimentalSuggestChain rejected',
					)
				}
			}
			try {
				await wallet.enable(allRefs)
			} catch (enableError) {
				throw new ConnectionFailedError(
					this.name,
					enableError instanceof Error ? enableError.message : 'enable rejected',
				)
			}
		}

		const key = await wallet.getKey(primary.chainId)
		const address = key.bech32Address as CosmosAddress
		const chain: ConnectedChain = { namespace: COSMOS_SCOPE.ID, reference: primary.chainId }
		return { address, chain }
	}

	protected async reconnect(): Promise<{ address: CosmosAddress | undefined; chain: ConnectedChain | undefined }> {
		const wallet = this.resolveProvider()
		if (!wallet) return { address: undefined, chain: undefined }

		try {
			const key = await wallet.getKey(this.primaryChain.chainId)
			return {
				address: key.bech32Address as CosmosAddress,
				chain: { namespace: COSMOS_SCOPE.ID, reference: this.primaryChain.chainId },
			}
		} catch {
			return { address: undefined, chain: undefined }
		}
	}

	protected async disconnect(): Promise<void> {
		const wallet = this.resolveProvider()
		if (wallet?.disable) {
			try {
				await wallet.disable()
			} catch {
				// Best-effort; Keplr's disable() is permissive.
			}
		}
		this.__internal.setAddress(undefined)
		this.__internal.setChain(undefined)
	}

	protected startListeners(): void {
		if (typeof window === 'undefined') return
		this.stopListeners()
		this.onKeystoreChange = async () => {
			const wallet = this.resolveProvider()
			if (!wallet) {
				this.__internal.setAddress(undefined)
				return
			}
			try {
				const key = await wallet.getKey(this.primaryChain.chainId)
				this.__internal.setAddress(key.bech32Address as CosmosAddress)
			} catch {
				this.__internal.setAddress(undefined)
			}
		}
		window.addEventListener(KEYSTORE_CHANGE_EVENT, this.onKeystoreChange)
	}

	protected stopListeners(): void {
		if (typeof window === 'undefined' || !this.onKeystoreChange) return
		window.removeEventListener(KEYSTORE_CHANGE_EVENT, this.onKeystoreChange)
		this.onKeystoreChange = undefined
	}

	/** Internal: exposed for the registry to swap chains without recreating the adapter. */
	public _setChains(chains: ChainInfo[]) {
		this.chains = chains
	}

	/** Exposed for tests; returns the cached chains. */
	public _getChains(): ReadonlyArray<ChainInfo> {
		return this.chains
	}

	/** Exposed for tests / introspection. */
	public _getCosmosChainId(): CosmosChainId {
		return `cosmos:${this.primaryChain.chainId}`
	}
}
