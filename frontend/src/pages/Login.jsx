import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [formData, setFormData] = useState({ username: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username: formData.username,
        password: formData.password
      });

      console.log('Login response:', response.data);

      if (response.data.access_token) {
        auth.login(response.data.user, response.data.access_token);
        console.log('Login successful! Redirecting...');
        navigate('/dashboard');
      } else if (response.data.mfa_required) {
        navigate('/mfa', { state: { user_id: response.data.user_id } });
      } else {
        setError(response.data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.brand}>
        <div style={styles.logoBox}>
          <img
            src="/Logo_platforme.png"
            alt="logo"
            style={styles.logo}
          />
        </div>
        <h1 style={styles.brandName}>SecureBox</h1>
        <p style={styles.brandSub}>Secure collaborative file sharing platform</p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.title}>Sign in to your account</h2>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username or Email</label>
            <input
              type="text"
              name="username"
              placeholder="Enter your username"
              value={formData.username}
              onChange={handleChange}
              style={styles.input}
              required
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.row}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              &nbsp; Remember me
            </label>
            <Link to="/forgot-password" style={styles.link}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account?{" "}
          <Link to="/register" style={styles.link}>
            Create account
          </Link>
        </p>

        <p style={styles.secure}>🔐 Protected by end-to-end encryption</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f5",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "20px",
  },
  brand: { textAlign: "center", marginBottom: "20px" },
  logoBox: { fontSize: "40px", marginBottom: "6px" },
  brandName: { fontSize: "26px", fontWeight: "700", color: "#1a1a2e", margin: 0 },
  brandSub: { color: "#666", fontSize: "13px", margin: "4px 0 0" },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "36px 40px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: "20px",
    textAlign: "center",
  },
  errorBox: {
    background: "#fff0f0",
    border: "1px solid #ffcccc",
    color: "#cc0000",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    marginBottom: "16px",
  },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "14px", fontWeight: "500", color: "#333" },
  input: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    outline: "none",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
  },
  checkboxLabel: { color: "#555", cursor: "pointer" },
  link: { color: "#4f46e5", textDecoration: "none", fontSize: "14px" },
  button: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
  },
  logo: {
    width: "64px",
    height: "64px",
    objectFit: "contain",
    marginBottom: "10px",
    display: "block",
    margin: "0 auto 10px",
  },
  footer: { textAlign: "center", fontSize: "14px", color: "#555", marginTop: "20px" },
  secure: { textAlign: "center", fontSize: "12px", color: "#888", marginTop: "12px" },
};