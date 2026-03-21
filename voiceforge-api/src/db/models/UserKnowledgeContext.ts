import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserKnowledgeContext extends Document {
  userId: Types.ObjectId;
  knowledgeFile: Record<string, unknown>;
  generatedAt: Date;
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
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

UserKnowledgeContextSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model<IUserKnowledgeContext>(
  'UserKnowledgeContext',
  UserKnowledgeContextSchema
);
