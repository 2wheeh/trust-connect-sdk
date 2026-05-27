import type { NamespaceId } from '@trustwallet/connect-react'

type NamespaceView = {
	id: NamespaceId
	title: string
	accent: 'evm' | 'solana' | 'bitcoin' | 'cosmos'
	renderActions?: () => React.JSX.Element
}

type ActionsSectionProps = {
	namespaces: NamespaceView[]
}

export function ActionsSection({ namespaces }: ActionsSectionProps) {
	return (
		<section className="actions-section-container">
			<div className="actions-section-header">
				<p className="eyebrow">Hook Tests</p>
				<h2>Test Namespace Actions</h2>
				<p className="panel-copy">Execute actions like signing messages, switching chains, and reading balances.</p>
			</div>

			<div className="actions-by-namespace">
				{namespaces.map((namespace) => {
					const actions = namespace.renderActions?.()

					if (!actions) {
						return null
					}

					return (
						<div key={namespace.id} className="panel namespace-actions-panel" data-accent={namespace.accent}>
							<div className="panel-header">
								<div>
									<p className="eyebrow">Namespace</p>
									<h3>{namespace.title}</h3>
								</div>
							</div>
							<div className="namespace-actions-content">{actions}</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}
