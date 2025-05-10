# API Endpoints for Custom Report Data

This document provides information on how to use the API endpoints and WebSocket connections for submitting custom report data to be displayed in the Analytics/Reports section of the AI Meeting Assistant.

## Authentication and Authorization

All API endpoints require authentication. You need to include session cookies from a logged-in user session.

### Security Measures

1. **Access Control:** All API endpoints and WebSocket connections implement strict access control checks to ensure users can only access meetings they are participants in or have created.

2. **Cross-Account Protection:** The system prevents unauthorized access to meeting data across different user accounts.

3. **WebSocket Authentication:** WebSocket connections use the same authorization mechanism as REST API endpoints to ensure secure real-time data transmission.

## Base URL

All API endpoints are relative to your application's base URL (e.g., `http://localhost:5000`).

## Methods for Submitting Data

You can submit data in two ways:
1. REST API - For one-time submissions or scripted updates
2. WebSocket - For real-time streaming of data during live meetings

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

## WebSocket Data Submission

The application supports real-time data submission through WebSocket connections, which is ideal for bots that are actively analyzing a live meeting.

### Connection Details

- **WebSocket URL:** `ws://localhost:5000/ws?meetingId={MEETING_ID}`
- **Required Parameter:** `meetingId` - The ID of the meeting to send data to
- **Authentication:** WebSocket connections must include cookies that contain valid session information for a user with access to the specified meeting. Unauthorized connections will receive an error message and may be disconnected.

### Message Format

Messages sent to the WebSocket server must be in JSON format with the following structure:

```json
{
  "type": "custom_report_data",
  "reportType": "sentiment",
  "reportData": {
    // Same data structure as shown in the REST API examples above
  }
}
```

The `reportType` field must be one of:
- `sentiment`
- `topics`
- `tone`
- `participants`

### Response Messages

After sending a message, you will receive one of these responses:

1. **Success Confirmation:**
```json
{
  "type": "custom_report_data_confirmation",
  "data": {
    "message": "sentiment data stored successfully for meeting 1",
    "reportType": "sentiment"
  },
  "timestamp": "2023-09-15T12:34:56.789Z"
}
```

2. **Error Response:**
```json
{
  "type": "error",
  "data": {
    "message": "Missing reportType or reportData"
  },
  "timestamp": "2023-09-15T12:34:56.789Z"
}
```

### WebSocket Example - Python

```python
import websocket
import json
import time
import requests

# First, get session cookies by logging in
def get_session_cookie():
    login_url = "http://localhost:5000/api/login"
    credentials = {
        "username": "yourusername",
        "password": "yourpassword"
    }
    response = requests.post(login_url, json=credentials)
    if response.status_code == 200:
        return response.cookies.get_dict()
    else:
        raise Exception("Login failed")

# Get session cookies
try:
    cookies = get_session_cookie()
    cookie_string = "; ".join([f"{k}={v}" for k, v in cookies.items()])
except Exception as e:
    print(f"Authentication error: {e}")
    exit(1)

# Connect to the WebSocket server with authentication cookies
meeting_id = 1
ws = websocket.create_connection(
    f"ws://localhost:5000/ws?meetingId={meeting_id}",
    header=["Cookie: " + cookie_string]
)

# Example sentiment data
sentiment_data = {
  "type": "custom_report_data",
  "reportType": "sentiment",
  "reportData": {
    "overallSentiment": 0.75,
    "sentimentOverTime": [
      {"time": "0:00", "score": 0.6},
      {"time": "5:00", "score": 0.7},
      {"time": "10:00", "score": 0.8}
    ],
    "topPositiveTopics": ["Team collaboration", "Product features"],
    "topNegativeTopics": ["Budget constraints"]
  }
}

# Send the data
ws.send(json.dumps(sentiment_data))

# Wait for response
response = ws.recv()
print(f"Received: {response}")

# Handle potential error responses
response_data = json.loads(response)
if response_data.get("type") == "error":
    print(f"Error: {response_data['data']['message']}")

# Close the connection
ws.close()
```

### WebSocket Example - JavaScript

```javascript
// First, ensure you are authenticated
// If calling from a non-browser environment, login first:
async function ensureAuthenticated() {
  // Note: In a browser context the cookies are automatically sent,
  // but for external tools you may need to login first:
  
  // Example of login if needed:
  /*
  const loginResponse = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      username: 'yourusername',
      password: 'yourpassword'
    })
  });
  
  if (!loginResponse.ok) {
    throw new Error('Authentication failed');
  }
  */
  
  // For browser contexts, just verify if you're logged in
  const userResponse = await fetch('/api/user', {
    credentials: 'include' // Important: include cookies
  });
  
  if (!userResponse.ok) {
    // Redirect to login page or show login modal
    console.error('Not authenticated, please login first');
    return false;
  }
  return true;
}

// Connect to WebSocket and send data
async function connectAndSendData() {
  // Verify authentication first
  const isAuthenticated = await ensureAuthenticated();
  if (!isAuthenticated) {
    return;
  }
  
  const meetingId = 1;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws?meetingId=${meetingId}`;
  
  // Cookies are automatically included with browser WebSocket connections
  const socket = new WebSocket(wsUrl);
  
  // Example tone data
  const toneData = {
    type: "custom_report_data",
    reportType: "tone",
    reportData: {
      dominantTones: ["Analytical", "Confident"],
      toneBreakdown: [
        { tone: "Analytical", percentage: 40 },
        { tone: "Confident", percentage: 30 },
        { tone: "Formal", percentage: 15 },
        { tone: "Tentative", percentage: 10 },
        { tone: "Casual", percentage: 5 }
      ],
      participants: [
        {
          name: "John",
          tones: {
            analytical: 60,
            confident: 20,
            tentative: 5,
            casual: 5,
            formal: 10
          }
        }
      ]
    }
  };

  // Handle connection open
  socket.onopen = function(e) {
    console.log("Connection established");
    
    // Send data once connected
    socket.send(JSON.stringify(toneData));
  };

  // Handle incoming messages
  socket.onmessage = function(event) {
    console.log(`Data received: ${event.data}`);
    const response = JSON.parse(event.data);
    
    // Check for error responses including authorization errors
    if (response.type === 'error') {
      console.error(`Error: ${response.data.message}`);
      if (response.data.message.includes('Unauthorized')) {
        console.error('Authentication issue detected');
      }
    }
  };

  // Handle errors
  socket.onerror = function(error) {
    console.error(`WebSocket Error: ${error}`);
  };

  // Handle connection close
  socket.onclose = function(event) {
    if (event.wasClean) {
      console.log(`Connection closed cleanly, code=${event.code}, reason=${event.reason}`);
    } else {
      console.error('Connection died');
    }
  };
}

// Start the connection process
connectAndSendData().catch(err => {
  console.error('Failed to connect:', err);
});
```

## Notes

- After submitting custom data, go to the Analytics/Reports page to see it displayed.
- The data will be used instead of the AI-generated analysis for that specific meeting.
- If multiple submissions are made for the same report type and meeting, the latest one will be used.
- WebSocket connections will be automatically closed after periods of inactivity.
- WebSocket connections provide immediate feedback on data receipt.
- If you want to revert to AI-generated analysis, you would need to implement a deletion endpoint.