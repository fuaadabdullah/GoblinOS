import { useEffect, useState } from "react";
import { runtimeClient } from "../api/tauri-client";

export default function APIKeyManager() {
  const [providers, setProviders] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [key, setKey] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    runtimeClient
      .getProviders()
      .then((p) => {
        setProviders(p);
        if (p.length > 0) setSelected(p[0]);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!selected) return;
    try {
      // Persist and update runtime providers immediately
      await runtimeClient.setProviderApiKey(selected, key);
      setStatus("Saved securely");
      setKey("");
    } catch (e) {
      setStatus("Failed to save: " + e);
    }
  }

  async function handleGet() {
    if (!selected) return;
    try {
      const k = await runtimeClient.getApiKey(selected);
      setStatus(k ? "Key present" : "No key stored");
    } catch (e) {
      setStatus("Failed to read: " + e);
    }
  }

  async function handleClear() {
    if (!selected) return;
    try {
      await runtimeClient.clearApiKey(selected);
      setStatus("Cleared");
    } catch (e) {
      setStatus("Failed to clear: " + e);
    }
  }

  return (
    <div className="api-key-manager">
      <h4>API Keys (secure)</h4>
      <div className="row">
        <label htmlFor="apikey-provider-select">Provider</label>
        <select id="apikey-provider-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {providers.map((p) => (
            <option value={p} key={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="row">
        <label htmlFor="apikey-input">Key</label>
        <input
          id="apikey-input"
          value={key}
          onChange={(e) => setKey(e.currentTarget.value)}
          placeholder="Enter API key"
        />
      </div>

      <div className="btn-row">
        <button onClick={handleSave} disabled={!selected || !key}>
          Save
        </button>
        <button onClick={handleGet} disabled={!selected}>
          Check
        </button>
        <button onClick={handleClear} disabled={!selected}>
          Clear
        </button>
      </div>

      {status && <div className="status">{status}</div>}
    </div>
  );
}
