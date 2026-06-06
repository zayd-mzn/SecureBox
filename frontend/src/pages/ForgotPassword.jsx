import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { forgotPassword } from "../services/authService";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2>Check your email</h2>
          <p>If an account with that email exists, a 6-digit reset code has been sent. It expires in 5 minutes.</p>
          <button style={styles.btn} onClick={() => navigate("/reset-password", { state: { email } })}>
            Enter reset code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Forgot Password</h2>
        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="email"
            placeholder="Your account email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset code"}
          </button>
        </form>
        <p style={{ marginTop: 12 }}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f0f2f5" },
  card: { background: "#fff", padding: 32, borderRadius: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.1)", width: 360 },
  input: { width: "100%", padding: "10px 12px", marginBottom: 12, borderRadius: 6, border: "1px solid #ccc", fontSize: 14, boxSizing: "border-box" },
  btn: { width: "100%", padding: "10px 0", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, cursor: "pointer" },
  error: { color: "#d32f2f", fontSize: 13, marginBottom: 8 },
};
