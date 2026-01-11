import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export class EmbeddingService {
  private static pipeline: FeatureExtractionPipeline | null = null;

  static async getPipeline(onProgress?: (progress: number) => void): Promise<FeatureExtractionPipeline> {
    if (this.pipeline) return this.pipeline;

    this.pipeline = await (pipeline as any)('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: (info: any) => {
        if (info.status === 'progress' && info.progress !== undefined) {
          onProgress?.(info.progress);
        }
      },
    });

    return this.pipeline!;
  }

  static async generate(text: string): Promise<number[]> {
    const extractor = await this.getPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }
}
