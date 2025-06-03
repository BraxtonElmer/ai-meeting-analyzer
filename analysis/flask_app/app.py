from flask import Flask, jsonify, request
from utils.speaker_contribution import analyze_speaker_contribution
from utils.sentiment_analysis import analyze_sentiment_transitions
from utils.agenda_alignment import analyze_agenda_drift

app = Flask(__name__)
@app.route("/")
def index():
    return jsonify({"message": "API is running. Use the /api endpoints with meeting_id"})


@app.route("/api/speaker_contribution/<int:meeting_id>")
def speaker_contribution(meeting_id):
    result = analyze_speaker_contribution(meeting_id)
    return jsonify(result)

@app.route("/api/sentiment_transition/<int:meeting_id>")
def sentiment_transition(meeting_id):
    result = analyze_sentiment_transitions(meeting_id)
    return jsonify(result)

@app.route("/api/agenda_drift/<int:meeting_id>")
def agenda_drift(meeting_id):
    result = analyze_agenda_drift(meeting_id)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True,port=6000)
