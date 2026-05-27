import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { XplaVaultWallet } from '../src/xpla-vault'
import { CosmosInjectedRegistry } from '../src/registry'
import { XPLA_MAINNET, FETCHHUB_MAINNET, XPLA_TESTNET } from '../src/chains'
import { COSMOS_ICON } from '../src/constants'
import type { XplaVaultBridge } from '../src/xpla-vault-bridge'

const ensureWindow = () => {
	if (typeof globalThis.window === 'undefined') {
		;(globalThis as { window: object }).window = {}
	}
	return globalThis.window as Record<string, unknown>
}

/**
 * Build a fake bridge with controllable connect/sign responses. The XplaVaultWallet
 * receives this through `bridgeFactory`, so we never touch real postMessage.
 */
const makeFakeBridge = (
	overrides: Partial<{
		connectAddress: string
		signFrame: Record<string, unknown>
		signError: Error
	}> = {},
): XplaVaultBridge => {
	const connectAddress = overrides.connectAddress ?? 'xpla1demo'
	const signFrame =
		overrides.signFrame ?? {
			name: 'onSign',
			payload: {
				id: 1,
				success: true,
				result: { public_key: 'PUB_KEY_BASE64', signature: 'SIG_BASE64', recid: 0 },
			},
		}
	const bridge = {
		connect: vi.fn().mockResolvedValue({ address: connectAddress }),
		info: vi.fn(),
		sign: overrides.signError
			? vi.fn().mockRejectedValue(overrides.signError)
			: vi.fn().mockResolvedValue(signFrame),
		destroy: vi.fn(),
	}
	return bridge as unknown as XplaVaultBridge
}

const makeWallet = (
	bridge: XplaVaultBridge,
	chains = [XPLA_MAINNET, FETCHHUB_MAINNET],
): XplaVaultWallet =>
	new XplaVaultWallet({
		id: 'xpla-vault',
		name: 'XPLA Vault',
		icon: COSMOS_ICON,
		chains: chains.filter((c) => c.chainId.startsWith('dimension_') || c.chainId.startsWith('cube_')),
		bridgeFactory: () => bridge,
	})

describe('XplaVaultWallet.connect', () => {
	beforeEach(() => vi.clearAllMocks())

	it('calls bridge.connect and returns bech32 + primary chain', async () => {
		const bridge = makeFakeBridge()
		const wallet = makeWallet(bridge)
		const result = await wallet.__internal.connect()
		expect(bridge.connect).toHaveBeenCalled()
		expect(result.address).toBe('xpla1demo')
		expect(result.chain).toEqual({ namespace: 'cosmos', reference: 'dimension_37-1' })
	})
})

