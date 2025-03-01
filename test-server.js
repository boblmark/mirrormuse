import axios from 'axios';

async function testServerHealth() {
  try {
    console.log('Testing server health...');
    const response = await axios.get('http://localhost:3000/api/health');
    console.log('Server status:', response.data);
    return true;
  } catch (error) {
    console.error('Server health check failed:', error.message);
    return false;
  }
}

testServerHealth();