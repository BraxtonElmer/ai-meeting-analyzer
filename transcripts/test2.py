import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import config

# Meet link
meet_link = config.meet_link

# Name you want to appear as
guest_name = config.name

# Chrome options to block camera and mic permissions
options = uc.ChromeOptions()
prefs = {
    "profile.default_content_setting_values.media_stream_mic": 2,     # Block microphone
    "profile.default_content_setting_values.media_stream_camera": 2,  # Block camera
    "profile.default_content_setting_values.geolocation": 2,          # Block location access
    "profile.default_content_setting_values.notifications": 2         # Block notifications
}
options.add_experimental_option("prefs", prefs)
options.add_argument("--start-maximized")

# Launch browser with options
driver = uc.Chrome(options=options)
wait = WebDriverWait(driver, 20)

driver.maximize_window()

driver.get(meet_link)

# Wait for the page to load
time.sleep(5)

try:
    # Click "Continue without them" if appears
    try:
        continue_button = wait.until(EC.element_to_be_clickable((By.XPATH, '//span[contains(text(), "Continue without microphone and camera")]')))
        continue_button.click()
        print("Clicked 'Continue without microphone and camera' button.")
    except Exception:
        print("Disable Access to microphone and camera button not found.")

    # Enter name in the input box
    name_box = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[aria-label="Your name"]')))
    name_box.send_keys(guest_name)

    time.sleep(1)

    # Click "Ask to join" button
    ask_to_join = wait.until(EC.element_to_be_clickable((By.XPATH, '//span[contains(text(), "Ask to join")]')))
    ask_to_join.click()

    print("Asked to join the meeting as guest!")


    gotit = wait.until(EC.element_to_be_clickable((By.XPATH, '//span[contains(text(), "Got it")]')))
    gotit.click()

except Exception as e:
    print(f"Error: {str(e)}")

# to end the program
# driver.quit()
print("Bot has finished interacting with Meet. Browser will stay open now.")
while True:
    time.sleep(10)
# having an infinite loop to keep the browser open