# Add at the top of files.py
from cryptography.fernet import Fernet
import base64
import bcrypt

# Define encryption helper functions
def generate_encryption_key():
    """Generate a new encryption key"""
    return Fernet.generate_key().decode('utf-8')

def encrypt_file_data(data, key):
    """Encrypt file data"""
    fernet = Fernet(key.encode())
    return fernet.encrypt(data)

def decrypt_file_data(encrypted_data, key):
    """Decrypt file data"""
    fernet = Fernet(key.encode())
    return fernet.decrypt(encrypted_data)

def hash_file_password(password):
    """Hash a file password"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_file_password(hashed_password, password):
    """Verify file password"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))


@files_bp.route('/files/upload', methods=['POST'])
@jwt_required()
def upload_file():
    """Upload a new file with optional encryption and password"""
    user_id = int(get_jwt_identity())

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    original_filename = secure_filename(file.filename)
    
    # Get encryption options from form data
    require_password = request.form.get('require_password') == 'true'
    file_password = request.form.get('file_password')
    
    # Validate password if required
    if require_password and (not file_password or len(file_password) < 4):
        return jsonify({'error': 'Password is required and must be at least 4 characters'}), 400
    
    # Read file data
    file_data = file.read()
    file_size = len(file_data)
    
    # Check storage quota
    if user.storage_used + file_size > user.storage_quota:
        return jsonify({'error': 'Storage quota exceeded'}), 400
    
    # Handle encryption if password is set
    encryption_key = None
    file_password_hash = None
    final_file_data = file_data
    
    if require_password and file_password:
        encryption_key = generate_encryption_key()
        final_file_data = encrypt_file_data(file_data, encryption_key)
        file_password_hash = hash_file_password(file_password)
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}_{original_filename}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    
    # Save encrypted or plain file
    with open(file_path, 'wb') as f:
        f.write(final_file_data)
    
    # Detect file type
    ext = original_filename.split('.')[-1].lower() if '.' in original_filename else 'unknown'
    file_type_map = {
        'document': ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'md', 'rtf'],
        'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'],
        'video': ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v'],
        'audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'],
        'archive': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
        'code': ['js', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'ts', 'jsx', 'tsx', 'json', 'xml', 'yaml', 'yml'],
        'spreadsheet': ['xls', 'xlsx', 'csv', 'ods'],
        'presentation': ['ppt', 'pptx', 'odp', 'key'],
        'pdf': ['pdf']
    }
    file_type = 'other'
    for ftype, extensions in file_type_map.items():
        if ext in extensions:
            file_type = ftype
            break
    
    # Calculate checksum
    sha256_hash = hashlib.sha256()
    sha256_hash.update(file_data)
    checksum = sha256_hash.hexdigest()
    
    existing_file = File.query.filter_by(original_filename=original_filename, owner_id=user_id).first()
    version = (existing_file.version + 1) if existing_file else 1
    
    new_file = File(
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_type=file_type,
        size=file_size,
        owner_id=user_id,
        is_shared=False,
        is_deleted=False,
        is_locked=False,
        version=version,
        checksum=checksum,
        is_encrypted=require_password,
        file_password_hash=file_password_hash,
        encryption_key=encryption_key
    )
    db.session.add(new_file)
    db.session.flush()
    
    # Save version record
    file_version = FileVersion(
        file_id=new_file.id,
        version_number=version,
        filename=unique_filename,
        file_path=file_path,
        size=file_size,
        checksum=checksum,
        author_id=user_id,
        comment=request.form.get('comment', f'Version {version}')
    )
    db.session.add(file_version)
    
    user.storage_used += file_size
    
    log = Log(
        user=user.username,
        action='FILE_UPLOAD',
        resource=original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    # Storage warning notification
    storage_percentage = ((user.storage_used) / user.storage_quota) * 100
    if storage_percentage >= 90:
        create_notification(
            user_id=user_id,
            title="⚠️ Storage Almost Full",
            message=f"You have used {storage_percentage:.1f}% of your storage quota.",
            notification_type="warning"
        )
    
    return jsonify({
        'message': 'File uploaded successfully',
        'file_id': new_file.id,
        'filename': original_filename,
        'file_type': file_type,
        'size': file_size,
        'version': version,
        'is_encrypted': new_file.is_encrypted
    }), 201


@files_bp.route('/files/download/<int:file_id>', methods=['POST'])
@jwt_required()
def download_file(file_id):
    """Download a file with optional password verification"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    data = request.get_json() or {}
    file_password = data.get('password')
    
    file = File.query.filter_by(id=file_id, is_deleted=False).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    has_access = False
    if file.owner_id == user_id:
        has_access = True
    else:
        acl = ACL.query.filter_by(file_id=file_id, user_id=user_id, can_read=True).first()
        if acl:
            has_access = True
    
    if not has_access and user.role != 'global_admin':
        return jsonify({'error': 'Access denied'}), 403
    
    # Check if file is password protected
    if file.is_encrypted and file.file_password_hash:
        if not file_password:
            return jsonify({'error': 'Password required', 'requires_password': True}), 402
        if not verify_file_password(file.file_password_hash, file_password):
            return jsonify({'error': 'Invalid password'}), 401
    
    # Read file data
    with open(file.file_path, 'rb') as f:
        file_data = f.read()
    
    # Decrypt if necessary
    if file.is_encrypted and file.encryption_key:
        try:
            file_data = decrypt_file_data(file_data, file.encryption_key)
        except Exception as e:
            return jsonify({'error': 'Failed to decrypt file'}), 500
    
    log = Log(
        user=user.username,
        action='FILE_DOWNLOAD',
        resource=file.original_filename,
        ip_address=request.remote_addr,
        status='success'
    )
    db.session.add(log)
    db.session.commit()
    
    return send_file(
        io.BytesIO(file_data),
        as_attachment=True,
        download_name=file.original_filename,
        mimetype='application/octet-stream'
    )