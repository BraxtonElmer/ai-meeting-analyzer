# utils/speaker_contribution.py

import os
import re
from collections import defaultdict
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)

def analyze_speaker_contribution(meeting_id):
    # Fetch transcript from DB
    try:
        with engine.connect() as conn:
            query = text("""
                SELECT COALESCE(t.transcript0, '') || E'\n' || COALESCE(t.transcript1, '') as transcript
                FROM meetings m
                JOIN transcripts t ON m.id = t.meeting_id
                WHERE m.id = :meeting_id
            """)
            result = conn.execute(query, {"meeting_id": meeting_id}).fetchone()
            if not result:
                return {"error": f"No transcript found for meeting_id {meeting_id}"}
            transcript = result[0]
    except OperationalError as e:
        return {"error": "Database connection failed"}

    # Analyze speaker contributions
    pattern = r"(\w+):\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(.*?)(?=\s+\w+:|$)"
    matches = re.findall(pattern, transcript, flags=re.DOTALL)

    word_counts = defaultdict(int)
    total_words = 0
    for speaker, speech in matches:
        count = len(speech.strip().split())
        word_counts[speaker] += count
        total_words += count

    speaker_percentages = {
        speaker: round((count / total_words) * 100, 2) if total_words > 0 else 0
        for speaker, count in word_counts.items()
    }

    # Return only speaker contribution info without meeting_id
    return {
        "speaker_contribution": speaker_percentages,
        "total_speakers": len(speaker_percentages),
        "total_words": total_words
    }
