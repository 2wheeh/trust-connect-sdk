export interface StorageBackend {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

/**
 * Resolve the backend a Storage instance writes through:
 * 1. an explicitly injected backend (e.g. an fs-backed one in Node),
 * 2. otherwise `window.localStorage` in the browser,
 * 3. otherwise `null` — no durable store available (e.g. plain Node without injection),
 *    in which case the Storage instance is a no-op.
 */
function resolveBackend(injected?: StorageBackend): StorageBackend | null {
	if (injected) return injected
	try {
		if (typeof window !== 'undefined' && window.localStorage) {
			return window.localStorage
		}
	} catch {
		// window.localStorage access may throw in sandboxed environments
	}
	return null
}

export class Storage {
	private key: string
	private backend: StorageBackend | null

	constructor({ key, version, backend }: { key: string; version: string; backend?: StorageBackend }) {
		this.key = `${key}.${version}`
		this.backend = resolveBackend(backend)
	}

	private isAvailable(): boolean {
		return this.backend !== null
	}

	set<T>(value: T): void {
		if (!this.isAvailable()) return

		try {
			const serialized = JSON.stringify(value)
			this.backend!.setItem(this.key, serialized)
		} catch (error) {
			console.warn(`Failed to save to storage [${this.key}]:`, error)
		}
	}

	get<T>(): T | null {
		if (!this.isAvailable()) return null

		try {
			const item = this.backend!.getItem(this.key)
			if (item === null) return null
			return JSON.parse(item) as T
		} catch (error) {
			console.warn(`Failed to load from storage [${this.key}]:`, error)
			return null
		}
	}

	remove(): void {
		if (!this.isAvailable()) return

		try {
			this.backend!.removeItem(this.key)
		} catch (error) {
			console.warn(`Failed to remove from storage [${this.key}]:`, error)
		}
	}
}
