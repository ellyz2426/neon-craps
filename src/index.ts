import {
  World,
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  Follower,
  ScreenSpace,
  InputComponent,
  eq,
  Entity,
  BoxGeometry as IWSDKBoxGeometry,
  SphereGeometry as IWSDKSphereGeometry,
} from '@iwsdk/core';
import {
  Mesh,
  MeshStandardMaterial,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  TorusGeometry,
  OctahedronGeometry,
  ConeGeometry,
  RingGeometry,
  Group,
  Vector3,
  Color,
  FogExp2,
  DirectionalLight,
  AmbientLight,
  PointLight,
  AdditiveBlending,
  DoubleSide,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  Raycaster,
  Vector2,
  Object3D,
} from '@iwsdk/core';

// ============================================================
// GAME CONSTANTS & TYPES
// ============================================================
type GameState = 'title' | 'mode' | 'difficulty' | 'countdown' | 'betting' | 'rolling' | 'result' | 'pause' | 'gameover' | 'leaderboard' | 'achievements' | 'stats' | 'settings' | 'help' | 'skins' | 'history' | 'bets' | 'payouts' | 'strategy';
type GameMode = 'classic' | 'speed' | 'practice' | 'highroller' | 'daily' | 'session' | 'marathon' | 'tutorial';
type CrapsPhase = 'comeout' | 'point';
type BetType = 'pass' | 'dontpass' | 'come' | 'dontcome' | 'field' | 'place4' | 'place5' | 'place6' | 'place8' | 'place9' | 'place10' | 'hard4' | 'hard6' | 'hard8' | 'hard10' | 'anyseven' | 'anycraps' | 'yo' | 'aces' | 'boxcars' | 'odds_pass' | 'odds_dontpass' | 'big6' | 'big8';

interface Bet { type: BetType; amount: number; }
interface RollResult { die1: number; die2: number; total: number; }
interface Achievement { id: string; name: string; desc: string; unlocked: boolean; }

const THEMES = [
  { name: 'Neon Holodeck', grid: '#004444', accent: '#00ffff', bg: '#000a0a', fog: '#001111', wall: '#003333', table: '#003322', felt: '#004433', puck: '#ffff00' },
  { name: 'Crimson Casino', grid: '#440000', accent: '#ff4444', bg: '#0a0000', fog: '#110000', wall: '#330000', table: '#330011', felt: '#440022', puck: '#ffaa00' },
  { name: 'Gold Palace', grid: '#443300', accent: '#ffaa00', bg: '#0a0800', fog: '#110a00', wall: '#332200', table: '#332200', felt: '#443300', puck: '#ffffff' },
  { name: 'Ultra Violet', grid: '#220044', accent: '#aa44ff', bg: '#050008', fog: '#080011', wall: '#330055', table: '#220044', felt: '#330055', puck: '#ffff00' },
  { name: 'Emerald Table', grid: '#003300', accent: '#44ff44', bg: '#000a00', fog: '#001100', wall: '#003300', table: '#003300', felt: '#004400', puck: '#ff8800' },
];

const DICE_SKINS = [
  { name: 'Neon Cyan', color: '#00ffff', emissive: '#004444', glow: '#00aaaa', unlock: '' },
  { name: 'Solar Flare', color: '#ff8800', emissive: '#442200', glow: '#aa5500', unlock: '50 rolls' },
  { name: 'Plasma Pink', color: '#ff44ff', emissive: '#440044', glow: '#aa00aa', unlock: '5K won' },
  { name: 'Frost Blue', color: '#4488ff', emissive: '#002244', glow: '#2244aa', unlock: '10 games' },
  { name: 'Toxic Green', color: '#44ff44', emissive: '#004400', glow: '#00aa00', unlock: 'x5 streak' },
  { name: 'Royal Gold', color: '#ffdd00', emissive: '#443300', glow: '#aa8800', unlock: 'Point made' },
  { name: 'Void Purple', color: '#8800ff', emissive: '#220044', glow: '#5500aa', unlock: 'All modes' },
  { name: 'Inferno', color: '#ff4400', emissive: '#441100', glow: '#aa2200', unlock: 'Hardway hit' },
];

const CHIP_VALUES = [1, 5, 10, 25, 100];

// ============================================================
// GAME STATE MANAGER
// ============================================================
class GameStateManager {
  state: GameState = 'title';
  mode: GameMode = 'classic';
  difficulty: number = 1;
  phase: CrapsPhase = 'comeout';
  point: number = 0;
  bankroll: number = 1000;
  startBankroll: number = 1000;
  chipSize: number = 5;
  bets: Bet[] = [];
  lastBets: Bet[] = [];
  rollHistory: RollResult[] = [];
  rollCount: number = 0;
  totalWon: number = 0;
  totalLost: number = 0;
  sevenOuts: number = 0;
  winStreak: number = 0;
  bestStreak: number = 0;
  naturals: number = 0;
  craps: number = 0;
  pointsMade: number = 0;
  hardwaysHit: number = 0;
  currentSkin: number = 0;
  currentTheme: number = 0;
  masterVol: number = 100;
  sfxVol: number = 100;
  musicVol: number = 100;
  xp: number = 0;
  level: number = 1;
  achievements: Achievement[] = [];
  leaderboard: { score: number; mode: string; rolls: number; date: string }[] = [];
  achPage: number = 0;
  sessionStart: number = 0;
  speedTimer: number = 60;
  sessionGoal: number = 2000;
  countdownVal: number = 3;
  diceAnimating: boolean = false;
  lastDie1: number = 0;
  lastDie2: number = 0;
  toastQueue: string[] = [];
  toastTimer: number = 0;
  modesPlayed: Set<string> = new Set();
  numberCounts: Map<number, number> = new Map();
  themesUsed: Set<number> = new Set();
  comePoints: Map<number, number> = new Map(); // point -> bet amount for come bets on point
  dontComePoints: Map<number, number> = new Map(); // point -> bet amount for don't come on point

  // Career stats (persisted)
  career = {
    games: 0, totalRolls: 0, totalWon: 0, totalLost: 0,
    bestBankroll: 0, bestStreak: 0, sevenOuts: 0, naturals: 0,
    craps: 0, pointsMade: 0, hardwaysHit: 0, playTime: 0,
    propWins: 0, comeWins: 0, lowestBank: 99999,
    ironCrossWins: 0, darkSideWins: 0, presetsUsed: 0,
  };

  constructor() {
    this.initAchievements();
    this.load();
  }

  initAchievements() {
    this.achievements = [
      { id: 'first_roll', name: 'First Roll', desc: 'Roll the dice for the first time', unlocked: false },
      { id: 'natural', name: 'Natural!', desc: 'Roll a 7 or 11 on come-out', unlocked: false },
      { id: 'craps_roll', name: 'Snake Eyes', desc: 'Roll a 2 (aces)', unlocked: false },
      { id: 'boxcars', name: 'Boxcars', desc: 'Roll a 12', unlocked: false },
      { id: 'yo', name: 'Yo Eleven!', desc: 'Roll an 11', unlocked: false },
      { id: 'point_made', name: 'Point Made', desc: 'Make your point', unlocked: false },
      { id: 'seven_out', name: 'Seven Out', desc: 'Seven out during point phase', unlocked: false },
      { id: 'hard4', name: 'Hard Four', desc: 'Roll hard 4 (2+2)', unlocked: false },
      { id: 'hard6', name: 'Hard Six', desc: 'Roll hard 6 (3+3)', unlocked: false },
      { id: 'hard8', name: 'Hard Eight', desc: 'Roll hard 8 (4+4)', unlocked: false },
      { id: 'hard10', name: 'Hard Ten', desc: 'Roll hard 10 (5+5)', unlocked: false },
      { id: 'win_100', name: 'Small Winner', desc: 'Win $100 in a session', unlocked: false },
      { id: 'win_500', name: 'High Roller', desc: 'Win $500 in a session', unlocked: false },
      { id: 'win_1000', name: 'Whale', desc: 'Win $1000 in a session', unlocked: false },
      { id: 'win_5000', name: 'Legend', desc: 'Win $5000 in a session', unlocked: false },
      { id: 'streak_3', name: 'Hot Streak', desc: 'Win 3 rolls in a row', unlocked: false },
      { id: 'streak_5', name: 'On Fire', desc: 'Win 5 rolls in a row', unlocked: false },
      { id: 'streak_10', name: 'Unstoppable', desc: 'Win 10 rolls in a row', unlocked: false },
      { id: 'rolls_10', name: 'Rookie', desc: 'Roll 10 times', unlocked: false },
      { id: 'rolls_50', name: 'Regular', desc: 'Roll 50 times', unlocked: false },
      { id: 'rolls_100', name: 'Veteran', desc: 'Roll 100 times', unlocked: false },
      { id: 'rolls_500', name: 'Dedicated', desc: 'Roll 500 times total', unlocked: false },
      { id: 'games_5', name: 'Getting Started', desc: 'Play 5 games', unlocked: false },
      { id: 'games_10', name: 'Regular Player', desc: 'Play 10 games', unlocked: false },
      { id: 'games_50', name: 'Craps Addict', desc: 'Play 50 games', unlocked: false },
      { id: 'double_up', name: 'Double Up', desc: 'Double your starting bankroll', unlocked: false },
      { id: 'bankroll_5k', name: 'Big Stack', desc: 'Reach $5000 bankroll', unlocked: false },
      { id: 'daily_done', name: 'Daily Roller', desc: 'Complete a daily challenge', unlocked: false },
      { id: 'all_modes', name: 'Variety', desc: 'Play all 8 modes', unlocked: false },
      { id: 'field_win', name: 'Field Goal', desc: 'Win a field bet', unlocked: false },
      { id: 'place_win', name: 'Place Winner', desc: 'Win a place bet', unlocked: false },
      { id: 'prop_win', name: 'Long Shot', desc: 'Win a proposition bet', unlocked: false },
      { id: 'hardway_bet', name: 'Hard Way', desc: 'Win a hardway bet', unlocked: false },
      { id: 'odds_bet', name: 'Smart Money', desc: 'Win an odds bet', unlocked: false },
      { id: 'no_seven', name: 'Lucky Streak', desc: '10 rolls without a 7', unlocked: false },
      { id: 'midnight', name: 'Midnight', desc: 'Roll 12 on a field bet', unlocked: false },
      { id: 'come_win', name: 'Come Winner', desc: 'Win a come bet', unlocked: false },
      { id: 'skin_unlock', name: 'Fashionista', desc: 'Unlock a dice skin', unlocked: false },
      { id: 'theme_all', name: 'Decorator', desc: 'Try all 5 themes', unlocked: false },
      { id: 'level_10', name: 'Rising Star', desc: 'Reach level 10', unlocked: false },
      { id: 'triple_up', name: 'Triple Up', desc: 'Triple your starting bankroll', unlocked: false },
      { id: 'bankroll_10k', name: 'High Society', desc: 'Reach $10000 bankroll', unlocked: false },
      { id: 'hot_number', name: 'Hot Number', desc: 'Same number rolls 3x in a row', unlocked: false },
      { id: 'all_hard', name: 'Hard Master', desc: 'Hit all four hardways', unlocked: false },
      { id: 'max_bet', name: 'All In', desc: 'Place a $100 chip bet', unlocked: false },
      { id: 'seven_dodge', name: 'Seven Dodger', desc: '15 rolls without a 7', unlocked: false },
      { id: 'quick_win', name: 'Speed Demon', desc: 'Win $500 in speed mode', unlocked: false },
      { id: 'come_streak', name: 'Come Roller', desc: 'Win 3 come bets in a row', unlocked: false },
      { id: 'prop_master', name: 'Prop Master', desc: 'Win 5 proposition bets', unlocked: false },
      { id: 'iron_cross', name: 'Iron Cross', desc: 'Have field + place 5,6,8 bets active', unlocked: false },
      { id: 'rolls_1000', name: 'Dice Master', desc: 'Roll 1000 times total', unlocked: false },
      { id: 'level_25', name: 'Expert', desc: 'Reach level 25', unlocked: false },
      { id: 'marathon_50', name: 'Marathon Man', desc: '50 rolls in one marathon game', unlocked: false },
      { id: 'double_hard', name: 'Double Hard', desc: 'Hit 2 hardways in one session', unlocked: false },
      { id: 'perfect_streak', name: 'Perfect Game', desc: 'Win 15 rolls in a row', unlocked: false },
      { id: 'points_5', name: 'Point Machine', desc: 'Make 5 points in one session', unlocked: false },
      { id: 'big_payout', name: 'Jackpot', desc: 'Win $500+ on a single roll', unlocked: false },
      { id: 'all_skins', name: 'Collector', desc: 'Unlock all dice skins', unlocked: false },
      { id: 'comeback', name: 'Comeback Kid', desc: 'Go below $100 then reach $1000+', unlocked: false },
      { id: 'session_10m', name: 'Dedicated Player', desc: 'Play for 10 minutes', unlocked: false },
      { id: 'session_30m', name: 'Marathon Session', desc: 'Play for 30 minutes', unlocked: false },
      { id: 'iron_cross_win', name: 'Cross Victory', desc: 'Win 3 times with Iron Cross active', unlocked: false },
      { id: 'dark_side_3', name: 'Dark Rider', desc: 'Win 3 Don\'t Pass bets', unlocked: false },
      { id: 'preset_user', name: 'Strategist', desc: 'Use a betting preset', unlocked: false },
      { id: 'bankroll_25k', name: 'Mogul', desc: 'Reach $25000 bankroll', unlocked: false },
      { id: 'level_50', name: 'Master', desc: 'Reach level 50', unlocked: false },
      { id: 'streak_20', name: 'Legendary Run', desc: 'Win 20 rolls in a row', unlocked: false },
      { id: 'all_bets', name: 'Full Table', desc: 'Place 10+ different bet types in one session', unlocked: false },
      { id: 'quick_double', name: 'Fast Fortune', desc: 'Double bankroll in under 10 rolls', unlocked: false },
    ];
  }

