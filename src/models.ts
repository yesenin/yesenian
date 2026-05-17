import { int } from "zod";

export interface Word {
  id: string;
  ru: string;
  language: string;
  translations: Translation[];
  tags?: string[];
  initForm?: boolean;
  kind: string;
  draft?: boolean;
  source: string;
  addedAt: string;
  modifiedAt: string;
}

export interface Translation {
  id: string;
  variant: string;
  value: string;
}

export interface Tag {
  id: string;
  key: string;
  value: string;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}