describe('XplaVaultWallet.getProvider — request dispatch', () => {
	beforeEach(() => vi.clearAllMocks())

	it('translates cosmos_signAmino to bridge.sign with JSON-stringified msgs/fee', async () => {
		const bridge = makeFakeBridge()
		const wallet = makeWallet(bridge)
		await wallet.__internal.connect()
		const provider = await wallet.getProvider()

		const signDoc = {
			chain_id: 'dimension_37-1',
			account_number: '7',
			sequence: '3',
			fee: { amount: [{ denom: 'axpla', amount: '0' }], gas: '200000' },
			msgs: [{ type: 'cosmos-sdk/MsgSend', value: { from: 'a', to: 'b' } }],
			memo: 'demo',
		}

		const response = await provider.request({
			chainId: 'cosmos:dimension_37-1',
			request: {
				method: 'cosmos_signAmino',
				params: { signerAddress: 'xpla1demo', signDoc },
			},
		})

		expect(bridge.sign).toHaveBeenCalledWith(
			expect.objectContaining({
				msgs: [JSON.stringify(signDoc.msgs[0])],
				fee: JSON.stringify(signDoc.fee),
				memo: 'demo',
				sequence: 3,
				account_number: 7,
				purgeQueue: true,
			}),
		)
		expect(response.signed).toEqual(signDoc)
		expect(response.signature).toEqual({
			pub_key: { type: 'cosmos-evm/PubKeyEthSecp256k1', value: 'PUB_KEY_BASE64' },
			signature: 'SIG_BASE64',
		})
	})

	it('also accepts the Tx.Data envelope shape', async () => {
		const bridge = makeFakeBridge({
			signFrame: {
				name: 'onSign',
				payload: {
					id: 1,
					success: true,
					result: {
						body: { messages: [], memo: '' },
						auth_info: {
							signer_infos: [
								{
									public_key: { '@type': '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey', key: 'PK_FROM_AUTHINFO' },
								},
							],
							fee: { amount: [], gas_limit: '200000' },
						},
						signatures: ['SIG_FROM_ENVELOPE'],
					},
				},
			},
		})
		const wallet = makeWallet(bridge)
		await wallet.__internal.connect()
		const provider = await wallet.getProvider()

		const response = await provider.request({
			chainId: 'cosmos:dimension_37-1',
			request: {
				method: 'cosmos_signAmino',
				params: {
					signerAddress: 'xpla1demo',
					signDoc: {
						chain_id: 'dimension_37-1',
						account_number: '0',
						sequence: '0',
						fee: { amount: [], gas: '1' },
						msgs: [],
						memo: '',
					},
				},
			},
		})

		expect(response.signature.signature).toBe('SIG_FROM_ENVELOPE')
		expect(response.signature.pub_key.value).toBe('PK_FROM_AUTHINFO')
	})

	it('cosmos_signDirect decodes MsgSend bodyBytes and forwards to bridge.sign with signMode=1', async () => {
		const { TxBody, AuthInfo, Fee } = await import('cosmjs-types/cosmos/tx/v1beta1/tx')
		const { MsgSend } = await import('cosmjs-types/cosmos/bank/v1beta1/tx')

		const msgSend = MsgSend.fromPartial({
			fromAddress: 'xpla1demo',
			toAddress: 'xpla1demo',
			amount: [{ denom: 'axpla', amount: '0' }],
		})
		const txBody = TxBody.fromPartial({
			messages: [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: MsgSend.encode(msgSend).finish() }],
			memo: 'demo',
		})
		const authInfo = AuthInfo.fromPartial({
			signerInfos: [{ sequence: BigInt(3) } as never],
			fee: Fee.fromPartial({ gasLimit: BigInt(200000), amount: [{ denom: 'axpla', amount: '0' }] }),
		})
		const bodyBytes = TxBody.encode(txBody).finish()
		const authInfoBytes = AuthInfo.encode(authInfo).finish()

		const bridge = makeFakeBridge()
		const wallet = makeWallet(bridge)
		await wallet.__internal.connect()
		const provider = await wallet.getProvider()

		const response = await provider.request({
			chainId: 'cosmos:dimension_37-1',
			request: {
				method: 'cosmos_signDirect',
				params: {
					signerAddress: 'xpla1demo',
					signDoc: { bodyBytes, authInfoBytes, chainId: 'dimension_37-1', accountNumber: '7' },
				},
			},
		})

		expect(bridge.sign).toHaveBeenCalledWith(
			expect.objectContaining({
				msgs: [
					JSON.stringify({
						type: 'cosmos-sdk/MsgSend',
						value: {
							from_address: 'xpla1demo',
							to_address: 'xpla1demo',
							amount: [{ denom: 'axpla', amount: '0' }],
						},
					}),
				],
				memo: 'demo',
				sequence: 3,
				account_number: 7,
				signMode: 1,
				purgeQueue: true,
			}),
		)
		expect(response.signature.signature).toBe('SIG_BASE64')
	})

	it('cosmos_signDirect throws for unsupported message typeUrls', async () => {
		const { TxBody, AuthInfo } = await import('cosmjs-types/cosmos/tx/v1beta1/tx')
		const txBody = TxBody.fromPartial({
			messages: [{ typeUrl: '/cosmos.staking.v1beta1.MsgDelegate', value: new Uint8Array() }],
		})
		const authInfo = AuthInfo.fromPartial({ signerInfos: [] })

		const bridge = makeFakeBridge()
		const wallet = makeWallet(bridge)
		await wallet.__internal.connect()
		const provider = await wallet.getProvider()

		await expect(
			provider.request({
				chainId: 'cosmos:dimension_37-1',
				request: {
					method: 'cosmos_signDirect',
					params: {
						signerAddress: 'xpla1demo',
						signDoc: {
							bodyBytes: TxBody.encode(txBody).finish(),
							authInfoBytes: AuthInfo.encode(authInfo).finish(),
							chainId: 'dimension_37-1',
							accountNumber: '0',
						},
					},
				},
			}),
		).rejects.toThrow(/MsgDelegate.*not mapped to amino/)
	})

	it('throws ChainNotSupportedError when targeting Fetch.ai', async () => {
		const bridge = makeFakeBridge()
		const wallet = makeWallet(bridge)
		await wallet.__internal.connect()
		const provider = await wallet.getProvider()

		await expect(
			provider.request({
				chainId: 'cosmos:fetchhub-4',
				request: { method: 'cosmos_getAccounts', params: {} },
			}),
		).rejects.toMatchObject({ name: 'ChainNotSupportedError', code: 'CHAIN_NOT_SUPPORTED' })
	})

	it('cosmos_getAccounts returns the cached address with empty pubkey', async () => {
		const bridge = makeFakeBridge()
		const wallet = makeWallet(bridge)
		await wallet.__internal.connect()
		const provider = await wallet.getProvider()

		const accounts = await provider.request({
			chainId: 'cosmos:dimension_37-1',
			request: { method: 'cosmos_getAccounts', params: {} },
		})
		expect(accounts).toEqual([
			{ address: 'xpla1demo', pubkey: new Uint8Array(), algo: 'ethsecp256k1' },
		])
	})
})

