import { CosmosGetAccount } from './CosmosGetAccount'
import { CosmosSignAmino } from './CosmosSignAmino'
import { CosmosSignDirect } from './CosmosSignDirect'

export function CosmosActions() {
	return (
		<div className="action-grid">
			<CosmosGetAccount />
			<CosmosSignAmino />
			<CosmosSignDirect />
		</div>
	)
}
