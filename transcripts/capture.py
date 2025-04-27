import cv2
import numpy as np
import mss
import pyaudio
import wave
import threading
import time
import os
from moviepy.editor import VideoFileClip, AudioFileClip

# Screen recording settings
monitor = {"top": 0, "left": 0, "width": 1920, "height": 1080}

# Audio recording settings
audio_format = pyaudio.paInt16
channels = 1
rate = 44100  # Sample rate
chunk_size = 1024  # Size of each audio chunk

# Output file paths
SCREEN_RECORDING = "screen_recording.avi"
AUDIO_RECORDING = "audio_recording.wav"
FINAL_RECORDING = "meeting.mp4"

def capture_screen():
    with mss.mss() as sct:
        # Define the codec and create VideoWriter object for video recording
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        out = cv2.VideoWriter(SCREEN_RECORDING, fourcc, 20.0, (monitor['width'], monitor['height']))
        
        # Start screen recording
        start_time = time.time()
        while True:
            # Capture a screenshot
            screenshot = sct.grab(monitor)
            
            # Convert screenshot to OpenCV format
            frame = np.array(screenshot)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            
            # Write the frame to the video file
            out.write(frame)
            
            # Display the recording (optional)
            cv2.imshow('Screen Recording', frame)
            
            # Stop the recording after a certain time (e.g., 60 seconds)
            if time.time() - start_time > 60:  # 1 minute recording
                break
            
            # Break the loop if 'q' is pressed
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        # Release the VideoWriter and close the OpenCV window
        out.release()
        cv2.destroyAllWindows()

def record_audio():
    p = pyaudio.PyAudio()
    
    # Open an audio stream
    stream = p.open(format=audio_format,
                    channels=channels,
                    rate=rate,
                    input=True,
                    frames_per_buffer=chunk_size)
    
    # Create a wave file to save audio
    frames = []
    start_time = time.time()
    
    while True:
        data = stream.read(chunk_size)
        frames.append(data)
        
        # Stop recording after 60 seconds
        if time.time() - start_time > 60:  # 1 minute recording
            break
        
    # Stop the stream and save the audio to a file
    stream.stop_stream()
    stream.close()
    p.terminate()
    
    # Save the audio to a .wav file
    with wave.open(AUDIO_RECORDING, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(p.get_sample_size(audio_format))
        wf.setframerate(rate)
        wf.writeframes(b''.join(frames))

def combine_recordings():
    """Combine screen recording and audio into a single MP4 file."""
    try:
        # Load the video and audio
        video = VideoFileClip(SCREEN_RECORDING)
        audio = AudioFileClip(AUDIO_RECORDING)
        
        # Set the audio of the video
        final_video = video.set_audio(audio)
        
        # Write the result to a file
        final_video.write_videofile(FINAL_RECORDING, codec='libx264')
        
        # Close the clips
        video.close()
        audio.close()
        final_video.close()
        
        # Clean up temporary files
        os.remove(SCREEN_RECORDING)
        os.remove(AUDIO_RECORDING)
        
        print(f"Recording completed and saved to {FINAL_RECORDING}")
        return True
    except Exception as e:
        print(f"Error combining recordings: {str(e)}")
        return False

def start_recording():
    """Start the recording process."""
    print("Starting recording... Press 'q' to stop early.")
    
    # Run the screen recording in a separate thread
    screen_thread = threading.Thread(target=capture_screen)
    screen_thread.start()
    
    # Run the audio recording in a separate thread
    audio_thread = threading.Thread(target=record_audio)
    audio_thread.start()
    
    # Wait for both threads to finish
    screen_thread.join()
    audio_thread.join()
    
    # Combine the recordings
    if combine_recordings():
        print("Recording process completed successfully!")
    else:
        print("Recording process completed with errors.")

if __name__ == "__main__":
    start_recording()
