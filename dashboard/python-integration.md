# AI Meeting Assistant - Python Integration Guide

This guide explains how to send live transcriptions from a Python script or application to the AI Meeting Assistant. There are two main approaches: using the HTTP API or WebSocket connections.

## Method 1: HTTP API Integration (Recommended for Simple Applications)

The easiest way to send transcription data is using the HTTP API endpoint designed specifically for bots.

### HTTP API Configuration

```python
import requests
import json
import os

# Configuration
API_URL = "http://localhost:5000/api/bot/transcription"  # Change to your deployed URL
BOT_API_KEY = os.getenv("BOT_API_KEY", "replace_with_your_bot_api_key")
MEETING_ID = 1  # The meeting ID you want to add transcription to
USER_ID = 9  # The user ID that will be shown as the speaker
```

### Sending Single Transcription

```python
def send_transcription(text):
    """Send a single transcription entry to the API."""
    payload = {
        "meetingId": MEETING_ID,
        "userId": USER_ID,
        "text": text,
        "apiKey": BOT_API_KEY
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        if response.status_code == 201:
            print(f"Successfully sent transcription: '{text[:30]}...'")
            return response.json()
        else:
            print(f"Failed to send transcription: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Error sending transcription: {e}")
        return None
```

### Automatically Generate Tasks

You can tell the system to analyze the conversation and generate tasks by adding a query parameter:

```python
API_URL = "http://localhost:5000/api/bot/transcription?generateTasks=true"
```

When this parameter is set, the AI will analyze the transcription and extract actionable tasks, which will be displayed in the Tasks panel.

### Complete HTTP Example

See the provided `python_bot_example.py` file for a complete working example that simulates a meeting by sending multiple transcription entries with realistic delays.

## Method 2: WebSocket Integration (For Real-Time Applications)

For more advanced real-time applications, you can use WebSockets to maintain a persistent connection.

### WebSocket Configuration

```python
import websocket
import json
import time
import threading

# Configuration
WS_URL = "ws://localhost:5000/ws?meetingId=1"  # Change to your deployed URL and meeting ID
USER_ID = 9  # The user ID that will be shown as the speaker
```

### Creating WebSocket Connection

```python
def on_message(ws, message):
    """Handle incoming messages from the server."""
    data = json.loads(message)
    print(f"Received message: {data['type']}")

def on_error(ws, error):
    """Handle WebSocket errors."""
    print(f"WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    """Handle WebSocket connection close."""
    print(f"WebSocket connection closed: {close_status_code} - {close_msg}")

def on_open(ws):
    """Handle WebSocket connection open."""
    print("WebSocket connection established")
    
    # You can start sending transcriptions once connected
    def send_transcriptions():
        for text in ["Hello, this is a test", "Another test message"]:
            send_transcription(ws, text)
            time.sleep(2)
        
    # Start sending in a separate thread so it doesn't block
    threading.Thread(target=send_transcriptions).start()

def send_transcription(ws, text):
    """Send a transcription update via WebSocket."""
    message = {
        "type": "transcription_update",
        "userId": USER_ID,
        "text": text,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    }
    ws.send(json.dumps(message))
    print(f"Sent transcription: {text}")

# Create WebSocket connection
ws = websocket.WebSocketApp(
    WS_URL,
    on_open=on_open,
    on_message=on_message,
    on_error=on_error,
    on_close=on_close
)

# Start WebSocket connection (this will block)
ws.run_forever()
```

### Complete WebSocket Example

Here's a complete example of a WebSocket client that sends transcriptions:

