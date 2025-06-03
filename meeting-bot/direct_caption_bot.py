"""
Enhanced caption bot that directly stores captions in the database.
"""
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import sys  
import re
import json
import requests
from datetime import datetime
import traceback
import hashlib

# Import direct database utilities
try:
    from direct_db_pg import add_transcription_entry, update_transcription_live_status
    print("Successfully imported direct_db_pg module")
except ImportError as e:
    print(f"Error importing direct_db_pg module: {e}")
    traceback.print_exc()
    sys.exit(1)

print("Bot script started")

# Helper function to extract meeting code from URL
def extract_meeting_code(url):
    # Extract code from https://meet.google.com/XXX-XXXX-XXX format
    pattern = r'meet\.google\.com/([a-z0-9\-]+)'
    match = re.search(pattern, url)
    if match:
        return match.group(1)
    return url  # Return original if no match (assuming it's already a code)

if len(sys.argv) < 2:
    print("Meeting URL or code not provided.")
    sys.exit(1)

# Check if argument is a URL or just a meeting code
input_arg = sys.argv[1]
meeting_id = int(sys.argv[2]) if len(sys.argv) > 2 else None
callback_url = sys.argv[3] if len(sys.argv) > 3 else None

# Extract meeting code if it's a URL
meeting_code = extract_meeting_code(input_arg)
print(f"Starting bot for meeting code: {meeting_code}")

# Construct full Google Meet URL from code
meet_link = f"https://meet.google.com/{meeting_code}"

guest_name = "GuestBot"  # Or set dynamically

# Chrome options to block camera and mic permissions
options = uc.ChromeOptions()
prefs = {
    "profile.default_content_setting_values.media_stream_mic": 2,
    "profile.default_content_setting_values.media_stream_camera": 2,
    "profile.default_content_setting_values.geolocation": 2,
    "profile.default_content_setting_values.notifications": 2
}
options.add_experimental_option("prefs", prefs)
options.add_argument("--start-maximized")

# Launch browser with options
driver = uc.Chrome(options=options)
wait = WebDriverWait(driver, 20)

driver.maximize_window()
driver.get(meet_link)
time.sleep(5)

try:
    try:
        continue_button = wait.until(EC.element_to_be_clickable(
            (By.XPATH, '//span[contains(text(), "Continue without microphone and camera")]')))
        continue_button.click()
        print("Clicked 'Continue without microphone and camera' button.")
    except Exception:
        print("Disable Access to microphone and camera button not found.")

    name_box = wait.until(EC.presence_of_element_located(
        (By.CSS_SELECTOR, 'input[aria-label="Your name"]')))
    name_box.send_keys(guest_name)
    time.sleep(1)

    ask_to_join = wait.until(EC.element_to_be_clickable(
        (By.XPATH, '//span[contains(text(), "Ask to join")]')))
    ask_to_join.click()
    print("Asked to join the meeting as guest!")
    time.sleep(2)
    try:
        got_it_buttons = wait.until(EC.presence_of_all_elements_located(
            (By.XPATH, '//button[.//span[text()="Got it"]]')))

        clicked = 0
        for btn in got_it_buttons:
            try:
                if btn.is_displayed() and btn.is_enabled():
                    driver.execute_script("arguments[0].click();", btn)
                    print("Clicked a 'Got it' button.")
                    clicked += 1
                    time.sleep(3)
            except Exception as e:
                print("Failed to click one 'Got it' button:", e)
        print("Found these 'Got it' buttons:")
        for b in got_it_buttons:
            print(b.get_attribute('outerHTML'))

        if clicked == 0:
            print("No visible 'Got it' buttons found.")
        else:
            print(f"Clicked {clicked} 'Got it' button(s).")

    except Exception as e:
        print("Error finding 'Got it' buttons:", e)

    try:
        time.sleep(1)
        print("Looking for the 'Turn on captions' button...")
        captions_button = wait.until(EC.element_to_be_clickable(
            (By.XPATH, '//button[@aria-label="Turn on captions"]')))
        captions_button.click()
        
        print("Turned on captions.")
    except Exception:
        print("Captions button not found or already enabled.")

except Exception as e:
    print(f"Error: {str(e)}")

