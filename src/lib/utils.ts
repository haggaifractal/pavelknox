import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseMarkdown(text: string): string {
  if (!text) return '';
  return text
      .replace(/^#### (.*$)/gim, '<h4 class="text-sm font-bold mt-2 mb-1 pt-1">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="text-md font-bold mt-3 mb-1 pt-2 border-b border-slate-200 dark:border-zinc-700">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-4 mb-2 pt-2 border-b border-slate-200 dark:border-zinc-700">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-5 mb-2">$1</h1>')
      .replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-2 hover:text-indigo-800">$1</a>')
      .replace(/\n- /g, '<br/>&bull; ')
      .replace(/\n/g, '<br/>');
}

export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
      .replace(/### |## |# /g, '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Just keep link text
      .replace(/\n- /g, ' ')
      .replace(/\n/g, ' ');
}
