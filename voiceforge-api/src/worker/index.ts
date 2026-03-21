import { config } from '../config';
import { KnowledgeDoc } from '../db';
import { ingestDocument } from '../rag/ingest';

export function startWorker(intervalMs = 10000): NodeJS.Timeout {
  const tick = async (): Promise<void> => {
    if (!config.ragEnabled) return;

    try {
      // Find pending documents (limit to 3 per tick to avoid overwhelming)
      const pending = await KnowledgeDoc.find({ status: 'pending' }).limit(3);

      for (const doc of pending) {
        try {
          console.log(`Processing document ${doc._id}...`);
          await ingestDocument(doc._id.toString());
          console.log(`Document ${doc._id} processed successfully`);
        } catch (err) {
          console.error(`Ingest failed for ${doc._id}:`,
            err instanceof Error ? err.message : 'Unknown error'
          );
        }
      }
    } catch (err) {
      console.error('Worker tick error:', err);
    }
  };

  // Run immediately on start
  tick();

  // Then run on interval
  // setInterval is non-blocking - Express keeps serving between ticks
  return setInterval(tick, intervalMs);
}