```python
import websocket
import json
import time
import threading
import random

# Configuration
WS_URL = "ws://localhost:5000/ws?meetingId=1"  # Replace with your server URL
USER_ID = 9

# Example transcript parts
transcript_parts = [
    "I think we should prioritize the mobile UI improvements in the next sprint.",
    "The analytics data shows that 65% of our users are accessing the platform via mobile devices.",
    "What about the server performance issues we discussed last week?",
    "We've implemented some optimizations, but we need more thorough testing before pushing to production.",
    "Let's allocate resources for both mobile improvements and server optimizations then."
]

def on_message(ws, message):
    """Handle incoming messages from the server."""
    try:
        data = json.loads(message)
        print(f"Received message type: {data['type']}")
        
        # Handle different message types
        if data['type'] == 'connection_established':
            print("Connection confirmed!")
        elif data['type'] == 'error':
            print(f"Error: {data['data']['message']}")
    except Exception as e:
        print(f"Error processing message: {e}")

def on_error(ws, error):
    """Handle WebSocket errors."""
    print(f"WebSocket error: {error}")

def on_close(ws, close_status_code, close_msg):
    """Handle WebSocket connection close."""
    print(f"WebSocket connection closed: {close_status_code} - {close_msg}")

def on_open(ws):
    """Handle WebSocket connection open."""
    print("WebSocket connection established")
    
    # Start sending transcription in a separate thread
    threading.Thread(target=send_transcriptions, args=(ws,)).start()

def send_transcription(ws, text):
    """Send a transcription update via WebSocket."""
    if ws.sock and ws.sock.connected:
        message = {
            "type": "transcription_update",
            "userId": USER_ID,
            "text": text,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        }
        ws.send(json.dumps(message))
        print(f"Sent transcription: {text[:30]}...")
        return True
    else:
        print("WebSocket not connected")
        return False

def send_transcriptions(ws):
    """Send all transcript parts with delays to simulate a real conversation."""
    # Wait a moment for connection to stabilize
    time.sleep(1)
    
    print("Starting simulated meeting...")
    for i, text in enumerate(transcript_parts):
        print(f"\nSending transcription entry {i+1}/{len(transcript_parts)}...")
        
        # Try to send, retry up to 3 times if failed
        for attempt in range(3):
            if send_transcription(ws, text):
                break
            else:
                print(f"Retrying in 1 second... (attempt {attempt+1}/3)")
                time.sleep(1)
        
        # Random delay between 2-5 seconds to simulate natural conversation
        delay = random.uniform(2, 5)
        print(f"Waiting {delay:.1f} seconds...")
        time.sleep(delay)
    
    print("\nSimulated meeting complete!")

if __name__ == "__main__":
    # You need to install the websocket-client package:
    # pip install websocket-client
    websocket.enableTrace(True)  # For debugging
    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Start WebSocket connection (this will block)
    ws.run_forever()
```

## Integrating with Speech Recognition

To create a true live transcription system, you would integrate a speech recognition system with the above code. Here's a simple example using Google's Speech Recognition:

```python
import speech_recognition as sr
import requests
import json
import time

# Configuration
API_URL = "http://localhost:5000/api/bot/transcription"
BOT_API_KEY = os.getenv("BOT_API_KEY", "replace_with_your_bot_api_key")
MEETING_ID = 1
USER_ID = 9

def send_transcription(text):
    """Send a single transcription entry to the API."""
    payload = {
        "meetingId": MEETING_ID,
        "userId": USER_ID,
        "text": text,
        "apiKey": BOT_API_KEY
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        if response.status_code == 201:
            print(f"Sent: '{text}'")
            return True
        else:
            print(f"Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def listen_and_transcribe():
    """Listen for audio, transcribe it, and send to the API."""
    recognizer = sr.Recognizer()
    
    print("Starting live transcription...")
    print("Speak clearly into your microphone.")
    print("Press Ctrl+C to exit.")
    
    with sr.Microphone() as source:
        # Calibrate the recognizer for ambient noise
        print("Calibrating for ambient noise... (silent for 2 seconds)")
        recognizer.adjust_for_ambient_noise(source, duration=2)
        print("Calibration complete! Start speaking.")
        
        while True:
            try:
                print("Listening...")
                audio = recognizer.listen(source, timeout=10, phrase_time_limit=15)
                
                print("Transcribing...")
                text = recognizer.recognize_google(audio)
                
                if text:
                    print(f"Recognized: {text}")
                    send_transcription(text)
                
            except sr.WaitTimeoutError:
                print("No speech detected. Listening again...")
            except sr.UnknownValueError:
                print("Could not understand audio. Listening again...")
            except sr.RequestError as e:
                print(f"Speech recognition service error: {e}")
            except KeyboardInterrupt:
                print("\nExiting...")
                break
            except Exception as e:
                print(f"Unexpected error: {e}")

if __name__ == "__main__":
    # You need to install these packages:
    # pip install SpeechRecognition requests pyaudio
    listen_and_transcribe()
```

## Important Notes

1. **Meeting ID**: Make sure to use a valid meeting ID from your database.

2. **User ID**: The `userId` parameter determines which user will be shown as the speaker in the transcript.

3. **API Key**: In production, use a secure API key and store it in environment variables, not in your code.

4. **Security Considerations**: For production use, implement proper authentication and ensure your connection is secure (HTTPS/WSS).

5. **Error Handling**: Add robust error handling and retry logic for production applications.

## Troubleshooting

### Connection Issues
- Verify the server is running and accessible
- Check that the meeting ID exists and is valid
- Ensure the API key matches what's configured on the server

### Transcription Not Appearing
- Confirm the user ID exists
- Check server logs for any errors
- Verify the WebSocket connection is established
- Make sure the meeting status is 'live' in the database

### Speech Recognition Issues
- Test your microphone separately
- Ensure you're in a quiet environment
- Try speaking more clearly or adjusting your distance from the microphone