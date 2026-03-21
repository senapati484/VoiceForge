import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICampaign extends Document {
  userId: Types.ObjectId;
  agentId: Types.ObjectId;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  csvR2Key?: string;
  totalContacts: number;
  called: number;
  answered: number;
  converted: number;
  noAnswer: number;
  failed: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed'],
    default: 'draft'
  },
  csvR2Key: {
    type: String
  },
  totalContacts: {
    type: Number,
    default: 0
  },
  called: {
    type: Number,
    default: 0
  },
  answered: {
    type: Number,
    default: 0
  },
  converted: {
    type: Number,
    default: 0
  },
  noAnswer: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  },
  scheduledAt: {
    type: Date
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<ICampaign>('Campaign', CampaignSchema);
