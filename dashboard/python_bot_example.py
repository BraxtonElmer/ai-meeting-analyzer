import requests
import json
import time
import random

# Configuration
API_URL = "http://localhost:5000/api/bot/transcription"
BOT_API_KEY = "ai-meeting-assistant-bot-key"  # This matches the default key in our server
MEETING_ID = 1  # Change this to the meeting ID you want to add transcription to
USER_ID = 9  # This is the user ID we just created

# Example transcript parts (in a real scenario, this would come from your speech recognition system)
transcript_parts = [
    "I think we should prioritize the mobile UI improvements in the next sprint.",
    "The analytics data shows that 65% of our users are accessing the platform via mobile devices.",
    "What about the server performance issues we discussed last week?",
    "We've implemented some optimizations, but we need more thorough testing before pushing to production.",
    "Let's allocate resources for both mobile improvements and server optimizations then.",
    "Should we also consider the accessibility improvements that were requested?",
    "Yes, that's a good point. Let's include those as well in our planning.",
    "We need to schedule a meeting with the design team to finalize the new mobile layouts.",
    "I'll reach out to Sarah from the design team to coordinate that meeting.",
    "Perfect. Can everyone share their availability for next week?"
]

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

def simulate_meeting():
    """Simulate a meeting by sending transcript parts with delays."""
    print("Starting simulated meeting...")
    
    for i, text in enumerate(transcript_parts):
        print(f"\nSending transcription entry {i+1}/{len(transcript_parts)}...")
        result = send_transcription(text)
        
        # Check if tasks were generated
        if result and 'tasksGenerated' in result and result['tasksGenerated']:
            print("🎉 Tasks were automatically generated from the conversation!")
            if 'tasks' in result:
                print("Generated tasks:")
                for task in result['tasks']:
                    assignee = task.get('assignee', {})
                    assignee_name = assignee.get('fullName', 'Unassigned') if assignee else 'Unassigned'
                    print(f"  - {task['title']} (Assigned to: {assignee_name})")
        
        # Random delay between 2-5 seconds to simulate natural conversation
        delay = random.uniform(2, 5)
        print(f"Waiting {delay:.1f} seconds...")
        time.sleep(delay)
    
    print("\nSimulated meeting complete!")
    print("Check the AI Meeting Assistant web interface to see the transcription, summary, and tasks.")

if __name__ == "__main__":
    simulate_meeting()