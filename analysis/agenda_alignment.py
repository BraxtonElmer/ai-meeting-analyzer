import os
import re
import json
from tqdm import tqdm
from collections import defaultdict
from sentence_transformers import SentenceTransformer, util
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import pandas as pd

# Load environment variables
load_dotenv()

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

# Load model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Output directory
output_dir = "agenda_drift_results"
os.makedirs(output_dir, exist_ok=True)

# JSON float handling
def convert(o):
    if hasattr(o, 'item'):
        return o.item()
    raise TypeError

# Parse speaker-wise text from the transcript
def parse_speakers(transcript_text):
    pattern = r"(\w+):\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(.*?)(?=\s+\w+:|$)"
    matches = re.findall(pattern, transcript_text)

    speakers = defaultdict(str)
    for speaker, speech in matches:
        speakers[speaker.strip()] += " " + speech.strip()

    return dict(speakers)

# Main function to analyze a meeting
def analyze_meeting(meeting_id, transcript_text):
    # Get agenda items with end time from database
    with engine.connect() as conn:
        agenda_query = text("""
            SELECT a.topic, a.end_time
            FROM agenda a 
            WHERE a.meeting_id = :meeting_id
        """)
        agenda_items = pd.read_sql(agenda_query, conn, params={"meeting_id": meeting_id})

    results = []
    transcript_embedding = model.encode(transcript_text, convert_to_tensor=True)
    topic_drifts = []

    speaker_segments = parse_speakers(transcript_text)

    for _, item in agenda_items.iterrows():
        topic = item["topic"]
        end_time = item.get("end_time", None)  # Get end time from DB

        topic_embedding = model.encode(topic, convert_to_tensor=True)

        # Compute topic drift
        similarity = util.cos_sim(topic_embedding, transcript_embedding).item()
        topic_drift = 1 - similarity
        topic_drifts.append(topic_drift)

        # Compute speaker drift
        speaker_drift = {}
        for speaker, speech in speaker_segments.items():
            if speech.strip():
                speaker_embedding = model.encode(speech, convert_to_tensor=True)
                drift = 1 - util.cos_sim(topic_embedding, speaker_embedding).item()
                speaker_drift[speaker] = drift

        results.append({
            "topic": topic,
            "topic_drift": topic_drift,
            "end_time": end_time,
            "speaker_drift": speaker_drift
        })

    overall_drift = sum(topic_drifts) / len(topic_drifts) if topic_drifts else None

    return {
        "meeting_id": meeting_id,
        "overall_topic_drift": overall_drift,
        "topics": results
    }

# Main execution
def main():
    try:
        with engine.connect() as conn:
            meetings_query = text("""
                SELECT DISTINCT t.meeting_id, t.transcript0, t.transcript1
                FROM transcripts t
                WHERE t.transcript0 IS NOT NULL OR t.transcript1 IS NOT NULL
            """)
            meetings_df = pd.read_sql(meetings_query, conn)

        for _, row in tqdm(meetings_df.iterrows(), total=len(meetings_df)):
            meeting_id = row['meeting_id']
            # Combine transcripts
            transcript = ""
            if pd.notna(row['transcript0']):
                transcript += row['transcript0'] + "\n"
            if pd.notna(row['transcript1']):
                transcript += row['transcript1'] + "\n"

            result = analyze_meeting(meeting_id, transcript)

            output_path = os.path.join(output_dir, f"meeting_{meeting_id}_drift.json")
            with open(output_path, "w") as f:
                json.dump(result, f, indent=4, default=convert)

    except Exception as e:
        print(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    main()
