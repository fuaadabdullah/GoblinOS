// Pinecone vector database adapter for long-term memory

import { Pinecone } from '@pinecone-database/pinecone';

export interface VectorDocument {
	id: string;
	values: number[];
	metadata: Record<string, any>;
}

export interface SearchResult {
	id: string;
	score: number;
	metadata: Record<string, any>;
}

export interface PineconeConfig {
	apiKey: string;
	indexName: string;
	dimension: number;
	metric?: 'cosine' | 'euclidean' | 'dotproduct';
	environment?: string;
}

export class PineconeAdapter {
	private pinecone: Pinecone;
	private indexName: string;
	private dimension: number;
	private enabled: boolean = true;

	constructor(config: PineconeConfig) {
		this.pinecone = new Pinecone({
			apiKey: config.apiKey,
		});
		this.indexName = config.indexName;
		this.dimension = config.dimension;
	}

	/**
	 * Initialize the Pinecone index if it doesn't exist
	 */
	async initialize(): Promise<void> {
		try {
			// Check if index exists
			const indexList = await this.pinecone.listIndexes();
			const indexExists = indexList.indexes?.some(idx => idx.name === this.indexName);
			if (!indexExists) {
				await this.pinecone.createIndex({
					name: this.indexName,
					dimension: this.dimension,
					metric: 'cosine',
					spec: {
						serverless: {
							cloud: 'aws',
							region: 'us-east-1'
						}
					}
				});

				// Wait briefly for index provisioning
				console.log(`Created Pinecone index: ${this.indexName}`);
				await new Promise(resolve => setTimeout(resolve, 8000));
			} else {
				// If index exists, attempt to read its dimension and validate
				try {
					// describeIndex is available on the client in newer SDKs
					const desc: any = typeof (this.pinecone as any).describeIndex === 'function'
						? await (this.pinecone as any).describeIndex({ indexName: this.indexName })
						: undefined;

					const existingDimension = desc?.dimension;
					if (existingDimension && existingDimension !== this.dimension) {
						const msg = `Pinecone index '${this.indexName}' has dimension ${existingDimension} but embedding dim is ${this.dimension}`;
						// If user requested force recreate, delete and recreate index
						if (process.env.PINECONE_FORCE_RECREATE === 'true') {
							console.warn(msg + ", PINECONE_FORCE_RECREATE=true -> recreating index");
							try {
								await (this.pinecone as any).deleteIndex({ indexName: this.indexName });
								await this.pinecone.createIndex({ name: this.indexName, dimension: this.dimension, metric: 'cosine', spec: { serverless: { cloud: 'aws', region: 'us-east-1' } } });
								console.log(`Recreated Pinecone index: ${this.indexName} with dimension ${this.dimension}`);
								await new Promise(resolve => setTimeout(resolve, 8000));
							} catch (err) {
								console.error('Failed to recreate Pinecone index:', err);
								this.enabled = false;
							}
						} else {
							console.error(msg + ". To recreate index set PINECONE_FORCE_RECREATE=true. Vector operations will be disabled.");
							this.enabled = false;
						}
					}
				} catch (err) {
					console.warn('Could not verify existing index properties, continuing (index may be serverless/provisioning):', err);
				}
			}
		} catch (error) {
			console.error('Failed to initialize Pinecone index:', error);
			throw error;
		}
	}

	/**
	 * Store vectors in the index
	 */
	async store(documents: VectorDocument[]): Promise<void> {
		try {
			if (!this.enabled) {
				console.warn('PineconeAdapter.store called but adapter is disabled due to previous index mismatch');
				return;
			}
			const index = this.pinecone.index(this.indexName);
			await index.upsert(documents);
		} catch (error) {
			console.error('Failed to store vectors:', error);
			throw error;
		}
	}

	/**
	 * Search for similar vectors
	 */
	async search(queryVector: number[], topK: number = 10, filter?: Record<string, any>): Promise<SearchResult[]> {
		try {
			if (!this.enabled) {
				console.warn('PineconeAdapter.search called but adapter is disabled due to previous index mismatch');
				return [];
			}
			const index = this.pinecone.index(this.indexName);
			const response = await index.query({
				vector: queryVector,
				topK,
				includeMetadata: true,
				filter
			});

			return response.matches?.map(match => ({
				id: match.id,
				score: match.score || 0,
				metadata: match.metadata || {}
			})) || [];
		} catch (error) {
			console.error('Failed to search vectors:', error);
			throw error;
		}
	}

	/**
	 * Delete vectors by IDs
	 */
	async delete(ids: string[]): Promise<void> {
		try {
			if (!this.enabled) {
				console.warn('PineconeAdapter.delete called but adapter is disabled due to previous index mismatch');
				return;
			}
			const index = this.pinecone.index(this.indexName);
			await index.deleteMany(ids);
		} catch (error) {
			console.error('Failed to delete vectors:', error);
			throw error;
		}
	}

	/**
	 * Update vector metadata
	 */
	async update(id: string, metadata: Record<string, any>): Promise<void> {
		try {
			if (!this.enabled) {
				console.warn('PineconeAdapter.update called but adapter is disabled due to previous index mismatch');
				return;
			}
			const index = this.pinecone.index(this.indexName);
			await index.update({
				id,
				metadata
			});
		} catch (error) {
			console.error('Failed to update vector:', error);
			throw error;
		}
	}

	/**
	 * Get index stats
	 */
	async getStats(): Promise<any> {
		try {
			if (!this.enabled) return { enabled: false };
			const index = this.pinecone.index(this.indexName);
			return await index.describeIndexStats();
		} catch (error) {
			console.error('Failed to get index stats:', error);
			throw error;
		}
	}

	/**
	 * Close the connection
	 */
	async close(): Promise<void> {
		// Pinecone client doesn't require explicit closing
	}
}
