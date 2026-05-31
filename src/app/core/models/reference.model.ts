export type ReferenceType =
  | 'string'
  | 'text'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'color'
  | 'date'
  | 'json';

export type ReferenceValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | null;

export interface ReferenceOption {
  id: string;
  label: string;
  value: string;
  colorHex: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ReferenceDefinition {
  _id: string;
  name: string;
  slug: string;
  description: string | null;
  type: ReferenceType;
  isRequired: boolean;
  isFilterable: boolean;
  isVariant: boolean;
  isStockTrackable: boolean;
  isActive: boolean;
  placeholder: string | null;
  helperText: string | null;
  icon: string | null;
  unit: string | null;
  min: number | null;
  max: number | null;
  minLength: number | null;
  maxLength: number | null;
  regex: string | null;
  defaultValue: ReferenceValue;
  options: ReferenceOption[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReferenceDto {
  name: string;
  slug: string;
  description: string | null;
  type: ReferenceType;
  isRequired: boolean;
  isFilterable: boolean;
  isVariant: boolean;
  isStockTrackable: boolean;
  isActive: boolean;
  placeholder: string | null;
  helperText: string | null;
  icon: string | null;
  unit: string | null;
  min: number | null;
  max: number | null;
  minLength: number | null;
  maxLength: number | null;
  regex: string | null;
  defaultValue: ReferenceValue;
  options: Omit<ReferenceOption, 'id'>[];
  sortOrder: number;
}

export type UpdateReferenceDto = Partial<CreateReferenceDto>;
