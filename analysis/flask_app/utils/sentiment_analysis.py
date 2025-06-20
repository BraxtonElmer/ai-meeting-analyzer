import pandas as pd
from sentence_transformers import SentenceTransformer, util
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import re
from collections import defaultdict
from sqlalchemy import text
from dotenv import load_dotenv
from sqlalchemy import create_engine
import os

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
# Load models
model = SentenceTransformer('all-MiniLM-L6-v2')
analyzer = SentimentIntensityAnalyzer()

# Smooth transition phrases
smooth_phrases = ["moving on", "next", "let's talk", "shifting to", "as mentioned"]

# Appreciation words
appreciation_words = ['great', 'good', 'excellent', 'well done', 'perfect']

# Negative cue phrases
negative_cues = [
    "i don't agree", "not working", "disappointed", "no accountability", "no leadership",
    "frustrating", "unacceptable", "lack of", "laid off", "downsizing", "termination", "cut back"
]

def parse_speakers(transcript_text):
    pattern = r"(\w+):\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(.*?)(?=\s+\w+:|$)"
    matches = re.findall(pattern, transcript_text)
    speakers = {}
    for speaker, speech in matches:
        speaker = speaker.strip()
        if speaker not in speakers:
            speakers[speaker] = ""
        speakers[speaker] += " " + speech.strip()
    return speakers

def create_sample_sentiment_data(meeting_id):
    """Create sample sentiment data when real data isn't available"""
    return {
        "meeting_id": meeting_id,
        "meeting_title": "Sample Meeting",
        "transitions": [
            {
                "from_speaker": "Speaker 1",
                "to_speaker": "Speaker 2",
                "transition_smoothness": 0.85,
                "sentiment": "Positive"
            },
            {
                "from_speaker": "Speaker 2",
                "to_speaker": "Speaker 3",
                "transition_smoothness": 0.65,
                "sentiment": "Neutral"
            },
            {
                "from_speaker": "Speaker 3",
                "to_speaker": "Speaker 1",
                "transition_smoothness": 0.75,
                "sentiment": "Positive"
            }
        ],
        "note": "Sample data - no actual transcript available"
    }

def analyze_sentiment_transitions(meeting_id):
    try:
        query = text("""
            SELECT 
                meeting_id,
                meeting_title,
                transcript0,
                transcript1
            FROM transcripts
            WHERE meeting_id = :meeting_id
              AND (transcript0 IS NOT NULL OR transcript1 IS NOT NULL)
        """)        with engine.connect() as connection:
            df = pd.read_sql(query, connection, params={"meeting_id": meeting_id})

        if df.empty:
            print(f"No transcript found for meeting_id {meeting_id}")
            return create_sample_sentiment_data(meeting_id)        transcript_text = ""
        for _, row in df.iterrows():
            if pd.notna(row['transcript0']):
                transcript_text += row['transcript0'] + "\n"
            if pd.notna(row['transcript1']):
                transcript_text += row['transcript1'] + "\n"speaker_segments = parse_speakers(transcript_text)

        if len(speaker_segments) < 2:
            print(f"Less than two speakers found for meeting_id {meeting_id}")
            return create_sample_sentiment_data(meeting_id)

        results = []
        speakers = list(speaker_segments.items())

        for i in range(len(speakers) - 1):
            curr_speaker, curr_speech = speakers[i]
            next_speaker, next_speech = speakers[i + 1]

            curr_embedding = model.encode(curr_speech, convert_to_tensor=True)
            next_embedding = model.encode(next_speech, convert_to_tensor=True)

            sim = util.cos_sim(curr_embedding, next_embedding).item()
            is_smooth = any(phrase in next_speech.lower() for phrase in smooth_phrases)
            smoothness = 1.0 if is_smooth else sim
            sentiment_score = analyzer.polarity_scores(next_speech)['compound']
            appreciation_feedback = any(word in next_speech.lower() for word in appreciation_words)
            negative_flag = any(phrase in next_speech.lower() for phrase in negative_cues)

            if negative_flag or sentiment_score < -0.3:
                sentiment = "Negative"
            elif sentiment_score > 0.3:
                sentiment = "Positive"
            else:
                if appreciation_feedback or is_smooth:
                    sentiment = "Positive"
                elif smoothness < 0.6:
                    sentiment = "Negative"
                else:
                    sentiment = "Neutral"

            results.append({
                "from_speaker": curr_speaker,
                "to_speaker": next_speaker,
                "transition_smoothness": round(smoothness, 2),
                "sentiment": sentiment
            })

        return {
            "meeting_id": meeting_id,
            "meeting_title": df['meeting_title'].iloc[0],
            "transitions": results
        }

    except Exception as e:
        return {"error": str(e)}
