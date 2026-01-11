import { pipeline, type Pipeline } from '@huggingface/transformers';

type ProgressCallback = (progress: number) => void;

// Define a singleton class for the answer generation pipeline
class AnswerPipeline {
  static task = 'text2text-generation';
  static model = 'Xenova/flan-t5-small';
  static instance: Pipeline | null = null;

  static async getInstance(progress_callback?: ProgressCallback) {
    if (this.instance === null) {
       this.instance = await (pipeline as any)(this.task as any, this.model, { progress_callback });
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

    // Construct the Chain-of-Thought prompt
    const prompt = `
      Based on the following context, please reason step-by-step to answer the user's question.

      Context:
      ---
      ${context.join('\n---\n')}
      ---

      Question:
      ${query}

      Reasoning:
    `;

    // Generate the answer
    const result = await (generator as any)(prompt, {
      max_new_tokens: 300,
      temperature: 0.1,
      do_sample: false,
    });

    const rawResult = result[0].generated_text;
    return this.parseFinalAnswer(rawResult);
  }

  /**
   * Parses the model's output to extract the final answer.
   * @param rawResult The full output from the model, including reasoning.
   * @returns The extracted final answer.
   */
  private static parseFinalAnswer(rawResult: string): string {
    const finalAnswerMarker = 'Final Answer:';
    const finalAnswerIndex = rawResult.indexOf(finalAnswerMarker);

    if (finalAnswerIndex !== -1) {
      return rawResult.substring(finalAnswerIndex + finalAnswerMarker.length).trim();
    }
    
    // Fallback if the model doesn't follow the format perfectly
    return rawResult.trim();
  }
}
