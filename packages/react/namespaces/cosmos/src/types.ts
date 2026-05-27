import type { UseMutationOptions } from '@tanstack/react-query'
import type {
	CosmosSignDirectParams,
	CosmosSignDirectResponse,
	CosmosSignAminoParams,
	CosmosSignAminoResponse,
	CosmosAccount,
} from '@trustwallet/connect-cosmos-core'

/** Caller-facing param for `useSignDirect` — pin the chain explicitly at call time. */
export type UseSignDirectParams = CosmosSignDirectParams & {
	/** CAIP-2 reference (e.g. `dimension_37-1`). Defaults to the connection's chain. */
	chainReference?: string
}

export type UseSignDirectResult = CosmosSignDirectResponse

export type UseSignDirectOptions = {
	mutationOptions?: Omit<
		UseMutationOptions<UseSignDirectResult, Error, UseSignDirectParams, unknown>,
		'mutationFn' | 'mutationKey'
	>
}

export type UseSignAminoParams = CosmosSignAminoParams & {
	chainReference?: string
}

export type UseSignAminoResult = CosmosSignAminoResponse

export type UseSignAminoOptions = {
	mutationOptions?: Omit<
		UseMutationOptions<UseSignAminoResult, Error, UseSignAminoParams, unknown>,
		'mutationFn' | 'mutationKey'
	>
}

export type UseGetAccountParams = {
	chainReference?: string
}

export type UseGetAccountResult = CosmosAccount

export type UseGetAccountOptions = {
	mutationOptions?: Omit<
		UseMutationOptions<UseGetAccountResult, Error, UseGetAccountParams | undefined, unknown>,
		'mutationFn' | 'mutationKey'
	>
}