  save() {
    try {
      localStorage.setItem('neoncraps_career', JSON.stringify(this.career));
      localStorage.setItem('neoncraps_ach', JSON.stringify(this.achievements.filter(a => a.unlocked).map(a => a.id)));
      localStorage.setItem('neoncraps_lb', JSON.stringify(this.leaderboard));
      localStorage.setItem('neoncraps_xp', JSON.stringify({ xp: this.xp, level: this.level }));
      localStorage.setItem('neoncraps_skin', String(this.currentSkin));
      localStorage.setItem('neoncraps_theme', String(this.currentTheme));
      localStorage.setItem('neoncraps_vol', JSON.stringify({ master: this.masterVol, sfx: this.sfxVol, music: this.musicVol }));
      localStorage.setItem('neoncraps_modes', JSON.stringify([...this.modesPlayed]));
    } catch {}
  }

  load() {
    try {
      const c = localStorage.getItem('neoncraps_career');
      if (c) Object.assign(this.career, JSON.parse(c));
      const a = localStorage.getItem('neoncraps_ach');
      if (a) { const ids = JSON.parse(a) as string[]; ids.forEach(id => { const ach = this.achievements.find(x => x.id === id); if (ach) ach.unlocked = true; }); }
      const lb = localStorage.getItem('neoncraps_lb');
      if (lb) this.leaderboard = JSON.parse(lb);
      const xp = localStorage.getItem('neoncraps_xp');
      if (xp) { const d = JSON.parse(xp); this.xp = d.xp; this.level = d.level; }
      const sk = localStorage.getItem('neoncraps_skin');
      if (sk) this.currentSkin = parseInt(sk);
      const th = localStorage.getItem('neoncraps_theme');
      if (th) this.currentTheme = parseInt(th);
      const vol = localStorage.getItem('neoncraps_vol');
      if (vol) { const v = JSON.parse(vol); this.masterVol = v.master; this.sfxVol = v.sfx; this.musicVol = v.music; }
      const modes = localStorage.getItem('neoncraps_modes');
      if (modes) this.modesPlayed = new Set(JSON.parse(modes));
    } catch {}
  }

  unlock(id: string): boolean {
    const ach = this.achievements.find(a => a.id === id);
    if (ach && !ach.unlocked) { ach.unlocked = true; this.save(); return true; }
    return false;
  }

  addXp(amount: number) {
    this.xp += amount;
    const needed = 100 + this.level * 50;
    while (this.xp >= needed) { this.xp -= needed; this.level++; }
    this.save();
  }

  getTotalBet(): number { return this.bets.reduce((s, b) => s + b.amount, 0); }

  addBet(type: BetType, amount: number) {
    if (amount > this.bankroll - this.getTotalBet()) return;
    const existing = this.bets.find(b => b.type === type);
    if (existing) existing.amount += amount;
    else this.bets.push({ type, amount });
    if (amount >= 100) { if (this.unlock('max_bet')) this.toastQueue.push('Achievement: All In!'); }
  }

  clearBets() { this.bets = []; }

  resetForNewGame(startBank: number) {
    this.phase = 'comeout';
    this.point = 0;
    this.bankroll = startBank;
    this.startBankroll = startBank;
    this.bets = [];
    this.lastBets = [];
    this.rollHistory = [];
    this.rollCount = 0;
    this.totalWon = 0;
    this.totalLost = 0;
    this.sevenOuts = 0;
    this.winStreak = 0;
    this.bestStreak = 0;
    this.naturals = 0;
    this.craps = 0;
    this.pointsMade = 0;
    this.hardwaysHit = 0;
    this.sessionStart = Date.now();
    this.career.games++;
    this.modesPlayed.add(this.mode);
    this.numberCounts.clear();
    this.comePoints.clear();
    this.dontComePoints.clear();
    this.save();
  }
}

const GM = new GameStateManager();

// ============================================================
// SEEDED PRNG FOR DAILY
// ============================================================
function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function getDailySeed(): number {
  const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

let dailyRng = mulberry32(getDailySeed());

// ============================================================
// AUDIO ENGINE
// ============================================================
class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  musicGain: GainNode | null = null;
  droneOsc1: OscillatorNode | null = null;
  droneOsc2: OscillatorNode | null = null;
  droneOsc3: OscillatorNode | null = null;
  droneLfo: OscillatorNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.startDrone();
  }

  setVolumes(master: number, sfx: number, music: number) {
    if (this.masterGain) this.masterGain.gain.value = master / 100;
    if (this.sfxGain) this.sfxGain.gain.value = sfx / 100;
    if (this.musicGain) this.musicGain.gain.value = music / 100;
  }

  startDrone() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.03;
    this.droneLfo = this.ctx.createOscillator(); this.droneLfo.frequency.value = 0.15; this.droneLfo.connect(lfoGain);

    const createDroneOsc = (freq: number, type: OscillatorType, vol: number) => {
      const osc = this.ctx!.createOscillator(); osc.type = type; osc.frequency.value = freq;
      const g = this.ctx!.createGain(); g.gain.value = vol;
      const lp = this.ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      osc.connect(g); g.connect(lp); lp.connect(this.musicGain!);
      lfoGain.connect(g.gain);
      osc.start(t);
      return osc;
    };
    this.droneOsc1 = createDroneOsc(55, 'sine', 0.08);
    this.droneOsc2 = createDroneOsc(82.5, 'triangle', 0.04);
    this.droneOsc3 = createDroneOsc(110, 'sine', 0.03);
    this.droneLfo!.start(t);
  }

  playSfx(type: string) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const pitch = 0.95 + Math.random() * 0.1;

    const play = (freq: number, oscType: OscillatorType, dur: number, vol: number = 0.15) => {
      const osc = this.ctx!.createOscillator(); osc.type = oscType; osc.frequency.value = freq * pitch;
      const g = this.ctx!.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(this.sfxGain!); osc.start(t); osc.stop(t + dur);
    };

    switch (type) {
      case 'dice_throw': play(200, 'triangle', 0.3, 0.12); play(300, 'square', 0.15, 0.08); break;
      case 'dice_bounce': play(400 + Math.random() * 200, 'square', 0.08, 0.1); break;
      case 'dice_settle': play(600, 'sine', 0.2, 0.1); play(800, 'triangle', 0.15, 0.06); break;
      case 'win': play(523, 'sine', 0.15); play(659, 'sine', 0.15); play(784, 'sine', 0.2); play(1047, 'sine', 0.3); break;
      case 'lose': play(400, 'sawtooth', 0.3, 0.1); play(300, 'sawtooth', 0.4, 0.08); break;
      case 'seven_out': play(300, 'sawtooth', 0.5, 0.12); play(200, 'square', 0.6, 0.1); break;
      case 'natural': play(660, 'sine', 0.1); play(880, 'sine', 0.1); play(1100, 'sine', 0.15); play(1320, 'sine', 0.25); break;
      case 'craps': play(200, 'sawtooth', 0.4, 0.12); play(150, 'square', 0.5, 0.1); break;
      case 'point_set': play(440, 'triangle', 0.15); play(550, 'triangle', 0.2); break;
      case 'point_made': play(523, 'sine', 0.1); play(659, 'sine', 0.1); play(784, 'sine', 0.15); play(1047, 'sine', 0.2); play(1320, 'sine', 0.3); break;
      case 'bet_place': play(800, 'sine', 0.08, 0.08); break;
      case 'bet_clear': play(300, 'triangle', 0.1, 0.08); break;
      case 'chip_select': play(600, 'sine', 0.06, 0.06); break;
      case 'click': play(1000, 'sine', 0.05, 0.06); play(1200, 'sine', 0.03, 0.04); break;
      case 'achievement': play(660, 'sine', 0.12); play(880, 'sine', 0.12); play(1100, 'sine', 0.12); play(1320, 'sine', 0.15); play(1650, 'sine', 0.2); break;
      case 'countdown': play(440, 'sine', 0.15, 0.1); break;
      case 'go': play(880, 'sine', 0.3, 0.15); break;
      case 'levelup': play(523, 'sine', 0.1); play(659, 'sine', 0.1); play(784, 'sine', 0.1); play(1047, 'sine', 0.1); play(1320, 'sine', 0.15); play(1570, 'sine', 0.2); break;
      case 'hardway': play(880, 'triangle', 0.1); play(1100, 'triangle', 0.1); play(1320, 'triangle', 0.15); break;
    }
  }
}

const audio = new AudioEngine();

