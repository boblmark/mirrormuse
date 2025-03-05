import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: 'dress' | 'hanger' | 'mirror' | 'tech' | 'wave' | 'circuit';
  alpha: number;
  alphaSpeed: number;
  scale: number;
  scaleSpeed: number;
  connections: number[];
}

const FashionBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Fashion-tech color palettes
    const colorPalettes = [
      ['rgba(255,20,147,0.3)', 'rgba(147,112,219,0.3)', 'rgba(0,191,255,0.3)'],
      ['rgba(255,105,180,0.3)', 'rgba(138,43,226,0.3)', 'rgba(30,144,255,0.3)'],
      ['rgba(255,182,193,0.3)', 'rgba(216,191,216,0.3)', 'rgba(176,224,230,0.3)']
    ];

    const glowColors = [
      'rgba(255,20,147,0.2)',
      'rgba(147,112,219,0.2)',
      'rgba(0,191,255,0.2)'
    ];

    let currentPalette = 0;
    const particles: Particle[] = [];
    const particleCount = 30;
    const connectionDistance = 150;
    const shapes: Array<'dress' | 'hanger' | 'mirror' | 'tech' | 'wave' | 'circuit'> = 
      ['dress', 'hanger', 'mirror', 'tech', 'wave', 'circuit'];

    const createParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 20 + 15,
      speedX: (Math.random() - 0.5) * 1.5,
      speedY: (Math.random() - 0.5) * 1.5,
      color: colorPalettes[currentPalette][Math.floor(Math.random() * colorPalettes[currentPalette].length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      alpha: Math.random(),
      alphaSpeed: (Math.random() - 0.5) * 0.01,
      scale: 0.1 + Math.random() * 0.9,
      scaleSpeed: (Math.random() - 0.5) * 0.01,
      connections: []
    });

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle());
    }

    const drawDress = (ctx: CanvasRenderingContext2D, size: number) => {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.8, -size * 0.5, size * 0.5, size);
      ctx.quadraticCurveTo(0, size * 0.8, -size * 0.5, size);
      ctx.quadraticCurveTo(-size * 0.8, -size * 0.5, 0, -size);
      ctx.closePath();
    };

    const drawHanger = (ctx: CanvasRenderingContext2D, size: number) => {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size * 0.5);
      ctx.lineTo(-size, size * 0.5);
      ctx.closePath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, -size * 0.3);
    };

    const drawMirror = (ctx: CanvasRenderingContext2D, size: number) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.7, size, 0, 0, Math.PI * 2);
      ctx.moveTo(-size * 0.3, size);
      ctx.lineTo(size * 0.3, size);
    };

    const drawTechCircuit = (ctx: CanvasRenderingContext2D, size: number) => {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(angle) * size,
          Math.sin(angle) * size
        );
        ctx.arc(
          Math.cos(angle) * size,
          Math.sin(angle) * size,
          size * 0.2,
          0,
          Math.PI * 2
        );
      }
    };

    const drawWave = (ctx: CanvasRenderingContext2D, size: number, time: number) => {
      ctx.beginPath();
      for (let i = -size; i <= size; i += 5) {
        const y = Math.sin((i + time) * 0.1) * size * 0.3;
        if (i === -size) {
          ctx.moveTo(i, y);
        } else {
          ctx.lineTo(i, y);
        }
      }
    };

    const drawCircuit = (ctx: CanvasRenderingContext2D, size: number) => {
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.arc(size * 0.5, size * 0.5, size * 0.2, 0, Math.PI * 2);
      ctx.arc(-size * 0.5, -size * 0.5, size * 0.2, 0, Math.PI * 2);
    };

    const drawConnections = (particles: Particle[]) => {
      ctx.lineWidth = 0.5;
      particles.forEach((particle, i) => {
        particles.slice(i + 1).forEach(other => {
          const dx = other.x - particle.x;
          const dy = other.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const alpha = (1 - distance / connectionDistance) * 0.3;
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();

            // Draw small tech dots at intersection
            const midX = (particle.x + other.x) / 2;
            const midY = (particle.y + other.y) / 2;
            ctx.fillStyle = glowColors[Math.floor(Math.random() * glowColors.length)];
            ctx.beginPath();
            ctx.arc(midX, midY, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });
    };

    let lastPaletteChange = 0;
    const paletteChangeInterval = 8000;
    let time = 0;

    const animate = (timestamp: number) => {
      time += 0.05;

      // Change color palette
      if (timestamp - lastPaletteChange > paletteChangeInterval) {
        currentPalette = (currentPalette + 1) % colorPalettes.length;
        lastPaletteChange = timestamp;
        particles.forEach(particle => {
          particle.color = colorPalettes[currentPalette][
            Math.floor(Math.random() * colorPalettes[currentPalette].length)
          ];
        });
      }

      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw tech grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      const gridSize = 50;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw connections
      drawConnections(particles);

      // Update and draw particles
      particles.forEach(particle => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        particle.rotation += particle.rotationSpeed;
        particle.alpha = Math.abs(Math.sin(time + particle.alphaSpeed));
        particle.scale += particle.scaleSpeed;

        if (particle.scale > 1.2 || particle.scale < 0.8) {
          particle.scaleSpeed *= -1;
        }

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.scale(particle.scale, particle.scale);
        ctx.globalAlpha = particle.alpha;
        ctx.fillStyle = particle.color;
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 2;

        // Draw shape
        switch (particle.shape) {
          case 'dress':
            drawDress(ctx, particle.size);
            break;
          case 'hanger':
            drawHanger(ctx, particle.size);
            break;
          case 'mirror':
            drawMirror(ctx, particle.size);
            break;
          case 'tech':
            drawTechCircuit(ctx, particle.size);
            break;
          case 'wave':
            drawWave(ctx, particle.size, time);
            break;
          case 'circuit':
            drawCircuit(ctx, particle.size);
            break;
        }
        ctx.fill();
        ctx.stroke();

        // Add glow effect
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      });

      requestAnimationFrame(animate);
    };

    animate(0);

    return () => {
      window.removeEventListener('resize', setCanvasSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{
        background: 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,35,0.95))'
      }}
    />
  );
};

export default FashionBackground;
