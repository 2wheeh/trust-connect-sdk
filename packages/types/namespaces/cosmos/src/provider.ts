import type { CosmosChainId } from './chain'
import type {
	CosmosSignDirectMethod,
	CosmosSignDirectParams,
	CosmosSignDirectResponse,
} from './methods/cosmos_signDirect'
import type {
	CosmosSignAminoMethod,
	CosmosSignAminoParams,
	CosmosSignAminoResponse,
} from './methods/cosmos_signAmino'
import type {
	CosmosGetAccountsMethod,
	CosmosGetAccountsParams,
	CosmosGetAccountsResponse,
} from './methods/cosmos_getAccounts'

export type CosmosProvider = {
	request<T extends CosmosRequestArguments>(args: CosmosRequestParams<T>): Promise<CosmosResponse<T>>
}

export interface CosmosRequestParams<A> {
	request: A
	chainId: CosmosChainId
}

export type CosmosRequestArguments =
	| { method: CosmosSignDirectMethod; params: CosmosSignDirectParams }
	| { method: CosmosSignAminoMethod; params: CosmosSignAminoParams }
	| { method: CosmosGetAccountsMethod; params: CosmosGetAccountsParams }

export type CosmosResponse<T extends CosmosRequestArguments = CosmosRequestArguments> = T extends {
	method: CosmosSignDirectMethod
}
	? CosmosSignDirectResponse
	: T extends { method: CosmosSignAminoMethod }
		? CosmosSignAminoResponse
		: T extends { method: CosmosGetAccountsMethod }
			? CosmosGetAccountsResponse
			: never
