import os
import psycopg2
import argparse
from dotenv import load_dotenv
from datetime import timedelta
from collections import defaultdict
import traceback
import google.generativeai as genai

# ─── 1. Load environment variables ─────────────────────────────────────────────
load_dotenv()
DATABASE_URL   = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ─── 2. Configure Gemini (Flash model) ────────────────────────────────────────
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("models/gemini-1.5-flash")

# ─── 3. Parse required command‐line argument ──────────────────────────────────
parser = argparse.ArgumentParser(description="Populate transcript and agenda for a single meeting_id.")
parser.add_argument(
    "--meeting_id",
    type=int,
    required=True,
    help="The meeting_id to process (must be missing in transcripts)."
)
args = parser.parse_args()
target_meeting = args.meeting_id

# ─── 4. Fetch transcription entries only for that meeting_id ──────────────────
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    cur.execute("""
        SELECT 
            m.id          AS meeting_id,
            m.title       AS meeting_title,
            m.summary     AS meeting_summary,
            m.agenda      AS stored_agenda,
            u.full_name   AS speaker,
            t.text,
            t.timestamp,
            t.live
        FROM transcription_entries t
        JOIN users u ON t.user_id    = u.id
        JOIN meetings m ON t.meeting_id = m.id
        WHERE t.live = FALSE
          AND m.id = %s
        ORDER BY t.timestamp;
    """, (target_meeting,))
    rows = cur.fetchall()
    cur.close()
except Exception as db_err:
    print(f"❌ Error fetching transcripts for meeting_id {target_meeting}: {db_err}")
    raise

if not rows:
    print(f"ℹ️ No non‐live transcription entries found for meeting_id {target_meeting}. Nothing to do.")
    conn.close()
    exit(0)

# ─── 5. Organize transcript data for that meeting ─────────────────────────────
segment_duration = timedelta(seconds=5)
data = {
    "transcript_lines": [],    # List of (speaker, text)
    "segment_datetimes": [],   # List of datetime objects
    "agenda":           None,
    "title":            None,
    "summary":          None
}

for meeting_id, title, summary, agenda, speaker, text, timestamp, live in rows:
    data["segment_datetimes"].append(timestamp)
    data["transcript_lines"].append((speaker, text.strip()))
    data["title"]   = title
    data["agenda"]  = agenda
    data["summary"] = summary

print(f"DEBUG: Loaded {len(data['transcript_lines'])} transcript segments for meeting {target_meeting}.")

# ─── 6. Helper: Clean an agenda topic string ──────────────────────────────────
def clean_topic(topic: str) -> str:
    if not topic:
        return ""
    topic = topic.replace("*", "").replace("•", "").strip()
    while topic.endswith((".", ":", "…")):
        topic = topic[:-1].strip()
    return " ".join(topic.split())

# ─── 7. Helper: Check if stored agenda is meaningful ──────────────────────────
def has_meaningful_agenda(txt) -> bool:
    if not txt:
        return False
    if isinstance(txt, list):
        for line in txt:
            if line and line.strip("•- ").strip():
                return True
        return False
    if isinstance(txt, str):
        cleaned = "".join(txt.split()).lstrip("•-")
        return bool(cleaned)
    return False

# ─── 8. Helper: Generate three bullet‐point agenda items via Gemini ───────────
def generate_agenda_from_text(text: str, meeting_id: int) -> list[str]:
    try:
        prompt = (
            "You are given a meeting transcript or summary. Generate exactly three bullet points "
            "that summarize the main topics of the meeting.\n"
            "If the transcript is too short or lacks detail, you may rely on the provided summary instead.\n\n"
            f"Transcript or Summary:\n{text}\n\n"
            "*IMPORTANT:* Reply with three distinct lines, each a concise topic. "
            "Do NOT include numbering or extra punctuation."
        )
        response = model.generate_content(prompt)
        raw_lines = getattr(response, "text", "").strip().splitlines()
        cleaned   = [clean_topic(ln) for ln in raw_lines if ln.strip()]
        return cleaned[:3]
    except Exception as e:
        print(f"❌ Gemini error for meeting {meeting_id}: {e}")
        traceback.print_exc()
        return ["(Unable to generate agenda)"]

