import pandas as pd
import matplotlib.pyplot as plt

# Input CSV data as a string (you can replace this with pd.read_csv("your_file.csv") if using a file)
from io import StringIO

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

# Load into DataFrame
df = pd.read_csv(data)

# Define color mapping
color_map = {"Positive": "green", "Negative": "red", "Neutral": "orange"}
df['color'] = df['sentiment'].map(color_map)

# Create plot for each meeting_id
for meeting_id, group in df.groupby('meeting_id'):
    plt.figure(figsize=(10, 4))
    labels = [f"{row['from_speaker']}→{row['to_speaker']}" for _, row in group.iterrows()]
    bars = plt.bar(labels, group['transition_smoothness'], color=group['color'])

    # Annotate bars
    for bar, sentiment in zip(bars, group['sentiment']):
        plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                 sentiment, ha='center', va='bottom', fontsize=9)

    plt.ylim(0, 1.1)
    plt.title(f"Meeting {meeting_id} - Transition Smoothness & Sentiment")
    plt.ylabel("Transition Smoothness (0 to 1)")
    plt.xticks(rotation=45)
    plt.grid(axis='y', linestyle='--', alpha=0.6)
    plt.tight_layout()
    plt.show()