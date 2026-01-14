'use client';

import { useEffect, useRef } from 'react';

export function DataCollectionAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Nodes representing different parts of the ecosystem
    interface Node {
      x: number;
      y: number;
      radius: number;
      color: string;
      pulse: number;
      pulseSpeed: number;
    }

    const nodes: Node[] = [
      { x: canvas.width * 0.2, y: canvas.height * 0.2, radius: 8, color: '#3b82f6', pulse: 0, pulseSpeed: 0.02 },
      { x: canvas.width * 0.8, y: canvas.height * 0.3, radius: 8, color: '#8b5cf6', pulse: 0, pulseSpeed: 0.015 },
      { x: canvas.width * 0.15, y: canvas.height * 0.6, radius: 8, color: '#06b6d4', pulse: 0, pulseSpeed: 0.025 },
      { x: canvas.width * 0.85, y: canvas.height * 0.7, radius: 8, color: '#10b981', pulse: 0, pulseSpeed: 0.018 },
      { x: canvas.width * 0.5, y: canvas.height * 0.15, radius: 8, color: '#f59e0b', pulse: 0, pulseSpeed: 0.022 },
      { x: canvas.width * 0.3, y: canvas.height * 0.85, radius: 8, color: '#ef4444', pulse: 0, pulseSpeed: 0.019 },
      { x: canvas.width * 0.7, y: canvas.height * 0.9, radius: 8, color: '#ec4899', pulse: 0, pulseSpeed: 0.021 },
    ];

    // Central hub (analytics dashboard)
    const hub = {
      x: canvas.width * 0.5,
      y: canvas.height * 0.5,
      radius: 20,
    };

    // Data particles flowing between nodes and hub
    interface Particle {
      from: Node;
      to: typeof hub | Node;
      progress: number;
      speed: number;
      size: number;
    }

    const particles: Particle[] = [];

    // Create new particles periodically
    const createParticle = () => {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      const to = Math.random() > 0.3 ? hub : nodes[Math.floor(Math.random() * nodes.length)];
      if (to === from) return;
      
      particles.push({
        from,
        to,
        progress: 0,
        speed: 0.005 + Math.random() * 0.01,
        size: 3 + Math.random() * 2,
      });
    };

    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update node pulses
      nodes.forEach(node => {
        node.pulse += node.pulseSpeed;
        if (node.pulse > Math.PI * 2) node.pulse = 0;
      });

      // Draw connections (subtle grid lines)
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.lineWidth = 1;
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(hub.x, hub.y);
        ctx.stroke();
      });

      // Draw and update particles
      particles.forEach((particle, index) => {
        const fromX = particle.from.x;
        const fromY = particle.from.y;
        const toX = particle.to === hub ? hub.x : particle.to.x;
        const toY = particle.to === hub ? hub.y : particle.to.y;

        const x = fromX + (toX - fromX) * particle.progress;
        const y = fromY + (toY - fromY) * particle.progress;

        // Draw particle
        ctx.fillStyle = particle.from.color;
        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.from.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Update progress
        particle.progress += particle.speed;
        if (particle.progress >= 1) {
          particles.splice(index, 1);
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        const pulseRadius = node.radius + Math.sin(node.pulse) * 3;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, pulseRadius * 2);
        gradient.addColorStop(0, node.color);
        gradient.addColorStop(0.5, node.color + '80');
        gradient.addColorStop(1, node.color + '00');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Node core
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw central hub
      const hubGradient = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, hub.radius * 3);
      hubGradient.addColorStop(0, '#3b82f6');
      hubGradient.addColorStop(0.5, '#3b82f680');
      hubGradient.addColorStop(1, '#3b82f600');
      
      ctx.fillStyle = hubGradient;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.radius * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner ring
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, hub.radius * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Create particles periodically
    const particleInterval = setInterval(createParticle, 200);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
      clearInterval(particleInterval);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
    </div>
  );
}


