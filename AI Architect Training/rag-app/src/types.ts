// Shared types for the RAG pipeline.

export interface Chunk {
  id: string; // `${docId}#${index}`
  docId: string; // source file name
  title: string; // human-readable document title
  index: number; // chunk order within the document
  text: string; // chunk content
  allowedRoles: string[]; // ACL: roles permitted to retrieve this chunk
  modality: "text" | "image"; // how the chunk was produced
  embedding: number[]; // vector
  contentHash: string; // hash of source doc (for incremental updates)
}

export interface RetrievedChunk extends Chunk {
  score: number; // cosine similarity to the query
}

export interface User {
  roles: string[];
}

export interface Citation {
  id: string;
  docId: string;
  title: string;
}

export interface RagAnswer {
  answer: string;
  citations: Citation[];
  retrieved: RetrievedChunk[];
  refused: boolean;
}
