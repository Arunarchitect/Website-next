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
  body: string; // Full article body (HTML string)
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
  category: string; // matches post category for relevance
  logoInitials: string;
}

// ─── Authors ─────────────────────────────────────────────────────────────────

export const AUTHORS: Record<string, Author> = {
  rajan_thomas: {
    id: 'rajan_thomas',
    name: 'Rajan Thomas',
    role: 'Eminent',
    title: 'Founder & Principal, Studio Vernacular',
    avatarInitials: 'RT',
    avatarColor: '#b45309',
    bio: 'Rajan has 30 years of practice across South Asia and the Gulf, with a focus on climate-responsive vernacular architecture.',
  },
  priya_menon: {
    id: 'priya_menon',
    name: 'Priya Menon',
    role: 'Editorial',
    title: 'Architecture Critic & Senior Editor',
    avatarInitials: 'PM',
    avatarColor: '#0e7490',
    bio: 'Priya writes on built environment politics, housing policy, and the social life of cities for ModelBlog and the Architectural Review.',
  },
  arjun_nair: {
    id: 'arjun_nair',
    name: 'Arjun Nair',
    role: 'Staff',
    title: 'Research Editor, ModelBlog',
    avatarInitials: 'AN',
    avatarColor: '#4338ca',
    bio: 'Arjun tracks building materials innovation and construction technology for ModelBlog.',
  },
  leila_haddad: {
    id: 'leila_haddad',
    name: 'Leila Haddad',
    role: 'Guest',
    title: 'Associate Professor of Urban Planning, AUB',
    avatarInitials: 'LH',
    avatarColor: '#065f46',
    bio: 'Leila researches informal urbanism, land tenure, and participatory planning across MENA.',
  },
  suresh_varma: {
    id: 'suresh_varma',
    name: 'Suresh Varma',
    role: 'Eminent',
    title: 'Director, Centre for Sustainable Built Environment',
    avatarInitials: 'SV',
    avatarColor: '#9d174d',
    bio: 'Suresh consults on net-zero building policy for state governments and UN-Habitat.',
  },
};

// ─── Ad Units ─────────────────────────────────────────────────────────────────

