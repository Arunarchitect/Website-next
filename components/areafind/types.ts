export interface SpaceType {
  name: string;
  defaultArea: number;
  description?: string;
}

export interface SelectedSpace {
  type: SpaceType;
  customArea: number;
  id: string;
}