'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DataTable from '@/components/DataTable';
import ChartContainer from '@/components/ChartContainer';
import MetricCard from '@/components/MetricCard';

interface Event {
  eventName: string;
  count: number;
  lastSeen: string;
}

interface EventDetail {
  path: string;
  count: number;
  uniqueVisitors: number;
  totalValue: number;
}

interface EventsData {
  events: Event[];
  comparisons?: {
    totalEvents: { current: number; previous: number; change: number; changePercent: number };
  };
}

export default function EventsPage() {
  const params = useParams();
  const siteId = params.id as string;
  const [events, setEvents] = useState<Event[]>([]);
  const [comparisons, setComparisons] = useState<EventsData['comparisons']>();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<EventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/app/api/sites/${siteId}/events`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: EventsData) => {
        setEvents(data.events || []);
        setComparisons(data.comparisons);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading events:', error);
        setEvents([]);
        setLoading(false);
      });
  }, [siteId]);

  useEffect(() => {
    if (selectedEvent) {
      setDetailsLoading(true);
      fetch(`/app/api/sites/${siteId}/events/${encodeURIComponent(selectedEvent)}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          setEventDetails(data.details || []);
          setDetailsLoading(false);
        })
        .catch((error) => {
          console.error('Error loading event details:', error);
          setEventDetails([]);
          setDetailsLoading(false);
        });
    }
  }, [siteId, selectedEvent]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const totalEvents = events.reduce((sum, e) => sum + e.count, 0);
  const uniqueEventTypes = events.length;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Event Catalog</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Events"
          value={totalEvents.toLocaleString()}
          comparison={comparisons?.totalEvents}
        />
        <MetricCard
          title="Event Types"
          value={uniqueEventTypes}
        />
        <MetricCard
          title="Custom Events"
          value={events.filter((e) => e.eventName !== 'pageview').length}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">All Events</h2>
        <DataTable
          data={events}
          columns={[
            { 
              key: 'eventName', 
              label: 'Event Name', 
              sortable: true,
              render: (value) => <span className="font-mono text-sm">{value}</span>,
            },
            { 
              key: 'count', 
              label: 'Count', 
              sortable: true,
              render: (value) => value.toLocaleString(),
            },
            { 
              key: 'lastSeen', 
              label: 'Last Seen', 
              sortable: true,
              render: (value) => new Date(value).toLocaleString(),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (_, row) => (
                <button
                  onClick={() => setSelectedEvent(selectedEvent === row.eventName ? null : row.eventName)}
                  className="text-blue-600 hover:underline text-sm"
                >
                  {selectedEvent === row.eventName ? 'Hide Details' : 'View Details'}
                </button>
              ),
            },
          ]}
          keyExtractor={(row) => row.eventName}
          pagination={{ pageSize: 20 }}
        />
      </div>

      {selectedEvent && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Event Details: {selectedEvent}</h2>
          {detailsLoading ? (
            <div>Loading event details...</div>
          ) : eventDetails.length > 0 ? (
            <div className="space-y-4">
              <ChartContainer height={300}>
                <BarChart data={eventDetails}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="path" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" name="Event Count" />
                </BarChart>
              </ChartContainer>
              <DataTable
                data={eventDetails}
                columns={[
                  { key: 'path', label: 'Page Path', sortable: true },
                  { key: 'count', label: 'Count', sortable: true },
                  { key: 'uniqueVisitors', label: 'Unique Visitors', sortable: true },
                  { 
                    key: 'totalValue', 
                    label: 'Total Value', 
                    sortable: true,
                    render: (value) => value > 0 ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-',
                  },
                ]}
                keyExtractor={(row) => row.path}
              />
            </div>
          ) : (
            <div className="text-gray-500">No detailed data available for this event.</div>
          )}
        </div>
      )}
    </div>
  );
}

