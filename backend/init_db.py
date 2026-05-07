"""
Initialize database with comprehensive mock data for all features
Run this script once to populate the database
"""

from app import create_app
from app.extensions import db, bcrypt
from app.models import User, File, FileVersion, ACL, Log, DeletedFile, Notification, Folder
from datetime import datetime, timedelta
import random
import base64
import json
import os
from cryptography.fernet import Fernet

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def generate_encryption_key():
    """Generate a random encryption key for file encryption"""
    return Fernet.generate_key().decode('utf-8')


def generate_placeholder_avatar(username):
    """Generate a simple colored avatar for users"""
    colors = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#e53e3e', '#38b2ac', '#f6ad55', '#805ad5']
    color = colors[hash(username) % len(colors)]
    letter = username[0].upper()
    
    svg = f'''<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="{color}" rx="50"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
              fill="white" font-size="50" font-family="Arial, sans-serif" font-weight="bold">{letter}</text>
    </svg>'''
    
    svg_base64 = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
    return f"data:image/svg+xml;base64,{svg_base64}"


def create_real_file(content, filename, is_encrypted=False, encryption_key=None):
    """Create a real file on disk"""
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    
    if is_encrypted and encryption_key:
        fernet = Fernet(encryption_key.encode())
        encrypted_content = fernet.encrypt(content.encode())
        with open(file_path, 'wb') as f:
            f.write(encrypted_content)
    else:
        with open(file_path, 'w') as f:
            f.write(content)
    
    return file_path


def generate_file_content(file_type, filename):
    """Generate realistic content for different file types"""
    ext = filename.split('.')[-1].lower() if '.' in filename else 'txt'
    
    if file_type == 'code':
        if ext == 'py':
            return f'''"""
{filename} - Python Module
Generated for SecureBox testing
"""

import os
import sys

def main():
    print(f"Hello from {filename}")
    print("This is a test file for SecureBox platform")

if __name__ == "__main__":
    main()
'''
        elif ext == 'js':
            return f'''// {filename} - JavaScript Module
// Generated for SecureBox testing

const {filename.replace('.js', '').replace('-', '_')} = {{
    name: "{filename}",
    version: "1.0.0",
    description: "Test file for SecureBox"
}};

export default {filename.replace('.js', '').replace('-', '_')};
'''
        elif ext == 'html':
            return f'''<!DOCTYPE html>
<html>
<head>
    <title>{filename}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .container {{ max-width: 800px; margin: auto; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to {filename}</h1>
        <p>This is a test file for SecureBox platform.</p>
        <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
</body>
</html>
'''
        elif ext == 'json':
            return json.dumps({
                "name": filename,
                "type": "test_file",
                "platform": "SecureBox",
                "generated_at": datetime.now().isoformat(),
                "random_value": random.randint(1, 1000)
            }, indent=2)
        else:
            return f"// {filename}\n// Generated test file for SecureBox\n// Created: {datetime.now()}\n\nconsole.log('Hello from {filename}');\n"
    
    elif file_type == 'document':
        return f"""SecureBox Document: {filename}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

This is a test document created for the SecureBox platform.
It contains sample text to demonstrate file handling capabilities.

Features tested:
- File upload and download
- File encryption
- File sharing
- Version history
- Recycle bin

Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

--- End of document ---
"""
    
    elif file_type == 'image':
        # For images, we'll create a simple base64 encoded dummy image
        return "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    
    elif file_type == 'spreadsheet':
        return f"""Filename,Type,Size,Date
{filename},document,{random.randint(1000, 50000)},{datetime.now().strftime('%Y-%m-%d')}
test2.txt,code,{random.randint(1000, 50000)},{datetime.now().strftime('%Y-%m-%d')}
test3.pdf,pdf,{random.randint(1000, 50000)},{datetime.now().strftime('%Y-%m-%d')}
"""
    
    elif file_type == 'presentation':
        return f"""# {filename}

## Slide 1: Introduction
Welcome to this test presentation for SecureBox.

## Slide 2: Features
- File encryption
- Secure sharing
- Version control

## Slide 3: Conclusion
Thank you for using SecureBox!

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    else:
        return f"""SecureBox Test File: {filename}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

