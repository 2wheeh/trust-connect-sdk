import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CosmosInjectedRegistry } from '../src/registry'
import { XPLA_MAINNET, FETCHHUB_MAINNET } from '../src/chains'

const fakeKeplr = {
	enable: vi.fn(),
	experimentalSuggestChain: vi.fn(),
	getKey: vi.fn(),
	signDirect: vi.fn(),
	signAmino: vi.fn(),
}

const ensureWindow = () => {
	if (typeof globalThis.window === 'undefined') {
		;(globalThis as { window: object }).window = {}
	}
	return globalThis.window as Record<string, unknown>
}

describe('CosmosInjectedRegistry', () => {
	beforeEach(() => {
		const w = ensureWindow()
		delete w.keplr
		delete w.cosmostation
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('detects window.keplr injected before construction (synchronous scan)', () => {
		const w = ensureWindow()
		w.keplr = fakeKeplr
		const registry = new CosmosInjectedRegistry({ chains: [XPLA_MAINNET, FETCHHUB_MAINNET] })

		const wallets = registry.getWallets()
		expect(wallets.find((wl) => wl.id === 'keplr')).toBeDefined()
		registry.clearAllListeners()
	})

	it('detects window.cosmostation.providers.keplr injected mid-poll', () => {
		const registry = new CosmosInjectedRegistry({ chains: [XPLA_MAINNET] })
		expect(registry.getWallets()).toHaveLength(0)

		const w = ensureWindow()
		w.cosmostation = { providers: { keplr: fakeKeplr } }

		vi.advanceTimersByTime(150)

		const wallets = registry.getWallets()
		expect(wallets.find((wl) => wl.id === 'cosmostation')).toBeDefined()
		registry.clearAllListeners()
	})

	it('emits wallets through onWallets when a wallet is discovered', () => {
		const cb = vi.fn()
		const registry = new CosmosInjectedRegistry({ chains: [XPLA_MAINNET] })
		registry.onWallets(cb)

		const w = ensureWindow()
		w.keplr = fakeKeplr
		vi.advanceTimersByTime(150)

		expect(cb).toHaveBeenCalled()
		const lastCall = cb.mock.calls[cb.mock.calls.length - 1]?.[0] as Array<{ id: string }>
		expect(lastCall.map((wl) => wl.id)).toContain('keplr')
		registry.clearAllListeners()
	})

	it('stopListeners halts polling', () => {
		const registry = new CosmosInjectedRegistry({ chains: [XPLA_MAINNET] })
		registry.clearAllListeners()

		// After clearAllListeners, late-injected wallets should not be picked up.
		const w = ensureWindow()
		w.keplr = fakeKeplr
		vi.advanceTimersByTime(5000)

		expect(registry.getWallets()).toHaveLength(0)
	})
})
