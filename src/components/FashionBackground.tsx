import React from 'react';

const fashionElements = [
    'M10 10c2-2 5-2 7 0s2 5 0 7s-5 2-7 0s-2-5 0-7z', // 太阳镜
    'M5 15l5-5l5 5h-10z', // 裙子
    'M10 5l5 10h-10z', // 连衣裙
    'M5 10h10v5h-10z', // 包包
    'M7.5 15c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5', // 高跟鞋
];

const FashionBackground = () => {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-100/40 via-purple-100/40 to-teal-100/40"></div>
            <svg className="absolute inset-0 w-full h-full">
                {Array.from({ length: 20 }).map((_, i) => (
                    <g key={i} className={`fashion-element fashion-element-${i % 5} fashion-delay-${i % 10}`}>
                        <path
                            d={fashionElements[i % 5]}
                            fill="currentColor"
                            className="text-orange-300/20"
                            style={{
                                transform: `translate(${Math.random() * 100}px, ${Math.random() * 100}px)`
                            }}
                        />
                    </g>
                ))}
            </svg>
        </div>
    );
};

export default FashionBackground;
