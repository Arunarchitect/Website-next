// Demo data layer — replace with RTK Query hitting Django (IFC/BIM asset registry) later.

export type Role = "client" | "architect";

export type IFCCategory = {
  id: string;
  label: string;          // Category (IfcClass), e.g. IfcSanitaryTerminal
  ifcClass: string;
};

export type ProductItem = {
  id: string;
  categoryId: string;
  label: string;          // Item, e.g. "Wall-hung Washbasin"
  predefinedType: string; // IfcTypeObject / PredefinedType
  manufacturer: string;
  model: string;
  productLink?: string;
  imageUrl: string;       // link for now, S3/media later
};

export type Project = { id: string; name: string };

export type Space = {
  id: string;
  projectId: string;
  name: string;                    // IfcSpace.LongName
  requiredCategoryIds: string[];   // architect-defined: categories this space needs a product for
};

export type AssignmentStatus = "pending" | "confirmed";

export type Assignment = {
  id: string;
  projectId: string;
  spaceId: string;
  itemId: string;
  proposedBy: Role;
  clientConfirmed: boolean;
  architectConfirmed: boolean;
  createdAt: string; // ISO-8601
};

export const PROJECTS: Project[] = [
  { id: "proj-1", name: "Villa Fernandez, Kollam" },
  { id: "proj-2", name: "Marine View Apartments, Kochi" },
  { id: "proj-3", name: "Backwater Retreat, Alappuzha" },
];

export const CATEGORIES: IFCCategory[] = [
  { id: "cat-sanitary", label: "Sanitary Terminal", ifcClass: "IfcSanitaryTerminal" },
  { id: "cat-furnishing", label: "Furnishing Element", ifcClass: "IfcFurnishingElement" },
  { id: "cat-flow", label: "Flow Terminal", ifcClass: "IfcFlowTerminal" },
  { id: "cat-lighting", label: "Lighting Fixture", ifcClass: "IfcLightFixture" },
  { id: "cat-covering", label: "Covering", ifcClass: "IfcCovering" },
];

export const SPACES: Space[] = [
  // Villa Fernandez
  {
    id: "space-1",
    projectId: "proj-1",
    name: "Master Bathroom",
    requiredCategoryIds: ["cat-sanitary", "cat-flow", "cat-lighting", "cat-covering"],
  },
  {
    id: "space-2",
    projectId: "proj-1",
    name: "Kitchen",
    requiredCategoryIds: ["cat-furnishing", "cat-flow", "cat-sanitary", "cat-lighting"],
  },
  {
    id: "space-3",
    projectId: "proj-1",
    name: "Guest Bathroom",
    requiredCategoryIds: ["cat-sanitary", "cat-flow", "cat-lighting"],
  },
  {
    id: "space-4",
    projectId: "proj-1",
    name: "Utility Room",
    requiredCategoryIds: ["cat-sanitary", "cat-flow"],
  },
  {
    id: "space-5",
    projectId: "proj-1",
    name: "Living Room",
    requiredCategoryIds: ["cat-lighting", "cat-covering", "cat-furnishing"],
  },
  // Marine View Apartments
  {
    id: "space-6",
    projectId: "proj-2",
    name: "Common Washroom - 3F",
    requiredCategoryIds: ["cat-sanitary", "cat-flow", "cat-lighting"],
  },
  {
    id: "space-7",
    projectId: "proj-2",
    name: "Lobby",
    requiredCategoryIds: ["cat-lighting", "cat-covering"],
  },
  {
    id: "space-8",
    projectId: "proj-2",
    name: "Kitchenette - 3F",
    requiredCategoryIds: ["cat-furnishing", "cat-flow", "cat-sanitary"],
  },
  // Backwater Retreat
  {
    id: "space-9",
    projectId: "proj-3",
    name: "Master Bathroom",
    requiredCategoryIds: ["cat-sanitary", "cat-flow", "cat-lighting", "cat-covering"],
  },
  {
    id: "space-10",
    projectId: "proj-3",
    name: "Outdoor Kitchen",
    requiredCategoryIds: ["cat-furnishing", "cat-flow"],
  },
  {
    id: "space-11",
    projectId: "proj-3",
    name: "Pool Deck Washroom",
    requiredCategoryIds: ["cat-sanitary", "cat-flow"],
  },
];

