import COS from 'cos-nodejs-sdk-v5';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
  Protocol: 'https:',
  Timeout: 60000,
  RetryDelay: 1000,
  MaxRetries: 3,
  KeepAlive: true,
  ProgressInterval: 2000
});

const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;

// 获取文件的 Content-Type
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.map': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
  };
  return types[ext] || 'application/octet-stream';
}

// 上传大文件
async function uploadLargeFile(localPath, cosPath) {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await new Promise((resolve, reject) => {
        cos.sliceUploadFile({
          Bucket: bucket,
          Region: region,
          Key: cosPath,
          FilePath: localPath,
          ChunkSize: 256 * 1024,
          ChunkParallel: 1,
          AsyncLimit: 1,
          ContentType: getContentType(localPath),
          onProgress: function(progressData) {
            const percent = Math.round(progressData.percent * 100);
            if (percent % 20 === 0) {
              console.log(`Uploading ${cosPath}: ${percent}%`);
            }
          }
        }, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`Successfully uploaded ${cosPath}`);
          resolve(data);
        });
      });
      return;
    } catch (error) {
      retryCount++;
      console.error(`Upload attempt ${retryCount} failed for ${cosPath}:`, error.message);
      
      if (retryCount === maxRetries) {
        throw new Error(`Failed to upload ${cosPath} after ${maxRetries} attempts: ${error.message}`);
      }
      
      const delay = 1000 * retryCount;
      console.log(`Waiting ${delay/1000} seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 上传小文件
async function uploadSmallFile(localPath, cosPath) {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const fileContent = fs.readFileSync(localPath);

      await new Promise((resolve, reject) => {
        cos.putObject({
          Bucket: bucket,
          Region: region,
          Key: cosPath,
          Body: fileContent,
          ContentType: getContentType(localPath),
          CacheControl: 'no-cache',
          onProgress: function(progressData) {
            const percent = Math.round(progressData.percent * 100);
            if (percent % 20 === 0) {
              console.log(`Uploading ${cosPath}: ${percent}%`);
            }
          }
        }, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`Successfully uploaded ${cosPath}`);
          resolve(data);
        });
      });
      return;
    } catch (error) {
      retryCount++;
      console.error(`Upload attempt ${retryCount} failed for ${cosPath}:`, error.message);
      
      if (retryCount === maxRetries) {
        throw new Error(`Failed to upload ${cosPath} after ${maxRetries} attempts: ${error.message}`);
      }
      
      const delay = 1000 * retryCount;
      console.log(`Waiting ${delay/1000} seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 智能选择上传方法
async function uploadFile(localPath, cosPath) {
  const stats = fs.statSync(localPath);
  const fileSizeInMB = stats.size / (1024 * 1024);
  
  if (fileSizeInMB > 0.5) {
    return uploadLargeFile(localPath, cosPath);
  } else {
    return uploadSmallFile(localPath, cosPath);
  }
}

// 递归上传目录
async function uploadDirectory(localDir, cosDir = '') {
  const files = fs.readdirSync(localDir);
  
  // 创建上传队列
  const uploadQueue = [];
  
  for (const file of files) {
    const localPath = path.join(localDir, file);
    const cosPath = path.join(cosDir, file).replace(/\\/g, '/');
    
    if (fs.statSync(localPath).isDirectory()) {
      await uploadDirectory(localPath, cosPath);
    } else {
      uploadQueue.push({ localPath, cosPath });
    }
  }

  // 完全串行上传文件
  for (const { localPath, cosPath } of uploadQueue) {
    try {
      await uploadFile(localPath, cosPath);
    } catch (error) {
      console.error(`Failed to upload ${cosPath}:`, error.message);
      throw error;
    }
  }
}

// 配置静态网站
async function configureBucketWebsite() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await new Promise((resolve, reject) => {
        cos.putBucketWebsite({
          Bucket: bucket,
          Region: region,
          WebsiteConfiguration: {
            IndexDocument: {
              Suffix: 'index.html'
            },
            ErrorDocument: {
              Key: 'index.html'
            },
            RedirectAllRequestsTo: {
              Protocol: 'https'
            }
          }
        }, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('Successfully configured bucket website');
          resolve(data);
        });
      });
      return;
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        throw new Error(`Failed to configure bucket website after ${maxRetries} attempts: ${error.message}`);
      }
      console.log(`Retry ${retryCount}/${maxRetries} for bucket website configuration`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// 配置 CORS
async function configureBucketCORS() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await new Promise((resolve, reject) => {
        cos.putBucketCors({
          Bucket: bucket,
          Region: region,
          CORSRules: [{
            AllowedOrigins: ['*'],
            AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length', 'x-cos-request-id'],
            MaxAgeSeconds: 86400
          }]
        }, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('Successfully configured bucket CORS');
          resolve(data);
        });
      });
      return;
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        throw new Error(`Failed to configure bucket CORS after ${maxRetries} attempts: ${error.message}`);
      }
      console.log(`Retry ${retryCount}/${maxRetries} for bucket CORS configuration`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// 执行构建命令
async function buildProject() {
  return new Promise((resolve, reject) => {
    console.log('Building project...');
    exec('npm run build', (error, stdout, stderr) => {
      if (error) {
        console.error('Build failed:', error);
        reject(error);
        return;
      }
      console.log(stdout);
      resolve();
    });
  });
}

async function deploy() {
  try {
    await buildProject();

    console.log('\nConfiguring bucket website...');
    await configureBucketWebsite();

    console.log('\nConfiguring CORS...');
    await configureBucketCORS();

    console.log('\nUploading files...');
    const distPath = path.join(__dirname, 'dist');
    await uploadDirectory(distPath);

    console.log('\n✨ Deployment completed successfully!');
    console.log('\nWebsite URLs:');
    console.log(`- Default URL: https://${bucket}.cos-website.${region}.myqcloud.com`);
    console.log(`- COS URL: https://${bucket}.cos.${region}.myqcloud.com`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

deploy();