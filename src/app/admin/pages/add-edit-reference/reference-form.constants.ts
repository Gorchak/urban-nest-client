import { ReferenceType } from '../../../core/models/reference.model';
import { ReferenceOptionFormData, ReferenceTypeOption } from './reference-form.types';

export const REFERENCE_TYPE_OPTIONS: ReferenceTypeOption[] = [
  { label: 'Рядок', value: 'string', icon: 'pi pi-font', description: 'Короткий текст' },
  { label: 'Текст', value: 'text', icon: 'pi pi-align-left', description: 'Багаторядковий текст' },
  { label: 'Число', value: 'number', icon: 'pi pi-hashtag', description: 'Ціле число' },
  { label: 'Дробове', value: 'decimal', icon: 'pi pi-calculator', description: 'Число з комою' },
  { label: 'Булеве', value: 'boolean', icon: 'pi pi-check-square', description: 'Так / Ні' },
  { label: 'Вибір (один)', value: 'select', icon: 'pi pi-list', description: 'Один варіант зі списку' },
  { label: 'Мультивибір', value: 'multiselect', icon: 'pi pi-check-square', description: 'Декілька варіантів' },
  { label: 'Колір', value: 'color', icon: 'pi pi-palette', description: 'Кольорові варіанти' },
  { label: 'Дата', value: 'date', icon: 'pi pi-calendar', description: 'Дата / час' },
  { label: 'JSON', value: 'json', icon: 'pi pi-code', description: 'JSON об\'єкт' },
];

export const REFERENCE_TYPE_LABELS: Record<string, string> = {
  string: 'Рядок',
  text: 'Текст',
  number: 'Число',
  decimal: 'Дробове',
  boolean: 'Булеве',
  select: 'Вибір',
  multiselect: 'Мультивибір',
  color: 'Колір',
  date: 'Дата',
  json: 'JSON',
};

export const OPTIONS_TYPES: ReferenceType[] = ['select', 'multiselect', 'color'];
export const NUMERIC_TYPES: ReferenceType[] = ['number', 'decimal'];
export const STRING_TYPES: ReferenceType[] = ['string', 'text'];

export const DEFAULT_COLOR_OPTIONS: ReferenceOptionFormData[] = [
  { id: null, label: 'Чорний', value: 'black', colorHex: '#000000', sortOrder: 0, isActive: true },
  { id: null, label: 'Білий', value: 'white', colorHex: '#ffffff', sortOrder: 1, isActive: true },
  { id: null, label: 'Сірий', value: 'gray', colorHex: '#9ca3af', sortOrder: 2, isActive: true },
  { id: null, label: 'Бежевий', value: 'beige', colorHex: '#f5f0dc', sortOrder: 3, isActive: true },
  { id: null, label: 'Коричневий', value: 'brown', colorHex: '#854d0e', sortOrder: 4, isActive: true },
  { id: null, label: 'Червоний', value: 'red', colorHex: '#ef4444', sortOrder: 5, isActive: true },
  { id: null, label: 'Синій', value: 'blue', colorHex: '#3b82f6', sortOrder: 6, isActive: true },
  { id: null, label: 'Зелений', value: 'green', colorHex: '#22c55e', sortOrder: 7, isActive: true },
  { id: null, label: 'Рожевий', value: 'pink', colorHex: '#ec4899', sortOrder: 8, isActive: true },
  { id: null, label: 'Жовтий', value: 'yellow', colorHex: '#eab308', sortOrder: 9, isActive: true },
  { id: null, label: 'Фіолетовий', value: 'purple', colorHex: '#a855f7', sortOrder: 10, isActive: true },
  { id: null, label: 'Помаранчевий', value: 'orange', colorHex: '#f97316', sortOrder: 11, isActive: true },
  { id: null, label: 'Срібний', value: 'silver', colorHex: '#cbd5e1', sortOrder: 12, isActive: true },
  { id: null, label: 'Золотий', value: 'gold', colorHex: '#ca8a04', sortOrder: 13, isActive: true },
  { id: null, label: 'Мультиколір', value: 'multicolor', colorHex: null, sortOrder: 14, isActive: true },
  { id: null, label: 'Прозорий', value: 'transparent', colorHex: null, sortOrder: 15, isActive: true },
];

export const DEFAULT_SIZE_OPTIONS: ReferenceOptionFormData[] = [
  { id: null, label: 'XXS', value: 'XXS', colorHex: null, sortOrder: 0, isActive: true },
  { id: null, label: 'XS', value: 'XS', colorHex: null, sortOrder: 1, isActive: true },
  { id: null, label: 'S', value: 'S', colorHex: null, sortOrder: 2, isActive: true },
  { id: null, label: 'M', value: 'M', colorHex: null, sortOrder: 3, isActive: true },
  { id: null, label: 'L', value: 'L', colorHex: null, sortOrder: 4, isActive: true },
  { id: null, label: 'XL', value: 'XL', colorHex: null, sortOrder: 5, isActive: true },
  { id: null, label: 'XXL', value: 'XXL', colorHex: null, sortOrder: 6, isActive: true },
  { id: null, label: '3XL', value: '3XL', colorHex: null, sortOrder: 7, isActive: true },
  { id: null, label: '4XL', value: '4XL', colorHex: null, sortOrder: 8, isActive: true },
];
