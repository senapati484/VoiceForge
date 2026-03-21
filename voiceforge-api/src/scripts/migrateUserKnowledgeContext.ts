import mongoose from 'mongoose';
import { config } from '../config';
import UserKnowledgeContext from '../db/models/UserKnowledgeContext';

type LegacyContextDoc = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  knowledgeFile: Record<string, unknown>;
  generatedAt?: Date;
};

async function run(): Promise<void> {
  await mongoose.connect(config.mongoUri, { dbName: 'voiceforge' });
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.collection('userknowledgecontexts');
  const docs = await collection
    .find<LegacyContextDoc>({}, { projection: { userId: 1, knowledgeFile: 1, generatedAt: 1 } })
    .sort({ generatedAt: -1, _id: -1 })
    .toArray();

  const byUser = new Map<string, LegacyContextDoc>();
  for (const doc of docs) {
    const key = String(doc.userId);
    if (!byUser.has(key)) byUser.set(key, doc);
  }

  let upserts = 0;
  for (const latest of byUser.values()) {
    await UserKnowledgeContext.findOneAndUpdate(
      { userId: latest.userId },
      {
        userId: latest.userId,
        knowledgeFile: latest.knowledgeFile || {},
        generatedAt: latest.generatedAt || new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upserts += 1;
  }

  console.log(`Migrated ${upserts} user context records`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Migration failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

