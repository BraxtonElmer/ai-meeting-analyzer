import os
import sys
from diarization import diarize
from frame_extraction import extract_frame
from ocr_reader import detect_name
from transcription import transcribe
from utils import create_folder

# Set environment variable to handle OpenMP runtime conflict
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

# -------- CONFIG --------
VIDEO_FILE = "meeting.mp4"
AUDIO_FILE = "audio_recording.wav"
FRAME_DIR = "frames"
OUTPUT_FILE = "final_transcript.txt"
MODEL_SIZE = "base"  # tiny, base, small, medium, large
# ------------------------

def main():
    create_folder(FRAME_DIR)
    segments = diarize(AUDIO_FILE)
    speaker_info = []
    for idx, (start, end, _) in enumerate(segments):
        frame_path = os.path.join(FRAME_DIR, f"frame_{idx}.jpg")
        extract_frame(VIDEO_FILE, start, frame_path)
        name = detect_name(frame_path)
        speaker_info.append((start, end, name))
    print("[4/5] Speaker names detected.")
    transcript = transcribe(AUDIO_FILE, model_size=MODEL_SIZE)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("Meeting Transcript:\n\n")
        for start, end, name in speaker_info:
            f.write(f"[{start:.2f}s - {end:.2f}s] {name}: <speech>\n")
        f.write("\n\nFull Transcript:\n\n")
        f.write(transcript)
    print(f"[5/5] Finished! Output saved to {OUTPUT_FILE}.")

if __name__ == "__main__":
    main()