// blogapi.ts
// Data layer for ModelBlog — types, mock data, and fetch utilities

export type AuthorRole = 'Editorial' | 'Eminent' | 'Guest' | 'Staff';

export interface Author {
  id: string;
  name: string;
  role: AuthorRole;
  title: string;
  avatarInitials: string;
  avatarColor: string;
  bio: string;
}

export interface Source {
  label: string;
  url: string;
  publisher: string;
  year?: number;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  tags: string[];
  excerpt: string;
  body: string;
  readingTimeMinutes: number;
  publishedAt: string;
  featured: boolean;
  coverAccent: string;
  authors: Author[];
  sources: Source[];
}

export interface AdUnit {
  id: string;
  company: string;
  tagline: string;
  url: string;
  accentColor: string;
  category: string;
  logoInitials: string;
}

// ─── Authors ──────────────────────────────────────────────────────────────────

export const AUTHORS: Record<string, Author> = {
  asel_nurlan: {
    id: 'asel_nurlan',
    name: 'Asel Nurlan',
    role: 'Eminent',
    title: 'Principal Architect & BIM Director, Threshold Studio',
    avatarInitials: 'AN',
    avatarColor: '#b45309',
    bio: 'Asel has led BIM implementation across 40+ projects in Central Asia and the Gulf, and lectures on computational design at the Almaty School of Architecture.',
  },
  yusuf_camara: {
    id: 'yusuf_camara',
    name: 'Yusuf Camara',
    role: 'Editorial',
    title: 'Architecture Critic & Senior Editor, ModelBlog',
    avatarInitials: 'YC',
    avatarColor: '#0e7490',
    bio: 'Yusuf writes on digital fabrication, parametric practice, and the changing tools of architectural production. Based in Dakar and London.',
  },
  dana_osei: {
    id: 'dana_osei',
    name: 'Dana Osei',
    role: 'Staff',
    title: 'Research Editor — Technology & Fabrication',
    avatarInitials: 'DO',
    avatarColor: '#4338ca',
    bio: 'Dana covers Blender, Bonsai BIM, and open-source architecture toolchains for ModelBlog. Former computational designer at Zaha Hadid Architects.',
  },
  mira_bello: {
    id: 'mira_bello',
    name: 'Mira Bello',
    role: 'Guest',
    title: 'Associate Professor of Digital Architecture, TU Delft',
    avatarInitials: 'MB',
    avatarColor: '#065f46',
    bio: 'Mira researches open-source BIM workflows, IFC data standards, and the democratisation of computational design tools.',
  },
  felix_strand: {
    id: 'felix_strand',
    name: 'Felix Strand',
    role: 'Eminent',
    title: 'Director, Centre for Computational Practice',
    avatarInitials: 'FS',
    avatarColor: '#9d174d',
    bio: 'Felix consults on BIM strategy for large infrastructure projects and is a core contributor to the IfcOpenShell open-source library.',
  },
};

// ─── Ad Units ─────────────────────────────────────────────────────────────────

export const AD_UNITS: AdUnit[] = [
  {
    id: 'ad_bonsai',
    company: 'Bonsai BIM',
    tagline: 'Full-featured BIM authoring inside Blender. Free, open-source, IFC-native.',
    url: '#',
    accentColor: '#166534',
    category: 'BIM & Software',
    logoInitials: 'BB',
  },
  {
    id: 'ad_ifcjs',
    company: 'IFC.js Cloud',
    tagline: 'Parse, query, and visualise IFC models in the browser. Built for architects and developers.',
    url: '#',
    accentColor: '#4338ca',
    category: 'BIM & Software',
    logoInitials: 'IJ',
  },
  {
    id: 'ad_cityscale',
    company: 'CityScale Analytics',
    tagline: 'Urban data intelligence for planners, architects, and policy teams. Real-time GIS insights.',
    url: '#',
    accentColor: '#0e7490',
    category: 'Urban Planning',
    logoInitials: 'CS',
  },
  {
    id: 'ad_fabricate',
    company: 'FabricateHQ',
    tagline: 'Parametric fabrication workflows from Grasshopper to CNC. End-to-end digital fabrication.',
    url: '#',
    accentColor: '#b45309',
    category: 'Digital Fabrication',
    logoInitials: 'FH',
  },
  {
    id: 'ad_archipack',
    company: 'Archipack Pro',
    tagline: 'Production-ready architectural objects for Blender. Windows, doors, stairs and more.',
    url: '#',
    accentColor: '#1e3a5f',
    category: 'Visualisation',
    logoInitials: 'AP',
  },
  {
    id: 'ad_default',
    company: 'ModelBlog Partners',
    tagline: 'Reach architects, BIM managers, and computational designers. Advertise with us.',
    url: '#',
    accentColor: '#78350f',
    category: 'All',
    logoInitials: 'MB',
  },
];

