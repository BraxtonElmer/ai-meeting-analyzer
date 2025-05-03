import os
import json
import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
import seaborn as sns

# Set up Streamlit page configuration
st.set_page_config(page_title="Meeting Drift Analysis", layout="wide")

# Output directory where JSON files are stored
output_dir = "agenda_drift_results"
files = [f for f in os.listdir(output_dir) if f.endswith(".json")]

# Prepare a list to collect data for visualization
topic_drift_data = []
speaker_drift_data = []

# Read and process each file
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

# Display the graphs in Streamlit for each meeting

# Function to plot graphs for each meeting
def plot_graphs_for_meeting(meeting_id):
    # Filter data for the current meeting
    topic_drift_meeting = topic_drift_df[topic_drift_df["meeting_id"] == meeting_id]
    speaker_drift_meeting = speaker_drift_df[speaker_drift_df["meeting_id"] == meeting_id]
    
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

# Generate and display graphs for each meeting
for meeting_id in topic_drift_df["meeting_id"].unique():
    plot_graphs_for_meeting(meeting_id)
