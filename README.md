# SecureBox 🔒
Secure Collaborative File Sharing Platform — Mini Project ICCN INE1 (2025/2026)

Supervised by: Pr. Asmaa ElKandoussi, Pr. Charifa HANIN, Pr. Meryeme Ayache

---

## Overview

SecureBox is a web-based platform for secure file sharing in a local network or educational environment. Users can upload, download, and organise files in a shared space with fine-grained access control. The platform enforces role-based permissions, per-file ACLs, concurrent access management, file versioning, MFA, and full activity logging.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, Flask |
| Frontend | React 19, React Router 7 |
| Database | SQLite (via SQLAlchemy) |
| Auth | Bcrypt (passwords), JWT (sessions), TOTP/OTP (MFA) |

---

## Roles

| Role | Capabilities |
|------|-------------|
| `global_admin` | Full platform access — manage users, roles, all files, view all logs |
| `space_admin` | Manage their own workspace — share files, set permissions, view space logs |
| `user` | Access only files they have been granted permission to |

---

## Project Structure

```
securebox/
├── backend/
│   ├── app/
│   │   ├── routes/       # auth.py, register.py, utils.py
│   │   ├── __init__.py   # App factory
│   │   ├── extensions.py # db, bcrypt, cors, jwt
│   │   └── models.py     # User model
│   ├── .env              # SECRET_KEY, DATABASE_URL (create manually)
│   └── run.py
└── frontend/
    └── src/
        ├── components/   # PrivateRoute.jsx
        ├── contexts/     # AuthContext.jsx
        ├── pages/        # Login.jsx, Register.jsx
        └── services/     # authService.js
```

---

## Setup

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
DATABASE_URL=sqlite:///securebox.db
```

```bash
python run.py   # starts at http://localhost:5000
```

Create the first admin user (one-time):
```python
from app import create_app
from app.extensions import db, bcrypt
from app.models import User

app = create_app()
with app.app_context():
    user = User(
        username="admin", email="admin@securebox.com",
        password_hash=bcrypt.generate_password_hash("Admin1234!").decode('utf-8'),
        role="global_admin", mfa_enabled=False, is_active=True
    )
    db.session.add(user); db.session.commit()
```

### Frontend

```bash
cd frontend
npm install
npm start   # starts at http://localhost:3000
```

---

## What's Implemented

### Authentication & Accounts
- [x] User registration with validation (username format, email, password strength)
- [x] Login by username or email
- [x] Bcrypt password hashing
- [x] JWT access tokens issued on login (claims: user id, username, role)
- [x] Token stored in `localStorage`, available globally via `AuthContext`
- [x] Account active/inactive check on login
- [x] MFA flag on user model + login stub (returns `mfa_required: true` if enabled)

### Roles
- [x] Three roles: `global_admin`, `space_admin`, `user`
- [x] Role stored in JWT claims and user model
- [x] `global_admin` created manually; `user` and `space_admin` self-register

### Frontend
- [x] Login page
- [x] Register page (role selection: `user` / `space_admin`)
- [x] `PrivateRoute` — unauthenticated users redirected to `/login`

### Backend utilities
- [x] `@jwt_required` decorator for protecting routes
- [x] `get_current_user()` helper to resolve the logged-in user from the JWT

---

## What Remains To Do

### Authentication
- [ ] MFA enforcement on login — `mfa_secret` and TOTP setup/verify/disable are implemented in settings, but the `/login` route only returns `mfa_required: true` without actually blocking token issuance; the full challenge-response flow needs to be wired up
- [ ] Brute-force protection — rate limiting on `/login`

### File Management
- [ ] Malicious file upload protection — file type is detected by extension only; actual MIME validation and malware scanning are not implemented

### Concurrent Access
- [ ] Notify other users when a file is currently being edited — pessimistic locking (lock/unlock) is implemented, but there is no real-time notification pushed to other users who have the file open

### Security
- [ ] Inter-node trust mechanism *(bonus)*

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login, returns JWT | No |

---

## Troubleshooting

**App won't start — `SECRET_KEY` is None**
→ Make sure `.env` is inside `backend/`, not the project root.

**CORS error in browser**
→ Flask must be on port `5000`, React on port `3000`.

**Port already in use**
```bash
lsof -i :5000
kill -9 <PID>
```
