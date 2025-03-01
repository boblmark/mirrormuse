import COS from 'cos-nodejs-sdk-v5';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
});

const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;

// 全面检查 COS 配置
async function checkAllConfigurations() {
  try {
    console.log('开始全面检查 COS 配置...\n');

    // 1. 检查存储桶基本信息
    await checkBucketInfo();

    // 2. 检查静态网站配置
    await checkWebsiteConfig();

    // 3. 检查 CDN 配置
    await checkCDNConfig();

    // 4. 检查防盗链配置
    await checkRefererConfig();

    // 5. 检查跨域配置
    await checkCORSConfig();

    // 6. 检查生命周期规则
    await checkLifecycleRules();

    // 7. 检查存储桶加密配置
    await checkEncryption();

    // 8. 验证网站可访问性
    await checkWebsiteAccess();

    console.log('\n✅ 配置检查完成！');
  } catch (error) {
    console.error('\n❌ 检查过程中发生错误：', error);
    throw error;
  }
}

// 检查存储桶基本信息
async function checkBucketInfo() {
  console.log('📦 检查存储桶基本信息...');
  try {
    const result = await new Promise((resolve, reject) => {
      cos.headBucket({
        Bucket: bucket,
        Region: region
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    console.log('  ✓ 存储桶状态正常');
    return result;
  } catch (error) {
    console.error('  ✗ 存储桶检查失败：', error.message);
    throw error;
  }
}

// 检查静态网站配置
async function checkWebsiteConfig() {
  console.log('\n🌐 检查静态网站配置...');
  try {
    const result = await new Promise((resolve, reject) => {
      cos.getBucketWebsite({
        Bucket: bucket,
        Region: region
      }, (err, data) => {
        if (err && err.code === 'NoSuchWebsiteConfiguration') {
          resolve({ configured: false });
          return;
        }
        if (err) {
          reject(err);
          return;
        }
        resolve({ configured: true, config: data });
      });
    });

    if (!result.configured) {
      console.log('  ! 静态网站未配置，正在配置...');
      await configureWebsite();
    } else {
      console.log('  ✓ 静态网站已配置');
      console.log(`  ℹ 网站访问地址: https://${bucket}.cos-website.${region}.myqcloud.com`);
    }
  } catch (error) {
    console.error('  ✗ 静态网站配置检查失败：', error.message);
    throw error;
  }
}

// 检查 CDN 配置
async function checkCDNConfig() {
  console.log('\n🚀 检查 CDN 配置...');
  try {
    const result = await new Promise((resolve, reject) => {
      cos.getBucketAccelerate({
        Bucket: bucket,
        Region: region
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    console.log('  ✓ CDN 加速状态：', result.Status === 'Enabled' ? '已开启' : '未开启');
  } catch (error) {
    console.log('  ℹ CDN 加速未配置');
  }
}

// 检查防盗链配置
async function checkRefererConfig() {
  console.log('\n🔒 检查防盗链配置...');
  try {
    const result = await new Promise((resolve, reject) => {
      cos.getBucketReferer({
        Bucket: bucket,
        Region: region
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    console.log('  ✓ 防盗链配置已设置');
    console.log('  ℹ 防盗链状态：', result.Status);
  } catch (error) {
    console.log('  ℹ 防盗链未配置');
  }
}

// 检查跨域配置
async function checkCORSConfig() {
  console.log('\n🌍 检查跨域配置...');
  try {
    const result = await new Promise((resolve, reject) => {
      cos.getBucketCors({
        Bucket: bucket,
        Region: region
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    console.log('  ✓ CORS 配置已设置');
    console.log('  ℹ 规则数量：', result.CORSRules?.length || 0);
  } catch (error) {
    console.log('  ! CORS 未配置，正在配置...');
    await configureCORS();
  }
}

// 检查生命周期规则
async function checkLifecycleRules() {
  console.log('\n⏳ 检查生命周期规则...');
  try {
    const result = await new Promise((resolve, reject) => {
      cos.getBucketLifecycle({
        Bucket: bucket,
        Region: region
      }, (err, data) => {
        if (err && err.code === 'NoSuchLifecycleConfiguration') {
          resolve({ rules: [] });
          return;
        }
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    console.log('  ✓ 生命周期规则数量：', result.Rules?.length || 0);
  } catch (error) {
    console.log('  ℹ 未配置生命周期规则');
  }
}

// 检查存储桶加密配置
async function checkEncryption() {
  console.log('\n🔐 检查存储桶加密...');
  try {
    const result = await new Promise((resolve, reject) => {
      cos.getBucketEncryption({
        Bucket: bucket,
        Region: region
      }, (err, data) => {
        if (err && err.code === 'NoSuchEncryptionConfiguration') {
          resolve({ encrypted: false });
          return;
        }
        if (err) {
          reject(err);
          return;
        }
        resolve({ encrypted: true, config: data });
      });
    });
    console.log('  ✓ 加密状态：', result.encrypted ? '已开启' : '未开启');
  } catch (error) {
    console.log('  ℹ 未配置存储桶加密');
  }
}

// 验证网站可访问性
async function checkWebsiteAccess() {
  console.log('\n🔍 验证网站可访问性...');
  const url = `https://${bucket}.cos-website.${region}.myqcloud.com`;
  try {
    const response = await axios.get(url, { timeout: 5000 });
    console.log('  ✓ 网站可正常访问');
    console.log(`  ℹ 状态码: ${response.status}`);
  } catch (error) {
    console.log('  ! 网站访问异常：', error.message);
    if (error.response) {
      console.log(`  ℹ 状态码: ${error.response.status}`);
    }
  }
}

// 配置静态网站
async function configureWebsite() {
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
        console.log('  ✓ 静态网站配置成功');
        resolve(data);
      });
    });
  } catch (error) {
    console.error('  ✗ 静态网站配置失败：', error.message);
    throw error;
  }
}

// 配置 CORS
async function configureCORS() {
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
        console.log('  ✓ CORS 配置成功');
        resolve(data);
      });
    });
  } catch (error) {
    console.error('  ✗ CORS 配置失败：', error.message);
    throw error;
  }
}

// 运行所有检查
checkAllConfigurations().catch(console.error);