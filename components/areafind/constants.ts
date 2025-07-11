import { SpaceType } from "./types";

export const spaceTypes: SpaceType[] = [
  { name: "Living Room", defaultArea: 200 },
  { name: "Bedroom", defaultArea: 150 },
  { name: "Kitchen", defaultArea: 100 },
  { name: "Bathroom", defaultArea: 50 },
  { name: "Dining Room", defaultArea: 120 },
  { name: "Home Office", defaultArea: 80 },
  { name: "Guest Room", defaultArea: 180 },
  { name: "Dressing Space", defaultArea: 75 },
  { name: "Car Porch", defaultArea: 320 },
  { name: "Custom Space", defaultArea: 50, isCustom: true } // Added custom space
];