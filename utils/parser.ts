
import { Question } from '../types';

export const extractExamName = (rawText: string): string | null => {
  if (!rawText) return null;
  const match = rawText.match(/^\s*\*\*\*(.+?)\*\*\*/);
  return match ? match[1].trim() : null;
};

export const parseQuestions = (rawText: string): Question[] => {
  if (!rawText) return [];
  
  // Remove the exam name header line if present so it doesn't get parsed as a question
  const cleanText = rawText.replace(/^\s*\*\*\*.+?\*\*\*\s*/, '');

  const blocks = cleanText.split('###').map(b => b.trim()).filter(b => b !== "");
  
  const parsed = blocks.map((block, index): Question | null => {
    // Format: Question | Opt1 | Opt2 | Opt3 | Opt4 | CorrectAnswer
    const parts = block.split('|').map(s => s.trim());
    
    if (parts.length < 6) return null;

    return {
      id: `q-${index}-${Date.now()}`,
      originalIndex: index,
      q: parts[0],
      opt: {
        'ক': parts[1],
        'খ': parts[2],
        'গ': parts[3],
        'ঘ': parts[4]
      },
      a: parts[5]
    };
  }).filter((q): q is Question => q !== null);

  return parsed;
};

export const generateBackupFilename = (examName: string | null | undefined): string => {
  const name = (examName || "Session").replace(/[^a-z0-9\u0980-\u09FF-_]/gi, '_');
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `ExamAi_${name}_${date}_${time}.json`;
};
