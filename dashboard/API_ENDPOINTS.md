# API Endpoints for Custom Report Data

This document provides information on how to use the API endpoints for submitting custom report data to be displayed in the Analytics/Reports section of the AI Meeting Assistant.

## Authentication

All API endpoints require authentication. You need to include session cookies from a logged-in user session.

## Base URL

All API endpoints are relative to your application's base URL (e.g., `http://localhost:5000`).

## API Endpoints

### 1. Sentiment Analysis Data

**Endpoint:** `POST /api/reports/custom/sentiment/:meetingId`

**Description:** Submit custom sentiment analysis data for a specific meeting.

**URL Parameters:**
- `meetingId` - The ID of the meeting (required)

**Request Body:**
```json
{
  "overallSentiment": 0.75,
  "sentimentOverTime": [
    { "time": "0:00", "score": 0.6 },
    { "time": "5:00", "score": 0.7 },
    { "time": "10:00", "score": 0.8 },
    { "time": "15:00", "score": 0.7 },
    { "time": "20:00", "score": 0.9 }
  ],
  "topPositiveTopics": [
    "Product features",
    "Customer feedback",
    "Team collaboration"
  ],
  "topNegativeTopics": [
    "Budget constraints",
    "Timeline pressure"
  ]
}
```

### 2. Topic Drift Data

**Endpoint:** `POST /api/reports/custom/topics/:meetingId`

**Description:** Submit custom topic drift analysis data for a specific meeting.

**URL Parameters:**
- `meetingId` - The ID of the meeting (required)

**Request Body:**
```json
{
  "topicDriftScore": 0.3,
  "plannedTopics": [
    "Project Status",
    "Budget Review",
    "Timeline Discussion", 
    "Resource Allocation"
  ],
  "topicCoverage": [
    { "name": "Project Status", "planned": 30, "actual": 25, "drift": 0.17 },
    { "name": "Budget Review", "planned": 20, "actual": 15, "drift": 0.25 },
    { "name": "Timeline Discussion", "planned": 25, "actual": 20, "drift": 0.2 },
    { "name": "Resource Allocation", "planned": 25, "actual": 20, "drift": 0.2 },
    { "name": "Off-topic", "planned": 0, "actual": 20, "drift": 1.0 }
  ],
  "unexpectedTopics": [
    "Office Layout",
    "Company Event Planning",
    "Technical Issues"
  ]
}
```

### 3. Communication Tone Data

**Endpoint:** `POST /api/reports/custom/tone/:meetingId`

**Description:** Submit custom communication tone analysis data for a specific meeting.

**URL Parameters:**
- `meetingId` - The ID of the meeting (required)

**Request Body:**
```json
{
  "dominantTones": [
    "Analytical",
    "Confident",
    "Formal"
  ],
  "toneBreakdown": [
    { "tone": "Analytical", "percentage": 40 },
    { "tone": "Confident", "percentage": 30 },
    { "tone": "Formal", "percentage": 15 },
    { "tone": "Tentative", "percentage": 10 },
    { "tone": "Casual", "percentage": 5 }
  ],
  "participants": [
    {
      "name": "John",
      "tones": {
        "analytical": 60,
        "confident": 20,
        "tentative": 5,
        "casual": 5,
        "formal": 10
      }
    },
    {
      "name": "Sarah",
      "tones": {
        "analytical": 30,
        "confident": 40,
        "tentative": 10,
        "casual": 5,
        "formal": 15
      }
    },
    {
      "name": "Michael",
      "tones": {
        "analytical": 20,
        "confident": 30,
        "tentative": 20,
        "casual": 10,
        "formal": 20
      }
    }
  ]
}
```

### 4. Participant Analysis Data

**Endpoint:** `POST /api/reports/custom/participants/:meetingId`

**Description:** Submit custom participant analysis data for a specific meeting.

**URL Parameters:**
- `meetingId` - The ID of the meeting (required)

**Request Body:**
```json
{
  "participantCount": 4,
  "speakingDistribution": [
    { "name": "John", "speakingTime": 35 },
    { "name": "Sarah", "speakingTime": 25 },
    { "name": "Michael", "speakingTime": 30 },
    { "name": "Emily", "speakingTime": 10 }
  ],
  "interactionStats": [
    { "name": "Questions Asked", "count": 12 },
    { "name": "Interruptions", "count": 8 },
    { "name": "Cross-talk Instances", "count": 5 },
    { "name": "Silent Periods", "count": 3 }
  ],
  "engagement": {
    "high": ["John", "Sarah"],
    "medium": ["Michael"],
    "low": ["Emily"]
  }
}
```

## Usage Examples

### Using cURL

```bash
# Example: Submitting custom sentiment data for meeting ID 1
curl -X POST \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "overallSentiment": 0.75,
    "sentimentOverTime": [
      { "time": "0:00", "score": 0.6 },
      { "time": "5:00", "score": 0.7 },
      { "time": "10:00", "score": 0.8 },
      { "time": "15:00", "score": 0.7 },
      { "time": "20:00", "score": 0.9 }
    ],
    "topPositiveTopics": [
      "Product features",
      "Customer feedback",
      "Team collaboration"
    ],
    "topNegativeTopics": [
      "Budget constraints",
      "Timeline pressure"
    ]
  }' \
  http://localhost:5000/api/reports/custom/sentiment/1
```

### Using JavaScript Fetch API

```javascript
// Example: Submitting custom topic drift data for meeting ID 1
fetch('/api/reports/custom/topics/1', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Important for including session cookies
  body: JSON.stringify({
    "topicDriftScore": 0.3,
    "plannedTopics": [
      "Project Status",
      "Budget Review",
      "Timeline Discussion", 
      "Resource Allocation"
    ],
    "topicCoverage": [
      { "name": "Project Status", "planned": 30, "actual": 25, "drift": 0.17 },
      { "name": "Budget Review", "planned": 20, "actual": 15, "drift": 0.25 },
      { "name": "Timeline Discussion", "planned": 25, "actual": 20, "drift": 0.2 },
      { "name": "Resource Allocation", "planned": 25, "actual": 20, "drift": 0.2 },
      { "name": "Off-topic", "planned": 0, "actual": 20, "drift": 1.0 }
    ],
    "unexpectedTopics": [
      "Office Layout",
      "Company Event Planning",
      "Technical Issues"
    ]
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

### Using Python Requests

```python
import requests
import json

# Example: Submitting custom participant data for meeting ID 1
url = "http://localhost:5000/api/reports/custom/participants/1"
cookies = {"connect.sid": "your_session_cookie_value"}

data = {
  "participantCount": 4,
  "speakingDistribution": [
    { "name": "John", "speakingTime": 35 },
    { "name": "Sarah", "speakingTime": 25 },
    { "name": "Michael", "speakingTime": 30 },
    { "name": "Emily", "speakingTime": 10 }
  ],
  "interactionStats": [
    { "name": "Questions Asked", "count": 12 },
    { "name": "Interruptions", "count": 8 },
    { "name": "Cross-talk Instances", "count": 5 },
    { "name": "Silent Periods", "count": 3 }
  ],
  "engagement": {
    "high": ["John", "Sarah"],
    "medium": ["Michael"],
    "low": ["Emily"]
  }
}

response = requests.post(url, json=data, cookies=cookies)
print(response.json())
```

## Notes

- After submitting custom data, go to the Analytics/Reports page to see it displayed.
- The data will be used instead of the AI-generated analysis for that specific meeting.
- If you want to revert to AI-generated analysis, you would need to implement a deletion endpoint.