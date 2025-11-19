interface Props {
	providers: string[];
	selected?: string;
	onChange?: (provider: string) => void;
}

export default function ProviderSelector({
	providers,
	selected,
	onChange,
}: Props) {
	if (!providers || providers.length === 0) return null;

	return (
		<div className="provider-selector">
			<label htmlFor="provider-select">Provider:</label>
			<select
				id="provider-select"
				aria-label="Select provider"
				value={selected || providers[0]}
				onChange={(e) => onChange && onChange(e.currentTarget.value)}
			>
				{providers.map((p) => (
					<option key={p} value={p}>
						{p}
					</option>
				))}
			</select>
		</div>
	);
}
