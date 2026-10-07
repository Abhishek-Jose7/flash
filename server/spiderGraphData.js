/**
 * The Amazing Spider-Man 2 (TASM2) Precision Vector Graph
 * Authentic silhouette:
 * - Sharp fangs & head apex
 * - Elongated narrow hourglass thorax & abdomen teardrop
 * - 4 Upper Legs: Arched upward with high elbow bends & sweeping outward talons
 * - 4 Lower Legs: Razor-sharp elongated downward fangs tapering to bottom
 * Normalized to [0, 1000] x [0, 1000] with center at x = 500
 */

export const SPIDER_NODES = [
  // --- HEAD & FANGS (0 - 3) ---
  { id: 0, x: 500, y: 140, group: 'head', label: 'Head Apex' },
  { id: 1, x: 480, y: 175, group: 'head', label: 'Fang Left' },
  { id: 2, x: 520, y: 175, group: 'head', label: 'Fang Right' },
  { id: 3, x: 500, y: 210, group: 'head', label: 'Head Base' },

  // --- THORAX SHIELD & HOURGLASS WAIST (4 - 9) ---
  { id: 4, x: 500, y: 250, group: 'thorax', label: 'Upper Thorax' },
  { id: 5, x: 478, y: 285, group: 'thorax', label: 'Chest Left' },
  { id: 6, x: 522, y: 285, group: 'thorax', label: 'Chest Right' },
  { id: 7, x: 500, y: 320, group: 'thorax', label: 'Mid Thorax' },
  { id: 8, x: 490, y: 360, group: 'thorax', label: 'Waist Left' },
  { id: 9, x: 510, y: 360, group: 'thorax', label: 'Waist Right' },

  // --- ABDOMEN & NEEDLE SPINNERET (10 - 15) ---
  { id: 10, x: 500, y: 400, group: 'abdomen', label: 'Abdomen Top' },
  { id: 11, x: 482, y: 440, group: 'abdomen', label: 'Abdomen Flank L' },
  { id: 12, x: 518, y: 440, group: 'abdomen', label: 'Abdomen Flank R' },
  { id: 13, x: 500, y: 490, group: 'abdomen', label: 'Abdomen Mid' },
  { id: 14, x: 500, y: 550, group: 'abdomen', label: 'Abdomen Lower' },
  { id: 15, x: 500, y: 620, group: 'abdomen', label: 'Spinneret Needle' },

  // --- UPPER LEG 1 (Topmost Arch) (16 - 23) ---
  // Left 1
  { id: 16, x: 475, y: 235, group: 'leg_u1', label: 'Root U1-L' },
  { id: 17, x: 390, y: 155, group: 'leg_u1', label: 'Elbow High U1-L' },
  { id: 18, x: 290, y: 145, group: 'leg_u1', label: 'Arch Peak U1-L' },
  { id: 19, x: 190, y: 230, group: 'leg_u1', label: 'Talon Tip U1-L' },
  // Right 1
  { id: 20, x: 525, y: 235, group: 'leg_u1', label: 'Root U1-R' },
  { id: 21, x: 610, y: 155, group: 'leg_u1', label: 'Elbow High U1-R' },
  { id: 22, x: 710, y: 145, group: 'leg_u1', label: 'Arch Peak U1-R' },
  { id: 23, x: 810, y: 230, group: 'leg_u1', label: 'Talon Tip U1-R' },

  // --- UPPER LEG 2 (Second High Arch) (24 - 31) ---
  // Left 2
  { id: 24, x: 470, y: 275, group: 'leg_u2', label: 'Root U2-L' },
  { id: 25, x: 370, y: 225, group: 'leg_u2', label: 'Elbow U2-L' },
  { id: 26, x: 250, y: 250, group: 'leg_u2', label: 'Arch U2-L' },
  { id: 27, x: 150, y: 370, group: 'leg_u2', label: 'Talon Tip U2-L' },
  // Right 2
  { id: 28, x: 530, y: 275, group: 'leg_u2', label: 'Root U2-R' },
  { id: 29, x: 630, y: 225, group: 'leg_u2', label: 'Elbow U2-R' },
  { id: 30, x: 750, y: 250, group: 'leg_u2', label: 'Arch U2-R' },
  { id: 31, x: 850, y: 370, group: 'leg_u2', label: 'Talon Tip U2-R' },

  // --- LOWER LEG 3 (Downward Lateral Sweep) (32 - 39) ---
  // Left 3
  { id: 32, x: 475, y: 340, group: 'leg_d1', label: 'Root D1-L' },
  { id: 33, x: 360, y: 385, group: 'leg_d1', label: 'Knee D1-L' },
  { id: 34, x: 255, y: 495, group: 'leg_d1', label: 'Shaft D1-L' },
  { id: 35, x: 195, y: 680, group: 'leg_d1', label: 'Claw Tip D1-L' },
  // Right 3
  { id: 36, x: 525, y: 340, group: 'leg_d1', label: 'Root D1-R' },
  { id: 37, x: 640, y: 385, group: 'leg_d1', label: 'Knee D1-R' },
  { id: 38, x: 745, y: 495, group: 'leg_d1', label: 'Shaft D1-R' },
  { id: 39, x: 805, y: 680, group: 'leg_d1', label: 'Claw Tip D1-R' },

  // --- LOWER LEG 4 (Iconic TASM2 Long Elongated Fangs) (40 - 47) ---
  // Left 4
  { id: 40, x: 485, y: 410, group: 'leg_d2', label: 'Root D2-L' },
  { id: 41, x: 395, y: 520, group: 'leg_d2', label: 'Knee Low D2-L' },
  { id: 42, x: 320, y: 695, group: 'leg_d2', label: 'Shaft D2-L' },
  { id: 43, x: 280, y: 890, group: 'leg_d2', label: 'Razor Fangs D2-L' },
  // Right 4
  { id: 44, x: 515, y: 410, group: 'leg_d2', label: 'Root D2-R' },
  { id: 45, x: 605, y: 520, group: 'leg_d2', label: 'Knee Low D2-R' },
  { id: 46, x: 680, y: 695, group: 'leg_d2', label: 'Shaft D2-R' },
  { id: 47, x: 720, y: 890, group: 'leg_d2', label: 'Razor Fangs D2-R' }
];

