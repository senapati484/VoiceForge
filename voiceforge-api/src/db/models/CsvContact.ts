import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICsvContact extends Document {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  phone: string;
  notes?: string;
  status: 'pending' | 'calling' | 'answered' | 'no-answer' | 'converted' | 'failed';
  callLogId?: Types.ObjectId;
  calledAt?: Date;
  outcome?: string;
  createdAt: Date;
}

const CsvContactSchema = new Schema<ICsvContact>({
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'calling', 'answered', 'no-answer', 'converted', 'failed'],
    default: 'pending'
  },
  callLogId: {
    type: Schema.Types.ObjectId,
    ref: 'CallLog'
  },
  calledAt: {
    type: Date
  },
  outcome: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for querying contacts by campaign and status
CsvContactSchema.index({ campaignId: 1, status: 1 });

export default mongoose.model<ICsvContact>('CsvContact', CsvContactSchema);