// ============================================================
// CRAPS ENGINE — RESOLVE BETS
// ============================================================
function resolveBets(roll: RollResult): { totalPayout: number; messages: string[] } {
  const { die1, die2, total } = roll;
  const isHard = die1 === die2;
  let totalPayout = 0;
  const messages: string[] = [];
  const betsToRemove: BetType[] = [];

  for (const bet of GM.bets) {
    let payout = 0;
    let lost = false;
    let remove = false;

    switch (bet.type) {
      case 'pass':
        if (GM.phase === 'comeout') {
          if (total === 7 || total === 11) { payout = bet.amount; remove = false; }
          else if (total === 2 || total === 3 || total === 12) { lost = true; remove = true; }
        } else {
          if (total === GM.point) { payout = bet.amount; remove = false; }
          else if (total === 7) { lost = true; remove = true; }
        }
        break;
      case 'dontpass':
        if (GM.phase === 'comeout') {
          if (total === 2 || total === 3) { payout = bet.amount; remove = false; }
          else if (total === 12) { /* push */ }
          else if (total === 7 || total === 11) { lost = true; remove = true; }
        } else {
          if (total === 7) { payout = bet.amount; remove = false; }
          else if (total === GM.point) { lost = true; remove = true; }
        }
        break;
      case 'come':
        if (GM.phase === 'point') {
          if (total === 7 || total === 11) { payout = bet.amount; remove = true; if (GM.unlock('come_win')) GM.toastQueue.push('Achievement: Come Winner!'); GM.career.comeWins++; }
          else if (total === 2 || total === 3 || total === 12) { lost = true; remove = true; }
          else {
            // Come bet moves to number — track it
            GM.comePoints.set(total, (GM.comePoints.get(total) || 0) + bet.amount);
            remove = true; // Remove from active bets (tracked in comePoints)
          }
        }
        break;
      case 'dontcome':
        if (GM.phase === 'point') {
          if (total === 2 || total === 3) { payout = bet.amount; remove = true; GM.career.darkSideWins++; }
          else if (total === 12) { remove = true; /* push */ }
          else if (total === 7 || total === 11) { lost = true; remove = true; }
          else {
            // Don't Come moves to number — track it
            GM.dontComePoints.set(total, (GM.dontComePoints.get(total) || 0) + bet.amount);
            remove = true;
          }
        }
        break;
      case 'field':
        if ([2, 3, 4, 9, 10, 11, 12].includes(total)) {
          if (total === 2) payout = bet.amount * 2;
          else if (total === 12) payout = bet.amount * 3;
          else payout = bet.amount;
          if (payout > 0) { if (GM.unlock('field_win')) GM.toastQueue.push('Achievement: Field Goal!'); }
          if (total === 12 && GM.bets.some(b => b.type === 'field')) { if (GM.unlock('midnight')) GM.toastQueue.push('Achievement: Midnight!'); }
        } else { lost = true; }
        remove = true;
        break;
      case 'place4': case 'place5': case 'place6': case 'place8': case 'place9': case 'place10': {
        const placeNum = parseInt(bet.type.replace('place', ''));
        if (total === placeNum) {
          if (placeNum === 6 || placeNum === 8) payout = Math.floor(bet.amount * 7 / 6);
          else if (placeNum === 5 || placeNum === 9) payout = Math.floor(bet.amount * 7 / 5);
          else payout = Math.floor(bet.amount * 9 / 5);
          if (GM.unlock('place_win')) GM.toastQueue.push('Achievement: Place Winner!');
        } else if (total === 7) { lost = true; remove = true; }
        break;
      }
      case 'hard4':
        if (total === 4 && isHard) { payout = bet.amount * 7; if (GM.unlock('hardway_bet')) GM.toastQueue.push('Achievement: Hard Way!'); }
        else if (total === 4 || total === 7) { lost = true; remove = true; }
        break;
      case 'hard6':
        if (total === 6 && isHard) { payout = bet.amount * 9; if (GM.unlock('hardway_bet')) GM.toastQueue.push('Achievement: Hard Way!'); }
        else if (total === 6 || total === 7) { lost = true; remove = true; }
        break;
      case 'hard8':
        if (total === 8 && isHard) { payout = bet.amount * 9; if (GM.unlock('hardway_bet')) GM.toastQueue.push('Achievement: Hard Way!'); }
        else if (total === 8 || total === 7) { lost = true; remove = true; }
        break;
      case 'hard10':
        if (total === 10 && isHard) { payout = bet.amount * 7; if (GM.unlock('hardway_bet')) GM.toastQueue.push('Achievement: Hard Way!'); }
        else if (total === 10 || total === 7) { lost = true; remove = true; }
        break;
      case 'anyseven':
        if (total === 7) { payout = bet.amount * 4; if (GM.unlock('prop_win')) GM.toastQueue.push('Achievement: Long Shot!'); }
        else lost = true;
        remove = true;
        break;
      case 'anycraps':
        if (total === 2 || total === 3 || total === 12) { payout = bet.amount * 7; if (GM.unlock('prop_win')) GM.toastQueue.push('Achievement: Long Shot!'); }
        else lost = true;
        remove = true;
        break;
      case 'yo':
        if (total === 11) { payout = bet.amount * 15; if (GM.unlock('prop_win')) GM.toastQueue.push('Achievement: Long Shot!'); }
        else lost = true;
        remove = true;
        break;
      case 'aces':
        if (total === 2) { payout = bet.amount * 30; if (GM.unlock('prop_win')) GM.toastQueue.push('Achievement: Long Shot!'); }
        else lost = true;
        remove = true;
        break;
      case 'boxcars':
        if (total === 12) { payout = bet.amount * 30; if (GM.unlock('prop_win')) GM.toastQueue.push('Achievement: Long Shot!'); }
        else lost = true;
        remove = true;
        break;
      case 'odds_pass':
        if (GM.phase === 'point') {
          if (total === GM.point) {
            if (GM.point === 4 || GM.point === 10) payout = bet.amount * 2;
            else if (GM.point === 5 || GM.point === 9) payout = Math.floor(bet.amount * 3 / 2);
            else payout = Math.floor(bet.amount * 6 / 5);
            if (GM.unlock('odds_bet')) GM.toastQueue.push('Achievement: Smart Money!');
          } else if (total === 7) { lost = true; remove = true; }
        }
        break;
      case 'odds_dontpass':
        if (GM.phase === 'point') {
          if (total === 7) {
            if (GM.point === 4 || GM.point === 10) payout = Math.floor(bet.amount / 2);
            else if (GM.point === 5 || GM.point === 9) payout = Math.floor(bet.amount * 2 / 3);
            else payout = Math.floor(bet.amount * 5 / 6);
            if (GM.unlock('odds_bet')) GM.toastQueue.push('Achievement: Smart Money!');
          } else if (total === GM.point) { lost = true; remove = true; }
        }
        break;
      case 'big6':
        if (total === 6) payout = bet.amount;
        else if (total === 7) { lost = true; remove = true; }
        break;
      case 'big8':
        if (total === 8) payout = bet.amount;
        else if (total === 7) { lost = true; remove = true; }
        break;
    }

    if (payout > 0) {
      totalPayout += payout;
      messages.push(`${bet.type}: +$${payout}`);
    }
    if (lost) {
      GM.totalLost += bet.amount;
      GM.career.totalLost += bet.amount;
      messages.push(`${bet.type}: -$${bet.amount}`);
    }
    if (remove) betsToRemove.push(bet.type);
  }

  // Remove one-roll bets and lost bets
  GM.bets = GM.bets.filter(b => !betsToRemove.includes(b.type));

  // Resolve come points (bets that moved to a number)
  if (GM.comePoints.size > 0) {
    const comeAmount = GM.comePoints.get(total);
    if (comeAmount && comeAmount > 0) {
      totalPayout += comeAmount;
      messages.push(`come(${total}): +$${comeAmount}`);
      GM.career.comeWins++;
      if (GM.unlock('come_win')) GM.toastQueue.push('Achievement: Come Winner!');
      GM.comePoints.delete(total);
    }
    if (total === 7) {
      // Seven out — lose all come point bets
      for (const [num, amt] of GM.comePoints) {
        GM.totalLost += amt;
        GM.career.totalLost += amt;
        messages.push(`come(${num}): -$${amt}`);
      }
      GM.comePoints.clear();
    }
  }

  // Resolve don't come points
  if (GM.dontComePoints.size > 0) {
    const dcAmount = GM.dontComePoints.get(total);
    if (dcAmount && dcAmount > 0) {
      // Number hit — don't come loses
      GM.totalLost += dcAmount;
      GM.career.totalLost += dcAmount;
      messages.push(`dc(${total}): -$${dcAmount}`);
      GM.dontComePoints.delete(total);
    }
    if (total === 7) {
      // Seven — don't come points all win
      for (const [num, amt] of GM.dontComePoints) {
        totalPayout += amt;
        messages.push(`dc(${num}): +$${amt}`);
        GM.career.darkSideWins++;
      }
      GM.dontComePoints.clear();
    }
  }

  if (totalPayout > 0) {
    GM.bankroll += totalPayout;
    GM.totalWon += totalPayout;
    GM.career.totalWon += totalPayout;
    GM.winStreak++;
    if (GM.winStreak > GM.bestStreak) GM.bestStreak = GM.winStreak;
    if (GM.winStreak > GM.career.bestStreak) GM.career.bestStreak = GM.winStreak;
    // Track iron cross wins
    const hasField2 = GM.bets.some(b => b.type === 'field');
    const hasP5 = GM.bets.some(b => b.type === 'place5');
    const hasP6 = GM.bets.some(b => b.type === 'place6');
    const hasP8 = GM.bets.some(b => b.type === 'place8');
    if (hasField2 && hasP5 && hasP6 && hasP8) GM.career.ironCrossWins++;
  } else if (messages.length > 0) {
    GM.winStreak = 0;
  }

  return { totalPayout, messages };
}

function processRoll(roll: RollResult) {
  const { die1, die2, total } = roll;
  const isHard = die1 === die2;

  // Check achievements for the roll itself
  if (GM.unlock('first_roll')) GM.toastQueue.push('Achievement: First Roll!');
  if (total === 2) { if (GM.unlock('craps_roll')) GM.toastQueue.push('Achievement: Snake Eyes!'); }
  if (total === 12) { if (GM.unlock('boxcars')) GM.toastQueue.push('Achievement: Boxcars!'); }
  if (total === 11) { if (GM.unlock('yo')) GM.toastQueue.push('Achievement: Yo Eleven!'); }
  if (isHard && total === 4) { if (GM.unlock('hard4')) GM.toastQueue.push('Achievement: Hard Four!'); GM.hardwaysHit++; GM.career.hardwaysHit++; }
  if (isHard && total === 6) { if (GM.unlock('hard6')) GM.toastQueue.push('Achievement: Hard Six!'); GM.hardwaysHit++; GM.career.hardwaysHit++; }
  if (isHard && total === 8) { if (GM.unlock('hard8')) GM.toastQueue.push('Achievement: Hard Eight!'); GM.hardwaysHit++; GM.career.hardwaysHit++; }
  if (isHard && total === 10) { if (GM.unlock('hard10')) GM.toastQueue.push('Achievement: Hard Ten!'); GM.hardwaysHit++; GM.career.hardwaysHit++; }

  // Track number frequency
  GM.numberCounts.set(total, (GM.numberCounts.get(total) || 0) + 1);

  // Check for hot number (3x in a row)
  if (GM.rollHistory.length >= 2 && GM.rollHistory[0].total === total && GM.rollHistory[1].total === total) {
    if (GM.unlock('hot_number')) GM.toastQueue.push('Achievement: Hot Number!');
  }

  // Track lowest bankroll for comeback achievement
  if (GM.bankroll < GM.career.lowestBank) GM.career.lowestBank = GM.bankroll;

  // Resolve bets
  const result = resolveBets(roll);

  // Phase transitions
  if (GM.phase === 'comeout') {
    if (total === 7 || total === 11) {
      GM.naturals++;
      GM.career.naturals++;
      if (GM.unlock('natural')) GM.toastQueue.push('Achievement: Natural!');
    } else if (total === 2 || total === 3 || total === 12) {
      GM.craps++;
      GM.career.craps++;
    } else {
      // Point established
      GM.point = total;
      GM.phase = 'point';
      audio.playSfx('point_set');
    }
  } else {
    // Point phase
    if (total === GM.point) {
      GM.pointsMade++;
      GM.career.pointsMade++;
      GM.phase = 'comeout';
      GM.point = 0;
      if (GM.unlock('point_made')) GM.toastQueue.push('Achievement: Point Made!');
      audio.playSfx('point_made');
    } else if (total === 7) {
      GM.sevenOuts++;
      GM.career.sevenOuts++;
      GM.phase = 'comeout';
      GM.point = 0;
      // Remove all persistent bets on seven-out
      GM.bets = GM.bets.filter(b => !['pass', 'dontpass', 'odds_pass', 'odds_dontpass', 'place4', 'place5', 'place6', 'place8', 'place9', 'place10', 'big6', 'big8', 'hard4', 'hard6', 'hard8', 'hard10'].includes(b.type));
      // Come/don't come points already resolved in resolveBets
      if (GM.unlock('seven_out')) GM.toastQueue.push('Achievement: Seven Out!');
      audio.playSfx('seven_out');
    }
  }

  // Update roll history
  GM.rollHistory.unshift(roll);
  if (GM.rollHistory.length > 10) GM.rollHistory.pop();
  GM.rollCount++;
  GM.career.totalRolls++;

  // Check streak/milestone achievements
  if (GM.winStreak >= 3) { if (GM.unlock('streak_3')) GM.toastQueue.push('Achievement: Hot Streak!'); }
  if (GM.winStreak >= 5) { if (GM.unlock('streak_5')) GM.toastQueue.push('Achievement: On Fire!'); }
  if (GM.winStreak >= 10) { if (GM.unlock('streak_10')) GM.toastQueue.push('Achievement: Unstoppable!'); }
  if (GM.career.totalRolls >= 10) GM.unlock('rolls_10');
  if (GM.career.totalRolls >= 50) GM.unlock('rolls_50');
  if (GM.career.totalRolls >= 100) GM.unlock('rolls_100');
  if (GM.career.totalRolls >= 500) GM.unlock('rolls_500');
  if (GM.career.games >= 5) GM.unlock('games_5');
  if (GM.career.games >= 10) GM.unlock('games_10');
  if (GM.career.games >= 50) GM.unlock('games_50');
  if (GM.totalWon >= 100) { if (GM.unlock('win_100')) GM.toastQueue.push('Achievement: Small Winner!'); }
  if (GM.totalWon >= 500) { if (GM.unlock('win_500')) GM.toastQueue.push('Achievement: High Roller!'); }
  if (GM.totalWon >= 1000) { if (GM.unlock('win_1000')) GM.toastQueue.push('Achievement: Whale!'); }
  if (GM.totalWon >= 5000) { if (GM.unlock('win_5000')) GM.toastQueue.push('Achievement: Legend!'); }
  if (GM.bankroll >= GM.startBankroll * 2) { if (GM.unlock('double_up')) GM.toastQueue.push('Achievement: Double Up!'); }
  if (GM.bankroll >= 5000) { if (GM.unlock('bankroll_5k')) GM.toastQueue.push('Achievement: Big Stack!'); }
  if (GM.bankroll > GM.career.bestBankroll) GM.career.bestBankroll = GM.bankroll;
  if (GM.modesPlayed.size >= 8) { if (GM.unlock('all_modes')) GM.toastQueue.push('Achievement: Variety!'); }
  if (GM.level >= 10) { if (GM.unlock('level_10')) GM.toastQueue.push('Achievement: Rising Star!'); }

  // No seven check
  const lastN = GM.rollHistory.slice(0, 10);
  if (lastN.length >= 10 && !lastN.some(r => r.total === 7)) {
    if (GM.unlock('no_seven')) GM.toastQueue.push('Achievement: Lucky Streak!');
  }
  const last15 = GM.rollHistory.slice(0, 15);
  if (last15.length >= 15 && !last15.some(r => r.total === 7)) {
    if (GM.unlock('seven_dodge')) GM.toastQueue.push('Achievement: Seven Dodger!');
  }

  // Additional achievement checks
  if (GM.bankroll >= GM.startBankroll * 3) { if (GM.unlock('triple_up')) GM.toastQueue.push('Achievement: Triple Up!'); }
  if (GM.bankroll >= 10000) { if (GM.unlock('bankroll_10k')) GM.toastQueue.push('Achievement: High Society!'); }
  if (GM.career.totalRolls >= 1000) GM.unlock('rolls_1000');
  if (GM.level >= 25) { if (GM.unlock('level_25')) GM.toastQueue.push('Achievement: Expert!'); }
  if (GM.winStreak >= 15) { if (GM.unlock('perfect_streak')) GM.toastQueue.push('Achievement: Perfect Game!'); }
  if (GM.pointsMade >= 5) { if (GM.unlock('points_5')) GM.toastQueue.push('Achievement: Point Machine!'); }
  if (result.totalPayout >= 500) { if (GM.unlock('big_payout')) GM.toastQueue.push('Achievement: Jackpot!'); }
  if (GM.hardwaysHit >= 2) { if (GM.unlock('double_hard')) GM.toastQueue.push('Achievement: Double Hard!'); }
  if (GM.mode === 'marathon' && GM.rollCount >= 50) { if (GM.unlock('marathon_50')) GM.toastQueue.push('Achievement: Marathon Man!'); }
  if (GM.mode === 'speed' && GM.totalWon >= 500) { if (GM.unlock('quick_win')) GM.toastQueue.push('Achievement: Speed Demon!'); }

  // Iron Cross check
  const hasField = GM.bets.some(b => b.type === 'field');
  const hasPlace5 = GM.bets.some(b => b.type === 'place5');
  const hasPlace6 = GM.bets.some(b => b.type === 'place6');
  const hasPlace8 = GM.bets.some(b => b.type === 'place8');
  if (hasField && hasPlace5 && hasPlace6 && hasPlace8) {
    if (GM.unlock('iron_cross')) GM.toastQueue.push('Achievement: Iron Cross!');
  }

  // Comeback check
  if (GM.career.lowestBank < 100 && GM.bankroll >= 1000) {
    if (GM.unlock('comeback')) GM.toastQueue.push('Achievement: Comeback Kid!');
  }

  // All hardways check
  const allHard = GM.achievements.filter(a => ['hard4', 'hard6', 'hard8', 'hard10'].includes(a.id)).every(a => a.unlocked);
  if (allHard) { if (GM.unlock('all_hard')) GM.toastQueue.push('Achievement: Hard Master!'); }

  // All skins check
  let allSkins = true;
  for (let i = 0; i < DICE_SKINS.length; i++) { if (i > 0 && !checkSkinUnlock(i)) { allSkins = false; break; } }
  if (allSkins) { if (GM.unlock('all_skins')) GM.toastQueue.push('Achievement: Collector!'); }

  // New R3 achievement checks
  if (GM.bankroll >= 25000) { if (GM.unlock('bankroll_25k')) GM.toastQueue.push('Achievement: Mogul!'); }
  if (GM.level >= 50) { if (GM.unlock('level_50')) GM.toastQueue.push('Achievement: Master!'); }
  if (GM.winStreak >= 20) { if (GM.unlock('streak_20')) GM.toastQueue.push('Achievement: Legendary Run!'); }
  // Quick double — check if <10 rolls and doubled
  if (GM.rollCount <= 10 && GM.bankroll >= GM.startBankroll * 2) {
    if (GM.unlock('quick_double')) GM.toastQueue.push('Achievement: Fast Fortune!');
  }
  // All bet types in session
  const uniqueBetTypes = new Set(GM.bets.map(b => b.type));
  // Also count come/don't come points as bet types used
  if (GM.comePoints.size > 0) uniqueBetTypes.add('come');
  if (GM.dontComePoints.size > 0) uniqueBetTypes.add('dontcome');
  if (uniqueBetTypes.size >= 10) { if (GM.unlock('all_bets')) GM.toastQueue.push('Achievement: Full Table!'); }
  // Dark side wins
  if (GM.career.darkSideWins >= 3) { if (GM.unlock('dark_side_3')) GM.toastQueue.push('Achievement: Dark Rider!'); }
  // Iron cross wins
  if (GM.career.ironCrossWins >= 3) { if (GM.unlock('iron_cross_win')) GM.toastQueue.push('Achievement: Cross Victory!'); }

  // XP
  GM.addXp(Math.floor(result.totalPayout / 10) + 5);

  // Play sound
  if (result.totalPayout > 0) audio.playSfx('win');
  else if (result.messages.length > 0) audio.playSfx('lose');

  GM.save();
  return result;
}


