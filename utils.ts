
import { QuizItem } from './types';

export const CSV_HEADER = "level,question,option1,option2,option3,option4,correct_idx,explanation,advanced_explanation,wiki_link,is_japan";

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const isDuplicate = (newQuestion: string, existingItems: QuizItem[]): boolean => {
  const normalizedNew = newQuestion.trim();
  return existingItems.some(item => item.question.trim() === normalizedNew);
};

export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const parseCSV = (csvText: string): QuizItem[] => {
  const items: QuizItem[] = [];
  const lines = csvText.trim().split(/\r?\n/);
  const startIndex = lines[0].toLowerCase().includes('level,question') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const row: string[] = [];
    let curValue = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j+1] === '"') {
          curValue += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(curValue);
        curValue = "";
      } else {
        curValue += char;
      }
    }
    row.push(curValue);
    if (row.length >= 11) {
      items.push({
        id: generateId(),
        level: row[0].trim(),
        question: row[1].trim(),
        option1: row[2].trim(),
        option2: row[3].trim(),
        option3: row[4].trim(),
        option4: row[5].trim(),
        correct_idx: parseInt(row[6], 10) || 0,
        explanation: row[7].trim(),
        advanced_explanation: row[8].trim(),
        wiki_link: row[9].trim(),
        is_japan: row[10].trim().toUpperCase() === 'TRUE',
      });
    }
  }
  return items;
};

export const toCSV = (items: QuizItem[]): string => {
  const rows = items.map(item => {
    const clean = (val: any) => {
      const str = String(val ?? "");
      return `"${str.replace(/"/g, '""')}"`;
    };
    return [
      clean(item.level),
      clean(item.question),
      clean(item.option1),
      clean(item.option2),
      clean(item.option3),
      clean(item.option4),
      item.correct_idx,
      clean(item.explanation),
      clean(item.advanced_explanation),
      clean(item.wiki_link),
      item.is_japan ? 'TRUE' : 'FALSE'
    ].join(',');
  });
  return [CSV_HEADER, ...rows].join('\n');
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: 'text/csv;charset=utf-8;' });
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

export const downloadJson = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
