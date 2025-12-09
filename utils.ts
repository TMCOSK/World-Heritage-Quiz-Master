import { QuizItem } from './types';

export const CSV_HEADER = "level,question,option1,option2,option3,option4,correct_idx,explanation,advanced_explanation,wiki_link,is_japan";

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

// Check if a question text already exists in the current items
export const isDuplicate = (newQuestion: string, existingItems: QuizItem[]): boolean => {
  // Normalize string for comparison (trim spaces)
  const normalizedNew = newQuestion.trim();
  return existingItems.some(item => item.question.trim() === normalizedNew);
};

// Fisher-Yates shuffle algorithm
export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const parseCSV = (csvText: string): QuizItem[] => {
  const lines = csvText.trim().split('\n');
  const items: QuizItem[] = [];
  
  // Skip header if present
  const startIndex = lines[0].startsWith('level,question') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    // Simple CSV parser handling standard comma separation. 
    // Note: This basic parser assumes no commas inside the fields for simplicity. 
    
    const row = lines[i].split(','); 
    
    if (row.length >= 11) {
      items.push({
        id: generateId(),
        level: row[0],
        question: row[1],
        option1: row[2],
        option2: row[3],
        option3: row[4],
        option4: row[5],
        correct_idx: parseInt(row[6], 10),
        explanation: row[7],
        advanced_explanation: row[8],
        wiki_link: row[9],
        is_japan: row[10].toUpperCase() === 'TRUE',
      });
    }
  }
  return items;
};

export const toCSV = (items: QuizItem[]): string => {
  const rows = items.map(item => {
    // Escape commas in text fields if necessary (simplified)
    const clean = (str: string) => `"${str.replace(/"/g, '""')}"`;
    
    return [
      item.level,
      clean(item.question),
      clean(item.option1),
      clean(item.option2),
      clean(item.option3),
      clean(item.option4),
      item.correct_idx,
      clean(item.explanation),
      clean(item.advanced_explanation),
      item.wiki_link,
      item.is_japan ? 'TRUE' : 'FALSE'
    ].join(',');
  });

  return [CSV_HEADER, ...rows].join('\n');
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};