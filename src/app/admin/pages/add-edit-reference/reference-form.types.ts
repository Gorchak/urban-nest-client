import { ReferenceType } from '../../../core/models/reference.model';

export interface ReferenceOptionFormData {
  id: string | null;
  label: string;
  value: string;
  colorHex: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ReferenceDefinitionFormData {
  name: string;
  slug: string;
  description: string;
  type: ReferenceType;
  isRequired: boolean;
  isFilterable: boolean;
  isVariant: boolean;
  isActive: boolean;
  placeholder: string;
  helperText: string;
  unit: string;
  min: number | null;
  max: number | null;
  minLength: number | null;
  maxLength: number | null;
  regex: string;
  defaultValue: string;
  sortOrder: number;
  options: ReferenceOptionFormData[];
}

export interface ReferenceTypeOption {
  label: string;
  value: ReferenceType;
  icon: string;
  description: string;
}
