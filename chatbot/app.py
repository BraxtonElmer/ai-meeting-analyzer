from flask import Flask, render_template, request, jsonify
from chatbot import MeetingChatbot
from config import GEMINI_API_KEY

app = Flask(__name__)

# Auto-load transcript when app starts
with open('uploads/meeting_captions.txt', 'r', encoding='utf-8') as f:
    transcript_text = f.read()

chatbot = MeetingChatbot(transcript_text, GEMINI_API_KEY)
summary = chatbot.summarize()

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html', summary=summary)

@app.route('/ask', methods=['POST'])
def ask():
    question = request.form['question']

    if chatbot is None:
        return jsonify({'answer': 'Error: Chatbot not initialized.'})

    answer = chatbot.ask_question(question)
    return jsonify({'answer': answer})

if __name__ == '__main__':
    app.run(debug=True)