def capture_live_captions(meeting_id=None, callback=None):
    """
    Capture live captions from Google Meet and save them directly to the database.
    
    Args:
        meeting_id: ID of the meeting in the database
        callback: Function to call with new caption data (optional)
    """
    print("Starting live caption scraping...")
    seen = set()  # Set of caption IDs we've already processed
    collected = []  # All collected captions
    
    # More robust duplicate tracking
    processed_texts = set()  # Set of exact text hashes we've processed
    recent_captions = []  # List of recent captions for similarity comparison
    MAX_RECENT_CAPTIONS = 20  # Only keep the last 20 captions for comparison
    
    # Time-based duplicate prevention
    last_speaker_texts = {}  # Last text from each speaker with timestamp
    DUPLICATE_TIME_THRESHOLD = 10  # Seconds to consider similar text a duplicate
    
    # Track most recent caption for each speaker to detect incremental updates
    most_recent_caption_by_speaker = {}  # speaker_name -> most recent complete text

    while True:
        try:
            # Try multiple ways to find captions
            captions_found = False
            captions_region = None
            
            # Try the primary selector first
            try:
                captions_region = driver.find_element(By.XPATH, '//div[@role="region" and @aria-label="Captions"]')
                print("Found captions region with primary selector")
                captions_found = True
            except Exception as e:
                print(f"Primary selector failed: {str(e)}")
                
                # Try alternate selectors
                try:
                    captions_region = driver.find_element(By.XPATH, '//div[contains(@aria-label, "caption") or contains(@aria-label, "Caption")]')
                    print("Found captions region with alternative selector")
                    captions_found = True
                except Exception as e:
                    print(f"Alternative selector failed: {str(e)}")
                    
                    # Try a broader selector
                    try:
                        captions_region = driver.find_element(By.XPATH, '//div[contains(@class, "Pdo15c")]')
                        print("Found captions region with broader selector")
                        captions_found = True
                    except Exception as e:
                        print(f"Broader selector failed: {str(e)}")
            
            if not captions_found:
                print("No captions region found. Waiting and trying again...")
                time.sleep(5)
                continue
                
            # Debug output of what we found
            try:
                print(f"Captions HTML: {captions_region.get_attribute('outerHTML')[:300]}...")
            except:
                print("Could not get caption region HTML")
            
            # Try different ways to find caption elements
            caption_divs = []
            
            # Try standard selectors
            try:
                caption_divs = captions_region.find_elements(By.XPATH, './/div[contains(@class, "nMcdL")]')
                if caption_divs:
                    print(f"Found {len(caption_divs)} captions with standard selector")
            except Exception as e:
                print(f"Standard caption selector failed: {str(e)}")
            
            # If no captions found with standard selector, try alternatives
            if not caption_divs:
                try:
                    # Try a more generic approach - get all child divs
                    caption_divs = captions_region.find_elements(By.XPATH, './div')
                    print(f"Found {len(caption_divs)} captions with generic child selector")
                except Exception as e:
                    print(f"Generic caption selector failed: {str(e)}")
                
                # If still no luck, try an even broader approach
                if not caption_divs:
                    try:
                        caption_divs = captions_region.find_elements(By.XPATH, './/div')
                        print(f"Found {len(caption_divs)} captions with broader selector")
                    except Exception as e:
                        print(f"Broader caption selector failed: {str(e)}")
            
            if not caption_divs:
                print("No caption elements found within the region")
                time.sleep(2)
                continue
            
            # Process found captions
            for caption in caption_divs:
                try:
                    # Generate a unique ID for this caption
                    try:
                        caption_id = caption.get_attribute("data-request-id") 
                    except:
                        caption_id = None
                    
                    if not caption_id:
                        caption_id = caption.text or str(id(caption))
                    
                    if caption_id in seen:
                        continue  # Skip already processed captions
                    
                    seen.add(caption_id)
                    
                    # Debug the raw caption
                    try:
                        print(f"Processing caption: {caption.text}")
                        print(f"Caption HTML: {caption.get_attribute('outerHTML')}")
                    except:
                        print("Could not print caption details")
                    
                    # Extract speaker name and text using multiple methods
                    speaker_name = "Unknown"
                    caption_text = ""
                    
                    # Try to extract speaker name
                    try:
                        # Method 1: Look for a specific class
                        speaker_element = caption.find_element(By.CLASS_NAME, 'NWpY1d')
                        speaker_name = speaker_element.text
                        print(f"Got speaker name with method 1: {speaker_name}")
                    except Exception as e:
                        print(f"Method 1 speaker extraction failed: {str(e)}")
                        
                        # Method 2: Look for first div or span
                        try:
                            speaker_elements = caption.find_elements(By.XPATH, './/div[1] | .//span[1]')
                            if speaker_elements:
                                speaker_name = speaker_elements[0].text
                                print(f"Got speaker name with method 2: {speaker_name}")
                        except Exception as e:
                            print(f"Method 2 speaker extraction failed: {str(e)}")
                      # Try to extract text
                    try:
                        # Method 1: Look for a specific class
                        text_element = caption.find_element(By.CLASS_NAME, 'yg')
                        caption_text = text_element.text
                        print(f"Got text with method 1: {caption_text}")
                    except Exception as e:
                        print(f"Method 1 text extraction failed: {str(e)}")
                        
                        # Method 2: Use the full text and try to separate speaker and content
                        try:
                            full_text = caption.text
                            if speaker_name != "Unknown" and full_text.startswith(speaker_name):
                                caption_text = full_text[len(speaker_name):].strip()
                            else:
                                caption_text = full_text
                            print(f"Got text with method 2: {caption_text}")
                        except Exception as e:
                            print(f"Method 2 text extraction failed: {str(e)}")
                      
                    # Clean up the extracted text - separate the latest sentence from any accumulated text
                    if caption_text.strip():
                        # Get only the last sentence if there are multiple sentences
                        # This helps avoid the accumulation problem in Google Meet captions
                        sentences = re.split(r'[.!?]\s+', caption_text.strip())
                        if len(sentences) > 1 and len(sentences[-1]) > 0:
                            # Only take the last sentence if it looks like a new sentence was added
                            caption_text = sentences[-1].strip()
                            print(f"Extracted latest sentence: {caption_text}")
                              # If we have text, process it
                    if caption_text.strip():
                        print(f"Final extracted: {speaker_name}: {caption_text}")
                        print(f"Caption text length: {len(caption_text)} characters")
                        
                        # Check if this is an incremental update to a previous caption from this speaker
                        speaker_key = speaker_name.lower().strip()
                        if speaker_key in most_recent_caption_by_speaker:
                            previous_text = most_recent_caption_by_speaker[speaker_key]
                            # Extract only the new content
                            new_content = extract_new_content(caption_text, previous_text)
                            
                            if not new_content:
                                print(f"No new content detected, skipping duplicate")
                                continue
                                
                            if len(new_content) < len(caption_text):
                                print(f"Extracted new content: '{new_content}' from '{caption_text}'")
                                caption_text = new_content
                        
                        # Store this as the most recent caption for this speaker
                        most_recent_caption_by_speaker[speaker_key] = caption_text
                        
                        # Multi-level duplicate detection
                        current_time = time.time()
                        
                        # 1. Check exact text duplicates
                        text_hash = generate_text_hash(caption_text, speaker_name)
                        if text_hash in processed_texts:
                            print(f"Skipping exact duplicate: {caption_text}")
                            continue
                        
                        # 2. Check for similar text from the same speaker within threshold time
                        is_duplicate = False
                        speaker_key = speaker_name.lower().strip()
                        
                        if speaker_key in last_speaker_texts:
                            last_text, last_time = last_speaker_texts[speaker_key]
                            time_diff = current_time - last_time
                            
                            # If this is a similar text from same speaker within threshold time
                            if time_diff < DUPLICATE_TIME_THRESHOLD and is_similar_text(last_text, caption_text):
                                print(f"Skipping similar text from {speaker_name} within {time_diff:.1f}s: {caption_text}")
                                is_duplicate = True
                        
                        # 3. Check for very similar text in recent captions (even from different speakers)
                        if not is_duplicate:
                            for recent_text, recent_speaker, _ in recent_captions:
                                if is_similar_text(recent_text, caption_text, threshold=0.85):
                                    print(f"Skipping similar text to recent caption: {caption_text}")
                                    is_duplicate = True
                                    break
                        
                        if is_duplicate:
                            continue
                            
                        # Not a duplicate - process this caption
                        processed_texts.add(text_hash)
                        
                        # Update recent captions list
                        recent_captions.append((caption_text, speaker_name, current_time))
                        if len(recent_captions) > MAX_RECENT_CAPTIONS:
                            recent_captions.pop(0)  # Remove oldest caption
                        
                        # Update last text from this speaker
                        last_speaker_texts[speaker_key] = (caption_text, current_time)
                        
                        # Create a new caption for each piece of text
                        new_caption = {
                            "speaker": speaker_name,
                            "text": caption_text,
                            "timestamp": current_time,
                            "meeting_id": meeting_id
                        }
                        collected.append(new_caption)
                          # Save to database directly
                        timestamp = datetime.fromtimestamp(new_caption["timestamp"]).isoformat()
                        try:
                            # Log before saving to database
                            print(f"Saving to database: [{speaker_name}] {caption_text[:50]}{'...' if len(caption_text) > 50 else ''}")
                            
                            entry = add_transcription_entry(
                                meeting_id=meeting_id,
                                speaker_name=speaker_name,
                                text=caption_text,
                                timestamp=timestamp,
                                live=True
                            )
                            
                            if entry:
                                print(f"Successfully saved to database with ID: {entry.get('id')}")
                            else:
                                # This could be None if it was a duplicate at the database level
                                print("Not saved to database (likely duplicate)")
                        except Exception as e:
                            print(f"Error saving to database: {str(e)}")
                            traceback.print_exc()
                        
                        # Send to API callback if provided (for compatibility)
                        if callback:
                            callback(new_caption)
                
                except Exception as e:
                    print(f"Error processing caption: {str(e)}")
                    traceback.print_exc()
            
            # Wait before checking for new captions
            time.sleep(2)
            
        except KeyboardInterrupt:
            print("Stopping caption scraper.")
            break
        except Exception as e:
            print(f"Error in main caption loop: {str(e)}")
            traceback.print_exc()
            time.sleep(5)  # Longer wait time on error

    return collected

