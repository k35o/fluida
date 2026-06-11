/**
 * 厳選パレット。どの色を選んでも調和するよう、アクリルポーリングの
 * 定番配色からキャンバスの色（paper）と絵の具5色（inks）の組を
 * キュレーションしている。
 */
export type Palette = {
  id: string;
  name: string;
  description: string;
  paper: string;
  inks: readonly string[];
};

/** 絵の具の選び方。'auto' は順繰り、'paper' はキャンバスの色 */
export type InkChoice = 'auto' | 'paper' | number;

// inks の並びは「じゅんばん」の巡回順。隣り合う色が
// 対照的になるよう、明暗・彩度を交互に並べている。
const TSUKIYO: Palette = {
  id: 'marble',
  name: 'つきよ',
  description: '黒と白に、金をひとすじ',
  paper: '#f1efe9',
  inks: ['#1f1f24', '#ffffff', '#d2a72e', '#7d7d86', '#3a3a44'],
};

const UMI: Palette = {
  id: 'ocean',
  name: 'うみ',
  description: '深い海とあさぎ、波打つ金',
  paper: '#eef3f4',
  inks: ['#0f3a64', '#ffffff', '#13869d', '#d3a73c', '#5fc4c6'],
};

const YUYAKE: Palette = {
  id: 'sunset',
  name: 'ゆうやけ',
  description: 'あかねとこはくの夕暮れ',
  paper: '#f9f2e9',
  inks: ['#d94f5c', '#f9e3c8', '#933b67', '#f4b942', '#ef7d3b'],
};

const SUMIRE: Palette = {
  id: 'berry',
  name: 'すみれ',
  description: '熟した紫と、ほんのり桃',
  paper: '#f5f1f5',
  inks: ['#43285e', '#f0d3e6', '#d772ae', '#2b1a40', '#8e3d87'],
};

const TSUCHI: Palette = {
  id: 'terracotta',
  name: 'つち',
  description: 'あたたかな土と、よもぎの緑',
  paper: '#f7f2ea',
  inks: ['#a8502f', '#e3c6a0', '#5d6b51', '#cf8347', '#714434'],
};

const MORI: Palette = {
  id: 'forest',
  name: 'もり',
  description: '深い森のみどりと、金のさし色',
  paper: '#eff3ee',
  inks: ['#16453a', '#a5c9a1', '#cfa84e', '#0e2a24', '#3f8d66'],
};

const SAKURA: Palette = {
  id: 'sakura',
  name: 'さくら',
  description: 'はるの桃いろと、わかばの緑',
  paper: '#faf4f4',
  inks: ['#b8476a', '#ffffff', '#5d3a47', '#f3a7b9', '#9ab886'],
};

const SORA: Palette = {
  id: 'sky',
  name: 'そら',
  description: 'はれた空と雲、おひさまの金',
  paper: '#f3f7fa',
  inks: ['#2f6bb0', '#ffffff', '#5e7fa6', '#f2c14e', '#8ec9e8'],
};

export const PALETTES: readonly Palette[] = [
  UMI,
  MORI,
  TSUKIYO,
  YUYAKE,
  SORA,
  SAKURA,
  SUMIRE,
  TSUCHI,
];

export const DEFAULT_PALETTE: Palette = UMI;

export function findPalette(id: string): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? DEFAULT_PALETTE;
}