# ─── 9. Helper: Convert a timedelta into “MM:SS:cs” ───────────────────────────
def format_mmsscs(td: timedelta) -> str:
    total_ms    = int(td.total_seconds() * 1000)
    total_cs    = total_ms // 10              # centiseconds
    minutes     = total_cs // 6000            # 6000 cs = 60 s
    seconds     = (total_cs % 6000) // 100     # 100 cs = 1 s
    centisec    = total_cs % 100
    return f"{minutes:02d}:{seconds:02d}:{centisec:02d}"

# ─── 10. Build transcript string and agenda items for this meeting ────────────
first_dt = data["segment_datetimes"][0]
last_dt  = data["segment_datetimes"][-1] + segment_duration
total_duration_td = last_dt - first_dt
total_ms = int(total_duration_td.total_seconds() * 1000)

window_ms = total_ms / 3
boundaries = [0, window_ms, 2 * window_ms, total_ms]

formatted_transcript_lines = []
for i, (speaker, txt) in enumerate(data["transcript_lines"]):
    offset_td = data["segment_datetimes"][i] - first_dt
    start_str = format_mmsscs(offset_td)
    end_offset_td = (data["segment_datetimes"][i] + segment_duration) - first_dt
    end_str = format_mmsscs(end_offset_td)
    formatted_transcript_lines.append(f"{speaker}: {start_str} --> {end_str} {txt}")

combined_transcript = " ".join(formatted_transcript_lines)

# Decide whether to generate a new agenda or use stored
stored_agenda = data["agenda"]
summary = data["summary"] or ""

if not has_meaningful_agenda(stored_agenda):
    source_text = combined_transcript if len(combined_transcript) >= 200 else summary
    agenda_items = generate_agenda_from_text(source_text, target_meeting)
else:
    if isinstance(stored_agenda, list):
        agenda_lines = stored_agenda
    else:
        agenda_lines = stored_agenda.splitlines()
    agenda_items = [clean_topic(line) for line in agenda_lines if line.strip()]

final_agenda = [
    item for item in agenda_items
    if item and "based on limited information" not in item.lower()
]

# ─── 11. Insert agenda & transcript rows for this meeting ────────────────────
try:
    cur = conn.cursor()

    if final_agenda:
        num_topics = min(len(final_agenda), 3)
        for idx, topic in enumerate(final_agenda[:3]):
            start_ms = round(boundaries[idx])
            end_ms   = round(boundaries[idx + 1])

            start_td = timedelta(milliseconds=start_ms)
            end_td   = timedelta(milliseconds=end_ms)
            start_time_str = format_mmsscs(start_td)
            end_time_str   = format_mmsscs(end_td)

            cur.execute("""
                INSERT INTO agenda (meeting_id, topic, start_time, end_time)
                VALUES (%s, %s, %s, %s)
            """, (target_meeting, topic, start_time_str, end_time_str))
    else:
        print(f"⚠️ No valid agenda topics for meeting {target_meeting}, skipping agenda insertion.")

    MAX_CHARS = 8000
    if len(combined_transcript) <= MAX_CHARS:
        transcript0 = combined_transcript
        transcript1 = None
    else:
        split_idx = combined_transcript[:MAX_CHARS].rfind(" ")
        transcript0 = combined_transcript[:split_idx].strip()
        transcript1 = combined_transcript[split_idx:].strip()

    cur.execute("""
        INSERT INTO transcripts (meeting_id, meeting_title, transcript0, transcript1)
        VALUES (%s, %s, %s, %s)
    """, (target_meeting, data["title"] or "", transcript0, transcript1))

    conn.commit()
    cur.close()
    conn.close()
    print(f"✅ Agenda and transcripts inserted for meeting_id {target_meeting}.")
except Exception as db_err:
    print(f"❌ Error writing to database for meeting {target_meeting}: {db_err}")
    traceback.print_exc()
    conn.rollback()
    conn.close()