export const AD_UNITS: AdUnit[] = [
  {
    id: 'ad_greenroofs',
    company: 'GreenRoofs Studio',
    tagline: 'Turn every rooftop into a living ecosystem. Award-winning biophilic design consultancy.',
    url: '#',
    accentColor: '#166534',
    category: 'Sustainability',
    logoInitials: 'GR',
  },
  {
    id: 'ad_archdaily',
    company: 'ArchMaterials Pro',
    tagline: 'The largest curated library of sustainable building materials. Free 30-day trial.',
    url: '#',
    accentColor: '#4338ca',
    category: 'Materials',
    logoInitials: 'AM',
  },
  {
    id: 'ad_cityscale',
    company: 'CityScale Analytics',
    tagline: 'Urban data intelligence for planners, architects, and policy teams. Real-time insights.',
    url: '#',
    accentColor: '#0e7490',
    category: 'Urban Planning',
    logoInitials: 'CS',
  },
  {
    id: 'ad_habitatech',
    company: 'HabitaTech',
    tagline: 'Prefab modular housing systems for climate-resilient communities. Built to last 100 years.',
    url: '#',
    accentColor: '#b45309',
    category: 'Housing',
    logoInitials: 'HT',
  },
  {
    id: 'ad_sensorflow',
    company: 'SensorFlow',
    tagline: 'AI-powered building intelligence that slashes energy costs by up to 40%.',
    url: '#',
    accentColor: '#1e3a5f',
    category: 'Technology',
    logoInitials: 'SF',
  },
  {
    id: 'ad_default',
    company: 'ModelBlog Partners',
    tagline: 'Reach architects, planners, and built environment professionals. Advertise with us.',
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
    slug: 'rethinking-passive-cooling',
    title: 'Rethinking Passive Cooling for South Asian Climates',
    subtitle: 'How vernacular wisdom is informing net-zero design in an era of extreme heat',
    category: 'Sustainability',
    tags: ['passive design', 'thermal comfort', 'vernacular', 'India'],
    excerpt:
      'As wet-bulb temperatures breach survivability thresholds across the subcontinent, architects are rediscovering evaporative, shading, and mass-storage strategies that predate mechanical cooling—and pairing them with contemporary simulation.',
    body: `<h2>The Crisis of Heat</h2>
<p>In April 2023, parts of Maharashtra recorded wet-bulb temperatures approaching 32°C—a threshold beyond which the human body cannot cool itself through sweating alone. This is no longer a distant projection; it is the present reality of South Asian summers. The IPCC AR6 report identifies the Indo-Gangetic Plain as one of the regions most at risk from lethal heat-humidity combinations by mid-century.</p>
<p>Against this backdrop, the architecture profession faces a profound challenge: how do you design buildings that remain habitable without spiraling energy demand that further accelerates the crisis? The answer, increasingly, lies in looking backward before looking forward.</p>

<h2>What Vernacular Architecture Knew</h2>
<p>The <em>stepwells</em> of Gujarat, the thick-walled <em>haveli</em> courtyards of Rajasthan, the wind-catching <em>malqaf</em> towers of the Gulf—these were not decorative gestures. They were precision thermal instruments evolved over centuries of trial and error. The principles they embody—thermal mass, evaporative cooling, stack ventilation, solar shading—are now being validated by computational fluid dynamics simulations that their builders could never have imagined.</p>
<p>Rajan Thomas, whose Studio Vernacular has completed eighteen projects across Kerala, Tamil Nadu, and Oman, describes a methodology he calls "simulation-assisted reinterpretation." The practice begins with detailed documentation of traditional building typologies—wall thickness, opening ratios, courtyard proportions, material composition—and then runs those parameters through EnergyPlus and IES-VE to quantify their thermal performance. The results consistently show that the best vernacular buildings outperform contemporary code-compliant structures on thermal comfort metrics by 15–30%.</p>

<h2>The Evaporative Stack</h2>
<p>Perhaps the most underutilised passive strategy is the evaporative stack—a vertical shaft where water surfaces (a pool, a fountain, wetted terracotta pots) cool incoming air, which then rises through convection and exits via high-level openings. In dry climates, this can reduce indoor temperatures by 6–8°C. In humid coastal climates like Kerala's, the application is more limited, but cross-ventilation combined with shading can still cut cooling loads dramatically.</p>
<p>The challenge is convincing clients and developers accustomed to glass curtain walls and split ACs. "There is a perception problem," Thomas notes. "Passive buildings are seen as uncomfortable, as a compromise. Our job is to demonstrate, with data, that the opposite is true—that a well-designed passive building is more comfortable than a hermetically sealed box that relies entirely on mechanical systems that can fail."</p>

<h2>Material Intelligence</h2>
<p>Rammed earth, compressed laterite, and lime plaster are regaining currency not out of nostalgia but because their thermal properties—high specific heat capacity, high thermal mass, low conductivity—make them genuinely superior for hot-climate construction. The challenge is not material performance but supply chain and skill availability. Rammed earth construction requires specialist contractors; the knowledge base has atrophied over two generations of concrete dominance.</p>
<p>Several state government initiatives in Rajasthan and Tamil Nadu are now funding master-craftsperson apprenticeship programmes specifically to reverse this knowledge loss—an acknowledgement that the green transition in construction is as much about human capital as material innovation.</p>

<h2>The Simulation Gap</h2>
<p>Where the field faces its most significant challenge is in bridging the gap between simulation and as-built performance. Studies of green-rated buildings in India consistently show that energy use in operation exceeds design predictions by 20–40%. The causes are multiple: occupant behaviour, poor commissioning, construction quality control, and—critically—the use of static climate data that does not reflect current or projected temperature extremes.</p>
<p>Arjun Nair, who has tracked the commissioning performance of twenty-three GRIHA-rated buildings, argues that the industry needs a mandatory post-occupancy evaluation regime. "We are designing buildings to last fifty to a hundred years," he says. "We need to know whether they are actually performing as designed, and we need that feedback loop to improve future designs."</p>

<h2>A Synthesis</h2>
<p>The most promising projects in South Asia today are neither nostalgic vernacular revivals nor technology-first net-zero boxes. They are hybrids: buildings that use contemporary simulation to validate and refine ancient thermal strategies, that deploy materials with both low embodied carbon and high thermal performance, and that are designed with operational simplicity—so that the passive systems actually function regardless of whether the mechanical backup is running.</p>
<p>In a subcontinent where power cuts remain common and cooling loads are projected to increase fivefold by 2050, this synthesis is not an aesthetic preference. It is an engineering necessity.</p>`,
    readingTimeMinutes: 9,
    publishedAt: '2025-04-18',
    featured: true,
    coverAccent: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
    authors: [AUTHORS.rajan_thomas, AUTHORS.arjun_nair],
    sources: [
      { label: 'IPCC AR6 — Heat and Humidity', url: 'https://www.ipcc.ch/report/ar6/', publisher: 'IPCC', year: 2023 },
      { label: 'Passive Cooling Handbook', url: 'https://www.iea.org/', publisher: 'IEA', year: 2022 },
      { label: 'Vernacular Architecture Forum', url: 'https://www.vernaculararchitectureforum.org/', publisher: 'VAF' },
    ],
  },
  {
    id: 2,
    slug: 'affordable-housing-density-paradox',
    title: 'The Affordable Housing Density Paradox',
    subtitle: `Why upzoning alone won't fix the housing crisis—and what actually will`,
    category: 'Housing',
    tags: ['housing policy', 'density', 'affordability', 'urban economics'],
    excerpt:
      'Density is the dominant prescription for housing affordability. But evidence from Tokyo, Vienna, and Singapore reveals that supply alone is a necessary but insufficient condition. Governance, land tenure, and public financing matter just as much.',
    body: `<h2>The Supply Gospel</h2>
<p>The housing affordability crisis in major cities has produced a remarkably unified policy prescription from economists and urbanists alike: build more. The logic is elegant in its simplicity—if housing is expensive because it is scarce, the solution is to make it less scarce. Upzone. Remove height limits. Liberalise planning restrictions. Let the market supply.</p>
<p>The evidence for this view is real. Tokyo, which has maintained relatively permissive zoning and built consistently, has held housing costs stable in a way that London, Sydney, or San Francisco have not. The macro-level relationship between restrictive land use regulation and housing unaffordability is well-documented.</p>
<p>But the supply gospel, as its critics have noted, papers over significant complexity. Tokyo's affordability is not just a function of supply; it is also a function of a national government that effectively preempts local NIMBYism, a tradition of housing as consumption rather than investment, and a construction industry capable of delivering at scale. Remove any of those factors and the supply hypothesis weakens considerably.</p>

<h2>Three Case Studies in Complexity</h2>
<p><strong>Tokyo</strong> is the supply hawks' favourite example, and not without reason. The city builds roughly 140,000 units per year for a metropolitan population of 37 million. But Tokyo's affordability is also sustained by demographic stabilisation and by cultural norms around property that suppress speculative demand. Cities with stronger investor demand—Sydney, Vancouver, Dubai—have built substantial supply without achieving affordability.</p>
<p><strong>Vienna</strong> offers a different model. The city operates one of the world's largest social housing programmes: roughly 60% of residents live in publicly owned or subsidised housing. The Gemeindebauten—the great municipal apartment blocks—are not stigmatised as last-resort housing but are inhabited across income levels. Vienna's affordability is not market-delivered; it is politically delivered, and it requires sustained public investment that most city governments are unwilling or unable to make.</p>
<p><strong>Singapore</strong> represents a third path: comprehensive state control of land, a Housing Development Board that has built homes for over 80% of the population, and a deliberate policy of ethnic integration in housing allocation. It is affordable by design, not by market mechanism—and it is achievable only in a city-state with the political authority and fiscal capacity to sustain it.</p>

<h2>What Supply Cannot Do</h2>
<p>Even in favourable conditions, market supply primarily addresses the middle and upper segments of the housing market. Private developers build to maximise return; they will not voluntarily supply homes affordable to households earning at or below median income without subsidy or regulatory requirement. The "filtering" theory—that new supply at the top releases older stock at the bottom—operates over decades and is disrupted by renovation, conversion, and Airbnb-isation.</p>
<p>Land tenure is perhaps the most underappreciated variable. In cities where land ownership is concentrated and speculative, upzoning can increase the value of land without increasing the supply of affordable homes—because landowners hold out for ever-higher prices as density allowances increase. Community land trusts, land value capture mechanisms, and cooperative housing models attempt to address this by decoupling land value from housing cost, but they require institutional support that most planning systems do not provide.</p>

<h2>The Governance Imperative</h2>
<p>Leila Haddad's research across MENA cities shows that the most durable affordable housing outcomes are produced not by market liberalisation or state provision alone but by hybrid governance models that combine public land ownership, private construction capacity, and community tenure security. "The question is not markets versus state," she argues. "It is how you structure the relationship between them to keep housing accessible to ordinary households across the income distribution."</p>
<p>This is a more politically difficult answer than "just build more." It requires sustained political will, institutional capacity, and a willingness to limit the returns that can be extracted from housing as an asset class. In cities where housing wealth is central to middle-class financial security, that is a profound political constraint. But the evidence is clear: supply is necessary, and it is not sufficient.</p>`,
    readingTimeMinutes: 12,
    publishedAt: '2025-03-29',
    featured: true,
    coverAccent: 'linear-gradient(135deg, #0e7490 0%, #164e63 100%)',
    authors: [AUTHORS.priya_menon, AUTHORS.leila_haddad],
    sources: [
      { label: 'Housing Europe 2024 Report', url: 'https://www.housingeurope.eu/', publisher: 'Housing Europe', year: 2024 },
      { label: 'Tokyo Housing Data', url: 'https://www.mlit.go.jp/', publisher: 'MLIT Japan' },
      { label: 'Glaeser & Gyourko, "The Economic Implications of Housing Supply"', url: 'https://doi.org/10.1257/jep.32.1.3', publisher: 'Journal of Economic Perspectives', year: 2018 },
    ],
  },
  {
    id: 3,
    slug: 'mass-timber-structural-limits',
    title: 'Mass Timber at the Structural Frontier',
    subtitle: 'CLT, glulam, and LVL are moving from boutique to mainstream—but engineering limits remain underexplored',
    category: 'Materials',
    tags: ['mass timber', 'CLT', 'structural engineering', 'carbon'],
    excerpt:
      `The promise of mass timber as a low-carbon structural system is real, but the industry's enthusiasm has outpaced its understanding of fire performance, moisture behaviour, and the actual carbon accounting of harvested forests.`,
    body: `<h2>The Timber Moment</h2>
<p>In 2015, SOM published their Timber Tower Research Project, demonstrating that a 42-storey hybrid timber structure was structurally feasible. Since then, the race to build taller in timber has accelerated dramatically. Brock Commons in Vancouver (18 storeys, 2017), Mjøstårnet in Norway (18 storeys, 2019), and numerous projects in the 10–15 storey range across Europe and Australia have established mass timber as a credible structural system for mid-rise construction.</p>
<p>The carbon argument is compelling. Cross-laminated timber (CLT) and glued-laminated timber (glulam) store approximately 1 tonne of CO₂ per cubic metre of wood used. A timber building of equivalent size to a concrete building can represent a carbon differential of hundreds of tonnes—a significant advantage at a time when embodied carbon is receiving increasing regulatory attention.</p>

<h2>The Fire Performance Question</h2>
<p>The most contested aspect of mass timber construction is fire performance. The industry's standard response is that CLT and glulam char predictably at approximately 0.65mm per minute, forming an insulating layer that protects the structural core. This "charring rate" approach allows engineers to design structural sections that retain adequate load capacity through a standard fire event.</p>
<p>This is broadly correct for well-designed and maintained buildings. The complications emerge in real-world scenarios: connections between elements, penetrations for services, construction phase exposures, and—critically—the behaviour of exposed mass timber in post-suppression smouldering fires. Several fires in timber-frame construction have demonstrated that the material can reignite hours after apparent suppression, a behaviour that demands rethinking of fire service protocols and building management procedures.</p>
<p>Arjun Nair, reviewing the technical literature, notes a significant publication bias: "The studies that show good fire performance are widely cited. The studies that document failure modes are less prominent. The industry has an incentive to emphasise the positive, and regulatory bodies are still developing the expertise to interrogate the claims critically."</p>

<h2>Moisture and Long-Term Performance</h2>
<p>Timber is hygroscopic—it absorbs and releases moisture in response to ambient conditions. In buildings where this is poorly managed, the consequences range from dimensional instability and connection loosening to fungal decay. The durability data for modern mass timber products used in completed buildings is limited simply because most of the buildings are less than fifteen years old.</p>
<p>The envelope design requirements for mass timber buildings are significantly more demanding than for concrete or steel structures. The industry's increasing use of CLT in exposed applications—ceilings, walls, floors visible to occupants—creates additional constraints: moisture management must be achieved without concealing surfaces, and any remediation requires temporary disruption of occupied spaces.</p>

<h2>The Carbon Accounting Problem</h2>
<p>The sequestration benefit of mass timber depends critically on what happens to the forest when the timber is harvested. A sustainably managed forest where harvested trees are replaced by regrowth does sequester carbon over time. But the carbon accounting is complex: the regrowth cycle takes decades; the young trees replacing mature ones sequester less carbon per hectare than the original stand; and the counterfactual—what would have happened to the carbon had the forest not been harvested—is rarely calculated.</p>
<p>A 2020 paper in Nature Climate Change found that in many regions, leaving forests unharvested sequesters more carbon than harvesting for mass timber, even accounting for the substitution benefits of displacing concrete and steel. This does not invalidate mass timber as a low-carbon strategy, but it does complicate the categorical claim that "timber is carbon-positive."</p>

<h2>The Path Forward</h2>
<p>None of this is an argument against mass timber. It is an argument for appropriate engineering rigour and honest carbon accounting. The structural and thermal benefits of mass timber are real; the fire performance, when properly designed for, is acceptable; and the carbon balance, from well-managed forests, is favourable compared to conventional alternatives. But the industry needs to maintain its credibility by engaging honestly with the limitations, rather than allowing enthusiasm to outrun the evidence base.</p>`,
    readingTimeMinutes: 10,
    publishedAt: '2025-03-10',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)',
    authors: [AUTHORS.arjun_nair],
    sources: [
      { label: 'WoodSolutions Technical Design Guide', url: 'https://www.woodsolutions.com.au/', publisher: 'WoodSolutions', year: 2023 },
      { label: 'SOM Timber Tower Research', url: 'https://www.som.com/research/timber-tower/', publisher: 'SOM' },
      { label: 'Forest Carbon Accounting — Nature', url: 'https://doi.org/10.1038/s41558-020-0819-3', publisher: 'Nature Climate Change', year: 2020 },
    ],
  },
  {
    id: 4,
    slug: 'informal-urbanism-beirut',
    title: 'Informal Urbanism and the Right to the City: Lessons from Beirut',
    subtitle: 'How decades of state neglect produced a resilient, if precarious, informal housing sector',
    category: 'Urban Planning',
    tags: ['informality', 'Beirut', 'MENA', 'land tenure', 'post-conflict'],
    excerpt:
      `In the wake of the 2020 port explosion, Beirut's informal settlements demonstrated both extraordinary community resilience and the devastating vulnerability that comes with legal precarity. The reconstruction debate forces a reckoning with who the city is for.`,
    body: `<h2>The City Before the Blast</h2>
<p>Beirut has always been a city of informal arrangements. The Lebanese state's historic weakness—a deliberate design feature of a confessional political system that distributes authority across sectarian communities—meant that urban development was never centrally managed. The result is a city of extraordinary heterogeneity: luxury towers and informal settlements on adjacent plots, formal title and squatter occupation in the same neighbourhood, world-class restaurants and uncollected rubbish on the same street.</p>
<p>This informality was not a failure of development but, in many ways, its engine. The informal sector housed the workers who built and serviced the formal economy. The neighbourhoods of Bourj Hammoud, Mar Mikhael, and Karantina—historically marginal, informally occupied—became, by the 2000s and 2010s, the creative and social heart of the city.</p>

<h2>August 4, 2020</h2>
<p>The explosion of 2,750 tonnes of ammonium nitrate in Beirut's port on August 4, 2020, killed more than 200 people, injured 7,000, and left an estimated 300,000 homeless. The blast radius extended across the city's most densely inhabited neighbourhoods. The physical destruction was catastrophic; the social and institutional consequences were, in many ways, more severe.</p>
<p>In the immediate aftermath, the Lebanese state was largely absent. Cleanup, emergency housing, and basic services were provided by NGOs, diaspora networks, and—most significantly—by the informal community structures that had operated in these neighbourhoods for decades. The sectarian political parties, which function in Lebanon as quasi-governmental service providers, channelled aid through their networks. Civil society organisations coordinated without waiting for a state that did not arrive.</p>

<h2>The Reconstruction Trap</h2>
<p>The reconstruction of post-disaster cities is one of the most extensively documented phenomena in urban studies, and the findings are consistently troubling. Disaster recovery tends to accelerate pre-existing patterns of displacement: the poor and informally housed lose their homes; reconstruction investment flows to higher-value uses; the neighbourhood that existed before is replaced by one that serves a different population.</p>
<p>Leila Haddad's fieldwork in the months following the explosion documented this dynamic in real time. "The conversations about reconstruction were dominated by international consultants, real estate developers, and politicians with interests in land near the port," she writes. "The residents who had lived in these neighbourhoods for generations were being consulted in the form of 'engagement sessions' that had no binding effect on plans that were already being made."</p>

<h2>Land Tenure as the Central Question</h2>
<p>The fundamental vulnerability of Beirut's informal residents is legal: they do not own the land they live on, and many do not have formal tenancy agreements. In Lebanon's complex land registration system—a legacy of Ottoman, French Mandate, and post-independence layers of legislation—many properties in informal areas have unclear or contested title. This legal ambiguity, which residents have lived with for generations, becomes a devastating vulnerability when external actors want to develop the land.</p>
<p>Community land trusts and collective tenure arrangements have been proposed by urban researchers and some NGOs as mechanisms to secure tenure without requiring individual formalisation. The political obstacles are significant: large landowners and developers who benefit from the current ambiguity have no interest in regularisation, and the political parties that might champion the poor have their own interests in maintaining client relationships rather than empowering independent tenure.</p>

<h2>What Beirut Teaches</h2>
<p>The lesson of Beirut is not that informality is desirable. It is that informal urbanism, in conditions of state weakness, performs functions that formal systems do not. It houses people the formal market will not serve, creates social networks that formal institutions do not support, and generates economic activity that official statistics do not count. When planners and policymakers treat informality as a problem to be eradicated rather than a condition to be improved, they consistently produce worse outcomes for the people they claim to be helping.</p>
<p>The right to the city—Henri Lefebvre's concept, now enshrined in the constitutions of several Latin American countries—asserts that urban inhabitants have a collective right to shape the city, not merely to reside in it. In Beirut's reconstruction, that right is being contested. The outcome will determine whether the city remains a place for everyone or becomes, like so many post-disaster cities, a place for those who can afford it.</p>`,
    readingTimeMinutes: 14,
    publishedAt: '2025-02-14',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #065f46 0%, #022c22 100%)',
    authors: [AUTHORS.leila_haddad, AUTHORS.priya_menon],
    sources: [
      { label: 'UN-Habitat — Cities and Climate Change', url: 'https://unhabitat.org/', publisher: 'UN-Habitat' },
      { label: 'Davie, "Beirut: Morphologies of a City"', url: '#', publisher: 'University of Exeter Press', year: 2003 },
      { label: 'Human Rights Watch — Lebanon Housing', url: 'https://www.hrw.org/', publisher: 'HRW', year: 2021 },
    ],
  },
  {
    id: 5,
    slug: 'net-zero-policy-india',
    title: `India's Net-Zero Built Environment: Policy Gap or Implementation Gap?`,
    subtitle: 'The Energy Conservation Building Code exists. The question is why it barely gets enforced.',
    category: 'Sustainability',
    tags: ['policy', 'ECBC', 'India', 'net-zero', 'enforcement'],
    excerpt:
      `India's ECBC has been on the books since 2007. Yet commercial buildings routinely exceed code energy benchmarks by 40–60%. This piece examines the institutional, financial, and political reasons enforcement lags far behind legislation.`,
    body: `<h2>The Code That Exists on Paper</h2>
<p>India's Energy Conservation Building Code (ECBC) was first published in 2007 and substantially revised in 2017. It sets minimum standards for the energy performance of commercial buildings, covering envelope, lighting, HVAC, and water heating systems. The Bureau of Energy Efficiency (BEE) estimates that full compliance would reduce commercial building energy consumption by 25–50% compared to typical current construction.</p>
<p>The ECBC has been adopted as mandatory by fewer than ten states. In most of the country, it remains voluntary. Even where it is nominally mandatory, compliance monitoring is minimal and enforcement penalties are rarely applied. Suresh Varma, who has reviewed the compliance data across five major Indian cities, estimates that fewer than 15% of new commercial buildings actually meet ECBC standards.</p>

<h2>Why Enforcement Fails</h2>
<p>The enforcement gap reflects multiple overlapping failures. Building approval in India is a state and municipal function, but the technical capacity to evaluate ECBC compliance is concentrated in a handful of specialist agencies. Municipal building departments that process thousands of applications per year do not have the staff or the software to conduct energy performance assessments. The ECBC compliance documentation—energy simulation reports, equipment specifications, commissioning records—is often filed with applications and never reviewed.</p>
<p>The political economy of building approval further complicates enforcement. In Indian cities, the relationship between building developers and approval authorities is structured by informal payments and political relationships that create incentives for approval rather than scrutiny. An approving officer who delays a large commercial project for non-compliance with energy standards faces significant pressure; the developer's lawyers, political connections, and economic importance all push toward accommodation. The officer who enforces the code strictly has little institutional support and significant personal risk.</p>

<h2>The Financial Barrier</h2>
<p>Even where developers have genuine intent to comply, the upfront cost of ECBC-compliant systems presents a financing obstacle. High-performance glazing, efficient HVAC, and automated building management systems add 5–15% to construction costs. In a development sector that operates on thin margins and project finance structures that separate construction cost from operating cost, the party bearing the construction cost—the developer—has no direct financial benefit from energy savings that accrue to the building's occupants.</p>
<p>Green building rating systems (GRIHA, IGBC) have attempted to address this by creating reputational and, in some cities, regulatory incentives for high-performance buildings. Several state governments offer Floor Area Ratio (FAR) bonuses for green-rated buildings—allowing developers to build more floor space on a given plot in exchange for meeting higher performance standards. This is an elegant mechanism that aligns developer incentives with energy performance, but uptake has been concentrated in premium commercial developments where the reputational premium justifies the investment.</p>

<h2>The Data Desert</h2>
<p>Perhaps the most fundamental obstacle to improvement is the absence of reliable data. India does not have a systematic building energy use database. The studies that document the gap between ECBC standards and actual building performance are based on small samples of monitored buildings, not representative national data. Without accurate performance data, it is impossible to identify where enforcement is weakest, which building types are most non-compliant, or what interventions would most effectively close the gap.</p>
<p>The BEE's Star Rating Programme for commercial buildings—voluntary disclosure of energy performance—covers fewer than 5,000 buildings out of an estimated 700 million square metres of commercial floor space. Expanding mandatory energy disclosure, on the model of the EU's Energy Performance Certificates, would be a necessary precondition for evidence-based enforcement.</p>

<h2>The Path to Implementation</h2>
<p>Suresh Varma's prescription is characteristically structural: "The enforcement gap is not going to be closed by training more building inspectors or strengthening penalties. It requires changing the incentive structure so that compliance is the path of least resistance rather than an obstacle." His recommendations include mandatory third-party energy certification (removing compliance assessment from approval authorities), operating cost disclosure requirements for commercial leases, and expansion of FAR bonus programmes linked to verified post-occupancy performance rather than design intent.</p>
<p>India's net-zero ambitions are genuinely ambitious. The gap between ambition and implementation is not a uniquely Indian problem—it is a universal feature of building energy policy. But in a country adding commercial floor space at the rate India is, closing that gap is not an environmental luxury. It is a fiscal and energy security imperative.</p>`,
    readingTimeMinutes: 11,
    publishedAt: '2025-01-30',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #9d174d 0%, #500724 100%)',
    authors: [AUTHORS.suresh_varma],
    sources: [
      { label: 'BEE — ECBC 2017', url: 'https://beeindia.gov.in/', publisher: 'Bureau of Energy Efficiency', year: 2017 },
      { label: 'AEEE India Building Efficiency Report', url: 'https://aeee.in/', publisher: 'AEEE', year: 2023 },
      { label: 'World Bank — India Energy Efficiency', url: 'https://www.worldbank.org/', publisher: 'World Bank', year: 2022 },
    ],
  },
  {
    id: 6,
    slug: 'green-spaces-urban-heat',
    title: 'Urban Green Infrastructure: Cooling Effect or Carbon Accounting Trick?',
    subtitle: 'The science of urban heat island mitigation through green spaces is robust. The governance is not.',
    category: 'Urban Planning',
    tags: ['urban heat island', 'green infrastructure', 'urban ecology'],
    excerpt:
      'Trees, wetlands, and parks genuinely reduce ambient temperatures by 1–4°C in dense urban cores. But fragmented governance, underinvestment in maintenance, and a tendency to count "canopy cover pledges" rather than established trees means much of the benefit is theoretical.',
    body: `<h2>The Heat Island Effect</h2>
<p>Urban areas are hotter than their surrounding countryside. This is not a new observation—the urban heat island effect was first documented by Luke Howard in London in the 1810s—but it has acquired new urgency as global temperatures rise and urban populations grow. Dense cities with high proportions of impervious surface, waste heat from vehicles and buildings, and reduced natural ventilation can run 3–5°C warmer than nearby rural areas, with even larger differentials on hot nights.</p>
<p>The consequences are measured in mortality. A 2022 study published in Nature Medicine estimated that more than 60,000 Europeans died from heat-related causes in the summer of 2022. Urban residents, particularly the elderly and those without access to air conditioning, are disproportionately affected. Cities that have experienced catastrophic heat mortality events—Paris in 2003, Chicago in 1995—have developed urban heat island mitigation strategies with genuine urgency.</p>

<h2>What Green Infrastructure Can Do</h2>
<p>The evidence for urban green infrastructure as a cooling intervention is well-established. A large street tree can transpire 200–500 litres of water per day, with a cooling effect equivalent to five average domestic air conditioning units. Urban parks reduce ambient temperatures by 1–4°C within approximately 100 metres. Green roofs reduce surface temperatures by 20–30°C and building cooling loads by 10–30%.</p>
<p>Priya Menon, reviewing the monitoring data from fifty-seven urban greening projects across South and Southeast Asian cities, finds consistent cooling effects that exceed pre-intervention modelling predictions. "The cooling effect of trees is well understood," she notes. "What we underestimate is the co-benefits: reduced stormwater runoff, improved air quality, biodiversity habitat, mental health benefits. The case for urban greening is substantially stronger than the climate mitigation numbers alone suggest."</p>

<h2>The Governance Chasm</h2>
<p>The gap between ambition and delivery in urban greening is a governance story. Cities around the world have announced ambitious canopy cover targets: Singapore aims for 40% canopy cover by 2030; Melbourne targets 40% by 2040; London's draft London Plan includes urban greening factor requirements for new developments. These targets are not trivial political commitments.</p>
<p>What is frequently absent is the institutional capacity and sustained funding to deliver them. Street tree planting requires coordination between planning, highways, utilities (for underground service conflicts), and parks departments—typically separate organisations with separate budgets and competing priorities. Maintenance funding is perennially underprovided; trees planted without adequate ongoing care have high mortality rates, particularly in the first three to five years. The tendency to count pledged plantings rather than established trees in canopy cover statistics flatters urban greening programmes without reflecting ecological reality.</p>

<h2>Nature-Based Solutions and Their Limits</h2>
<p>The framing of urban green infrastructure as "nature-based solutions" to climate adaptation has attracted significant international funding attention. This is welcome; the historical underfunding of urban greening relative to grey infrastructure has been a persistent failure of urban governance. But the framing also creates risks: nature-based solutions are sometimes presented as scalable, cost-effective substitutes for structural adaptation measures (flood defences, building retrofits, urban cooling centres) rather than complements to them.</p>
<p>Suresh Varma is sceptical of the more expansive claims: "You cannot tree your way out of a city that is fundamentally designed for cars and air conditioning. Green infrastructure is necessary and insufficient. The cities that are genuinely adapting to heat are doing it with a combination of green infrastructure, building design requirements, public cooling infrastructure, and social systems to reach vulnerable people during heat events."</p>

<h2>From Pledge to Canopy</h2>
<p>The accountability gap in urban greening—between pledged planting and established trees—requires better monitoring systems and more honest reporting. Remote sensing technology now makes it feasible to track urban canopy cover changes at city scale with annual or biannual updates. Several cities have begun publishing canopy cover dashboards; the next step is to link these to accountability mechanisms that distinguish between planted trees, surviving trees, and mature trees contributing meaningfully to cooling.</p>
<p>The political difficulty is that honest accounting would reveal, in many cities, that canopy cover is declining rather than increasing—as mature trees are removed for development and infrastructure works and replacement plantings fail to survive. This is politically uncomfortable but necessary information if cities are to take urban greening seriously as a climate adaptation strategy rather than a public relations exercise.</p>`,
    readingTimeMinutes: 8,
    publishedAt: '2025-01-08',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #166534 0%, #052e16 100%)',
    authors: [AUTHORS.priya_menon, AUTHORS.suresh_varma],
    sources: [
      { label: 'Oke et al., "Urban Climates"', url: '#', publisher: 'Cambridge University Press', year: 2017 },
      { label: 'C40 Cities — Urban Cooling Initiative', url: 'https://www.c40.org/', publisher: 'C40' },
      { label: 'WHO — Urban Green Spaces and Health', url: 'https://www.who.int/', publisher: 'WHO', year: 2016 },
    ],
  },
  {
    id: 7,
    slug: 'smart-building-data-sovereignty',
    title: 'Smart Buildings and the Data Sovereignty Problem',
    subtitle: 'When your building knows more about you than your landlord, who owns that knowledge?',
    category: 'Technology',
    tags: ['smart buildings', 'IoT', 'data privacy', 'proptech'],
    excerpt:
      'The integration of BMS, occupancy sensors, energy metering, and access control into unified platforms creates genuinely useful buildings—and genuinely novel surveillance infrastructure. The regulatory frameworks are lagging badly.',
    body: `<h2>The Building That Watches</h2>
<p>Modern commercial buildings are information machines. Access control systems log every entry and exit. Occupancy sensors track the presence and movement of people across floors and rooms. Energy sub-metering reveals when spaces are used and by whom. Facial recognition systems in some jurisdictions have been deployed for both security and attendance monitoring. HVAC systems adjust to predicted occupancy, learning patterns from weeks and months of behavioural data. All of this data flows into Building Management Systems (BMS) platforms that are increasingly integrated with corporate HR systems, space management software, and facilities management tools.</p>
<p>The aggregate picture that emerges from this data is extraordinarily detailed. In a well-instrumented office building, a facilities manager—or a landlord, or a system provider, or a government authority with a subpoena—can reconstruct the movements, work patterns, meeting schedules, and social connections of every person in the building. This is not a theoretical future scenario; it is the operational reality of leading-edge commercial buildings constructed in the last five years.</p>

<h2>Who Owns the Data?</h2>
<p>The legal answer to data ownership in smart buildings is unclear and varies by jurisdiction. In principle, personal data—data that can identify an individual—is regulated under privacy law in most developed jurisdictions. The GDPR in Europe, the PDPA in Singapore, and various state privacy laws in the United States impose requirements for consent, purpose limitation, data minimisation, and individual rights of access and deletion.</p>
<p>In practice, the contracts that govern smart building data—between landlords and tenants, between building owners and BMS providers, between facilities managers and sub-contractors—are opaque and rarely reviewed by the individuals whose data they govern. A typical commercial lease does not specify what data is collected about tenants and their employees, how it is used, how long it is retained, or with whom it is shared. The occupant who swipes their access card is not consenting to anything specific; they are simply entering the building.</p>

<h2>The Aggregation Problem</h2>
<p>Even where individual data points are innocuous, their aggregation creates privacy risks that are qualitatively different from any single data point. Arjun Nair's analysis of a mid-sized London office building found that combining access control, occupancy, and energy metering data allowed the identification of individual employees' daily routines with greater precision than the employees themselves could recall.</p>
<p>This aggregation problem is not unique to smart buildings—it is a general feature of the data economy—but it is particularly acute in the built environment because buildings are involuntary contexts. People can choose not to use a particular app; they cannot choose not to be in the building where they work.</p>

<h2>Regulatory Lag</h2>
<p>The regulatory frameworks for smart building data are, by the consensus of privacy scholars and building technology practitioners alike, inadequate. The GDPR's principles apply in theory but are rarely enforced in the building technology context; data protection authorities have focused their enforcement attention on consumer technology companies rather than proptech. Building regulations in most jurisdictions do not address data collection requirements at all.</p>
<p>Priya Menon argues that the gap represents a failure of regulatory imagination: "We regulate the physical safety of buildings with extraordinary detail—structural loads, fire egress, electrical safety. We say nothing about the information environment that buildings create. This is inconsistent; the harms from inadequate data governance in buildings can be as serious as the harms from inadequate physical safety."</p>

<h2>Towards Data Sovereignty</h2>
<p>Several frameworks for improving smart building data governance have been proposed. Building data trusts—legal structures that hold building data on behalf of its subjects and impose fiduciary obligations on data users—have been piloted in urban data contexts. Mandatory data impact assessments for smart building installations, analogous to environmental impact assessments, would force developers and operators to think systematically about data governance before systems are deployed. Open standards for data portability would reduce vendor lock-in and allow occupants to verify what data is collected about them.</p>
<p>None of these is a complete solution. The fundamental challenge is that smart building data governance is a collective action problem: individual tenants and employees have little bargaining power relative to landlords, and landlords have little incentive to constrain data collection when data is valuable. Addressing it requires either regulatory mandate or the kind of institutional tenant organisation that characterises mature rental markets—neither of which is imminent in most contexts.</p>`,
    readingTimeMinutes: 10,
    publishedAt: '2024-12-20',
    featured: false,
    coverAccent: 'linear-gradient(135deg, #1e3a5f 0%, #0c1a2e 100%)',
    authors: [AUTHORS.arjun_nair, AUTHORS.priya_menon],
    sources: [
      { label: 'GDPR and Built Environments — CIBSE', url: 'https://www.cibse.org/', publisher: 'CIBSE', year: 2022 },
      { label: 'Electronic Frontier Foundation — Smart Buildings', url: 'https://www.eff.org/', publisher: 'EFF' },
    ],
  },
  {
    id: 8,
    slug: 'kerala-flood-resilient-housing',
    title: `Rebuilding After Floods: Kerala's Housing Resilience Experiment`,
    subtitle: 'The 2018 Kerala floods displaced 1.4 million. The reconstruction raised every question architects avoid.',
    category: 'Housing',
    tags: ['Kerala', 'flood resilience', 'post-disaster', 'vernacular', 'community housing'],
    excerpt:
      'Government resettlement schemes after the 2018 Kerala floods defaulted to concrete-box typologies that replicated pre-flood vulnerabilities in new locations. A handful of architect-led community projects tried something different—with mixed, instructive results.',
    body: `<h2>The Flood</h2>
<p>In August 2018, Kerala experienced its worst flooding in nearly a century. More than 480 people died; over 1.4 million were displaced into relief camps. The economic damage was estimated at ₹31,000 crore. The flood affected all fourteen districts of the state, overwhelming infrastructure that had been designed for historical rainfall patterns now comprehensively exceeded by climate change-amplified monsoons.</p>
<p>The flood revealed, with brutal clarity, the vulnerability of Kerala's housing stock. The state had experienced rapid economic growth over the preceding two decades, fuelled by Gulf remittances, and this growth had expressed itself architecturally in a proliferation of concrete houses—typically single-story structures built close to riverbeds and in flood plains, with minimal elevation above ground level and limited structural resilience to inundation and wave loading.</p>

<h2>The Government Response</h2>
<p>The Kerala government's primary reconstruction instrument was the LIFE (Livelihood Inclusion and Financial Empowerment) Mission, which provided housing to vulnerable households. The scheme's default typology was a standardised concrete structure: 340 square feet, flat roof, minimal variation across thousands of units delivered across the state.</p>
<p>Rajan Thomas, who participated in a post-occupancy evaluation of LIFE Mission units in Ernakulam and Alappuzha districts, is diplomatically critical: "The units are structurally sound, durable, and dry. They are also disconnected from how people actually live—the relationship between inside and outside, the provision for small-scale agriculture and animal husbandry, the social unit of the extended family rather than the nuclear household. Families have already started modifying them, and some modifications are reintroducing vulnerabilities."</p>

<h2>Architect-Led Alternatives</h2>
<p>Several architect-led community housing projects attempted different approaches. A project in Chengannur, coordinated by architecture students and faculty from the College of Engineering Trivandrum, worked with a community of forty-seven displaced households to design flood-resilient houses that incorporated vernacular spatial organisation—the nalukettu courtyard typology, adapted with elevated plinths, permeable ground floors, and roof forms that facilitate cross-ventilation.</p>
<p>The results were architecturally richer and more spatially adequate than LIFE Mission units, and the community participation process built social cohesion as well as physical shelter. They were also significantly more expensive and slower to deliver. In a disaster recovery context where speed and scale are critical, this trade-off is genuinely difficult to resolve.</p>

<h2>The Vernacular Resilience Argument</h2>
<p>Traditional Kerala architecture had evolved, over centuries, sophisticated responses to the monsoon. The nalukettu and ettukettu typologies—courtyard houses with high-pitched tiled roofs, deep verandahs, and latticed screens—managed humidity, channelled rainwater, and provided thermal comfort without mechanical systems. Critically, the elevated plinth (typically 600mm–900mm above ground level) and the raised threshold provided a first line of flood protection that concrete ground-floor slabs do not.</p>
<p>Leila Haddad, who has worked on post-disaster reconstruction in both Kerala and Lebanon, sees a consistent pattern: "Traditional building cultures embodied site-specific knowledge about flood, wind, and heat that took generations to develop. Industrial construction erases that knowledge in a single generation. Reconstruction is a moment where you could choose to recover it—but the institutional pressure is always toward speed, standardisation, and what can be procured at scale."</p>

<h2>Climate Change and Future Floods</h2>
<p>The 2018 flood was not an anomaly; it was a preview. Kerala experienced severe flooding again in 2019 and 2021. The Kerala State Disaster Management Authority's own projections anticipate intensifying monsoons, increased frequency of extreme rainfall events, and rising sea levels that will amplify coastal and riverine flood risk across the state.</p>
<p>This trajectory makes the quality of post-disaster reconstruction decisions not just a humanitarian question but a long-term infrastructure investment question. Houses built today will need to perform for fifty to a hundred years in conditions significantly more severe than those they were designed for. The concrete boxes being built in flood plains today, elevated to current plinth requirements, may be inadequate for the flood events of 2040 or 2050.</p>

<h2>What Reconstruction Could Be</h2>
<p>The most instructive examples from Kerala suggest that the binary—speed/scale on one hand, quality/appropriateness on the other—is a false choice, but only if the institutional preparation happens before the disaster rather than after it. States that have pre-approved, locally adapted design typologies, established community engagement protocols, and pre-qualified architect networks can deliver better outcomes faster when disaster strikes. Kerala's experience is generating exactly this institutional learning; the question is whether it will be institutionalised before the next flood, or rediscovered in its aftermath.</p>`,
    readingTimeMinutes: 13,
    publishedAt: '2024-11-15',
    featured: true,
    coverAccent: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
    authors: [AUTHORS.rajan_thomas, AUTHORS.leila_haddad],
    sources: [
      { label: 'Kerala State Disaster Management Authority', url: 'https://sdma.kerala.gov.in/', publisher: 'KSDMA', year: 2019 },
      { label: 'Lizarralde, "Invisible Houses"', url: '#', publisher: 'Routledge', year: 2011 },
      { label: 'UN-Habitat Post-Disaster Reconstruction Guidelines', url: 'https://unhabitat.org/', publisher: 'UN-Habitat' },
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