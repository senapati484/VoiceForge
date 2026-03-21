import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAgent extends Document {
  userId: Types.ObjectId;
  name: string;
  agentType: 'marketing' | 'support' | 'sales' | 'tech';
  businessName: string;
  description: string;
  tone: 'professional' | 'friendly' | 'casual' | 'confident' | 'empathetic' | 'consultative';
  language: string;
  callObjective: string;
  voiceId: string;
  voiceName: string;
  vapiAgentId?: string;
  phoneNumber?: string;
  knowledgeDocs: Types.ObjectId[];
  knowledgeFile?: unknown;
  knowledgeFileGeneratedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    agentType: {
      type: String,
      enum: ['marketing', 'support', 'sales', 'tech'],
      required: true
    },
    businessName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 1500
    },
    tone: {
      type: String,
      enum: ['professional', 'friendly', 'casual', 'confident', 'empathetic', 'consultative'],
      default: 'professional'
    },
    language: {
      type: String,
      default: 'en-US'
    },
    callObjective: {
      type: String,
      required: true
    },
    voiceId: {
      type: String,
      required: true
    },
    voiceName: {
      type: String,
      required: true
    },
    vapiAgentId: {
      type: String
    },
    phoneNumber: {
      type: String
    },
    knowledgeDocs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'KnowledgeDoc'
      }
    ],
    knowledgeFile: {
      type: Schema.Types.Mixed
    },
    knowledgeFileGeneratedAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
);

// Pre-save hook to update updatedAt
AgentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Compound index
AgentSchema.index({ userId: 1, agentType: 1 });

export default mongoose.model<IAgent>('Agent', AgentSchema);
