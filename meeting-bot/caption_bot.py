import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import sys  
print("Bot script started")

if len(sys.argv) < 2:
    print("Meeting code not provided.")
    sys.exit(1)

meeting_code = sys.argv[1]
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

def capture_live_captions():
    print("Starting live caption scraping...")
    seen = set()
    collected = []
    last_caption = None  # To store the last caption and check if it's part of the same sentence

    while True:
        try:

            captions_region = driver.find_element(By.XPATH, '//div[@role="region" and @aria-label="Captions"]')
            caption_divs = captions_region.find_elements(By.XPATH, './/div[contains(@class, "nMcdL")]')

            if not caption_divs:
                print("No captions found.")
            
            for caption in caption_divs:
                try:
                    caption_id = caption.get_attribute("data-request-id") or caption.text
                    if caption_id in seen:
                        continue  # Skip already processed captions
                    seen.add(caption_id)

                    try:
                        speaker_name = caption.find_element(By.CLASS_NAME, 'NWpY1d').text
                    except:
                        speaker_name = "Unknown"

                    caption_text = caption.find_element(By.CLASS_NAME, 'yg').text

                    if caption_text.strip():
                        print(f"{speaker_name}: {caption_text}")
                        
                        # Check if the current caption is part of the same sentence as the last one
                        if last_caption and last_caption['speaker'] == speaker_name:
                            last_caption['text'] += " " + caption_text
                        else:
                            # If it's a new sentence, store it as a new caption
                            collected.append({
                                "speaker": speaker_name,
                                "text": caption_text
                            })
                        last_caption = collected[-1]  # Update last caption to the most recent one
                except Exception as e:
                    print(f"Error extracting caption: {str(e)}")

            time.sleep(2)
        except KeyboardInterrupt:
            print("Stopping caption scraper.")
            break
        except Exception as e:
            print(f"Error in loop: {str(e)}")
            time.sleep(2)

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

captions = capture_live_captions()
save_transcript_as_vtt(captions)

print("Bot has finished interacting with Meet. Browser will stay open now.")
while True:
    time.sleep(10)