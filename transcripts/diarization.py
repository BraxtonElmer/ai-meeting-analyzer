from pyannote.audio import Pipeline

def diarize(audio_path):
    pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization")
    diarization = pipeline(audio_path)
    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append((turn.start, turn.end, speaker))
    print(f"[2/5] Diarized {len(segments)} segments.")
    return segments