import mss
import pytesseract
import cv2
import numpy as np
import time
import os

# Set the path to tesseract executable (if needed)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Update path for your system

# Screen capture settings
monitor = {"top": 0, "left": 0, "width": 1920, "height": 1080}  # Full-screen capture (adjust as needed)

# File to save the extracted captions
output_file = "captions.txt"

def detect_caption_area(frame):
    """
    Detect the captioning area by identifying the region where text usually appears.
    This can be fine-tuned based on your setup, but we will assume the captions are typically at the bottom of the screen.
    """
    # Convert to grayscale for easier processing
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Thresholding to detect bright regions (which is where captions usually appear)
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    
    # Find contours of the areas with text
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Assuming captions are usually near the bottom, we'll filter contours that are close to the bottom of the screen
    screen_height = frame.shape[0]
    caption_area = None
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        # Filter for areas near the bottom of the screen
        if y + h > screen_height - 200:  # Adjust based on where captions usually appear
            caption_area = (x, y, w, h)
            break
    
    return caption_area

def capture_screen():
    with mss.mss() as sct:
        while True:
            # Capture the entire screen
            screenshot = sct.grab(monitor)
            
            # Convert the screenshot to an OpenCV format
            frame = np.array(screenshot)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            
            # Detect the captioning area on the screen
            caption_area = detect_caption_area(frame)
            
            if caption_area:
                # Crop the frame to the caption area
                x, y, w, h = caption_area
                caption_frame = frame[y:y+h, x:x+w]
                
                # Perform OCR to extract text
                text = pytesseract.image_to_string(caption_frame)
                
                if text.strip():
                    print(f"Detected Caption: {text.strip()}")
                    
                    # Save the caption to a file
                    with open(output_file, "a") as file:
                        file.write(text.strip() + "\n")
            
            # Display the frame with a rectangle around the detected area (for debugging)
            if caption_area:
                x, y, w, h = caption_area
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            cv2.imshow("Screen Capture", frame)
            
            # Break the loop if 'q' is pressed
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

# Run the screen capture and transcription process
if __name__ == "__main__":
    print("Starting screen capture and live transcription. Press 'q' to quit.")
    capture_screen()
