/**
 * Cosmos bech32-encoded address (e.g. `xpla1...`, `fetch1...`).
 * Stored as the wallet returns it; not branded into prefix-specific subtypes.
 */
export type CosmosAddress = string
