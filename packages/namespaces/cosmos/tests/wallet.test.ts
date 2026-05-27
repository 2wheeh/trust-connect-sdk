import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CosmosKeplrLikeWallet } from '../src/wallet'
import { XPLA_MAINNET, FETCHHUB_MAINNET } from '../src/chains'
import { COSMOS_ICON } from '../src/constants'
import type { KeplrLikeProvider } from '../src/types/keplr'

const xplaKey = {
	name: 'wallet',
	bech32Address: 'xpla1abc',
	address: new Uint8Array([0xab, 0xcd]),
	pubKey: new Uint8Array([1, 2, 3]),
	algo: 'ethsecp256k1' as const,
}

const fetchKey = {
	name: 'wallet',
	bech32Address: 'fetch1xyz',
	address: new Uint8Array([0xfe, 0xed]),
	pubKey: new Uint8Array([4, 5, 6]),
	algo: 'secp256k1' as const,
}

const makeProvider = (overrides: Partial<KeplrLikeProvider> = {}): KeplrLikeProvider => ({
	enable: vi.fn().mockResolvedValue(undefined),
	experimentalSuggestChain: vi.fn().mockResolvedValue(undefined),
	getKey: vi.fn().mockImplementation((id: string) => Promise.resolve(id === 'fetchhub-4' ? fetchKey : xplaKey)),
	signDirect: vi.fn(),
	signAmino: vi.fn(),
	...overrides,
})

const makeWallet = (provider: KeplrLikeProvider) =>
	new CosmosKeplrLikeWallet({
		id: 'keplr',
		name: 'Keplr',
		icon: COSMOS_ICON,
		chains: [XPLA_MAINNET, FETCHHUB_MAINNET],
		getProvider: () => provider,
	})

describe('CosmosKeplrLikeWallet.connect', () => {
	beforeEach(() => vi.clearAllMocks())

	it('happy path: enable succeeds → returns bech32 + chain', async () => {
		const provider = makeProvider()
		const wallet = makeWallet(provider)

		const result = await wallet.__internal.connect()

		expect(provider.enable).toHaveBeenCalledWith(['dimension_37-1', 'fetchhub-4'])
		expect(provider.experimentalSuggestChain).not.toHaveBeenCalled()
		expect(provider.getKey).toHaveBeenCalledWith('dimension_37-1')
		expect(result.address).toBe('xpla1abc')
		expect(result.chain).toEqual({ namespace: 'cosmos', reference: 'dimension_37-1' })
	})

	it('falls back to experimentalSuggestChain when enable rejects', async () => {
		const provider = makeProvider({
			enable: vi
				.fn()
				.mockRejectedValueOnce(new Error('chain not registered'))
				.mockResolvedValueOnce(undefined),
		})
		const wallet = makeWallet(provider)

		await wallet.__internal.connect()

		expect(provider.experimentalSuggestChain).toHaveBeenCalledTimes(2)
		expect(provider.enable).toHaveBeenCalledTimes(2)
	})

	it('surfaces ChainNotSupportedError when a cosmos-evm chain is rejected (e.g. Cosmostation + XPLA)', async () => {
		const provider = makeProvider({
			enable: vi.fn().mockRejectedValue(new Error('chain not registered')),
			experimentalSuggestChain: vi
				.fn()
				.mockImplementationOnce(() => Promise.reject(new Error('unsupported chain'))),
		})
		const wallet = makeWallet(provider)

		await expect(wallet.__internal.connect()).rejects.toMatchObject({
			name: 'ChainNotSupportedError',
			code: 'CHAIN_NOT_SUPPORTED',
		})
	})
})

describe('CosmosKeplrLikeWallet.getProvider — request dispatch', () => {
	beforeEach(() => vi.clearAllMocks())

	it('dispatches cosmos_signDirect, converting accountNumber string ↔ bigint', async () => {
		const directResponse = {
			signed: {
				bodyBytes: new Uint8Array([10]),
				authInfoBytes: new Uint8Array([20]),
				chainId: 'dimension_37-1',
				accountNumber: BigInt(7),
			},
			signature: { pub_key: { type: 'eth', value: 'AAA' }, signature: 'BBB' },
		}
		const provider = makeProvider({ signDirect: vi.fn().mockResolvedValue(directResponse) })
		const wallet = makeWallet(provider)
		const cosmosProvider = await wallet.getProvider()

		const result = await cosmosProvider.request({
			chainId: 'cosmos:dimension_37-1',
			request: {
				method: 'cosmos_signDirect',
				params: {
					signerAddress: 'xpla1abc',
					signDoc: {
						bodyBytes: new Uint8Array([10]),
						authInfoBytes: new Uint8Array([20]),
						chainId: 'dimension_37-1',
						accountNumber: '7',
					},
				},
			},
		})

		// SDK converts the SignDoc accountNumber string to bigint when calling Keplr.
		expect(provider.signDirect).toHaveBeenCalledWith(
			'dimension_37-1',
			'xpla1abc',
			expect.objectContaining({ accountNumber: BigInt(7) }),
		)
		// Response is converted back: bigint → string.
		expect(result.signed.accountNumber).toBe('7')
		// XPLA signature is passed through unmodified.
		expect(result.signature).toEqual(directResponse.signature)
	})

	it('dispatches cosmos_signAmino without transformation', async () => {
		const aminoResponse = {
			signed: {
				chain_id: 'fetchhub-4',
				account_number: '0',
				sequence: '0',
				fee: { amount: [], gas: '1' },
				msgs: [],
				memo: '',
			},
			signature: { pub_key: { type: 't', value: 'v' }, signature: 's' },
		}
		const provider = makeProvider({ signAmino: vi.fn().mockResolvedValue(aminoResponse) })
		const wallet = makeWallet(provider)
		const cosmosProvider = await wallet.getProvider()

		const result = await cosmosProvider.request({
			chainId: 'cosmos:fetchhub-4',
			request: {
				method: 'cosmos_signAmino',
				params: {
					signerAddress: 'fetch1xyz',
					signDoc: aminoResponse.signed,
				},
			},
		})

		expect(provider.signAmino).toHaveBeenCalledWith('fetchhub-4', 'fetch1xyz', aminoResponse.signed)
		expect(result).toEqual(aminoResponse)
	})

	it('dispatches cosmos_getAccounts and wraps the response as a single-account array', async () => {
		const provider = makeProvider()
		const wallet = makeWallet(provider)
		const cosmosProvider = await wallet.getProvider()

		const result = await cosmosProvider.request({
			chainId: 'cosmos:dimension_37-1',
			request: { method: 'cosmos_getAccounts', params: {} },
		})

		expect(result).toEqual([{ address: 'xpla1abc', pubkey: xplaKey.pubKey, algo: 'ethsecp256k1' }])
	})

	it('throws UnsupportedMethodError for unknown methods', async () => {
		const provider = makeProvider()
		const wallet = makeWallet(provider)
		const cosmosProvider = await wallet.getProvider()

		await expect(
			cosmosProvider.request({
				chainId: 'cosmos:dimension_37-1',
				// @ts-expect-error — intentionally invalid
				request: { method: 'cosmos_signFlavored', params: {} },
			}),
		).rejects.toMatchObject({ name: 'UnsupportedMethodError', code: 'UNSUPPORTED_METHOD' })
	})
})
