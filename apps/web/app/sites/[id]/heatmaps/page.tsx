'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRef } from 'react';

interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
}

interface HeatmapData {
  path: string;
  type: string;
  points: HeatmapPoint[];
  screenshot?: string | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
}

export default function HeatmapsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const siteId = params.id as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState(searchParams.get('path') || '/');
  const [selectedType, setSelectedType] = useState<'click' | 'scroll' | 'move'>('click');

  useEffect(() => {
    fetchHeatmap();
  }, [siteId, selectedPath, selectedType, searchParams]);

  useEffect(() => {
    if (data && canvasRef.current) {
      // Small delay to ensure canvas is ready
      const timer = setTimeout(() => {
        drawHeatmap();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data, selectedPath, selectedType]);

  const fetchHeatmap = async () => {
    setLoading(true);
    try {
      const start = searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();
      
      const res = await fetch(`/app/api/sites/${siteId}/heatmaps?path=${encodeURIComponent(selectedPath)}&type=${selectedType}&start=${start}&end=${end}`);
      const json = await res.json();
      setData({
        path: json.path || selectedPath,
        type: json.type || selectedType,
        points: Array.isArray(json.points) ? json.points : [],
        screenshot: json.screenshot || null,
        viewportWidth: json.viewportWidth || null,
        viewportHeight: json.viewportHeight || null,
      });
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const drawHeatmap = () => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on viewport or default
    const canvasWidth = data.viewportWidth ? Math.min(data.viewportWidth, 1920) : 1000;
    const canvasHeight = data.viewportHeight ? Math.min(data.viewportHeight, 1080) : 1000;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw screenshot as background if available
    if (data.screenshot) {
      const img = new Image();
      img.onload = () => {
        // Scale image to fit canvas while maintaining aspect ratio
        const imgAspect = img.width / img.height;
        const canvasAspect = canvas.width / canvas.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > canvasAspect) {
          drawHeight = canvas.width / imgAspect;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          drawWidth = canvas.height * imgAspect;
          offsetX = (canvas.width - drawWidth) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        // Draw heatmap overlay
        drawHeatmapOverlay(ctx, canvas.width, canvas.height);
      };
      img.src = data.screenshot;
    } else {
      // No screenshot, just draw heatmap on blank canvas
      drawHeatmapOverlay(ctx, canvas.width, canvas.height);
    }
  };

  const drawHeatmapOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!data) return;

    // Find max intensity for normalization
    const maxIntensity = Math.max(...data.points.map(p => p.intensity), 1);

    // Draw heatmap points
    data.points.forEach(point => {
      // Scale coordinates from 0-1000 to actual canvas size
      const x = (point.x / 1000) * width;
      const y = (point.y / 1000) * height;
      
      const intensity = point.intensity / maxIntensity;
      const radius = 20 + (intensity * 30);
      const alpha = 0.3 + (intensity * 0.5);

      // Create gradient
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(255, 165, 0, ${alpha * 0.7})`);
      gradient.addColorStop(1, `rgba(255, 255, 0, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  if (loading) {
    return <div className="p-8">Loading heatmap data...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Heatmaps</h1>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
            <input
              type="text"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              placeholder="/"
              className="w-full border rounded-md p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="w-full border rounded-md p-2"
            >
              <option value="click">Clicks</option>
              <option value="scroll">Scroll Depth</option>
              <option value="move">Mouse Movement</option>
            </select>
          </div>
        </div>
        <button
          onClick={fetchHeatmap}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Load Heatmap
        </button>
      </div>

      {/* Heatmap Visualization */}
      {data && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">
            {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Heatmap - {data.path}
          </h2>
          <div className="border rounded overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxHeight: '600px', objectFit: 'contain' }}
            />
          </div>
          {!data.screenshot && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <strong>Note:</strong> No page screenshot available. To enable screenshots, add html2canvas to your site:
              <code className="block mt-2 p-2 bg-yellow-100 rounded">
                &lt;script src=&quot;https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js&quot;&gt;&lt;/script&gt;
              </code>
            </div>
          )}
          <div className="mt-4 text-sm text-gray-600">
            <p>Total points: {data.points.length}</p>
            <p>Max intensity: {Math.max(...data.points.map(p => p.intensity), 0)}</p>
            {data.viewportWidth && data.viewportHeight && (
              <p>Viewport: {data.viewportWidth} × {data.viewportHeight}px</p>
            )}
          </div>
        </div>
      )}

      {!data && (
        <div className="bg-white p-6 rounded shadow text-center text-gray-500">
          No heatmap data available for this path and type.
        </div>
      )}
    </div>
  );
}


