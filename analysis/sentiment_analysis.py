import pandas as pd
from sentence_transformers import SentenceTransformer, util
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import re

# Load the data
transcripts_df = pd.read_csv(r"D:\code\internship\ai-meeting-analyzer\analysis\cleaning\transcripts_clean2.csv")
agenda_df = pd.read_csv(r"D:\code\internship\ai-meeting-analyzer\analysis\data\cleaned_agenda.csv")

# Load models
model = SentenceTransformer('all-MiniLM-L6-v2')
analyzer = SentimentIntensityAnalyzer()

# Smooth transition phrases
smooth_phrases = ["moving on", "next", "let’s talk", "shifting to", "as mentioned"]

# Appreciation words
appreciation_words = ['great', 'good', 'excellent', 'well done', 'perfect']

# Negative cue phrases
negative_cues = [
    "i don't agree", "not working", "disappointed", "no accountability", "no leadership",
    "frustrating", "unacceptable", "lack of", "laid off", "downsizing", "termination", "cut back"
]

# Function to parse speaker-wise segments from the transcript
def parse_speakers(transcript_text):
    # Regular expression to match speakers and their respective speech
    pattern = r"(\w+):\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+(.*?)(?=\s+\w+:|$)"
    matches = re.findall(pattern, transcript_text)

    speakers = {}
    for speaker, speech in matches:
        if speaker.strip() not in speakers:
            speakers[speaker.strip()] = ""
        speakers[speaker.strip()] += " " + speech.strip()

    return speakers

# Analyze sentiment and transitions between speakers
def analyze_sentiment_and_transitions(speaker_segments):
    results = []
    for i in range(len(speaker_segments) - 1):
        # Get current and next speaker and their respective speeches
        curr_speaker, curr_speech = list(speaker_segments.items())[i]
        next_speaker, next_speech = list(speaker_segments.items())[i + 1]

        # Generate embeddings for current and next speech
        curr_embedding = model.encode(curr_speech, convert_to_tensor=True)
        next_embedding = model.encode(next_speech, convert_to_tensor=True)

        # Calculate cosine similarity between current and next speech
        sim = util.cos_sim(curr_embedding, next_embedding).item()

        # Check for smooth transition based on phrases
        is_smooth = any(phrase in next_speech.lower() for phrase in smooth_phrases)
        smoothness = 1.0 if is_smooth else sim

        # Calculate sentiment for the next speaker's speech
        sentiment_score = analyzer.polarity_scores(next_speech)['compound']

        # Appreciation or encouragement feedback
        appreciation_feedback = any(word in next_speech.lower() for word in appreciation_words)

        # Check for explicit negative tone
        negative_flag = any(phrase in next_speech.lower() for phrase in negative_cues)

        # Determine final sentiment
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

    return results

# Process each meeting
all_results = []
for idx, row in transcripts_df.iterrows():
    meeting_id = row['meeting_id']
    
    # Extract transcript text
    transcript_cols = [col for col in transcripts_df.columns if col.startswith("transcript")]
    transcript = " ".join([str(row[col]) for col in transcript_cols if pd.notnull(row[col])])
    
    # Parse speaker segments
    speaker_segments = parse_speakers(transcript)

    # ✅ Debug check
    print(f"\n--- Debugging Meeting ID {meeting_id} ---")
    print(f"Transcript snippet:\n{transcript[:300]}")
    print("Parsed speakers:", list(speaker_segments.keys()))

    if len(speaker_segments) < 2:
        print(f"Skipping Meeting ID {meeting_id} - Less than 2 speakers parsed.")
        continue

    # Analyze sentiment
    meeting_results = analyze_sentiment_and_transitions(speaker_segments)
    for result in meeting_results:
        result["meeting_id"] = meeting_id
    all_results.extend(meeting_results)

# Create DataFrame for transitions across all meetings
transition_df = pd.DataFrame(all_results)

# Show transition data
print(transition_df)

# Save the results to a CSV file
transition_df.to_csv("meeting_transitions_with_sentiment.csv", index=False)
