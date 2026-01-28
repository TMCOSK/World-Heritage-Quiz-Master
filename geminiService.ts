import { GoogleGenAI, Type, Schema } from "@google/genai";
import { QuizItem, GeneratorConfig } from './types';
import { generateId } from './utils';

const quizSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      level: { type: Type.STRING, description: "The certification level (e.g., 3級, 2級, 準1級, 1級)" },
      question: { type: Type.STRING, description: "The quiz question text." },
      option1: { type: Type.STRING, description: "Choice 1" },
      option2: { type: Type.STRING, description: "Choice 2" },
      option3: { type: Type.STRING, description: "Choice 3" },
      option4: { type: Type.STRING, description: "Choice 4" },
      correct_idx: { type: Type.INTEGER, description: "Index of the correct answer (0-3)" },
      explanation: { type: Type.STRING, description: "Basic explanation of the answer." },
      advanced_explanation: { type: Type.STRING, description: "Detailed advanced trivia or historical context." },
      wiki_link: { type: Type.STRING, description: "A relevant Wikipedia URL (Japanese)." },
      is_japan: { type: Type.BOOLEAN, description: "True if the heritage site is in Japan." },
    },
    required: ["level", "question", "option1", "option2", "option3", "option4", "correct_idx", "explanation", "advanced_explanation", "wiki_link", "is_japan"],
  },
};

const RANDOM_THEMES = [
  "European Gothic Architecture", "Japanese Buddhist Temples", "Silk Road Sites", 
  "Biodiversity in Amazon", "Industrial Revolution Sites", "Roman Empire Heritage",
  "Mayan Civilization", "Modern Architecture", "Marine World Heritage", "African National Parks"
];

const getRandomTheme = () => RANDOM_THEMES[Math.floor(Math.random() * RANDOM_THEMES.length)];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateQuizBatch = async (config: GeneratorConfig, apiKey: string): Promise<QuizItem[]> => {
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  // Use gemini-flash-lite-latest as it has the highest RPM (10) in user's quota.
  const model = "gemini-flash-lite-latest"; 

  const autoTopic = config.focusTopic || getRandomTheme();
  
  const prompt = `世界遺産検定 ${config.level} の問題を ${config.count} 問作成してください。テーマ: ${autoTopic}。日本語で、正確な解説とWikipediaリンクを含めてください。`;

  let lastError: any = null;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) await sleep(5000 * attempt);

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: quizSchema,
          temperature: 0.7, 
        },
      });

      const text = response.text;
      if (!text) throw new Error("No content generated.");

      const rawData = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      
      return rawData.map((item: any) => ({
        ...item,
        id: generateId(),
      }));

    } catch (error: any) {
      console.warn(`Attempt ${attempt + 1} failed:`, error);
      lastError = error;
      if (!error.message?.includes('429') && !error.message?.includes('503')) break;
    }
  }

  throw lastError || new Error("Failed to generate quiz questions.");
};