export const ITEMS: ProductItem[] = [
  // Sanitary Terminal
  {
    id: "item-1",
    categoryId: "cat-sanitary",
    label: "Wall-hung Washbasin",
    predefinedType: "WASHBASIN",
    manufacturer: "Kohler",
    model: "K-2331IN",
    productLink: "https://www.kohler.com",
    imageUrl: "https://picsum.photos/seed/washbasin/400/300",
  },
  {
    id: "item-2",
    categoryId: "cat-sanitary",
    label: "One-piece WC",
    predefinedType: "TOILETPAN",
    manufacturer: "Jaquar",
    model: "CNS-WHT-31111PR",
    productLink: "https://jaquar.com",
    imageUrl: "https://picsum.photos/seed/wc/400/300",
  },
  {
    id: "item-5",
    categoryId: "cat-sanitary",
    label: "Freestanding Bathtub",
    predefinedType: "BATH",
    manufacturer: "Duravit",
    model: "Cape Cod 700434",
    productLink: "https://duravit.com",
    imageUrl: "https://picsum.photos/seed/bathtub/400/300",
  },
  {
    id: "item-6",
    categoryId: "cat-sanitary",
    label: "Undermount Kitchen Sink",
    predefinedType: "SINK",
    manufacturer: "Franke",
    model: "Maris MRX 210",
    productLink: "https://franke.com",
    imageUrl: "https://picsum.photos/seed/ksink/400/300",
  },
  {
    id: "item-7",
    categoryId: "cat-sanitary",
    label: "Wall-mounted Urinal",
    predefinedType: "URINAL",
    manufacturer: "Roca",
    model: "Site A34177",
    productLink: "https://roca.com",
    imageUrl: "https://picsum.photos/seed/urinal/400/300",
  },

  // Furnishing Element
  {
    id: "item-3",
    categoryId: "cat-furnishing",
    label: "Modular Base Cabinet",
    predefinedType: "SYSTEMFURNITURE",
    manufacturer: "Hettich",
    model: "MX-BC-600",
    productLink: "https://hettich.com",
    imageUrl: "https://picsum.photos/seed/cabinet/400/300",
  },
  {
    id: "item-8",
    categoryId: "cat-furnishing",
    label: "Vanity Unit with Mirror",
    predefinedType: "USERDEFINED",
    manufacturer: "Godrej Interio",
    model: "Vanora VU-450",
    productLink: "https://godrejinterio.com",
    imageUrl: "https://picsum.photos/seed/vanity/400/300",
  },
  {
    id: "item-9",
    categoryId: "cat-furnishing",
    label: "Walk-in Wardrobe System",
    predefinedType: "SYSTEMFURNITURE",
    manufacturer: "Hafele",
    model: "Fitin WK-820",
    productLink: "https://hafele.com",
    imageUrl: "https://picsum.photos/seed/wardrobe/400/300",
  },
  {
    id: "item-10",
    categoryId: "cat-furnishing",
    label: "Kitchen Island Counter",
    predefinedType: "USERDEFINED",
    manufacturer: "Sleek Kitchens",
    model: "Island Pro 3000",
    productLink: "https://sleekkitchens.com",
    imageUrl: "https://picsum.photos/seed/island/400/300",
  },

  // Flow Terminal
  {
    id: "item-4",
    categoryId: "cat-flow",
    label: "Single Lever Basin Mixer",
    predefinedType: "FAUCET",
    manufacturer: "Grohe",
    model: "Eurosmart 23323",
    productLink: "https://grohe.com",
    imageUrl: "https://picsum.photos/seed/mixer/400/300",
  },
  {
    id: "item-11",
    categoryId: "cat-flow",
    label: "Rain Shower Head",
    predefinedType: "SHOWERHEAD",
    manufacturer: "Hansgrohe",
    model: "Raindance E 300",
    productLink: "https://hansgrohe.com",
    imageUrl: "https://picsum.photos/seed/shower/400/300",
  },
  {
    id: "item-12",
    categoryId: "cat-flow",
    label: "Pull-down Kitchen Faucet",
    predefinedType: "FAUCET",
    manufacturer: "Jaquar",
    model: "Florentine FLR-CHR",
    productLink: "https://jaquar.com",
    imageUrl: "https://picsum.photos/seed/kfaucet/400/300",
  },
  {
    id: "item-13",
    categoryId: "cat-flow",
    label: "Angle Valve",
    predefinedType: "VALVE",
    manufacturer: "Kerovit",
    model: "Simmer KA-411",
    productLink: "https://kerovit.com",
    imageUrl: "https://picsum.photos/seed/valve/400/300",
  },

  // Lighting Fixture
  {
    id: "item-14",
    categoryId: "cat-lighting",
    label: "Recessed Ceiling Downlight",
    predefinedType: "USERDEFINED",
    manufacturer: "Philips",
    model: "CoreLine DN130B",
    productLink: "https://philips.com",
    imageUrl: "https://picsum.photos/seed/downlight/400/300",
  },
  {
    id: "item-15",
    categoryId: "cat-lighting",
    label: "Pendant Light",
    predefinedType: "PENDANTLUMINAIRE",
    manufacturer: "Wipro",
    model: "Luma P-220",
    productLink: "https://wiprolighting.com",
    imageUrl: "https://picsum.photos/seed/pendant/400/300",
  },
  {
    id: "item-16",
    categoryId: "cat-lighting",
    label: "LED Strip Cove Light",
    predefinedType: "STRIPLIGHT",
    manufacturer: "Havells",
    model: "Glow Strip GS-500",
    productLink: "https://havells.com",
    imageUrl: "https://picsum.photos/seed/covelight/400/300",
  },

  // Covering
  {
    id: "item-17",
    categoryId: "cat-covering",
    label: "Vitrified Floor Tile",
    predefinedType: "FLOORING",
    manufacturer: "Kajaria",
    model: "Marbelo 800x800",
    productLink: "https://kajariaceramics.com",
    imageUrl: "https://picsum.photos/seed/floortile/400/300",
  },
  {
    id: "item-18",
    categoryId: "cat-covering",
    label: "Textured Wall Cladding",
    predefinedType: "CLADDING",
    manufacturer: "Asian Paints",
    model: "Royale Play Stone",
    productLink: "https://asianpaints.com",
    imageUrl: "https://picsum.photos/seed/cladding/400/300",
  },
  {
    id: "item-19",
    categoryId: "cat-covering",
    label: "False Ceiling Panel",
    predefinedType: "CEILING",
    manufacturer: "Saint-Gobain Gyproc",
    model: "Gyproc Plus 12mm",
    productLink: "https://gyproc.co.in",
    imageUrl: "https://picsum.photos/seed/ceiling/400/300",
  },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: "asg-1",
    projectId: "proj-1",
    spaceId: "space-1",
    itemId: "item-4",
    proposedBy: "architect",
    clientConfirmed: false,
    architectConfirmed: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "asg-2",
    projectId: "proj-1",
    spaceId: "space-1",
    itemId: "item-11",
    proposedBy: "client",
    clientConfirmed: true,
    architectConfirmed: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "asg-3",
    projectId: "proj-2",
    spaceId: "space-6",
    itemId: "item-2",
    proposedBy: "architect",
    clientConfirmed: false,
    architectConfirmed: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "asg-4",
    projectId: "proj-3",
    spaceId: "space-9",
    itemId: "item-2",
    proposedBy: "architect",
    clientConfirmed: true,
    architectConfirmed: true,
    createdAt: new Date().toISOString(),
  },
];