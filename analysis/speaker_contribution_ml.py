import os
import re
import json
import time
from collections import defaultdict
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv
import pandas as pd
from tqdm import tqdm

# Load environment variables
load_dotenv()

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)

# Output directory
output_dir = "speaker_contribution_results"
os.makedirs(output_dir, exist_ok=True)

def get_db_connection(max_retries=3, retry_delay=5):
    for attempt in range(max_retries):
        try:
            return engine.connect()
        except OperationalError:
            if attempt == max_retries - 1:
                raise
            time.sleep(retry_delay)
    return None

def get_speaker_contribution_percentages(transcript_text):
    pattern = r"(\w+):\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(.*?)(?=\s+\w+:|$)"
    matches = re.findall(pattern, transcript_text, flags=re.DOTALL)

    word_counts = defaultdict(int)
    total_words = 0

    for speaker, speech in matches:
        word_count = len(speech.strip().split())
        word_counts[speaker] += word_count
        total_words += word_count

    speaker_percentages = {
        speaker: round((count / total_words) * 100, 2) if total_words > 0 else 0
        for speaker, count in word_counts.items()
    }

    return speaker_percentages

def main():
    try:
        conn = get_db_connection()
        try:
            # Get all meetings with their transcripts
            meetings_query = text("""
                SELECT DISTINCT m.id as meeting_id, 
                       COALESCE(t.transcript0, '') || E'\n' || COALESCE(t.transcript1, '') as transcript
                FROM meetings m
                JOIN transcripts t ON m.id = t.meeting_id
                WHERE t.transcript0 IS NOT NULL OR t.transcript1 IS NOT NULL
            """)
            meetings_df = pd.read_sql(meetings_query, conn)
        finally:
            conn.close()

        print(f"Found {len(meetings_df)} meetings to process")

        for _, row in tqdm(meetings_df.iterrows(), total=len(meetings_df)):
            meeting_id = row["meeting_id"]
            transcript = row["transcript"]

            try:
                speaker_percentages = get_speaker_contribution_percentages(transcript)
                result = {
                    "meeting_id": meeting_id,
                    "speaker_contribution": speaker_percentages,
                    "total_speakers": len(speaker_percentages),
                    "total_words": sum(len(speech.split()) for speech in transcript.split("\n") if speech.strip())
                }

                output_path = os.path.join(output_dir, f"meeting_{meeting_id}_speaker_contribution.json")
                with open(output_path, "w") as f:
                    json.dump(result, f, indent=4)
                
                print(f"Processed meeting {meeting_id}: {len(speaker_percentages)} speakers found")
            except Exception as e:
                print(f"Error processing meeting {meeting_id}: {str(e)}")
                continue

    except Exception as e:
        print(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    main()
