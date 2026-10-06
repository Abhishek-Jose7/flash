/**
 * Predefined Mathematical Graph of The Amazing Spider-Man Emblem
 * 48 Nodes, 68 Edges, 8 Progressive Unlock Tiers
 * Coordinate system normalized to [0, 1000] x [0, 1000]
 */

export const SPIDER_NODES = [
  // --- BODY CORE (0 - 11) ---
  { id: 0, x: 500, y: 190, group: 'head', label: 'Apex' },
  { id: 1, x: 476, y: 220, group: 'head', label: 'Fang L' },
  { id: 2, x: 524, y: 220, group: 'head', label: 'Fang R' },
  { id: 3, x: 500, y: 260, group: 'thorax', label: 'Upper Thorax' },
  { id: 4, x: 500, y: 320, group: 'thorax', label: 'Mid Thorax' },
  { id: 5, x: 500, y: 380, group: 'thorax', label: 'Waist Pinch' },
  { id: 6, x: 468, y: 430, group: 'abdomen', label: 'Abdomen L1' },
  { id: 7, x: 532, y: 430, group: 'abdomen', label: 'Abdomen R1' },
  { id: 8, x: 500, y: 470, group: 'abdomen', label: 'Abdomen Mid' },
  { id: 9, x: 478, y: 520, group: 'abdomen', label: 'Abdomen L2' },
  { id: 10, x: 522, y: 520, group: 'abdomen', label: 'Abdomen R2' },
  { id: 11, x: 500, y: 580, group: 'abdomen', label: 'Spinneret' },

  // --- UPPER LEG 1 (Topmost Upward Arch) (12 - 19) ---
  { id: 12, x: 470, y: 250, group: 'leg_u1', label: 'Joint U1-L' },
  { id: 13, x: 385, y: 175, group: 'leg_u1', label: 'Knee U1-L' },
  { id: 14, x: 295, y: 165, group: 'leg_u1', label: 'Arch U1-L' },
  { id: 15, x: 215, y: 245, group: 'leg_u1', label: 'Tip U1-L' },
  { id: 16, x: 530, y: 250, group: 'leg_u1', label: 'Joint U1-R' },
  { id: 17, x: 615, y: 175, group: 'leg_u1', label: 'Knee U1-R' },
  { id: 18, x: 705, y: 165, group: 'leg_u1', label: 'Arch U1-R' },
  { id: 19, x: 785, y: 245, group: 'leg_u1', label: 'Tip U1-R' },

  // --- UPPER LEG 2 (Second Upward Arch) (20 - 27) ---
  { id: 20, x: 462, y: 300, group: 'leg_u2', label: 'Joint U2-L' },
  { id: 21, x: 360, y: 260, group: 'leg_u2', label: 'Knee U2-L' },
  { id: 22, x: 260, y: 280, group: 'leg_u2', label: 'Arch U2-L' },
  { id: 23, x: 175, y: 390, group: 'leg_u2', label: 'Tip U2-L' },
  { id: 24, x: 538, y: 300, group: 'leg_u2', label: 'Joint U2-R' },
  { id: 25, x: 640, y: 260, group: 'leg_u2', label: 'Knee U2-R' },
  { id: 26, x: 740, y: 280, group: 'leg_u2', label: 'Arch U2-R' },
  { id: 27, x: 825, y: 390, group: 'leg_u2', label: 'Tip U2-R' },

  // --- LOWER LEG 3 (Downward Lateral) (28 - 35) ---
  { id: 28, x: 465, y: 365, group: 'leg_d1', label: 'Joint D1-L' },
  { id: 29, x: 345, y: 415, group: 'leg_d1', label: 'Knee D1-L' },
  { id: 30, x: 240, y: 525, group: 'leg_d1', label: 'Shaft D1-L' },
  { id: 31, x: 190, y: 675, group: 'leg_d1', label: 'Tip D1-L' },
  { id: 32, x: 535, y: 365, group: 'leg_d1', label: 'Joint D1-R' },
  { id: 33, x: 655, y: 415, group: 'leg_d1', label: 'Knee D1-R' },
  { id: 34, x: 760, y: 525, group: 'leg_d1', label: 'Shaft D1-R' },
  { id: 35, x: 810, y: 675, group: 'leg_d1', label: 'Tip D1-R' },

  // --- LOWER LEG 4 (Long Downward Fangs) (36 - 43) ---
  { id: 36, x: 478, y: 430, group: 'leg_d2', label: 'Joint D2-L' },
  { id: 37, x: 385, y: 535, group: 'leg_d2', label: 'Knee D2-L' },
  { id: 38, x: 305, y: 685, group: 'leg_d2', label: 'Shaft D2-L' },
  { id: 39, x: 265, y: 855, group: 'leg_d2', label: 'Tip D2-L' },
  { id: 40, x: 522, y: 430, group: 'leg_d2', label: 'Joint D2-R' },
  { id: 41, x: 615, y: 535, group: 'leg_d2', label: 'Knee D2-R' },
  { id: 42, x: 695, y: 685, group: 'leg_d2', label: 'Shaft D2-R' },
  { id: 43, x: 735, y: 855, group: 'leg_d2', label: 'Tip D2-R' },

  // --- SPIDERWEB MATRIX CONNECTORS (44 - 47) ---
  { id: 44, x: 425, y: 235, group: 'web_lattice', label: 'Web L-Top' },
  { id: 45, x: 575, y: 235, group: 'web_lattice', label: 'Web R-Top' },
  { id: 46, x: 330, y: 355, group: 'web_lattice', label: 'Web L-Mid' },
  { id: 47, x: 670, y: 355, group: 'web_lattice', label: 'Web R-Mid' }
];

