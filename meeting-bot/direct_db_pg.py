"""
Direct database utilities to connect to the dashboard PostgreSQL database and add transcription entries.
"""
import os
import sys
import logging
import json
import secrets
from datetime import datetime
import psycopg2
from psycopg2 import Error
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection string from environment
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    """
    Create a connection to the PostgreSQL database
    
    Returns:
        psycopg2.connection: Database connection object or None if connection fails
    """
    try:
        if not DATABASE_URL:
            logger.error("DATABASE_URL is not set. Configure it in your environment before running the bot.")
            return None
        connection = psycopg2.connect(DATABASE_URL)
        logger.info("Connected to PostgreSQL database")
        return connection
    except Error as e:
        logger.error(f"Error connecting to PostgreSQL database: {str(e)}")
        return None

def add_transcription_entry(meeting_id, speaker_name, text, timestamp=None, live=True):
    """
    Add a transcription entry directly to the database
    
    Args:
        meeting_id (int): The ID of the meeting
        speaker_name (str): The name of the speaker
        text (str): The transcription text
        timestamp (str, optional): ISO format timestamp. Defaults to current time.
        live (bool, optional): Whether this is a live transcription. Defaults to True.
    
    Returns:
        dict: The created entry or None if there was an error
    """
    if timestamp is None:
        timestamp = datetime.now().isoformat()
        
    try:
        connection = get_connection()
        if not connection:
            return None
            
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # First we need to find or create a user for the speaker
        # Get user ID for the speaker (create one if it doesn't exist)
        user_id = get_or_create_user_for_speaker(cursor, speaker_name)
        if not user_id:
            connection.close()
            return None
            
        # Check for duplicates before inserting
        if check_duplicate_transcription(cursor, meeting_id, text, user_id):
            logger.info(f"Duplicate transcription detected for meeting {meeting_id}, not inserting")
            connection.close()
            return None
            
        # Now insert the transcription entry
        insert_query = """
        INSERT INTO transcription_entries 
        (meeting_id, user_id, text, timestamp, live, created_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        RETURNING id
        """
        
        # Convert timestamp string to datetime if needed
        if isinstance(timestamp, str):
            timestamp_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        else:
            timestamp_obj = timestamp
            
        cursor.execute(insert_query, (meeting_id, user_id, text, timestamp_obj, live))
        entry_id = cursor.fetchone()['id']
        
        # Commit the changes
        connection.commit()
        
        # Get the created entry with user details
        select_query = """
        SELECT e.*, u.id as user_id, u.full_name, u.avatar_initials, u.avatar_color
        FROM transcription_entries e
        JOIN users u ON e.user_id = u.id
        WHERE e.id = %s
        """
        cursor.execute(select_query, (entry_id,))
        entry = cursor.fetchone()
        
        # Close connection
        cursor.close()
        connection.close()
        
        logger.info(f"Added transcription entry for meeting {meeting_id}: {text[:50]}...")
        return entry
        
    except Error as e:
        logger.error(f"Error adding transcription to database: {str(e)}")
        if connection:
            connection.close()
        return None

def get_or_create_user_for_speaker(cursor, speaker_name):
    """
    Get or create a user for the speaker
    
    Args:
        cursor: Database cursor
        speaker_name (str): Name of the speaker
    
    Returns:
        int: User ID
    """
    try:
        # Check if user already exists
        select_query = "SELECT id FROM users WHERE full_name = %s"
        cursor.execute(select_query, (speaker_name,))
        result = cursor.fetchone()
        
        if result:
            return result['id']
            
        # Create a new user
        # Generate a username from the speaker name
        username = speaker_name.lower().replace(' ', '_') + "_" + str(int(datetime.now().timestamp()))
        
        # Generate avatar initials (first letter of first and last name)
        parts = speaker_name.split()
        if len(parts) > 1:
            initials = parts[0][0] + parts[-1][0]
        else:
            initials = parts[0][0] + (parts[0][1] if len(parts[0]) > 1 else '')
            
        # Pick a random color
        colors = ["bg-blue-400", "bg-green-400", "bg-purple-400", "bg-red-400", "bg-yellow-400"]
        import random
        color = random.choice(colors)
        
        # Insert the new user
        insert_query = """
        INSERT INTO users 
        (username, password, full_name, email, avatar_initials, avatar_color, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        RETURNING id
        """
        
        # Use a random one-time value for bot-created placeholder accounts.
        password = secrets.token_urlsafe(24)
        email = f"{username}@example.com"
        
        cursor.execute(insert_query, (username, password, speaker_name, email, initials.upper(), color))
        user_id = cursor.fetchone()['id']
        
        return user_id
        
    except Error as e:
        logger.error(f"Error getting/creating user for speaker: {str(e)}")
        return None

