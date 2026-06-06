import { invokeAppendErrorLog } from '@/lib/ipc';

function formatEntry(source: string, message: string, details?: string): string {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  let entry = `\n## ${ts} — ${source}\n\n**Message:** ${message}\n`;
  if (details) {
    entry += `\n**Details:**\n\`\`\`\n${details}\n\`\`\`\n`;
  }
  entry += '\n---';
  return entry;
}

export function logError(source: string, message: string, details?: string): void {
  void invokeAppendErrorLog(formatEntry(source, message, details));
}
