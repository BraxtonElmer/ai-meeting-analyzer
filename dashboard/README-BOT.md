# AI Meeting Assistant Bot - Quick Start Guide

This guide explains how to use the included Python bot to simulate a meeting with automatic transcription.

## Prerequisites

1. Make sure you have Python 3.x installed
2. Install the required packages:

```bash
pip install requests
```

## Running the Bot

The project includes a simple Python bot that simulates a meeting by sending transcription entries to the AI Meeting Assistant. 

### Step 1: Start the AI Meeting Assistant Server

Make sure the AI Meeting Assistant server is running:

```bash
npm run dev
```

### Step 2: Configure the Bot

Open `python_bot_example.py` and verify the configuration:

```python
# Configuration
API_URL = "http://localhost:5000/api/bot/transcription"
BOT_API_KEY = "ai-meeting-assistant-bot-key"  # This matches the default key in our server
MEETING_ID = 1  # Change this to the meeting ID you want to add transcription to
USER_ID = 9  # This is the user ID that will be shown as the speaker
```

- Make sure the `MEETING_ID` corresponds to an existing meeting in your database (default is 1)
- The `USER_ID` should be an existing user in your database (default is 9)

### Step 3: Run the Bot

Run the Python script:

```bash
python python_bot_example.py
```

The bot will:
1. Send 10 pre-defined transcription entries to simulate a conversation
2. Wait 2-5 seconds between each entry to simulate real-time speech
3. Automatically generate tasks when appropriate

### Step 4: View the Results

While the bot is running, open the AI Meeting Assistant web interface:

1. Log in to the application
2. Navigate to the meeting page (with the same meeting ID used in the bot)
3. Watch as transcription entries appear in real-time
4. See automatic summaries and tasks being generated

## Customizing the Bot

You can customize the bot by:

1. **Adding Your Own Transcription Text**:
   Edit the `transcript_parts` list to include your own conversation text.

   ```python
   transcript_parts = [
       "Your first statement here",
       "A response from another person",
       "More conversation text here"
   ]
   ```

2. **Changing the Timing**:
   Adjust the delay between messages to make the conversation faster or slower.

   ```python
   delay = random.uniform(1, 3)  # For faster conversations (1-3 seconds)
   # or
   delay = random.uniform(4, 8)  # For slower conversations (4-8 seconds)
   ```

3. **Forcing Task Generation**:
   To explicitly request task generation with every message, modify the API URL:

   ```python
   API_URL = "http://localhost:5000/api/bot/transcription?generateTasks=true"
   ```

## Troubleshooting

### Connection Issues
- Ensure the server is running at http://localhost:5000
- Verify the meeting ID exists in your database

### Authentication Issues
- Check that the BOT_API_KEY matches the key in the server (server/routes.ts)

### User ID Issues
- Make sure the USER_ID corresponds to an existing user in your database

## Advanced Integration

For more advanced integrations, including WebSocket connections and real speech recognition, see the full integration guide in `python-integration.md`.