def update_transcription_live_status(meeting_id, live_status=False):
    """
    Update the live status of all transcription entries for a meeting
    
    Args:
        meeting_id (int): The ID of the meeting
        live_status (bool): The live status to set (True for live, False for archived)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        connection = get_connection()
        if not connection:
            return False
            
        cursor = connection.cursor()
        
        # Update all transcription entries for this meeting
        update_query = """
        UPDATE transcription_entries 
        SET live = %s
        WHERE meeting_id = %s
        """
        
        cursor.execute(update_query, (live_status, meeting_id))
        connection.commit()
        
        # Close connection
        cursor.close()
        connection.close()
        
        logger.info(f"Updated transcription entries for meeting {meeting_id} to live={live_status}")
        return True
        
    except Error as e:
        logger.error(f"Error updating transcription live status: {str(e)}")
        if connection:
            connection.close()
        return False

def get_meeting_by_id(meeting_id):
    """
    Get meeting details by ID
    
    Args:
        meeting_id (int): The ID of the meeting
    
    Returns:
        dict: Meeting details or None if not found
    """
    try:
        connection = get_connection()
        if not connection:
            return None
            
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Get meeting details
        select_query = """
        SELECT * FROM meetings WHERE id = %s
        """
        cursor.execute(select_query, (meeting_id,))
        meeting = cursor.fetchone()
        
        # Close connection
        cursor.close()
        connection.close()
        
        return meeting
        
    except Error as e:
        logger.error(f"Error getting meeting: {str(e)}")
        if connection:
            connection.close()
        return None

def check_duplicate_transcription(cursor, meeting_id, text, user_id):
    """
    Check if a similar transcription entry already exists for the meeting
    
    Args:
        cursor: Database cursor
        meeting_id (int): The ID of the meeting
        text (str): The transcription text
        user_id (int): The ID of the user/speaker
    
    Returns:
        bool: True if a duplicate exists, False otherwise
    """
    try:
        # Normalize the text for comparison (lowercase, strip whitespace)
        normalized_text = text.lower().strip()
        
        # First check for exact match within the last 30 seconds
        exact_query = """
        SELECT id 
        FROM transcription_entries 
        WHERE meeting_id = %s 
        AND user_id = %s 
        AND LOWER(text) = %s
        AND timestamp > NOW() - INTERVAL '30 seconds'
        LIMIT 1
        """
        
        cursor.execute(exact_query, (meeting_id, user_id, normalized_text))
        exact_match = cursor.fetchone()
        if exact_match:
            logger.info(f"Found exact duplicate in database for meeting {meeting_id}")
            return True
        
        # If no exact match, check for similar content based on substring match
        # This catches cases where the caption is extended with more words
        similar_query = """
        SELECT id, text
        FROM transcription_entries 
        WHERE meeting_id = %s 
        AND user_id = %s 
        AND timestamp > NOW() - INTERVAL '60 seconds'
        ORDER BY timestamp DESC
        LIMIT 10
        """
        
        cursor.execute(similar_query, (meeting_id, user_id))
        recent_entries = cursor.fetchall()
        
        for entry in recent_entries:
            entry_text = entry['text'].lower().strip() if entry['text'] else ""
            
            # Check if either text contains the other (substring relationship)
            if entry_text in normalized_text or normalized_text in entry_text:
                logger.info(f"Found similar text in database for meeting {meeting_id}")
                return True
                
            # Check for high word overlap (for texts with different word order)
            entry_words = set(entry_text.split())
            new_words = set(normalized_text.split())
            
            if entry_words and new_words:
                intersection = len(entry_words.intersection(new_words))
                union = len(entry_words.union(new_words))
                similarity = intersection / union
                
                # If more than 75% words overlap, consider it a duplicate
                if similarity > 0.75:
                    logger.info(f"Found text with high word overlap ({similarity:.2f}) in database for meeting {meeting_id}")
                    return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error checking for duplicate transcription: {str(e)}")
        return False

# If running as a script, test the connection
if __name__ == "__main__":
    connection = get_connection()
    if connection:
        print("Successfully connected to the PostgreSQL database")
        connection.close()
    else:
        print("Failed to connect to the PostgreSQL database")
