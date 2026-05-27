import { describe, it, expect } from 'vitest'
import { caipReferenceForWcChainId, XPLA_WC_CHAIN_IDS } from '../src/chain-map'

describe('XPLA WC v1 chain map', () => {
	it('maps walletconnectID 1 to XPLA mainnet (dimension_37-1)', () => {
		expect(caipReferenceForWcChainId(XPLA_WC_CHAIN_IDS.MAINNET)).toBe('dimension_37-1')
	})

	it('maps walletconnectID 0 to XPLA testnet (cube_47-5)', () => {
		expect(caipReferenceForWcChainId(XPLA_WC_CHAIN_IDS.TESTNET)).toBe('cube_47-5')
	})

	it('returns undefined for unknown chain ids', () => {
		expect(caipReferenceForWcChainId(99)).toBeUndefined()
	})
})
