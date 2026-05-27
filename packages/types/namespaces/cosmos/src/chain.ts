/**
 * CAIP-2 chain id for the cosmos namespace.
 *
 * `cosmos:dimension_37-1` (XPLA mainnet)
 * `cosmos:fetchhub-4`     (Fetch.ai mainnet)
 *
 * Underscores and hyphens are allowed per the relaxed CAIP-2 regex.
 */
export type CosmosChainId = `cosmos:${string}`
