
import { GoogleGenAI, Type } from "@google/genai";
import { Case, LevelInfo } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

function cleanJson(text: string | undefined): string {
  if (!text) return '{}';
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

export const generateLevelCase = async (level: LevelInfo): Promise<Case> => {
  const ai = getAI();
  const prompt = `Generate a realistic crime case for Level ${level.id}: ${level.title} (${level.crimeType}). 
  Include a victim, backstory, 3 suspects (one guilty), and 3 rooms. 
  Each room has 1 piece of evidence. 
  Each piece of evidence MUST specify a 'requiredTool' from: GLOVES, TORCH, UV_LIGHT, EVIDENCE_BAG, RECORDER, CYBER_KIT.
  Also provide 'hotspots' (x and y coordinates from 10 to 90) for where the clue is hidden in the room.
  Ensure the Indian legal atmosphere is preserved.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          victim: { type: Type.STRING },
          backstory: { type: Type.STRING },
          legalSections: { type: Type.ARRAY, items: { type: Type.STRING } },
          suspects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                motive: { type: Type.STRING },
                alibi: { type: Type.STRING },
                isGuilty: { type: Type.BOOLEAN }
              }
            }
          },
          rooms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                hotspots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      label: { type: Type.STRING }
                    }
                  }
                },
                clue: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING },
                    strength: { type: Type.NUMBER },
                    isLegal: { type: Type.BOOLEAN },
                    requiredTool: { type: Type.STRING }
                  }
                }
              }
            }
          }
        },
        required: ["title", "victim", "backstory", "suspects", "rooms", "legalSections"]
      }
    }
  });

  return JSON.parse(cleanJson(response.text));
};

export const generateSceneImage = async (caseTitle: string, roomDescription: string): Promise<string> => {
  const ai = getAI();
  const prompt = `Realistic photograph of a crime scene in an Indian environment: ${roomDescription}. 
  Atmospheric, gritty, forensic markers, cinematic shadows. ${caseTitle}. High resolution.`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (err) {}
  return '';
};

export const calculateVerdict = async (caseData: Case, evidenceFound: any[], integrity: number): Promise<any> => {
  const ai = getAI();
  const prompt = `Acting as a Judge, give a final verdict for: ${caseData.title}. 
  Evidence: ${JSON.stringify(evidenceFound)}. Integrity: ${integrity}/100.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          outcome: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          legalAccuracy: { type: Type.NUMBER }
        },
        required: ["outcome", "reasoning", "legalAccuracy"]
      }
    }
  });
  return JSON.parse(cleanJson(response.text));
};