def save_transcript_as_vtt(captions):
    with open("captions.vtt", "w") as file:
        timestamp = 0.0
        for caption in captions:
            start_time = timestamp
            end_time = timestamp + len(caption['text'].split()) * 0.5  # Approximate duration based on word count
            timestamp += end_time - start_time  # Update the timestamp for the next caption
            
            file.write(f"{start_time:.3f} --> {end_time:.3f}")
            file.write(f"{caption['speaker']}: {caption['text']}")
    print("Captions saved as captions.vtt")

# Define the callback function to send captions to the API (for compatibility)
def send_caption_to_api(caption_data):
    if not callback_url:
        return
    
    try:
        # Format the caption data for the API
        formatted_data = {
            "speaker": caption_data["speaker"],
            "text": caption_data["text"],
            "timestamp": datetime.fromtimestamp(caption_data["timestamp"]).isoformat(),
            "meetingId": meeting_id
        }
        
        print(f"Sending caption to API: {formatted_data}")
        
        # Send to callback URL
        response = requests.post(
            callback_url,
            json=formatted_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"Successfully sent caption to API: {caption_data['text']}")
            print(f"API Response: {response.text}")
        else:
            print(f"Failed to send caption to API. Status code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error sending caption to API: {str(e)}")
        traceback.print_exc()

