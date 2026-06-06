"""
Real-time collaboration via SocketIO.
- Editor emits content changes + cursor position
- Viewers receive them in read-only mode
"""

from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import decode_token
from .models import File, ACL, User
from .extensions import db

socketio = SocketIO(cors_allowed_origins="http://localhost:3000", async_mode='threading')

# Track who is in each file room: {file_id: {sid: {user_id, username, role}}}
active_viewers = {}


def get_user_from_token(token):
    """Decode JWT and return user"""
    try:
        decoded = decode_token(token)
        user_id = int(decoded['sub'])
        return User.query.get(user_id)
    except Exception:
        return None


def has_read_access(user, file):
    """Check if user can view this file"""
    if user.role == 'global_admin':
        return True
    if file.owner_id == user.id:
        return True
    acl = ACL.query.filter_by(file_id=file.id, user_id=user.id, can_read=True).first()
    return acl is not None


@socketio.on('join_file')
def handle_join(data):
    """User joins a file room to view live edits"""
    token = data.get('token')
    file_id = data.get('file_id')

    user = get_user_from_token(token)
    if not user:
        emit('error', {'message': 'Authentication failed'})
        return

    file = File.query.get(file_id)
    if not file:
        emit('error', {'message': 'File not found'})
        return

    if not has_read_access(user, file):
        emit('error', {'message': 'Access denied'})
        return

    room = f'file_{file_id}'
    join_room(room)

    is_editor = bool(file.is_locked and file.locked_by == user.id)

    if file_id not in active_viewers:
        active_viewers[file_id] = {}
    from flask import request as flask_request
    active_viewers[file_id][flask_request.sid] = {
        'user_id': user.id,
        'username': user.username,
        'is_editor': is_editor
    }

    print(f"[WS] {user.username} joined room {room} (is_editor={is_editor}, sid={flask_request.sid})")

    # Notify room of updated viewer list
    emit('viewers_updated', get_viewer_list(file_id), to=room)


@socketio.on('leave_file')
def handle_leave(data):
    file_id = data.get('file_id')
    room = f'file_{file_id}'
    leave_room(room)

    from flask import request as flask_request
    if file_id in active_viewers:
        active_viewers[file_id].pop(flask_request.sid, None)
        emit('viewers_updated', get_viewer_list(file_id), to=room)


@socketio.on('disconnect')
def handle_disconnect():
    """Clean up viewer from all rooms on disconnect. Auto-unlock if editor disconnects."""
    from flask import request as flask_request
    for file_id in list(active_viewers.keys()):
        if flask_request.sid in active_viewers[file_id]:
            viewer = active_viewers[file_id][flask_request.sid]
            # If the disconnecting user was the editor, unlock the file
            if viewer.get('is_editor'):
                file = File.query.get(file_id)
                if file and file.is_locked and file.locked_by == viewer['user_id']:
                    file.is_locked = False
                    file.locked_by = None
                    file.locked_at = None
                    db.session.commit()
                room = f'file_{file_id}'
                emit('editor_disconnected', {'message': 'Editor disconnected. File unlocked.'}, to=room)
            active_viewers[file_id].pop(flask_request.sid)
            room = f'file_{file_id}'
            emit('viewers_updated', get_viewer_list(file_id), to=room)
        if not active_viewers[file_id]:
            del active_viewers[file_id]


@socketio.on('content_change')
def handle_content_change(data):
    """Editor broadcasts content changes to viewers"""
    file_id = data.get('file_id')
    content = data.get('content')
    cursor = data.get('cursor')

    from flask import request as flask_request
    viewers = active_viewers.get(file_id, {})
    viewer_info = viewers.get(flask_request.sid)
    if not viewer_info or not viewer_info.get('is_editor'):
        # Fallback: check if this user locked the file
        token = data.get('token')
        user = get_user_from_token(token)
        if not user:
            return
        file = File.query.get(file_id)
        if not file or not (file.is_locked and file.locked_by == user.id):
            return
        username = user.username
    else:
        username = viewer_info['username']

    room = f'file_{file_id}'
    emit('live_update', {
        'content': content,
        'cursor': cursor,
        'editor': username
    }, to=room, include_self=False)


@socketio.on('cursor_move')
def handle_cursor_move(data):
    """Editor broadcasts cursor position"""
    file_id = data.get('file_id')
    cursor = data.get('cursor')

    from flask import request as flask_request
    viewers = active_viewers.get(file_id, {})
    viewer_info = viewers.get(flask_request.sid)
    if not viewer_info or not viewer_info.get('is_editor'):
        token = data.get('token')
        user = get_user_from_token(token)
        if not user:
            return
        file = File.query.get(file_id)
        if not file or not (file.is_locked and file.locked_by == user.id):
            return
        username = user.username
    else:
        username = viewer_info['username']

    room = f'file_{file_id}'
    emit('cursor_update', {
        'cursor': cursor,
        'editor': username
    }, to=room, include_self=False)


def get_viewer_list(file_id):
    """Get list of active viewers for a file"""
    viewers = active_viewers.get(file_id, {})
    return [{'username': v['username'], 'is_editor': v['is_editor']} for v in viewers.values()]
