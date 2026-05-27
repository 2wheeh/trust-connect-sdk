import { describe, it, expect } from 'vitest'
import { createXplaWalletConnect, XplaWalletConnectV1Service } from '../src/service'
import { XPLA_WC1_WALLET } from '../src/constants'

describe('createXplaWalletConnect', () => {
	it('returns a ServiceConstructor whose service exposes id + caipWallet', () => {
		const ctor = createXplaWalletConnect({ clientMeta: { name: 'TestApp', icons: [] } })
		const service = ctor.__createService({ scopes: new Map() })
		expect(service).toBeInstanceOf(XplaWalletConnectV1Service)
		expect(service.id).toBe(XPLA_WC1_WALLET.ID)
		expect(service.caipWallet).toBeDefined()
		expect(service.caipWallet?.id).toBe(XPLA_WC1_WALLET.ID)
		expect(service.caipWallet?.type).toBe('caip')
	})

	it('exposes a URI emitter (setUri triggers onUri callbacks)', () => {
		const ctor = createXplaWalletConnect({})
		const service = ctor.__createService({ scopes: new Map() }) as XplaWalletConnectV1Service
		const received: Array<string | undefined> = []
		service.onUri((uri) => received.push(uri))
		service.setUri('wc:demo@1?bridge=foo')
		service.setUri(undefined)
		expect(received).toEqual(['wc:demo@1?bridge=foo', undefined])
	})

	it('defaults clientMeta fields when unspecified', () => {
		const ctor = createXplaWalletConnect()
		const service = ctor.__createService({ scopes: new Map() }) as XplaWalletConnectV1Service
		expect(service.clientMeta.name).toBe('TrustConnect')
		expect(service.clientMeta.description).toMatch(/XPLA Vault Mobile/)
		expect(service.clientMeta.icons).toEqual([])
	})
})
