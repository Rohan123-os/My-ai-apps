import { GoogleGenAI, Type } from "@google/genai";
import { ComposerResponse } from "../types";

export const generateMelodyContinuation = async (
  recentNotes: string[]
): Promise<ComposerResponse | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `You are a world-class music technologist. 
    A user just played these notes on a piano: ${recentNotes.join(', ')}. 
    Generate a 4-8 note continuation of this melody that sounds professional and musically pleasing.
    Provide a brief explanation of why this continuation works well.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            melody: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'A list of 4-8 notes (e.g., ["C4", "E4", "G4"])'
            },
            explanation: {
              type: Type.STRING,
              description: 'A short explanation of the musical structure.'
            },
            musicalElements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Key characteristics used (e.g., "Counterpoint", "Resolution").'
            }
          },
          required: ['melody', 'explanation', 'musicalElements']
        }
      }
    });

    if (!response.text) return null;
    return JSON.parse(response.text) as ComposerResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};