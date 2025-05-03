import whisper
from whisper_mic import MicrophoneStream

# Initialize Whisper model
model = whisper.load_model("base")

# Create a function to process the audio
def process_audio(audio_data):
    # Normalize and convert to float32
    audio_data_float32 = audio_data.astype(np.float32) / 32768.0  # Normalize int16 to [-1.0, 1.0]
    
    # Transcribe the audio using Whisper
    result = model.transcribe(audio_data_float32)
    print("Transcription:", result['text'])

# Create a MicrophoneStream instance
mic_stream = MicrophoneStream(model=model, callback=process_audio)

# Start capturing and processing audio from the microphone
print("Recording...")
mic_stream.start()

# Optional: Add a break condition or sleep time to make it run smoothly (you can press Ctrl+C to stop the process)
try:
    while True:
        pass  # Keep running until interrupted
except KeyboardInterrupt:
    print("Recording stopped by user.")

# Stop the microphone stream when finished
mic_stream.stop()