// ============================================================
// 3D SCENE OBJECTS
// ============================================================
let world: Awaited<ReturnType<typeof World.create>>;
const raycaster = new Raycaster();
const mouse = new Vector2();
const tmpVec = new Vector3();

// Dice
const dice: { mesh: Group; velocity: Vector3; angVel: Vector3; settled: boolean; value: number }[] = [];
const TABLE_Y = 0.85;
const TABLE_WIDTH = 3.0;
const TABLE_DEPTH = 1.5;

// Bet zone meshes for raycasting
const betZones: { mesh: Mesh; type: BetType; label: string }[] = [];

// Particle pool
const MAX_PARTICLES = 200;
const particles: { mesh: Mesh; vel: Vector3; life: number; maxLife: number }[] = [];

// Chip stacks on bet zones (3D visualization)
const chipMeshes: Map<BetType, Group> = new Map();
const CHIP_COLORS: Record<number, number> = { 1: 0xffffff, 5: 0xff4444, 10: 0x4444ff, 25: 0x44ff44, 100: 0x888888 };

// Bet zone highlight meshes
const betZoneHighlights: Map<BetType, Mesh> = new Map();

// Panel entities for show/hide
const panelEntities: Map<string, Entity> = new Map();
const followerNames: Set<string> = new Set();

function createDie(x: number, z: number): Group {
  const skin = DICE_SKINS[GM.currentSkin];
  const col = new Color(skin.color);
  const emCol = new Color(skin.emissive);

  const group = new Group();
  const size = 0.08;

  // Cube body
  const geo = new BoxGeometry(size, size, size);
  const mat = new MeshStandardMaterial({ color: col, emissive: emCol, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.4 });
  const cube = new Mesh(geo, mat);
  group.add(cube);

  // Wireframe edges
  const edges = new EdgesGeometry(geo);
  const lineMat = new LineBasicMaterial({ color: col, transparent: true, opacity: 0.8 });
  const wire = new LineSegments(edges, lineMat);
  group.add(wire);

  // Glow sphere
  const glowGeo = new SphereGeometry(size * 0.8, 8, 8);
  const glowMat = new MeshStandardMaterial({ color: new Color(skin.glow), emissive: new Color(skin.glow), emissiveIntensity: 0.8, transparent: true, opacity: 0.15, blending: AdditiveBlending });
  const glow = new Mesh(glowGeo, glowMat);
  group.add(glow);

  // Pip dots on each face
  const pipGeo = new SphereGeometry(size * 0.08, 6, 6);
  const pipMat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });

  const addPip = (fx: number, fy: number, fz: number) => {
    const pip = new Mesh(pipGeo, pipMat);
    pip.position.set(fx * size * 0.55, fy * size * 0.55, fz * size * 0.55);
    group.add(pip);
  };

  // Face 1 (front +z): 1 pip
  addPip(0, 0, 1);
  // Face 6 (back -z): 6 pips
  addPip(-0.35, 0.35, -1); addPip(0.35, 0.35, -1); addPip(-0.35, 0, -1); addPip(0.35, 0, -1); addPip(-0.35, -0.35, -1); addPip(0.35, -0.35, -1);
  // Face 2 (right +x): 2 pips
  addPip(1, -0.3, -0.3); addPip(1, 0.3, 0.3);
  // Face 5 (left -x): 5 pips
  addPip(-1, 0, 0); addPip(-1, -0.35, -0.35); addPip(-1, 0.35, 0.35); addPip(-1, -0.35, 0.35); addPip(-1, 0.35, -0.35);
  // Face 3 (top +y): 3 pips
  addPip(-0.35, 1, -0.35); addPip(0, 1, 0); addPip(0.35, 1, 0.35);
  // Face 4 (bottom -y): 4 pips
  addPip(-0.3, -1, -0.3); addPip(0.3, -1, -0.3); addPip(-0.3, -1, 0.3); addPip(0.3, -1, 0.3);

  group.position.set(x, TABLE_Y + 0.15, z);
  return group;
}

function getDieValue(group: Group): number {
  // Determine which face is up based on rotation
  const up = new Vector3(0, 1, 0);
  const faceNormals = [
    { face: 1, normal: new Vector3(0, 0, 1) },  // front +z
    { face: 6, normal: new Vector3(0, 0, -1) },  // back -z
    { face: 2, normal: new Vector3(1, 0, 0) },   // right +x
    { face: 5, normal: new Vector3(-1, 0, 0) },  // left -x
    { face: 3, normal: new Vector3(0, 1, 0) },   // top +y
    { face: 4, normal: new Vector3(0, -1, 0) },  // bottom -y
  ];
  let best = 3;
  let bestDot = -2;
  for (const fn of faceNormals) {
    const worldNormal = fn.normal.clone().applyQuaternion(group.quaternion);
    const d = worldNormal.dot(up);
    if (d > bestDot) { bestDot = d; best = fn.face; }
  }
  return best;
}

function createTable(): Group {
  const theme = THEMES[GM.currentTheme];
  const tableGroup = new Group();

  // Table surface
  const surfGeo = new PlaneGeometry(TABLE_WIDTH, TABLE_DEPTH);
  const surfMat = new MeshStandardMaterial({ color: new Color(theme.felt), emissive: new Color(theme.felt), emissiveIntensity: 0.15, side: DoubleSide });
  const surface = new Mesh(surfGeo, surfMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = TABLE_Y;
  tableGroup.add(surface);

  // Table edge rails
  const railGeo = new BoxGeometry(TABLE_WIDTH + 0.1, 0.08, 0.05);
  const railMat = new MeshStandardMaterial({ color: new Color(theme.accent), emissive: new Color(theme.accent), emissiveIntensity: 0.4, metalness: 0.6 });

  const frontRail = new Mesh(railGeo, railMat); frontRail.position.set(0, TABLE_Y + 0.04, TABLE_DEPTH / 2 + 0.025); tableGroup.add(frontRail);
  const backRail = new Mesh(railGeo, railMat.clone()); backRail.position.set(0, TABLE_Y + 0.04, -TABLE_DEPTH / 2 - 0.025); tableGroup.add(backRail);

  const sideRailGeo = new BoxGeometry(0.05, 0.08, TABLE_DEPTH + 0.1);
  const leftRail = new Mesh(sideRailGeo, railMat.clone()); leftRail.position.set(-TABLE_WIDTH / 2 - 0.025, TABLE_Y + 0.04, 0); tableGroup.add(leftRail);
  const rightRail = new Mesh(sideRailGeo, railMat.clone()); rightRail.position.set(TABLE_WIDTH / 2 + 0.025, TABLE_Y + 0.04, 0); tableGroup.add(rightRail);

  // Rail wireframe edges
  for (const rail of [frontRail, backRail, leftRail, rightRail]) {
    const e = new EdgesGeometry(rail.geometry);
    const l = new LineSegments(e, new LineBasicMaterial({ color: new Color(theme.accent), transparent: true, opacity: 0.6 }));
    rail.add(l);
  }

  // Table legs
  const legGeo = new CylinderGeometry(0.03, 0.03, TABLE_Y, 8);
  const legMat = new MeshStandardMaterial({ color: new Color(theme.wall), emissive: new Color(theme.wall), emissiveIntensity: 0.2 });
  const positions = [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]];
  for (const [x, z] of positions) {
    const leg = new Mesh(legGeo, legMat);
    leg.position.set(x, TABLE_Y / 2, z);
    tableGroup.add(leg);
  }

  return tableGroup;
}

function createBetZones(): void {
  const theme = THEMES[GM.currentTheme];
  const y = TABLE_Y + 0.005;

  const addZone = (x: number, z: number, w: number, d: number, type: BetType, label: string, color: string) => {
    const geo = new PlaneGeometry(w, d);
    const mat = new MeshStandardMaterial({
      color: new Color(color), emissive: new Color(color), emissiveIntensity: 0.2,
      transparent: true, opacity: 0.25, side: DoubleSide,
    });
    const mesh = new Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    world.scene.add(mesh);
    betZones.push({ mesh, type, label });

    // Border
    const edges = new EdgesGeometry(geo);
    const line = new LineSegments(edges, new LineBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.5 }));
    mesh.add(line);
  };

  // Layout on table — simplified craps layout
  // Pass Line (bottom curved area)
  addZone(0, 0.5, 2.4, 0.2, 'pass', 'PASS LINE', '#44ff44');
  // Don't Pass (behind pass line)
  addZone(0, 0.6, 2.0, 0.1, 'dontpass', "DON'T PASS", '#ff4444');
  // Field (center area)
  addZone(0, 0.2, 1.6, 0.18, 'field', 'FIELD', '#ffff00');
  // Come (above field)
  addZone(0, 0, 1.2, 0.15, 'come', 'COME', '#00ffff');
  // Place numbers across the top
  const placeTypes: BetType[] = ['place4', 'place5', 'place6', 'place8', 'place9', 'place10'];
  const placeNums = [4, 5, 6, 8, 9, 10];
  for (let i = 0; i < 6; i++) {
    addZone(-0.75 + i * 0.3, -0.2, 0.25, 0.15, placeTypes[i], String(placeNums[i]), '#ff8800');
  }
  // Hardways row
  const hardTypes: BetType[] = ['hard4', 'hard6', 'hard8', 'hard10'];
  const hardNums = [4, 6, 8, 10];
  for (let i = 0; i < 4; i++) {
    addZone(-0.45 + i * 0.3, -0.42, 0.22, 0.12, hardTypes[i], `Hard ${hardNums[i]}`, '#ff44ff');
  }
  // Proposition bets at far end
  addZone(-0.6, -0.58, 0.25, 0.1, 'anyseven', 'Any 7', '#8888ff');
  addZone(-0.3, -0.58, 0.25, 0.1, 'anycraps', 'Any Craps', '#8888ff');
  addZone(0, -0.58, 0.2, 0.1, 'yo', 'Yo 11', '#8888ff');
  addZone(0.25, -0.58, 0.2, 0.1, 'aces', 'Aces', '#8888ff');
  addZone(0.5, -0.58, 0.22, 0.1, 'boxcars', '12', '#8888ff');
  // Big 6/8
  addZone(1.1, 0.4, 0.2, 0.15, 'big6', 'Big 6', '#ff8800');
  addZone(1.1, 0.2, 0.2, 0.15, 'big8', 'Big 8', '#ff8800');
  // Odds behind pass
  addZone(-0.6, 0.5, 0.3, 0.1, 'odds_pass', 'Odds', '#ffffff');
  addZone(0.6, 0.5, 0.3, 0.1, 'odds_dontpass', 'DP Odds', '#ffffff');
}

// Point puck
let puckMesh: Mesh;
function createPuck(): Mesh {
  const theme = THEMES[GM.currentTheme];
  const geo = new CylinderGeometry(0.05, 0.05, 0.02, 16);
  const mat = new MeshStandardMaterial({ color: new Color(theme.puck), emissive: new Color(theme.puck), emissiveIntensity: 0.5 });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(-1.2, TABLE_Y + 0.03, -0.2);
  // Glow ring
  const ringGeo = new TorusGeometry(0.06, 0.01, 8, 16);
  const ringMat = new MeshStandardMaterial({ color: new Color(theme.puck), emissive: new Color(theme.puck), emissiveIntensity: 0.6, transparent: true, opacity: 0.4, blending: AdditiveBlending });
  const ring = new Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  mesh.add(ring);
  return mesh;
}

