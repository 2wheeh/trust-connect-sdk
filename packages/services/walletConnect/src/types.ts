import { NamespaceId, Scope } from '@trustwallet/connect-core'
import { SignClient } from '@walletconnect/sign-client'
import type { CoreTypes } from '@walletconnect/types'

export type SignClientMetadata = {
	name: string
	description: string
	url: string
	icons: string[]
}

export type SignClientInstance = Awaited<ReturnType<(typeof SignClient)['init']>>

export type WalletConnectOptions = {
	projectId: string
	metadata?: SignClientMetadata
	storage?: CoreTypes.Options['storage']
	logger?: CoreTypes.Options['logger']
}

export type WalletConnectServiceOptions = {
	scopes: Map<NamespaceId, Scope>
	signClientPromise: Promise<SignClientInstance>
} & WalletConnectOptions
