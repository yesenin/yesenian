export interface Word {
  id: string;
  ru: string;
  language: string;
  translations: Translation[];
  tags?: Tag[];
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
