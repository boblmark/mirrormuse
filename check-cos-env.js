import dotenv from 'dotenv';
import COS from 'cos-nodejs-sdk-v5';

dotenv.config();

const requiredEnvVars = [
  'COS_SECRET_ID',
  'COS_SECRET_KEY',
  'COS_BUCKET',
  'COS_REGION',
  'GLM_API_KEY',
  'COGVIEW_API_KEY',
  'ALIAI_API_KEY'
];

async function checkEnvironment() {
  console.log('Checking environment variables...\n');
  
  const missing = [];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(variable => console.error(`   - ${variable}`));
    return false;
  }

  console.log('✅ All required environment variables are set');
  
  // Test COS connection
  console.log('\nTesting COS connection...');
  const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY
  });

  try {
    await new Promise((resolve, reject) => {
      cos.headBucket({
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    console.log('✅ Successfully connected to COS bucket');
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to COS:', error.message);
    return false;
  }
}

checkEnvironment().then(success => {
  if (!success) {
    console.log('\n⚠️  Please ensure all environment variables are set correctly in .env file');
    process.exit(1);
  }
});