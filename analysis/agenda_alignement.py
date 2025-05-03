import os
import re
import json
import pandas as pd
from tqdm import tqdm
from collections import defaultdict
from sentence_transformers import SentenceTransformer, util

# Load data
transcripts_df = pd.read_csv(r"D:\code\internship\ai-meeting-analyzer\analysis\data\transcripts_clean1.csv")
agenda_df = pd.read_csv(r"D:\code\internship\ai-meeting-analyzer\analysis\data\cleaned_agenda.csv")

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
    agenda_items = agenda_df[agenda_df['meeting_id'] == meeting_id]
    results = []

    transcript_embedding = model.encode(transcript_text, convert_to_tensor=True)
    topic_drifts = []

    speaker_segments = parse_speakers(transcript_text)

    for _, item in agenda_items.iterrows():
        topic = item["topic"]
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
            "speaker_drift": speaker_drift
        })

    overall_drift = sum(topic_drifts) / len(topic_drifts) if topic_drifts else None

    return {
        "meeting_id": meeting_id,
        "overall_topic_drift": overall_drift,
        "topics": results
    }

# Process each meeting
for row in tqdm(transcripts_df.itertuples(), total=len(transcripts_df)):
    meeting_id = row.meeting_id

    # Combine transcript columns (e.g., transcript0, transcript1, etc.)
    transcript_cols = [col for col in transcripts_df.columns if col.startswith("transcript")]
    transcript = " ".join([str(getattr(row, col)) for col in transcript_cols if getattr(row, col) is not None])

    result = analyze_meeting(meeting_id, transcript)

    output_path = os.path.join(output_dir, f"meeting_{meeting_id}_drift.json")
    with open(output_path, "w") as f:
        json.dump(result, f, indent=4, default=convert)
