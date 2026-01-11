import { pipeline, type Pipeline } from '@huggingface/transformers';

type ProgressCallback = (progress: number) => void;

// Define a singleton class for the general knowledge pipeline
class GeneralKnowledgePipeline {
  static task = 'text2text-generation';
  // This model is larger and better at general instruction-following and Q&A
  static model = 'Xenova/LaMini-Flan-T5-248M';
  static instance: Pipeline | null = null;

  static async getInstance(progress_callback?: ProgressCallback) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

export class GeneralKnowledgeService {
  /**
   * Generates an answer to a query based on the model's pre-trained "world knowledge."
   * @param query The user's question.
   * @param progress_callback An optional callback to track model loading progress.
   * @returns The synthesized answer.
   */
  static async answer(query: string, progress_callback?: ProgressCallback): Promise<string> {
    const generator = await GeneralKnowledgePipeline.getInstance(progress_callback);

    // Construct a simple, direct prompt for general Q&A
    const prompt = `
      Please provide a concise and accurate answer to the following question.

      Question:
      ${query}

      Answer:
    `;

    // Generate the answer
    const result = await generator(prompt, {
      max_new_tokens: 250,
      temperature: 0.7, // Allow for a bit more creativity for general questions
      do_sample: true,
    });

    // @ts-expect-error The `generated_text` property is not included in the base type.
    return result[0].generated_text;
  }
}
