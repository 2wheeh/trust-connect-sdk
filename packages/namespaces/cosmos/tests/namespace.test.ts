import { describe, it, expect } from 'vitest'
import { createCosmos } from '../src/namespace'
import { XPLA_MAINNET, FETCHHUB_MAINNET, XPLA_TESTNET, FETCHHUB_TESTNET } from '../src/chains'
import { COSMOS_SCOPE } from '../src/constants'

describe('createCosmos', () => {
	it('throws MissingChainError when chains is empty', () => {
		expect(() => createCosmos({ chains: [] })).toThrow(/No chain provided for cosmos/)
	})

	it('returns a NamespaceConstructor with both chains in scope.CHAINS', () => {
		const constructor = createCosmos({ chains: [XPLA_MAINNET, FETCHHUB_MAINNET] })
		const { namespace, scope } = constructor.__createNamespace()

		expect(scope.ID).toBe(COSMOS_SCOPE.ID)
		expect(scope.NAME).toBe(COSMOS_SCOPE.NAME)
		expect(scope.CHAINS).toEqual(['dimension_37-1', 'fetchhub-4'])
		expect(namespace.id).toBe('cosmos')
	})

	it('exposes the configured rpcUrls on the engine', () => {
		const rpcUrls = { 'cosmos:dimension_37-1': ['https://custom-rpc'] }
		const { namespace } = createCosmos({ chains: [XPLA_MAINNET], rpcUrls }).__createNamespace()
		expect(namespace.rpcUrls).toEqual(rpcUrls)
	})
})

describe('XPLA / Fetch.ai chain constants', () => {
	it('XPLA_MAINNET advertises cosmos-evm features (coinType 60 + ethsecp256k1)', () => {
		expect(XPLA_MAINNET.chainId).toBe('dimension_37-1')
		expect(XPLA_MAINNET.bip44.coinType).toBe(60)
		expect(XPLA_MAINNET.features).toContain('eth-address-gen')
		expect(XPLA_MAINNET.features).toContain('eth-key-sign')
		expect(XPLA_MAINNET.bech32Config.bech32PrefixAccAddr).toBe('xpla')
	})

	it('FETCHHUB_MAINNET uses vanilla cosmos config (coinType 118, no eth features)', () => {
		expect(FETCHHUB_MAINNET.chainId).toBe('fetchhub-4')
		expect(FETCHHUB_MAINNET.bip44.coinType).toBe(118)
		expect(FETCHHUB_MAINNET.features).toBeUndefined()
		expect(FETCHHUB_MAINNET.bech32Config.bech32PrefixAccAddr).toBe('fetch')
	})

	it('XPLA_TESTNET (cube) carries the same cosmos-evm features as mainnet', () => {
		expect(XPLA_TESTNET.chainId).toBe('cube_47-5')
		expect(XPLA_TESTNET.bip44.coinType).toBe(60)
		expect(XPLA_TESTNET.features).toContain('eth-key-sign')
		expect(XPLA_TESTNET.bech32Config.bech32PrefixAccAddr).toBe('xpla')
	})

	it('FETCHHUB_TESTNET (dorado) uses atestfet denom and stays vanilla cosmos', () => {
		expect(FETCHHUB_TESTNET.chainId).toBe('dorado-1')
		expect(FETCHHUB_TESTNET.bip44.coinType).toBe(118)
		expect(FETCHHUB_TESTNET.features).toBeUndefined()
		expect(FETCHHUB_TESTNET.currencies[0]?.coinMinimalDenom).toBe('atestfet')
	})
})
