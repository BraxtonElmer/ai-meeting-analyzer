// Test script for the Flask API integration
const axios = require('axios');

// Base URLs for the services
const nodeServerURL = 'http://localhost:3000';
const flaskServerURL = 'http://localhost:6000';

const testMeetingId = 1; // Replace with a valid meeting ID for testing

// Test the Flask API directly
async function testFlaskAPI() {
  console.log('Testing direct Flask API access...');
  
  try {
    // Test sentiment transition endpoint
    const sentimentResponse = await axios.get(`${flaskServerURL}/api/sentiment_transition/${testMeetingId}`);
    console.log('Flask API sentiment transition response:', sentimentResponse.status);
    console.log('Sample data:', JSON.stringify(sentimentResponse.data).substring(0, 200) + '...');
    
    // Test agenda drift endpoint
    const agendaResponse = await axios.get(`${flaskServerURL}/api/agenda_drift/${testMeetingId}`);
    console.log('Flask API agenda drift response:', agendaResponse.status);
    console.log('Sample data:', JSON.stringify(agendaResponse.data).substring(0, 200) + '...');
    
    // Test speaker contribution endpoint
    const speakerResponse = await axios.get(`${flaskServerURL}/api/speaker_contribution/${testMeetingId}`);
    console.log('Flask API speaker contribution response:', speakerResponse.status);
    console.log('Sample data:', JSON.stringify(speakerResponse.data).substring(0, 200) + '...');
    
    return true;
  } catch (error) {
    console.error('Error testing Flask API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Test the Node.js backend endpoints that call the Flask API
async function testNodeBackend() {
  console.log('\nTesting Node.js backend endpoints...');
  
  try {
    // Test sentiment endpoint
    const sentimentResponse = await axios.get(`${nodeServerURL}/api/reports/sentiment/${testMeetingId}`);
    console.log('Node.js sentiment response:', sentimentResponse.status);
    console.log('Sample data:', JSON.stringify(sentimentResponse.data).substring(0, 200) + '...');
    
    // Test topics endpoint
    const topicsResponse = await axios.get(`${nodeServerURL}/api/reports/topics/${testMeetingId}`);
    console.log('Node.js topics response:', topicsResponse.status);
    console.log('Sample data:', JSON.stringify(topicsResponse.data).substring(0, 200) + '...');
    
    // Test transitions endpoint
    const transitionsResponse = await axios.get(`${nodeServerURL}/api/reports/transitions/${testMeetingId}`);
    console.log('Node.js transitions response:', transitionsResponse.status);
    console.log('Sample data:', JSON.stringify(transitionsResponse.data).substring(0, 200) + '...');
    
    // Test speaker contribution endpoint
    const speakerResponse = await axios.get(`${nodeServerURL}/api/reports/speaker_contribution/${testMeetingId}`);
    console.log('Node.js speaker contribution response:', speakerResponse.status);
    console.log('Sample data:', JSON.stringify(speakerResponse.data).substring(0, 200) + '...');
    
    return true;
  } catch (error) {
    console.error('Error testing Node.js backend:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('=== FLASK API INTEGRATION TEST ===\n');
  
  const flaskSuccess = await testFlaskAPI();
  console.log('\nFlask API direct test:', flaskSuccess ? 'PASSED' : 'FAILED');
  
  const nodeSuccess = await testNodeBackend();
  console.log('\nNode.js backend test:', nodeSuccess ? 'PASSED' : 'FAILED');
  
  console.log('\n=== TEST SUMMARY ===');
  console.log('Flask API:', flaskSuccess ? '✅ PASSED' : '❌ FAILED');
  console.log('Node.js backend:', nodeSuccess ? '✅ PASSED' : '❌ FAILED');
  console.log('Overall:', (flaskSuccess && nodeSuccess) ? '✅ PASSED' : '❌ FAILED');
}

runTests().catch(console.error);