export const SPIDER_EDGES = [
  // Spine & Thorax
  [0, 1], [0, 2], [1, 3], [2, 3],
  [3, 4], [4, 5],
  [5, 6], [5, 7], [6, 8], [7, 8],
  [8, 9], [8, 10], [9, 11], [10, 11],

  // Leg U1
  [3, 12], [12, 13], [13, 14], [14, 15],
  [3, 16], [16, 17], [17, 18], [18, 19],

  // Leg U2
  [4, 20], [20, 21], [21, 22], [22, 23],
  [4, 24], [24, 25], [25, 26], [26, 27],

  // Leg D1
  [5, 28], [28, 29], [29, 30], [30, 31],
  [5, 32], [32, 33], [33, 34], [34, 35],

  // Leg D2
  [8, 36], [36, 37], [37, 38], [38, 39],
  [8, 40], [40, 41], [41, 42], [42, 43],

  // Cross Web Lattice
  [12, 44], [44, 13], [16, 45], [45, 17],
  [20, 46], [46, 21], [24, 47], [47, 25],
  [44, 20], [45, 24], [46, 29], [47, 33],
  [21, 46], [25, 47], [29, 37], [33, 41],
  [30, 38], [34, 42]
];

/**
 * 8 Progressive Unlock Tiers
 * Each tier unlocks a deterministic list of nodes and edges.
 */
export const UNLOCK_TIERS = [
  {
    tier: 1,
    title: "Thorax Core Activated",
    nodes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    edges: [
      [0, 1], [0, 2], [1, 3], [2, 3],
      [3, 4], [4, 5],
      [5, 6], [5, 7], [6, 8], [7, 8],
      [8, 9], [8, 10], [9, 11], [10, 11]
    ]
  },
  {
    tier: 2,
    title: "Spider-Web Roots Bound",
    nodes: [12, 16, 20, 24, 28, 32, 36, 40, 44, 45, 46, 47],
    edges: [
      [3, 12], [3, 16], [4, 20], [4, 24],
      [5, 28], [5, 32], [8, 36], [8, 40],
      [12, 44], [16, 45], [20, 46], [24, 47],
      [44, 20], [45, 24]
    ]
  },
  {
    tier: 3,
    title: "Upper Fang Knees Ignited",
    nodes: [13, 17, 21, 25],
    edges: [
      [12, 13], [16, 17], [44, 13], [45, 17],
      [20, 21], [24, 25], [46, 21], [47, 25],
      [21, 46], [25, 47]
    ]
  },
  {
    tier: 4,
    title: "Upper Web Arches Unlocked",
    nodes: [14, 18, 22, 26],
    edges: [
      [13, 14], [17, 18],
      [21, 22], [25, 26]
    ]
  },
  {
    tier: 5,
    title: "Upper Fangs Fully Deployed",
    nodes: [15, 19, 23, 27],
    edges: [
      [14, 15], [18, 19],
      [22, 23], [26, 27]
    ]
  },
  {
    tier: 6,
    title: "Lower Knees Shockwave",
    nodes: [29, 33, 37, 41],
    edges: [
      [28, 29], [32, 33], [46, 29], [47, 33],
      [36, 37], [40, 41], [29, 37], [33, 41]
    ]
  },
  {
    tier: 7,
    title: "Venom Shafts Primed",
    nodes: [30, 34, 38, 42],
    edges: [
      [29, 30], [33, 34],
      [37, 38], [41, 42],
      [30, 38], [34, 42]
    ]
  },
  {
    tier: 8,
    title: "AMAZING SPIDER-MAN 100% ASSEMBLED",
    nodes: [31, 35, 39, 43],
    edges: [
      [30, 31], [34, 35],
      [38, 39], [42, 43]
    ]
  }
];

export const TOTAL_NODES = SPIDER_NODES.length;
export const TOTAL_EDGES = SPIDER_EDGES.length;