export const SPIDER_EDGES = [
  // Head & Neck
  [0, 1], [0, 2], [1, 3], [2, 3], [3, 4],

  // Thorax Contour & Waist
  [4, 5], [4, 6], [5, 7], [6, 7],
  [7, 8], [7, 9], [8, 10], [9, 10],

  // Abdomen Diamond & Needle
  [10, 11], [10, 12], [11, 13], [12, 13],
  [13, 14], [14, 15],

  // Leg U1 (Top Arch)
  [4, 16], [16, 17], [17, 18], [18, 19],
  [4, 20], [20, 21], [21, 22], [22, 23],

  // Leg U2 (Mid Arch)
  [7, 24], [24, 25], [25, 26], [26, 27],
  [7, 28], [28, 29], [29, 30], [30, 31],

  // Leg D1 (Lateral Down)
  [8, 32], [32, 33], [33, 34], [34, 35],
  [9, 36], [36, 37], [37, 38], [38, 39],

  // Leg D2 (Long Rear Fangs)
  [10, 40], [40, 41], [41, 42], [42, 43],
  [10, 44], [44, 45], [45, 46], [46, 47],

  // Web Tendon Braces (TASM2 structural web cross-ties)
  [16, 24], [20, 28],
  [24, 32], [28, 36],
  [32, 40], [36, 44],
  [17, 25], [21, 29],
  [33, 41], [37, 45]
];

/**
 * 8 Progressive Unlock Tiers
 * Unlocks the Amazing Spider-Man 2 emblem from core outwards to the razor tips!
 */
export const UNLOCK_TIERS = [
  {
    tier: 1,
    title: "Head & Fangs Awoken",
    nodes: [0, 1, 2, 3],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]
  },
  {
    tier: 2,
    title: "Thorax Core & Spine Formed",
    nodes: [4, 5, 6, 7, 8, 9, 10],
    edges: [
      [4, 5], [4, 6], [5, 7], [6, 7],
      [7, 8], [7, 9], [8, 10], [9, 10]
    ]
  },
  {
    tier: 3,
    title: "Abdomen Needle Blade",
    nodes: [11, 12, 13, 14, 15],
    edges: [
      [10, 11], [10, 12], [11, 13], [12, 13],
      [13, 14], [14, 15]
    ]
  },
  {
    tier: 4,
    title: "Upper Leg Tendons Primed",
    nodes: [16, 20, 24, 28],
    edges: [
      [4, 16], [4, 20], [7, 24], [7, 28],
      [16, 24], [20, 28]
    ]
  },
  {
    tier: 5,
    title: "Upper Arches & Talons Deployed",
    nodes: [17, 18, 19, 21, 22, 23, 25, 26, 27, 29, 30, 31],
    edges: [
      [16, 17], [17, 18], [18, 19],
      [20, 21], [21, 22], [22, 23],
      [24, 25], [25, 26], [26, 27],
      [28, 29], [29, 30], [30, 31],
      [17, 25], [21, 29]
    ]
  },
  {
    tier: 6,
    title: "Lower Leg Roots Anchored",
    nodes: [32, 36, 40, 44],
    edges: [
      [8, 32], [9, 36], [10, 40], [10, 44],
      [24, 32], [28, 36], [32, 40], [36, 44]
    ]
  },
  {
    tier: 7,
    title: "Lateral Spider Claws Extended",
    nodes: [33, 34, 35, 37, 38, 39],
    edges: [
      [32, 33], [33, 34], [34, 35],
      [36, 37], [37, 38], [38, 39]
    ]
  },
  {
    tier: 8,
    title: "AMAZING SPIDER-MAN 2 FULLY ASSEMBLED",
    nodes: [41, 42, 43, 45, 46, 47],
    edges: [
      [40, 41], [41, 42], [42, 43],
      [44, 45], [45, 46], [46, 47],
      [33, 41], [37, 45]
    ]
  }
];

export const TOTAL_NODES = SPIDER_NODES.length;
export const TOTAL_EDGES = SPIDER_EDGES.length;
