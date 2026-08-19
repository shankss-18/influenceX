import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Layers, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { TimeInput12h } from '../../components/ui/TimeInput12h';
import { DateTimeInput12h } from '../../components/ui/DateTimeInput12h';
import { combineDateAnd12hTime, splitDateAnd12hTime } from '../../utils/date';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';

export const CreateWorkshopPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>('10:00 AM');
  const [endTime, setEndTime] = useState<string>('01:00 PM');

  const [halls, setHalls] = useState<Array<{ name: string; capacity: number }>>([
    { name: 'Hall 3', capacity: 60 },
    { name: 'Hall 4', capacity: 70 },
  ]);

  const [attendanceWindowStart, setAttendanceWindowStart] = useState<string>(
    new Date(Date.now() - 30 * 60000).toISOString().slice(0, 16)
  );
  const [attendanceWindowEnd, setAttendanceWindowEnd] = useState<string>(
    new Date(Date.now() + 180 * 60000).toISOString().slice(0, 16)
  );

  const [registrationFormUrl, setRegistrationFormUrl] = useState<string>('');
  const [creditCap, setCreditCap] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const totalCapacity = halls.reduce((sum, h) => sum + (Number(h.capacity) || 0), 0);

  const addHallRow = () => {
    setHalls([...halls, { name: `Hall ${halls.length + 1}`, capacity: 30 }]);
  };

  const removeHallRow = (index: number) => {
    if (halls.length <= 1) {
      error('Requirement', 'At least one hall is required.');
      return;
    }
    setHalls(halls.filter((_, idx) => idx !== index));
  };

  const updateHallRow = (index: number, field: 'name' | 'capacity', value: any) => {
    const updated = [...halls];
    updated[index] = { ...updated[index], [field]: field === 'capacity' ? Number(value) : value };
    setHalls(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Workshop name is required.');
      return;
    }
    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (halls.length === 0) {
      setFormError('At least 1 hall is required.');
      return;
    }
    if (halls.some((h) => !h.name.trim() || h.capacity <= 0)) {
      setFormError('Every hall must have a valid name and capacity greater than 0.');
      return;
    }

    const startWin = new Date(attendanceWindowStart);
    const endWin = new Date(attendanceWindowEnd);
    if (endWin.getTime() <= startWin.getTime()) {
      setFormError('Attendance window end time must be after window start time.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post<{
        success: boolean;
        message: string;
        workshop: { id: string; eventId: string };
        nextStepUrl: string;
      }>('/workshops', {
        name,
        description,
        date,
        startTime,
        endTime,
        halls,
        attendanceWindowStart: startWin.toISOString(),
        attendanceWindowEnd: endWin.toISOString(),
        creditCap: Number(creditCap) || 50,
        registrationFormUrl: registrationFormUrl.trim(),
      });

      if (res.data.success) {
        success('Workshop Created', res.data.message);
        navigate(`/admin/workshops/${res.data.workshop.id}/setup`);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create workshop');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/workshops')}
          className="text-gray-500 hover:text-gray-900 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Workshop</h1>
          <p className="text-xs text-gray-500">Configure halls, duration, attendance window, and credit caps.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Section 1: Workshop Overview */}
        <Card className="shadow-xs border-gray-200">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-sm font-bold">1. Workshop Overview</CardTitle>
            <CardDescription className="text-xs">General details and schedule.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <Input
              label="Workshop Name"
              required
              placeholder="e.g. GenAI Agents Architecture Masterclass"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Hands-on agentic workflows and practical multi-agent design."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Input
              label="Student Registration Google Form URL (Optional)"
              placeholder="https://forms.gle/... (e.g. Google Form Link for students to register)"
              value={registrationFormUrl}
              onChange={(e) => setRegistrationFormUrl(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Date"
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  // Also auto-sync window date if on same day
                  setAttendanceWindowStart(combineDateAnd12hTime(e.target.value, splitDateAnd12hTime(attendanceWindowStart).time12h));
                  setAttendanceWindowEnd(combineDateAnd12hTime(e.target.value, splitDateAnd12hTime(attendanceWindowEnd).time12h));
                }}
              />
              <div>
                <TimeInput12h
                  label="Start Time"
                  required
                  value={startTime}
                  onChange={(val) => {
                    setStartTime(val);
                    // auto sync window start to start time
                    setAttendanceWindowStart(combineDateAnd12hTime(date, val));
                  }}
                />
              </div>
              <div>
                <TimeInput12h
                  label="End Time"
                  required
                  value={endTime}
                  onChange={(val) => {
                    setEndTime(val);
                    // auto sync window end to end time
                    setAttendanceWindowEnd(combineDateAnd12hTime(date, val));
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Halls & Capacities */}
        <Card className="shadow-xs border-gray-200">
          <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                2. Halls & Capacities
              </CardTitle>
              <CardDescription className="text-xs">
                Add each hall and its seat capacity. Students will be auto-placed across these halls.
              </CardDescription>
            </div>

            <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-bold text-brand-800">
              Total Capacity: {totalCapacity} students
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-3">
            {halls.map((hall, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-gray-200">
                <div className="flex-1">
                  <Input
                    label={`Hall ${idx + 1} Name`}
                    required
                    placeholder="e.g. Auditorium Hall A"
                    value={hall.name}
                    onChange={(e) => updateHallRow(idx, 'name', e.target.value)}
                  />
                </div>
                <div className="w-36">
                  <Input
                    label="Seat Capacity"
                    type="number"
                    min={1}
                    required
                    value={hall.capacity}
                    onChange={(e) => updateHallRow(idx, 'capacity', e.target.value)}
                  />
                </div>
                <div className="pt-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHallRow(idx)}
                    disabled={halls.length <= 1}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addHallRow}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Another Hall
            </Button>
          </CardContent>
        </Card>

        {/* Section 3: Attendance Window & Credit Cap */}
        <Card className="shadow-xs border-gray-200">
          <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                3. Attendance Window & Credit Cap
              </CardTitle>
              <CardDescription className="text-xs">
                Volunteers can ONLY mark attendance and award participation points during this window.
              </CardDescription>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getTime() - 15 * 60000).toISOString();
                  const end = new Date(now.getTime() + 240 * 60000).toISOString();
                  setAttendanceWindowStart(start);
                  setAttendanceWindowEnd(end);
                }}
                className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
              >
                ⚡ Open Window Now (+4h)
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateTimeInput12h
                label="Attendance Window Opens"
                required
                isoValue={attendanceWindowStart}
                onChange={(val) => setAttendanceWindowStart(val)}
                helperText="Volunteers gain access to mark attendance from this time."
              />
              <DateTimeInput12h
                label="Attendance Window Closes"
                required
                isoValue={attendanceWindowEnd}
                onChange={(val) => setAttendanceWindowEnd(val)}
                helperText="Attendance window locks and freezes all volunteer mutations."
              />
            </div>

            <div className="max-w-xs">
              <Input
                label="Workshop Credit Cap (Max Points per Student)"
                type="number"
                min={1}
                required
                value={creditCap}
                onChange={(e) => setCreditCap(Number(e.target.value))}
                helperText="Hard ceiling per student for registration + attendance + interaction combined."
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => navigate('/admin/workshops')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
          >
            Create Workshop & Proceed to Setup →
          </Button>
        </div>
      </form>
    </div>
  );
};