function updatePuckPosition() {
  if (!puckMesh) return;
  if (GM.phase === 'comeout') {
    puckMesh.position.set(-1.2, TABLE_Y + 0.03, -0.2);
    (puckMesh.material as MeshStandardMaterial).color.set(0x333333);
    (puckMesh.material as MeshStandardMaterial).emissive.set(0x111111);
  } else {
    const pointIdx = [4, 5, 6, 8, 9, 10].indexOf(GM.point);
    if (pointIdx >= 0) {
      puckMesh.position.set(-0.75 + pointIdx * 0.3, TABLE_Y + 0.03, -0.2);
    }
    const theme = THEMES[GM.currentTheme];
    (puckMesh.material as MeshStandardMaterial).color.set(theme.puck);
    (puckMesh.material as MeshStandardMaterial).emissive.set(theme.puck);
  }
}

// Holodeck environment
function createHolodeck() {
  const theme = THEMES[GM.currentTheme];
  const gridCol = new Color(theme.grid);
  const accentCol = new Color(theme.accent);

  // Grid floor
  const floorGeo = new PlaneGeometry(20, 20, 20, 20);
  const floorMat = new MeshStandardMaterial({ color: 0x000000, emissive: gridCol, emissiveIntensity: 0.1, wireframe: true, transparent: true, opacity: 0.3 });
  const floor = new Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  world.scene.add(floor);

  // Grid ceiling
  const ceilMat = new MeshStandardMaterial({ color: 0x000000, emissive: gridCol, emissiveIntensity: 0.05, wireframe: true, transparent: true, opacity: 0.15 });
  const ceil = new Mesh(floorGeo.clone(), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 4;
  world.scene.add(ceil);

  // Floating decorations
  const decoGeos = [new TorusGeometry(0.3, 0.05, 8, 16), new BoxGeometry(0.4, 0.4, 0.4), new SphereGeometry(0.25, 8, 8), new ConeGeometry(0.2, 0.4, 6)];
  for (let i = 0; i < 14; i++) {
    const geo = decoGeos[i % 4];
    const mat = new MeshStandardMaterial({ color: 0x000000, emissive: accentCol, emissiveIntensity: 0.3, wireframe: true, transparent: true, opacity: 0.2 });
    const deco = new Mesh(geo, mat);
    const angle = (i / 14) * Math.PI * 2;
    const radius = 4 + Math.random() * 3;
    deco.position.set(Math.cos(angle) * radius, 1.5 + Math.random() * 2, Math.sin(angle) * radius);
    deco.userData.rotSpeed = 0.2 + Math.random() * 0.3;
    deco.userData.bobSpeed = 0.3 + Math.random() * 0.2;
    deco.userData.bobPhase = Math.random() * Math.PI * 2;
    deco.userData.baseY = deco.position.y;
    world.scene.add(deco);
  }

  // Ambient particles
  for (let i = 0; i < 40; i++) {
    const pGeo = new SphereGeometry(0.015, 4, 4);
    const pMat = new MeshStandardMaterial({ color: accentCol, emissive: accentCol, emissiveIntensity: 0.5, transparent: true, opacity: 0.3 });
    const p = new Mesh(pGeo, pMat);
    p.position.set((Math.random() - 0.5) * 12, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 12);
    p.userData.driftX = (Math.random() - 0.5) * 0.1;
    p.userData.driftZ = (Math.random() - 0.5) * 0.1;
    p.userData.pulsePhase = Math.random() * Math.PI * 2;
    world.scene.add(p);
  }

  // Lights
  const dirLight = new DirectionalLight(0xffffff, 0.4);
  dirLight.position.set(2, 4, 2);
  world.scene.add(dirLight);
  const ambient = new AmbientLight(0x111111, 0.3);
  world.scene.add(ambient);
  const accent1 = new PointLight(parseInt(theme.accent.replace('#', ''), 16), 0.6, 10);
  accent1.position.set(-2, 2, -1);
  world.scene.add(accent1);
  const accent2 = new PointLight(0xff44ff, 0.3, 8);
  accent2.position.set(2, 2, 1);
  world.scene.add(accent2);
  // Table spotlight
  const tableLight = new PointLight(0xffffff, 0.5, 5);
  tableLight.position.set(0, 2.5, 0);
  world.scene.add(tableLight);

  // Fog
  world.scene.fog = new FogExp2(parseInt(theme.fog.replace('#', ''), 16), 0.08);
}

// Particle system
function initParticles() {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const geo = new SphereGeometry(0.012, 4, 4);
    const mat = new MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5, transparent: true, opacity: 0 });
    const mesh = new Mesh(geo, mat);
    mesh.visible = false;
    world.scene.add(mesh);
    particles.push({ mesh, vel: new Vector3(), life: 0, maxLife: 0 });
  }
}

function spawnParticles(pos: Vector3, count: number, color: number) {
  let spawned = 0;
  for (const p of particles) {
    if (spawned >= count) break;
    if (p.life <= 0) {
      p.mesh.position.copy(pos);
      p.vel.set((Math.random() - 0.5) * 2, Math.random() * 3 + 1, (Math.random() - 0.5) * 2);
      p.life = 0.8 + Math.random() * 0.4;
      p.maxLife = p.life;
      (p.mesh.material as MeshStandardMaterial).color.set(color);
      (p.mesh.material as MeshStandardMaterial).emissive.set(color);
      p.mesh.visible = true;
      spawned++;
    }
  }
}

function spawnBigWinParticles(pos: Vector3, amount: number) {
  const colors = [0x44ff44, 0xffff00, 0xff8800, 0x00ffff, 0xff44ff];
  const count = Math.min(60, Math.floor(amount / 50) + 20);
  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    const p = particles.find(pp => pp.life <= 0);
    if (!p) break;
    p.mesh.position.copy(pos).add(new Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
    p.vel.set((Math.random() - 0.5) * 4, Math.random() * 5 + 2, (Math.random() - 0.5) * 4);
    p.life = 1.2 + Math.random() * 0.6;
    p.maxLife = p.life;
    (p.mesh.material as MeshStandardMaterial).color.set(color);
    (p.mesh.material as MeshStandardMaterial).emissive.set(color);
    p.mesh.visible = true;
  }
}

// Chip stack on bet zone
function createChipStack(betType: BetType, amount: number) {
  const zone = betZones.find(z => z.type === betType);
  if (!zone) return;

  // Remove existing
  const existing = chipMeshes.get(betType);
  if (existing) { world.scene.remove(existing); chipMeshes.delete(betType); }

  if (amount <= 0) return;

  const group = new Group();
  const chipCount = Math.min(5, Math.ceil(amount / 25));
  const chipGeo = new CylinderGeometry(0.025, 0.025, 0.008, 12);

  // Determine dominant chip color
  let chipColor = CHIP_COLORS[1];
  for (const val of [100, 25, 10, 5, 1]) {
    if (amount >= val) { chipColor = CHIP_COLORS[val]; break; }
  }

  for (let i = 0; i < chipCount; i++) {
    const mat = new MeshStandardMaterial({
      color: chipColor, emissive: chipColor, emissiveIntensity: 0.3,
      metalness: 0.4, roughness: 0.3,
    });
    const chip = new Mesh(chipGeo, mat);
    chip.position.y = i * 0.01;
    group.add(chip);

    // Chip edge ring
    const ringGeo = new TorusGeometry(0.025, 0.002, 6, 12);
    const ringMat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3, transparent: true, opacity: 0.5 });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = i * 0.01;
    group.add(ring);
  }

  group.position.copy(zone.mesh.position);
  group.position.y = TABLE_Y + 0.01;
  world.scene.add(group);
  chipMeshes.set(betType, group);
}

function updateAllChipStacks() {
  // Clear chips for bets that no longer exist
  for (const [type, mesh] of chipMeshes) {
    if (!GM.bets.find(b => b.type === type)) {
      world.scene.remove(mesh);
      chipMeshes.delete(type);
    }
  }
  // Create/update chips for active bets
  for (const bet of GM.bets) {
    createChipStack(bet.type, bet.amount);
  }
}

function updateBetZoneHighlights() {
  for (const zone of betZones) {
    const hasBet = GM.bets.some(b => b.type === zone.type);
    const mat = zone.mesh.material as MeshStandardMaterial;
    if (hasBet) {
      mat.opacity = 0.5;
      mat.emissiveIntensity = 0.5;
    } else {
      mat.opacity = 0.25;
      mat.emissiveIntensity = 0.2;
    }
  }
}


// ============================================================
// PANEL HELPERS
// ============================================================
const getDoc = (e: Entity) => (e as any).getValue(PanelDocument, 'document') as UIKitDocument | undefined;
const setText = (e: Entity, id: string, text: string) =>
  (getDoc(e)?.getElementById(id) as UIKit.Text | undefined)?.setProperties({ text });

function showPanel(name: string) {
  panelEntities.forEach((e, n) => {
    const shouldShow = n === name;
    if (followerNames.has(n)) {
      const obj = e.object3D;
      if (obj) obj.visible = shouldShow;
    } else {
      const hasScreen = e.hasComponent(ScreenSpace);
      if (shouldShow && !hasScreen) e.addComponent(ScreenSpace, {});
      else if (!shouldShow && hasScreen) e.removeComponent(ScreenSpace);
      const obj = e.object3D;
      if (obj) obj.visible = shouldShow;
    }
  });
}

function hideAllPanels() {
  panelEntities.forEach((e, n) => {
    if (followerNames.has(n)) {
      const obj = e.object3D;
      if (obj) obj.visible = false;
    } else {
      if (e.hasComponent(ScreenSpace)) e.removeComponent(ScreenSpace);
      const obj = e.object3D;
      if (obj) obj.visible = false;
    }
  });
}

// ============================================================
// DICE THROWING
// ============================================================
let diceGroup1: Group | null = null;
let diceGroup2: Group | null = null;

function throwDice() {
  if (GM.diceAnimating) return;
  if (GM.bets.length === 0 && GM.mode !== 'practice' && GM.mode !== 'tutorial') return;

  audio.init();
  audio.playSfx('dice_throw');

  GM.diceAnimating = true;
  GM.lastBets = [...GM.bets.map(b => ({ ...b }))];

  // Remove old dice
  if (diceGroup1) { world.scene.remove(diceGroup1); diceGroup1 = null; }
  if (diceGroup2) { world.scene.remove(diceGroup2); diceGroup2 = null; }

  // Create new dice
  diceGroup1 = createDie(-0.1, 0.3);
  diceGroup2 = createDie(0.1, 0.3);
  world.scene.add(diceGroup1);
  world.scene.add(diceGroup2);

  // Determine result (pre-calculated, animation is cosmetic)
  let d1: number, d2: number;
  if (GM.mode === 'daily') {
    d1 = Math.floor(dailyRng() * 6) + 1;
    d2 = Math.floor(dailyRng() * 6) + 1;
  } else {
    d1 = Math.floor(Math.random() * 6) + 1;
    d2 = Math.floor(Math.random() * 6) + 1;
  }
  GM.lastDie1 = d1;
  GM.lastDie2 = d2;

  // Set initial throw velocities
  dice.length = 0;
  dice.push({
    mesh: diceGroup1,
    velocity: new Vector3(-0.3 + Math.random() * 0.6, 2 + Math.random(), -2 - Math.random()),
    angVel: new Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
    settled: false, value: d1,
  });
  dice.push({
    mesh: diceGroup2,
    velocity: new Vector3(-0.3 + Math.random() * 0.6, 2 + Math.random(), -2 - Math.random()),
    angVel: new Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
    settled: false, value: d2,
  });

  GM.state = 'rolling';
}