def generate_text_hash(text, speaker):
    """Generate a hash from text and speaker to identify duplicate captions"""
    if not text:
        return None
    # Normalize the text: lowercase, strip spaces, remove punctuation
    combined = f"{text.strip().lower()}:{speaker.strip().lower()}"
    return hashlib.md5(combined.encode()).hexdigest()

def normalize_text(text):
    """Normalize text for comparison by removing extra spaces and lowercasing"""
    if not text:
        return ""
    # Remove extra spaces, lowercase everything
    return ' '.join(text.strip().lower().split())

def is_similar_text(text1, text2, threshold=0.9):
    """Check if two texts are similar enough to be considered duplicates"""
    if not text1 or not text2:
        return False
    
    # Normalize both texts
    norm_text1 = normalize_text(text1)
    norm_text2 = normalize_text(text2)
    
    # Quick check for exact match after normalization
    if norm_text1 == norm_text2:
        return True
    
    # Check if one is a substring of the other
    if norm_text1 in norm_text2 or norm_text2 in norm_text1:
        return True
    
    # For partial matches, calculate similarity
    # Use a basic approach: count matching words
    words1 = set(norm_text1.split())
    words2 = set(norm_text2.split())
    
    # No similarity if either has no words
    if not words1 or not words2:
        return False
    
    # Calculate Jaccard similarity: intersection over union
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    similarity = intersection / union if union > 0 else 0
    return similarity >= threshold

def extract_new_content(new_text, previous_text):
    """
    Extract only the new content when captions are incremental
    
    Args:
        new_text (str): The new caption text (potentially including previous text)
        previous_text (str): The previously captured text
    
    Returns:
        str: Only the newly added content
    """
    if not previous_text or not new_text:
        return new_text
        
    # Normalize both texts for comparison
    norm_previous = normalize_text(previous_text)
    norm_new = normalize_text(new_text)
    
    # If new text is exactly the same as previous, return empty
    if norm_new == norm_previous:
        return ""
        
    # If new text starts with previous text, extract only the new part
    if norm_new.startswith(norm_previous):
        # Return only the newly added content
        return new_text[len(previous_text):].strip()
        
    # If previous text is a substring of new text but not at the start
    # (like when Google Meet starts a new caption in the middle)
    if norm_previous in norm_new:
        idx = new_text.lower().find(previous_text.lower()) + len(previous_text)
        return new_text[idx:].strip()
        
    # If they're completely different, it's likely a new caption
    return new_text

# Start capturing captions with the callback
print(f"Starting caption capture for meeting ID: {meeting_id}")
captions = capture_live_captions(meeting_id=meeting_id, callback=send_caption_to_api)

# When done, save the transcript
save_transcript_as_vtt(captions)

# Update all transcriptions to non-live when bot exits
try:
    print(f"Updating all transcriptions for meeting {meeting_id} to non-live")
    update_result = update_transcription_live_status(meeting_id, False)
    if update_result:
        print("Successfully updated transcription status to non-live")
    else:
        print("Failed to update transcription status")
except Exception as e:
    print(f"Error updating transcription status: {str(e)}")
    traceback.print_exc()

print("Bot has finished interacting with Meet. Browser will stay open now.")
while True:
    time.sleep(10)
