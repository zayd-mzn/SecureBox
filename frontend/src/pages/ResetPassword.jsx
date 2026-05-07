import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { resetPassword } from "../services/authService";

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: location.state?.email || "",
    otp: "",
    new_password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.new_password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(form.email.trim().toLowerCase(), form.otp.trim(), form.new_password, form.confirm_password);
      navigate("/login", { state: { message: "Password updated. Please log in." } });
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Reset Password</h2>
        <form onSubmit={handleSubmit}>
          <input style={styles.input} type="email" name="email" placeholder="Your account email" value={form.email} onChange={handleChange} required />
          <input style={styles.input} type="text" name="otp" placeholder="6-digit reset code" value={form.otp} onChange={handleChange} maxLength={6} required />
          <input style={styles.input} type="password" name="new_password" placeholder="New password" value={form.new_password} onChange={handleChange} required />
          <input style={styles.input} type="password" name="confirm_password" placeholder="Confirm new password" value={form.confirm_password} onChange={handleChange} required />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? "Updating..." : "Reset password"}
          </button>
        </form>
        <p style={{ marginTop: 12 }}>
          <Link to="/forgot-password">Resend code</Link>
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