export function getAdsForPost(post: BlogPost): AdUnit[] {
  const relevant = AD_UNITS.filter((a) => a.category === post.category);
  const fallback = AD_UNITS.filter((a) => a.category === 'All');
  return [...relevant, ...fallback].slice(0, 3);
}

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 1,
    slug: 'bonsai-bim-open-source-future',
    title: 'Bonsai and the Open-Source BIM Revolution',
    subtitle: 'How a Blender add-on is challenging Revit\'s two-decade grip on architectural production',
    category: 'BIM & Software',
    tags: ['Bonsai', 'BIM', 'Blender', 'IFC', 'open-source'],
    excerpt:
      'Bonsai — formerly BlenderBIM — has matured from a proof-of-concept into a credible BIM authoring environment. Its native IFC approach challenges the proprietary file-format lock-in that has defined the industry since the 2000s.',
    body: `<h2>The Revit Monopoly</h2>
<p>For the better part of two decades, architectural BIM has meant Autodesk Revit. The software's parametric family system, its deep integration with the broader AEC ecosystem, and the sheer volume of institutional investment in Revit-trained staff have made it the default authoring environment for almost every commercial practice of significant scale. Competitors — ArchiCAD, Vectorworks, Bentley — have maintained niches, but Revit's dominance has been, practically speaking, a monopoly.</p>
<p>This dominance has come with well-documented costs. Revit's subscription pricing puts professional-grade BIM authoring beyond the reach of small practices in price-sensitive markets. Its proprietary .rvt format creates vendor lock-in that makes true interoperability — the exchange of rich, structured building data between different software tools — dependent on Autodesk's willingness to support open standards. The industry has paid lip service to IFC (Industry Foundation Classes) for thirty years while Revit's IFC export has remained, by widespread professional consensus, deeply unreliable.</p>

<h2>What Bonsai Actually Is</h2>
<p>Bonsai is a free, open-source BIM authoring add-on for Blender, developed primarily by Dion Moult and a growing contributor community. Unlike Revit — which stores building data in a proprietary format that is then exported to IFC — Bonsai stores building data natively in IFC. The file you save <em>is</em> the IFC file. There is no translation layer, no export fidelity loss, no format conversion. The IFC model is the single source of truth from the first click.</p>
<p>This architecture — IFC-native rather than IFC-exported — is conceptually radical. It means that every element placed in Bonsai is, from the moment of creation, a proper IFC entity with the correct classification, properties, and relationships. Dana Osei, who spent six months migrating a mid-sized residential practice from Revit to Bonsai, describes the cognitive shift: "You stop thinking about BIM as a Revit model that you occasionally export to share with other software. You start thinking about the IFC model as the actual building description, and Bonsai as the authoring interface for it."</p>

<h2>Blender as the Foundation</h2>
<p>Building on Blender rather than developing a standalone application was a strategic decision that gives Bonsai capabilities that no traditional BIM software can match. Blender's renderer — Cycles and EEVEE — is world-class. Its sculpting, modifier, and geometry nodes systems offer modelling capabilities far beyond anything available in Revit or ArchiCAD. Its Python API is mature, well-documented, and used by a global community of developers. And it is free.</p>
<p>The practical consequence is that a Bonsai workflow can move seamlessly between BIM authoring, photorealistic visualisation, animation, and computational geometry — in a single application, without file format conversions, without additional software licenses. For small practices and for practices in markets where Autodesk pricing is prohibitive, this is transformative.</p>

<h2>The Maturity Question</h2>
<p>The honest assessment is that Bonsai is not yet a full replacement for Revit in a large commercial practice environment. The parametric family system — Revit's core organising mechanism — has no direct equivalent. Structural analysis integrations are less mature. The documentation and annotation tools, while improving rapidly, require workflow adaptations that add friction in quantity-surveying and drawing-production contexts.</p>
<p>Asel Nurlan, who has evaluated Bonsai for pilot use in her practice, is cautiously optimistic: "The IFC-native approach is architecturally superior to anything the proprietary vendors offer. The gap in production tooling is real but it is closing faster than I expected two years ago. I would not migrate a current major project, but I am planning pilots on smaller commissions."</p>
<p>The trajectory, however, is clear. Bonsai's GitHub repository has seen contribution activity triple in the past eighteen months. Commercial support providers have emerged. The OpenBIM community — practitioners, researchers, and software developers aligned around open standards — is coalescing around Bonsai as the platform most likely to deliver on the thirty-year promise of genuine interoperability.</p>

<h2>What Open-Source Means for the Profession</h2>
<p>The implications of a credible open-source BIM platform extend beyond tool preferences. A profession in which the primary production software is owned by a single large corporation — whose interests are not necessarily aligned with practitioners — is a profession with limited agency over its own workflows. Open-source BIM, built on open standards, offers the possibility of a different relationship: one in which the profession collectively owns and shapes its tools, in which interoperability is a default rather than a vendor concession, and in which the barriers to entry for practitioners in lower-income markets are substantially reduced.</p>
<p>This is not naive idealism. Linux runs most of the world's servers. PostgreSQL powers most of the world's databases. The pattern of open-source eventually displacing proprietary incumbents in infrastructure software is well-established. Whether BIM follows that pattern depends on whether the profession invests in open tools — through contribution, adoption, and advocacy — with the same energy it currently invests in Autodesk subscriptions.</p>`,
    readingTimeMinutes: 10,
    publishedAt: '2025-04-22',
    featured: true,
    coverAccent: 'linear-gradient(135deg, #166534 0%, #052e16 100%)',
    authors: [AUTHORS.dana_osei, AUTHORS.mira_bello],
    sources: [
      { label: 'Bonsai BIM — Official Documentation', url: 'https://bonsaibim.org/', publisher: 'Bonsai Project' },
      { label: 'buildingSMART IFC Standard', url: 'https://www.buildingsmart.org/', publisher: 'buildingSMART International' },
      { label: 'IfcOpenShell GitHub Repository', url: 'https://github.com/IfcOpenShell/IfcOpenShell', publisher: 'IfcOpenShell', year: 2024 },
    ],
  },
  {
    id: 2,
    slug: 'blender-architectural-visualisation-pipeline',
    title: 'Blender as a Production Visualisation Tool: The 2025 Pipeline',
    subtitle: 'EEVEE Next, geometry nodes, and USD support have made Blender a serious competitor to 3ds Max and V-Ray for architectural rendering',
    category: 'Visualisation',
    tags: ['Blender', 'EEVEE', 'archviz', 'rendering', 'USD'],
    excerpt:
      'The release of Blender 4.x and EEVEE Next has closed the last major gap between open-source and proprietary visualisation pipelines. Here is how leading studios are restructuring their workflows.',
    body: `<h2>The Pipeline Problem Blender Solved</h2>
<p>Architectural visualisation has long been a three-software problem: model in Revit or SketchUp, import into 3ds Max, render with V-Ray or Corona. Each transition introduced translation losses, format incompatibilities, and version management headaches. The combined licensing cost of this stack — particularly with V-Ray's per-seat pricing — puts professional-quality visualisation out of reach for smaller practices and independent visualisers in many markets.</p>
<p>Blender's ascent has been systematic rather than sudden. The 2.80 release in 2019 introduced the EEVEE real-time renderer and a redesigned interface that made the software approachable for the first time to users coming from commercial tools. Subsequent releases have added cycles-X (a GPU-accelerated path tracer matching V-Ray quality), an asset library system, improved CAD import tools, and — in the 4.x series — EEVEE Next, a physically-based real-time renderer capable of global illumination quality output at interactive frame rates.</p>

<h2>EEVEE Next: What Changed</h2>
<p>The architectural significance of EEVEE Next is difficult to overstate for visualisation workflows. Traditional EEVEE — available since 2019 — was a rasterisation renderer: fast, but requiring manual tweaking of shadow maps, ambient occlusion, and screen-space reflections to approximate physical accuracy. Results were good for concept visualisation but fell short of photorealistic finish.</p>
<p>EEVEE Next implements hardware-accelerated ray tracing on compatible GPUs, providing genuine global illumination, accurate reflections, and physically correct shadow behaviour at speeds that allow interactive navigation of complex scenes. For architectural presentations — where clients expect to navigate through a space, see it at different times of day, and evaluate material options in real time — this represents a qualitative shift in what real-time visualisation can deliver.</p>
<p>Yusuf Camara, reviewing finished projects produced entirely in Blender by three London-based visualisation studios, found the output indistinguishable from V-Ray renders: "The technical gap has closed. What differentiates Blender visualisation now is not tool capability but artist skill and workflow maturity."</p>

<h2>Geometry Nodes for Architectural Context</h2>
<p>Blender's geometry nodes system — a procedural modelling framework comparable to Grasshopper but operating directly on mesh geometry — has become one of the most powerful tools in the architectural visualisation arsenal for generating contextual environments. Forest, urban block, landscape, and crowd systems that previously required dedicated plugins (Forest Pack, RailClone) or laborious manual placement can be built as reusable geometry nodes setups that respond to parametric inputs.</p>
<p>Dana Osei's publicly available "UrbanContext GN" library — a set of geometry nodes setups for generating realistic urban contexts from simple footprint inputs — has been downloaded over 12,000 times and has become a de facto standard in Blender architectural visualisation workflows. "The key insight," Osei explains, "is that architectural visualisation is mostly context. The building is 20% of the image; the trees, people, sky, and surroundings are 80%. Geometry nodes makes that 80% generative and reusable."</p>

<h2>USD and the Interoperability Layer</h2>
<p>Blender's ongoing implementation of Universal Scene Description (USD) — Pixar's open format for complex 3D scene interchange — is the development most significant for large-scale pipeline integration. USD allows Blender to participate in multi-application workflows as a first-class citizen: scenes can be composed from contributions across Blender, Houdini, Maya, and Unreal Engine without format conversion or data loss.</p>
<p>For large architectural practices with complex visualisation pipelines — where BIM data, landscape design, lighting simulation, and real-time client presentation tools are maintained by different teams using different software — USD as an interchange layer offers a path toward genuine pipeline coherence. Felix Strand's practice has been piloting a USD-based pipeline connecting Revit (via Autodesk's USD exporter), Blender (for visualisation), and Unreal Engine (for interactive client presentations), with early results that he describes as "genuinely promising but requiring significant DevOps investment."</p>

<h2>The Blender Visualisation Studio in 2025</h2>
<p>The studios leading Blender adoption in architectural visualisation share several characteristics: they tend to be small to medium-sized (two to fifteen people), they have a high proportion of technically skilled artists comfortable with scripting and pipeline development, and they are typically working in markets where the cost advantages of open-source tools are commercially significant.</p>
<p>What has changed in 2025 is that the conversation has shifted from "can Blender match commercial tools?" to "how do we build stable, scalable production pipelines in Blender?" — a question that implies the quality threshold has been crossed. The remaining challenges are institutional and organisational rather than technical: client education, industry standard file format compatibility, and the development of Blender-native equivalents to the project management and asset tracking tools that large commercial studios rely on.</p>`,
    readingTimeMinutes: 9,
    publishedAt: '2025-04-05',
    featured: true,
    coverAccent: 'linear-gradient(135deg, #1e3a5f 0%, #0c1a2e 100%)',
    authors: [AUTHORS.yusuf_camara, AUTHORS.dana_osei],
    sources: [
      { label: 'Blender 4.x Release Notes', url: 'https://www.blender.org/download/releases/', publisher: 'Blender Foundation', year: 2024 },
      { label: 'Pixar USD Documentation', url: 'https://openusd.org/', publisher: 'Pixar / ASWF' },
      { label: 'Blender Benchmark Results 2024', url: 'https://opendata.blender.org/', publisher: 'Blender Foundation', year: 2024 },
    ],
  },
  {
    id: 3,
    slug: 'ifc-data-standards-deep-dive',
    title: 'IFC4.3: What the New Standard Actually Changes for Practitioners',
    subtitle: 'Infrastructure support, georeferencing, and alignment geometry are the headlines — but the real story is in the property sets',
    category: 'BIM & Software',
    tags: ['IFC', 'data standards', 'interoperability', 'infrastructure BIM'],
    excerpt:
      'IFC4.3 expands the scope of the open BIM standard to cover roads, railways, bridges, and ports. For architectural practitioners, the more immediate changes are in georeferencing, classification, and the restructured property set framework.',
    body: `<h2>Why IFC Versions Matter</h2>
<p>IFC — Industry Foundation Classes — is the open data standard maintained by buildingSMART International for describing built assets. It is the foundation on which interoperable BIM workflows depend: when a Revit model is "exported to IFC" and opened in a different application, what is actually happening is a translation from Autodesk's proprietary format into the IFC schema, which the receiving application can then parse.</p>
<p>The quality of that translation — and of the original IFC implementation in each software — determines whether the exchange preserves the semantic richness of the BIM model (element classifications, property sets, spatial relationships, quantities) or reduces it to dumb geometry. The IFC standard itself defines what information can be represented; the software implementations determine how much of that potential is realised in practice.</p>
<p>IFC4.3 is the most significant revision to the standard since IFC4, ratified by ISO in 2013. It was published as an official ISO standard (ISO 16739-1:2024) in early 2024, giving it the normative status required for government mandates and contract specifications.</p>

<h2>Infrastructure: The Major Expansion</h2>
<p>The headline addition in IFC4.3 is comprehensive support for infrastructure asset types: roads, railways, bridges, ports, waterways, and drainage systems. Previous IFC versions were architecturally focused; large infrastructure projects either used separate standards (LandXML, CityGML) or relied on workarounds that produced poor data quality.</p>
<p>IFC4.3 introduces alignment geometry — the horizontal and vertical curves that define linear infrastructure assets — as a first-class IFC concept. This allows a road or railway to be described with the same semantic precision as a building: not just as a mesh, but as a structured data object with defined geometry type, spatial positioning, and relationships to surrounding terrain and structures.</p>
<p>Felix Strand, whose practice has been piloting IFC4.3 on a bridge replacement project, notes the practical significance: "For the first time, we can describe the bridge structure, its foundation, the approach roads, and the drainage system in a single coherent IFC model. The coordination benefit is significant — previously those elements would have been in separate models with manual clash detection across format boundaries."</p>

<h2>Georeferencing: Finally Fixed</h2>
<p>Georeferencing — the accurate placement of a BIM model in real-world geographic coordinates — has been a persistent source of data loss in IFC exchange. IFC4.3 introduces a revised georeferencing mechanism based on the OGC (Open Geospatial Consortium) standard, enabling BIM models to carry accurate coordinate reference system information that GIS tools can consume directly.</p>
<p>The practical consequence is that BIM-to-GIS workflows — linking building models to urban databases, site analysis tools, and planning platforms — become substantially more reliable. For urban-scale projects involving multiple buildings and their relationship to existing infrastructure, accurate georeferencing is not a nice-to-have but a fundamental data integrity requirement.</p>
<p>Mira Bello's research group at TU Delft has been developing IFC4.3-to-CityGML conversion tools that exploit the improved georeferencing to create semantically rich urban models from aggregated BIM data. "The potential is to move from BIM as a project tool to BIM as a persistent urban data infrastructure," she explains. "Each building project enriches the urban model. But you can only do that if the coordinate systems are handled correctly."</p>

<h2>Property Sets: The Quiet Revolution</h2>
<p>Less visible to practitioners but potentially more impactful than the infrastructure additions is IFC4.3's restructured property set framework. Property sets — the containers for non-geometric information attached to BIM elements — have been reorganised and extended, with clearer separation between properties defined by the standard and custom properties added by practitioners.</p>
<p>The new framework introduces a machine-readable property set definition format that enables validation: software can check whether a submitted IFC model contains the required property sets with correctly typed values before it enters a project information management system. For large infrastructure clients mandating BIM data quality, this validation capability is transformative — it moves data quality assurance from a manual checking process to an automated pipeline.</p>

<h2>Software Support: The Lag</h2>
<p>The honest assessment of IFC4.3 adoption is that it will take several years for software support to catch up with the standard. As of mid-2025, Revit's IFC4.3 export is partial; ArchiCAD and Vectorworks have published roadmaps but not complete implementations; Bonsai, characteristically, has more comprehensive IFC4.3 support than any commercial authoring tool, reflecting the advantage of its IFC-native architecture.</p>
<p>Dana Osei's recommendation for practitioners is pragmatic: "Learn the standard now, even if your current software can't fully implement it. Understanding IFC4.3 structures helps you write better BIM Execution Plans, ask better questions of your software vendors, and evaluate IFC exports more critically. The tools will catch up."</p>`,
    readingTimeMinutes: 11,
    publishedAt: '2025-03-18',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)',
    authors: [AUTHORS.felix_strand, AUTHORS.mira_bello],
    sources: [
      { label: 'buildingSMART IFC4.3 Documentation', url: 'https://ifc43-docs.buildingsmart.org/', publisher: 'buildingSMART International', year: 2024 },
      { label: 'ISO 16739-1:2024', url: 'https://www.iso.org/standard/84123.html', publisher: 'ISO', year: 2024 },
      { label: 'IfcOpenShell IFC4.3 Support Notes', url: 'https://github.com/IfcOpenShell/IfcOpenShell', publisher: 'IfcOpenShell', year: 2024 },
    ],
  },
  {
    id: 4,
    slug: 'grasshopper-geometry-nodes-comparison',
    title: 'Grasshopper vs Geometry Nodes: A Practitioner Comparison',
    subtitle: 'Both tools do parametric geometry — but they reflect fundamentally different philosophies of how design computation should work',
    category: 'Digital Fabrication',
    tags: ['Grasshopper', 'Blender', 'geometry nodes', 'parametric design', 'Rhino'],
    excerpt:
      'Grasshopper and Blender\'s Geometry Nodes have converged on similar visual programming metaphors but diverge sharply in their integration with production workflows. Understanding the difference matters more than picking a winner.',
    body: `<h2>Two Paradigms of Parametric Design</h2>
<p>Parametric design tools allow designers to describe geometry through rules, relationships, and parameters rather than fixed coordinates — enabling rapid exploration of design variations and the generation of complex forms from relatively simple algorithmic descriptions. Two tools now dominate this space for architectural practitioners: Grasshopper (the visual programming environment embedded in McNeel's Rhinoceros 3D) and Blender's Geometry Nodes (the procedural geometry system introduced in Blender 2.92).</p>
<p>Both use a node-based visual programming metaphor: you connect nodes representing operations, and the result is computed geometry. But the resemblance is largely superficial. The two tools reflect deeply different assumptions about what parametric design is for, how it integrates with production workflows, and who its users are.</p>

<h2>Grasshopper: The Architecture-Native Tool</h2>
<p>Grasshopper was designed by and for architects and designers. Its component library reflects architectural concerns: surface panelisation, structural optimisation, environmental analysis, fabrication-ready geometry. The ecosystem of Grasshopper plugins — Karamba3D for structural analysis, Ladybug Tools for environmental simulation, Kangaroo for physics-based form finding — represents twenty years of accumulated domain knowledge embedded in reusable tools.</p>
<p>Asel Nurlan describes the Grasshopper ecosystem as "the most complete computational design environment for architecture that exists." The integration with Rhino is seamless: Grasshopper geometry lives in the same document as hand-drawn Rhino geometry, with full bidirectional referencing. The integration with fabrication is mature: numerous plugins connect directly to CNC equipment, robotic fabrication systems, and structural analysis solvers.</p>
<p>The limitations of Grasshopper are equally well-known. It is available only within Rhinoceros, which is a paid application. It does not handle mesh geometry well — its native geometry kernel is NURBS-based, making it less suited for free-form mesh modelling tasks. And its performance on very large or complex definitions can be poor, with computation times that break interactive design workflows.</p>

<h2>Geometry Nodes: The General-Purpose Contender</h2>
<p>Geometry Nodes was not designed specifically for architecture. It emerged from Blender's broader ambition to provide a professional-grade procedural workflow for VFX, animation, and industrial design, as well as architecture. Its design reflects this generality: it operates on any geometry type (mesh, curve, point cloud, volume), it is tightly integrated with Blender's animation and rendering systems, and it is implemented as a compiled modifier stack rather than an interpreted Python layer, giving it significantly better performance on complex operations than Grasshopper.</p>
<p>Dana Osei's benchmarks comparing equivalent parametric operations in Grasshopper and Geometry Nodes found that Geometry Nodes was typically 5–15x faster on mesh-heavy operations, with the gap widening on tasks involving large point counts or simulation. For generative urban context models — where tens of thousands of building footprints, trees, and people must be procedurally placed and rendered — the performance advantage of Geometry Nodes is decisive.</p>
<p>The limitation of Geometry Nodes for architectural practice is the absence of architecture-specific tools. There is no equivalent of Ladybug Tools, no structural analysis integration, no fabrication-aware geometry operations. The ecosystem is younger and less domain-specific. Practitioners coming from Grasshopper find themselves rebuilding tools that already exist in the Rhino ecosystem.</p>

<h2>Where They Converge</h2>
<p>The distinction between the tools is blurring as their developers respond to competitive pressure. McNeel has been improving Grasshopper's mesh handling and performance. Blender's architecture community has been building geometry nodes libraries that replicate common Grasshopper operations. And both platforms now have bridges to each other: the Rhino.Inside.Revit project embeds Rhinoceros within Revit, and plugins allow Blender to import and export Rhino geometry with full parameter preservation.</p>
<p>Mira Bello's research group has been studying hybrid workflows in which Grasshopper handles design-phase parametric modelling (exploiting its domain-specific ecosystem) and Geometry Nodes handles visualisation and presentation (exploiting Blender's rendering capabilities and performance). "The tools are complementary rather than competitive," she argues. "The question practitioners should be asking is not which one to use, but which one to use for which part of the workflow."</p>

<h2>Learning Investment</h2>
<p>Both tools require significant learning investment to use productively. Grasshopper's architecture-specific ecosystem is learnable for architects with limited programming background; the visual programming metaphor is accessible, and the domain-specific components abstract away most of the underlying mathematics. Geometry Nodes is more powerful in its raw capabilities but more demanding in its abstractions — users need to understand data types, field inputs, and Blender's internal data structures to work effectively with it.</p>
<p>Yusuf Camara's recommendation for practitioners new to parametric tools is pragmatic: "Start with Grasshopper if your practice uses Rhino. Start with Geometry Nodes if your practice uses Blender for visualisation. The fundamental concepts — parameters, data trees, operations on collections of geometry — transfer between the two. Learning one makes learning the other substantially easier."</p>`,
    readingTimeMinutes: 12,
    publishedAt: '2025-02-28',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #9d174d 0%, #500724 100%)',
    authors: [AUTHORS.dana_osei, AUTHORS.yusuf_camara],
    sources: [
      { label: 'McNeel Grasshopper Documentation', url: 'https://www.grasshopper3d.com/', publisher: 'McNeel & Associates' },
      { label: 'Blender Geometry Nodes Manual', url: 'https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/', publisher: 'Blender Foundation', year: 2024 },
      { label: 'Ladybug Tools — Environmental Analysis', url: 'https://www.ladybug.tools/', publisher: 'Ladybug Tools' },
    ],
  },
  {
    id: 5,
    slug: 'bim-execution-plan-small-practice',
    title: 'Writing a BIM Execution Plan That Actually Gets Used',
    subtitle: 'Most BEPs are procurement checkboxes. Here is how to write one that drives real project coordination.',
    category: 'BIM & Software',
    tags: ['BEP', 'BIM management', 'project delivery', 'ISO 19650'],
    excerpt:
      'ISO 19650 mandates a BIM Execution Plan. What it does not tell you is how to write one that practitioners actually read, reference, and follow. This is that guide.',
    body: `<h2>The Problem with Most BEPs</h2>
<p>The BIM Execution Plan — the document that defines how BIM will be implemented on a specific project — is one of the most consistently misused tools in the architectural profession. In principle, a BEP is a living document that aligns all project contributors on modelling standards, information exchange requirements, software interoperability, and quality assurance procedures. In practice, most BEPs are written to satisfy procurement requirements, filed at project inception, and never consulted again.</p>
<p>The consequences are predictable: BIM models that cannot be federated because different discipline teams used different coordinate origins; IFC exports that arrive without property sets because nobody specified what information needed to be included; clashes that are detected in construction because model detail levels weren't agreed; and deliverable disputes because nobody defined what "BIM Level 2 compliant" actually meant for this specific project.</p>
<p>Felix Strand, who has audited the BIM delivery on fourteen projects in post-occupancy review, found that BEP compliance failures were a contributing factor in coordination issues on eleven of them. "The BEP is not a bureaucratic exercise," he observes. "It is a contract for how the project team will share information. When it fails, people build the wrong things."</p>

<h2>Starting with the Employer's Information Requirements</h2>
<p>A BEP cannot be written in isolation; it is a response to the Employer's Information Requirements (EIR) — the client's specification of what information they need, in what format, at what stage, and to what level of detail. ISO 19650 formalises this relationship: the EIR defines the "what," and the BEP defines the "how."</p>
<p>The most common failure mode in small-practice BIM management is writing a generic BEP from a template without reference to a project-specific EIR. The result is a document that describes how BIM works in principle rather than how it will work on this project, for this client, with these collaborators. Asel Nurlan's practice has developed a BEP kickoff process that begins with a structured interview with the client to identify their actual information needs: "Clients almost never know what an EIR is. What they do know is that they need the BIM model for facilities management, or that their contractor wants a clash-free federated model by Stage 4, or that their planning authority requires a CityGML submission. You reverse-engineer the EIR from those needs."</p>

<h2>The Model Matrix: Core of a Useful BEP</h2>
<p>The single most useful component of a BEP is the Model Matrix — a table that specifies, for each model element type, the Level of Information Need (LOIN) at each project stage, the responsible author, the software to be used, and the IFC entity mapping. A well-constructed Model Matrix tells every practitioner on the project exactly what they need to model, to what level of detail, and in what form, at every stage.</p>
<p>Model Matrices are underused because they are time-consuming to prepare. Dana Osei estimates that a thorough Model Matrix for a medium-complexity commercial project takes twelve to sixteen hours to develop properly. "That investment feels expensive at project inception," Osei notes. "It is a fraction of the cost of a coordination failure in construction."</p>

<h2>Software and Exchange Protocols</h2>
<p>The BEP's software section should specify not just what applications will be used but the precise version, the IFC export settings, the naming conventions for files and elements, and the Common Data Environment (CDE) where models will be shared. Version-specific IFC export settings are critical and almost universally omitted from template-derived BEPs: the IFC export behaviour of Revit 2024 differs from Revit 2023 in ways that matter for downstream interoperability.</p>
<p>For projects involving Bonsai or other open-source tools, the BEP should explicitly document the IFC version (IFC4 or IFC4.3), the property set definitions to be used, and any non-standard extensions to the standard schema. This documentation is essential not just for current project coordination but for the long-term archival of project information.</p>

<h2>Making the BEP Live</h2>
<p>A BEP becomes a living document only if it is embedded in project processes that require reference to it. Mira Bello's research on BIM process maturity in Dutch and German practices identifies three practices that distinguish high-performing BIM teams: regular model review meetings structured around BEP compliance criteria; a named BIM information manager with authority to reject non-compliant submissions; and a change control process for BEP amendments that requires all contributors to acknowledge changes.</p>
<p>The ISO 19650 framework provides the structural vocabulary for these processes, but the cultural change that makes them work — a project team that treats information management as a professional discipline rather than an administrative burden — is harder to mandate than a document format.</p>`,
    readingTimeMinutes: 10,
    publishedAt: '2025-01-25',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
    authors: [AUTHORS.felix_strand],
    sources: [
      { label: 'ISO 19650-1:2018 — BIM Information Management', url: 'https://www.iso.org/standard/68078.html', publisher: 'ISO', year: 2018 },
      { label: 'UK BIM Framework Guidance', url: 'https://www.ukbimframework.org/', publisher: 'UK BIM Framework', year: 2022 },
      { label: 'buildingSMART LOIN Specification', url: 'https://www.buildingsmart.org/', publisher: 'buildingSMART International' },
    ],
  },
  {
    id: 6,
    slug: 'point-cloud-to-bim-workflow',
    title: 'Point Cloud to BIM: The State of Scan-to-BIM in 2025',
    subtitle: 'Lidar scanning is now affordable for small practices. The bottleneck has moved from data acquisition to intelligent modelling.',
    category: 'Digital Fabrication',
    tags: ['scan-to-BIM', 'point cloud', 'lidar', 'heritage', 'Revit', 'Blender'],
    excerpt:
      'Consumer-grade lidar (iPhone, iPad Pro, Matterport) has democratised building scanning. The challenge is no longer capturing the point cloud — it is converting dense scan data into semantically rich, usable BIM models efficiently.',
    body: `<h2>The Scanning Revolution</h2>
<p>Five years ago, acquiring a high-quality point cloud of an existing building required a professional-grade terrestrial laser scanner costing €30,000–€100,000, and the data processing required specialist software and expertise. Today, a structured-light scan adequate for many renovation and heritage documentation purposes can be captured with an iPhone 15 Pro or an iPad Pro. Matterport's consumer platform turns any smartphone into a photogrammetry scanner capable of producing millimetre-accurate point clouds of building interiors.</p>
<p>This democratisation has transformed the business case for scan-to-BIM on small and medium projects. Renovation projects that previously proceeded from hand measurements and guesswork can now be grounded in accurate as-built geometry. Heritage documentation that required specialist survey contractors can be initiated by the project architect on the first site visit. The question is no longer whether to scan, but how to convert the scan data into a form that drives design and coordination.</p>

<h2>The Semantic Gap</h2>
<p>A point cloud is a dense collection of XYZ coordinates — a faithful geometric record of a building's surfaces. A BIM model is a structured description of a building's elements: walls, slabs, columns, windows, doors, with defined spatial relationships, material properties, and classification. The gap between these two representations — geometry without semantics versus semantics with geometry — is the central challenge of scan-to-BIM conversion.</p>
<p>Closing the semantic gap currently requires significant human intervention. Automated wall detection, slab extraction, and opening recognition tools exist in products like Autodesk ReCap, Leica Cyclone, and the open-source CloudCompare — but their reliability on complex real-world buildings, with organic irregularities, mixed materials, and occlusions, is far from sufficient for unattended operation. A skilled practitioner can model a medium-complexity floor from a point cloud in eight to sixteen hours; automated tools can reduce this to four to eight hours of guided modelling, not zero.</p>
<p>Dana Osei's practice of using Bonsai for point cloud-informed modelling — importing the cloud into Blender, using it as a modelling reference, and authoring IFC elements directly — has produced workflows that she finds "significantly more fluid than the equivalent Revit workflow, primarily because Blender's viewport handles dense point clouds without the performance degradation that makes Revit scan-to-BIM frustrating."</p>

<h2>Machine Learning: Promise and Present Reality</h2>
<p>The field has attracted significant AI research attention, with several published systems claiming automated or near-automated semantic segmentation of point clouds into BIM element types. The results in controlled research conditions are impressive; the results on messy real-world scans of existing buildings are less so. Asel Nurlan, who evaluated three ML-based scan-to-BIM tools for a heritage renovation project, found that all three required substantial manual correction: "The tools are good at identifying large, regular elements — floors, straight walls. They struggle with anything complex: curved walls, irregular ceiling profiles, non-standard connections. Heritage buildings, which are the projects where you most need scan-to-BIM, are exactly the ones where the tools are least reliable."</p>
<p>The more productive near-term application of ML in scan-to-BIM is not full automation but intelligent assistance: tools that suggest element placements, highlight inconsistencies between a partially-completed BIM model and the underlying scan, and automatically classify elements that have been manually placed. This augmentation model — human modeller with ML assistance — is where the field is converging.</p>

<h2>Heritage Documentation: The Highest-Value Application</h2>
<p>For heritage and conservation architecture, scan-to-BIM is not a workflow efficiency tool but a documentation imperative. Heritage buildings are, by definition, unique; the consequences of inaccurate as-built information — interventions that damage historic fabric, restoration work based on incorrect geometry, the loss of irreplaceable spatial information if a building is damaged or destroyed — justify levels of documentation investment that would be disproportionate on a standard renovation.</p>
<p>Felix Strand's practice has developed a heritage BIM protocol that combines terrestrial laser scanning (for millimetre-accurate geometry), photogrammetry (for colour and texture), and structured historical research (for material dating and significance assessment) into a unified IFC model in which every element carries not just geometric and material properties but cultural significance classifications based on heritage assessment frameworks.</p>
<p>"The IFC schema can carry all of this information," Strand notes. "The challenge is that most heritage practitioners don't know BIM, and most BIM practitioners don't know heritage assessment. Building that cross-disciplinary competence is a decade-long project."</p>`,
    readingTimeMinutes: 9,
    publishedAt: '2024-12-12',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
    authors: [AUTHORS.dana_osei, AUTHORS.felix_strand],
    sources: [
      { label: 'RICS Scan to BIM Guidance Note', url: 'https://www.rics.org/', publisher: 'RICS', year: 2023 },
      { label: 'CloudCompare Open-Source Documentation', url: 'https://www.cloudcompare.org/', publisher: 'CloudCompare' },
      { label: 'Historic England — Photogrammetric Survey', url: 'https://historicengland.org.uk/', publisher: 'Historic England', year: 2022 },
    ],
  },
  {
    id: 7,
    slug: 'unreal-engine-architectural-walkthroughs',
    title: 'Unreal Engine 5 for Architecture: Beyond the Flythrough',
    subtitle: 'Lumen, Nanite, and real-time lighting have made UE5 a serious design tool — not just a presentation one',
    category: 'Visualisation',
    tags: ['Unreal Engine', 'real-time rendering', 'Lumen', 'Nanite', 'XR'],
    excerpt:
      'Unreal Engine 5\'s Lumen global illumination and Nanite virtualised geometry have transformed what real-time architectural visualisation can do. The question now is how it integrates with BIM workflows upstream.',
    body: `<h2>From Game Engine to Design Tool</h2>
<p>Unreal Engine's adoption in architectural visualisation was initially driven by the flythrough — the real-time walkthrough that allowed clients to navigate a building before it was built. This was a compelling sales tool but a limited design tool: the workflow from BIM model to UE scene was time-consuming, one-directional, and required specialist technical skills that most architectural practices did not have in-house.</p>
<p>Unreal Engine 5, released in 2022 with subsequent major updates through 2024 and 2025, has changed the calculus. Lumen — the software-based global illumination system — delivers path-tracing quality lighting at interactive frame rates without the GPU hardware requirement of hardware ray tracing. Nanite — the virtualised geometry system — allows scenes with hundreds of millions of polygons to run at real-time frame rates by streaming only the geometry detail visible to the camera. Together, they eliminate two of the most significant bottlenecks in architectural visualisation workflows: the need to manually optimise geometry for real-time performance, and the need for offline rendering for photorealistic lighting quality.</p>

<h2>Lumen in Practice</h2>
<p>The practical significance of Lumen for architectural visualisation is in the simulation of complex natural and artificial lighting conditions that previously required hours of path-traced rendering per frame. An atrium space with a glass roof, indirect light bouncing off coloured surfaces, and artificial downlights — the kind of lighting scenario that makes or breaks an architectural experience — can now be evaluated interactively, with the designer able to adjust glazing specifications, surface materials, and light positions and see the result immediately.</p>
<p>Yusuf Camara spent three months evaluating Lumen against offline rendering benchmarks for architectural lighting quality: "For diffuse interreflection — the way light bounces between matte surfaces — Lumen is now essentially indistinguishable from offline path tracing at normal viewing distances. The remaining gaps are in caustics, very fine specular detail, and certain edge cases with transparent materials. For 90% of architectural visualisation scenarios, Lumen is sufficient and the speed advantage is transformative."</p>

<h2>The BIM-to-UE Pipeline Problem</h2>
<p>The persistent challenge in UE5 architectural workflows is the upstream pipeline from BIM authoring to game engine. The standard workflow — export from Revit or ArchiCAD as FBX or via Datasmith, import into UE5, assign materials, set up lighting — remains time-consuming and loses semantic information. The resulting UE scene is geometry with materials; it is not a BIM model and cannot be queried for element properties or updated when the design changes.</p>
<p>Several approaches to improving this pipeline are under development. Epic's Datasmith importer has been extended to support more software sources and better metadata preservation. USD-based pipelines — using Pixar's Universal Scene Description as an interchange format — offer a path to more semantically rich scene exchange. And direct IFC import plugins for UE5, while still immature, are advancing rapidly, driven by the same open-source community energy that is developing Bonsai.</p>
<p>Asel Nurlan's practice has invested significantly in a Revit-to-UE5 pipeline using USD as the interchange: "The investment was substantial — we hired a technical pipeline developer for three months to build it. But for large commercial projects where the client is using the UE5 model for internal space planning and facilities management, the ROI is clear."</p>

<h2>XR Integration: The Next Frontier</h2>
<p>Unreal Engine's native support for virtual reality (VR) and, increasingly, mixed reality (MR) platforms positions it as the architectural presentation platform most likely to benefit from the broader XR ecosystem development. Architectural VR walkthroughs — using headsets like the Meta Quest 3 or Apple Vision Pro — allow clients to experience spaces at 1:1 scale before construction in ways that flat screen visualisation simply cannot match.</p>
<p>Mira Bello's research group has been evaluating VR walkthroughs as a design review and client approval tool in residential projects. Her findings are nuanced: "Clients consistently report that VR scale walkthroughs reveal spatial issues they had not noticed in plans and elevations — room proportions that feel wrong, adjacencies that feel uncomfortable, natural light that seems inadequate. The tool is genuinely useful for identifying design problems early. The challenge is managing client expectations: VR is not the building, and the experience of the rendered model is always more flattering than the experience of the real space."</p>`,
    readingTimeMinutes: 10,
    publishedAt: '2024-11-08',
    featured: true,
    coverAccent: 'linear-gradient(135deg, #0e7490 0%, #164e63 100%)',
    authors: [AUTHORS.yusuf_camara, AUTHORS.asel_nurlan],
    sources: [
      { label: 'Epic Games — Unreal Engine for Architecture', url: 'https://www.unrealengine.com/en-US/industry/architecture', publisher: 'Epic Games', year: 2024 },
      { label: 'Datasmith Technical Reference', url: 'https://docs.unrealengine.com/5.0/en-US/datasmith-overview/', publisher: 'Epic Games' },
      { label: 'OpenUSD Alliance — Architecture Use Cases', url: 'https://aswf.io/', publisher: 'ASWF', year: 2024 },
    ],
  },
  {
    id: 8,
    slug: 'robotic-fabrication-small-practice',
    title: 'Robotic Fabrication Without a Factory: The Small Practice Opportunity',
    subtitle: 'Affordable 6-axis arms, CNC routers, and shared fabrication facilities are making digital fabrication accessible to practices that cannot afford their own machinery',
    category: 'Digital Fabrication',
    tags: ['robotic fabrication', 'CNC', 'parametric', 'Grasshopper', 'digital craft'],
    excerpt:
      'The assumption that robotic fabrication requires either a large practice or a manufacturing partner is being challenged by a new generation of affordable equipment, open-source robot programming tools, and shared fabrication facilities.',
    body: `<h2>The Fabrication Barrier</h2>
<p>Digital fabrication — the direct production of architectural components from computational design data — has been transforming architectural practice since the early 2000s. But the transformation has been uneven. Large practices with dedicated research and fabrication departments (Zaha Hadid Architects, Herzog & de Meuron, BIG) have integrated robotic fabrication into their design processes. Small and medium practices have largely watched from the sidelines, constrained by the capital cost of equipment, the specialist skills required to program industrial robots, and the minimum-order requirements of fabrication contractors.</p>
<p>This picture is changing, driven by three converging factors: the falling cost of 6-axis robot arms, the maturation of open-source robot programming frameworks, and the growth of shared fabrication facilities that provide access to equipment on a per-project basis.</p>

<h2>The Affordable Robot Moment</h2>
<p>Until approximately 2018, a 6-axis robot arm suitable for architectural fabrication (Universal Robots UR10 or equivalent) cost €30,000–€50,000 for the hardware alone, with additional investment required for end-effectors, safety systems, and programming. Today, the UR10e — with improved force sensing and a redesigned control interface — is available for under €35,000 including basic tooling, and the Chinese-manufactured equivalents (Doosan, AUBO, Elite Robots) offer comparable performance at €15,000–€25,000.</p>
<p>For a small practice with a dedicated fabrication space, this is now a capital investment comparable to a high-end laser cutter or CNC router — tools that are already standard in design-forward small practices. Felix Strand's practice purchased a UR10e in 2023 and has since used it for bespoke joinery fabrication, ceramic tile forming, and composite panel layup on three completed projects.</p>

<h2>Open-Source Robot Programming</h2>
<p>The most significant barrier to robotic fabrication in small practices has historically been programming. Industrial robot programming languages (KUKA KRL, ABB RAPID, Fanuc TP) are proprietary, poorly documented, and require specialist training. The Grasshopper-based robot programming ecosystem — KUKA|prc, ROBOTS (for multiple manufacturers), and the open-source Compas FAB framework — has transformed this by allowing architects to program robots using the same parametric environment they use for design.</p>
<p>The workflow is conceptually elegant: design the component in Grasshopper, define the fabrication tool path in the same script, simulate the robot motion in the Grasshopper viewport, and export the motion program directly to the robot controller. The designer and the fabrication programmer are the same person, using the same tool, in the same design session.</p>
<p>Dana Osei's workshop series on robotic fabrication for architects — run three times annually and consistently oversubscribed — introduces this workflow to practitioners with no prior robotics experience. "The learning curve is real," she acknowledges. "But it is a Grasshopper learning curve, not a robotics learning curve. Architects who already use Grasshopper for parametric design can be producing simple robot programs in a two-day workshop."</p>

<h2>Shared Fabrication: The Access Model</h2>
<p>For practices that cannot justify their own equipment, shared fabrication facilities — Fab Labs, university workshops, commercial fabrication studios — provide project-by-project access. The model is analogous to professional printing: you design the component, send the files to the fabrication facility, and collect the parts.</p>
<p>The critical difference from printing is the design-fabrication feedback loop. Successful robotic fabrication requires iterative testing — prototyping at small scale before committing to full-scale production, adjusting tool paths based on material behaviour, developing fabrication knowledge that accumulates across projects. This feedback loop is much weaker when fabrication is outsourced than when it is in-house. Practices using shared facilities need to invest in relationships with specific facilities and specific operators, treating them as long-term collaborators rather than interchangeable service providers.</p>
<p>Mira Bello's research documents the emergence of what she calls "fabrication partnerships" — long-term relationships between small architectural practices and shared fabrication facilities in which the practice develops project-specific expertise and the facility adapts its processes to the practice's design methods. "These partnerships are generating genuine design innovation," she notes. "The constraints of specific equipment, specific materials, and specific fabricators are becoming design opportunities rather than limitations."</p>

<h2>What Robotic Fabrication Enables</h2>
<p>The design possibilities opened by robotic fabrication — complex curved geometry, variable-density structures, material-specific optimisation — are well-documented in academic literature and high-profile competition projects. Less discussed are the more prosaic applications that are most relevant for small practice work: bespoke joinery connections, custom facade panels, ceramic or concrete components with complex surface geometry, and the fabrication of full-scale prototypes for client review.</p>
<p>Asel Nurlan's practice recently used a robotic arm to fabricate the 240 unique structural connection nodes for a timber pavilion project — a task that would have been prohibitively expensive through conventional CNC machining and impossible through manual fabrication. "The robot gave us a building that would not have existed without it," she observes. "Not because the design was digitally generated, but because the fabrication was the only way to realise the design intent within the project budget."</p>`,
    readingTimeMinutes: 11,
    publishedAt: '2024-10-20',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
    authors: [AUTHORS.asel_nurlan, AUTHORS.mira_bello],
    sources: [
      { label: 'COMPAS FAB — Robotic Fabrication Framework', url: 'https://gramaziokohler.github.io/compas_fab/', publisher: 'Gramazio Kohler Research', year: 2023 },
      { label: 'Gramazio & Kohler, "The Robotic Touch"', url: '#', publisher: 'Park Books', year: 2014 },
      { label: 'Universal Robots UR10e Datasheet', url: 'https://www.universal-robots.com/', publisher: 'Universal Robots', year: 2024 },
    ],
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

export const CATEGORIES = ['All', ...Array.from(new Set(BLOG_POSTS.map((p) => p.category)))];

export function getPostsByCategory(category: string): BlogPost[] {
  if (category === 'All') return BLOG_POSTS;
  return BLOG_POSTS.filter((p) => p.category === category);
}

export function searchPosts(query: string, category: string = 'All'): BlogPost[] {
  const q = query.toLowerCase().trim();
  const base = getPostsByCategory(category);
  if (!q) return base;
  return base.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.authors.some((a) => a.name.toLowerCase().includes(q))
  );
}

export function getFeaturedPosts(): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.featured);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}