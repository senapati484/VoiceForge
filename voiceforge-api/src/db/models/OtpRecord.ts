import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpRecord extends Document {
  email: string;
  otpHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const OtpRecordSchema = new Schema<IOtpRecord>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index: auto-deletes expired records
OtpRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IOtpRecord>('OtpRecord', OtpRecordSchema);
