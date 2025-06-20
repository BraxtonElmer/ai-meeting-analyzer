// A simple script to test the connection to the Flask API
const axios = require('axios');

const FLASK_API_URL = 'http://localhost:6000';
const MEETING_ID = 1; // Replace with a valid meeting ID from your database

async function testFlaskApiConnection() {
  console.log('Testing Flask API Connection...');
  
  try {
    // Test the root endpoint
    const rootResponse = await axios.get(FLASK_API_URL, {
      timeout: 5000
    });
    console.log('Root endpoint response:', rootResponse.data);
    
    // Test speaker contribution endpoint
    console.log('\nTesting speaker contribution endpoint...');
    try {
      const speakerResponse = await axios.get(`${FLASK_API_URL}/api/speaker_contribution/${MEETING_ID}`, {
        timeout: 5000
      });
      console.log('Speaker contribution response:', speakerResponse.data);
    } catch (error) {
      console.error('Error testing speaker contribution:', error.message);
    }
    
    // Test sentiment transition endpoint
    console.log('\nTesting sentiment transition endpoint...');
    try {
      const sentimentResponse = await axios.get(`${FLASK_API_URL}/api/sentiment_transition/${MEETING_ID}`, {
        timeout: 5000
      });
      console.log('Sentiment transition response:', sentimentResponse.data);
    } catch (error) {
      console.error('Error testing sentiment transition:', error.message);
    }
    
    // Test agenda drift endpoint
    console.log('\nTesting agenda drift endpoint...');
    try {
      const agendaResponse = await axios.get(`${FLASK_API_URL}/api/agenda_drift/${MEETING_ID}`, {
        timeout: 5000
      });
      console.log('Agenda drift response:', agendaResponse.data);
    } catch (error) {
      console.error('Error testing agenda drift:', error.message);
    }
    
  } catch (error) {
    console.error('Error connecting to Flask API:', error.message);
  }
}

// Run the test
testFlaskApiConnection().catch(console.error);
