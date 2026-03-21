import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from '../config';

export async function retrieveText(
  userId: string,
  query: string,
  topK: number = 3
): Promise<string[]> {
  if (!config.ragEnabled) {
    return [];
  }

  try {
    const pinecone = new Pinecone({ apiKey: config.pinecone.apiKey! });
    const index = pinecone.index(config.pinecone.index!);
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.gemini.apiKey!,
      model: 'text-embedding-004'
    });

    // Generate embedding using Gemini
    const queryEmbedding = await embeddings.embedQuery(query);

    // Query Pinecone within user's namespace
    const results = await index.namespace(userId).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    });

    // Extract text from results
    return results.matches
      ?.filter(m => m.metadata?.text)
      .map(m => m.metadata?.text as string) || [];
  } catch (err) {
    console.error('Pinecone retrieveText failed:', err);
    return [];
  }
}

export async function upsertDocuments(
  userId: string,
  documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>
): Promise<void> {
  if (!config.ragEnabled) {
    return;
  }

  const pinecone = new Pinecone({ apiKey: config.pinecone.apiKey! });
  const index = pinecone.index(config.pinecone.index!);
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: config.gemini.apiKey!,
    model: 'text-embedding-004'
  });

  // Generate embeddings
  const texts = documents.map(d => d.text);
  const vectors = await embeddings.embedDocuments(texts);

  // Prepare Pinecone records
  const records = documents.map((doc, i) => ({
    id: doc.id,
    values: vectors[i],
    metadata: { ...doc.metadata, text: doc.text }
  }));

  // Upsert to user's namespace
  await index.namespace(userId).upsert(records);
}

export async function deleteNamespace(userId: string): Promise<void> {
  if (!config.ragEnabled) {
    return;
  }
  const pinecone = new Pinecone({ apiKey: config.pinecone.apiKey! });
  const index = pinecone.index(config.pinecone.index!);
  await index.namespace(userId).deleteAll();
}
