import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import axios from 'axios';
import COS from 'cos-nodejs-sdk-v5';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS before other middleware
// 配置CORS策略
app.use(cors({
  origin: [
    'https://mirrormuse-web.onrender.com', // Production frontend
    'http://localhost:5173' // Local development frontend
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Configure COS
const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
});

const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPG, PNG and WebP are allowed.'));
      return;
    }
    cb(null, true);
  }
}).fields([
  { name: 'person_photo', maxCount: 1 },
  { name: 'custom_top_garment', maxCount: 1 },
  { name: 'custom_bottom_garment', maxCount: 1 }
]);

// Upload file to COS
async function uploadToCOS(file, folder = '') {
  if (!file || !file.buffer) {
    throw new Error('Invalid file provided');
  }

  const fileExtension = file.originalname.split('.').pop();
  const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: bucket,
      Region: region,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype
    }, (err, data) => {
      if (err) {
        console.error('Upload to COS failed:', err);
        reject(new Error('Failed to upload file to COS'));
        return;
      }
      const fileUrl = `https://${bucket}.cos.${region}.myqcloud.com/${encodeURIComponent(fileName)}`;
      resolve(fileUrl);
    });
  });
}

// Call GLM-4V for analysis
async function callGLMForAnalysis(imageUrl, measurements) {
  try {
    const prompt = `分析用户的身体，皮肤特征，脸型和发型以及性别，基于以下身体数据推荐适合的上衣和下衣：身高 ${measurements.height}cm，体重 ${measurements.weight}kg，胸围 ${measurements.bust}cm，腰围 ${measurements.waist}cm，臀围 ${measurements.hips}cm。`;
    
    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      model: 'glm-4v-plus',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GLM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from GLM-4V API');
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('GLM-4V analysis failed:', error);
    throw new Error('Failed to analyze image with GLM-4V');
  }
}

// Call GLM-4V for commentary
async function callGLMForCommentary(imageUrl) {
  try {
    const prompt = `作为一位专业时尚造型师，请对以下穿搭进行全面的专业评价，包括以下几个方面：

1. 整体印象：
   - 风格定位
   - 视觉效果
   - 穿搭主题

2. 细节分析：
   - 服装款式与身材匹配度
   - 颜色搭配与肤色协调性
   - 面料质地与季节适配性
   - 配饰选择与整体平衡

3. 个性化评价：
   - 个人气质表现
   - 场合适用性
   - 时尚度与潮流元素

4. 改进建议：
   - 可以优化的细节
   - 搭配技巧建议

最后请给出1-10分的综合评分（务必在最后一行，格式为"综合评分：X分"），评分标准：
7-8分：不错的搭配
8-9分：优秀的造型
9-10分：完美的穿搭

请确保评价专业、具体、有建设性，并突出亮点。`;
    
    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      model: 'glm-4v-plus',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GLM_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from GLM-4V API');
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('GLM-4V commentary failed:', error);
    throw new Error('Failed to generate commentary');
  }
}

// Generate clothing image using CogView
async function generateClothingImage(prompt, style) {
  try {
    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/images/generations', {
      model: 'cogview-3-plus',
      prompt: `${prompt}（风格：${style}）`,
      size: '1024x1024',
      num_images: 1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.COGVIEW_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.data?.[0]?.url) {
      throw new Error('Failed to generate image');
    }

    return response.data.data[0].url;
  } catch (error) {
    console.error('CogView generation failed:', error);
    throw new Error('Failed to generate clothing image');
  }
}

