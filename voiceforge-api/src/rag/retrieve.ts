import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { config } from '../config';

export async function retrieveContext(
  userId: string,
  query: string,
  topK = 3
): Promise<string[]> {
  if (!config.ragEnabled) {
    return [];
  }

  try {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.gemini.apiKey!,
      model: 'text-embedding-004'
    });

    const pc = new Pinecone({ apiKey: config.pinecone.apiKey! });
    const index = pc.Index(config.pinecone.index!).namespace(userId);

    // Generate embedding for query
    const vector = await embeddings.embedQuery(query);

    // Query Pinecone
    const result = await index.query({
      vector,
      topK,
      includeMetadata: true
    });

    // Filter by score threshold and extract text
    return result.matches
      ?.filter(m => (m.score ?? 0) > 0.55)
      .map(m => m.metadata?.text as string)
      .filter(Boolean) || [];

  } catch (err) {
    // If namespace doesn't exist or other error, return empty
    if (err instanceof Error && err.message.includes('Namespace')) {
      return [];
    }
    console.error('RAG retrieve error:', err);
    return [];
  }
}
