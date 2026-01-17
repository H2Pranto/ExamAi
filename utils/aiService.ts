
import { GoogleGenAI } from "@google/genai";
import { AIConfig } from "../types";

export interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface Message {
  role: 'user' | 'model' | 'system';
  parts: ContentPart[];
}

export const generateAIResponse = async (
  config: AIConfig,
  messages: Message[],
  systemInstruction?: string
): Promise<string> => {
  
  // 1. Google Gemini Provider
  if (config.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    
    // Map 'model' role to 'model' (Gemini SDK expects 'user' or 'model')
    // Ensure system instruction is handled via config if present
    const contents = messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role, // Gemini doesn't use 'system' role in contents usually, strictly user/model
      parts: m.parts
    }));
    
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    
    return response.text || "";
  } 
  
  // 2. OpenAI / Custom / Local / Open Source Provider
  else {
    const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    const endpoint = `${baseUrl}/chat/completions`;
    
    // Some local providers (like Ollama) might not require a key, but fetch might complain with empty header
    // or the server might expect *some* string. We default to 'dummy' if empty for custom types.
    const safeKey = config.apiKey || 'dummy-key'; 

    const openAIMessages = [];

    // Add System Instruction
    if (systemInstruction) {
      openAIMessages.push({ role: 'system', content: systemInstruction });
    }

    // Convert Messages
    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : (msg.role === 'system' ? 'system' : 'user');
      
      const content = msg.parts.map(part => {
        if (part.text) {
          return { type: 'text', text: part.text };
        }
        if (part.inlineData) {
          // Convert base64 to data URI
          return {
            type: 'image_url',
            image_url: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
            }
          };
        }
        return null;
      }).filter(Boolean);

      // If content is just text, send as string (better compatibility for some local models)
      if (content.length === 1 && content[0]?.type === 'text') {
        openAIMessages.push({ role, content: content[0].text });
      } else {
        openAIMessages.push({ role, content });
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${safeKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: openAIMessages,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API Error (${response.status}): ${err.slice(0, 200)}...`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
};

export const validateConnection = async (config: AIConfig): Promise<boolean> => {
  try {
    const testMsg: Message[] = [{ role: 'user', parts: [{ text: 'Hello, are you online? Reply with yes.' }] }];
    await generateAIResponse(config, testMsg);
    return true;
  } catch (e) {
    console.error("Validation failed:", e);
    return false;
  }
};
