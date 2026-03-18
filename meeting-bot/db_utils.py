"""
Database utilities to connect to the dashboard database and add transcription entries.
"""
import os
import sys
import requests
import logging
import json
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Dashboard API endpoint for adding transcriptions
DASHBOARD_API_URL = os.getenv("DASHBOARD_API_URL", "http://localhost:3000/api/bot/transcription")
BOT_API_KEY = os.getenv("BOT_API_KEY", "")


def _has_bot_api_key():
    if BOT_API_KEY:
        return True
    logger.error("BOT_API_KEY is not set. Add BOT_API_KEY to your environment.")
    return False

def add_transcription_to_database(meeting_id, speaker, text, timestamp=None):
    """
    Add a transcription entry directly to the database through the dashboard API.
    
    Args:
        meeting_id (int): The ID of the meeting
        speaker (str): The name of the speaker
        text (str): The transcription text
        timestamp (str, optional): ISO format timestamp. Defaults to current time.
    
    Returns:
        dict: The response from the API or None if there was an error
    """
    if not _has_bot_api_key():
        return None

    if timestamp is None:
        timestamp = datetime.now().isoformat()
        
    try:
        # For live transcriptions, we'll use a fixed user ID (1) for now
        # In a production system, you'd want to map the speaker to a real user ID
        user_id = 1
        
        # Prepare the data payload
        payload = {
            "meetingId": meeting_id,
            "userId": user_id,
            "text": text,
            "apiKey": BOT_API_KEY,
            "live": True
        }
        
        logger.info(f"Sending transcription to database: {json.dumps(payload)}")
        
        # Make the API request
        response = requests.post(
            DASHBOARD_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            logger.info(f"Successfully added transcription to database: {text[:30]}...")
            return response.json()
        else:
            logger.error(f"Failed to add transcription to database. Status code: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Error adding transcription to database: {str(e)}")
        return None

def update_transcription_live_status(meeting_id, live_status=False):
    """
    Update the live status of all transcription entries for a meeting.
    
    Args:
        meeting_id (int): The ID of the meeting
        live_status (bool): The live status to set (True for live, False for archived)
    
    Returns:
        bool: True if successful, False otherwise
    """
    if not _has_bot_api_key():
        return False

    try:
        # Endpoint for updating transcription live status
        update_url = f"http://localhost:3000/api/meetings/{meeting_id}/transcription/update-status"
        
        payload = {
            "live": live_status,
            "apiKey": BOT_API_KEY
        }
        
        logger.info(f"Updating transcription live status for meeting {meeting_id} to {live_status}")
        
        response = requests.post(
            update_url,
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            logger.info(f"Successfully updated transcription live status for meeting {meeting_id}")
            return True
        else:
            logger.error(f"Failed to update transcription live status. Status code: {response.status_code}")
            logger.error(f"Response: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error updating transcription live status: {str(e)}")
        return False
