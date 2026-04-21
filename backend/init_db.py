"""
Initialize database with comprehensive mock data for all features
Run this script once to populate the database
"""

from app import create_app
from app.extensions import db, bcrypt
from app.models import User, File, FileVersion, ACL, Log, DeletedFile
from datetime import datetime, timedelta
import random

def init_database():
    app = create_app()
    
    with app.app_context():
        # Drop all tables and recreate
        db.drop_all()
        db.create_all()
        
        print("=" * 70)
        print("📀 Inserting comprehensive mock data into database...")
        print("=" * 70)
        
        # ============ CREATE USERS (20+ users for comprehensive testing) ============
        print("\n👤 Creating users...")
        
        users_data = [
            # Admin users
            {'id': 1, 'username': 'admin', 'email': 'admin@securebox.com', 'password': 'admin123', 'role': 'global_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 3221225472},
            {'id': 2, 'username': 'super_admin', 'email': 'super@securebox.com', 'password': 'admin123', 'role': 'global_admin', 'is_active': True, 'storage_quota': 53687091200, 'storage_used': 8589934592},
            
            # Space Admins
            {'id': 3, 'username': 'sarah_smith', 'email': 'sarah@example.com', 'password': 'password123', 'role': 'space_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 3221225472},
            {'id': 4, 'username': 'chris_wilson', 'email': 'chris@example.com', 'password': 'password123', 'role': 'space_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 7516192768},
            {'id': 5, 'username': 'maria_garcia', 'email': 'maria@example.com', 'password': 'password123', 'role': 'space_admin', 'is_active': True, 'storage_quota': 10737418240, 'storage_used': 4294967296},
            
            # Regular Users (Active)
            {'id': 6, 'username': 'john_doe', 'email': 'john@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 1572864000},
            {'id': 7, 'username': 'mike_johnson', 'email': 'mike@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 4294967296},
            {'id': 8, 'username': 'lisa_anderson', 'email': 'lisa@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 1073741824},
            {'id': 9, 'username': 'david_martin', 'email': 'david@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 2684354560},
            {'id': 10, 'username': 'robert_brown', 'email': 'robert@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 524288000},
            {'id': 11, 'username': 'jessica_taylor', 'email': 'jessica@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 3145728000},
            {'id': 12, 'username': 'kevin_williams', 'email': 'kevin@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 838860800},
            {'id': 13, 'username': 'amy_jones', 'email': 'amy@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 2097152000},
            
            # Inactive Users
            {'id': 14, 'username': 'emily_brown', 'email': 'emily@example.com', 'password': 'password123', 'role': 'user', 'is_active': False, 'storage_quota': 5368709120, 'storage_used': 1048576000},
            {'id': 15, 'username': 'tom_wilson', 'email': 'tom@example.com', 'password': 'password123', 'role': 'user', 'is_active': False, 'storage_quota': 5368709120, 'storage_used': 524288000},
            
            # Pending/New Users
            {'id': 16, 'username': 'new_user1', 'email': 'new1@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 0},
            {'id': 17, 'username': 'new_user2', 'email': 'new2@example.com', 'password': 'password123', 'role': 'user', 'is_active': True, 'storage_quota': 5368709120, 'storage_used': 0}
        ]
        
        users = {}
        for user_data in users_data:
            user = User(
                id=user_data['id'],
                username=user_data['username'],
                email=user_data['email'],
                role=user_data['role'],
                is_active=user_data['is_active'],
                storage_quota=user_data['storage_quota'],
                storage_used=user_data['storage_used']
            )
            user.password_hash = bcrypt.generate_password_hash(user_data['password']).decode('utf-8')
            db.session.add(user)
            users[user_data['id']] = user
        
        db.session.commit()
        print(f"   ✅ Created {len(users_data)} users (2 Global Admins, 3 Space Admins, 12 Regular Users)")
        
        # ============ CREATE FILES (30+ files for comprehensive testing) ============
        print("\n📄 Creating files...")
        
        file_types = ['document', 'image', 'video', 'audio', 'archive', 'other']
        file_names = [
            'Project_Report_Final.pdf', 'Budget_2024.xlsx', 'Team_Photo.jpg', 'Presentation_Q4.pptx',
            'Marketing_Assets.zip', 'Tutorial_Video.mp4', 'Annual_Report.pdf', 'Company_Logo.png',
            'Database_Backup.sql', 'Meeting_Notes.docx', 'Design_Mockup.fig', 'Research_Paper.pdf',
            'Financial_Statement.xlsx', 'Product_Catalog.pdf', 'Training_Video.mp4', 'Audio_Recording.mp3',
            'Source_Code.zip', 'User_Manual.pdf', 'Sales_Data.csv', 'Inventory_Report.xlsx',
            'Marketing_Plan.docx', 'Brand_Guidelines.pdf', 'Product_Photos.zip', 'Webinar_Recording.mp4',
            'Customer_Feedback.xlsx', 'Technical_Specs.pdf', 'Release_Notes.txt', 'Backup_Files.zip'
        ]
        
        files_data = []
        file_id = 1
        for i in range(35):  # Create 35 files
            owner_id = random.choice([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
            file_type = random.choice(file_types)
            size_options = {'document': 15728640, 'image': 5242880, 'video': 104857600, 'audio': 5242880, 'archive': 209715200, 'other': 15728640}
            
            files_data.append({
                'id': file_id,
                'filename': f"unique_{file_names[i % len(file_names)].lower().replace(' ', '_')}",
                'original_filename': file_names[i % len(file_names)],
                'file_type': file_type,
                'size': size_options.get(file_type, 15728640),
                'owner_id': owner_id,
                'is_shared': random.choice([True, False]),
                'is_deleted': False,
                'is_locked': random.choice([True, False]) if random.random() > 0.7 else False,
                'locked_by': owner_id if random.random() > 0.7 else None,
                'version': random.randint(1, 10),
                'created_at': datetime.now() - timedelta(days=random.randint(1, 180))
            })
            file_id += 1
        
        # Add some deleted files
        for i in range(5):
            files_data.append({
                'id': file_id,
                'filename': f"deleted_file_{i}.pdf",
                'original_filename': f"Deleted_File_{i}.pdf",
                'file_type': 'document',
                'size': 1048576,
                'owner_id': random.choice([1, 2, 3, 4, 5, 6]),
                'is_shared': False,
                'is_deleted': True,
                'is_locked': False,
                'locked_by': None,
                'version': 1,
                'created_at': datetime.now() - timedelta(days=random.randint(30, 90))
            })
            file_id += 1
        
        files = {}
        for file_data in files_data:
            file = File(
                id=file_data['id'],
                filename=file_data['filename'],
                original_filename=file_data['original_filename'],
                file_path=f"/uploads/{file_data['filename']}",
                file_type=file_data['file_type'],
                size=file_data['size'],
                owner_id=file_data['owner_id'],
                is_shared=file_data.get('is_shared', False),
                is_deleted=file_data.get('is_deleted', False),
                is_locked=file_data.get('is_locked', False),
                locked_by=file_data.get('locked_by'),
                version=file_data['version'],
                created_at=file_data['created_at']
            )
            db.session.add(file)
            files[file_data['id']] = file
        
        db.session.commit()
        print(f"   ✅ Created {len(files_data)} files (30 active + 5 deleted)")
        
        # ============ CREATE FILE VERSIONS (for all major files) ============
        print("\n🕒 Creating file versions...")
        
        versions_data = {}
        
        # Generate versions for files 1-20
        for file_id in range(1, 21):
            if file_id in files:
                num_versions = random.randint(3, 12)
                versions_data[file_id] = []
                for v in range(num_versions, 0, -1):
                    author = random.choice(['Admin', 'John Doe', 'Sarah Smith', 'Mike Johnson', 'Lisa Anderson'])
                    versions_data[file_id].append({
                        'version': num_versions - v + 1,
                        'author': author,
                        'size': files[file_id].size + random.randint(-1000000, 1000000),
                        'comment': f'Version {num_versions - v + 1} - {random.choice(["Initial draft", "Major revision", "Minor fixes", "Final version", "Updated content", "Reviewed version"])}'
                    })
        
        version_count = 0
        for file_id, versions in versions_data.items():
            for v in versions:
                file_version = FileVersion(
                    file_id=file_id,
                    version=v['version'],
                    author=v['author'],
                    size=v['size'],
                    comment=v['comment'],
                    created_at=datetime.now() - timedelta(days=random.randint(1, 90))
                )
                db.session.add(file_version)
                version_count += 1
        
        db.session.commit()
        print(f"   ✅ Created {version_count} file versions")
        
        # ============ CREATE ACLS (extensive permissions) ============
        print("\n🔐 Creating ACL rules...")
        
        acls_data = []
        acl_id = 1
        
        # Create ACLs for various files and users
        for file_id in range(1, 21):
            if file_id in files:
                # Owner has full access
                owner_id = files[file_id].owner_id
                acls_data.append({
                    'id': acl_id, 'file_id': file_id, 'user_id': owner_id,
                    'can_read': True, 'can_write': True, 'can_delete': True, 'can_share': True,
                    'granted_by': owner_id
                })
                acl_id += 1
                
                # Share with 2-4 random users
                num_shares = random.randint(2, 4)
                for _ in range(num_shares):
                    user_id = random.choice([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
                    if user_id != owner_id:
                        acls_data.append({
                            'id': acl_id, 'file_id': file_id, 'user_id': user_id,
                            'can_read': True,
                            'can_write': random.choice([True, False]),
                            'can_delete': False,
                            'can_share': random.choice([True, False]),
                            'granted_by': owner_id
                        })
                        acl_id += 1
        
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
        
        # ============ CREATE LOGS (200+ logs for comprehensive testing) ============
        print("\n📝 Creating activity logs...")
        
        actions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FILE_SHARE', 'PERMISSION_CHANGE', 'FILE_RESTORE', 'FILE_LOCK', 'FILE_UNLOCK']
        users_list = ['admin', 'super_admin', 'john_doe', 'sarah_smith', 'mike_johnson', 'chris_wilson', 'lisa_anderson', 'david_martin', 'jessica_taylor', 'kevin_williams', 'amy_jones']
        resources = ['Project_Report.pdf', 'Budget_2024.xlsx', 'Team_Photo.jpg', 'Presentation_Q4.pptx', 'Marketing_Assets.zip', 'Annual_Report.pdf', 'Meeting_Notes.docx']
        
        logs = []
        
        # Generate 200 random logs
        for i in range(200):
            user = random.choice(users_list)
            action = random.choice(actions)
            logs.append(Log(
                user=user,
                action=action,
                resource=random.choice(resources) if random.random() > 0.3 else None,
                ip_address=f'192.168.{random.randint(1, 255)}.{random.randint(1, 255)}',
                status=random.choice(['success', 'failed']) if action != 'LOGIN_SUCCESS' else 'success',
                timestamp=datetime.now() - timedelta(hours=random.randint(0, 720), days=random.randint(0, 30))
            ))
        
        # Add specific important logs for testing
        important_logs = [
            # Login activities
            {'user': 'admin', 'action': 'LOGIN_SUCCESS', 'resource': None, 'ip_address': '192.168.1.100', 'status': 'success'},
            {'user': 'john_doe', 'action': 'LOGIN_SUCCESS', 'resource': None, 'ip_address': '192.168.1.101', 'status': 'success'},
            {'user': 'unknown', 'action': 'LOGIN_FAILED', 'resource': None, 'ip_address': '203.0.113.50', 'status': 'failed'},
            {'user': 'unknown', 'action': 'LOGIN_FAILED', 'resource': None, 'ip_address': '203.0.113.51', 'status': 'failed'},
            
            # File operations
            {'user': 'admin', 'action': 'FILE_UPLOAD', 'resource': 'Critical_System_Backup.zip', 'ip_address': '192.168.1.100', 'status': 'success'},
            {'user': 'john_doe', 'action': 'FILE_DOWNLOAD', 'resource': 'Confidential_Report.pdf', 'ip_address': '192.168.1.101', 'status': 'success'},
            {'user': 'sarah_smith', 'action': 'FILE_DELETE', 'resource': 'Old_Contract.pdf', 'ip_address': '192.168.1.102', 'status': 'success'},
            {'user': 'mike_johnson', 'action': 'FILE_SHARE', 'resource': 'Team_Photo.jpg', 'ip_address': '192.168.1.103', 'status': 'success'},
            {'user': 'chris_wilson', 'action': 'FILE_LOCK', 'resource': 'Budget_2024.xlsx', 'ip_address': '192.168.1.104', 'status': 'success'},
            {'user': 'lisa_anderson', 'action': 'FILE_UNLOCK', 'resource': 'Budget_2024.xlsx', 'ip_address': '192.168.1.105', 'status': 'success'},
            
            # Permission changes
            {'user': 'admin', 'action': 'PERMISSION_CHANGE', 'resource': 'Project_Report.pdf', 'ip_address': '192.168.1.100', 'status': 'success'},
            {'user': 'sarah_smith', 'action': 'PERMISSION_CHANGE', 'resource': 'Shared_Folder', 'ip_address': '192.168.1.102', 'status': 'success'},
            
            # Restore operations
            {'user': 'admin', 'action': 'FILE_RESTORE', 'resource': 'Deleted_File.pdf', 'ip_address': '192.168.1.100', 'status': 'success'},
            {'user': 'john_doe', 'action': 'FILE_RESTORE', 'resource': 'Important_Document.docx', 'ip_address': '192.168.1.101', 'status': 'success'},
            
            # Bulk operations
            {'user': 'admin', 'action': 'FILE_UPLOAD', 'resource': 'Batch_Upload_1.zip', 'ip_address': '192.168.1.100', 'status': 'success'},
            {'user': 'admin', 'action': 'FILE_UPLOAD', 'resource': 'Batch_Upload_2.zip', 'ip_address': '192.168.1.100', 'status': 'success'},
            {'user': 'admin', 'action': 'FILE_UPLOAD', 'resource': 'Batch_Upload_3.zip', 'ip_address': '192.168.1.100', 'status': 'success'},
        ]
        
        for log_data in important_logs:
            logs.append(Log(**log_data, timestamp=datetime.now() - timedelta(hours=random.randint(1, 48))))
        
        for log in logs:
            db.session.add(log)
        
        db.session.commit()
        print(f"   ✅ Created {len(logs)} activity logs (200+ events)")
        
        # ============ CREATE DELETED FILES (recycle bin items) ============
        print("\n🗑️ Creating deleted files...")
        
        deleted_files_data = []
        for i in range(15):
            owner_id = random.choice([1, 2, 3, 4, 5, 6, 7, 8])
            days_ago = random.randint(1, 29)
            deleted_files_data.append({
                'original_id': 1000 + i,
                'filename': f"deleted_file_{i}.pdf",
                'original_filename': f"Deleted_File_{i}.pdf",
                'size': random.choice([1048576, 2097152, 5242880, 10485760, 52428800]),
                'owner_id': owner_id,
                'file_type': random.choice(['document', 'image', 'archive']),
                'permanent_delete_days': 30 - days_ago,
                'deleted_date': datetime.now() - timedelta(days=days_ago)
            })
        
        for df_data in deleted_files_data:
            deleted_file = DeletedFile(
                original_id=df_data['original_id'],
                filename=df_data['filename'],
                original_filename=df_data['original_filename'],
                size=df_data['size'],
                owner_id=df_data['owner_id'],
                file_type=df_data['file_type'],
                permanent_delete_days=df_data['permanent_delete_days'],
                deleted_date=df_data['deleted_date']
            )
            db.session.add(deleted_file)
        
        db.session.commit()
        print(f"   ✅ Created {len(deleted_files_data)} deleted files in recycle bin")
        
        # ============ CREATE ADDITIONAL DATA FOR QUOTA MANAGEMENT ============
        print("\n📊 Creating quota management data...")
        
        # Update storage used for users to realistic values
        for user in users.values():
            if user.id in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]:
                # Calculate storage based on files owned
                user_files = [f for f in files.values() if f.owner_id == user.id and not f.is_deleted]
                user.storage_used = sum(f.size for f in user_files)
        
        db.session.commit()
        print(f"   ✅ Updated storage quotas for all users")
        
        # ============ FINAL SUMMARY ============
        print("\n" + "=" * 70)
        print("✅ DATABASE INITIALIZATION COMPLETE!")
        print("=" * 70)
        print("\n📝 Test Credentials:")
        print("   🟢 Global Admin: admin / admin123")
        print("   🟢 Global Admin: super_admin / admin123")
        print("   🟠 Space Admin: sarah_smith / password123")
        print("   🔵 Regular User: john_doe / password123")
        print("   🔵 Regular User: mike_johnson / password123")
        print("\n📊 Data Summary:")
        print(f"   👥 Users: {len(users_data)} (2 Global Admins, 3 Space Admins, 12 Regular Users)")
        print(f"   📄 Files: {len(files_data)} (30 active, 5 deleted)")
        print(f"   🕒 File Versions: {version_count}")
        print(f"   🔐 ACL Rules: {len(acls_data)}")
        print(f"   📝 Activity Logs: {len(logs)}")
        print(f"   🗑️ Deleted Files: {len(deleted_files_data)}")
        print("\n📁 Features Ready for Testing:")
        print("   ✅ User Management (Create/Edit/Delete users)")
        print("   ✅ Role Management (Global Admin, Space Admin, User)")
        print("   ✅ File Operations (Upload/Download/Delete/Restore)")
        print("   ✅ File Locking (Concurrent access control)")
        print("   ✅ File Sharing (ACL permissions)")
        print("   ✅ Version History (Multiple versions per file)")
        print("   ✅ Activity Logs (Audit trail)")
        print("   ✅ Recycle Bin (Soft delete with auto-purge)")
        print("   ✅ Storage Quota Management")
        print("   ✅ Search Functionality (Files, Users, Activities)")
        print("=" * 70)

if __name__ == "__main__":
    init_database()