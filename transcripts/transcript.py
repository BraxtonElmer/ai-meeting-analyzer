import whisper
from pyannote.audio import Pipeline
from pyannote.core import Segment
import os
# Load Whisper model for transcription
model = whisper.load_model("base")

# Function to transcribe the audio with timestamps using Whisper
def transcribe_audio(audio_path):
    result = model.transcribe(audio_path)  # Removed word_timestamps parameter
    return result['segments']

hf_token = os.getenv("HF_AUTH_TOKEN")
# Load pyannote's diarization model
pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=hf_token,
)

# Function to perform speaker diarization
def diarize_audio(audio_path):
    diarization = pipeline({"uri": "filename", "audio": audio_path})
    diarization_result = []
    for segment, track, speaker in diarization.itertracks(yield_label=True):
        diarization_result.append({
            'start_time': segment.start,
            'end_time': segment.end,
            'speaker': speaker
        })
    return diarization_result

# Function to combine diarization and transcription
def combine_transcription_and_diarization(transcription_result, diarization_result):
    combined = []
    for segment in transcription_result:
        start_time = segment['start']
        end_time = segment['end']
        text = segment['text']

        # Find the speaker for this time range
        speaker = None
        for diarization in diarization_result:
            if diarization['start_time'] <= start_time <= diarization['end_time'] or \
               diarization['start_time'] <= end_time <= diarization['end_time']:
                speaker = diarization['speaker']
                break

        combined.append(f"[{start_time:.2f}s - {end_time:.2f}s] Speaker {speaker}: {text}")
    return combined

# Path to your audio file
audio_path = r"D:\code\internship\ai-meeting-analyzer\transcripts\audio\agentic_ai_conversation_indian_accent.mp3"  # Change this to your actual file

# Step 1: Get transcription with timestamps
transcription_result = transcribe_audio(audio_path)

# Step 2: Perform diarization
diarization_result = diarize_audio(audio_path)

# Step 3: Combine both results (transcription and diarization)
final_transcript = combine_transcription_and_diarization(transcription_result, diarization_result)

# Print final transcript with speakers and timestamps
for line in final_transcript:
    print(line)