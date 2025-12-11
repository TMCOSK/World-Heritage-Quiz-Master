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

// Internal list of diverse themes to prevent duplication and ensure variety
const RANDOM_THEMES = [
  "European Gothic Architecture", "Japanese Buddhist Temples", "Silk Road Sites", 
  "Biodiversity in Amazon", "Industrial Revolution Sites", "Roman Empire Heritage",
  "Mayan Civilization", "Modern Architecture (Le Corbusier/Frank Lloyd Wright)", 
  "Marine World Heritage", "African National Parks", "Chinese Imperial Palaces",
  "Prehistoric Cave Paintings", "Islamic Architecture in Spain", "Renaissance Art & Cities",
  "Volcanic Landscapes", "Island Ecosystems (Galapagos/Ogasawara)", "Wooden Churches",
  "Cultural Landscapes of Vineyards", "Fortifications and Castles", "Ancient Greek Sites"
];

const getRandomTheme = () => {
  const idx = Math.floor(Math.random() * RANDOM_THEMES.length);
  return RANDOM_THEMES[idx];
};

// Helper for delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateQuizBatch = async (config: GeneratorConfig, apiKey: string): Promise<QuizItem[]> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash"; 

  // If user didn't specify a topic, inject a random one to ensure variety
  const autoTopic = config.focusTopic ? config.focusTopic : getRandomTheme();
  
  const prompt = `
    Create ${config.count} multiple-choice questions for the "World Heritage Certification" (世界遺産検定) at level ${config.level}.
    
    Context:
    - Target audience: Japanese speakers studying for the exam.
    - **CRITICAL REQUIREMENT**: The questions MUST focus on the specific theme: "${autoTopic}".
    - Mix of content: Use a balance of basic facts (official name, location, criteria) and specific details (history, architecture, nature).
    - Style: Similar to actual past exam questions but with original phrasing.
    
    Requirements:
    - Output strictly in JSON format matching the schema.
    - valid Wikipedia links (Japanese).
    - "correct_idx" must be 0, 1, 2, or 3.
    - Ensure questions are unique and not generic "What is a World Heritage site?" questions.
  `;

  let lastError: any = null;
  // Increase retries to handle long wait times (e.g., 21s) better
  const maxRetries = 5;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Default backoff: 2s, 4s, 8s, 16s, 32s
        let waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        
        // SMART RETRY: Check if the last error told us specifically how long to wait
        // Pattern: "Please retry in 21.487686333s"
        if (lastError && lastError.message) {
          const match = lastError.message.match(/retry in ([\d\.]+)s/);
          if (match && match[1]) {
            const serverWaitSeconds = parseFloat(match[1]);
            // Wait the requested time + 1 second buffer
            waitTime = (serverWaitSeconds * 1000) + 1000;
            console.log(`Server requested wait: ${serverWaitSeconds}s. Sleeping for ${Math.round(waitTime)}ms`);
          }
        }
        
        console.log(`Retry attempt ${attempt}. Waiting ${Math.round(waitTime)}ms`);
        await sleep(waitTime);
      }

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
      if (!text) {
        throw new Error("No content generated.");
      }

      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let rawData;
      try {
        rawData = JSON.parse(cleanText);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Text:", text);
        throw new Error("AI response was not valid JSON.");
      }
      
      if (!Array.isArray(rawData)) {
        throw new Error("AI response format error: expected an array.");
      }

      return rawData.map((item: any) => ({
        ...item,
        id: generateId(),
      }));

    } catch (error: any) {
      console.warn(`Gemini generation attempt ${attempt + 1} failed:`, error);
      lastError = error;

      // Check if error is retryable
      const isRetryable = 
        error.message?.includes('503') || 
        error.message?.includes('overloaded') ||
        error.message?.includes('429') ||
        error.message?.includes('quota') ||
        error.status === 503 ||
        error.code === 503 ||
        error.status === 429 ||
        error.code === 429;

      if (isRetryable && attempt < maxRetries) {
        continue; // Try again
      }
      
      if (!isRetryable) {
         break;
      }
    }
  }

  throw lastError || new Error("Failed to generate quiz questions after multiple attempts.");
};