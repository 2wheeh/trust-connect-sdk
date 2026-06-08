import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Storage } from '@trustwallet/connect-core'
import { TrustConnect } from '@trustwallet/connect-core'
import { createEIP155 } from '@trustwallet/connect-eip155-core'
import { createWalletConnect } from '../src/service'
import type { CoreTypes } from '@walletconnect/types'

// ---------------------------------------------------------------------------
// Assertion (a): no DOM shim leaked in — this file MUST run in node env
// ---------------------------------------------------------------------------
it('runs in Node — window is undefined', () => {
	expect(typeof window).toBe('undefined')
})

// ---------------------------------------------------------------------------
// Mock SignClient so no real relay network is touched.
// The factory MUST be self-contained — vi.mock is hoisted before variable
// declarations, so no outer variables can be referenced inside the factory.
// ---------------------------------------------------------------------------
vi.mock('@walletconnect/sign-client', () => {
	const stub = {
		connect: vi.fn(),
		disconnect: vi.fn(),
		session: { getAll: vi.fn().mockReturnValue([]) },
		proposal: { getAll: vi.fn().mockReturnValue([]) },
		pairing: { getAll: vi.fn().mockReturnValue([]) },
		core: {
			pairing: { getPairings: vi.fn().mockReturnValue([]) },
			expirer: { set: vi.fn() },
		},
		on: vi.fn(),
		off: vi.fn(),
		request: vi.fn(),
	}

	return {
		SignClient: {
			init: vi.fn().mockResolvedValue(stub),
		},
	}
})

// ---------------------------------------------------------------------------
// Minimal IKeyValueStorage stub (async API matching keyvaluestorage-interface)
// ---------------------------------------------------------------------------
function makeStorageStub(): CoreTypes.Options['storage'] {
	const store = new Map<string, unknown>()
	return {
		getKeys: async () => [...store.keys()],
		getEntries: async () => [...store.entries()] as [string, unknown][],
		getItem: async <T>(key: string): Promise<T | undefined> => store.get(key) as T | undefined,
		setItem: async <T>(key: string, value: T): Promise<void> => { store.set(key, value) },
		removeItem: async (key: string): Promise<void> => { store.delete(key) },
	} as CoreTypes.Options['storage']
}

// ---------------------------------------------------------------------------
// Test metadata
// ---------------------------------------------------------------------------
const metadata = {
	name: 'Test App',
	description: 'Headless smoke test',
	url: 'https://example.com',
	icons: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('headless smoke — construct-only, offline', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// Assertion (b): TrustConnect construction does NOT throw in Node
	it('constructs TrustConnect without throwing in plain Node', () => {
		const storageStub = makeStorageStub()

		expect(() => {
			new TrustConnect({
				namespaces: [
					createEIP155({
						chains: [{ id: 1 }],
						rpcUrls: { 'eip155:1': 'https://cloudflare-eth.com' },
					}),
				],
				services: [
					createWalletConnect({
						projectId: 'test',
						metadata,
						storage: storageStub,
						logger: 'silent',
					}),
				],
			})
		}).not.toThrow()
	})

	// Assertion (c): SignClient.init receives storage and logger forwarded
	it('forwards storage and logger to SignClient.init', async () => {
		// Import the mocked module to access the spy
		const { SignClient } = await import('@walletconnect/sign-client')
		const storageStub = makeStorageStub()

		new TrustConnect({
			namespaces: [
				createEIP155({
					chains: [{ id: 1 }],
					rpcUrls: { 'eip155:1': 'https://cloudflare-eth.com' },
				}),
			],
			services: [
				createWalletConnect({
					projectId: 'test-project-id',
					metadata,
					storage: storageStub,
					logger: 'silent',
				}),
			],
		})

		// SignClient.init is triggered eagerly inside getSignClientPromise() during
		// __createService() which runs synchronously in the TrustConnect constructor.
		// Flush microtasks so the async init promise body executes.
		await vi.waitFor(() => expect(SignClient.init).toHaveBeenCalledOnce())

		const initArgs = (SignClient.init as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(initArgs.storage).toBe(storageStub)
		expect(initArgs.logger).toBe('silent')
	})

	// Assertion (d): core Storage no-ops without a backend, round-trips with an injected one
	it('Storage no-ops without a backend, round-trips with an injected backend', () => {
		// Plain Node, no window and no injected backend: writes are dropped, reads are null.
		const bare = new Storage({ key: 'bare', version: '1.0.0' })
		bare.set('dropped')
		expect(bare.get()).toBeNull()

		// Injected sync backend (e.g. an fs-backed one in a real consumer): round-trips.
		const map = new Map<string, string>()
		const backend = {
			getItem: (k: string) => map.get(k) ?? null,
			setItem: (k: string, v: string) => {
				map.set(k, v)
			},
			removeItem: (k: string) => {
				map.delete(k)
			},
		}
		const s = new Storage({ key: 'test-key', version: '1.0.0', backend })

		s.set('hello-node')
		expect(s.get()).toEqual('hello-node')

		s.set({ foo: 42 })
		expect(s.get()).toEqual({ foo: 42 })

		s.remove()
		expect(s.get()).toBeNull()
	})

	// Assertion (e): TrustConnect accepts a `storage` backend and threads it without throwing
	it('accepts a core storage backend injection', () => {
		const map = new Map<string, string>()
		const backend = {
			getItem: (k: string) => map.get(k) ?? null,
			setItem: (k: string, v: string) => {
				map.set(k, v)
			},
			removeItem: (k: string) => {
				map.delete(k)
			},
		}

		expect(() => {
			new TrustConnect({
				namespaces: [
					createEIP155({
						chains: [{ id: 1 }],
						rpcUrls: { 'eip155:1': 'https://cloudflare-eth.com' },
					}),
				],
				services: [
					createWalletConnect({
						projectId: 'test',
						metadata,
						storage: makeStorageStub(),
						logger: 'silent',
					}),
				],
				storage: backend,
			})
		}).not.toThrow()
	})
})
