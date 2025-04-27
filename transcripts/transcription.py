import torch
import whisper

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def transcribe(audio_path, model_size="base"):
    model = whisper.load_model(model_size, device=DEVICE)
    result = model.transcribe(audio_path, fp16=(DEVICE == "cuda"))
    print("[3/5] Transcription done.")
    return result['text']