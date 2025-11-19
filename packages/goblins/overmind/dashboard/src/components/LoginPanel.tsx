import { useState } from "react";
import type { RuntimeClient } from "../api/runtime-client";

interface LoginPanelProps {
  client: any | RuntimeClient;
}

export function LoginPanel({ client }: LoginPanelProps) {
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      if (typeof client.login === "function") {
        await client.login(username, password);
        setMessage("Logged in");
        setShow(false);
      } else {
        setMessage("Login not supported in this client (Tauri uses IPC)");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="login-panel">
      <button className="button" onClick={() => setShow(true)}>
        Sign in
      </button>

      {show && (
        <div className="login-modal">
          <div className="login-content">
            <h3>Sign in</h3>
            <div className="form-group">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="login-actions">
              <button className="button" onClick={handleLogin}>Sign in</button>
              <button className="button" onClick={() => setShow(false)}>Cancel</button>
            </div>
            {message && <div className="login-message">{message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPanel;
