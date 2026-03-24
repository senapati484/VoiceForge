import mongoose, { Schema, Document, Types } from 'mongoose';
import type { KnowledgeFile, CompactContextV2 } from '../../types/compactContext';

export interface IUserKnowledgeContext extends Document {
  userId: Types.ObjectId;
  knowledgeFile: KnowledgeFile | Record<string, unknown>; // Legacy format
  compactContext?: CompactContextV2;                     // NEW: Compact format v2
  generatedAt: Date;
  version: number;                                        // NEW: Format version (1=legacy, 2=compact)
}

const UserKnowledgeContextSchema = new Schema<IUserKnowledgeContext>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  knowledgeFile: {
    type: Schema.Types.Mixed,
    required: true
  },
  compactContext: {
    type: Schema.Types.Mixed,
    required: false
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  version: {
    type: Number,
    default: 1
  }
});

UserKnowledgeContextSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model<IUserKnowledgeContext>(
  'UserKnowledgeContext',
  UserKnowledgeContextSchema
);
