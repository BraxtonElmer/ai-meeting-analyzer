import os
import json
import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
import seaborn as sns
from io import StringIO

# Set up Streamlit page configuration
st.set_page_config(page_title="Meeting Drift and Sentiment Analysis", layout="wide")

# Output directory where JSON files are stored for topic and speaker drift results
output_dir = "agenda_drift_results"
files = [f for f in os.listdir(output_dir) if f.endswith(".json")]

# Prepare a list to collect data for visualization
topic_drift_data = []
speaker_drift_data = []

# Read and process each file for topic drift and speaker drift
for file in files:
    with open(os.path.join(output_dir, file), "r") as f:
        result = json.load(f)

    meeting_id = result["meeting_id"]

    for topic_data in result["topics"]:
        topic = topic_data["topic"]
        topic_drift = topic_data["topic_drift"]
        topic_drift_data.append({"meeting_id": meeting_id, "topic": topic, "topic_drift": topic_drift})

        if "speaker_drift" in topic_data:
            for speaker, drift in topic_data["speaker_drift"].items():
                speaker_drift_data.append({"meeting_id": meeting_id, "topic": topic, "speaker": speaker, "drift": drift})

# Convert to DataFrames for easy plotting
topic_drift_df = pd.DataFrame(topic_drift_data)
speaker_drift_df = pd.DataFrame(speaker_drift_data)

# Sample data for transition smoothness and sentiment (You can replace this with CSV file upload)
data = StringIO("""
from_speaker,to_speaker,transition_smoothness,sentiment,meeting_id
Alice,Bob,1.0,Positive,1
Bob,Charlie,0.57,Negative,1
Ravi,Anil,1.0,Positive,2
Anil,Karan,0.66,Positive,2
Karan,Meera,1.0,Positive,2
Meera,Priya,1.0,Positive,2
Priya,Divya,1.0,Positive,2
Ananya,Neha,1.0,Positive,3
Neha,Pooja,1.0,Positive,3
Pooja,Vikram,1.0,Positive,3
Vikram,Arjun,1.0,Positive,3
Arjun,Ravi,1.0,Positive,3
""")

# Load transition data into DataFrame
df = pd.read_csv(data)

# Define color mapping for sentiment
color_map = {"Positive": "green", "Negative": "red", "Neutral": "orange"}
df['color'] = df['sentiment'].map(color_map)

# Function to plot graphs for each meeting
def plot_graphs_for_meeting(meeting_id):
    # Filter data for the current meeting
    topic_drift_meeting = topic_drift_df[topic_drift_df["meeting_id"] == meeting_id]
    speaker_drift_meeting = speaker_drift_df[speaker_drift_df["meeting_id"] == meeting_id]
    sentiment_meeting = df[df["meeting_id"] == meeting_id]
    
    # Create columns for side-by-side layout
    col1, col2 = st.columns(2)
    
    with col1:
        # Plot Topic Drift Graph for this meeting (Smaller size)
        plt.figure(figsize=(8, 4))  # Smaller figure size
        sns.barplot(data=topic_drift_meeting, x="topic", y="topic_drift", palette="viridis")
        plt.title(f"Topic Drift Score for Meeting {meeting_id}")
        plt.xlabel("Topic")
        plt.ylabel("Topic Drift Score")
        plt.xticks(rotation=45, ha="right")
        st.pyplot(plt)

    with col2:
        # Plot Speaker Drift Graph for this meeting (Smaller size)
        plt.figure(figsize=(8, 4))  # Smaller figure size
        sns.barplot(data=speaker_drift_meeting, x="speaker", y="drift", hue="topic", palette="viridis")
        plt.title(f"Speaker Drift Score for Meeting {meeting_id}")
        plt.xlabel("Speaker")
        plt.ylabel("Speaker Drift Score")
        plt.xticks(rotation=45, ha="right")
        st.pyplot(plt)
        
    # Plot Transition Smoothness & Sentiment for this meeting
    plt.figure(figsize=(10, 4))
    labels = [f"{row['from_speaker']}→{row['to_speaker']}" for _, row in sentiment_meeting.iterrows()]
    bars = plt.bar(labels, sentiment_meeting['transition_smoothness'], color=sentiment_meeting['color'])

    # Annotate bars
    for bar, sentiment in zip(bars, sentiment_meeting['sentiment']):
        plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                 sentiment, ha='center', va='bottom', fontsize=9)

    plt.ylim(0, 1.1)
    plt.title(f"Meeting {meeting_id} - Transition Smoothness & Sentiment")
    plt.ylabel("Transition Smoothness (0 to 1)")
    plt.xticks(rotation=45)
    plt.grid(axis='y', linestyle='--', alpha=0.6)
    plt.tight_layout()
    st.pyplot(plt)

# Streamlit UI to select meeting and display results
st.title("Meeting Drift and Sentiment Analysis")
meeting_id = st.selectbox("Select a Meeting ID", topic_drift_df["meeting_id"].unique())

plot_graphs_for_meeting(meeting_id)
