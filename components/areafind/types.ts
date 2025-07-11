export interface SpaceType {
  name: string;
  defaultArea: number;
  description?: string;
  isCustom?: boolean; // Add this optional property
}

export interface SelectedSpace {
  type: SpaceType;
  customArea: number;
  id: string;
}