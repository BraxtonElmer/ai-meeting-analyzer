from flask import Flask, request, jsonify
import subprocess
import sys
from pathlib import Path
import os
from flask_cors import CORS
import logging
import threading
import json
from flask_socketio import SocketIO, emit
from datetime import datetime
from direct_db_pg import add_transcription_entry, update_transcription_live_status
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes
socketio = SocketIO(app, 
                    cors_allowed_origins="*",
                    logger=True, 
                    engineio_logger=True,
                    ping_timeout=60,
                    ping_interval=25,
                    async_mode='threading')  # Use threading mode for better performance

# Store active bot processes
active_bots = {}

# Store active meetings and their captions
active_meetings = {}

# Store recent transcription hashes to detect duplicates (meeting_id -> set of text hashes)
recent_transcriptions = {}

# Maximum number of recent transcriptions to keep per meeting (for memory management)
MAX_RECENT_TRANSCRIPTIONS = 100

def generate_text_hash(text, speaker):
    """Generate a hash from text and speaker to identify duplicate captions"""
    combined = f"{text.strip().lower()}:{speaker.strip().lower()}"
    return hashlib.md5(combined.encode()).hexdigest()

@app.route('/api/caption-bot/start', methods=['POST'])
def start_caption_bot():
    data = request.json
    meeting_url = data.get('meetingUrl')
    meeting_id = data.get('meetingId')
    
    logger.info(f"Received bot start request with meeting URL: {meeting_url}, ID: {meeting_id}")
    
    if not meeting_url:
        logger.error("No meeting URL provided in request")
        return jsonify({"status": "error", "message": "No meeting URL provided"}), 400

    if not meeting_id:
        logger.error("No meeting ID provided in request")
        return jsonify({"status": "error", "message": "No meeting ID provided"}), 400

    # Check if a bot is already running for this meeting
    if meeting_id in active_bots and active_bots[meeting_id].poll() is None:
        logger.info(f"Bot already running for meeting ID: {meeting_id}")
        return jsonify({"status": "success", "message": "Bot already running"}), 200

    try:
        # Create the callback URL for the bot to send captions to
        callback_url = f"http://localhost:5050/api/caption-bot/callback"
        # Log to a file so we can debug if it fails
        log_path = Path(f"bot_output_{meeting_id}.log")
        logger.info(f"Starting caption bot with meeting URL: {meeting_url}")
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Python executable: {sys.executable}")
        logger.info(f"Caption bot script path: {os.path.join(os.path.dirname(__file__), 'direct_caption_bot.py')}")
        
        with open(log_path, "w") as f:
            process = subprocess.Popen(
                [sys.executable, "direct_caption_bot.py", meeting_url, str(meeting_id), callback_url],
                stdout=f,
                stderr=subprocess.STDOUT,
                cwd=os.path.dirname(__file__)  # Ensure it runs from correct directory
            )
        
        # Store the process
        active_bots[meeting_id] = process
        
        # Initialize empty list for this meeting's captions
        active_meetings[meeting_id] = []
        
        logger.info(f"Bot process started with PID: {process.pid}")
        return jsonify({
            "status": "success", 
            "message": "Bot started.",
            "meetingId": meeting_id
        })
    except Exception as e:
        logger.error(f"Error starting bot: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/caption-bot/stop', methods=['POST'])
def stop_caption_bot():
    data = request.json
    meeting_id = data.get('meetingId')
    
    if not meeting_id:
        return jsonify({"status": "error", "message": "No meeting ID provided"}), 400
    
    if meeting_id in active_bots:
        process = active_bots[meeting_id]
        if process.poll() is None:  # Process is still running
            process.terminate()
            logger.info(f"Terminated bot process for meeting ID: {meeting_id}")
            
        # Update all transcriptions for this meeting to live=false
        try:
            update_result = update_transcription_live_status(meeting_id, False)
            if update_result:
                logger.info(f"Successfully updated transcription status to non-live for meeting {meeting_id}")
            else:
                logger.warning(f"Failed to update transcription status for meeting {meeting_id}")
        except Exception as e:
            logger.error(f"Error updating transcription status: {e}")
            
        # Clean up
        del active_bots[meeting_id]
        
        return jsonify({"status": "success", "message": "Bot stopped"})
    else:
        return jsonify({"status": "error", "message": "No bot running for this meeting ID"}), 404

@app.route('/api/caption-bot/callback', methods=['POST'])
def caption_callback():
    caption_data = request.json
    meeting_id = caption_data.get('meetingId')
    
    if not meeting_id:
        logger.error("No meeting ID in caption data")
        return jsonify({"status": "error", "message": "No meeting ID provided"}), 400
      # Get the text and speaker from the caption data
    text = caption_data.get('text', '').strip()
    speaker = caption_data.get('speaker', 'Unknown').strip()
    
    # Skip empty texts
    if not text:
        logger.info(f"Skipping empty text from {speaker}")
        return jsonify({"status": "success", "message": "Empty text skipped"})
    
    # Keep track of the most recent text from each speaker to prevent duplicates
    if not hasattr(app, 'latest_speaker_texts'):
        app.latest_speaker_texts = {}
    
    speaker_key = f"{meeting_id}:{speaker.lower()}"
    
    # If we've seen this speaker before, check if this is an incremental update
    if speaker_key in app.latest_speaker_texts:
        prev_text = app.latest_speaker_texts[speaker_key]
        
        # Skip if exact duplicate
        if prev_text.lower() == text.lower():
            logger.info(f"Skipping exact duplicate text from {speaker}: {text}")
            return jsonify({"status": "success", "message": "Duplicate text skipped"})
        
        # If the new text includes all of the previous text, extract only the new content
        if prev_text.lower() in text.lower():
            # Find where previous text ends and extract only the new part
            idx = text.lower().find(prev_text.lower()) + len(prev_text)
            new_text = text[idx:].strip()
            
            if new_text:
                logger.info(f"Extracted new content from incremental caption: '{new_text}'")
                text = new_text
            else:
                logger.info(f"No new content in incremental caption, skipping")
                return jsonify({"status": "success", "message": "No new content"})
    
    # Update the latest text for this speaker
    app.latest_speaker_texts[speaker_key] = text
    
    # Store the caption locally
    if meeting_id in active_meetings:
        active_meetings[meeting_id].append(caption_data)
    
    # Create a unique ID for this entry
    entry_id = f"{meeting_id}-{len(active_meetings.get(meeting_id, []))}"
    
    # Add a timestamp if not provided
    if 'timestamp' not in caption_data:
        caption_data['timestamp'] = datetime.now().isoformat()
    
    # Save directly to database using direct DB connection
    try:
        db_entry = add_transcription_entry(
            meeting_id=meeting_id,
            speaker_name=caption_data.get('speaker', 'Unknown'),
            text=caption_data.get('text', ''),
            timestamp=caption_data.get('timestamp'),
            live=True
        )
        
        # If database save was successful, use the returned entry
        if db_entry:
            logger.info(f"Saved transcription to database with ID {db_entry.get('id')}")
            
            # Format entry for WebSocket
            entry = {
                'id': db_entry.get('id'),
                'meetingId': meeting_id,
                'userId': db_entry.get('user_id'),
                'text': db_entry.get('text'),
                'timestamp': db_entry.get('timestamp').isoformat() if hasattr(db_entry.get('timestamp'), 'isoformat') else db_entry.get('timestamp'),
                'createdAt': db_entry.get('created_at').isoformat() if hasattr(db_entry.get('created_at'), 'isoformat') else db_entry.get('created_at'),
                'live': db_entry.get('live', True),
                'user': {
                    'id': db_entry.get('user_id'),
                    'username': 'speaker',
                    'fullName': db_entry.get('full_name', caption_data.get('speaker', 'Unknown Speaker')),
                    'email': 'speaker@example.com',
                    'avatarInitials': db_entry.get('avatar_initials', caption_data.get('speaker', 'U')[0:1].upper()),
                    'avatarColor': db_entry.get('avatar_color', 'bg-blue-400')
                }
            }
        else:
            # Prepare entry in the format expected by the frontend as fallback
            timestamp = caption_data.get('timestamp', datetime.now().isoformat())
            entry = {
                'id': entry_id,
                'meetingId': int(meeting_id) if str(meeting_id).isdigit() else meeting_id,
                'userId': 1,  # Placeholder user ID
                'text': caption_data.get('text', ''),
                'timestamp': timestamp,
                'createdAt': timestamp,
                'live': True,
                'user': {
                    'id': 1,
                    'username': 'speaker',
                    'fullName': caption_data.get('speaker', 'Unknown Speaker'),
                    'email': 'speaker@example.com',
                    'avatarInitials': caption_data.get('speaker', 'U')[0:1].upper(),
                    'avatarColor': 'bg-blue-400'
                }
            }
    except Exception as e:
        logger.error(f"Error saving to database: {str(e)}")
        # Fallback if database save fails
        timestamp = caption_data.get('timestamp', datetime.now().isoformat())
        entry = {
            'id': entry_id,
            'meetingId': int(meeting_id) if str(meeting_id).isdigit() else meeting_id,
            'userId': 1,
            'text': caption_data.get('text', ''),
            'timestamp': timestamp,
            'createdAt': timestamp,
            'live': True,
            'user': {
                'id': 1,
                'username': 'speaker',
                'fullName': caption_data.get('speaker', 'Unknown Speaker'),
                'email': 'speaker@example.com',
                'avatarInitials': caption_data.get('speaker', 'U')[0:1].upper(),
                'avatarColor': 'bg-blue-400'
            }
        }
      # Emit the caption via WebSocket to the specific meeting room
    try:
        room = str(meeting_id)
        logger.info(f"Emitting transcription to room: {room}")
        
        # Prepare the payload
        payload = {
            'type': 'transcription',
            'data': {
                'entry': entry
            }
        }
        logger.info(f"Emitting payload: {json.dumps(payload)}")
        
        # Emit the event
        socketio.emit('transcription', payload, room=room)
        
        # Also emit to the global namespace for clients that haven't joined a room
        socketio.emit('transcription', payload)
        
        logger.info(f"Successfully emitted transcription to room {room}")
    except Exception as e:
        logger.error(f"Error emitting transcription: {str(e)}")
        logger.exception("WebSocket emission exception details:")
    
    return jsonify({"status": "success"})

@app.route('/api/caption-bot/captions/<meeting_id>', methods=['GET'])
def get_captions(meeting_id):
    if meeting_id in active_meetings:
        return jsonify({
            "status": "success", 
            "captions": active_meetings[meeting_id]
        })
    else:
        return jsonify({"status": "error", "message": "No captions found for this meeting ID"}), 404

@app.route('/api/test-websocket/<meeting_id>', methods=['GET'])
def test_websocket(meeting_id):
    """Test endpoint to manually emit a WebSocket message for a meeting"""
    try:
        room = str(meeting_id)
        
        # Create a test entry
        test_entry = {
            'id': f"test-manual-{meeting_id}-{datetime.now().timestamp()}",
            'meetingId': meeting_id,
            'userId': 1,
            'text': f'Manual test transcription sent at {datetime.now().isoformat()}',
            'timestamp': datetime.now().isoformat(),
            'createdAt': datetime.now().isoformat(),
            'live': True,
            'user': {
                'id': 1,
                'username': 'system',
                'fullName': 'Manual Test',
                'email': 'system@example.com',
                'avatarInitials': 'MT',
                'avatarColor': 'bg-red-400'
            }
        }
        
        # Emit the test message
        socketio.emit('transcription', {
            'type': 'transcription',
            'data': {
                'entry': test_entry
            }
        }, room=room)
        
        # Also emit to all clients
        socketio.emit('transcription', {
            'type': 'transcription',
            'data': {
                'entry': test_entry
            }
        })
        
        logger.info(f"Manually sent test transcription to room {room}")
        
        return jsonify({
            "status": "success",
            "message": f"Test message sent to meeting {meeting_id}",
            "entry": test_entry
        })
    except Exception as e:
        logger.error(f"Error sending test message: {str(e)}")
        logger.exception("Exception details:")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/test-duplicate/<meeting_id>', methods=['GET'])
def test_duplicate_detection(meeting_id):
    """Test endpoint to check the duplicate detection logic"""
    try:
        # Create some test captions
        test_captions = [
            {"text": "This is a test message", "speaker": "Test User"},
            {"text": "This is a test message", "speaker": "Test User"},  # Exact duplicate
            {"text": "This is a test MESSAGE", "speaker": "Test User"},  # Case variation
            {"text": "This is a test message with extra words", "speaker": "Test User"},  # Extension
            {"text": "This is a completely different message", "speaker": "Test User"},  # Different
            {"text": "This is a test message", "speaker": "Another User"}  # Different speaker
        ]
        
        results = []
        for i, caption in enumerate(test_captions):
            # Generate hash
            text_hash = generate_text_hash(caption["text"], caption["speaker"])
            
            # Check if duplicate
            is_duplicate = text_hash in recent_transcriptions.get(meeting_id, set())
            
            # Store result
            result = {
                "index": i,
                "text": caption["text"],
                "speaker": caption["speaker"],
                "hash": text_hash,
                "is_duplicate": is_duplicate
            }
            results.append(result)
            
            # Add to recent transcriptions if not duplicate
            if not is_duplicate:
                if meeting_id not in recent_transcriptions:
                    recent_transcriptions[meeting_id] = set()
                recent_transcriptions[meeting_id].add(text_hash)
        
        return jsonify({
            "status": "success",
            "meeting_id": meeting_id,
            "recent_transcriptions_count": len(recent_transcriptions.get(meeting_id, set())),
            "test_results": results
        })
    except Exception as e:
        logger.error(f"Error testing duplicate detection: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    logger.info(f"Headers: {request.headers}")
    logger.info(f"Args: {request.args}")
    
    # Send a welcome message to confirm connection
    socketio.emit('welcome', {
        'status': 'success',
        'message': 'Connected to WebSocket server',
        'sid': request.sid
    }, to=request.sid)

@socketio.on('join')
def handle_join(data):
    logger.info(f"Join data received: {data}")
    meeting_id = data.get('meetingId')
    if meeting_id:
        logger.info(f"Client {request.sid} joined room for meeting {meeting_id}")
        try:
            room = str(meeting_id)
            logger.info(f"Joining room: {room}")
            socketio.server.enter_room(request.sid, room)
            socketio.emit('join_confirmation', {
                'status': 'success',
                'message': f'Joined room for meeting {meeting_id}',
                'room': room
            }, to=request.sid)
            
            # Also send a test transcription to verify the connection works
            test_entry = {
                'id': f"test-{meeting_id}",
                'meetingId': meeting_id,
                'userId': 1,
                'text': 'WebSocket connection test - This is a test message',
                'timestamp': datetime.now().isoformat(),
                'createdAt': datetime.now().isoformat(),
                'live': True,
                'user': {
                    'id': 1,
                    'username': 'system',
                    'fullName': 'System Test',
                    'email': 'system@example.com',
                    'avatarInitials': 'ST',
                    'avatarColor': 'bg-green-400'
                }
            }
            
            # Send the test message after a short delay
            def send_test_message():
                socketio.emit('transcription', {
                    'type': 'transcription',
                    'data': {
                        'entry': test_entry
                    }
                }, room=room)
                logger.info(f"Sent test transcription to room {room}")
                
            socketio.start_background_task(target=lambda: (socketio.sleep(1), send_test_message()))
            
        except Exception as e:
            logger.error(f"Error joining room: {str(e)}")
            logger.exception("Exception details:")
            socketio.emit('error', {'message': f'Error joining room: {str(e)}'}, to=request.sid)
    else:
        logger.error(f"Client {request.sid} tried to join a room without a meeting ID")
        socketio.emit('error', {'message': 'No meeting ID provided'}, to=request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

if __name__ == '__main__':
    logger.info("Starting Flask SocketIO application...")
    socketio.run(app, host='0.0.0.0', port=5050, debug=True, allow_unsafe_werkzeug=True)
