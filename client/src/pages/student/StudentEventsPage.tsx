import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Tag,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EventItem } from '../../types';
import { formatDateTimeIST, formatDateIST } from '../../utils/date';

export const StudentEventsPage: React.FC = () => {
  const { success, error } = useToast();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [serverTimeIST, setServerTimeIST] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{
        success: boolean;
        events: EventItem[];
        serverTimeIST: string;
      }>('/events');

      if (res.data.success) {
        setEvents(res.data.events);
        setServerTimeIST(res.data.serverTimeIST);
      }
    } catch (err: any) {
      error('Failed to load events', err.response?.data?.error || 'Unable to fetch events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleRegister = async (event: EventItem) => {
    try {
      setRegisteringId(event.id);
      const res = await api.post<{ success: boolean; message: string }>(`/events/${event.id}/register`);
      if (res.data.success) {
        success('Registration Confirmed', `You are registered for "${event.name}".`);
        fetchEvents();
      }
    } catch (err: any) {
      error('Registration Failed', err.response?.data?.error || 'Unable to register for event');
      fetchEvents();
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Club Events & Workshops"
        description="Browse authorized events, track registration windows, and secure your attendance spot."
        badge={
          serverTimeIST ? (
            <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
              Server Time: {serverTimeIST}
            </span>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="p-16 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-xs font-medium text-gray-500">Checking open event windows...</p>
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-6 h-6 text-gray-400" />}
          title="No events open at the moment"
          description="Check back later for new club hackathons, workshops, and guest speaker sessions."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map((event) => {
            const catName =
              typeof event.categoryId === 'string'
                ? 'Category'
                : event.categoryId?.name || 'General';

            const regWindow = event.windowStatuses?.registration;
            const isRegOpen = regWindow?.isOpen;
            const isRegistered = event.isUserRegistered;
            const isFull = event.isFull;

            return (
              <Card key={event.id} className="flex flex-col justify-between hover:border-gray-300 transition-colors">
                <CardContent className="p-6 space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                      {event.eventId}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="gray" size="sm">
                        {catName}
                      </Badge>
                      {isRegistered ? (
                        <Badge variant="green" size="sm" dot>
                          REGISTERED
                        </Badge>
                      ) : isRegOpen ? (
                        <Badge variant="green" size="sm" dot>
                          REGISTRATION OPEN
                        </Badge>
                      ) : regWindow?.status === 'NOT_STARTED' ? (
                        <Badge variant="amber" size="sm">
                          OPENS SOON
                        </Badge>
                      ) : (
                        <Badge variant="gray" size="sm">
                          REGISTRATION CLOSED
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">{event.name}</h3>
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {event.description}
                    </p>
                  </div>

                  {/* Metadata List */}
                  <div className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>
                        {formatDateIST(event.date)} ({event.startTime} - {event.endTime})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="truncate">{event.venue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>
                        {event.registeredCount} / {event.capacity} seats filled{' '}
                        {event.availableSpots > 0 && (
                          <span className="text-emerald-600 font-medium">
                            ({event.availableSpots} remaining)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Registration Window Info Box */}
                  <div className="p-3 rounded-lg bg-surface border border-gray-100 text-[11px] text-gray-500 space-y-1">
                    <div className="font-semibold text-gray-700">Registration Window (Server-Verified):</div>
                    <div>Opens: {formatDateTimeIST(event.registrationStart)}</div>
                    <div>Closes: {formatDateTimeIST(event.registrationEnd)}</div>
                  </div>
                </CardContent>

                {/* Footer Action */}
                <div className="p-4 bg-gray-50/75 border-t border-gray-100 rounded-b-lg flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {isRegistered ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        You are enrolled
                      </span>
                    ) : isFull ? (
                      <span className="text-amber-700 font-medium">Capacity reached</span>
                    ) : isRegOpen ? (
                      <span className="text-emerald-600 font-medium">Registration active</span>
                    ) : (
                      <span>Outside registration window</span>
                    )}
                  </div>

                  <div>
                    {isRegistered ? (
                      <Button variant="secondary" size="sm" disabled className="text-xs">
                        Registered
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!isRegOpen || isFull || registeringId === event.id}
                        isLoading={registeringId === event.id}
                        onClick={() => handleRegister(event)}
                      >
                        {isFull ? 'Event Full' : isRegOpen ? 'Register Now' : 'Window Closed'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
