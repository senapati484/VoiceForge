import mongoose, { Schema, Document, Types } from 'mongoose';

interface TranscriptEntry {
  role: string;
  text: string;
  timestamp: number;
}

export interface ICallLog extends Document {
  userId: Types.ObjectId;
  agentId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  csvContactId?: Types.ObjectId;
  vapiCallId: string;
  direction: 'inbound' | 'outbound';
  toNumber?: string;
  fromNumber?: string;
  status: 'initiated' | 'in-progress' | 'completed' | 'failed';
  durationSec?: number;
  transcript: TranscriptEntry[];
  creditsUsed?: number;
  outcome?: 'converted' | 'follow-up' | 'no-answer' | 'other';
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

const CallLogSchema = new Schema<ICallLog>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  csvContactId: {
    type: Schema.Types.ObjectId,
    ref: 'CsvContact'
  },
  vapiCallId: {
    type: String,
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  toNumber: {
    type: String
  },
  fromNumber: {
    type: String
  },
  status: {
    type: String,
    enum: ['initiated', 'in-progress', 'completed', 'failed'],
    default: 'initiated'
  },
  durationSec: {
    type: Number
  },
  transcript: [
    {
      role: String,
      text: String,
      timestamp: Number
    }
  ],
  creditsUsed: {
    type: Number
  },
  outcome: {
    type: String,
    enum: ['converted', 'follow-up', 'no-answer', 'other']
  },
  startedAt: {
    type: Date
  },
  endedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<ICallLog>('CallLog', CallLogSchema);
