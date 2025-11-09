interface Props {
  streamingText: string;
}

export default function StreamingView({ streamingText }: Props) {
  return (
    <div className="streaming-view" aria-live="polite">
      <h3>Streaming Output</h3>
      <pre className="streaming-output">{streamingText}</pre>
    </div>
  );
}
