import os
import re
from collections import defaultdict
from sentence_transformers import SentenceTransformer, util
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import pandas as pd

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
model = SentenceTransformer("all-MiniLM-L6-v2")

def parse_speakers(transcript_text):
    pattern = r"(\w+):\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(.*?)(?=\s+\w+:|$)"
    matches = re.findall(pattern, transcript_text)

    speakers = defaultdict(str)
    for speaker, speech in matches:
        speakers[speaker.strip()] += " " + speech.strip()

    return dict(speakers)

def analyze_agenda_drift(meeting_id):
    with engine.connect() as conn:
        # Fetch transcript for the meeting
        transcript_query = text("""
            SELECT COALESCE(t.transcript0, '') || E'\n' || COALESCE(t.transcript1, '') as transcript
            FROM transcripts t
            WHERE t.meeting_id = :meeting_id
        """)
        transcript_result = conn.execute(transcript_query, {"meeting_id": meeting_id}).fetchone()
        if not transcript_result or not transcript_result[0].strip():
            return {"error": "Transcript not found or empty for meeting_id {}".format(meeting_id)}

        transcript_text = transcript_result[0]

        # Fetch agenda items
        agenda_query = text("""
            SELECT a.topic, a.end_time
            FROM agenda a 
            WHERE a.meeting_id = :meeting_id
        """)
        agenda_items = pd.read_sql(agenda_query, conn, params={"meeting_id": meeting_id})

    transcript_embedding = model.encode(transcript_text, convert_to_tensor=True)
    topic_drifts = []
    results = []

    speaker_segments = parse_speakers(transcript_text)

    for _, item in agenda_items.iterrows():
        topic = item["topic"]
        end_time = item.get("end_time", None)

        topic_embedding = model.encode(topic, convert_to_tensor=True)

        similarity = util.cos_sim(topic_embedding, transcript_embedding).item()
        topic_drift = 1 - similarity
        topic_drifts.append(topic_drift)

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
        "overall_topic_drift": overall_drift,
        "topics": results
    }