function updateDicePhysics(delta: number) {
  if (!GM.diceAnimating) return;

  const gravity = -9.81;
  const bounce = 0.4;
  const friction = 0.96;
  const angFriction = 0.93;
  let allSettled = true;

  for (const d of dice) {
    if (d.settled) continue;

    // Apply gravity
    d.velocity.y += gravity * delta;
    d.mesh.position.x += d.velocity.x * delta;
    d.mesh.position.y += d.velocity.y * delta;
    d.mesh.position.z += d.velocity.z * delta;

    // Rotation
    d.mesh.rotation.x += d.angVel.x * delta;
    d.mesh.rotation.y += d.angVel.y * delta;
    d.mesh.rotation.z += d.angVel.z * delta;

    // Table bounce
    if (d.mesh.position.y <= TABLE_Y + 0.06) {
      d.mesh.position.y = TABLE_Y + 0.06;
      d.velocity.y = Math.abs(d.velocity.y) * bounce;
      d.velocity.x *= friction;
      d.velocity.z *= friction;
      d.angVel.multiplyScalar(angFriction);
      if (Math.abs(d.velocity.y) > 0.3) audio.playSfx('dice_bounce');
    }

    // Wall bounces
    const halfW = TABLE_WIDTH / 2 - 0.08;
    const halfD = TABLE_DEPTH / 2 - 0.08;
    if (d.mesh.position.x < -halfW) { d.mesh.position.x = -halfW; d.velocity.x *= -bounce; }
    if (d.mesh.position.x > halfW) { d.mesh.position.x = halfW; d.velocity.x *= -bounce; }
    if (d.mesh.position.z < -halfD) { d.mesh.position.z = -halfD; d.velocity.z *= -bounce; }
    if (d.mesh.position.z > halfD) { d.mesh.position.z = halfD; d.velocity.z *= -bounce; }

    // Check if settled
    const speed = d.velocity.length();
    const angSpeed = d.angVel.length();
    if (speed < 0.05 && angSpeed < 0.3 && d.mesh.position.y < TABLE_Y + 0.1) {
      d.settled = true;
      d.velocity.set(0, 0, 0);
      d.angVel.set(0, 0, 0);
      d.mesh.position.y = TABLE_Y + 0.06;
      audio.playSfx('dice_settle');
    } else {
      allSettled = false;
    }
  }

  if (allSettled && dice.length === 2) {
    GM.diceAnimating = false;
    const total = GM.lastDie1 + GM.lastDie2;
    const roll: RollResult = { die1: GM.lastDie1, die2: GM.lastDie2, total };
    const result = processRoll(roll);

    // Spawn particles at dice position
    const dicePos = new Vector3(
      (dice[0].mesh.position.x + dice[1].mesh.position.x) / 2,
      TABLE_Y + 0.2,
      (dice[0].mesh.position.z + dice[1].mesh.position.z) / 2
    );
    const pColor = result.totalPayout > 0 ? 0x44ff44 : (total === 7 && GM.phase === 'comeout' ? 0x44ff44 : 0xff4444);
    if (result.totalPayout >= 200) {
      spawnBigWinParticles(dicePos, result.totalPayout);
    } else {
      spawnParticles(dicePos, 15, pColor);
    }

    // Update 3D chip stacks and bet zone highlights
    updateAllChipStacks();
    updateBetZoneHighlights();
    updateHotColdPanel();

    // Show result
    GM.state = 'result';
    showPanel('result');

    // Update result panel
    const re = panelEntities.get('result');
    if (re) {
      setText(re, 'result-title', `ROLLED: ${total}`);
      setText(re, 'result-dice', `${GM.lastDie1} + ${GM.lastDie2}${GM.lastDie1 === GM.lastDie2 ? ' (HARD)' : ''}`);
      if (result.totalPayout > 0) {
        setText(re, 'result-outcome', 'WINNER!');
        setText(re, 'result-payout', `+$${result.totalPayout}`);
      } else if (result.messages.some(m => m.includes('-$'))) {
        setText(re, 'result-outcome', 'No luck...');
        setText(re, 'result-payout', result.messages.filter(m => m.includes('-$')).join(', '));
      } else {
        setText(re, 'result-outcome', GM.phase === 'point' ? `Point: ${GM.point}` : 'Come-Out Roll');
        setText(re, 'result-payout', '--');
      }
      setText(re, 'result-point', GM.phase === 'point' ? `Point: ${GM.point} (ON)` : 'Point: OFF');
    }

    updatePuckPosition();

    // Check game over conditions
    if (GM.mode !== 'practice' && GM.mode !== 'tutorial' && GM.bankroll <= 0 && GM.bets.length === 0) {
      setTimeout(() => {
        GM.state = 'gameover';
        showPanel('gameover');
        updateGameOverPanel();
        addToLeaderboard();
      }, 2000);
    }

    if (GM.mode === 'session' && GM.bankroll >= GM.sessionGoal) {
      setTimeout(() => {
        GM.state = 'gameover';
        showPanel('gameover');
        updateGameOverPanel();
        addToLeaderboard();
      }, 2000);
    }
  }
}

function addToLeaderboard() {
  const entry = {
    score: GM.bankroll,
    mode: GM.mode,
    rolls: GM.rollCount,
    date: new Date().toLocaleDateString(),
  };
  GM.leaderboard.push(entry);
  GM.leaderboard.sort((a, b) => b.score - a.score);
  if (GM.leaderboard.length > 20) GM.leaderboard.length = 20;

  // Update career
  const elapsed = Math.floor((Date.now() - GM.sessionStart) / 60000);
  GM.career.playTime += elapsed;
  if (GM.mode === 'daily') { if (GM.unlock('daily_done')) GM.toastQueue.push('Achievement: Daily Roller!'); }

  GM.save();
}

function updateGameOverPanel() {
  const e = panelEntities.get('gameover');
  if (!e) return;
  setText(e, 'final-mode', GM.mode.charAt(0).toUpperCase() + GM.mode.slice(1));
  setText(e, 'final-bankroll', `$${GM.bankroll}`);
  setText(e, 'final-rolls', `Rolls: ${GM.rollCount}`);
  setText(e, 'final-won', `Won: $${GM.totalWon}`);
  setText(e, 'final-lost', `Lost: $${GM.totalLost}`);
  setText(e, 'final-streak', `Best Streak: ${GM.bestStreak}`);
  setText(e, 'final-sevens', `Seven-Outs: ${GM.sevenOuts}`);
  const elapsed = Math.floor((Date.now() - GM.sessionStart) / 60000);
  setText(e, 'final-time', `Time: ${elapsed}m`);
  const net = GM.bankroll - GM.startBankroll;
  setText(e, 'final-net', `Net: ${net >= 0 ? '+' : ''}$${net}`);
  const roi = GM.startBankroll > 0 ? Math.round((net / GM.startBankroll) * 100) : 0;
  setText(e, 'final-roi', `ROI: ${roi >= 0 ? '+' : ''}${roi}%`);
}

function updateHUD() {
  const e = panelEntities.get('hud');
  if (!e) return;
  setText(e, 'bankroll', `$${GM.bankroll}`);
  setText(e, 'point-display', GM.phase === 'point' ? `Point: ${GM.point}` : 'Point: OFF');
  setText(e, 'phase', GM.phase === 'comeout' ? 'Come-Out' : 'Point Phase');
  const last = GM.rollHistory[0];
  setText(e, 'last-roll', last ? `Last: ${last.total} (${last.die1}+${last.die2})` : 'Last: --');
  setText(e, 'total-bet', `Bet: $${GM.getTotalBet()}`);
  setText(e, 'mode-label', GM.mode.charAt(0).toUpperCase() + GM.mode.slice(1));
  setText(e, 'chip-size', `Chip: $${GM.chipSize}`);
  const pl = GM.bankroll - GM.startBankroll;
  setText(e, 'session-pl', `P/L: ${pl >= 0 ? '+' : ''}$${pl}`);
  setText(e, 'rolls-count', `Rolls: ${GM.rollCount}`);
  setText(e, 'speed-timer', GM.mode === 'speed' ? `Time: ${Math.max(0, Math.floor(GM.speedTimer))}s` : '');
  const xpNeeded = 100 + GM.level * 50;
  setText(e, 'xp-display', `Lv.${GM.level} XP:${GM.xp}/${xpNeeded}`);
  setText(e, 'streak-display', GM.winStreak >= 3 ? `Streak: ${GM.winStreak}!` : '');

  // Session timer
  const sessionElapsed = Math.floor((Date.now() - GM.sessionStart) / 1000);
  const mins = Math.floor(sessionElapsed / 60);
  const secs = sessionElapsed % 60;
  setText(e, 'session-time', mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);

  // Session time achievements
  if (mins >= 10) GM.unlock('session_10m');
  if (mins >= 30) GM.unlock('session_30m');

  // House edge for current bets
  const betEdge = calculateBetEdge();
  setText(e, 'house-edge', betEdge !== null ? `Edge: ${betEdge}%` : '');
}

function updateBetsPanel() {
  const e = panelEntities.get('bets');
  if (!e) return;
  for (let i = 1; i <= 8; i++) {
    const bet = GM.bets[i - 1];
    setText(e, `bet-${i}`, bet ? `${bet.type}: $${bet.amount}` : '--');
  }
  // Show come/don't come points
  let comeTxt = '';
  for (const [num, amt] of GM.comePoints) comeTxt += `C${num}:$${amt} `;
  for (const [num, amt] of GM.dontComePoints) comeTxt += `DC${num}:$${amt} `;
  // Use last bet slots for come points display
  if (comeTxt.length > 0 && GM.bets.length < 8) {
    setText(e, `bet-${Math.min(GM.bets.length + 1, 8)}`, comeTxt.trim());
  }
}

// House edge calculation for active bets
function calculateBetEdge(): string | null {
  if (GM.bets.length === 0) return null;
  const EDGES: Partial<Record<BetType, number>> = {
    pass: 1.41, dontpass: 1.36, come: 1.41, dontcome: 1.36,
    field: 5.56, place4: 6.67, place5: 4.0, place6: 1.52,
    place8: 1.52, place9: 4.0, place10: 6.67,
    hard4: 11.11, hard6: 9.09, hard8: 9.09, hard10: 11.11,
    anyseven: 16.67, anycraps: 11.11, yo: 11.11, aces: 13.89, boxcars: 13.89,
    odds_pass: 0, odds_dontpass: 0, big6: 9.09, big8: 9.09,
  };
  let totalBet = 0;
  let weightedEdge = 0;
  for (const bet of GM.bets) {
    const edge = EDGES[bet.type] ?? 5;
    totalBet += bet.amount;
    weightedEdge += edge * bet.amount;
  }
  if (totalBet === 0) return null;
  return (weightedEdge / totalBet).toFixed(1);
}

function updateHistoryPanel() {
  const e = panelEntities.get('history');
  if (!e) return;
  for (let i = 1; i <= 10; i++) {
    const roll = GM.rollHistory[i - 1];
    setText(e, `hist-${i}`, roll ? `${roll.total} (${roll.die1}+${roll.die2})` : '--');
  }
}

function updateLeaderboardPanel() {
  const e = panelEntities.get('leaderboard');
  if (!e) return;
  for (let i = 1; i <= 10; i++) {
    const entry = GM.leaderboard[i - 1];
    setText(e, `lb-${i}`, entry ? `${i}. $${entry.score} - ${entry.mode} (${entry.rolls}r) ${entry.date}` : `${i}. ---`);
  }
}

function updateAchievementsPanel() {
  const e = panelEntities.get('achievements');
  if (!e) return;
  const start = GM.achPage * 15;
  for (let i = 0; i < 15; i++) {
    const ach = GM.achievements[start + i];
    if (ach) {
      setText(e, `ach-${i + 1}`, `${ach.unlocked ? '[X]' : '[ ]'} ${ach.name}: ${ach.desc}`);
    } else {
      setText(e, `ach-${i + 1}`, '');
    }
  }
  const totalPages = Math.ceil(GM.achievements.length / 15);
  setText(e, 'page-info', `${GM.achPage + 1}/${totalPages}`);
}

function updateStatsPanel() {
  const e = panelEntities.get('stats');
  if (!e) return;
  setText(e, 'stat-1', `Games: ${GM.career.games}`);
  setText(e, 'stat-2', `Total Rolls: ${GM.career.totalRolls}`);
  setText(e, 'stat-3', `Total Won: $${GM.career.totalWon}`);
  setText(e, 'stat-4', `Total Lost: $${GM.career.totalLost}`);
  setText(e, 'stat-5', `Best Bankroll: $${GM.career.bestBankroll}`);
  setText(e, 'stat-6', `Best Win Streak: ${GM.career.bestStreak}`);
  setText(e, 'stat-7', `Seven-Outs: ${GM.career.sevenOuts}`);
  setText(e, 'stat-8', `Naturals (7/11): ${GM.career.naturals}`);
  setText(e, 'stat-9', `Craps (2/3/12): ${GM.career.craps}`);
  setText(e, 'stat-10', `Points Made: ${GM.career.pointsMade}`);
  setText(e, 'stat-11', `Hardways Hit: ${GM.career.hardwaysHit}`);
  setText(e, 'stat-12', `Play Time: ${GM.career.playTime}m`);
}

function updateHotColdPanel() {
  const e = panelEntities.get('hotcold');
  if (!e) return;

  // Build sorted array of number frequencies
  const nums = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const sorted = nums
    .map(n => ({ num: n, count: GM.numberCounts.get(n) || 0 }))
    .sort((a, b) => b.count - a.count);

  // Hot: top 3
  for (let i = 0; i < 3; i++) {
    const entry = sorted[i];
    setText(e, `hot-${i + 1}`, entry && entry.count > 0 ? `${entry.num}: ${entry.count}x` : '--');
  }
  // Cold: bottom 3
  const cold = sorted.filter(s => s.count === 0).length >= 3
    ? sorted.filter(s => s.count === 0).slice(0, 3)
    : sorted.slice(-3).reverse();
  for (let i = 0; i < 3; i++) {
    const entry = cold[i];
    setText(e, `cold-${i + 1}`, entry ? `${entry.num}: ${entry.count}x` : '--');
  }

  // Seven ratio
  const sevens = GM.numberCounts.get(7) || 0;
  const totalRolls = GM.rollCount;
  const pct = totalRolls > 0 ? Math.round((sevens / totalRolls) * 100) : 0;
  setText(e, 'seven-ratio', `7s: ${sevens}/${totalRolls} (${pct}%)`);
}

function updateSkinsPanel() {
  const e = panelEntities.get('skins');
  if (!e) return;
  for (let i = 0; i < DICE_SKINS.length; i++) {
    const skin = DICE_SKINS[i];
    const active = i === GM.currentSkin;
    const unlocked = i === 0 || checkSkinUnlock(i);
    setText(e, `skin-${i + 1}`, `${active ? '[*]' : unlocked ? '[ ]' : '[?]'} ${skin.name}${unlocked ? '' : ` (${skin.unlock})`}`);
  }
}

function checkSkinUnlock(idx: number): boolean {
  switch (idx) {
    case 1: return GM.career.totalRolls >= 50;
    case 2: return GM.career.totalWon >= 5000;
    case 3: return GM.career.games >= 10;
    case 4: return GM.career.bestStreak >= 5;
    case 5: return GM.career.pointsMade >= 1;
    case 6: return GM.modesPlayed.size >= 8;
    case 7: return GM.career.hardwaysHit >= 1;
    default: return false;
  }
}