This is a test file created automatically during database initialization.
It is used for testing the SecureBox platform features.

File Type: {file_type}
Random ID: {random.randint(10000, 99999)}

Thank you for using SecureBox!
"""


def get_file_type_from_extension(filename):
    """Determine file type based on extension for mock data"""
    ext = filename.split('.')[-1].lower() if '.' in filename else 'unknown'
    
    file_type_map = {
        'document': ['pdf', 'doc', 'docx', 'txt', 'odt', 'rtf', 'md'],
        'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'],
        'video': ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v'],
        'audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'],
        'archive': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
        'code': ['js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'ts', 'jsx', 'tsx', 'json', 'xml', 'yaml', 'yml', 'sh', 'sql'],
        'spreadsheet': ['xls', 'xlsx', 'csv', 'ods'],
        'presentation': ['ppt', 'pptx', 'odp', 'key'],
        'pdf': ['pdf']
    }
    
    for ftype, extensions in file_type_map.items():
        if ext in extensions:
            return ftype
    return 'other'


def init_database():
    app = create_app()
    
    with app.app_context():
        # Drop all tables and recreate
        db.drop_all()
        db.create_all()
        
        print("=" * 70)
        print("📀 Inserting comprehensive mock data into database...")
        print("=" * 70)
        
        # ============ CREATE USERS ============
        print("\n👤 Creating users...")
        
        preferences_options = {
            'language': ['en', 'fr', 'ar', 'es', 'de'],
            'theme': ['light', 'dark', 'auto'],
            'date_format': ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
            'timezone': ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Europe/Paris'],
            'default_view': ['list', 'grid', 'compact'],
            'items_per_page': [10, 25, 50, 100],
            'email_notifications': [True, False],
            'push_notifications': [True, False],
            'upload_success': [True, False],
            'download_activity': [True, False],
            'share_requests': [True, False],
            'storage_warnings': [True, False],
            'security_alerts': [True, False],
            'weekly_digest': [True, False],
            'profile_visibility': ['public', 'team', 'private'],
            'show_email': [True, False],
            'show_activity': [True, False],
            'allow_file_indexing': [True, False]
        }
        
        users_data = [
            {'id': 1, 'username': 'admin', 'email': 'admin@securebox.com', 'password': 'admin123', 'role': 'global_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 3221225472, 'full_name': 'Admin User', 'phone': '+1 555-0001', 'mfa_enabled': True},
            {'id': 2, 'username': 'super_admin', 'email': 'super@securebox.com', 'password': 'admin123', 'role': 'global_admin', 'is_active': True, 'storage_quota': 53687091200, 'storage_used': 8589934592, 'full_name': 'Super Administrator', 'phone': '+1 555-0002', 'mfa_enabled': False},
            {'id': 3, 'username': 'sarah_smith', 'email': 'sarah@example.com', 'password': 'password123', 'role': 'space_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 3221225472, 'full_name': 'Sarah Smith', 'phone': '+1 555-1001', 'mfa_enabled': True},
            {'id': 4, 'username': 'chris_wilson', 'email': 'chris@example.com', 'password': 'password123', 'role': 'space_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 7516192768, 'full_name': 'Chris Wilson', 'phone': '+1 555-1002', 'mfa_enabled': False},
            {'id': 5, 'username': 'maria_garcia', 'email': 'maria@example.com', 'password': 'password123', 'role': 'space_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 4294967296, 'full_name': 'Maria Garcia', 'phone': '+1 555-1003', 'mfa_enabled': False},
            {'id': 6, 'username': 'john_doe', 'email': 'john@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 1572864000, 'full_name': 'John Doe', 'phone': '+1 555-2001', 'mfa_enabled': False},
            {'id': 7, 'username': 'mike_johnson', 'email': 'mike@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 4294967296, 'full_name': 'Mike Johnson', 'phone': '+1 555-2002', 'mfa_enabled': False},
            {'id': 8, 'username': 'lisa_anderson', 'email': 'lisa@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 1073741824, 'full_name': 'Lisa Anderson', 'phone': '+1 555-2003', 'mfa_enabled': True},
            {'id': 9, 'username': 'david_martin', 'email': 'david@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 2684354560, 'full_name': 'David Martin', 'phone': '+1 555-2004', 'mfa_enabled': False},
            {'id': 10, 'username': 'robert_brown', 'email': 'robert@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 524288000, 'full_name': 'Robert Brown', 'phone': '+1 555-2005', 'mfa_enabled': False},
            {'id': 11, 'username': 'jessica_taylor', 'email': 'jessica@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 3145728000, 'full_name': 'Jessica Taylor', 'phone': '+1 555-2006', 'mfa_enabled': False},
            {'id': 12, 'username': 'kevin_williams', 'email': 'kevin@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 838860800, 'full_name': 'Kevin Williams', 'phone': '+1 555-2007', 'mfa_enabled': False},
            {'id': 13, 'username': 'amy_jones', 'email': 'amy@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 2097152000, 'full_name': 'Amy Jones', 'phone': '+1 555-2008', 'mfa_enabled': False},
            {'id': 14, 'username': 'emily_brown', 'email': 'emily@example.com', 'password': 'password123', 'role': 'user', 'is_active': False, 'storage_quota': 5368709120, 'storage_used': 1048576000, 'full_name': 'Emily Brown', 'phone': '+1 555-3001', 'mfa_enabled': False},
            {'id': 15, 'username': 'tom_wilson', 'email': 'tom@example.com', 'password': 'password123', 'role': 'user', 'is_active': False, 'storage_quota': 5368709120, 'storage_used': 524288000, 'full_name': 'Tom Wilson', 'phone': '+1 555-3002', 'mfa_enabled': False},
            {'id': 16, 'username': 'new_user1', 'email': 'new1@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 0, 'full_name': 'New User One', 'phone': '+1 555-4001', 'mfa_enabled': False},
            {'id': 17, 'username': 'new_user2', 'email': 'new2@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 0, 'full_name': 'New User Two', 'phone': '+1 555-4002', 'mfa_enabled': False}
        ]
        
        users = {}
        for user_data in users_data:
            avatar_base64 = generate_placeholder_avatar(user_data['username'])
            
            user_preferences = {
                'language': random.choice(preferences_options['language']),
                'theme': random.choice(preferences_options['theme']),
                'date_format': random.choice(preferences_options['date_format']),
                'timezone': random.choice(preferences_options['timezone']),
                'default_view': random.choice(preferences_options['default_view']),
                'items_per_page': random.choice(preferences_options['items_per_page']),
                'email_notifications': random.choice(preferences_options['email_notifications']),
                'push_notifications': random.choice(preferences_options['push_notifications']),
                'upload_success': random.choice(preferences_options['upload_success']),
                'download_activity': random.choice(preferences_options['download_activity']),
                'share_requests': random.choice(preferences_options['share_requests']),
                'storage_warnings': random.choice(preferences_options['storage_warnings']),
                'security_alerts': random.choice(preferences_options['security_alerts']),
                'weekly_digest': random.choice(preferences_options['weekly_digest']),
                'profile_visibility': random.choice(preferences_options['profile_visibility']),
                'show_email': random.choice(preferences_options['show_email']),
                'show_activity': random.choice(preferences_options['show_activity']),
                'allow_file_indexing': random.choice(preferences_options['allow_file_indexing'])
            }
            
            user = User(
                id=user_data['id'],
                username=user_data['username'],
                email=user_data['email'],
                role=user_data['role'],
                is_active=user_data['is_active'],
                storage_quota=user_data['storage_quota'],
                storage_used=user_data['storage_used'],
                avatar_base64=avatar_base64,
                avatar_mime_type='image/svg+xml',
                avatar_updated_at=datetime.now() - timedelta(days=random.randint(1, 90)),
                full_name=user_data.get('full_name', user_data['username']),
                phone=user_data.get('phone', ''),
                mfa_enabled=user_data.get('mfa_enabled', False),
                preferences=user_preferences
            )
            user.password_hash = bcrypt.generate_password_hash(user_data['password']).decode('utf-8')
            db.session.add(user)
            users[user_data['id']] = user
        
        db.session.commit()
        print(f"   ✅ Created {len(users_data)} users")
        
        # ============ CREATE FOLDERS ============
        print("\n📁 Creating folders...")
        
        folders_data = [
            {'id': 1, 'name': 'Work Documents', 'owner_id': 6, 'parent_id': None},
            {'id': 2, 'name': 'Personal Photos', 'owner_id': 6, 'parent_id': None},
            {'id': 3, 'name': 'Code Projects', 'owner_id': 6, 'parent_id': None},
            {'id': 4, 'name': 'Projects', 'owner_id': 6, 'parent_id': 1},
            {'id': 5, 'name': 'Reports', 'owner_id': 6, 'parent_id': 1},
            {'id': 6, 'name': 'Archive', 'owner_id': 3, 'parent_id': None},
            {'id': 7, 'name': 'Shared', 'owner_id': 1, 'parent_id': None},
        ]
        
        folders = {}
        for folder_data in folders_data:
            folder = Folder(
                id=folder_data['id'],
                name=folder_data['name'],
                owner_id=folder_data['owner_id'],
                parent_id=folder_data['parent_id'],
                created_at=datetime.now() - timedelta(days=random.randint(1, 60)),
                is_deleted=False
            )
            db.session.add(folder)
            folders[folder_data['id']] = folder
        
        db.session.commit()
        print(f"   ✅ Created {len(folders_data)} folders")
        
        # ============ CREATE FILES (with real files on disk) ============
        print("\n📄 Creating files with real content...")
        
        file_names = [
            'Project_Report.pdf', 'Budget_2024.xlsx', 'Meeting_Notes.docx',
            'Annual_Report.pdf', 'Research_Paper.pdf', 'User_Manual.pdf',
            'Technical_Specs.pdf', 'Release_Notes.txt', 'Team_Photo.jpg',
            'Company_Logo.png', 'Product_Screenshot.png', 'app.js', 'server.py',
            'Main.java', 'styles.css', 'index.html', 'database.sql',
            'config.json', 'api.py', 'component.jsx', 'utils.ts',
            'Sales_Data.csv', 'Inventory_Report.xlsx', 'Presentation_Q4.pptx'
        ]
        
        files_data = []
        file_id = 1
        
        for i in range(40):  # Create 40 real files
            owner_id = random.choice([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
            filename = file_names[i % len(file_names)]
            file_type = get_file_type_from_extension(filename)
            
            # Assign folder (some files go to folders)
            folder_id = None
            if owner_id == 6 and file_type == 'document' and random.random() > 0.5:
                folder_id = random.choice([1, 4, 5])
            elif owner_id == 6 and file_type == 'code':
                folder_id = 3
            elif owner_id == 6 and file_type == 'image':
                folder_id = 2
            
            size_options = {
                'document': random.randint(102400, 2097152),
                'image': random.randint(51200, 1048576),
                'video': random.randint(1048576, 10485760),
                'audio': random.randint(524288, 5242880),
                'archive': random.randint(1048576, 10485760),
                'code': random.randint(10240, 524288),
                'spreadsheet': random.randint(102400, 1048576),
                'presentation': random.randint(524288, 5242880),
                'pdf': random.randint(102400, 2097152),
                'other': random.randint(10240, 524288)
            }
            
            # Generate real content and save to disk
            content = generate_file_content(file_type, filename)
            unique_filename = f"real_{file_id}_{filename.replace(' ', '_').lower()}"
            file_path = create_real_file(content, unique_filename, is_encrypted=False, encryption_key=None)
            file_size = os.path.getsize(file_path)
            
            # Randomly mark some files as encrypted (20% chance)
            is_encrypted = random.random() < 0.2
            encryption_key = generate_encryption_key() if is_encrypted else None
            file_password_hash = bcrypt.generate_password_hash(f'filepass{random.randint(100,999)}').decode('utf-8') if is_encrypted else None
            
            # If encrypted, re-encrypt the file
            if is_encrypted:
                with open(file_path, 'rb') as f:
                    original_data = f.read()
                fernet = Fernet(encryption_key.encode())
                encrypted_data = fernet.encrypt(original_data)
                with open(file_path, 'wb') as f:
                    f.write(encrypted_data)
            
            files_data.append({
                'id': file_id,
                'filename': unique_filename,
                'original_filename': filename,
                'file_path': file_path,
                'file_type': file_type,
                'size': file_size,
                'owner_id': owner_id,
                'folder_id': folder_id,
                'is_shared': random.choice([True, False]),
                'is_deleted': False,
                'is_locked': random.choice([True, False]) if random.random() > 0.85 else False,
                'locked_by': owner_id if random.random() > 0.85 else None,
                'version': 1,
                'created_at': datetime.now() - timedelta(days=random.randint(1, 180)),
                'is_encrypted': is_encrypted,
                'encryption_key': encryption_key,
                'file_password_hash': file_password_hash
            })
            file_id += 1
        
        # Add deleted files
        for i in range(10):
            owner_id = random.choice([1, 2, 3, 4, 5, 6, 7, 8])
            filename = f"deleted_file_{i}.pdf"
            content = generate_file_content('document', filename)
            unique_filename = f"deleted_{file_id}_{filename}"
            file_path = create_real_file(content, unique_filename, is_encrypted=False, encryption_key=None)
            file_size = os.path.getsize(file_path)
            
            files_data.append({
                'id': file_id,
                'filename': unique_filename,
                'original_filename': filename,
                'file_path': file_path,
                'file_type': 'document',
                'size': file_size,
                'owner_id': owner_id,
                'folder_id': None,
                'is_shared': False,
                'is_deleted': True,
                'is_locked': False,
                'locked_by': None,
                'version': 1,
                'created_at': datetime.now() - timedelta(days=random.randint(30, 90)),
                'is_encrypted': False,
                'encryption_key': None,
                'file_password_hash': None
            })
            file_id += 1
        
        files = {}
        for file_data in files_data:
            file = File(
                id=file_data['id'],
                filename=file_data['filename'],
                original_filename=file_data['original_filename'],
                file_path=file_data['file_path'],
                file_type=file_data['file_type'],
                size=file_data['size'],
                owner_id=file_data['owner_id'],
                folder_id=file_data.get('folder_id'),
                is_shared=file_data.get('is_shared', False),
                is_deleted=file_data.get('is_deleted', False),
                is_locked=file_data.get('is_locked', False),
                locked_by=file_data.get('locked_by'),
                version=file_data['version'],
                created_at=file_data['created_at'],
                is_encrypted=file_data.get('is_encrypted', False),
                encryption_key=file_data.get('encryption_key'),
                file_password_hash=file_data.get('file_password_hash')
            )
            db.session.add(file)
            files[file_data['id']] = file
        
        db.session.commit()
        print(f"   ✅ Created {len(files_data)} real files on disk")
        print(f"   🔒 Encrypted files: {len([f for f in files_data if f.get('is_encrypted')])}")
        print(f"   📁 Files in folders: {len([f for f in files_data if f.get('folder_id')])}")
        
        # ============ CREATE FILE VERSIONS ============
        print("\n🕒 Creating file versions...")
        
        author_ids = [1, 2, 3, 4, 6, 7, 8]
        version_count = 0
        
        for fid in list(files.keys())[:30]:
            if fid in files and not files[fid].is_deleted:
                num_versions = random.randint(2, 5)
                for v in range(1, num_versions + 1):
                    # Create version content
                    version_content = f"Version {v} of {files[fid].original_filename}\nUpdated: {datetime.now()}\nContent version {v}\n"
                    version_filename = f"version_{fid}_v{v}_{files[fid].filename}"
                    version_path = create_real_file(version_content, version_filename, is_encrypted=False, encryption_key=None)
                    version_size = os.path.getsize(version_path)
                    
                    file_version = FileVersion(
                        file_id=fid,
                        version_number=v,
                        filename=version_filename,
                        file_path=version_path,
                        size=version_size,
                        checksum=None,
                        author_id=random.choice(author_ids),
                        comment=f'Version {v} - {random.choice(["Initial draft", "Major revision", "Minor fixes", "Final version", "Updated content"])}',
                        created_at=files[fid].created_at + timedelta(days=random.randint(1, 30))
                    )
                    db.session.add(file_version)
                    version_count += 1
        
        db.session.commit()
        print(f"   ✅ Created {version_count} file versions")
        
        # ============ CREATE ACLS ============
        print("\n🔐 Creating ACL rules...")
        
        acls_data = []
        for fid in list(files.keys())[:30]:
            if fid in files and not files[fid].is_deleted:
                owner_id = files[fid].owner_id
                acls_data.append({
                    'file_id': fid, 'user_id': owner_id,
                    'can_read': True, 'can_write': True,
                    'can_delete': True, 'can_share': True,
                    'granted_by': owner_id
                })
                
                num_shares = random.randint(1, 3)
                for _ in range(num_shares):
                    user_id = random.choice([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
                    if user_id != owner_id:
                        acls_data.append({
                            'file_id': fid, 'user_id': user_id,
                            'can_read': True,
                            'can_write': random.choice([True, False]),
                            'can_delete': False,
                            'can_share': random.choice([True, False]),
                            'granted_by': owner_id
                        })
        
        for acl_data in acls_data:
            acl = ACL(
                file_id=acl_data['file_id'],
                user_id=acl_data['user_id'],
                can_read=acl_data['can_read'],
                can_write=acl_data['can_write'],
                can_delete=acl_data['can_delete'],
                can_share=acl_data['can_share'],
                granted_by=acl_data['granted_by'],
                granted_at=datetime.now() - timedelta(days=random.randint(1, 60))
            )
            db.session.add(acl)
        
        db.session.commit()
        print(f"   ✅ Created {len(acls_data)} ACL rules")
        
        # ============ CREATE LOGS ============
        print("\n📝 Creating activity logs...")
        
        actions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'FILE_UPLOAD', 'FILE_DOWNLOAD',
                   'FILE_DELETE', 'FILE_SHARE', 'PERMISSION_CHANGE', 'FILE_RESTORE',
                   'FILE_LOCK', 'FILE_UNLOCK', 'AVATAR_UPLOAD', 'AVATAR_DELETE',
                   'PROFILE_UPDATE', 'PASSWORD_CHANGE', 'MFA_ENABLE', 'MFA_DISABLE',
                   'PREFERENCES_UPDATE', 'QUOTA_UPDATE', 'ACL_CREATE', 'ACL_UPDATE', 'ACL_DELETE',
                   'FOLDER_CREATE', 'FOLDER_DELETE', 'FILE_RENAME', 'FILE_MOVE']
        
        users_list = ['admin', 'super_admin', 'john_doe', 'sarah_smith', 'mike_johnson',
                      'chris_wilson', 'lisa_anderson', 'david_martin', 'jessica_taylor',
                      'kevin_williams', 'amy_jones']
        
        resources = ['Project_Report.pdf', 'Budget_2024.xlsx', 'Team_Photo.jpg',
                     'Presentation_Q4.pptx', 'Marketing_Assets.zip', 'app.js', 'server.py',
                     'Annual_Report.pdf', 'Meeting_Notes.docx', 'User Avatar',
                     'Profile Information', 'Password', 'MFA Settings', 'Preferences',
                     'Work Documents', 'Code Projects']
        
        logs = []
        
        for i in range(500):
            logs.append(Log(
                user=random.choice(users_list),
                action=random.choice(actions),
                resource=random.choice(resources) if random.random() > 0.3 else None,
                ip_address=f'192.168.{random.randint(1,255)}.{random.randint(1,255)}',
                status=random.choice(['success', 'failed']),
                timestamp=datetime.now() - timedelta(hours=random.randint(0, 720), days=random.randint(0, 30))
            ))
        
        for log in logs:
            db.session.add(log)
        
        db.session.commit()
        print(f"   ✅ Created {len(logs)} activity logs")
        
        # ============ UPDATE STORAGE USAGE ============
        print("\n📊 Updating storage usage...")
        
        for user in users.values():
            user_files = [f for f in files.values() if f.owner_id == user.id and not f.is_deleted]
            user.storage_used = sum(f.size for f in user_files)
        
        db.session.commit()
        print(f"   ✅ Updated storage quotas for all users")
        
        # ============ CREATE NOTIFICATIONS ============
        print("\n🔔 Creating notifications...")

        notifications_data = [
            {'user_id': 1, 'title': 'Welcome to SecureBox', 'message': 'Welcome admin! You have full system access.', 'type': 'success', 'is_read': False},
            {'user_id': 1, 'title': 'New User Registered', 'message': 'A new user john_doe has registered.', 'type': 'info', 'is_read': False},
            {'user_id': 6, 'title': 'Welcome to SecureBox', 'message': 'Welcome john_doe! Start uploading your files.', 'type': 'success', 'is_read': False},
            {'user_id': 6, 'title': 'File Upload Complete', 'message': 'Your file "Project_Report.pdf" has been uploaded.', 'type': 'success', 'is_read': True},
            {'user_id': 6, 'title': 'Folder Created', 'message': 'Your folder "Work Documents" has been created.', 'type': 'success', 'is_read': False},
            {'user_id': 6, 'title': 'Storage Almost Full', 'message': 'You have used 85% of your storage quota.', 'type': 'warning', 'is_read': False},
            {'user_id': 3, 'title': 'Welcome to SecureBox', 'message': 'Welcome sarah_smith! You have space admin privileges.', 'type': 'success', 'is_read': True},
            {'user_id': 7, 'title': 'File Deleted', 'message': 'Your file has been moved to recycle bin.', 'type': 'info', 'is_read': False},
            {'user_id': 8, 'title': 'Storage Warning', 'message': 'You have reached 90% of your storage quota.', 'type': 'warning', 'is_read': False},
        ]

        for ndata in notifications_data:
            days_ago = random.randint(0, 30)
            notification = Notification(
                user_id=ndata['user_id'],
                title=ndata['title'],
                message=ndata['message'],
                type=ndata['type'],
                is_read=ndata['is_read'],
                created_at=datetime.now() - timedelta(days=days_ago)
            )
            if ndata['is_read']:
                notification.read_at = notification.created_at + timedelta(hours=random.randint(1, 48))
            db.session.add(notification)

        db.session.commit()
        print(f"   ✅ Created {len(notifications_data)} notifications")
        
        # ============ FINAL SUMMARY ============
        print("\n" + "=" * 70)
        print("✅ DATABASE INITIALIZATION COMPLETE!")
        print("=" * 70)
        print("\n📝 Test Credentials:")
        print("   🟢 Global Admin: admin / admin123")
        print("   🟢 Global Admin: super_admin / admin123")
        print("   🟠 Space Admin: sarah_smith / password123")
        print("   🔵 Regular User: john_doe / password123")
        print("\n📊 Data Summary:")
        print(f"   👥 Users: {len(users_data)}")
        print(f"   📁 Folders: {len(folders_data)}")
        print(f"   📄 Files: {len(files_data)} (real files on disk)")
        print(f"   🔒 Encrypted Files: {len([f for f in files_data if f.get('is_encrypted')])}")
        print(f"   🕒 File Versions: {version_count}")
        print(f"   🔐 ACL Rules: {len(acls_data)}")
        print(f"   📝 Activity Logs: {len(logs)}")
        print(f"   🔔 Notifications: {len(notifications_data)}")
        print("\n📁 Features Ready for Testing:")
        print("   ✅ User Management")
        print("   ✅ Folder Organization")
        print("   ✅ Avatar Upload/Management")
        print("   ✅ Profile Settings")
        print("   ✅ File Operations with Real Files")
        print("   ✅ File Encryption")
        print("   ✅ File Sharing")
        print("   ✅ Version History")
        print("   ✅ Activity Logs")
        print("   ✅ Recycle Bin")
        print("   ✅ Storage Quota Management")
        print("=" * 70)

if __name__ == "__main__":
    init_database()