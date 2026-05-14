import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../services/authService";



// ─── Password strength helper ─────────────────────────────────────────────────
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  if (score <= 1) return { label: "Weak",   color: "#ef4444", width: "25%" };
  if (score === 2) return { label: "Fair",   color: "#f97316", width: "50%" };
  if (score === 3) return { label: "Good",   color: "#eab308", width: "75%" };
  return             { label: "Strong", color: "#22c55e", width: "100%" };
}

// ─── Eye icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "user",
  });

  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm,  setShowConfirm]    = useState(false);
  const [roleOpen,     setRoleOpen]       = useState(false);
  const [error,        setError]          = useState("");
  const [loading,      setLoading]        = useState(false);

  const passwordStrength = formData.password ? getPasswordStrength(formData.password) : null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const selectRole = (role) => {
    setFormData({ ...formData, role });
    setRoleOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.confirm_password,
        formData.role
      );
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const roleLabels = { user: "User", space_admin: "Space Admin" };

  return (
    <div style={styles.page}>

      {/* ── Brand ── */}
      <div style={styles.brand}>
        <img
          src="/Logo_platforme.png"
          alt="SecureBox"
          style={styles.logo}
        />
        <h1 style={styles.brandName}>SecureBox</h1>
        <p style={styles.brandSub}>Create your secure account</p>
      </div>

      {/* ── Card ── */}
      <div style={styles.card}>
        <h2 style={styles.title}>Create Account</h2>

        {error && (
          <div style={styles.errorBox} role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>

          {/* Username */}
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleChange}
              style={styles.input}
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          {/* Email */}
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              name="email"
              placeholder="your.email@university.edu"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
                style={{ ...styles.input, paddingRight: "44px" }}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
            {passwordStrength && (
              <div style={styles.strengthWrapper}>
                <div style={styles.strengthTrack}>
                  <div style={{ ...styles.strengthBar, width: passwordStrength.width, background: passwordStrength.color }} />
                </div>
                <span style={{ ...styles.strengthLabel, color: passwordStrength.color }}>
                  {passwordStrength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <div style={styles.inputWrapper}>
              <input
                type={showConfirm ? "text" : "password"}
                name="confirm_password"
                placeholder="Re-enter your password"
                value={formData.confirm_password}
                onChange={handleChange}
                style={{
                  ...styles.input,
                  paddingRight: "44px",
                  borderColor:
                    formData.confirm_password && formData.password !== formData.confirm_password
                      ? "#ef4444"
                      : undefined,
                }}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                style={styles.eyeBtn}
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                aria-label="Toggle confirm password visibility"
              >
                <EyeIcon visible={showConfirm} />
              </button>
            </div>
            {formData.confirm_password && formData.password !== formData.confirm_password && (
              <span style={styles.fieldError}>Passwords do not match</span>
            )}
          </div>

          {/* Role */}
          <div style={styles.field}>
            <label style={styles.label}>Role</label>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                style={styles.roleBtn}
                onClick={() => setRoleOpen(!roleOpen)}
                aria-haspopup="listbox"
                aria-expanded={roleOpen}
              >
                <span>{roleLabels[formData.role]}</span>
                <ChevronIcon />
              </button>
              {roleOpen && (
                <ul style={styles.dropdown} role="listbox">
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <li
                      key={value}
                      role="option"
                      aria-selected={formData.role === value}
                      style={{
                        ...styles.dropdownItem,
                        ...(formData.role === value ? styles.dropdownItemActive : {}),
                      }}
                      onClick={() => selectRole(value)}
                    >
                      {label}
                      {formData.role === value && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p style={styles.hint}>Global Admin accounts are created manually</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            style={{ ...styles.button, opacity: loading ? 0.72 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <span style={styles.spinner} /> Creating account…
              </span>
            ) : "Create Account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef0f5",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "32px 20px",
  },
  brand: {
    textAlign: "center",
    marginBottom: "20px",
  },
  
  brandName: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#1a1a2e",
    margin: "0 0 4px",
  },
  brandSub: {
    color: "#666",
    fontSize: "13px",
    margin: 0,
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "36px 40px 32px",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: "22px",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#fff0f0",
    border: "1px solid #fecaca",
    color: "#cc0000",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    marginBottom: "16px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
  },
  input: {
    width: "100%",
    border: "1.5px solid #e0e0e0",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    outline: "none",
    background: "#f7f8fa",
    color: "#1a1a2e",
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', sans-serif",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    padding: "0",
    cursor: "pointer",
    color: "#999",
    display: "flex",
    alignItems: "center",
  },
  strengthWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px",
  },
  strengthTrack: {
    flex: 1,
    height: "4px",
    background: "#e5e7eb",
    borderRadius: "2px",
    overflow: "hidden",
  },
  strengthBar: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.3s, background 0.3s",
  },
  strengthLabel: {
    fontSize: "11px",
    fontWeight: "600",
    minWidth: "44px",
    textAlign: "right",
  },
  fieldError: {
    fontSize: "12px",
    color: "#ef4444",
  },
  roleBtn: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1.5px solid #e0e0e0",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    fontFamily: "'Segoe UI', sans-serif",
    background: "#f7f8fa",
    color: "#1a1a2e",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1.5px solid #e0e0e0",
    borderRadius: "8px",
    listStyle: "none",
    margin: 0,
    padding: "4px 0",
    zIndex: 10,
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  },
  dropdownItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    fontSize: "14px",
    cursor: "pointer",
    color: "#333",
  },
  dropdownItemActive: {
    background: "#f0f4ff",
    color: "#2d3a8c",
    fontWeight: "500",
  },
  hint: {
    fontSize: "12px",
    color: "#999",
    margin: 0,
  },
  logo: {
    width: "64px",
    height: "64px",
    objectFit: "contain",
    marginBottom: "10px",
    display: "block",
    margin: "0 auto 10px",
  },
  button: {
    background: "#2d3a8c",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "15px",
    fontWeight: "600",
    width: "100%",
    marginTop: "4px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  spinner: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  footer: {
    textAlign: "center",
    fontSize: "14px",
    color: "#555",
    marginTop: "20px",
  },
  link: {
    color: "#2d3a8c",
    fontWeight: "600",
    textDecoration: "none",
  },
};
