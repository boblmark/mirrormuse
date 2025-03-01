import COS from 'cos-nodejs-sdk-v5';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
  Protocol: 'https:'
});

const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;

// 检查并修复静态网站配置
async function verifyAndFixWebsiteConfig() {
  try {
    console.log('正在检查静态网站配置...');
    
    // 1. 配置静态网站 - 针对 SPA 的特殊处理
    await new Promise((resolve, reject) => {
      cos.putBucketWebsite({
        Bucket: bucket,
        Region: region,
        WebsiteConfiguration: {
          IndexDocument: {
            Suffix: 'index.html'
          },
          ErrorDocument: {
            Key: 'index.html'  // SPA 应用的所有路由都指向 index.html
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
        console.log('✓ 静态网站配置已更新（SPA 模式）');
        resolve(data);
      });
    });

    // 2. 设置存储桶为公有读私有写
    await new Promise((resolve, reject) => {
      cos.putBucketAcl({
        Bucket: bucket,
        Region: region,
        ACL: 'public-read',
        Headers: {
          'x-cos-grant-read': 'id="anyone"'  // 确保公有读权限
        }
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('✓ 存储桶访问权限已设置为公有读');
        resolve(data);
      });
    });

    // 3. 配置 CORS
    await new Promise((resolve, reject) => {
      cos.putBucketCors({
        Bucket: bucket,
        Region: region,
        CORSRules: [{
          AllowedOrigins: ['*'],
          AllowedMethods: ['GET', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag', 'Content-Length'],
          MaxAgeSeconds: 86400
        }]
      }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('✓ CORS 配置已更新');
        resolve(data);
      });
    });

    // 4. 更新所有文件的 Content-Type 和缓存控制
    console.log('正在更新文件的 Content-Type 和缓存控制...');
    await new Promise((resolve, reject) => {
      cos.getBucket({
        Bucket: bucket,
        Region: region,
        Prefix: ''
      }, async (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        for (const file of data.Contents) {
          const ext = file.Key.split('.').pop()?.toLowerCase();
          let contentType;
          let cacheControl;

          // 特殊处理 index.html
          if (file.Key === 'index.html') {
            contentType = 'text/html; charset=utf-8';
            cacheControl = 'no-store, must-revalidate';
          } else if (ext === 'html') {
            contentType = 'text/html; charset=utf-8';
            cacheControl = 'no-cache';
          } else if (ext === 'js') {
            contentType = 'application/javascript; charset=utf-8';
            cacheControl = 'public, max-age=31536000, immutable';
          } else if (ext === 'css') {
            contentType = 'text/css; charset=utf-8';
            cacheControl = 'public, max-age=31536000, immutable';
          } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            cacheControl = 'public, max-age=31536000, immutable';
          } else if (ext === 'svg') {
            contentType = 'image/svg+xml; charset=utf-8';
            cacheControl = 'public, max-age=31536000, immutable';
          } else if (ext === 'json') {
            contentType = 'application/json; charset=utf-8';
            cacheControl = 'no-cache';
          } else {
            continue;
          }

          await new Promise((resolve, reject) => {
            cos.putObjectCopy({
              Bucket: bucket,
              Region: region,
              Key: file.Key,
              CopySource: `${bucket}.cos.${region}.myqcloud.com/${file.Key}`,
              MetadataDirective: 'Replaced',
              ContentType: contentType,
              CacheControl: cacheControl,
              Headers: {
                'x-cos-metadata-directive': 'Replaced'
              }
            }, (err, data) => {
              if (err) {
                reject(err);
                return;
              }
              console.log(`✓ 已更新 ${file.Key} 的配置`);
              resolve(data);
            });
          });
        }
        resolve();
      });
    });

    // 5. 验证网站可访问性
    console.log('\n正在验证网站可访问性...');
    const websiteUrl = `https://${bucket}.cos-website.${region}.myqcloud.com`;
    
    try {
      const response = await axios.get(websiteUrl, {
        timeout: 5000,
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: null,
        maxRedirects: 5
      });
      
      console.log(`状态码: ${response.status}`);
      console.log(`Content-Type: ${response.headers['content-type']}`);
      
      if (response.status === 200 && response.headers['content-type']?.includes('text/html')) {
        console.log('✓ 网站可以正常访问');
        console.log(`\n网站地址：${websiteUrl}`);
      } else {
        throw new Error(`网站响应异常: ${response.status}`);
      }

      // 测试 SPA 路由
      const spaResponse = await axios.get(`${websiteUrl}/some-route`, {
        timeout: 5000,
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: null,
        maxRedirects: 5
      });

      if (spaResponse.status === 200 && spaResponse.headers['content-type']?.includes('text/html')) {
        console.log('✓ SPA 路由重定向正常工作');
      } else {
        console.warn('! SPA 路由重定向可能存在问题');
      }

    } catch (error) {
      console.error('! 网站访问测试失败：', error.message);
      throw error;
    }

  } catch (error) {
    console.error('配置过程中出错：', error);
    throw error;
  }
}

// 运行验证和修复
verifyAndFixWebsiteConfig().catch(console.error);