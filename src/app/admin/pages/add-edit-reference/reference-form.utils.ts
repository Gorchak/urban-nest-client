import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ReferenceType } from '../../../core/models/reference.model';
import { ReferenceOptionFormData } from './reference-form.types';

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isOptionsType(type: ReferenceType): boolean {
  return ['select', 'multiselect', 'color'].includes(type);
}

export function isNumericType(type: ReferenceType): boolean {
  return ['number', 'decimal'].includes(type);
}

export function isStringType(type: ReferenceType): boolean {
  return ['string', 'text'].includes(type);
}

export function parseTextareaOptions(text: string): ReferenceOptionFormData[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => ({
      id: null,
      label: line,
      value: generateSlug(line) || line.toLowerCase(),
      colorHex: null,
      sortOrder: index,
      isActive: true,
    }));
}

export function kebabCaseValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    const valid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
    return valid ? null : { kebabCase: true };
  };
}

export function regexPatternValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    try {
      new RegExp(value);
      return null;
    } catch {
      return { invalidRegex: true };
    }
  };
}
