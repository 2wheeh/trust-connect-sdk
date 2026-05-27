/**
 * Hand-rolled subset of `@xpla/web-extension-interface` consumed by the XPLA Vault
 * adapter. We mirror the connector + states + tx-result shapes so the SDK does not
 * pull in `@xpla/xpla.js` directly.
 *
 * Source of truth (XPLA wallet-provider repo, v0.x):
 *   packages/src/@xpla/web-extension-interface/connector.ts
 *   packages/src/@xpla/web-extension-interface/models/{tx,states,wallet,network}.ts
 *   packages/src/@xpla/wallet-controller/modules/extension-router/multiChannel.ts
 *
 * Cross-extension contract: `Tx.Data` and `Msg.Data` are JSON-only shapes in
 * @xpla/xpla.js, so we represent them as plain objects.
 */

/** Minimal RxJS-compatible subscribable, duck-typed to avoid an `rxjs` dep. */
export interface VaultObserver<T> {
	next: (value: T) => void
	error?: (err: unknown) => void
	complete?: () => void
}
export interface VaultSubscribable<T> {
	subscribe(observer: VaultObserver<T> | ((value: T) => void)): VaultUnsubscribable
}
export interface VaultUnsubscribable {
	unsubscribe(): void
}

/** Result envelope returned by `connector.sign(...)`. */
export type VaultTxResult<TPayload> =
	| { status: 'PROGRESS'; payload?: unknown }
	| { status: 'SUCCEED'; payload: TPayload }
	| { status: 'FAIL'; error: unknown }
	| { status: 'DENIED' }

/** `connector.sign(...)` payload. Mirrors `Tx.Data` from @xpla/xpla.js. */
export interface VaultSignPayload {
	body: {
		messages: Array<{ '@type': string } & Record<string, unknown>>
		memo: string
		timeout_height?: string
	}
	auth_info: {
		signer_infos: Array<{
			public_key?: { '@type': string; key: string } | { type: string; value: string }
			mode_info?: unknown
			sequence?: string
		}>
		fee: { amount: Array<{ denom: string; amount: string }>; gas_limit: string; payer?: string; granter?: string }
	}
	/** Base64-encoded raw signatures, one per signer. */
	signatures: string[]
}

export interface VaultNetworkInfo {
	name: string
	chainID: string
	lcd: string
	ecd: string
	api?: string
	mantle?: string
	walletconnectID: number
}

export interface VaultWalletInfo {
	name: string
	xplaAddress: string
	design: string
}

export type VaultStates =
	| { type: 'initializing' }
	| { type: 'no_available'; isConnectorExists: boolean; isApproved?: boolean }
	| {
			type: 'ready'
			focusedWalletAddress: string | undefined
			wallets: VaultWalletInfo[]
			network: VaultNetworkInfo
	  }

/**
 * Minimal Msg/Fee duck-types we pass to `connector.sign(...)`. The XPLA Vault
 * extension serializes via `.toJSON()` (returns a JSON string), so we only need
 * to expose that method. Any consumer of cosmos-core that targets XPLA Vault
 * keeps providing canonical amino JSON; we wrap each msg in a thin object.
 */
export interface VaultMsg {
	toJSON(): string
}
export interface VaultFee {
	toJSON(): string
}

export interface VaultCreateTxOptions {
	msgs: VaultMsg[]
	fee?: VaultFee
	memo?: string
	gasPrices?: string
	gasAdjustment?: string
	feeDenoms?: string[]
	sequence?: number
	accountNumber?: number
	signMode?: number
}

/**
 * The subset of `XplaWebExtensionConnector` the cosmos namespace uses.
 * `post`/`signBytes`/CW20 helpers are intentionally omitted in v1.2.
 */
export interface XplaVaultConnector {
	open(hostWindow: Window, statesObserver: VaultObserver<VaultStates>): void
	close(): void
	requestApproval(): void
	refetchStates(): void
	sign(xplaAddress: string, tx: VaultCreateTxOptions): VaultSubscribable<VaultTxResult<VaultSignPayload>>
}

/** Entry shape on `window.xplaWallets`. */
export interface XplaWalletExtensionInfo {
	name: string
	identifier: string
	icon: string
	connector?: () => XplaVaultConnector | Promise<XplaVaultConnector>
}

declare global {
	interface Window {
		xplaWallets?: XplaWalletExtensionInfo[]
		isXplaExtensionAvailable?: boolean
	}
}
