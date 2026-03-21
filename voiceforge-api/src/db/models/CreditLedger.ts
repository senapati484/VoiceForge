import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICreditLedger extends Document {
  userId: Types.ObjectId;
  type: 'purchase' | 'deduct' | 'refund' | 'bonus';
  amount: number;
  description: string;
  callLogId?: Types.ObjectId;
  paymentRef?: string;
  createdAt: Date;
}

const CreditLedgerSchema = new Schema<ICreditLedger>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['purchase', 'deduct', 'refund', 'bonus'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  callLogId: {
    type: Schema.Types.ObjectId,
    ref: 'CallLog'
  },
  paymentRef: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<ICreditLedger>('CreditLedger', CreditLedgerSchema);