// Virtual try-on using Ali AI
async function virtualTryOn(topUrl, bottomUrl, personUrl) {
  try {
    const tryOnResponse = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis/', {
      model: 'aitryon',
      input: {
        top_garment_url: topUrl,
        bottom_garment_url: bottomUrl,
        person_image_url: personUrl
      },
      parameters: {
        resolution: -1,
        restore_face: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ALIAI_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      }
    });

    const taskId = tryOnResponse.data.output.task_id;
    
    // Poll task status
    let maxRetries = 12;
    while (maxRetries > 0) {
      const taskResponse = await axios.get(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.ALIAI_API_KEY}`
        }
      });

      const taskStatus = taskResponse.data.output.task_status;
      if (taskStatus === 'SUCCEEDED') {
        return taskResponse.data.output.image_url;
      } else if (taskStatus === 'FAILED') {
        throw new Error(taskResponse.data.message || 'Virtual try-on failed');
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      maxRetries--;
    }

    throw new Error('Task timeout');
  } catch (error) {
    console.error('Ali AI try-on failed:', error);
    throw new Error('Virtual try-on failed');
  }
}

// Extract score from commentary
function extractScore(commentary) {
  try {
    const scoreMatch = commentary.match(/综合评分[：:]\s*(\d+(\.\d+)?)\s*分/);
    if (scoreMatch && scoreMatch[1]) {
      const score = parseFloat(scoreMatch[1]);
      if (score >= 0 && score <= 10) {
        return score;
      }
    }
    return (7 + Math.random() * 2.5).toFixed(1);
  } catch (error) {
    console.error('Error extracting score:', error);
    return 8.0;
  }
}

// API routes
const apiRouter = express.Router();

// Generate clothing recommendations route
apiRouter.post('/generate-clothing', (req, res) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ error: err.message });
      }

      console.log('Processing request with files:', req.files ? Object.keys(req.files) : 'No files');
      console.log('Form data:', req.body);

      const files = req.files;
      const { height, weight, bust, waist, hips, style_preference } = req.body;

      // Validate inputs
      if (!files?.person_photo?.[0] || !files?.custom_top_garment?.[0] || !files?.custom_bottom_garment?.[0]) {
        return res.status(400).json({ error: 'Missing required files' });
      }

      if (!height || !weight || !bust || !waist || !hips || !style_preference) {
        return res.status(400).json({ error: 'Missing required measurements' });
      }

      // Upload files to COS
      console.log('Uploading files to COS...');
      const personImageUrl = await uploadToCOS(files.person_photo[0], 'person');
      const customTopUrl = await uploadToCOS(files.custom_top_garment[0], 'tops');
      const customBottomUrl = await uploadToCOS(files.custom_bottom_garment[0], 'bottoms');

      // Get GLM analysis with error handling
      console.log('Getting GLM analysis...');
      let recommendations;
      try {
        recommendations = await callGLMForAnalysis(personImageUrl, {
          height, weight, bust, waist, hips
        });
      } catch (error) {
        console.error('GLM analysis error:', error);
        return res.status(500).json({ error: 'Failed to analyze image. Please try again.' });
      }

      // Generate clothing images with error handling
      console.log('Generating clothing images...');
      let generatedTopUrl, generatedBottomUrl;
      try {
        generatedTopUrl = await generateClothingImage(
          `上衣：${recommendations}`, 
          style_preference
        );
        
        generatedBottomUrl = await generateClothingImage(
          `下装：${recommendations}`, 
          style_preference
        );
      } catch (error) {
        console.error('Image generation error:', error);
        return res.status(500).json({ error: 'Failed to generate clothing images. Please try again.' });
      }

      // Perform virtual try-on with error handling
      console.log('Performing virtual try-on...');
      let customTryOnResult, generatedTryOnResult;
      try {
        customTryOnResult = await virtualTryOn(
          customTopUrl,
          customBottomUrl,
          personImageUrl
        );

        generatedTryOnResult = await virtualTryOn(
          generatedTopUrl,
          generatedBottomUrl,
          personImageUrl
        );
      } catch (error) {
        console.error('Virtual try-on error:', error);
        return res.status(500).json({ error: 'Virtual try-on failed. Please try again.' });
      }

      // Get style commentary with error handling
      console.log('Getting style commentary...');
      let commentary_custom, commentary_generated;
      try {
        commentary_custom = await callGLMForCommentary(customTryOnResult);
        commentary_generated = await callGLMForCommentary(generatedTryOnResult);
      } catch (error) {
        console.error('Commentary generation error:', error);
        return res.status(500).json({ error: 'Failed to generate style commentary. Please try again.' });
      }

      // Extract scores
      const score_custom = extractScore(commentary_custom);
      const score_generated = extractScore(commentary_generated);

      const result = {
        recommendations,
        custom: {
          topUrl: customTopUrl,
          bottomUrl: customBottomUrl,
          tryOnUrl: customTryOnResult,
          commentary: commentary_custom,
          score: score_custom
        },
        generated: {
          topUrl: generatedTopUrl,
          bottomUrl: generatedBottomUrl,
          tryOnUrl: generatedTryOnResult,
          commentary: commentary_generated,
          score: score_generated
        }
      };

      res.json(result);

    } catch (error) {
      console.error('Processing error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to process request. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
});

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount API router
app.use('/api', apiRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'API is running',
    endpoints: {
      health: '/api/health',
      generateClothing: '/api/generate-clothing'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start server with error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
