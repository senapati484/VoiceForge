import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  provider: 'google' | 'otp';
  credits: number;
  plan: 'free' | 'starter' | 'growth' | 'business';
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  provider: {
    type: String,
    enum: ['google', 'otp'],
    required: true
  },
  credits: {
    type: Number,
    default: 50,
    min: 0
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'growth', 'business'],
    default: 'free'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IUser>('User', UserSchema);
