import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IKnowledgeDoc extends Document {
  userId: Types.ObjectId;
  agentId?: Types.ObjectId;
  type: 'pdf' | 'docx' | 'txt' | 'scrape' | 'csv';
  filename?: string;
  r2Key: string;
  sourceUrl?: string;
  fullTextR2Key?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  chunkCount?: number;
  pineconeNS?: string;
  errorMsg?: string;
  uploadedAt: Date;
}

const KnowledgeDocSchema = new Schema<IKnowledgeDoc>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent'
  },
  type: {
    type: String,
    enum: ['pdf', 'docx', 'txt', 'scrape', 'csv'],
    required: true
  },
  filename: {
    type: String
  },
  r2Key: {
    type: String,
    required: true
  },
  sourceUrl: {
    type: String
  },
  fullTextR2Key: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'ready', 'error'],
    default: 'pending'
  },
  chunkCount: {
    type: Number
  },
  pineconeNS: {
    type: String
  },
  errorMsg: {
    type: String
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IKnowledgeDoc>('KnowledgeDoc', KnowledgeDocSchema);
