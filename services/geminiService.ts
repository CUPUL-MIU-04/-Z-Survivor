import { GoogleGenAI } from "@google/genai";
import { GameStats } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMissionReport = async (stats: GameStats): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      You are a military AI creating a post-mortem tactical report for a fallen soldier in a zombie apocalypse.
      
      Here are the soldier's final stats:
      - Score: ${stats.score}
      - Wave Reached: ${stats.wave}
      - Zombies Eliminated: ${stats.kills}
      - Survival Time: ${Math.floor(stats.timeSurvived)} seconds
      - Accuracy: ${Math.floor((stats.shotsHit / (stats.shotsFired || 1)) * 100)}%

      Write a short, atmospheric paragraph (max 3 sentences) summarizing their performance. 
      If they did well (high score/wave), commend their valor. 
      If they died quickly, be cynical or cold about their lack of survival skills.
      End with a status: "MIA", "KIA", or "LEGEND".
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Connection to HQ lost... Report unavailable.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Tactical uplink failure. Unable to retrieve mission report.";
  }
};

export const generateBossTaunt = async (wave: number): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `
      Generate a very short, scary, screen-glitch text (max 10 words) announcing a new wave of zombies (Wave ${wave}). 
      Make it sound like an intercepted radio signal or a biological warning system.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || `WARNING: WAVE ${wave} APPROACHING`;
  } catch (error) {
    return `WAVE ${wave} IMMINENT`;
  }
};
