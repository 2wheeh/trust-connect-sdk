import type { ChainInfo } from './types/keplr'

/**
 * XPLA mainnet — a cosmos-evm chain.
 *
 * `coinType: 60` + `features: ['eth-address-gen','eth-key-sign']` tell Keplr to use
 * ethsecp256k1 keys (33-byte compressed pubkey, keccak256 hashing, 20-byte
 * Ethereum-style address). Keplr emits a 64-byte compact signature in this mode;
 * the SDK passes it through untouched.
 */
export const XPLA_MAINNET: ChainInfo = {
	chainId: 'dimension_37-1',
	chainName: 'XPLA',
	rpc: 'https://dimension-rpc.xpla.dev',
	rest: 'https://dimension-lcd.xpla.dev',
	bip44: { coinType: 60 },
	bech32Config: {
		bech32PrefixAccAddr: 'xpla',
		bech32PrefixAccPub: 'xplapub',
		bech32PrefixValAddr: 'xplavaloper',
		bech32PrefixValPub: 'xplavaloperpub',
		bech32PrefixConsAddr: 'xplavalcons',
		bech32PrefixConsPub: 'xplavalconspub',
	},
	currencies: [{ coinDenom: 'XPLA', coinMinimalDenom: 'axpla', coinDecimals: 18 }],
	feeCurrencies: [
		{
			coinDenom: 'XPLA',
			coinMinimalDenom: 'axpla',
			coinDecimals: 18,
			gasPriceStep: { low: 850000000000, average: 1147500000000, high: 1487500000000 },
		},
	],
	stakeCurrency: { coinDenom: 'XPLA', coinMinimalDenom: 'axpla', coinDecimals: 18 },
	features: ['eth-address-gen', 'eth-key-sign'],
}

/**
 * Fetch.ai mainnet — vanilla cosmos SDK (coinType 118, sha256).
 */
export const FETCHHUB_MAINNET: ChainInfo = {
	chainId: 'fetchhub-4',
	chainName: 'Fetch.ai',
	rpc: 'https://rpc-fetchhub.fetch.ai:443',
	rest: 'https://rest-fetchhub.fetch.ai',
	bip44: { coinType: 118 },
	bech32Config: {
		bech32PrefixAccAddr: 'fetch',
		bech32PrefixAccPub: 'fetchpub',
		bech32PrefixValAddr: 'fetchvaloper',
		bech32PrefixValPub: 'fetchvaloperpub',
		bech32PrefixConsAddr: 'fetchvalcons',
		bech32PrefixConsPub: 'fetchvalconspub',
	},
	currencies: [{ coinDenom: 'FET', coinMinimalDenom: 'afet', coinDecimals: 18 }],
	feeCurrencies: [
		{
			coinDenom: 'FET',
			coinMinimalDenom: 'afet',
			coinDecimals: 18,
			gasPriceStep: { low: 0.025, average: 0.025, high: 0.035 },
		},
	],
	stakeCurrency: { coinDenom: 'FET', coinMinimalDenom: 'afet', coinDecimals: 18 },
}

/**
 * XPLA testnet (Cube) — cosmos-evm; same key/sig config as mainnet, different RPC endpoints.
 */
export const XPLA_TESTNET: ChainInfo = {
	chainId: 'cube_47-5',
	chainName: 'XPLA Testnet',
	rpc: 'https://cube-rpc.xpla.dev',
	rest: 'https://cube-lcd.xpla.dev',
	bip44: { coinType: 60 },
	bech32Config: {
		bech32PrefixAccAddr: 'xpla',
		bech32PrefixAccPub: 'xplapub',
		bech32PrefixValAddr: 'xplavaloper',
		bech32PrefixValPub: 'xplavaloperpub',
		bech32PrefixConsAddr: 'xplavalcons',
		bech32PrefixConsPub: 'xplavalconspub',
	},
	currencies: [{ coinDenom: 'XPLA', coinMinimalDenom: 'axpla', coinDecimals: 18 }],
	feeCurrencies: [
		{
			coinDenom: 'XPLA',
			coinMinimalDenom: 'axpla',
			coinDecimals: 18,
			gasPriceStep: { low: 850000000000, average: 1147500000000, high: 1487500000000 },
		},
	],
	stakeCurrency: { coinDenom: 'XPLA', coinMinimalDenom: 'axpla', coinDecimals: 18 },
	features: ['eth-address-gen', 'eth-key-sign'],
}

/**
 * Fetch.ai Dorado testnet — vanilla cosmos SDK; testnet fee denom is `atestfet`.
 */
export const FETCHHUB_TESTNET: ChainInfo = {
	chainId: 'dorado-1',
	chainName: 'Fetch.ai Dorado',
	rpc: 'https://rpc-dorado.fetch.ai:443',
	rest: 'https://rest-dorado.fetch.ai',
	bip44: { coinType: 118 },
	bech32Config: {
		bech32PrefixAccAddr: 'fetch',
		bech32PrefixAccPub: 'fetchpub',
		bech32PrefixValAddr: 'fetchvaloper',
		bech32PrefixValPub: 'fetchvaloperpub',
		bech32PrefixConsAddr: 'fetchvalcons',
		bech32PrefixConsPub: 'fetchvalconspub',
	},
	currencies: [{ coinDenom: 'TESTFET', coinMinimalDenom: 'atestfet', coinDecimals: 18 }],
	feeCurrencies: [
		{
			coinDenom: 'TESTFET',
			coinMinimalDenom: 'atestfet',
			coinDecimals: 18,
			gasPriceStep: { low: 0.025, average: 0.025, high: 0.035 },
		},
	],
	stakeCurrency: { coinDenom: 'TESTFET', coinMinimalDenom: 'atestfet', coinDecimals: 18 },
}
