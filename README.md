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
- [x] MFA (TOTP) — setup, verify, disable via settings
- [x] MFA challenge-response on login (`/login/mfa` endpoint)
- [x] Brute-force protection (5 failed attempts → 15-minute lockout)
- [x] Password reset via OTP email

### File Management
- [x] File upload with unique naming and SHA-256 checksum
- [x] File download (with password verification for encrypted files)
- [x] File rename and move (between folders)
- [x] File content editing (in-place update)
- [x] File encryption (Fernet symmetric encryption with password protection)
- [x] File type detection and categorization
- [x] Folder management (create, list, delete)
- [x] File search
- [x] Storage quota enforcement on upload (with 75%/90% warnings)
- [x] File sharing (share/unshare with specific users, view shared files)
- [x] Recycle bin (soft delete, restore, permanent delete, empty bin)
- [x] File versioning (automatic on re-upload, list/download/restore versions)

### Concurrent Access
- [x] Pessimistic file locking (lock/unlock/force-unlock)
- [x] Real-time collaboration via Socket.IO
- [x] Live content sync (editor broadcasts to viewers)
- [x] Live cursor position broadcasting
- [x] Active viewer tracking per file
- [x] Auto-unlock on editor disconnect

### Access Control
- [x] Per-file, per-user ACLs (can_read, can_write, can_delete, can_share)
- [x] CRUD operations on ACL entries
- [x] Permission check endpoint

### Workspace Management
- [x] Create/delete workspace (space_admin)
- [x] Join workspace via invite code
- [x] Member management (list, remove, regenerate invite code)
- [x] Upload files to workspace

### Activity Logging
- [x] Full activity logging (user, action, resource, IP, status, timestamp)
- [x] Role-based log access (admin=all, space_admin=space, user=own)
- [x] Log search, pagination, statistics, export

### Admin Features
- [x] System statistics (total users, files, storage)
- [x] User management (list, search, create, delete, change role, toggle active)
- [x] Storage quota management (per-user quotas, stats, recommendations)

### Notifications
- [x] In-app notifications (upload success, storage warnings, shares)
- [x] Unread count, mark as read, delete

### Dashboard & Analytics
- [x] User stats, file type distribution, recent activity, weekly activity stats

### User Settings
- [x] Profile management (username, email, full name, phone)
- [x] Change password
- [x] Notification/privacy/preference settings
- [x] Export user data / delete account
- [x] Avatar upload/delete

### Roles
- [x] Three roles: `global_admin`, `space_admin`, `user`
- [x] Role stored in JWT claims and user model
- [x] `global_admin` created manually; `user` and `space_admin` self-register

### Frontend
- [x] Login, Register, Forgot/Reset password pages
- [x] Dashboard with charts (StatCard, StorageBar, WeeklyActivityChart, FileTypeDistribution)
- [x] File manager with folders
- [x] ACL management, Activity logs, Workspace, User management, Quota management pages
- [x] Recycle bin, Version history, Shared with me, Search, Settings pages
- [x] Notification panel, Live viewer component
- [x] Sidebar navigation (role-aware), MainLayout with TopBar
- [x] Route guards: ProtectedRoute, AdminRoute, SpaceAdminRoute
- [x] Lazy-loaded pages (code splitting)

### Backend utilities
- [x] `@jwt_required` decorator for protecting routes
- [x] `get_current_user()` helper to resolve the logged-in user from the JWT

---

## What Remains To Do

### Security
- [x] Malicious file upload protection — MIME type validated against actual file bytes using `python-magic`; uploads rejected if detected MIME is not in the allowed whitelist
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
