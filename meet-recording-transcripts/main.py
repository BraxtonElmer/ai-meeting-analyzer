import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from google.apps import meet_v2

# Path to your service account key file (JSON)
SERVICE_ACCOUNT_FILE = 'key.json'

# Scopes required for the APIs
SCOPES = [
    'https://www.googleapis.com/auth/meetings.space.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
]

# Authenticate and construct the Google Meet and Drive API clients
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

# Meet API Client
meet_client = meet_v2.ConferenceRecordsServiceClient(credentials=credentials)

# Drive API Client
drive_service = build('drive', 'v3', credentials=credentials)

def extract_conference_id(meet_url):
    """Extracts the conference ID from the Google Meet URL"""
    return meet_url.split('/')[-1]

def get_conference_record(conference_id):
    """Lists conference records and fetches the one matching the given conference ID"""
    conference_records = meet_client.list_conference_records()
    for record in conference_records:
        if conference_id in record.name:
            return record
    return None

def get_transcripts_and_recordings(record):
    """Fetches transcripts and recordings for the given conference record"""
    transcripts = meet_client.list_transcripts(parent=record.name)
    
    for transcript in transcripts:
        transcript_detail = meet_client.get_transcript(name=transcript.name)
        print(f"Transcript Status: {transcript_detail.state}")
        
        # If transcript is available in Google Docs, fetch the document ID
        if transcript_detail.docs_destination:
            doc_id = transcript_detail.docs_destination.document_id
            print(f"Transcript Document ID: {doc_id}")

            # Retrieve the document metadata from Drive
            doc = drive_service.files().get(fileId=doc_id, fields='name, webViewLink').execute()
            print(f"Transcript Document Name: {doc.get('name')}")
            print(f"Transcript Document Link: {doc.get('webViewLink')}")
    
    # Get recordings if available
    recordings = meet_client.list_recordings(parent=record.name)
    for recording in recordings:
        print(f"Recording ID: {recording.name}")
        print(f"Recording Status: {recording.status}")
        if recording.content:
            print(f"Recording Link: {recording.content[0].media_url}")

def main():
    # Replace with your actual Meet URL
    meet_url = "https://meet.google.com/cyy-nsyh-tii"
    conference_id = extract_conference_id(meet_url)
    
    print(f"Looking up conference ID: {conference_id}")
    
    # Get the conference record
    record = get_conference_record(conference_id)
    if record:
        print(f"Found conference record: {record.name}")
        get_transcripts_and_recordings(record)
    else:
        print(f"Conference with ID {conference_id} not found.")

if __name__ == '__main__':
    main()