function updateSettingsPanel() {
  const e = panelEntities.get('settings');
  if (!e) return;
  setText(e, 'master-vol', `${GM.masterVol}%`);
  setText(e, 'sfx-vol', `${GM.sfxVol}%`);
  setText(e, 'music-vol', `${GM.musicVol}%`);
  setText(e, 'theme-name', THEMES[GM.currentTheme].name);
}

function startGame() {
  let startBank = 1000;
  if (GM.difficulty === 0) startBank = 1000;
  else if (GM.difficulty === 1) startBank = 500;
  else startBank = 250;
  if (GM.mode === 'highroller') startBank *= 5;
  if (GM.mode === 'practice') startBank = 99999;
  if (GM.mode === 'daily') { dailyRng = mulberry32(getDailySeed()); startBank = 500; }
  if (GM.mode === 'session') { GM.sessionGoal = startBank * 2; }

  GM.resetForNewGame(startBank);
  GM.state = 'countdown';
  showPanel('countdown');
  GM.countdownVal = 3;
}


// ============================================================
// PANEL VISIBILITY — state-driven, runs every frame
// ============================================================
let placeIdx = 0;
let hardIdx = 0;
let propIdx = 0;
const PLACE_BETS: BetType[] = ['place4', 'place5', 'place6', 'place8', 'place9', 'place10'];
const HARD_BETS: BetType[] = ['hard4', 'hard6', 'hard8', 'hard10'];
const PROP_BETS: BetType[] = ['anyseven', 'anycraps', 'yo', 'aces', 'boxcars'];

function updatePanelVisibility() {
  const s = GM.state;
  const gameplay = s === 'betting' || s === 'rolling' || s === 'result';
  const vis: Record<string, boolean> = {
    title: s === 'title',
    mode: s === 'mode',
    difficulty: s === 'difficulty',
    countdown: s === 'countdown',
    betting: s === 'betting',
    hud: gameplay,
    result: s === 'result',
    gameover: s === 'gameover',
    pause: s === 'pause',
    help: s === 'help',
    achievements: s === 'achievements',
    leaderboard: s === 'leaderboard',
    stats: s === 'stats',
    skins: s === 'skins',
    settings: s === 'settings',
    history: gameplay,
    bets: gameplay,
    payouts: s === 'payouts' || s === 'betting',
    toast: GM.toastTimer > 0,
    hotcold: gameplay,
    strategy: s === 'strategy',
  };
  panelEntities.forEach((e, name) => {
    const shouldShow = vis[name] || false;
    if (followerNames.has(name)) {
      // Follower panels (hud, toast) use Object3D.visible — they're 3D objects
      const obj = e.object3D;
      if (obj) obj.visible = shouldShow;
    } else {
      // ScreenSpace panels: toggle both the component (controls overlay rendering)
      // AND object3D.visible (prevents world-space rendering at origin).
      const hasScreen = e.hasComponent(ScreenSpace);
      if (shouldShow && !hasScreen) {
        e.addComponent(ScreenSpace, {});
      } else if (!shouldShow && hasScreen) {
        e.removeComponent(ScreenSpace);
      }
      const obj = e.object3D;
      if (obj) obj.visible = shouldShow;
    }
  });
}

