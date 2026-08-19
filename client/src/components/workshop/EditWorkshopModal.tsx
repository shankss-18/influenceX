import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, Layers, Shield, Save } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TimeInput12h } from '../ui/TimeInput12h';
import { DateTimeInput12h } from '../ui/DateTimeInput12h';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { combineDateAnd12hTime, splitDateAnd12hTime } from '../../utils/date';

interface HallRow {
  name: string;
  capacity: number;
}

interface EditWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  workshop: any;
  onUpdated: () => void;
}

export const EditWorkshopModal: React.FC<EditWorkshopModalProps> = ({
  isOpen,
  onClose,
  workshop,
  onUpdated,
}) => {
  const { success, error } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('01:00 PM');
  const [registrationFormUrl, setRegistrationFormUrl] = useState('');
  const [halls, setHalls] = useState<HallRow[]>([{ name: 'Hall 1', capacity: 60 }]);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [creditCap, setCreditCap] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (workshop) {
      setName(workshop.name || '');
      setDescription(workshop.description || '');
      setDate(
        workshop.date ? new Date(workshop.date).toISOString().split('T')[0] : ''
      );
      setStartTime(workshop.startTime || '09:00 AM');
      setEndTime(workshop.endTime || '01:00 PM');
      setRegistrationFormUrl(workshop.registrationFormUrl || '');
      if (workshop.halls && workshop.halls.length > 0) {
        setHalls(
          workshop.halls.map((h: any) => ({
            name: h.name,
            capacity: Number(h.capacity),
          }))
        );
      } else {
        setHalls([{ name: 'Main Hall', capacity: Number(workshop.capacity || 50) }]);
      }
      setWindowStart(
        workshop.attendanceWindowStart
          ? new Date(workshop.attendanceWindowStart).toISOString()
          : new Date().toISOString()
      );
      setWindowEnd(
        workshop.attendanceWindowEnd
          ? new Date(workshop.attendanceWindowEnd).toISOString()
          : new Date(Date.now() + 180 * 60000).toISOString()
      );
      setCreditCap(workshop.creditCap || 50);
    }
  }, [workshop]);

  const totalCapacity = halls.reduce((sum, h) => sum + (Number(h.capacity) || 0), 0);

  const handleAddHall = () => {
    setHalls([...halls, { name: `Hall ${halls.length + 1}`, capacity: 50 }]);
  };

  const handleRemoveHall = (index: number) => {
    if (halls.length === 1) return;
    setHalls(halls.filter((_, i) => i !== index));
  };

  const handleHallChange = (index: number, field: keyof HallRow, value: any) => {
    const next = [...halls];
    next[index] = { ...next[index], [field]: value };
    setHalls(next);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workshop) return;

    if (halls.length === 0) {
      error('Validation Error', 'At least one hall is required');
      return;
    }

    try {
      setIsSaving(true);
      const res = await api.patch<{ success: boolean; message: string }>(
        `/workshops/${workshop.id || workshop._id}`,
        {
          name,
          description,
          date,
          startTime,
          endTime,
          registrationFormUrl: registrationFormUrl.trim(),
          halls: halls.map((h) => ({ name: h.name.trim(), capacity: Number(h.capacity) })),
          attendanceWindowStart: windowStart ? new Date(windowStart).toISOString() : undefined,
          attendanceWindowEnd: windowEnd ? new Date(windowEnd).toISOString() : undefined,
          creditCap: Number(creditCap),
        }
      );

      if (res.data.success) {
        success('Workshop Updated', res.data.message);
        onClose();
        onUpdated();
      }
    } catch (err: any) {
      error('Update Error', err.response?.data?.error || 'Failed to update workshop');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Workshop Details"
      description={`Editing ${workshop?.name || 'Workshop'} (${workshop?.eventId || ''}) at current lifecycle stage.`}
      size="lg"
    >
      <form onSubmit={handleSave} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <Input
          label="Workshop Title / Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Description
          </label>
          <textarea
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:ring-1 focus:ring-brand-500 focus:outline-hidden"
          />
        </div>

        <Input
          label="Student Registration Google Form URL"
          placeholder="https://forms.gle/... (Google Form URL for students to register)"
          value={registrationFormUrl}
          onChange={(e) => setRegistrationFormUrl(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Date"
            type="date"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setWindowStart(combineDateAnd12hTime(e.target.value, splitDateAnd12hTime(windowStart).time12h));
              setWindowEnd(combineDateAnd12hTime(e.target.value, splitDateAnd12hTime(windowEnd).time12h));
            }}
          />
          <div>
            <TimeInput12h
              label="Start Time"
              required
              value={startTime}
              onChange={(val) => {
                setStartTime(val);
                setWindowStart(combineDateAnd12hTime(date, val));
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
                setWindowEnd(combineDateAnd12hTime(date, val));
              }}
            />
          </div>
        </div>

        {/* Halls & Capacities Configuration */}
        <div className="p-3 bg-surface rounded-xl border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-600" />
                Halls & Capacity Allocation
              </span>
              <span className="text-[11px] text-gray-500 block">
                Total Capacity:{' '}
                <strong className="text-brand-600">{totalCapacity} students</strong>
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddHall}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Hall
            </Button>
          </div>

          <div className="space-y-2">
            {halls.map((hall, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Hall Name (e.g. Hall 3)"
                    value={hall.name}
                    onChange={(e) => handleHallChange(idx, 'name', e.target.value)}
                    required
                  />
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Seats"
                    value={hall.capacity}
                    onChange={(e) =>
                      handleHallChange(idx, 'capacity', Number(e.target.value))
                    }
                    required
                  />
                </div>
                {halls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 h-9 px-2"
                    onClick={() => handleRemoveHall(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Window & Credit Cap */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateTimeInput12h
            label="Attendance Window Start"
            required
            isoValue={windowStart}
            onChange={(val) => setWindowStart(val)}
          />
          <DateTimeInput12h
            label="Attendance Window End"
            required
            isoValue={windowEnd}
            onChange={(val) => setWindowEnd(val)}
          />
        </div>

        <Input
          label="Credit Cap per Student (pts)"
          type="number"
          min={1}
          max={200}
          required
          value={creditCap}
          onChange={(e) => setCreditCap(Number(e.target.value))}
          helperText="Maximum allowed credits any single student can earn in this workshop"
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save All Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
