from flask import Flask, request, jsonify
import subprocess
import sys
from pathlib import Path
import os
from flask_cors import CORS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/api/caption-bot/start', methods=['POST'])
def start_caption_bot():
    data = request.get_json()
    logger.info(f"Received bot start request with data: {data}")
    meeting_code = data.get('meeting_code')
    if not meeting_code:
        logger.error("No meeting code provided in request")
        return jsonify({"status": "error", "message": "No meeting code provided"}), 400

    logger.info(f"Received meeting code: {meeting_code}")

    try:
        # Log to a file so we can debug if it fails
        log_path = Path("bot_output.log")
        logger.info(f"Starting caption bot with meeting code: {meeting_code}")
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"Python executable: {sys.executable}")
        logger.info(f"Caption bot script path: {os.path.join(os.path.dirname(__file__), 'caption_bot.py')}")
        
        with open(log_path, "w") as f:
            process = subprocess.Popen(
                [sys.executable, "caption_bot.py", meeting_code],
                stdout=f,
                stderr=subprocess.STDOUT,
                cwd=os.path.dirname(__file__)  # Ensure it runs from correct directory
            )
        logger.info(f"Bot process started with PID: {process.pid}")
        return jsonify({"status": "success", "message": "Bot started."})
    except Exception as e:
        logger.error(f"Error starting bot: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask application...")
    app.run(host='0.0.0.0', port=5050, debug=True)