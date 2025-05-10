import pandas as pd
from sentence_transformers import SentenceTransformer, util
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import re
import json
from collections import defaultdict
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database configuration from environment variables
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create PostgreSQL database engine
engine = create_engine(DATABASE_URL)

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

def main():
    try:
        # Query to get transcripts data
        query = text("""
            SELECT 
                meeting_id,
                meeting_title,
                transcript0,
                transcript1
            FROM transcripts
            WHERE transcript0 IS NOT NULL OR transcript1 IS NOT NULL
            ORDER BY meeting_id
        """)
        
        # Execute query and load results into a DataFrame
        with engine.connect() as connection:
            df = pd.read_sql(query, connection)
        
        # Group transcriptions by meeting
        all_results = []
        for meeting_id, group in df.groupby('meeting_id'):
            # Combine all transcriptions for this meeting
            transcript_text = ""
            for _, row in group.iterrows():
                if pd.notna(row['transcript0']):
                    transcript_text += row['transcript0'] + "\n"
                if pd.notna(row['transcript1']):
                    transcript_text += row['transcript1'] + "\n"
            
            # Parse speaker segments
            speaker_segments = parse_speakers(transcript_text)

            # Debug check
            print(f"\n--- Debugging Meeting ID {meeting_id} ---")
            print(f"Meeting Title: {group['meeting_title'].iloc[0]}")
            print(f"Transcript snippet:\n{transcript_text[:300]}")
            print("Parsed speakers:", list(speaker_segments.keys()))

            if len(speaker_segments) < 2:
                print(f"Skipping Meeting ID {meeting_id} - Less than 2 speakers parsed.")
                continue

            # Analyze sentiment
            meeting_results = analyze_sentiment_and_transitions(speaker_segments)
            for result in meeting_results:
                result["meeting_id"] = meeting_id
                result["meeting_title"] = group['meeting_title'].iloc[0]
            all_results.extend(meeting_results)

        # Create DataFrame for transitions across all meetings
        transition_df = pd.DataFrame(all_results)

        # Show transition data
        print("\nTransition Analysis Results:")
        print(transition_df)

        # Convert DataFrame to list of dictionaries
        results_list = transition_df.to_dict('records')

        # Group results by meeting_id
        grouped_results = defaultdict(list)
        meeting_titles = {}  # Store meeting titles
        for result in results_list:
            meeting_id = result['meeting_id']
            meeting_titles[meeting_id] = result['meeting_title']  # Store the title
            grouped_results[meeting_id].append({
                'from_speaker': result['from_speaker'],
                'to_speaker': result['to_speaker'],
                'transition_smoothness': result['transition_smoothness'],
                'sentiment': result['sentiment']
            })

        # Convert to final format
        final_results = []
        for meeting_id, transitions in grouped_results.items():
            final_results.append({
                'meeting_id': meeting_id,
                'meeting_title': meeting_titles[meeting_id],  # Use stored title
                'transitions': transitions
            })

        # Save the results to a JSON file
        with open('meeting_transitions.json', 'w') as f:
            json.dump(final_results, f, indent=2)
        print("\n✅ Results saved to: meeting_transitions.json")

    except Exception as e:
        print(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    main()
