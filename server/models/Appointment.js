import mongoose from 'mongoose';
import { APPOINTMENT_STATUS, APPOINTMENT_STATUSES, BOOKING_CODE_REGEX, LIMITS } from '../../shared/constants.js';

const { Schema } = mongoose;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const appointmentSchema = new Schema(
  {
    // 'booking' = a client's appointment; 'block' = time the salon reserved from the panel
    // (no client). Both hold their ticks, so the double-booking guard covers them alike.
    kind: { type: String, enum: ['booking', 'block'], default: 'booking' },
    // 'online' = booked by the client on the portal; 'admin' = created from the panel.
    source: { type: String, enum: ['online', 'admin'], default: 'online' },
    clientName: { type: String, required: true, trim: true, maxlength: LIMITS.clientNameMax },
    clientPhone: {
      type: String,
      required() {
        return this.kind !== 'block';
      },
      match: /^\d{8,15}$/,
      index: true,
    },
    serviceKey: { type: String, required: true },
    serviceName: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 15 },
    date: { type: String, required: true, match: DATE_RE, index: true },
    timeSlot: { type: String, required: true, match: TIME_RE },
    endTime: { type: String, required: true, match: TIME_RE },
    // 15-minute ticks this appointment occupies ('HH:mm'). Together with `holdsSlot`
    // they back the unique index that makes double booking impossible.
    occupiedTicks: { type: [String], required: true },
    holdsSlot: { type: Boolean, default: true },
    bookingCode: { type: String, required: true, unique: true, match: BOOKING_CODE_REGEX },
    qrDataUrl: {
      type: String,
      required() {
        return this.kind !== 'block';
      },
    },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: APPOINTMENT_STATUS.CONFIRMED },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['client', 'admin'] },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

// No two appointments that hold time may share a tick on the same date.
appointmentSchema.index(
  { date: 1, occupiedTicks: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true }, name: 'unique_slot_ticks' },
);
appointmentSchema.index({ clientPhone: 1, status: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1, timeSlot: 1 });

export const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