// ============================================================
// UI SYSTEM — wires button handlers on qualify
// ============================================================
class CrapsUISystem extends createSystem({
  title: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/title.json')] },
  mode: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/mode.json')] },
  difficulty: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/difficulty.json')] },
  countdown: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/countdown.json')] },
  betting: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/betting.json')] },
  hud: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  result: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/result.json')] },
  gameover: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/gameover.json')] },
  pause: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
  help: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/help.json')] },
  achpanel: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achpanel.json')] },
  leaderboard: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/leaderboard.json')] },
  stats: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/stats.json')] },
  skins: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/skins.json')] },
  settings: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
  toast: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/toast.json')] },
  hotcold: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hotcold.json')] },
  strategy: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/strategy.json')] },
}) {
  init() {
    const wire = (doc: UIKitDocument, id: string, fn: () => void) => {
      const el = doc.getElementById(id) as UIKit.Text | undefined;
      el?.addEventListener('click', fn);
    };

    // ── Title ──
    this.queries.title.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      // Update level display
      const levelTitles = ['Beginner', 'Novice', 'Regular', 'Experienced', 'Skilled', 'Advanced', 'Expert', 'Veteran', 'Master', 'Grand Master', 'Legend'];
      const titleIdx = Math.min(Math.floor(GM.level / 5), levelTitles.length - 1);
      setText(entity, 'level-display', `Level ${GM.level} - ${levelTitles[titleIdx]}`);
      setText(entity, 'career-rolls', `Career Rolls: ${GM.career.totalRolls}`);
      wire(doc, 'btn-play', () => { audio.playSfx('click'); GM.state = 'mode'; });
      wire(doc, 'btn-scores', () => { audio.playSfx('click'); GM.state = 'leaderboard'; updateLeaderboardPanel(); });
      wire(doc, 'btn-achievements', () => { audio.playSfx('click'); GM.state = 'achievements'; updateAchievementsPanel(); });
      wire(doc, 'btn-stats', () => { audio.playSfx('click'); GM.state = 'stats'; updateStatsPanel(); });
      wire(doc, 'btn-skins', () => { audio.playSfx('click'); GM.state = 'skins'; updateSkinsPanel(); });
      wire(doc, 'btn-settings', () => { audio.playSfx('click'); GM.state = 'settings'; updateSettingsPanel(); });
      wire(doc, 'btn-help', () => { audio.playSfx('click'); GM.state = 'help'; });
      wire(doc, 'btn-strategy', () => { audio.playSfx('click'); GM.state = 'strategy'; });
    });

    // ── Mode ──
    this.queries.mode.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      const selectMode = (m: GameMode) => { audio.playSfx('click'); GM.mode = m; GM.state = 'difficulty'; };
      wire(doc, 'btn-classic', () => selectMode('classic'));
      wire(doc, 'btn-speed', () => selectMode('speed'));
      wire(doc, 'btn-practice', () => selectMode('practice'));
      wire(doc, 'btn-highroller', () => selectMode('highroller'));
      wire(doc, 'btn-daily', () => selectMode('daily'));
      wire(doc, 'btn-session', () => selectMode('session'));
      wire(doc, 'btn-marathon', () => selectMode('marathon'));
      wire(doc, 'btn-tutorial', () => selectMode('tutorial'));
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Difficulty ──
    this.queries.difficulty.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-easy', () => { audio.playSfx('click'); GM.difficulty = 0; startGame(); });
      wire(doc, 'btn-medium', () => { audio.playSfx('click'); GM.difficulty = 1; startGame(); });
      wire(doc, 'btn-hard', () => { audio.playSfx('click'); GM.difficulty = 2; startGame(); });
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'mode'; });
    });

    // ── Betting ──
    this.queries.betting.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-chip1', () => { audio.playSfx('chip_select'); GM.chipSize = 1; });
      wire(doc, 'btn-chip5', () => { audio.playSfx('chip_select'); GM.chipSize = 5; });
      wire(doc, 'btn-chip10', () => { audio.playSfx('chip_select'); GM.chipSize = 10; });
      wire(doc, 'btn-chip25', () => { audio.playSfx('chip_select'); GM.chipSize = 25; });
      wire(doc, 'btn-chip100', () => { audio.playSfx('chip_select'); GM.chipSize = 100; });
      wire(doc, 'btn-pass', () => { audio.playSfx('bet_place'); GM.addBet('pass', GM.chipSize); updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      wire(doc, 'btn-dontpass', () => { audio.playSfx('bet_place'); GM.addBet('dontpass', GM.chipSize); updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      wire(doc, 'btn-field', () => { audio.playSfx('bet_place'); GM.addBet('field', GM.chipSize); updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      wire(doc, 'btn-come', () => { audio.playSfx('bet_place'); GM.addBet('come', GM.chipSize); updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      wire(doc, 'btn-place', () => { audio.playSfx('bet_place'); GM.addBet(PLACE_BETS[placeIdx], GM.chipSize); placeIdx = (placeIdx + 1) % PLACE_BETS.length; updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      wire(doc, 'btn-hard', () => { audio.playSfx('bet_place'); GM.addBet(HARD_BETS[hardIdx], GM.chipSize); hardIdx = (hardIdx + 1) % HARD_BETS.length; updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      wire(doc, 'btn-prop', () => { audio.playSfx('bet_place'); GM.addBet(PROP_BETS[propIdx], GM.chipSize); propIdx = (propIdx + 1) % PROP_BETS.length; updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      wire(doc, 'btn-odds', () => {
        audio.playSfx('bet_place');
        const hasDP = GM.bets.some(b => b.type === 'dontpass');
        GM.addBet(hasDP ? 'odds_dontpass' : 'odds_pass', GM.chipSize);
        updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights();
      });
      wire(doc, 'btn-roll', () => { throwDice(); });
      wire(doc, 'btn-clear', () => { audio.playSfx('bet_clear'); GM.clearBets(); updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); });
      // Strategy presets
      wire(doc, 'btn-preset-iron', () => {
        audio.playSfx('bet_place');
        GM.clearBets();
        GM.addBet('field', GM.chipSize);
        GM.addBet('place5', GM.chipSize);
        GM.addBet('place6', GM.chipSize);
        GM.addBet('place8', GM.chipSize);
        GM.career.presetsUsed++;
        if (GM.unlock('preset_user')) GM.toastQueue.push('Achievement: Strategist!');
        updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights();
      });
      wire(doc, 'btn-preset-conservative', () => {
        audio.playSfx('bet_place');
        GM.clearBets();
        GM.addBet('pass', GM.chipSize);
        if (GM.phase === 'point') GM.addBet('odds_pass', GM.chipSize * 2);
        GM.career.presetsUsed++;
        if (GM.unlock('preset_user')) GM.toastQueue.push('Achievement: Strategist!');
        updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights();
      });
      wire(doc, 'btn-preset-dark', () => {
        audio.playSfx('bet_place');
        GM.clearBets();
        GM.addBet('dontpass', GM.chipSize);
        if (GM.phase === 'point') GM.addBet('odds_dontpass', GM.chipSize * 2);
        GM.career.presetsUsed++;
        if (GM.unlock('preset_user')) GM.toastQueue.push('Achievement: Strategist!');
        updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights();
      });
      wire(doc, 'btn-repeat', () => {
        if (GM.lastBets.length > 0) {
          audio.playSfx('bet_place');
          GM.bets = GM.lastBets.map(b => ({ ...b }));
          updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights();
        }
      });
    });

    // ── Result ──
    this.queries.result.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-continue', () => { audio.playSfx('click'); GM.state = 'betting'; updateHUD(); updateBetsPanel(); updateHistoryPanel(); });
    });

    // ── Game Over ──
    this.queries.gameover.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-rematch', () => { audio.playSfx('click'); startGame(); });
      wire(doc, 'btn-menu', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Pause ──
    this.queries.pause.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-resume', () => { audio.playSfx('click'); GM.state = 'betting'; updateHUD(); });
      wire(doc, 'btn-quit', () => { audio.playSfx('click'); addToLeaderboard(); GM.state = 'title'; });
    });

    // ── Help ──
    this.queries.help.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Achievements ──
    this.queries.achpanel.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-prev', () => { audio.playSfx('click'); GM.achPage = Math.max(0, GM.achPage - 1); updateAchievementsPanel(); });
      wire(doc, 'btn-next', () => { audio.playSfx('click'); GM.achPage = Math.min(Math.ceil(GM.achievements.length / 15) - 1, GM.achPage + 1); updateAchievementsPanel(); });
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Leaderboard ──
    this.queries.leaderboard.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Stats ──
    this.queries.stats.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Skins ──
    this.queries.skins.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      for (let i = 0; i < DICE_SKINS.length; i++) {
        const idx = i;
        wire(doc, `skin-${idx + 1}`, () => {
          audio.playSfx('click');
          if (idx === 0 || checkSkinUnlock(idx)) {
            GM.currentSkin = idx;
            GM.save();
            if (GM.unlock('skin_unlock')) GM.toastQueue.push('Achievement: Fashionista!');
          }
          updateSkinsPanel();
        });
      }
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Settings ──
    this.queries.settings.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-master-down', () => { GM.masterVol = Math.max(0, GM.masterVol - 10); audio.setVolumes(GM.masterVol, GM.sfxVol, GM.musicVol); updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-master-up', () => { GM.masterVol = Math.min(100, GM.masterVol + 10); audio.setVolumes(GM.masterVol, GM.sfxVol, GM.musicVol); updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-sfx-down', () => { GM.sfxVol = Math.max(0, GM.sfxVol - 10); audio.setVolumes(GM.masterVol, GM.sfxVol, GM.musicVol); updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-sfx-up', () => { GM.sfxVol = Math.min(100, GM.sfxVol + 10); audio.setVolumes(GM.masterVol, GM.sfxVol, GM.musicVol); updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-music-down', () => { GM.musicVol = Math.max(0, GM.musicVol - 10); audio.setVolumes(GM.masterVol, GM.sfxVol, GM.musicVol); updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-music-up', () => { GM.musicVol = Math.min(100, GM.musicVol + 10); audio.setVolumes(GM.masterVol, GM.sfxVol, GM.musicVol); updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-theme-prev', () => { audio.playSfx('click'); GM.currentTheme = (GM.currentTheme - 1 + THEMES.length) % THEMES.length; updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-theme-next', () => { audio.playSfx('click'); GM.currentTheme = (GM.currentTheme + 1) % THEMES.length; updateSettingsPanel(); GM.save(); });
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Strategy ──
    this.queries.strategy.subscribe('qualify', (entity: Entity) => {
      const doc = getDoc(entity); if (!doc) return;
      wire(doc, 'btn-back', () => { audio.playSfx('click'); GM.state = 'title'; });
    });

    // ── Hot/Cold — no buttons needed ──
  }

  update() { /* wiring-only system; no per-frame work */ }
}

// ============================================================
// GAME LOOP SYSTEM — ticks every frame
// ============================================================
class CrapsGameSystem extends createSystem({}) {
  private countdownTimer = 0;
  private streakFireTimer = 0;
  private diceTrailTimer = 0;
  private puckPulsePhase = 0;

  update(delta: number, time: number) {
    // Dice physics
    updateDicePhysics(delta);

    // Dice trail particles during throw
    if (GM.diceAnimating) {
      this.diceTrailTimer += delta;
      if (this.diceTrailTimer > 0.03) {
        this.diceTrailTimer = 0;
        const skin = DICE_SKINS[GM.currentSkin];
        const trailColor = parseInt(skin.glow.replace('#', ''), 16);
        for (const d of dice) {
          if (!d.settled) {
            const p = particles.find(pp => pp.life <= 0);
            if (p) {
              p.mesh.position.copy(d.mesh.position);
              p.vel.set((Math.random() - 0.5) * 0.3, -0.2, (Math.random() - 0.5) * 0.3);
              p.life = 0.25 + Math.random() * 0.15;
              p.maxLife = p.life;
              (p.mesh.material as MeshStandardMaterial).color.set(trailColor);
              (p.mesh.material as MeshStandardMaterial).emissive.set(trailColor);
              p.mesh.visible = true;
            }
          }
        }
      }
    } else {
      this.diceTrailTimer = 0;
    }

    // Animated puck pulse
    if (puckMesh && GM.phase === 'point') {
      this.puckPulsePhase += delta * 3;
      const pulse = 0.3 + Math.sin(this.puckPulsePhase) * 0.2;
      (puckMesh.material as MeshStandardMaterial).emissiveIntensity = pulse;
      // Bob the puck slightly
      puckMesh.position.y = TABLE_Y + 0.03 + Math.sin(this.puckPulsePhase * 0.5) * 0.005;
    }

    // Particles
    for (const p of particles) {
      if (p.life > 0) {
        p.life -= delta;
        p.mesh.position.x += p.vel.x * delta;
        p.mesh.position.y += p.vel.y * delta;
        p.mesh.position.z += p.vel.z * delta;
        p.vel.y -= 5 * delta;
        const opacity = Math.max(0, p.life / p.maxLife);
        (p.mesh.material as MeshStandardMaterial).opacity = opacity;
        if (p.life <= 0) p.mesh.visible = false;
      }
    }

    // Streak fire effect — spawn flame particles around table edges during hot streaks
    if (GM.winStreak >= 3 && (GM.state === 'betting' || GM.state === 'result')) {
      this.streakFireTimer += delta;
      if (this.streakFireTimer > 0.15) {
        this.streakFireTimer = 0;
        const intensity = Math.min(GM.winStreak, 10);
        const fireColors = [0xff4400, 0xff8800, 0xffaa00, 0xffff00];
        for (let i = 0; i < intensity; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 1.5 + Math.random() * 0.3;
          const pos = new Vector3(
            Math.cos(angle) * radius,
            TABLE_Y + 0.1,
            Math.sin(angle) * radius * 0.5
          );
          const color = fireColors[Math.floor(Math.random() * fireColors.length)];
          const pp = particles.find(p => p.life <= 0);
          if (pp) {
            pp.mesh.position.copy(pos);
            pp.vel.set((Math.random() - 0.5) * 0.3, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 0.3);
            pp.life = 0.4 + Math.random() * 0.3;
            pp.maxLife = pp.life;
            (pp.mesh.material as MeshStandardMaterial).color.set(color);
            (pp.mesh.material as MeshStandardMaterial).emissive.set(color);
            pp.mesh.visible = true;
          }
        }
      }
    } else {
      this.streakFireTimer = 0;
    }

    // Countdown
    if (GM.state === 'countdown') {
      this.countdownTimer += delta;
      if (this.countdownTimer >= 1) {
        this.countdownTimer -= 1;
        GM.countdownVal--;
        const ce = panelEntities.get('countdown');
        if (ce) setText(ce, 'countdown-text', GM.countdownVal > 0 ? String(GM.countdownVal) : 'GO!');
        if (GM.countdownVal > 0) audio.playSfx('countdown');
        else {
          audio.playSfx('go');
          GM.state = 'betting';
          this.countdownTimer = 0;
          updateHUD(); updateBetsPanel(); updateHistoryPanel();
        }
      }
    }

    // Speed mode timer
    if (GM.mode === 'speed' && (GM.state === 'betting' || GM.state === 'rolling' || GM.state === 'result')) {
      GM.speedTimer -= delta;
      if (GM.speedTimer <= 0) {
        GM.state = 'gameover';
        updateGameOverPanel();
        addToLeaderboard();
      }
    }

    // Toast queue
    if (GM.toastQueue.length > 0 && GM.toastTimer <= 0) {
      const msg = GM.toastQueue.shift()!;
      GM.toastTimer = 2.5;
      const te = panelEntities.get('toast');
      if (te) setText(te, 'toast-text', msg);
      audio.playSfx('achievement');
    }
    if (GM.toastTimer > 0) GM.toastTimer -= delta;

    // HUD updates during gameplay
    const gameplay = GM.state === 'betting' || GM.state === 'rolling' || GM.state === 'result';
    if (gameplay) updateHUD();

    // Panel visibility (every frame)
    updatePanelVisibility();

    // Holodeck decoration animation
    this.scene.traverse((obj: Object3D) => {
      if (obj.userData.rotSpeed) {
        obj.rotation.x += obj.userData.rotSpeed * delta;
        obj.rotation.y += obj.userData.rotSpeed * 0.7 * delta;
      }
      if (obj.userData.bobSpeed) {
        obj.position.y = obj.userData.baseY + Math.sin(time * obj.userData.bobSpeed + obj.userData.bobPhase) * 0.15;
      }
      if (obj.userData.driftX !== undefined) {
        obj.position.x += obj.userData.driftX * delta;
        obj.position.z += obj.userData.driftZ * delta;
        if (obj.userData.pulsePhase !== undefined) {
          const mat = (obj as Mesh).material as MeshStandardMaterial;
          if (mat && mat.opacity !== undefined) mat.opacity = 0.15 + Math.sin(time * 2 + obj.userData.pulsePhase) * 0.1;
        }
        if (Math.abs(obj.position.x) > 6) obj.position.x *= -0.9;
        if (Math.abs(obj.position.z) > 6) obj.position.z *= -0.9;
      }
    });

    // XR controller input
    const right = this.input.gamepads?.right;
    if (right) {
      if (right.getButtonDown(InputComponent.Trigger)) {
        if (GM.state === 'betting') throwDice();
        else if (GM.state === 'result') { GM.state = 'betting'; updateHUD(); updateBetsPanel(); updateHistoryPanel(); }
      }
      if (right.getButtonDown(InputComponent.Squeeze)) {
        const idx = CHIP_VALUES.indexOf(GM.chipSize);
        GM.chipSize = CHIP_VALUES[(idx + 1) % CHIP_VALUES.length];
        audio.playSfx('chip_select');
      }
      if (right.getButtonDown(InputComponent.A_Button)) {
        if (GM.state === 'betting') GM.state = 'pause';
        else if (GM.state === 'pause') { GM.state = 'betting'; updateHUD(); }
      }
    }
    const left = this.input.gamepads?.left;
    if (left) {
      if (left.getButtonDown(InputComponent.Trigger)) {
        if (GM.state === 'betting') { audio.playSfx('bet_place'); GM.addBet('pass', GM.chipSize); updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights(); }
      }
      if (left.getButtonDown(InputComponent.Squeeze)) {
        // Cycle through common bets with left squeeze
        const quickBets: BetType[] = ['pass', 'field', 'come', 'dontpass'];
        const currentBetTypes = GM.bets.map(b => b.type);
        const nextBet = quickBets.find(b => !currentBetTypes.includes(b)) || quickBets[0];
        audio.playSfx('bet_place');
        GM.addBet(nextBet, GM.chipSize);
        updateHUD(); updateBetsPanel(); updateAllChipStacks(); updateBetZoneHighlights();
      }
    }
  }
}

// ============================================================
// MAIN INITIALIZATION
// ============================================================
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;
  world = await World.create(container, {
    xr: { offer: 'once' },
    features: {
      locomotion: { browserControls: true } as any,
    },
  });

  // Set camera looking at table
  world.camera.position.set(0, 2.0, 2.5);
  world.camera.lookAt(0, TABLE_Y, 0);

  // Build 3D scene
  createHolodeck();
  const table = createTable();
  world.scene.add(table);
  createBetZones();
  puckMesh = createPuck();
  world.scene.add(puckMesh);
  initParticles();

  // Panel entities
  const panelConfigs: { name: string; config: string; follower: boolean; ox?: number; oy?: number; oz?: number }[] = [
    { name: 'title', config: './ui/title.json', follower: false },
    { name: 'mode', config: './ui/mode.json', follower: false },
    { name: 'difficulty', config: './ui/difficulty.json', follower: false },
    { name: 'countdown', config: './ui/countdown.json', follower: false },
    { name: 'betting', config: './ui/betting.json', follower: false },
    { name: 'hud', config: './ui/hud.json', follower: true, ox: 0, oy: -0.3, oz: -1.2 },
    { name: 'result', config: './ui/result.json', follower: false },
    { name: 'gameover', config: './ui/gameover.json', follower: false },
    { name: 'pause', config: './ui/pause.json', follower: false },
    { name: 'help', config: './ui/help.json', follower: false },
    { name: 'achievements', config: './ui/achpanel.json', follower: false },
    { name: 'leaderboard', config: './ui/leaderboard.json', follower: false },
    { name: 'stats', config: './ui/stats.json', follower: false },
    { name: 'skins', config: './ui/skins.json', follower: false },
    { name: 'settings', config: './ui/settings.json', follower: false },
    { name: 'history', config: './ui/history.json', follower: false },
    { name: 'bets', config: './ui/bets.json', follower: false },
    { name: 'payouts', config: './ui/payouts.json', follower: false },
    { name: 'toast', config: './ui/toast.json', follower: true, ox: 0, oy: 0.3, oz: -1.0 },
    { name: 'hotcold', config: './ui/hotcold.json', follower: false },
    { name: 'strategy', config: './ui/strategy.json', follower: false },
  ];

  panelConfigs.filter(p => p.follower).forEach(p => followerNames.add(p.name));

  for (const pc of panelConfigs) {
    const entity = world.createTransformEntity();
    entity.addComponent(PanelUI, { config: pc.config });
    if (pc.follower) {
      entity.addComponent(Follower, {});
      const fv = entity.getVectorView(Follower, 'offsetPosition');
      fv[0] = pc.ox ?? 0;
      fv[1] = pc.oy ?? 0;
      fv[2] = pc.oz ?? -1.2;
      // Start follower panels hidden
      const obj = entity.object3D;
      if (obj) obj.visible = false;
    } else {
      // Only add ScreenSpace to 'title' (initially visible).
      // Other panels: no ScreenSpace AND object3D hidden to prevent
      // world-space rendering at origin.
      if (pc.name === 'title') {
        entity.addComponent(ScreenSpace, {});
      } else {
        const obj = entity.object3D;
        if (obj) obj.visible = false;
      }
    }
    panelEntities.set(pc.name, entity);
  }

  // Register systems
  world.registerSystem(CrapsUISystem);
  world.registerSystem(CrapsGameSystem);

  // Keyboard input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && GM.state === 'betting') { e.preventDefault(); throwDice(); }
    if (e.code === 'Enter' && GM.state === 'result') { GM.state = 'betting'; updateHUD(); updateBetsPanel(); updateHistoryPanel(); }
    if (e.code === 'Digit1') { GM.chipSize = 1; audio.playSfx('chip_select'); }
    if (e.code === 'Digit2') { GM.chipSize = 5; audio.playSfx('chip_select'); }
    if (e.code === 'Digit3') { GM.chipSize = 10; audio.playSfx('chip_select'); }
    if (e.code === 'Digit4') { GM.chipSize = 25; audio.playSfx('chip_select'); }
    if (e.code === 'Digit5') { GM.chipSize = 100; audio.playSfx('chip_select'); }
    if (e.code === 'KeyC' && GM.state === 'betting') { audio.playSfx('bet_clear'); GM.clearBets(); updateHUD(); updateBetsPanel(); }
    if (e.code === 'KeyR' && GM.state === 'betting' && GM.lastBets.length > 0) { GM.bets = GM.lastBets.map(b => ({ ...b })); audio.playSfx('bet_place'); updateHUD(); updateBetsPanel(); }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (GM.state === 'betting' || GM.state === 'result') GM.state = 'pause';
      else if (GM.state === 'pause') { GM.state = 'betting'; updateHUD(); }
      else if (GM.state !== 'title' && GM.state !== 'rolling' && GM.state !== 'countdown') GM.state = 'title';
    }
  });

  // Initial state
  GM.state = 'title';
}

main();
