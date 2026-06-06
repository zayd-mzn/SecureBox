#!/usr/bin/env python3
"""
SecureBox Application Manager - Hidden Windows Version
Usage:
    python app_manager.py start     - Start both backend and frontend (hidden)
    python app_manager.py stop      - Stop both backend and frontend
    python app_manager.py status    - Check application status
"""

import subprocess
import sys
import os
import time
import socket
import signal
from pathlib import Path

# Configuration
BACKEND_DIR = Path(__file__).parent / "backend"
FRONTEND_DIR = Path(__file__).parent / "frontend"
BACKEND_PORT = 5000
FRONTEND_PORT = 3000

# PID files
PID_DIR = Path(__file__).parent / ".pids"
BACKEND_PID_FILE = PID_DIR / "backend.pid"
FRONTEND_PID_FILE = PID_DIR / "frontend.pid"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_status(message, status="info"):
    if status == "success":
        print(f"{Colors.GREEN}✓{Colors.ENDC} {message}")
    elif status == "error":
        print(f"{Colors.RED}✗{Colors.ENDC} {message}")
    elif status == "warning":
        print(f"{Colors.YELLOW}!{Colors.ENDC} {message}")
    elif status == "info":
        print(f"{Colors.BLUE}→{Colors.ENDC} {message}")

def ensure_pid_dir():
    """Ensure PID directory exists"""
    PID_DIR.mkdir(exist_ok=True)

