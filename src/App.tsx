import React, { useState, useCallback, useRef, useEffect } from 'react';
import FashionBackground from './components/FashionBackground';
import { 
    Upload, 
    Camera, 
    Sparkles, 
    Star, 
    Palette, 
    TrendingUp, 
    ThumbsUp, 
    Scale, 
    Scissors, 
    Brain, 
    Wand, 
    Crown,
    Check,
    Info 
} from 'lucide-react';

const checkBackendHealth = async () => {
  try {
    const response = await fetch('https://mirrormuse.onrender.com/api/health');
    if (!response.ok) {
      throw new Error(t.error.serverError[language]);
    }
    return true;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};

interface UploadPreview {
    file: File;
    preview: string;
}

interface ErrorState {
    message: string;
    visible: boolean;
}

interface FormData {
    height: string;
    weight: string;
    bust: string;
    waist: string;
    hips: string;
    style_preference: string;
}

interface OutfitResult {
    topUrl: string;
    bottomUrl: string;
    tryOnUrl: string;
    commentary: string;
    score: number;
    grading?: {
        overall: number;
        color: number;
        style: number;
        fit: number;
    };
}

interface Result {
    recommendations: string;
    custom: OutfitResult;
    generated: OutfitResult;
}

interface ProgressState {
    stage: string;
    percent: number;
    message: string;
}

interface HairStyle {
    hairstyle: string;
    reasons: string;
    img: string;
}

interface HairStyles {
    custom: HairStyle[];
    generated: HairStyle[];
}

interface Feature {
    icon: 'Brain' | 'Wand' | 'Scissors' | 'Crown';
    title: { en: string; zh: string };
    desc: { en: string; zh: string };
}

const PROGRESS_STAGES = {
    UPLOAD: { percent: 5, en: 'Uploading files...', zh: '正在上传文件...' },
    ANALYSIS: { percent: 15, en: 'Analyzing...', zh: '正在分析图片...' },
    GENERATE_TOP: { percent: 25, en: 'Generating top...', zh: '正在生成上衣...' },
    GENERATE_BOTTOM: { percent: 35, en: 'Generating bottom...', zh: '正在生成下装...' },
    TRYON_CUSTOM: { percent: 45, en: 'Trying on custom outfit...', zh: '正在试穿自选搭配...' },
    TRYON_GENERATED: { percent: 55, en: 'Trying on AI-generated outfit...', zh: '正在试穿AI推荐搭配...' },
    COMMENTARY: { percent: 65, en: 'Generating commentary...', zh: '正在生成点评...' },
    HAIRSTYLE_ANALYSIS: { percent: 75, en: 'Analyzing hairstyle...', zh: '正在分析发型...' },
    HAIRSTYLE_GENERATION: { percent: 85, en: 'Generating hairstyle recommendations...', zh: '正在生成发型推荐...' },
    HAIRSTYLE_CUSTOM: { percent: 90, en: 'Applying custom hairstyles...', zh: '正在应用自选发型...' },
    HAIRSTYLE_GENERATED: { percent: 95, en: 'Applying AI-generated hairstyles...', zh: '正在应用AI推荐发型...' },
    COMPLETE: { percent: 100, en: 'Complete!', zh: '完成！' }
};

type ProgressStage = keyof typeof PROGRESS_STAGES;

const STYLE_PREFERENCES = [
    { en: "Casual", zh: "休闲" },
    { en: "Fashion", zh: "时尚" },
    { en: "Vintage", zh: "复古" },
    { en: "Minimalist", zh: "简约" },
    { en: "Sweet", zh: "甜美" }
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const t = {
    title: {
        en: 'MirrorMuse',
        zh: '魅影衣橱'
    },
    subtitle: {
        en: 'AI Fashion Stylist',
        zh: 'AI时尚造型专家'
    },
    upload: {
        person: { en: 'Your Photo', zh: '个人照片' },
        top: { en: 'Top Garment', zh: '上衣' },
        bottom: { en: 'Bottom Garment', zh: '下装' },
        photo: { en: 'Upload photo', zh: '上传照片' },
        top_text: { en: 'Upload top', zh: '上传上衣' },
        bottom_text: { en: 'Upload bottom', zh: '上传下装' }
    },
    measurements: {
        height: { en: 'Height (cm)', zh: '身高 (cm)' },
        weight: { en: 'Weight (kg)', zh: '体重 (kg)' },
        bust: { en: 'Bust (cm)', zh: '胸围 (cm)' },
        waist: { en: 'Waist (cm)', zh: '腰围 (cm)' },
        hips: { en: 'Hips (cm)', zh: '臀围 (cm)' }
    },
    style: { en: 'Style Preference', zh: '风格偏好' },
    button: {
        generate: { en: 'Create Your Style', zh: '创建专属造型' },
        generating: { en: 'Creating...', zh: '创建中...' }
    },
    results: {
        title: { en: 'Your Style Analysis', zh: '你的造型分析' },
        custom: { en: 'Your Selected Outfit', zh: '你的选择' },
        generated: { en: 'AI Recommended Outfit', zh: 'AI推荐' },
        analysis: { en: 'Style Analysis', zh: '造型分析' },
        commentary: { en: 'Expert Commentary', zh: '专业点评' },
        score: { en: 'Style Score', zh: '时尚指数' },
        hairstyle: {
            title: { en: 'Hairstyle Recommendations', zh: '发型推荐' },
            forCustom: { en: 'For Your Selected Outfit', zh: '适配自选搭配' },
            forGenerated: { en: 'For AI Generated Outfit', zh: '适配AI推荐搭配' },
            noRecommendations: { 
                custom: { en: 'No hairstyle recommendations found for your selected outfit.', zh: '没有找到适合自选搭配的发型推荐。' },
                generated: { en: 'No hairstyle recommendations found for AI-generated outfit.', zh: '没有找到适合 AI 搭配的发型推荐。' }
            }
        }
    },
    error: {
        upload: { en: 'Please upload all required images', zh: '请上传所有必要的图片' },
        general: { en: 'An error occurred', zh: '发生错误' },
        fileSize: { en: 'File size must be less than 5MB', zh: '文件大小必须小于5MB' },
        fileType: { en: 'Only JPG, PNG and WebP images are allowed', zh: '仅支持JPG、PNG和WebP格式的图片' },
        serverError: { en: 'Server is unavailable', zh: '后端服务不可用' },
        hairstyleProcess: { en: 'Failed to process hairstyle recommendations', zh: '发型推荐处理失败' },
        requestProcess: { en: 'Failed to process request', zh: '处理请求失败' }
    },
    features: {
        title: { en: 'Why Choose MirrorMuse?', zh: '为什么选择魅影衣橱？' },
        items: [
            {
                icon: 'Brain',
                title: { en: 'AI-Powered Style Analysis', zh: 'AI智能风格分析' },
                desc: { 
                    en: 'Advanced algorithms analyze your body features and personal style',
                    zh: '先进算法分析身材特征与个人风格'
                }
            },
            {
                icon: 'Wand',
                title: { en: 'Virtual Try-On Magic', zh: '虚拟试穿体验' },
                desc: {
                    en: 'See how outfits look on you instantly',
                    zh: '即刻预览完美搭配效果'
                }
            },
            {
                icon: 'Scissors',
                title: { en: 'Complete Style Solution', zh: '全方位造型方案' },
                desc: {
                    en: 'Get personalized outfit and hairstyle recommendations',
                    zh: '获取个性化服装搭配与发型推荐'
                }
            },
            {
                icon: 'Crown',
                title: { en: 'Expert Commentary', zh: '专业点评建议' },
                desc: {
                    en: 'Receive detailed style analysis and fashion advice',
                    zh: '获得详细的风格分析和时尚建议'
                }
            }
        ]
    },
    analysisTypes: [
        { icon: Sparkles, title: { en: 'Style Theme', zh: '穿搭主题' } },
        { icon: Palette, title: { en: 'Color Matching', zh: '色彩搭配' } },
        { icon: Scale, title: { en: 'Proportion', zh: '比例协调' } },
        { icon: ThumbsUp, title: { en: 'Overall Effect', zh: '整体效果' } },
        { icon: Check, title: { en: 'Style Positioning', zh: '风格定位' } },
        { icon: Info, title: { en: 'Style Advice', zh: '穿搭建议' } }
    ],
    aiReview: { en: 'AI Professional Review', zh: 'AI 专业点评' }
};

const FEATURES: Feature[] = t.features.items;

const lucideIcons = {
    Upload,
    Camera,
    Sparkles,
    Star,
    Palette,
    TrendingUp,
    ThumbsUp,
    Scale,
    Scissors,
    Brain,
    Wand,
    Crown
};

function App() {
    const [personPhoto, setPersonPhoto] = useState<UploadPreview | null>(null);
    const [topGarment, setTopGarment] = useState<UploadPreview | null>(null);
    const [bottomGarment, setBottomGarment] = useState<UploadPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [language, setLanguage] = useState<'en' | 'zh'>('zh');
    const [error, setError] = useState<ErrorState>({ message: '', visible: false });
    const [hairstyles, setHairstyles] = useState<HairStyles>({ custom: [], generated: [] });
    const [progress, setProgress] = useState<ProgressState>({
        stage: 'UPLOAD',
        percent: 0,
        message: PROGRESS_STAGES.UPLOAD.zh
    });
    const abortControllerRef = useRef<AbortController | null>(null);

    const [formData, setFormData] = useState<FormData>({
        height: '',
        weight: '',
        bust: '',
        waist: '',
        hips: '',
        style_preference: STYLE_PREFERENCES[0].zh
    });

    const updateProgress = useCallback((stage: ProgressStage) => {
        const progressStage = PROGRESS_STAGES[stage];
        if (!progressStage) {
            console.error('Invalid progress stage:', stage);
            return;
        }
        setProgress({
            stage,
            percent: progressStage.percent,
            message: progressStage[language]
        });
    }, [language]);

    const showError = useCallback((message: string) => {
        setError({ message, visible: true });
        setTimeout(() => setError({ message: '', visible: false }), 5000);
    }, []);

    const validateFile = useCallback((file: File): boolean => {
        if (file.size > MAX_FILE_SIZE) {
            showError(t.error.fileSize[language]);
            return false;
        }
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            showError(t.error.fileType[language]);
            return false;
        }
        return true;
    }, [language, showError]);

    const handleFileChange = useCallback((
        event: React.ChangeEvent<HTMLInputElement>,
        setPreview: (preview: UploadPreview | null) => void
    ) => {
        try {
            const file = event.target.files?.[0];
            if (file) {
                if (!validateFile(file)) {
                    event.target.value = '';
                    return;
                }

                setPreview(prev => {
                    if (prev?.preview) {
                        URL.revokeObjectURL(prev.preview);
                    }
                    return null;
                });

                const preview: UploadPreview = {
                    file,
                    preview: URL.createObjectURL(file)
                };
                setPreview(preview);
            }
        } catch (err) {
            console.error('File upload error:', err);
            showError(t.error.upload[language]);
            event.target.value = '';
        }
    }, [language, validateFile, showError]);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = event.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        console.log('Form submission started');
    
        if (!personPhoto?.file || !topGarment?.file || !bottomGarment?.file) {
            console.log('Missing required files:', { 
                personPhoto: !!personPhoto, 
                topGarment: !!topGarment, 
                bottomGarment: !!bottomGarment 
            });
            showError(t.error.upload[language]);
            return;
        }
    
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    
        abortControllerRef.current = new AbortController();
    
        setLoading(true);
        updateProgress('UPLOAD');
    
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('person_photo', personPhoto.file);
            formDataToSend.append('custom_top_garment', topGarment.file);
            formDataToSend.append('custom_bottom_garment', bottomGarment.file);
    
            Object.entries(formData).forEach(([key, value]) => {
                if (!value) {
                    console.log('Missing required field:', key);
                    throw new Error('All measurements are required');
                }
                formDataToSend.append(key, value);
            });

            const fullUrl = 'https://mirrormuse.onrender.com/api/generate-clothing';
            updateProgress('UPLOAD');
            const response = await fetch(fullUrl, {
                method: 'POST',
                body: formDataToSend,
                signal: abortControllerRef.current.signal,
                credentials: 'include',
                mode: 'cors'
            });
    
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
    
            updateProgress('ANALYSIS');
            const data = await response.json();
            console.log('Received response:', data);
    
            updateProgress('GENERATE_TOP');
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            updateProgress('GENERATE_BOTTOM');
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            updateProgress('TRYON_CUSTOM');
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            updateProgress('TRYON_GENERATED');
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            updateProgress('COMMENTARY');
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            setResult(data);

            try {
                updateProgress('HAIRSTYLE_ANALYSIS');
                
                if (!data || !data.custom || !data.custom.tryOnUrl || !data.generated || !data.generated.tryOnUrl) {
                    throw new Error('Virtual try-on results not available');
                }
                
                const maxRetries = 3;
                const delay = 2000;
                
                const getHairstyleRecommendation = async (imageUrl) => {
                    try {
                        console.log('Starting hairstyle recommendation request, input image URL:', imageUrl);
                        if (!imageUrl || typeof imageUrl !== 'string') {
                            console.error('Invalid image URL:', imageUrl);
                            throw new Error('Invalid image URL');
                        }
                
                        const requestPayload = {
                            workflow_id: '7472218638747467817',
                            parameters: {
                                input_image: imageUrl.trim()
                            }
                        };
                        console.log('Sending hairstyle recommendation request, parameters:', JSON.stringify(requestPayload));
                
                        const response = await fetch('https://api.coze.cn/v1/workflow/run', {
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer pat_XCdzRC2c6K7oMcc2xVJv37KYJR311nrU8uUCPbdnAPlWKaDY9TikL2W8nnkW9cbY',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestPayload),
                            signal: AbortSignal.timeout(300000)
                        });
                
                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            console.error('Hairstyle recommendation API request failed:', {
                                status: response.status,
                                statusText: response.statusText,
                                error: errorData
                            });
                            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                        }
                
                        const result = await response.json();
                        console.log('Hairstyle recommendation API response:', result);
                        
                        if (result.code !== 0) {
                            console.error('Hairstyle recommendation API returned error code:', {
                                code: result.code,
                                message: result.msg
                            });
                            throw new Error(result.msg || 'Hairstyle recommendation API call failed');
                        }
                
                        try {
                            console.log('Parsing hairstyle recommendation data');
                            const data = JSON.parse(result.data);
                            console.log('Parsed hairstyle recommendation data:', data);
                            return data?.output || [];
                        } catch (parseError) {
                            console.error('Failed to parse hairstyle recommendation data:', {
                                error: parseError,
                                rawData: result.data
                            });
                            throw new Error('Failed to parse hairstyle recommendation data');
                        }
                    } catch (error) {
                        console.error('Hairstyle API request failed:', error);
                        throw error;
                    }
                };
            
                let customHairstyles = [];
                let generatedHairstyles = [];
            
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        const responseData = await getHairstyleRecommendation(data.custom.tryOnUrl);
                        console.log('Successfully got custom outfit hairstyle recommendations:', responseData);
                        customHairstyles = responseData;
                        break;
                    } catch (error) {
                        console.error(`Attempt ${i + 1} to get custom outfit hairstyle recommendations failed:`, error);
                        if (i === maxRetries - 1) throw error;
                        console.log(`Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
    
                updateProgress('HAIRSTYLE_GENERATION');
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        const responseData = await getHairstyleRecommendation(data.generated.tryOnUrl);
                        console.log('Successfully got AI recommended outfit hairstyle recommendations:', responseData);
                        generatedHairstyles = responseData;
                        break;
                    } catch (error) {
                        console.error(`Attempt ${i + 1} to get AI recommended outfit hairstyle recommendations failed:`, error);
                        if (i === maxRetries - 1) throw error;
                        console.log(`Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
    
                setHairstyles({
                    custom: customHairstyles,
                    generated: generatedHairstyles
                });
    
                updateProgress('COMPLETE');
            } catch (error) {
                console.error('Hairstyle recommendation processing failed:', error);
                showError(t.error.hairstyleProcess[language]);
                throw error;
            }
        } catch (error) {
            console.error('Request processing failed:', error);
            showError(t.error.requestProcess[language]);
        } finally {
            setLoading(false);
        }
    };

    const renderMeasurements = useCallback(() => (
        <div className="grid grid-cols-2 gap-4 mb-6">
            {Object.entries(t.measurements).map(([key, label]) => (
                <div key={key} className="space-y-2">
                    <label htmlFor={key} className="block text-sm font-medium bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent">
                        {label[language]}
                    </label>
                    <input
                        type="number"
                        id={key}
                        name={key}
                        value={formData[key]}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300"
                        placeholder={label[language]}
                        required
                    />
                </div>
            ))}
        </div>
    ), [formData, handleInputChange, language]);

    const renderStylePreference = useCallback(() => (
        <div className="mb-6">
            <label htmlFor="style_preference" className="block text-sm font-medium bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent mb-2">
                {t.style[language]}
            </label>
            <select
                id="style_preference"
                name="style_preference"
                value={formData.style_preference}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300"
                required
            >
                {STYLE_PREFERENCES.map((style, index) => (
                    <option key={index} value={style[language]}>
                        {style[language]}
                    </option>
                ))}
            </select>
            <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-6 text-white font-semibold rounded-lg shadow-lg
                    ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-600 hover:to-teal-600'}
                    transform transition-all duration-200 hover:scale-105 active:scale-95
                    flex items-center justify-center space-x-2`}
            >
                {loading ? (
                    <>
                        <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                        <span>{t.button.generating[language]}</span>
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        <span>{t.button.generate[language]}</span>
                    </>
                )}
            </button>
        </div>
    ), [formData.style_preference, handleInputChange, language, loading]);

    const renderCustomHairstyles = useCallback(() => {
        if (!hairstyles.custom || hairstyles.custom.length === 0) {
            return <p>{t.results.hairstyle.noRecommendations.custom[language]}</p>;
        }

        return (
            <div className="grid grid-cols-2 gap-4">
                {hairstyles.custom.map((style, index) => (
                    <div key={index} className="space-y-3">
                        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gradient-to-r from-orange-500 to-teal-500">
                            <img
                                src={style.img}
                                alt={style.hairstyle}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = 'fallback-image-url';
                                    console.error('Hairstyle image loading failed:', style.img);
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-medium text-gray-900">{style.hairstyle}</h4>
                            <p className="text-sm text-gray-600">{style.reasons}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [hairstyles.custom, language]);

    const renderGeneratedHairstyles = useCallback(() => {
        console.log('Generated hairstyles:', hairstyles.generated);
        
        if (!hairstyles.generated || hairstyles.generated.length === 0) {
            return <p>{t.results.hairstyle.noRecommendations.generated[language]}</p>;
        }

        return (
            <div className="grid grid-cols-2 gap-4">
                {hairstyles.generated.map((style, index) => (
                    <div key={index} className="space-y-3">
                        <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gradient-to-r from-orange-500 to-teal-500">
                            <img
                                src={style.img}
                                alt={style.hairstyle}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = 'fallback-image-url';
                                    console.error('Hairstyle image loading failed:', style.img);
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-medium text-gray-900">{style.hairstyle}</h4>
                            <p className="text-sm text-gray-600">{style.reasons}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [hairstyles.generated, language]);

    const renderUploadBox = useCallback((
        preview: UploadPreview | null,
        setPreview: (preview: UploadPreview | null) => void,
        label: { en: string; zh: string },
        placeholder: { en: string; zh: string },
        icon: React.ReactNode
    ) => (
        <div className="group">
            <label className="block text-sm font-medium bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent mb-2">
                {label[language]}
            </label>
            <div className="relative h-48 rounded-2xl overflow-hidden transition-all duration-300 group-hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-teal-500/20 group-hover:opacity-0 transition-opacity"></div>
                {preview ? (
                    <img
                        src={preview.preview}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-r from-gray-50 to-gray-100 group-hover:from-orange-50 group-hover:to-teal-50 transition-all duration-300">
                        {icon}
                        <span className="mt-2 text-sm text-gray-500 group-hover:text-gray-700">{placeholder[language]}</span>
                    </div>
                )}
                <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => handleFileChange(e, setPreview)}
                    accept={ALLOWED_FILE_TYPES.join(',')}
                />
            </div>
        </div>
    ), [language, handleFileChange]);

    const renderOutfitResult = useCallback((
        outfit: OutfitResult,
        title: { en: string; zh: string }
    ) => (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl animate-fade-in">
            <div className="relative">
                <h3 className="text-lg font-semibold p- 4 bg-gradient-to-r from-orange-500 to-teal-500 text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Palette className="w-5 h-5 animate-pulse" />
                        {title[language]}
                    </span>
                    <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                        <Star className="w-4 h-4 animate-spin-slow" />
                        <span className="font-bold">{outfit.score}</span>
                    </div>
                </h3>
            </div>
            <div className="p-4 space-y-6">
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden group">
                    <img
                        src={outfit.tryOnUrl}
                        alt={language === 'en' ? 'Try-on result' : '试穿效果'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="absolute bottom-4 left-4 right-4">
                            <div className="flex items-center gap-2 text-white">
                                <Crown className="w-5 h-5 text-yellow-400 animate-pulse" />
                                <span className="font-medium">
                                    {language === 'en' ? 'Style Score' : '时尚评分'}
                                </span>
                                <div className="ml-auto flex items-center gap-1">
                                    <div className="flex">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                className={`w-5 h-5 ${
                                                    star <= outfit.score / 2
                                                        ? 'text-yellow-400 fill-yellow-400 animate-pulse'
                                                        : 'text-gray-400/50 fill-gray-400/50'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-2xl font-bold text-yellow-400 animate-bounce">
                                        {outfit.score}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid gap-4">
                    {outfit.commentary.split('\n').filter(line => line.trim()).map((comment, index) => {
                        if (comment.includes('综合评分')) return null;
                        const analysisType = t.analysisTypes[index % t.analysisTypes.length];
                        const { icon: Icon, title } = analysisType;
                        const animations = [
                            'hover:-translate-y-1',
                            'hover:scale-105',
                            'hover:rotate-1',
                            'hover:-rotate-1',
                            'hover:skew-x-3',
                            'hover:skew-y-3'
                        ];
                        return (
                            <details
                                key={index}
                                className={`group p-4 rounded-lg bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-sm shadow-lg border border-white/50 transition-all duration-300 ${animations[index % animations.length]}`}
                            >
                                <summary className="flex gap-3 items-center cursor-pointer">
                                    <div className="flex-shrink-0 p-2 bg-gradient-to-br from-orange-500/10 to-teal-500/10 rounded-lg">
                                        <Icon className="w-5 h-5 text-orange-500 animate-pulse" />
                                    </div>
                                    <span className="font-medium text-gray-700">
                                        {title[language]}
                                    </span>
                                </summary>
                                <div className="mt-4 pl-11">
                                    <p className="text-gray-700 leading-relaxed">
                                        {comment}
                                    </p>
                                    {index === 0 && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-orange-500">
                                            <Crown className="w-3 h-3" />
                                            <span>{t.aiReview[language]}</span>
                                        </div>
                                    )}
                                </div>
                            </details>
                        );
                    })}
                </div>
            </div>
        </div>
    ), [language]);

    const renderProgressBar = useCallback(() => {
        if (!loading) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-11/12 max-w-md">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">{progress.message}</h3>
                        <span className="text-sm font-medium text-orange-600">{progress.percent}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-teal-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress.percent}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }, [loading, progress]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
            <button
                onClick={() => {
                    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
                    if (progress.stage in PROGRESS_STAGES) {
                        setProgress(prev => ({
                            ...prev,
                            message: PROGRESS_STAGES[prev.stage][prev.language === 'en' ? 'zh' : 'en']
                        }));
                    }
                }}
                className="fixed top-4 right-4 z-50 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
                <span className="text-sm font-medium bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent">
                    {language === 'zh' ? 'English' : '中文'}
                </span>
            </button>
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-[url('/bg-pattern.svg')] opacity-5 animate-slide"></div>
                <div className="absolute -inset-[100%] bg-gradient-conic from-orange-500/30 via-teal-500/30 to-orange-500/30 animate-spin-slow blur-3xl"></div>
            </div>
            
            {renderProgressBar()}
            <div className="max-w-5xl mx-auto relative z-10">
                <div className="relative backdrop-blur-sm bg-white/80 rounded-3xl shadow-2xl overflow-hidden border border-white/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-teal-500/10 animate-pulse"></div>
                    <div className="relative px-6 py-8 sm:p-10">
                        <div className="flex items-center justify-center mb-8">
                            <div className="w-32 h-32 relative animate-float">
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-teal-500/20 rounded-full animate-pulse"></div>
                                <img
                                    src="/mirrormuse-logo.jpg"
                                    alt="MirrorMuse - AI Fashion Stylist"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </div>
                        <div className="text-center space-y-6">
                            <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-600 via-purple-500 to-teal-600 bg-clip-text text-transparent animate-gradient-x">
                                {t.title[language]}
                            </h1>
                            <p className="mt-2 text-xl text-gray-600">{t.subtitle[language]}</p>
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-purple-500 to-teal-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-gradient-xy"></div>
                                <p className="relative px-7 py-4 bg-black bg-opacity-80 rounded-lg leading-none">
                                    <span className="text-lg bg-gradient-to-r from-orange-400 via-pink-500 to-teal-400 bg-clip-text text-transparent font-medium animate-pulse">
                                        {language === 'en' 
                                            ? 'Where Style Meets Innovation'
                                            : '魅影随行，演绎时尚'}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="absolute inset-0 -z-10">
                            <div className="absolute inset-0 bg-gradient-to-br from-orange-100/40 via-purple-100/40 to-teal-100/40 animate-gradient-xy"></div>
                            <div className="absolute inset-0 opacity-30">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,140,50,0.1),rgba(100,220,200,0.1))] animate-pulse"></div>
                                <div className="absolute inset-0 bg-[url('/pattern.svg')] bg-repeat opacity-10 animate-slide"></div>
                            </div>
                        </div>

                        <div className="mt-12 mb-8">
                            <h2 className="text-2xl font-semibold text-center mb-8 bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent">
                                {t.features.title[language]}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {FEATURES.map((feature, index) => {
                                    const Icon = lucideIcons[feature.icon];
                                    return (
                                        <div key={index} className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group">
                                            <div className="w-12 h-12 mb-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-teal-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Icon className="w-6 h-6 text-orange-600" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent">
                                                {feature.title[language]}
                                            </h3>
                                            <p className="text-gray-600 text-sm">
                                                {feature.desc[language]}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6 bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl">
                            {renderUploadBox(
                                personPhoto,
                                setPersonPhoto,
                                t.upload.person,
                                t.upload.photo,
                                <Camera className="w-8 h-8 text-gray-400 group-hover:text-orange-500 transition-colors" />
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                {renderUploadBox(
                                    topGarment,
                                    setTopGarment,
                                    t.upload.top,
                                    t.upload.top_text,
                                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                )}
                                {renderUploadBox(
                                    bottomGarment,
                                    setBottomGarment,
                                    t.upload.bottom,
                                    t.upload.bottom_text,
                                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                )}
                            </div>
                            {renderMeasurements()}
                            {renderStylePreference()}

                            {result && (
                                <div className="mt-12 space-y-8">
                                    <h2 className="text-2xl font-semibold text-center bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent">
                                        {t.results.title[language]}
                                    </h2>
                                    <div className="grid grid-cols-12 gap-8">
                                        <div className="col-span-12 md:col-span-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {renderOutfitResult(result.custom, t.results.custom)}
                                                {renderOutfitResult(result.generated, t.results.generated)}
                                            </div>
                                        </div>
                                        <div className="col-span-12 md:col-span-4 space-y-8">
                                            <div>
                                                <h3 className="text-xl font-semibold mb-4">{t.results.hairstyle.forCustom[language]}</h3>
                                                {renderCustomHairstyles()}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-semibold mb-4">{t.results.hairstyle.forGenerated[language]}</h3>
                                                {renderGeneratedHairstyles()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                        {result && (
                            <div className="mt-12 space-y-8">
                                <h2 className="text-2xl font-semibold text-center bg-gradient-to-r from-orange-600 to-teal-600 bg-clip-text text-transparent">
                                    {t.results.hairstyle.title[language]}
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {t.results.hairstyle.forCustom[language]}
                                        </h3>
                                        {renderCustomHairstyles()}
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {t.results.hairstyle.forGenerated[language]}
                                        </h3>
                                        {renderGeneratedHairstyles()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <FashionBackground />
        </div>
    );
}

export default App;