describe('CosmosInjectedRegistry — XPLA Vault detection', () => {
	beforeEach(() => {
		const w = ensureWindow()
		delete w.keplr
		delete w.cosmostation
		delete w.xplaWallets
		delete w.isXplaExtensionAvailable
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('registers XPLA Vault when window.xplaWallets has any entry', () => {
		const w = ensureWindow()
		w.xplaWallets = [
			{ name: 'XPLA Vault Wallet', identifier: 'xplavault', icon: 'https://assets.xpla.io/icon/extension/icon.png' },
		]

		const registry = new CosmosInjectedRegistry({ chains: [XPLA_MAINNET, FETCHHUB_MAINNET] })
		const wallets = registry.getWallets()
		expect(wallets.find((wl) => wl.id === 'xpla-vault')).toBeDefined()
		registry.clearAllListeners()
	})

	it('registers XPLA Vault when only isXplaExtensionAvailable === true', () => {
		const w = ensureWindow()
		w.isXplaExtensionAvailable = true

		const registry = new CosmosInjectedRegistry({ chains: [XPLA_TESTNET] })
		const wallets = registry.getWallets()
		expect(wallets.find((wl) => wl.id === 'xpla-vault')).toBeDefined()
		registry.clearAllListeners()
	})

	it('does NOT register XPLA Vault when config has no XPLA chain', () => {
		const w = ensureWindow()
		w.xplaWallets = [{ name: 'XPLA Vault Wallet', identifier: 'xplavault', icon: '' }]

		const registry = new CosmosInjectedRegistry({ chains: [FETCHHUB_MAINNET] })
		const wallets = registry.getWallets()
		expect(wallets.find((wl) => wl.id === 'xpla-vault')).toBeUndefined()
		registry.clearAllListeners()
	})
})
