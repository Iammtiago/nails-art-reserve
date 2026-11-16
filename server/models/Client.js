import mongoose from 'mongoose';
import { LIMITS } from '../../shared/constants.js';

const { Schema } = mongoose;

const clientSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, match: /^\d{8,15}$/ },
    name: { type: String, required: true, trim: true, maxlength: LIMITS.clientNameMax },
    // Bookings made (never decremented) and visits confirmed at the salon.
    totalAppointments: { type: Number, default: 1, min: 0 },
    completedAppointments: { type: Number, default: 0, min: 0 },
    lastAppointmentDate: { type: String, default: '' },
    lastVisitDate: { type: String, default: '' },
  },
  { timestamps: true },
);

clientSchema.index({ name: 1 });
clientSchema.index({ lastAppointmentDate: -1 });

export const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);
