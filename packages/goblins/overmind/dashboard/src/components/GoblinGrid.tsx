/**
 * GoblinGrid - Display goblins grouped by guild
 *
 * Features:
 * - Grid layout with guild grouping
 * - Status indicators (idle/busy)
 * - Click to select goblin
 * - Hover effects with glow
 */

import { useEffect, useState } from "react";
import type { Goblin } from "../api/tauri-client";

interface GoblinGridProps {
	goblins: Goblin[];
	selectedGoblinId: string | null;
	onSelectGoblin: (goblinId: string) => void;
	busyGoblins?: Set<string>;
}

interface GoblinsByGuild {
	[guild: string]: Goblin[];
}

export function GoblinGrid({
	goblins,
	selectedGoblinId,
	onSelectGoblin,
	busyGoblins = new Set(),
}: GoblinGridProps) {
	const [goblinsByGuild, setGoblinsByGuild] = useState<GoblinsByGuild>({});

	// Group goblins by guild
	useEffect(() => {
		const grouped = goblins.reduce((acc, goblin) => {
			const guild = goblin.guild || "Unknown";
			if (!acc[guild]) {
				acc[guild] = [];
			}
			acc[guild].push(goblin);
			return acc;
		}, {} as GoblinsByGuild);

		setGoblinsByGuild(grouped);
	}, [goblins]);

	if (goblins.length === 0) {
		return (
			<div className="goblin-grid-empty">
				<div className="empty-state">
					<div className="empty-icon">🤖</div>
					<h3>No Goblins Available</h3>
					<p className="text-muted">Check server connection</p>
				</div>
			</div>
		);
	}

	return (
		<div className="goblin-grid">
			{Object.entries(goblinsByGuild).map(([guild, guildGoblins]) => (
				<div key={guild} className="guild-section">
					<h3 className="guild-header">
						<span className="guild-name">{guild}</span>
						<span className="guild-count text-muted">
							{guildGoblins.length}
						</span>
					</h3>

					<div className="goblins-list">
						{guildGoblins.map((goblin) => {
							const isSelected = goblin.id === selectedGoblinId;
							const isBusy = busyGoblins.has(goblin.id);

							return (
								<button
									key={goblin.id}
									className={`goblin-card ${isSelected ? "selected" : ""} ${
										isBusy ? "busy" : ""
									}`}
									onClick={() => onSelectGoblin(goblin.id)}
									disabled={isBusy}
								>
									{/* Status indicator */}
									<div className="goblin-status">
										<div
											className={`status-dot ${
												isBusy ? "status-busy" : "status-idle"
											}`}
										/>
									</div>

									{/* Goblin info */}
									<div className="goblin-info">
										<h4 className="goblin-title">{goblin.title}</h4>
										<code className="goblin-id text-muted">{goblin.id}</code>
									</div>

									{/* Responsibilities */}
									{goblin.responsibilities &&
										goblin.responsibilities.length > 0 && (
											<div className="goblin-responsibilities">
												<ul>
													{goblin.responsibilities
														.slice(0, 3)
														.map((resp, idx) => (
															<li key={idx}>{resp}</li>
														))}
												</ul>
												{goblin.responsibilities.length > 3 && (
													<span className="text-muted">
														+{goblin.responsibilities.length - 3} more
													</span>
												)}
											</div>
										)}
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

/* ============================================================================
 * Styles (can be moved to separate CSS file)
 * ========================================================================== */

const styles = `
.goblin-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-4);
}

.goblin-grid-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--space-8);
}

.empty-state {
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state h3 {
  margin-bottom: var(--space-2);
  color: var(--text-secondary);
}

/* Guild Section */

.guild-section {
  animation: slideInUp var(--transition-base) ease-out;
}

.guild-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}

.guild-name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--accent-green);
}

.guild-count {
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
}

/* Goblins List */

.goblins-list {
  display: grid;
  gap: var(--space-3);
}

/* Goblin Card */

.goblin-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.goblin-card:hover:not(:disabled) {
  border-color: var(--accent-green-dim);
  background: var(--bg-tertiary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.goblin-card.selected {
  border-color: var(--accent-green);
  background: var(--bg-tertiary);
  box-shadow: var(--glow-green);
}

.goblin-card.busy {
  opacity: 0.6;
  cursor: wait;
}

/* Status */

.goblin-status {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-idle {
  background: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

.status-busy {
  background: var(--warning);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Info */

.goblin-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.goblin-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.goblin-id {
  font-size: var(--text-xs);
  opacity: 0.7;
}

/* Responsibilities */

.goblin-responsibilities {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.goblin-responsibilities ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.goblin-responsibilities li {
  position: relative;
  padding-left: var(--space-3);
  margin-bottom: var(--space-1);
  line-height: var(--leading-relaxed);
}

.goblin-responsibilities li::before {
  content: '→';
  position: absolute;
  left: 0;
  color: var(--accent-green);
}
`;

// Inject styles (for demo purposes - should be in separate CSS file)
if (typeof document !== "undefined") {
	const styleSheet = document.createElement("style");
	styleSheet.textContent = styles;
	document.head.appendChild(styleSheet);
}
