from app import create_app
from app.realtime import socketio

app = create_app()
socketio.init_app(app)

if __name__ == "__main__":
    socketio.run(app, debug=True, port=5000)
