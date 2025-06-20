// Api client for handling requests to the backend
import axios from 'axios';

// Create an axios instance with default configuration
const apiClient = axios.create({
  baseURL: '', // uses relative URLs, will connect to same server that serves the React app
  timeout: 15000, // 15 second timeout for Flask API calls
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for handling token, etc.
apiClient.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Server error:', error.response.status, error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
