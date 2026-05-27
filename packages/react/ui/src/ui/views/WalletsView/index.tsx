import { WalletsViewLogic } from '@trustwallet/connect-ui-logic'
import { WalletButton } from '../../buttons/WalletButton'
import { WalletConnectButton } from '../../buttons/WalletConnectButton'
import { XplaVaultMobileButton } from '../../buttons/XplaVaultMobileButton'
import { GetTrustButton } from '../../buttons/GetTrustButton'
import { WalletsHeader } from './components/WalletsHeader'
import { WalletsGrid } from './components/WalletsGrid'

/**
 * Composite button slot — renders the existing WalletConnect (v2) button and,
 * directly below it, the XPLA Vault Mobile (WC v1) button. The XPLA button is
 * a no-op when the XPLA WC v1 service isn't registered, so non-XPLA dApps see
 * no change.
 */
function WalletConnectStack() {
	return (
		<>
			<WalletConnectButton />
			<XplaVaultMobileButton />
		</>
	)
}

export function WalletsView() {
	return (
		<WalletsViewLogic
			components={{
				emptyState: GetTrustButton,
				header: WalletsHeader,
				grid: WalletsGrid,
				walletButton: WalletButton,
				walletConnectButton: WalletConnectStack,
			}}
		/>
	)
}
