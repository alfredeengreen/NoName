'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface RecordingEvent {
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

interface DOMSnapshot {
  timestamp: number;
  html: string;
  width: number;
  height: number;
}

interface Recording {
  id: string;
  vid: string;
  sid: string;
  path: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  events: RecordingEvent[] | null;
  snapshots: DOMSnapshot[] | null;
  metadata: {
    device?: Record<string, any>;
    viewport?: { width: number; height: number };
    url?: string;
  } | null;
}

export default function RecordingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.id as string;
  const recordingId = params.recordingId as string;
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    fetchRecording();
  }, [siteId, recordingId]);

  useEffect(() => {
    if (isPlaying && recording) {
      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          const maxTime = recording.duration || 0;
          if (prev >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return prev + 0.1;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isPlaying, recording]);

  const fetchRecording = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/app/api/sites/${siteId}/recordings/${recordingId}`);
      const data = await res.json();
      setRecording(data.recording);
    } catch (error) {
      console.error('Error fetching recording:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading recording...</div>;
  }

  if (!recording) {
    return <div className="p-8">Recording not found</div>;
  }

  const events = recording.events || [];
  const snapshots = recording.snapshots || [];
  const currentEvents = events.filter(e => e.timestamp <= currentTime * 1000);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline mb-2"
          >
            ← Back to Recordings
          </button>
          <h1 className="text-2xl font-bold">Session Recording</h1>
        </div>
      </div>

      {/* Recording Info */}
      <div className="bg-white p-6 rounded shadow space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Path</div>
            <div className="font-mono text-sm">{recording.path}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Duration</div>
            <div className="font-semibold">{recording.duration || 0}s</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Events</div>
            <div className="font-semibold">{events.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Snapshots</div>
            <div className="font-semibold">{snapshots.length}</div>
          </div>
        </div>
      </div>

      {/* Replay Controls */}
      <div className="bg-white p-4 rounded shadow">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <input
            type="range"
            min="0"
            max={recording.duration || 0}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm text-gray-600">
            {Math.round(currentTime)}s / {recording.duration || 0}s
          </span>
        </div>
      </div>

      {/* Event Timeline */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Event Timeline</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.map((event, idx) => {
            const eventTime = event.timestamp / 1000;
            const isPast = eventTime <= currentTime;
            return (
              <div
                key={idx}
                className={`p-3 border rounded ${
                  isPast ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{eventTime.toFixed(1)}s</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    event.type === 'click' ? 'bg-green-100 text-green-800' :
                    event.type === 'input' ? 'bg-blue-100 text-blue-800' :
                    event.type === 'navigation' ? 'bg-purple-100 text-purple-800' :
                    event.type === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.type}
                  </span>
                  <span className="text-sm">{JSON.stringify(event.data).substring(0, 100)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Snapshots */}
      {snapshots.length > 0 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">DOM Snapshots</h2>
          <div className="space-y-4">
            {snapshots.map((snapshot, idx) => {
              const snapshotTime = snapshot.timestamp / 1000;
              const isVisible = snapshotTime <= currentTime;
              return (
                <div key={idx} className="border rounded p-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Snapshot at {snapshotTime.toFixed(1)}s ({snapshot.width}x{snapshot.height})
                  </div>
                  {isVisible && (
                    <div className="border rounded overflow-auto max-h-64 bg-gray-50">
                      <pre className="text-xs p-2 whitespace-pre-wrap">
                        {snapshot.html.substring(0, 5000)}...
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


