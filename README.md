# SecureBox 🔒
Secure Collaborative File Sharing Platform

---

## Project Structure
```
securebox/
├── backend/          # Flask API
│   ├── app/
│   │   ├── routes/   # API blueprints (auth, files, etc.)
│   │   ├── __init__.py
│   │   ├── extensions.py
│   │   └── models.py
│   ├── .env          # ⚠️ You must create this yourself (see below)
│   ├── .gitignore
│   └── run.py
└── frontend/         # React app
    ├── src/
    │   ├── pages/
    │   ├── services/
    │   └── components/
    └── package.json
```

---

## Prerequisites

Make sure you have these installed:

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10+ | `sudo pacman -S python` (Arch) / [python.org](https://python.org) |
| Node.js + npm | 18+ | `sudo pacman -S nodejs npm` (Arch) / [nodejs.org](https://nodejs.org) |
| Git | any | `sudo pacman -S git` (Arch) |

---

## Backend Setup (Flask)

### 1. Clone the repository
```bash
git clone https://github.com/zayd-mzn/SecureBox.git
cd securebox
```

### 2. Create and activate a virtual environment
```bash
cd backend
python -m venv venv

# On Linux/Mac:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

You should see `(venv)` at the start of your terminal line.

### 3. Install Python dependencies via the requirements.txt
```bash
pip install -r requirements.txt
```

### 4. Create the `.env` file
Create a file called `.env` inside the `backend/` folder:
```bash
touch .env
```

Add the following content:
```
SECRET_KEY=replace_this_with_a_long_random_string
DATABASE_URL=sqlite:///securebox.db
```

To generate a secure `SECRET_KEY`, run:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and replace `replace_this_with_a_long_random_string`.

> ⚠️ Never share or push your `.env` file. It is already in `.gitignore`.

### 5. Run the Flask server
```bash
python run.py
```

Flask will start at `http://localhost:5000`. The database (`securebox.db`) is created automatically on first run.

### 6. Create an admin user (first time only)
```bash
python
```
```python
from app import create_app
from app.extensions import db, bcrypt
from app.models import User

app = create_app()
with app.app_context():
    user = User(
        username="admin",
        email="admin@securebox.com",
        password_hash=bcrypt.generate_password_hash("Admin1234!").decode('utf-8'),
        role="global_admin",
        mfa_enabled=False,
        is_active=True
    )
    db.session.add(user)
    db.session.commit()
    print("Admin user created!")
```

---

## Frontend Setup (React)

### 1. Install dependencies
```bash
cd frontend
npm install
```

### 2. Run the React app
```bash
npm start
```

React will start at `http://localhost:3000`.

> ⚠️ Make sure Flask is running at `localhost:5000` before using the app.

---

## Running the Full Project

You need **two terminals open at the same time**:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
python run.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
```

Then open `http://localhost:3000` in your browser.

---

## API Endpoints (so far)

| Method | Endpoint | Description | Auth required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Login with username/password | No |

---

## Troubleshooting

**`SECRET_KEY` is None / app won't start**  
→ Make sure your `.env` file is inside the `backend/` folder, not the root.

**CORS error in the browser**  
→ Make sure Flask is running on port `5000` and React on port `3000`.

**`ModuleNotFoundError`**  
→ Make sure your virtual environment is activated (`source venv/bin/activate`).

**Port already in use**  
→ Kill the process using the port:
```bash
# Find it:
lsof -i :5000
# Kill it:
kill -9 <PID>
```
