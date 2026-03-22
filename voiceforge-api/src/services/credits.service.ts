import { User, CreditLedger } from '../db';

export const COSTS = {
  OUTBOUND_PER_MIN: 3,
  INBOUND_PER_MIN: 2,
  DOC: 2,
  SCRAPE: 2,
  CONTEXT: 3
} as const;

export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  callLogId?: string
): Promise<void> {
  // Update user credits
  await User.findByIdAndUpdate(userId, { $inc: { credits: -amount } });

  // Record transaction
  await CreditLedger.create({
    userId,
    type: 'deduct',
    amount: -amount,
    description,
    callLogId
  });
}

export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  paymentRef?: string
): Promise<void> {
  // Update user credits
  await User.findByIdAndUpdate(userId, { $inc: { credits: amount } });

  // Record transaction
  await CreditLedger.create({
    userId,
    type: 'purchase',
    amount,
    description,
    paymentRef
  });
}
