import { pipeline, type Pipeline } from '@huggingface/transformers';

type ProgressCallback = (progress: number) => void;

// Define a singleton class for the answer generation pipeline
class AnswerPipeline {
  static task = 'text2text-generation';
  static model = 'Xenova/flan-t5-small';
  static instance: Pipeline | null = null;

  static async getInstance(progress_callback?: ProgressCallback) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

export class AnswerService {
  /**
   * Generates an answer to a query based on the provided context.
   * @param query The user's question.
   * @param context An array of relevant document chunks.
   * @param progress_callback An optional callback to track model loading progress.
   * @returns The synthesized answer.
   */
  static async answer(query: string, context: string[], progress_callback?: ProgressCallback): Promise<string> {
    const generator = await AnswerPipeline.getInstance(progress_callback);

    // Construct the prompt for the model
    const prompt = `
      Based on the following context, please answer the user's question.
      If the context does not contain the answer, state that you don't know.

      Context:
      ${context.join('\n---\n')}

      Question:
      ${query}

      Answer:
    `;

    // Generate the answer
    const result = await generator(prompt, {
      max_new_tokens: 200,
      temperature: 0.1,
      do_sample: false,
    });

    // @ts-expect-error The `generated_text` property is not included in the base type.
    return result[0].generated_text;
  }
}
