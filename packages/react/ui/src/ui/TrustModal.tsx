import '../styles/global.css'
import { TrustModalLogic } from '@trustwallet/connect-ui-logic'
import { MobileWalletsView } from './views/MobileWalletsView'
import { WalletsView } from './views/WalletsView'
import { NamespaceView } from './views/NamespaceView'
import { QRView } from './views/QRView'
import { XplaQRView } from './views/XplaQRView'
import { ModalOverlay } from './layout/ModalOverlay'
import { ModalWrapper } from './layout/ModalWrapper'
import { ModalHeader } from './layout/ModalHeader'
import { ModalBody } from './layout/ModalBody'
import { ModalError } from './layout/ModalError'

export function TrustModal() {
	return (
		<TrustModalLogic
			layout={{
				overlay: ModalOverlay,
				wrapper: ModalWrapper,
				header: ModalHeader,
				body: ModalBody,
				error: ModalError,
			}}
			views={[
				{ title: 'Connect a wallet', tag: 'wallets', node: WalletsView },
				{ title: 'Select a network', tag: 'networks', node: NamespaceView },
				{ title: 'Scan with mobile wallet', tag: 'qr', node: QRView },
				{ title: 'Scan with XPLA Vault Mobile', tag: 'qr-xpla', node: XplaQRView },
			]}
			mobileViews={[{ title: 'Connect a wallet', tag: 'wallets', node: MobileWalletsView }]}
		/>
	)
}