def is_port_in_use(port):
    """Check if a port is in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('localhost', port))
            return False
        except socket.error:
            return True

def find_pids_by_port(port):
    """Find all PIDs using a specific port"""
    pids = set()
    try:
        if sys.platform == "win32":
            # Windows - use netstat
            result = subprocess.run(
                f'netstat -ano | findstr :{port}',
                shell=True, capture_output=True, text=True
            )
            for line in result.stdout.split('\n'):
                if 'LISTENING' in line or 'ESTABLISHED' in line:
                    parts = line.split()
                    if len(parts) > 4:
                        pid = parts[-1]
                        if pid.isdigit():
                            pids.add(int(pid))
        else:
            # Linux/Mac - use lsof
            result = subprocess.run(
                f'lsof -ti:{port}',
                shell=True, capture_output=True, text=True
            )
            for line in result.stdout.split('\n'):
                if line.strip().isdigit():
                    pids.add(int(line.strip()))
    except Exception as e:
        print_status(f"Error finding PIDs: {e}", "warning")
    return pids

def kill_process_tree(pid):
    """Kill a process and all its children"""
    try:
        if sys.platform == "win32":
            # Windows - use taskkill with /T flag to kill process tree
            subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        else:
            # Linux/Mac - send SIGTERM to process group
            try:
                os.killpg(os.getpgid(pid), signal.SIGTERM)
            except:
                os.kill(pid, signal.SIGTERM)
            time.sleep(1)
            # Force kill if still running
            try:
                os.kill(pid, 0)
                os.killpg(os.getpgid(pid), signal.SIGKILL)
            except:
                pass
        return True
    except Exception as e:
        print_status(f"Error killing process {pid}: {e}", "warning")
        return False

def save_pid(pid, pid_file):
    """Save PID to file"""
    pid_file.write_text(str(pid))

def read_pid(pid_file):
    """Read PID from file"""
    try:
        return int(pid_file.read_text().strip())
    except (FileNotFoundError, ValueError):
        return None

def start_backend():
    """Start the Flask backend server (hidden window)"""
    print_status("Starting backend server...", "info")
    
    if not BACKEND_DIR.exists():
        print_status(f"Backend directory not found: {BACKEND_DIR}", "error")
        return False
    
    # Check if already running
    if is_port_in_use(BACKEND_PORT):
        print_status(f"Backend is already running on port {BACKEND_PORT}", "warning")
        return True
    
    try:
        # Change to backend directory
        os.chdir(BACKEND_DIR)
        
        # Find Python executable
        python_cmd = sys.executable
        
        # Check if virtual environment exists
        if (BACKEND_DIR / "venv" / "bin" / "python").exists():
            python_cmd = str(BACKEND_DIR / "venv" / "bin" / "python")
        elif (BACKEND_DIR / "venv" / "Scripts" / "python.exe").exists():
            python_cmd = str(BACKEND_DIR / "venv" / "Scripts" / "python.exe")
        
        # Create log file for backend output
        log_file = PID_DIR / "backend.log"
        
        # Start the backend process (hidden)
        if sys.platform == "win32":
            # Windows - completely hidden
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE
            
            process = subprocess.Popen(
                [python_cmd, "run.py"],
                stdout=open(log_file, 'w'),
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW,
                startupinfo=startupinfo
            )
        else:
            # Linux/Mac - use nohup to run in background
            process = subprocess.Popen(
                [python_cmd, "run.py"],
                stdout=open(log_file, 'w'),
                stderr=subprocess.STDOUT,
                start_new_session=True
            )
        
        save_pid(process.pid, BACKEND_PID_FILE)
        
        # Wait a bit to ensure it starts
        time.sleep(3)
        
        # Check if it's actually running
        if is_port_in_use(BACKEND_PORT):
            print_status(f"Backend started successfully (PID: {process.pid})", "success")
            print_status(f"API URL: http://localhost:{BACKEND_PORT}/api", "info")
            print_status(f"Log file: {log_file}", "info")
            return True
        else:
            print_status("Backend failed to start. Check the log file.", "error")
            return False
            
    except Exception as e:
        print_status(f"Error starting backend: {e}", "error")
        return False
    finally:
        os.chdir(Path(__file__).parent)

def start_frontend():
    """Start the React frontend server (hidden window)"""
    print_status("Starting frontend server...", "info")
    
    if not FRONTEND_DIR.exists():
        print_status(f"Frontend directory not found: {FRONTEND_DIR}", "error")
        return False
    
    # Check if already running
    if is_port_in_use(FRONTEND_PORT):
        print_status(f"Frontend is already running on port {FRONTEND_PORT}", "warning")
        return True
    
    try:
        # Change to frontend directory
        os.chdir(FRONTEND_DIR)
        
        # Check if node_modules exists
        if not (FRONTEND_DIR / "node_modules").exists():
            print_status("Node modules not found. Installing dependencies...", "warning")
            subprocess.run(["npm", "install"], shell=True, capture_output=True)
        
        # Create log file for frontend output
        log_file = PID_DIR / "frontend.log"
        
        # Start the frontend process (hidden)
        if sys.platform == "win32":
            # Windows - completely hidden
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE
            
            process = subprocess.Popen(
                ["npm", "start"],
                stdout=open(log_file, 'w'),
                stderr=subprocess.STDOUT,
                shell=True,
                creationflags=subprocess.CREATE_NO_WINDOW,
                startupinfo=startupinfo
            )
        else:
            # Linux/Mac - use nohup to run in background
            process = subprocess.Popen(
                ["npm", "start"],
                stdout=open(log_file, 'w'),
                stderr=subprocess.STDOUT,
                shell=True,
                start_new_session=True
            )
        
        save_pid(process.pid, FRONTEND_PID_FILE)
        
        # Wait a bit to ensure it starts
        time.sleep(8)
        
        # Check if it's actually running
        if is_port_in_use(FRONTEND_PORT):
            print_status(f"Frontend started successfully (PID: {process.pid})", "success")
            print_status(f"Frontend URL: http://localhost:{FRONTEND_PORT}", "info")
            print_status(f"Log file: {log_file}", "info")
            return True
        else:
            print_status("Frontend failed to start. Check the log file.", "error")
            return False
            
    except Exception as e:
        print_status(f"Error starting frontend: {e}", "error")
        return False
    finally:
        os.chdir(Path(__file__).parent)

def stop_backend():
    """Stop the backend server - FORCE KILL"""
    print_status("Stopping backend server...", "info")
    
    # First try to kill by saved PID
    pid = read_pid(BACKEND_PID_FILE)
    if pid:
        print_status(f"Killing backend process (PID: {pid})...", "info")
        # Use force kill immediately
        if sys.platform == "win32":
            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        else:
            os.kill(pid, signal.SIGKILL)
        time.sleep(1)
    
    # Find and force kill any remaining processes on the port
    pids = find_pids_by_port(BACKEND_PORT)
    for pid in pids:
        print_status(f"Force killing process on port {BACKEND_PORT} (PID: {pid})...", "warning")
        if sys.platform == "win32":
            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        else:
            os.kill(pid, signal.SIGKILL)
        time.sleep(0.5)
    
    # Also kill any python processes that might be orphaned
    if sys.platform == "win32":
        try:
            result = subprocess.run('tasklist | findstr python.exe', shell=True, capture_output=True, text=True)
            for line in result.stdout.split('\n'):
                if 'python.exe' in line:
                    parts = line.split()
                    if len(parts) > 1 and parts[1].isdigit():
                        proc_pid = int(parts[1])
                        # Check if this process is using our port
                        port_check = subprocess.run(f'netstat -ano | findstr :{BACKEND_PORT} | findstr {proc_pid}', 
                                                   shell=True, capture_output=True, text=True)
                        if port_check.stdout.strip():
                            print_status(f"Force killing orphaned Python process (PID: {proc_pid})...", "warning")
                            subprocess.run(f'taskkill /F /PID {proc_pid}', shell=True, capture_output=True)
        except:
            pass
    
    # Clean up PID file
    if BACKEND_PID_FILE.exists():
        BACKEND_PID_FILE.unlink()
    
    # Wait a moment and verify
    time.sleep(2)
    
    if not is_port_in_use(BACKEND_PORT):
        print_status("Backend stopped successfully", "success")
        return True
    else:
        # One last attempt - use netstat to find and kill by force
        try:
            result = subprocess.run(f'netstat -ano | findstr :{BACKEND_PORT} | findstr LISTENING', 
                                   shell=True, capture_output=True, text=True)
            for line in result.stdout.split('\n'):
                if 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) > 4:
                        pid = parts[-1]
                        print_status(f"Final force kill attempt on PID: {pid}", "warning")
                        subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
                        subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        except:
            pass
        
        time.sleep(1)
        
        if not is_port_in_use(BACKEND_PORT):
            print_status("Backend stopped successfully", "success")
            return True
        else:
            print_status("Backend may still be running. Try manually or restart computer.", "error")
            return False
        
def stop_frontend():
    """Stop the frontend server"""
    print_status("Stopping frontend server...", "info")
    
    # First try to kill by saved PID
    pid = read_pid(FRONTEND_PID_FILE)
    if pid:
        kill_process_tree(pid)
        time.sleep(1)
    
    # Then find and kill any remaining processes on the port
    pids = find_pids_by_port(FRONTEND_PORT)
    for pid in pids:
        kill_process_tree(pid)
    
    # Also kill any node processes that might be orphaned
    if sys.platform == "win32":
        try:
            result = subprocess.run('tasklist | findstr node.exe', shell=True, capture_output=True, text=True)
            for line in result.stdout.split('\n'):
                if 'node.exe' in line:
                    parts = line.split()
                    if len(parts) > 1 and parts[1].isdigit():
                        kill_process_tree(int(parts[1]))
        except:
            pass
    
    # Clean up PID file
    if FRONTEND_PID_FILE.exists():
        FRONTEND_PID_FILE.unlink()
    
    # Verify it's stopped
    if not is_port_in_use(FRONTEND_PORT):
        print_status("Frontend stopped", "success")
        return True
    else:
        print_status("Frontend may still be running", "warning")
        return False

def check_status():
    """Check status of both applications"""
    print(f"\n{'='*50}")
    print(f"🔍 SecureBox Application Status")
    print(f"{'='*50}\n")
    
    backend_running = is_port_in_use(BACKEND_PORT)
    frontend_running = is_port_in_use(FRONTEND_PORT)
    
    print(f"Backend on port {BACKEND_PORT}:")
    if backend_running:
        print(f"  Status: {Colors.GREEN}Running{Colors.ENDC}")
        print(f"  URL: http://localhost:{BACKEND_PORT}/api")
        pids = find_pids_by_port(BACKEND_PORT)
        if pids:
            print(f"  PIDs: {', '.join(map(str, pids))}")
        log_file = PID_DIR / "backend.log"
        if log_file.exists():
            size = log_file.stat().st_size
            print(f"  Log size: {size} bytes")
    else:
        print(f"  Status: {Colors.RED}Stopped{Colors.ENDC}")
    
    print()
    
    print(f"Frontend on port {FRONTEND_PORT}:")
    if frontend_running:
        print(f"  Status: {Colors.GREEN}Running{Colors.ENDC}")
        print(f"  URL: http://localhost:{FRONTEND_PORT}")
        pids = find_pids_by_port(FRONTEND_PORT)
        if pids:
            print(f"  PIDs: {', '.join(map(str, pids))}")
        log_file = PID_DIR / "frontend.log"
        if log_file.exists():
            size = log_file.stat().st_size
            print(f"  Log size: {size} bytes")
    else:
        print(f"  Status: {Colors.RED}Stopped{Colors.ENDC}")
    
    print(f"\n{'='*50}\n")

def start_all():
    """Start both applications"""
    ensure_pid_dir()
    
    print(f"\n{Colors.BOLD}🚀 Starting SecureBox Application{Colors.ENDC}\n")
    
    success = True
    if not start_backend():
        success = False
    print()
    if not start_frontend():
        success = False
    
    if success:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✅ Applications started successfully!{Colors.ENDC}")
        print(f"\n{Colors.BOLD}📱 Access: http://localhost:{FRONTEND_PORT}{Colors.ENDC}")
        print(f"{Colors.BOLD}🔗 API: http://localhost:{BACKEND_PORT}/api{Colors.ENDC}")
        print(f"\n{Colors.YELLOW}📝 Logs are stored in .pids/ directory{Colors.ENDC}")
        print(f"{Colors.YELLOW}🛑 To stop: python app_manager.py stop{Colors.ENDC}\n")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}❌ Failed to start some services{Colors.ENDC}\n")

def stop_all():
    """Stop both applications with FORCE KILL"""
    print(f"\n{Colors.BOLD}🛑 Stopping SecureBox Application{Colors.ENDC}\n")
    
    # Kill frontend first
    print_status("Stopping frontend server...", "info")
    
    # Kill by PID
    pid = read_pid(FRONTEND_PID_FILE)
    if pid:
        if sys.platform == "win32":
            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        else:
            try:
                os.kill(pid, signal.SIGKILL)
            except:
                pass
    
    # Kill all node processes on port 3000
    pids = find_pids_by_port(FRONTEND_PORT)
    for pid in pids:
        print_status(f"Force killing process on port {FRONTEND_PORT} (PID: {pid})...", "warning")
        if sys.platform == "win32":
            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        else:
            try:
                os.kill(pid, signal.SIGKILL)
            except:
                pass
    
    # Kill all node.exe processes (Windows)
    if sys.platform == "win32":
        try:
            subprocess.run('taskkill /F /IM node.exe', shell=True, capture_output=True)
        except:
            pass
    
    if FRONTEND_PID_FILE.exists():
        FRONTEND_PID_FILE.unlink()
    
    time.sleep(1)
    
    # Kill backend with extreme prejudice
    print_status("Stopping backend server...", "info")
    
    # Kill by PID
    pid = read_pid(BACKEND_PID_FILE)
    if pid:
        if sys.platform == "win32":
            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        else:
            try:
                os.kill(pid, signal.SIGKILL)
            except:
                pass
    
    # Kill all processes on port 5000
    pids = find_pids_by_port(BACKEND_PORT)
    for pid in pids:
        print_status(f"Force killing process on port {BACKEND_PORT} (PID: {pid})...", "warning")
        if sys.platform == "win32":
            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
            subprocess.run(f'taskkill /F /T /PID {pid}', shell=True, capture_output=True)
        else:
            try:
                os.kill(pid, signal.SIGKILL)
            except:
                pass
    
    # Kill all python.exe processes using our port (Windows)
    if sys.platform == "win32":
        try:
            result = subprocess.run('tasklist | findstr python.exe', shell=True, capture_output=True, text=True)
            for line in result.stdout.split('\n'):
                if 'python.exe' in line:
                    parts = line.split()
                    if len(parts) > 1 and parts[1].isdigit():
                        proc_pid = int(parts[1])
                        # Check if this process is using our port
                        port_check = subprocess.run(f'netstat -ano | findstr :{BACKEND_PORT} | findstr {proc_pid}', 
                                                   shell=True, capture_output=True, text=True)
                        if port_check.stdout.strip():
                            print_status(f"Force killing Python process (PID: {proc_pid})...", "warning")
                            subprocess.run(f'taskkill /F /PID {proc_pid}', shell=True, capture_output=True)
        except:
            pass
    
    if BACKEND_PID_FILE.exists():
        BACKEND_PID_FILE.unlink()
    
    # Wait and verify
    time.sleep(2)
    
    # Final verification
    backend_stopped = not is_port_in_use(BACKEND_PORT)
    frontend_stopped = not is_port_in_use(FRONTEND_PORT)
    
    if backend_stopped:
        print_status("Backend stopped successfully", "success")
    else:
        print_status("WARNING: Backend may still be running on port 5000", "error")
        
    if frontend_stopped:
        print_status("Frontend stopped successfully", "success")
    else:
        print_status("WARNING: Frontend may still be running on port 3000", "error")
    
    print(f"\n{Colors.GREEN}{Colors.BOLD}✅ Stop command completed!{Colors.ENDC}\n")

def view_logs():
    """View the latest logs"""
    backend_log = PID_DIR / "backend.log"
    frontend_log = PID_DIR / "frontend.log"
    
    if backend_log.exists():
        print(f"\n{Colors.BOLD}Backend Log (last 20 lines):{Colors.ENDC}")
        print("-" * 50)
        with open(backend_log, 'r') as f:
            lines = f.readlines()
            for line in lines[-20:]:
                print(line.strip())
    
    if frontend_log.exists():
        print(f"\n{Colors.BOLD}Frontend Log (last 20 lines):{Colors.ENDC}")
        print("-" * 50)
        with open(frontend_log, 'r') as f:
            lines = f.readlines()
            for line in lines[-20:]:
                print(line.strip())

def main():
    if len(sys.argv) < 2:
        print("Usage: python app_manager.py [start|stop|status|logs]")
        print("  start   - Start both services (hidden windows)")
        print("  stop    - Stop both services")
        print("  status  - Check service status")
        print("  logs    - View latest logs")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == 'start':
        start_all()
    elif command == 'stop':
        stop_all()
    elif command == 'status':
        check_status()
    elif command == 'logs':
        view_logs()
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()