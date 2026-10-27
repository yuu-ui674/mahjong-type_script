
"use strict";


/* ---- TypeScript移行 第1段階：牌データの基本型 ---- */
type Suit = "m" | "p" | "s" | "z";

interface Tile {
  uid: number;
  suit: Suit;
  num: number;
  red: boolean;
  called?: boolean;
}

interface TileHTMLOptions {
  button?: boolean;
  sel?: boolean;
}

/* ---- TypeScript移行 第2段階：対局データの基本型 ---- */
type MeldType = "chi" | "pon" | "minkan" | "ankan" | "kakan";
type MeldShape = "s" | "t";
type RonKind = "discard" | "kakan";

interface MeldPart {
  k: MeldShape;
  i: number;
  kan?: boolean;
  open?: boolean;
}

type TileCounts = number[];

interface HandDecomposition {
  pair: number;
  sets: MeldPart[];
}

interface HandEvalContext {
  tsumo: boolean;
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  haitei: boolean;
  houtei: boolean;
  chankan: boolean;
  rinshan: boolean;
  tenhou: boolean;
  chiihou: boolean;
  melds: MeldPart[];
  dora: DoraCount;
  seatWind: number;
  roundWind: number;
  winIdx: number;
}

type WaitKind = "tanki" | "shanpon" | "kanchan" | "penchan" | "ryanmen";

interface Meld extends MeldPart {
  type: MeldType;
  kan: boolean;
  open: boolean;
  tiles: Tile[];
  from: number;
  rel?: number;
}

interface PlayerFlags {
  riichi: boolean;
  doubleRiichi: boolean;
  ippatsu: boolean;
  melds: Meld[];
  rinshan: boolean;
  tmpFuriten: boolean;
  rFuriten: boolean;
}

interface PlayerState extends PlayerFlags {}

interface YakuEntry {
  n: string;
  h: number;
}

interface DoraCount {
  dora: number;
  ura: number;
  aka: number;
}

interface PointsResult {
  basic: number;
  name: string;
  each: number;
  total: number;
}

/* ---- TypeScript移行 第4段階：役・符・点数計算の型 ---- */
type ScoringHandShape = HandDecomposition | null | "kokushi";
type ScoringWaitKind = WaitKind | "none";

interface ScoreFormResult {
  man: string[];
  y: YakuEntry[];
  fu: number;
  extra?: number;
  han?: number;
  pts?: PointsResult;
  dora?: DoraCount;
}

interface WinResult {
  man: string[];
  y: YakuEntry[];
  fu: number;
  extra?: number;
  han?: number;
  pts?: PointsResult;
  dora?: DoraCount;
  seat?: number;
  from?: number;
  delta?: number[];
  winTile?: Tile;
}

interface DrawResult {
  tenpai: boolean[];
  delta: number[];
}

interface CallOption {
  type: "chi" | "pon" | "minkan";
  use: Tile[];
}

interface RonPending {
  s: number;
  tile: Tile;
  k: number;
  w: WinResult;
  kind: RonKind;
}

interface CallPending {
  s: number;
  tile: Tile;
  stage: number;
  opts: CallOption[];
}

interface KakanPending {
  s: number;
  idx: number;
  tile: Tile;
}

interface MatchOutcome {
  renchan: boolean;
  next: {
    dealer: number;
    wind: number;
    kyoku: number;
    honba: number;
  };
}

interface MatchState {
  scores: number[];
  dealer: number;
  wind: number;
  kyoku: number;
  honba: number;
  sticks: number;
}

interface GameState extends PlayerFlags {
  riichiPending: boolean;
  wall: Tile[];
  deadWall: Tile[];
  doraIndicator: Tile;
  hands: Tile[][];
  rivers: Tile[][];
  drawn: Tile | null;
  selected: number | null;
  finished: boolean;
  win: WinResult | null;
  rinIdx: number;
  doraCount: number;
  round: string;
  wind: number;
  kyoku: number;
  honba: number;
  roundWind: number;
  outcome: MatchOutcome | null;
  matchOver: boolean;
  dealer: number;
  turn: number;
  scores: number[];
  pl: Array<PlayerState | null>;
  safe: Array<Set<number>>;
  sticks: number;
  token: number;
  cpuDrawn: Tile | null;
  ronPending: RonPending | null;
  draw: DrawResult | null;
  deadExtra: Tile[];
  callPending: CallPending | null;
  callDiscard: number;
  lastDiscard?: { seat: number; tile: Tile };
  forbid: number[];
  doraPending: number;
  ronKind: RonKind;
  kakan: KakanPending | null;
}

/* ---- 設定（三麻などは後でここを切り替えて対応する） ---- */
const CONFIG = {
  seats: 4,            // 席の数（四麻=4）
  manzuMiddle: true,   // 萬子の2〜8を使うか（三麻ではfalse）
  redFives: true,      // 赤5を各色1枚入れるか
  riverCols: 6,        // 捨て牌を折り返す列数
  deadWallSize: 14,    // 王牌の枚数
  handSize: 13         // 配牌の枚数
};

const SUIT_ORDER: Record<Suit, number> = { m: 0, p: 1, s: 2, z: 3 };
const KAN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const SUIT_CHAR: Record<Exclude<Suit, "z">, string> = { m: "萬", p: "筒", s: "索" };
const HONOR = ["", "東", "南", "西", "北", "白", "發", "中"];

let state: GameState | null = null;

/* ---- 牌の生成・シャッフル・整列 ---- */
function buildTiles(): Tile[] {
  const tiles = [];
  let uid = 0;
  for (const suit of ["m", "p", "s"]) {
    for (let n = 1; n <= 9; n++) {
      if (suit === "m" && !CONFIG.manzuMiddle && n > 1 && n < 9) continue;
      for (let c = 0; c < 4; c++) {
        const red = CONFIG.redFives && n === 5 && c === 0;
        tiles.push({ uid: uid++, suit: suit, num: n, red: red });
      }
    }
  }
  for (let n = 1; n <= 7; n++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ uid: uid++, suit: "z", num: n, red: false });
    }
  }
  return tiles;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function sortKey(t: Tile): number {
  return SUIT_ORDER[t.suit] * 100 + t.num * 10 + (t.red ? 0 : 1);
}

function sortHand(hand: Tile[]): void {
  hand.sort(function (a, b) { return sortKey(a) - sortKey(b); });
}

/* ---- 和了判定・役判定（牌は 萬0-8 / 筒9-17 / 索18-26 / 字27-33 の番号で数える） ---- */
const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
const TERMINALS = [0, 8, 9, 17, 18, 26];
const GREEN = [19, 20, 21, 23, 25, 32];
const WIND_NAMES = { 27: "東", 28: "南", 29: "西", 30: "北" };
const DRAGON_NAMES = { 31: "白", 32: "發", 33: "中" };

const TILE_INDEX_BASE: Record<Suit, number> = { m: 0, p: 9, s: 18, z: 27 };
function tileIdx(t: Tile): number { return TILE_INDEX_BASE[t.suit] + t.num - 1; }

function toCounts(tiles: Tile[]): TileCounts {
  const c: TileCounts = new Array(34).fill(0);
  for (const t of tiles) c[tileIdx(t)]++;
  return c;
}

function decomposeRec(c: TileCounts, i: number, sets: MeldPart[], pair: number, res: HandDecomposition[]): void {
  while (i < 34 && c[i] === 0) i++;
  if (i === 34) { res.push({ pair: pair, sets: sets.slice() }); return; }
  if (c[i] >= 3) {
    c[i] -= 3; sets.push({ k: "t", i: i });
    decomposeRec(c, i, sets, pair, res);
    sets.pop(); c[i] += 3;
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ k: "s", i: i });
    decomposeRec(c, i, sets, pair, res);
    sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
  }
}

function decompose(c: TileCounts): HandDecomposition[] {
  const res: HandDecomposition[] = [];
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) { c[p] -= 2; decomposeRec(c, 0, [], p, res); c[p] += 2; }
  }
  return res;
}

function isKokushi(c: TileCounts): boolean {
  let n = 0, pair = false;
  for (const i of ORPHANS) {
    if (c[i] === 0) return false;
    n += c[i];
    if (c[i] === 2) pair = true;
  }
  return pair && n === 14;
}

function isChiitoi(c: TileCounts): boolean {
  let n = 0;
  for (let i = 0; i < 34; i++) {
    if (c[i] === 2) n++;
    else if (c[i] !== 0) return false;
  }
  return n === 7;
}

function isAgari(c: TileCounts): boolean { return isKokushi(c) || isChiitoi(c) || decompose(c).length > 0; }

function waitsOf(c13: TileCounts): number[] {
  const w: number[] = [];
  for (let i = 0; i < 34; i++) {
    if (c13[i] >= 4) continue;
    c13[i]++;
    if (isAgari(c13)) w.push(i);
    c13[i]--;
  }
  return w;
}

function scoreForm(
  c0: TileCounts,
  ctx: HandEvalContext,
  d: ScoringHandShape,
  wait: ScoringWaitKind
): ScoreFormResult {
  const c = c0.slice();
  for (const m of ctx.melds) {
    if (m.k === "s") { c[m.i]++; c[m.i + 1]++; c[m.i + 2]++; } else c[m.i] += m.kan ? 4 : 3;
  }
  const menzen = !ctx.melds.some(function (m) { return m.open; });
  const man: string[] = [], y: YakuEntry[] = [];
  let extra = 0;
  const dbl = function (n: string): void { man.push(n + "　ダブル役満"); extra++; };
  const add = function (n: string, h: number): void { y.push({ n: n, h: h }); };
  const used = function (f: (i: number) => boolean): boolean {
    for (let i = 0; i < 34; i++) if (c[i] > 0 && !f(i)) return false;
    return true;
  };
  /* 状況による役 */
  if (ctx.tenhou) man.push("天和");
  if (ctx.chiihou) man.push("地和");
  if (d === "kokushi") {
    if (c[ctx.winIdx] === 2) dbl("国士無双十三面待ち"); else man.push("国士無双");
    return { man: man, y: y, fu: 0, extra: extra };
  }
  if (ctx.doubleRiichi) add("ダブル立直", 2); else if (ctx.riichi) add("立直", 1);
  if (ctx.ippatsu) add("一発", 1);
  if (ctx.tsumo && menzen) add("門前清自摸和", 1);
  if (ctx.haitei) add("海底摸月", 1);
  if (ctx.houtei) add("河底撈魚", 1);
  if (ctx.chankan) add("槍槓", 1);
  if (ctx.rinshan) add("嶺上開花", 1);
  /* 牌の構成による役 */
  if (used(function (i) { return ORPHANS.indexOf(i) < 0; })) add("断幺九", 1);
  const suits = [0, 1, 2].filter(function (s) {
    for (let i = s * 9; i < s * 9 + 9; i++) if (c[i] > 0) return true;
    return false;
  });
  let honors = false;
  for (let i = 27; i < 34; i++) if (c[i] > 0) honors = true;
  if (suits.length === 1 && honors) add("混一色", menzen ? 3 : 2);
  if (suits.length === 1 && !honors) add("清一色", menzen ? 6 : 5);
  if (suits.length === 0) man.push("字一色");
  if (used(function (i) { return TERMINALS.indexOf(i) >= 0; })) man.push("清老頭");
  else if (used(function (i) { return ORPHANS.indexOf(i) >= 0; }) && suits.length > 0 && honors) add("混老頭", 2);
  if (used(function (i) { return GREEN.indexOf(i) >= 0; })) man.push("緑一色");
  if (suits.length === 1 && !honors && ctx.melds.length === 0) {
    const b = suits[0] * 9;
    let ok = c[b] >= 3 && c[b + 8] >= 3;
    for (let i = b + 1; i <= b + 7; i++) if (c[i] < 1) ok = false;
    if (ok) {
      const c2 = c.slice();
      c2[ctx.winIdx]--;
      let pure = c2[b] === 3 && c2[b + 8] === 3;
      for (let i = b + 1; i <= b + 7; i++) if (c2[i] !== 1) pure = false;
      if (pure) dbl("純正九蓮宝燈"); else man.push("九蓮宝燈");
    }
  }
  if (d === null) { add("七対子", 2); return { man: man, y: y, fu: 25 }; }
  /* 4面子1雀頭の形による役 */
  const sets: MeldPart[] = d.sets.map(function (s): MeldPart {
    return { k: s.k, i: s.i, open: s.k === "t" && !ctx.tsumo && wait === "shanpon" && s.i === ctx.winIdx };
  }).concat(ctx.melds);
  const openTri = sets.filter(function (s) { return s.open; }).length;
  const seqs = sets.filter(function (s) { return s.k === "s"; }).map(function (s) { return s.i; });
  const tris = sets.filter(function (s) { return s.k === "t"; }).map(function (s) { return s.i; });
  const has = function (arr: number[], v: number): boolean { return arr.indexOf(v) >= 0; };
  for (const t of tris) {
    if (t >= 31) add("役牌 " + DRAGON_NAMES[t], 1);
    if (t === ctx.seatWind) add("自風 " + WIND_NAMES[t], 1);
    if (t === ctx.roundWind) add("場風 " + WIND_NAMES[t], 1);
  }
  const pairIsYaku = d.pair >= 31 || d.pair === ctx.seatWind || d.pair === ctx.roundWind;
  const pinfu = menzen && tris.length === 0 && !pairIsYaku && wait === "ryanmen";
  if (pinfu) add("平和", 1);
  const counts: Record<number, number> = {};
  for (const a of seqs) counts[a] = (counts[a] || 0) + 1;
  let peikou = 0;
  for (const k in counts) peikou += Math.floor(counts[k] / 2);
  if (menzen && peikou >= 2) add("二盃口", 3); else if (menzen && peikou === 1) add("一盃口", 1);
  for (let n = 0; n < 7; n++) if (has(seqs, n) && has(seqs, 9 + n) && has(seqs, 18 + n)) { add("三色同順", menzen ? 2 : 1); break; }
  for (const b of [0, 9, 18]) if (has(seqs, b) && has(seqs, b + 3) && has(seqs, b + 6)) { add("一気通貫", menzen ? 2 : 1); break; }
  const groupOk = sets.map(function (s) {
    return s.k === "s" ? (s.i % 9 === 0 || s.i % 9 === 6) : ORPHANS.indexOf(s.i) >= 0;
  }).concat([ORPHANS.indexOf(d.pair) >= 0]);
  if (groupOk.every(Boolean) && seqs.length > 0) add(honors ? "混全帯幺九" : "純全帯幺九", (honors ? 2 : 3) - (menzen ? 0 : 1));
  if (tris.length === 4) add("対々和", 2);
  const conc = tris.length - openTri;
  if (conc === 4) { if (wait === "tanki") dbl("四暗刻単騎"); else man.push("四暗刻"); } else if (conc === 3) add("三暗刻", 2);
  const kanN = sets.filter(function (s) { return s.kan; }).length;
  if (kanN === 4) man.push("四槓子"); else if (kanN === 3) add("三槓子", 2);
  for (let n = 0; n < 9; n++) if (has(tris, n) && has(tris, 9 + n) && has(tris, 18 + n)) { add("三色同刻", 2); break; }
  const dragons = tris.filter(function (i) { return i >= 31; }).length;
  if (dragons === 3) man.push("大三元"); else if (dragons === 2 && d.pair >= 31) add("小三元", 2);
  const winds = tris.filter(function (i) { return i >= 27 && i <= 30; }).length;
  if (winds === 4) dbl("大四喜"); else if (winds === 3 && d.pair >= 27 && d.pair <= 30) man.push("小四喜");
  return { man: man, y: y, fu: pinfu ? (ctx.tsumo ? 20 : 30) : calcFu(sets, d.pair, ctx, wait), extra: extra };
}

function calcFu(sets: MeldPart[], pair: number, ctx: HandEvalContext, wait: ScoringWaitKind): number {
  const menzen = !ctx.melds.some(function (m) { return m.open; });
  let fu = 20 + (ctx.tsumo ? 2 : (menzen ? 10 : 0));
  for (const s of sets) {
    if (s.k !== "t") continue;
    let f = ORPHANS.indexOf(s.i) >= 0 ? 8 : 4;
    if (s.kan) f *= 4;
    if (s.open) f /= 2;
    fu += f;
  }
  if (pair >= 31) fu += 2;
  if (pair === ctx.seatWind) fu += 2;
  if (pair === ctx.roundWind) fu += 2;
  if (wait === "kanchan" || wait === "penchan" || wait === "tanki") fu += 2;
  fu = Math.ceil(fu / 10) * 10;
  if (!menzen && fu === 20) fu = 30;
  return fu;
}

function ceil100(x: number): number { return Math.ceil(x / 100) * 100; }

function calcPoints(han: number, fu: number, man: number): PointsResult {
  let basic, name = "";
  if (man > 0) { basic = 8000 * man; name = man === 1 ? "役満" : (man === 2 ? "ダブル役満" : (man === 3 ? "トリプル役満" : man + "倍役満")); }
  else if (han >= 13) { basic = 8000; name = "数え役満"; }
  else if (han >= 11) { basic = 6000; name = "三倍満"; }
  else if (han >= 8) { basic = 4000; name = "倍満"; }
  else if (han >= 6) { basic = 3000; name = "跳満"; }
  else {
    basic = fu * Math.pow(2, han + 2);
    if (basic >= 2000) { basic = 2000; name = "満貫"; }
  }
  const each = ceil100(basic * 2);
  return { basic: basic, name: name, each: each, total: each * 3 };
}

function waitTypes(d: HandDecomposition, w: number): WaitKind[] {
  const types: WaitKind[] = [];
  const push = function (t: WaitKind): void { if (types.indexOf(t) < 0) types.push(t); };
  if (d.pair === w) push("tanki");
  for (const s of d.sets) {
    if (s.k === "t") { if (s.i === w) push("shanpon"); continue; }
    const a = s.i;
    if (w === a + 1) push("kanchan");
    else if (w === a) push(a % 9 === 6 ? "penchan" : "ryanmen");
    else if (w === a + 2) push(a % 9 === 0 ? "penchan" : "ryanmen");
  }
  return types;
}

function evaluateHand(c: TileCounts, ctx: HandEvalContext): WinResult | null {
  const forms: ScoreFormResult[] = [];
  if (isKokushi(c)) forms.push(scoreForm(c, ctx, "kokushi", "none"));
  if (isChiitoi(c)) forms.push(scoreForm(c, ctx, null, "tanki"));
  for (const d of decompose(c)) {
    for (const wt of waitTypes(d, ctx.winIdx)) forms.push(scoreForm(c, ctx, d, wt));
  }
  let best: ScoreFormResult | null = null;
  for (const f of forms) {
    if (f.y.length === 0 && f.man.length === 0) continue;
    const yakuHan = f.y.reduce(function (s, v) { return s + v.h; }, 0);
    const doraHan = f.man.length ? 0 : ctx.dora.dora + ctx.dora.ura + ctx.dora.aka;
    f.han = yakuHan + doraHan;
    f.pts = calcPoints(f.han, f.fu, f.man.length + (f.extra || 0));
    if (!best || f.pts.basic > best.pts.basic || (f.pts.basic === best.pts.basic && f.han > best.han)) best = f;
  }
  if (best) best.dora = ctx.dora;
  return best;
}

/* ---- ゲーム進行 ---- */
function newGame(): void {
  if (!match) match = freshMatch();
  const all = shuffle(buildTiles());
  const deadWall = all.splice(all.length - CONFIG.deadWallSize, CONFIG.deadWallSize);
  state = {
    wall: all,
    deadWall: deadWall,
    doraIndicator: deadWall[4],
    hands: [],
    rivers: [],
    drawn: null,
    selected: null,
    finished: false,
    riichi: false,
    riichiPending: false,
    doubleRiichi: false,
    ippatsu: false,
    win: null,
    melds: [],
    rinIdx: 0,
    doraCount: 1,
    rinshan: false,
    round: ["東", "南", "西"][match.wind] + (match.kyoku + 1) + "局",
    wind: match.wind,
    kyoku: match.kyoku,
    honba: match.honba,
    roundWind: 27 + match.wind,
    outcome: null,
    matchOver: false,
    dealer: match.dealer,
    turn: match.dealer,
    scores: match.scores.slice(),
    pl: [null, newPlayerState(), newPlayerState(), newPlayerState()],
    safe: [new Set(), new Set(), new Set(), new Set()],
    sticks: match.sticks,
    token: ++TOKEN_SEQ,
    cpuDrawn: null,
    ronPending: null,
    draw: null,
    tmpFuriten: false,
    rFuriten: false,
    deadExtra: [],
    callPending: null,
    callDiscard: -1,
    forbid: [],
    doraPending: 0,
    ronKind: "discard",
    kakan: null
  };
  for (let s = 0; s < CONFIG.seats; s++) {
    state.hands.push([]);
    state.rivers.push([]);
  }
  for (let i = 0; i < CONFIG.handSize; i++) {
    for (let s = 0; s < CONFIG.seats; s++) {
      state.hands[s].push(state.wall.pop());
    }
  }
  for (let s = 0; s < CONFIG.seats; s++) sortHand(state.hands[s]);
  if (state.dealer === 0) {
    drawTile();
    render();
  } else {
    render();
    cpuTurn(state.dealer);
  }
}

function drawTile(): void {
  if (state.wall.length === 0) {
    exhaustiveDraw();
    return;
  }
  state.drawn = state.wall.pop();
  state.turn = 0;
}

/* ---- 手番進行・和了・カン・リーチ（自家とCPUで共通のルール判定） ---- */
const SEAT_NAMES = ["自家", "下家", "対面", "上家"];
const CPU_DELAY = 450;
let TOKEN_SEQ = 0;

function newPlayerState(): PlayerState {
  return { riichi: false, doubleRiichi: false, ippatsu: false, melds: [], rinshan: false, tmpFuriten: false, rFuriten: false };
}
function P(s: number): PlayerFlags { return s === 0 ? state : state.pl[s]; }
function drawnOf(s: number): Tile | null { return s === 0 ? state.drawn : state.cpuDrawn; }
function schedule(fn: () => void, ms: number): void { setTimeout(fn, ms); }
function kanCount(s: number): number { return P(s).melds.filter(function (m) { return m.kan; }).length; }
function totalKans(): number {
  let n = 0;
  for (let s = 0; s < 4; s++) n += kanCount(s);
  return n;
}
function hasOpenMeld(s: number): boolean { return P(s).melds.some(function (m) { return m.open; }); }
function noMelds(): boolean {
  for (let s = 0; s < 4; s++) if (P(s).melds.length > 0) return false;
  return true;
}
function poolOf(s: number): Tile[] {
  const d = drawnOf(s);
  return d ? state.hands[s].concat([d]) : state.hands[s].slice();
}

function doraTarget(i: number): number {
  if (i < 27) return Math.floor(i / 9) * 9 + (i % 9 + 1) % 9;
  if (i < 31) return 27 + (i - 27 + 1) % 4;
  return 31 + (i - 31 + 1) % 3;
}

function countDora(seat, winTile) {
  const p = P(seat);
  const tiles = state.hands[seat].concat(winTile ? [winTile] : []);
  for (const m of p.melds) for (const t of m.tiles) tiles.push(t);
  const c = toCounts(tiles);
  let dora = 0, ura = 0, aka = 0;
  for (let n = 0; n < state.doraCount; n++) {
    dora += c[doraTarget(tileIdx(state.deadWall[4 + 2 * n]))];
    if (p.riichi) ura += c[doraTarget(tileIdx(state.deadWall[5 + 2 * n]))];
  }
  for (const t of tiles) if (t.red) aka++;
  return { dora: dora, ura: ura, aka: aka };
}

function doraHTML() {
  let h = "";
  for (let n = 0; n < 5; n++) {
    h += n < state.doraCount ? tileHTML(state.deadWall[4 + 2 * n]) : '<div class="tile back"></div>';
  }
  return h;
}

/* 副露の表示。鳴いた牌は横向き：上家から＝左端、対面から＝中央、下家から＝右端 */
function rotatedHTML(t: Tile): string {
  const face = tileHTML(t).replace(' data-t="' + t.uid + '"', "");
  return '<div class="rotbox" data-t="' + t.uid + '">' + face + "</div>";
}

function meldHTML(m) {
  if (m.type === "ankan") return '<div class="tile back"></div>' + tileHTML(m.tiles[0]) + tileHTML(m.tiles[1]) + '<div class="tile back"></div>';
  const called = m.rel === undefined ? null : m.tiles.find(function (t) { return t.called; });
  if (!called) return m.tiles.map(function (t) { return tileHTML(t); }).join("");
  const added = m.type === "kakan" ? m.tiles[m.tiles.length - 1] : null;
  const others = m.tiles.filter(function (t) { return t !== called && t !== added; });
  if (m.type === "chi") others.sort(function (a, b) { return tileIdx(a) - tileIdx(b); });
  const slot = added
    ? '<div class="rotstack">' + rotatedHTML(added) + rotatedHTML(called) + "</div>"
    : rotatedHTML(called);
  const parts = others.map(function (t) { return tileHTML(t); });
  parts.splice(m.rel === 3 ? 0 : (m.rel === 2 ? 1 : others.length), 0, slot);
  return parts.join("");
}

/* ---- 和了判定（ツモ・ロン共通） ---- */
function winCtx(seat, tsumo, winTile) {
  const p = P(seat);
  const noKan = noMelds();
  return {
    tsumo: tsumo,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    haitei: tsumo && state.wall.length === 0 && !p.rinshan,
    houtei: !tsumo && state.wall.length === 0 && state.ronKind !== "kakan",
    chankan: !tsumo && state.ronKind === "kakan",
    rinshan: tsumo && p.rinshan,
    tenhou: tsumo && noKan && seat === state.dealer && state.rivers[seat].length === 0,
    chiihou: tsumo && noKan && seat !== state.dealer && state.rivers[seat].length === 0,
    melds: p.melds.map(function (m) { return { k: m.k, i: m.i, kan: m.kan, open: m.open }; }),
    dora: countDora(seat, winTile),
    seatWind: 27 + (seat - state.dealer + 4) % 4,
    roundWind: state.roundWind,
    winIdx: tileIdx(winTile)
  };
}

function winCheck(seat: number, winTile: Tile, tsumo: boolean): WinResult | null {
  const c = toCounts(state.hands[seat].concat([winTile]));
  if (!isAgari(c)) return null;
  return evaluateHand(c, winCtx(seat, tsumo, winTile));
}

function isFuriten(seat: number): boolean {
  const p = P(seat);
  if (p.tmpFuriten || p.rFuriten) return true;
  const waits = waitsOf(toCounts(state.hands[seat]));
  return state.rivers[seat].some(function (t) { return waits.indexOf(tileIdx(t)) >= 0; });
}

function ronInfo(seat: number, tile: Tile): WinResult | null {
  const w = winCheck(seat, tile, false);
  return w && !isFuriten(seat) ? w : null;
}

function winInfo(): WinResult | null {
  if (!state.drawn || state.finished) return null;
  return winCheck(0, state.drawn, true);
}

function riichiAllowed(): Set<number> {
  const set = new Set<number>();
  if (!state.drawn || state.riichi || state.finished || hasOpenMeld(0)) return set;
  const all = state.hands[0].concat([state.drawn]);
  for (const t of all) {
    const rest = all.filter(function (x) { return x.uid !== t.uid; });
    if (waitsOf(toCounts(rest)).length > 0) set.add(t.uid);
  }
  return set;
}

/* ---- カン（暗槓のみ） ---- */
function kanOptionsFor(s: number, drawn: Tile | null): number[] {
  const res = [];
  const p = P(s);
  if (state.finished || !drawn || state.wall.length === 0 || totalKans() >= 4) return res;
  const pool = state.hands[s].concat([drawn]);
  const c = toCounts(pool);
  for (let i = 0; i < 34; i++) {
    if (c[i] !== 4) continue;
    if (p.riichi) {
      if (tileIdx(drawn) !== i) continue;
      const before = waitsOf(toCounts(state.hands[s])).join(",");
      const rest = pool.filter(function (t) { return tileIdx(t) !== i; });
      if (before === "" || before !== waitsOf(toCounts(rest)).join(",")) continue;
    }
    res.push(i);
  }
  return res;
}

function kanOptions(): number[] {
  if (state.riichiPending) return [];
  return kanOptionsFor(0, state.drawn).concat(kakanOptionsFor(0));
}

function kakanOptionsFor(s: number): number[] {
  const p = P(s), res = [];
  if (state.finished || state.wall.length === 0 || totalKans() >= 4 || p.riichi) return res;
  if (state.turn !== s || !drawnOf(s)) return res;
  const pool = poolOf(s);
  for (const m of p.melds) {
    if (m.type === "pon" && pool.some(function (t) { return tileIdx(t) === m.i; })) res.push(m.i);
  }
  return res;
}

function performKan(s: number, idx: number): void {
  const p = P(s);
  const pool = poolOf(s);
  const tiles = pool.filter(function (t) { return tileIdx(t) === idx; });
  p.melds.push({ type: "ankan", k: "t", i: idx, kan: true, open: false, tiles: tiles, from: -1 });
  state.hands[s] = pool.filter(function (t) { return tileIdx(t) !== idx; });
  sortHand(state.hands[s]);
  state.deadExtra.push(state.wall.pop());
  state.doraCount++;
  const r = state.deadWall[state.rinIdx++];
  if (s === 0) state.drawn = r; else state.cpuDrawn = r;
  p.rinshan = true;
  for (let q = 0; q < 4; q++) P(q).ippatsu = false;
}

/* 加槓：槍槓の確認 → 成立すればカン */
function startKakan(s: number, idx: number): void {
  const pool = poolOf(s);
  const m = pool.filter(function (t) { return tileIdx(t) === idx; });
  m.sort(function (a, b) { return (a.red ? 1 : 0) - (b.red ? 1 : 0); });
  const tile = m[0];
  state.hands[s] = pool.filter(function (t) { return t.uid !== tile.uid; });
  sortHand(state.hands[s]);
  if (s === 0) state.drawn = null; else state.cpuDrawn = null;
  state.kakan = { s: s, idx: idx, tile: tile };
  state.selected = null;
  state.token = ++TOKEN_SEQ;
  resolveRon(s, tile, 1, "kakan");
}

function completeKakan(): void {
  const k = state.kakan;
  state.kakan = null;
  const s = k.s, p = P(s);
  const m = p.melds.find(function (x) { return x.type === "pon" && x.i === k.idx; });
  m.type = "kakan";
  m.kan = true;
  m.tiles.push(k.tile);
  state.deadExtra.push(state.wall.pop());
  state.doraPending++;
  const r = state.deadWall[state.rinIdx++];
  if (s === 0) state.drawn = r; else state.cpuDrawn = r;
  p.rinshan = true;
  for (let q = 0; q < 4; q++) P(q).ippatsu = false;
  state.turn = s;
  const t = (state.token = ++TOKEN_SEQ);
  render();
  if (s !== 0) schedule(function () { cpuAct(s, t); }, thinkTime(s));
}

function doKan(): void {
  if (kanOptions().length === 0) return;
  const di = state.drawn ? tileIdx(state.drawn) : -1;
  const ank = kanOptionsFor(0, state.drawn);
  if (ank.length > 0) {
    performKan(0, ank.indexOf(di) >= 0 ? di : ank[0]);
    state.selected = null;
    render();
    return;
  }
  const kak = kakanOptionsFor(0);
  startKakan(0, kak.indexOf(di) >= 0 ? di : kak[0]);
}

/* ---- 和了・流局の確定 ---- */
function recordSafe(s: number, tile: Tile): void {
  const i = tileIdx(tile);
  state.safe[s].add(i);
  for (let r = 0; r < 4; r++) if (r !== s && P(r).riichi) state.safe[r].add(i);
}

function settleWin(seat: number, from: number, w: WinResult, winTile: Tile): void {
  const basic = w.pts.basic;
  const dealer = state.dealer;
  const delta = [0, 0, 0, 0];
  if (from < 0) {
    for (let s = 0; s < 4; s++) {
      if (s === seat) continue;
      const pay = ceil100(basic * (seat === dealer || s === dealer ? 2 : 1)) + 100 * state.honba;
      delta[s] -= pay;
      delta[seat] += pay;
    }
  } else {
    const pay = ceil100(basic * (seat === dealer ? 6 : 4)) + 300 * state.honba;
    delta[from] -= pay;
    delta[seat] += pay;
  }
  delta[seat] += state.sticks * 1000;
  state.sticks = 0;
  for (let s = 0; s < 4; s++) state.scores[s] += delta[s];
  w.seat = seat;
  w.from = from;
  w.delta = delta;
  w.winTile = winTile;
  state.win = w;
  state.finished = true;
  state.selected = null;
  state.ronPending = null;
  state.token = ++TOKEN_SEQ;
  planOutcome(seat === dealer);
}

function exhaustiveDraw(): void {
  const tenpai = [];
  for (let s = 0; s < 4; s++) tenpai.push(waitsOf(toCounts(state.hands[s])).length > 0);
  const n = tenpai.filter(Boolean).length;
  const delta = [0, 0, 0, 0];
  if (n > 0 && n < 4) {
    for (let s = 0; s < 4; s++) delta[s] = tenpai[s] ? 3000 / n : -3000 / (4 - n);
  }
  for (let s = 0; s < 4; s++) state.scores[s] += delta[s];
  state.draw = { tenpai: tenpai, delta: delta };
  state.finished = true;
  state.drawn = null;
  state.cpuDrawn = null;
  state.selected = null;
  state.token = ++TOKEN_SEQ;
  planOutcome(tenpai[state.dealer]);
}

function declareWin(): void {
  const w = winInfo();
  if (!w) return;
  settleWin(0, -1, w, state.drawn);
  render();
}

function toggleRiichi(): void {
  if (state.finished || state.riichi) return;
  state.riichiPending = !state.riichiPending;
  state.selected = null;
  render();
}

function doRon(): void {
  const p = state.ronPending;
  if (!p) return;
  settleWin(0, p.s, p.w, p.tile);
  render();
}

function doPass(): void {
  const p = state.ronPending;
  if (!p) { doPassCall(); return; }
  state.ronPending = null;
  state.tmpFuriten = true;
  if (state.riichi) state.rFuriten = true;
  resolveRon(p.s, p.tile, p.k + 1, p.kind);
}

function doCall(i: number): void {
  const p = state.callPending;
  if (!p) return;
  performCall(0, p.s, p.tile, p.opts[i]);
}

function doPassCall(): void {
  const p = state.callPending;
  if (!p) return;
  state.callPending = null;
  resolveCalls(p.s, p.tile, p.stage + 1);
}

/* ---- 結果表示 ---- */
function tilesRowHTML(tiles) {
  return tiles.map(function (t) { return tileHTML(t); }).join("");
}

function revealHTML(seat, winTile) {
  let h = tilesRowHTML(state.hands[seat]);
  if (winTile) h += '<span class="gap2"></span>' + tileHTML(winTile);
  for (const m of P(seat).melds) h += '<span class="gap2"></span>' + meldHTML(m);
  return '<span class="ura">' + h + "</span>";
}

function payText(w) {
  const basic = w.pts.basic;
  if (w.from >= 0) return ceil100(basic * (w.seat === state.dealer ? 6 : 4)) + 300 * state.honba + "点（" + SEAT_NAMES[w.from] + "の放銃）";
  const pc = ceil100(basic) + 100 * state.honba, pd = ceil100(basic * 2) + 100 * state.honba;
  return w.seat === state.dealer ? pd + "点オール" : pc + "・" + pd + "点";
}

function resultHTML(w) {
  let h = '<div class="win">' + SEAT_NAMES[w.seat] + "の" + (w.from < 0 ? "ツモ和了" : "ロン和了") + "</div>";
  if (w.man.length > 0) {
    h += w.man.map(function (n) { return "<div>" + (n.indexOf("ダブル") >= 0 ? n : n + "　役満") + "</div>"; }).join("");
    h += '<div class="total">' + w.pts.name + "　" + payText(w) + "</div>";
  } else {
    h += w.y.map(function (v) { return "<div>" + v.n + "　" + v.h + "翻</div>"; }).join("");
    if (w.dora.dora > 0) h += "<div>ドラ　" + w.dora.dora + "翻</div>";
    if (w.dora.ura > 0) h += "<div>裏ドラ　" + w.dora.ura + "翻</div>";
    if (w.dora.aka > 0) h += "<div>赤ドラ　" + w.dora.aka + "翻</div>";
    h += '<div class="total">' + w.han + "翻 " + w.fu + "符　" + (w.pts.name ? w.pts.name + "　" : "") + payText(w) + "</div>";
  }
  if (P(w.seat).riichi) {
    let ura = "";
    for (let n = 0; n < state.doraCount; n++) ura += tileHTML(state.deadWall[5 + 2 * n]);
    h += '<div class="sub">裏ドラ表示牌：<span class="ura">' + ura + "</span></div>";
  }
  h += '<div class="sub">和了者の手牌：' + revealHTML(w.seat, w.winTile) + "</div>";
  h += '<div class="sub">持ち点の変動：' + SEAT_NAMES.map(function (n, i) {
    return n + " " + (w.delta[i] >= 0 ? "+" : "") + w.delta[i];
  }).join("　") + "</div>";
  return h;
}

function drawHTML() {
  const d = state.draw;
  let h = '<div class="win">流局</div>';
  for (let s = 0; s < 4; s++) {
    h += "<div>" + SEAT_NAMES[s] + "　" + (d.tenpai[s] ? "聴牌" : "ノーテン") +
      (d.delta[s] ? "（" + (d.delta[s] > 0 ? "+" : "") + d.delta[s] + "）" : "") + "</div>";
    if (d.tenpai[s]) h += '<div class="sub">' + revealHTML(s, null) + "</div>";
  }
  return h;
}

function updateActions() {
  document.getElementById("next").hidden = !(state.finished && !state.matchOver);
  const mine = state.turn === 0 && !state.finished && !state.ronPending && !state.callPending;
  const win = mine ? winInfo() : null;
  const allowed = mine ? riichiAllowed() : new Set();
  const rb = document.getElementById("riichi");
  rb.hidden = !mine || state.riichi || (!state.riichiPending && allowed.size === 0);
  rb.textContent = state.riichiPending ? "リーチをやめる" : "リーチ";
  document.getElementById("kan").hidden = !mine || kanOptions().length === 0;
  document.getElementById("tsumo").hidden = !win;
  document.getElementById("ron").hidden = !state.ronPending;
  document.getElementById("pass").hidden = !(state.ronPending || state.callPending);
  let calls = "";
  if (state.callPending) {
    state.callPending.opts.forEach(function (o, i) {
      const label = o.type === "pon" ? "ポン" : (o.type === "minkan" ? "カン" : "チー（" + o.use.map(tileName).join("・") + "）");
      calls += '<button class="action" type="button" data-call="' + i + '">' + label + "</button>";
    });
  }
  document.getElementById("calls").innerHTML = calls;
  document.querySelectorAll("#hand0 button").forEach(function (b) {
    const uid = Number(b.getAttribute("data-uid"));
    let dim = false;
    if (state.riichiPending) dim = !allowed.has(uid);
    else if (state.riichi && state.drawn) dim = uid !== state.drawn.uid;
    else if (state.callDiscard === 0) {
      const t = state.hands[0].find(function (x) { return x.uid === uid; });
      dim = !!t && state.forbid.indexOf(tileIdx(t)) >= 0;
    }
    b.classList.toggle("dim", dim);
  });
  const msg = document.getElementById("msg");
  const res = document.getElementById("result");
  if (state.win) {
    res.innerHTML = resultHTML(state.win) + (state.matchOver ? finalHTML() : "");
    msg.textContent = state.matchOver ? "対局が終了しました。「配牌し直す」で新しい対局を始められます。" : "和了しました。「次の局へ」を押してください。";
    return;
  }
  if (state.draw) {
    res.innerHTML = drawHTML() + (state.matchOver ? finalHTML() : "");
    msg.textContent = state.matchOver ? "対局が終了しました。「配牌し直す」で新しい対局を始められます。" : "流局です。「次の局へ」を押してください。";
    return;
  }
  res.innerHTML = "";
  if (state.finished) return;
  if (state.ronPending) msg.textContent = "ロンできます。「ロン」か「見送り」を選んでください。";
  else if (state.callPending) msg.textContent = "鳴けます。選ぶか「見送り」を押してください。";
  else if (state.turn !== 0) msg.textContent = SEAT_NAMES[state.turn] + "の手番です。";
  else if (state.callDiscard === 0) msg.textContent = "鳴きました。捨てる牌を選んでください（薄い牌は喰い替えのため捨てられません）。";
  else if (state.riichiPending) msg.textContent = "リーチ：捨てる牌を選んでください（聴牌を保てる牌だけ選べます）。";
  else if (state.riichi) msg.textContent = "リーチ中です。和了できなければ、ツモ牌をそのまま打牌します。";
  else if (win) msg.textContent = "和了できます。「ツモ」を押してください。";
}

/* ---- 自家の打牌 ---- */
function discard(uid: number): void {
  const holding = state.drawn;
  if (state.finished || state.turn !== 0 || (!holding && state.callDiscard !== 0)) return;
  if (state.riichi && holding && uid !== holding.uid) return;
  const allowed = riichiAllowed();
  if (state.riichiPending && !allowed.has(uid)) return;
  const hand = state.hands[0];
  let tile;
  if (holding && holding.uid === uid) {
    tile = holding;
  } else {
    const i = hand.findIndex(function (t) { return t.uid === uid; });
    if (i < 0) return;
    if (!holding && state.forbid.indexOf(tileIdx(hand[i])) >= 0) return;
    tile = hand.splice(i, 1)[0];
    if (holding) {
      hand.push(holding);
      sortHand(hand);
    }
  }
  if (state.riichiPending) {
    state.riichi = true;
    state.riichiPending = false;
    state.doubleRiichi = state.rivers[0].length === 0 && noMelds();
    state.ippatsu = true;
    state.scores[0] -= 1000;
    state.sticks++;
  } else if (state.riichi) {
    state.ippatsu = false;
  }
  state.drawn = null;
  state.callDiscard = -1;
  state.forbid = [];
  state.rinshan = false;
  state.tmpFuriten = false;
  state.selected = null;
  state.rivers[0].push(tile);
  recordSafe(0, tile);
  render();
  afterDiscard(0, tile);
}

function onTileClick(uid: number): void {
  if (state.finished || state.turn !== 0) return;
  if (!state.drawn && state.callDiscard !== 0) return;
  if (state.riichi && state.drawn && uid !== state.drawn.uid) return;
  if (state.riichiPending && !riichiAllowed().has(uid)) return;
  if (!state.drawn) {
    const t = state.hands[0].find(function (x) { return x.uid === uid; });
    if (!t || state.forbid.indexOf(tileIdx(t)) >= 0) return;
  }
  if (state.selected === uid) {
    discard(uid);
  } else {
    state.selected = uid;
    render();
  }
}

/* ---- 手番の進行：打牌 → ロン判定 → 次の席のツモ ---- */
function afterDiscard(s: number, tile: Tile): void {
  state.lastDiscard = { seat: s, tile: tile };
  state.doraCount += state.doraPending;
  state.doraPending = 0;
  state.token = ++TOKEN_SEQ;
  resolveRon(s, tile, 1, "discard");
}

function resolveRon(s: number, tile: Tile, k: number, kind: RonKind): void {
  if (state.finished) return;
  state.ronKind = kind;
  if (k > 3) {
    if (kind === "kakan") completeKakan(); else resolveCalls(s, tile, 0);
    return;
  }
  const r = (s + k) % 4;
  const w = ronInfo(r, tile);
  if (!w) { resolveRon(s, tile, k + 1, kind); return; }
  if (r === 0) {
    state.ronPending = { s: s, tile: tile, k: k, w: w, kind: kind };
    render();
    return;
  }
  settleWin(r, s, w, tile);
  render();
}

/* ---- 鳴き（ポン・大明槓・チー） ---- */
function callOptions(r: number, s: number, tile: Tile): CallOption[] {
  const opts = [];
  if (P(r).riichi || state.wall.length === 0) return opts;
  const i = tileIdx(tile);
  const hand = state.hands[r];
  const same = hand.filter(function (t) { return tileIdx(t) === i; });
  if (same.length >= 2) opts.push({ type: "pon", use: same.slice(0, 2) });
  if (same.length >= 3 && totalKans() < 4) opts.push({ type: "minkan", use: same.slice(0, 3) });
  if (r === (s + 1) % 4 && i < 27) {
    const n = i % 9;
    [[-2, -1], [-1, 1], [1, 2]].forEach(function (d) {
      if (n + d[0] < 0 || n + d[1] > 8) return;
      const a = hand.find(function (t) { return tileIdx(t) === i + d[0]; });
      const b = hand.find(function (t) { return tileIdx(t) === i + d[1]; });
      if (a && b) opts.push({ type: "chi", use: [a, b] });
    });
  }
  return opts;
}

/* 喰い替え禁止：鳴いた牌と同じ牌、チーなら筋の反対側の牌は、その手番では捨てられない */
function forbiddenAfter(opt: CallOption, tile: Tile): number[] {
  const i = tileIdx(tile);
  const f = [i];
  if (opt.type === "chi") {
    const a = tileIdx(opt.use[0]), b = tileIdx(opt.use[1]);
    if (i < a && i % 9 + 3 <= 8) f.push(i + 3);
    else if (i > b && i % 9 - 3 >= 0) f.push(i - 3);
  }
  return f;
}

function performCall(r: number, s: number, tile: Tile, opt: CallOption): void {
  tile.called = true;
  const used = opt.use.map(function (t) { return t.uid; });
  state.hands[r] = state.hands[r].filter(function (t) { return used.indexOf(t.uid) < 0; });
  const tiles = [tile].concat(opt.use);
  let m;
  if (opt.type === "chi") {
    tiles.sort(function (a, b) { return tileIdx(a) - tileIdx(b); });
    m = { type: "chi", k: "s", i: tileIdx(tiles[0]), kan: false, open: true, tiles: tiles, from: s, rel: (s - r + 4) % 4 };
  } else {
    m = { type: opt.type, k: "t", i: tileIdx(tile), kan: opt.type === "minkan", open: true, tiles: tiles, from: s, rel: (s - r + 4) % 4 };
  }
  const p = P(r);
  p.melds.push(m);
  for (let q = 0; q < 4; q++) P(q).ippatsu = false;
  state.callPending = null;
  state.turn = r;
  const t = (state.token = ++TOKEN_SEQ);
  if (opt.type === "minkan") {
    state.deadExtra.push(state.wall.pop());
    state.doraPending++;
    const rin = state.deadWall[state.rinIdx++];
    if (r === 0) state.drawn = rin; else state.cpuDrawn = rin;
    p.rinshan = true;
    state.callDiscard = -1;
    state.forbid = [];
  } else {
    state.callDiscard = r;
    state.forbid = forbiddenAfter(opt, tile);
  }
  render();
  if (r !== 0) schedule(function () { cpuAct(r, t); }, thinkTime(r));
}

/* stage 0：ポン・大明槓（どの席でも）、stage 1：チー（下家のみ）。ロンは先に処理済み */
function resolveCalls(s: number, tile: Tile, stage: number): void {
  if (state.finished) return;
  if (stage > 1) { nextTurn(s); return; }
  for (let k = 1; k <= 3; k++) {
    if (stage === 1 && k !== 1) continue;
    const r = (s + k) % 4;
    const opts = callOptions(r, s, tile).filter(function (o) { return stage === 0 ? o.type !== "chi" : o.type === "chi"; });
    if (opts.length === 0) continue;
    if (r === 0) {
      state.callPending = { s: s, tile: tile, stage: stage, opts: opts };
      render();
      return;
    }
    const choice = cpuCall(cpuView(r), tileIdx(tile), opts);
    if (choice) { performCall(r, s, tile, choice); return; }
  }
  resolveCalls(s, tile, stage + 1);
}

function nextTurn(s: number): void {
  if (state.finished) return;
  const n = (s + 1) % 4;
  state.turn = n;
  if (n === 0) {
    drawTile();
    render();
  } else {
    cpuTurn(n);
  }
}

function thinkTime(s: number): number {
  let ms = CPU_DELAY + Math.floor(Math.random() * 250);
  for (let r = 0; r < 4; r++) {
    if (r !== s && P(r).riichi) { ms += 250; break; }
  }
  return ms;
}

function cpuTurn(n: number): void {
  if (state.finished) return;
  if (state.wall.length === 0) {
    exhaustiveDraw();
    render();
    return;
  }
  state.cpuDrawn = state.wall.pop();
  state.turn = n;
  const t = (state.token = ++TOKEN_SEQ);
  render();
  schedule(function () { cpuAct(n, t); }, thinkTime(n));
}

function chooseTile(s: number, idx: number): Tile | undefined {
  const m = poolOf(s).filter(function (t) { return tileIdx(t) === idx; });
  m.sort(function (a, b) { return (a.red ? 1 : 0) - (b.red ? 1 : 0); });
  return m[0];
}

function cpuDiscard(s: number, act: CpuAction): void {
  const p = P(s);
  const drawn = state.cpuDrawn;
  const forbid = state.callDiscard === s ? state.forbid : [];
  const pool = poolOf(s);
  let idx = act.idx;
  if (p.riichi || !chooseTile(s, idx) || forbid.indexOf(idx) >= 0) {
    if (drawn && forbid.indexOf(tileIdx(drawn)) < 0) idx = tileIdx(drawn);
    else {
      const ok = pool.filter(function (t) { return forbid.indexOf(tileIdx(t)) < 0; });
      idx = tileIdx((ok.length ? ok : pool)[0]);
    }
  }
  const tile = p.riichi && drawn ? drawn : chooseTile(s, idx);
  const rest = pool.filter(function (t) { return t.uid !== tile.uid; });
  let declare = act.riichi && !p.riichi && !hasOpenMeld(s) && !!drawn && state.scores[s] >= 1000 && state.wall.length >= 4;
  if (declare && waitsOf(toCounts(rest)).length === 0) declare = false;
  state.hands[s] = rest;
  sortHand(state.hands[s]);
  state.cpuDrawn = null;
  state.callDiscard = -1;
  state.forbid = [];
  if (declare) {
    p.riichi = true;
    p.doubleRiichi = state.rivers[s].length === 0 && noMelds();
    p.ippatsu = true;
    state.scores[s] -= 1000;
    state.sticks++;
  } else if (p.riichi) {
    p.ippatsu = false;
  }
  p.rinshan = false;
  p.tmpFuriten = false;
  state.rivers[s].push(tile);
  recordSafe(s, tile);
  render();
  afterDiscard(s, tile);
}

function cpuAct(s: number, token: number): void {
  const afterCall = state.callDiscard === s;
  if (token !== state.token || state.finished || state.turn !== s || (!state.cpuDrawn && !afterCall)) return;
  if (state.cpuDrawn) {
    const win = winCheck(s, state.cpuDrawn, true);
    if (win) {
      settleWin(s, -1, win, state.cpuDrawn);
      render();
      return;
    }
  }
  const act = cpuDecide(cpuView(s));
  if (act.kind === "kan" && state.cpuDrawn && kanOptionsFor(s, state.cpuDrawn).indexOf(act.idx) >= 0) {
    performKan(s, act.idx);
    const t = (state.token = ++TOKEN_SEQ);
    render();
    schedule(function () { cpuAct(s, t); }, thinkTime(s));
    return;
  }
  cpuDiscard(s, act);
}

/* ---- TypeScript移行 第5段階：CPUの判断データの型 ---- */
interface CpuMyMeldView {
  k: MeldShape;
  i: number;
  kan: boolean;
  open: boolean;
  idxs: number[];
}

interface CpuView {
  seat: number;
  dealer: number;
  hand: Tile[];
  drawnIdx: number;
  myMelds: CpuMyMeldView[];
  ctxMelds: MeldPart[];
  open: boolean;
  melds: number[][][];
  rivers: number[][];
  riichi: boolean[];
  safe: Set<number>[];
  scores: number[];
  wallLeft: number;
  dora: number[];
  doraT: number[];
  aka: number;
  seatWind: number;
  roundWind: number;
  kanOk: number[];
  forbid: number[];
}

interface CpuCandidate {
  idx: number;
  c: TileCounts;
  s: number;
  ukeire: number;
  danger: number;
  score: number;
}

interface CpuAction {
  kind: "discard" | "kan";
  idx: number;
  riichi?: boolean;
}

/* CPUに渡す情報：自分の手牌と、卓上に公開されている情報だけ */
function cpuView(s: number): CpuView {
  const drawn = drawnOf(s);
  const hand = poolOf(s);
  const v: CpuView = {
    seat: s,
    dealer: state.dealer,
    hand: hand,
    drawnIdx: drawn ? tileIdx(drawn) : -1,
    myMelds: P(s).melds.map(function (m) { return { k: m.k, i: m.i, kan: m.kan, open: m.open, idxs: m.tiles.map(tileIdx) }; }),
    ctxMelds: P(s).melds.map(function (m) { return { k: m.k, i: m.i, kan: m.kan, open: m.open }; }),
    open: hasOpenMeld(s),
    melds: [0, 1, 2, 3].map(function (x) { return P(x).melds.map(function (m) { return m.tiles.map(tileIdx); }); }),
    rivers: state.rivers.map(function (r) { return r.filter(function (t) { return !t.called; }).map(tileIdx); }),
    riichi: [0, 1, 2, 3].map(function (x) { return P(x).riichi; }),
    safe: state.safe,
    scores: state.scores.slice(),
    wallLeft: state.wall.length,
    dora: [],
    doraT: [],
    aka: hand.filter(function (t) { return t.red; }).length,
    seatWind: 27 + (s - state.dealer + 4) % 4,
    roundWind: state.roundWind,
    kanOk: drawn ? kanOptionsFor(s, drawn) : [],
    forbid: state.callDiscard === s ? state.forbid : []
  };
  for (let n = 0; n < state.doraCount; n++) {
    const i = tileIdx(state.deadWall[4 + 2 * n]);
    v.dora.push(i);
    v.doraT.push(doraTarget(i));
  }
  return v;
}

/* ---- CPU思考（cpuViewで渡された公開情報だけを使う。他家の手牌や牌山の中身は参照しない） ---- */
const SHANTEN_CACHE = new Map<string, number>();

function suitTable(cnt: number[], honor: boolean): number[][] {
  const len = cnt.length;
  const tbl = [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]];
  const c = cnt.slice();
  function dfs(i: number, sets: number, taa: number, pair: number): void {
    while (i < len && c[i] === 0) i++;
    if (i >= len) {
      if (sets <= 4 && taa > tbl[pair][sets]) tbl[pair][sets] = taa;
      return;
    }
    if (c[i] >= 3) { c[i] -= 3; dfs(i, sets + 1, taa, pair); c[i] += 3; }
    if (!honor && i <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, sets + 1, taa, pair); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    if (pair === 0 && c[i] >= 2) { c[i] -= 2; dfs(i, sets, taa, 1); c[i] += 2; }
    if (c[i] >= 2) { c[i] -= 2; dfs(i, sets, taa + 1, pair); c[i] += 2; }
    if (!honor && i <= 7 && c[i + 1] > 0) { c[i]--; c[i + 1]--; dfs(i, sets, taa + 1, pair); c[i]++; c[i + 1]++; }
    if (!honor && i <= 6 && c[i + 2] > 0) { c[i]--; c[i + 2]--; dfs(i, sets, taa + 1, pair); c[i]++; c[i + 2]++; }
    c[i]--; dfs(i, sets, taa, pair); c[i]++;
  }
  dfs(0, 0, 0, 0);
  return tbl;
}

/* シャンテン数（-1=和了形）。melds は副露・槓の数。14枚なら打牌後の最小値になる */
function shantenOf(c: TileCounts, melds: number): number {
  const key = c.join("") + melds;
  const hit = SHANTEN_CACHE.get(key);
  if (hit !== undefined) return hit;
  let dp = [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]];
  dp[0][0] = 0;
  for (let g = 0; g < 4; g++) {
    const tbl = suitTable(g < 3 ? c.slice(g * 9, g * 9 + 9) : c.slice(27, 34), g === 3);
    const nd = [[-1, -1, -1, -1, -1], [-1, -1, -1, -1, -1]];
    for (let p1 = 0; p1 < 2; p1++) {
      for (let s1 = 0; s1 <= 4; s1++) {
        if (dp[p1][s1] < 0) continue;
        for (let p2 = 0; p1 + p2 < 2; p2++) {
          for (let s2 = 0; s1 + s2 <= 4; s2++) {
            if (tbl[p2][s2] < 0) continue;
            const v = dp[p1][s1] + tbl[p2][s2];
            if (v > nd[p1 + p2][s1 + s2]) nd[p1 + p2][s1 + s2] = v;
          }
        }
      }
    }
    dp = nd;
  }
  let best = 8;
  for (let p = 0; p < 2; p++) {
    for (let s = 0; s <= 4; s++) {
      if (dp[p][s] < 0 || s + melds > 4) continue;
      const sets = s + melds;
      const t = Math.min(dp[p][s], 4 - sets);
      const v = 8 - 2 * sets - t - p;
      if (v < best) best = v;
    }
  }
  if (melds === 0) {
    let pairs = 0, kinds = 0, k = 0, pr = 0;
    for (let i = 0; i < 34; i++) {
      if (c[i] >= 2) pairs++;
      if (c[i] >= 1) kinds++;
    }
    best = Math.min(best, 6 - pairs + (kinds < 7 ? 7 - kinds : 0));
    for (const i of ORPHANS) {
      if (c[i] >= 1) k++;
      if (c[i] >= 2) pr = 1;
    }
    best = Math.min(best, 13 - k - pr);
  }
  if (SHANTEN_CACHE.size > 200000) SHANTEN_CACHE.clear();
  SHANTEN_CACHE.set(key, best);
  return best;
}

/* 自分の手牌・全員の河・ドラ表示牌・槓から、見えている牌の枚数を数える */
function visibleCounts(v: CpuView): TileCounts {
  const c: TileCounts = new Array(34).fill(0);
  for (const t of v.hand) c[tileIdx(t)]++;
  for (const r of v.rivers) for (const i of r) c[i]++;
  for (const i of v.dora) c[i]++;
  for (const ms of v.melds) for (const m of ms) for (const i of m) c[i]++;
  return c;
}

/* 放銃危険度の目安（％）。現物・スジ・字牌の残り枚数・ドラを考慮する */
function dangerTile(idx: number, opp: number, v: CpuView, vis: TileCounts): number {
  if (v.safe[opp].has(idx)) return 0;
  let d;
  if (idx >= 27) {
    const left = 4 - vis[idx];
    d = left >= 3 ? 12 : (left === 2 ? 7 : (left === 1 ? 3 : 0.5));
    if (idx >= 31 || idx === v.roundWind || idx === 27 + (opp - v.dealer + 4) % 4) d *= 1.3;
  } else {
    const n = idx % 9;
    const base = [6.5, 8, 10, 12, 13, 12, 10, 8, 6.5][n];
    const has = function (j: number): boolean { return v.safe[opp].has(j); };
    let f = 1;
    if (n <= 2) { if (has(idx + 3)) f = 0.4; }
    else if (n >= 6) { if (has(idx - 3)) f = 0.4; }
    else {
      const a = has(idx - 3), b = has(idx + 3);
      f = a && b ? 0.3 : (a || b ? 0.7 : 1);
    }
    d = base * f;
  }
  if (v.doraT.indexOf(idx) >= 0) d *= 1.4;
  return d;
}

function tileBonus(i: number, c14: TileCounts, v: CpuView): number {
  let b = 0;
  if (v.doraT.indexOf(i) >= 0) b -= 55;
  if (i >= 27) {
    const yaku = i >= 31 || i === v.seatWind || i === v.roundWind;
    if (yaku && c14[i] >= 2) b -= 80; else b += 6;
  } else if (i % 9 === 0 || i % 9 === 8) {
    b += 3;
  }
  return b;
}

/* 立直かダマか。全ての待ちがロンで役あり・4翻以上なら、ダマテンにする */
function decideRiichi(v: CpuView, cand: CpuCandidate, vis: TileCounts): boolean {
  const waits = waitsOf(cand.c);
  let rem = 0, minHan = 99;
  for (const w of waits) {
    const left = 4 - vis[w];
    if (left <= 0) continue;
    rem += left;
    const c = cand.c.slice();
    c[w]++;
    let doraN = 0;
    for (const t of v.doraT) doraN += c[t];
    const f = evaluateHand(c, {
      tsumo: false, riichi: false, doubleRiichi: false, ippatsu: false, haitei: false, houtei: false,
      rinshan: false, tenhou: false, chiihou: false, chankan: false, melds: v.ctxMelds,
      dora: { dora: doraN, ura: 0, aka: v.aka }, seatWind: v.seatWind, roundWind: v.roundWind, winIdx: w
    });
    minHan = Math.min(minHan, f ? f.han : 0);
  }
  if (rem === 0) return false;
  return minHan < 4;
}

function cpuDecide(v: CpuView): CpuAction {
  const melds = v.myMelds.length;
  const c14: TileCounts = new Array(34).fill(0);
  for (const t of v.hand) c14[tileIdx(t)]++;
  const vis = visibleCounts(v);
  const oppR: number[] = [];
  for (let r = 0; r < 4; r++) if (r !== v.seat && v.riichi[r]) oppR.push(r);
  const s0 = shantenOf(c14, melds);
  if (v.riichi[v.seat]) {
    if (v.kanOk.length > 0 && oppR.length === 0) return { kind: "kan", idx: v.kanOk[0] };
    return { kind: "discard", idx: v.drawnIdx, riichi: false };
  }
  if (oppR.length === 0 && v.wallLeft > 4) {
    for (const i of v.kanOk) {
      const c = c14.slice();
      c[i] -= 4;
      if (shantenOf(c, melds + 1) <= s0) return { kind: "kan", idx: i };
    }
  }
  const cands: CpuCandidate[] = [];
  const hasFree = v.hand.some(function (t) { return v.forbid.indexOf(tileIdx(t)) < 0; });
  for (let i = 0; i < 34; i++) {
    if (c14[i] === 0 || (hasFree && v.forbid.indexOf(i) >= 0)) continue;
    const c = c14.slice();
    c[i]--;
    cands.push({ idx: i, c: c, s: shantenOf(c, melds), ukeire: 0, danger: 0, score: 0 });
  }
  const minS = Math.min.apply(null, cands.map(function (x) { return x.s; }));
  const dw = oppR.length === 0 ? 0 : (minS === 0 ? 4 : (minS === 1 ? 9 : 100));
  for (const x of cands) {
    if (x.s <= minS + 1) {
      let u = 0;
      for (let j = 0; j < 34; j++) {
        const left = 4 - vis[j];
        if (left <= 0) continue;
        x.c[j]++;
        if (shantenOf(x.c, melds) < x.s) u += left;
        x.c[j]--;
      }
      x.ukeire = u;
    }
    for (const r of oppR) x.danger += dangerTile(x.idx, r, v, vis) * (r === v.dealer ? 1.3 : 1);
    x.score = -x.s * 1000 + x.ukeire * 12 + tileBonus(x.idx, c14, v) - x.danger * dw;
  }
  cands.sort(function (a, b) { return b.score - a.score; });
  const best = cands[0];
  const riichi = best.s === 0 && !v.open && v.scores[v.seat] >= 1000 && v.wallLeft >= 4 && decideRiichi(v, best, vis);
  return { kind: "discard", idx: best.idx, riichi: riichi };
}

/* 鳴く判断：相手のリーチ中は鳴かない。手が進み、かつ役が確実なときだけ鳴く（大明槓はしない） */
function callHasYaku(v: CpuView, c2: TileCounts, o: CallOption, ti: number): boolean {
  const yk = function (i: number): boolean { return i >= 31 || i === v.seatWind || i === v.roundWind; };
  if (o.type === "pon" && yk(ti)) return true;
  for (const m of v.myMelds) if (m.k === "t" && yk(m.i)) return true;
  const simple = function (i: number): boolean { return i < 27 && i % 9 >= 1 && i % 9 <= 7; };
  for (let i = 0; i < 34; i++) if (c2[i] > 0 && !simple(i)) return false;
  for (const m of v.myMelds) for (const i of m.idxs) if (!simple(i)) return false;
  if (!simple(ti)) return false;
  for (const t of o.use) if (!simple(tileIdx(t))) return false;
  return true;
}

function cpuCall(v: CpuView, ti: number, opts: CallOption[]): CallOption | null {
  for (let r = 0; r < 4; r++) if (r !== v.seat && v.riichi[r]) return null;
  const melds = v.myMelds.length;
  const c: TileCounts = new Array(34).fill(0);
  for (const t of v.hand) c[tileIdx(t)]++;
  const s0 = shantenOf(c, melds);
  for (const o of opts) {
    if (o.type === "minkan") continue;
    const c2 = c.slice();
    for (const t of o.use) c2[tileIdx(t)]--;
    if (shantenOf(c2, melds + 1) >= s0) continue;
    if (callHasYaku(v, c2, o, ti)) return o;
  }
  return null;
}

/* ---- 描画 ---- */
function tileName(t: Tile): string {
  if (t.suit === "z") return HONOR[t.num];
  return (t.suit === "m" ? KAN[t.num] : String(t.num)) + SUIT_CHAR[t.suit] + (t.red ? "（赤）" : "");
}

function tileHTML(t: Tile, opts: TileHTMLOptions = {}): string {
  const cls = "tile f-" + t.suit + t.num + (t.red ? " red" : "") + (opts.sel ? " sel" : "");
  if (opts.button) {
    return '<button type="button" class="' + cls + '" data-uid="' + t.uid + '" data-t="' + t.uid + '" aria-label="' + tileName(t) + '"></button>';
  }
  return '<div class="' + cls + '" data-t="' + t.uid + '" role="img" aria-label="' + tileName(t) + '"></div>';
}

function backsHTML(count, side) {
  let html = "";
  for (let i = 0; i < count; i++) {
    html += '<div class="tile back' + (side ? " side" : "") + '"></div>';
  }
  return html;
}

function meldsAreaHTML(s) {
  return state.pl[s].melds.map(function (m) { return '<div class="meld">' + meldHTML(m) + "</div>"; }).join("");
}

function riverHTML(river) {
  let html = "";
  for (let i = 0; i < river.length; i++) if (!river[i].called) html += tileHTML(river[i]);
  return html;
}

function render() {
  const snap = snapshotTiles();
  renderBase();
  renderBoard();
  updateActions();
  animateTiles(snap);
}

/* 場の情報：局・各席の風（親は赤）・持ち点・手番（下線） */
function renderBoard() {
  const names = ["東", "南", "西", "北"];
  for (let s = 0; s < 4; s++) {
    const w = document.getElementById("wind" + s);
    w.textContent = names[(s - state.dealer + 4) % 4];
    w.classList.toggle("dealer", s === state.dealer);
    const sc = document.getElementById("score" + s);
    setScore(s, state.scores[s]);
    sc.classList.toggle("cur", s === state.turn && !state.finished);
    const lab = document.querySelector("#seat" + s + " .label");
    const seatName = SEAT_NAMES[s] + "（" + names[(s - state.dealer + 4) % 4] + (s === state.dealer ? "・親" : "") + "）";
    if (s > 0) {
      const p = P(s);
      lab.textContent = seatName + (p.riichi ? "　リーチ" : "") + (kanCount(s) ? "　槓×" + kanCount(s) : "");
    } else {
      lab.textContent = seatName + "の捨て牌";
    }
  }
  document.getElementById("round").textContent = state.round;
  document.getElementById("sticks").textContent = (state.honba > 0 ? state.honba + "本場" : "") + (state.sticks > 0 ? "　供託" + state.sticks : "");
}

function renderBase() {
  document.getElementById("wall").textContent = String(state.wall.length);
  document.getElementById("dora").innerHTML = doraHTML();

  /* 自家の手牌（ツモ牌は右端に少し離して表示） */
  let handHTML = "";
  const hand = state.hands[0];
  for (let i = 0; i < hand.length; i++) {
    handHTML += tileHTML(hand[i], { button: true, sel: state.selected === hand[i].uid });
  }
  if (state.drawn) {
    handHTML += '<div class="gap"></div>';
    handHTML += tileHTML(state.drawn, { button: true, sel: state.selected === state.drawn.uid });
  }
  if (state.melds.length > 0) {
    handHTML += '<div class="gap"></div>';
    for (const m of state.melds) handHTML += '<div class="meld">' + meldHTML(m) + "</div>";
  }
  document.getElementById("hand0").innerHTML = handHTML;

  /* 他家の手牌（裏向き） */
  document.getElementById("backs1").innerHTML = backsHTML(state.hands[1].length, true) + meldsAreaHTML(1);
  document.getElementById("backs2").innerHTML = backsHTML(state.hands[2].length, false) + meldsAreaHTML(2);
  document.getElementById("backs3").innerHTML = backsHTML(state.hands[3].length, true) + meldsAreaHTML(3);

  /* 捨て牌（左寄せ・riverCols列で折り返し） */
  for (let s = 0; s < CONFIG.seats; s++) {
    const el = document.getElementById("river" + s);
    el.style.gridTemplateColumns = "repeat(" + CONFIG.riverCols + ", var(--rw))";
    el.innerHTML = riverHTML(state.rivers[s]);
  }

  /* メッセージ */
  const msg = document.getElementById("msg");
  if (state.finished) {
    msg.textContent = "流局（牌山がなくなりました）。「配牌し直す」で新しい局を始められます。";
  } else if (state.selected !== null) {
    msg.textContent = "選択中の牌をもう一度タップすると打牌します。";
  } else {
    msg.textContent = "捨てる牌をタップして選択してください。";
  }
}

/* ---- 対局（半荘）の進行：親の移動・連荘・本場・西入・終了判定 ---- */
let match: MatchState | null = null;

function freshMatch(): MatchState {
  return { scores: [25000, 25000, 25000, 25000], dealer: 0, wind: 0, kyoku: 0, honba: 0, sticks: 0 };
}

function newMatch(): void {
  resetScoreView();
  match = freshMatch();
  newGame();
}

/* 局の終了時に、次の局と対局の終了を決める。renchan = 親が和了した、または流局で親が聴牌 */
function planOutcome(renchan: boolean): void {
  const dealer = state.dealer;
  let nd = dealer, wind = state.wind, kyoku = state.kyoku;
  const honba = state.win ? (renchan ? state.honba + 1 : 0) : state.honba + 1;
  if (!renchan) {
    nd = (dealer + 1) % 4;
    kyoku++;
    if (kyoku >= 4) { kyoku = 0; wind++; }
  }
  let over = state.scores.some(function (x) { return x < 0; });
  const last = state.wind >= 1 && state.kyoku === 3;
  if (!over && last) {
    if (renchan) {
      const d = state.scores[dealer];
      over = d >= 30000 && state.scores.every(function (x, i) { return i === dealer || x <= d; });
    } else {
      over = state.wind >= 2 || state.scores.some(function (x) { return x >= 30000; });
    }
  }
  state.outcome = { renchan: renchan, next: { dealer: nd, wind: wind, kyoku: kyoku, honba: honba } };
  state.matchOver = over;
}

function nextHand(): void {
  if (!state.finished || state.matchOver || !state.outcome) return;
  const n = state.outcome.next;
  match = { scores: state.scores.slice(), dealer: n.dealer, wind: n.wind, kyoku: n.kyoku, honba: n.honba, sticks: state.sticks };
  newGame();
}

function finalHTML() {
  const order = [0, 1, 2, 3].sort(function (a, b) { return state.scores[b] - state.scores[a] || a - b; });
  let h = '<div class="total">最終結果</div>';
  order.forEach(function (s, i) { h += "<div>" + (i + 1) + "位　" + SEAT_NAMES[s] + "　" + state.scores[s] + "点</div>"; });
  if (state.scores.some(function (x) { return x < 0; })) h += '<div class="sub">持ち点がマイナスになったため終了しました。</div>';
  return h;
}

/* ---- 牌の移動と点数の変化の動き（表示だけを担当し、ゲームの状態は変えない） ---- */
const TILE_SEL = "#hand0 [data-t], .river [data-t], .backs [data-t]";
const MOVE_MS = 240;
const SCORE_MS = 800;

function motionOK() {
  if (typeof Element === "undefined" || typeof Element.prototype.animate !== "function") return false;
  return !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/* 描画の前に、手牌・河・副露の牌の位置を記録する */
function snapshotTiles() {
  const m = new Map();
  if (!motionOK()) return m;
  document.querySelectorAll(TILE_SEL).forEach(function (el) {
    const r = el.getBoundingClientRect();
    m.set(el.getAttribute("data-t"), { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width });
  });
  return m;
}

/* 以前は見えなかった牌（他家の打牌・鳴き）は、その席の手牌の位置から出てくる */
function motionOrigin(el) {
  const rv = el.closest(".river");
  const host = rv ? document.getElementById("backs" + rv.id.replace("river", "")) : el.closest(".backs");
  if (!host) return null;
  const r = host.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

/* 描画の後に、前の位置から今の位置へ牌を滑らせる */
function animateTiles(before) {
  if (!motionOK()) return;
  document.querySelectorAll<HTMLElement>(TILE_SEL).forEach(function (el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const b = before.get(el.getAttribute("data-t"));
    let dx, dy, s, fade = false;
    if (b) {
      dx = b.cx - cx;
      dy = b.cy - cy;
      s = b.w / r.width;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.02) return;
    } else {
      const o = motionOrigin(el);
      if (o) { dx = o.cx - cx; dy = o.cy - cy; s = 0.6; }
      else { dx = 0; dy = -28; s = 1; fade = true; }
    }
    el.style.zIndex = "20";
    const a = el.animate(
      [{ transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")" }, { transform: "translate(0px,0px) scale(1)" }],
      { duration: MOVE_MS, easing: "cubic-bezier(.2,.8,.2,1)", composite: "add" }
    );
    if (fade) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: "ease-out" });
    const done = function () { el.style.zIndex = ""; };
    a.onfinish = done;
    a.oncancel = done;
  });
}

/* 点数：数字を増減させながら変え、増減した点数を浮かせて見せる */
const scoreView = [null, null, null, null];

function resetScoreView() {
  for (let i = 0; i < 4; i++) {
    if (scoreView[i] && typeof cancelAnimationFrame === "function") cancelAnimationFrame(scoreView[i].raf);
    scoreView[i] = null;
  }
}

function setScore(s, v) {
  const el = document.getElementById("score" + s);
  const sv = scoreView[s];
  if (!sv) {
    scoreView[s] = { shown: v, target: v, raf: 0 };
    el.textContent = v;
    return;
  }
  if (sv.target === v) return;
  const diff = v - sv.target;
  sv.target = v;
  if (!motionOK() || typeof requestAnimationFrame !== "function") {
    sv.shown = v;
    el.textContent = v;
    return;
  }
  scorePopup(s, diff);
  const from = sv.shown;
  const t0 = performance.now();
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(sv.raf);
  const step = function (now) {
    const k = Math.min(1, (now - t0) / SCORE_MS);
    const e = 1 - Math.pow(1 - k, 3);
    sv.shown = k < 1 ? Math.round(from + (sv.target - from) * e) : sv.target;
    el.textContent = sv.shown;
    if (k < 1) sv.raf = requestAnimationFrame(step);
  };
  sv.raf = requestAnimationFrame(step);
}

function scorePopup(s, diff) {
  const board = document.querySelector(".board");
  const el = document.getElementById("score" + s);
  if (!board || !diff || typeof el.getBoundingClientRect !== "function") return;
  const b = board.getBoundingClientRect(), r = el.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "pop " + (diff > 0 ? "pos" : "neg");
  pop.textContent = (diff > 0 ? "+" : "−") + Math.abs(diff);
  board.appendChild(pop);
  let x = r.left - b.left + r.width / 2;
  let y = r.top - b.top + r.height / 2;
  const vx = b.width / 2 - x, vy = b.height / 2 - y;
  const len = Math.sqrt(vx * vx + vy * vy) || 1;
  x += vx / len * 26;
  y += vy / len * 26;
  pop.style.left = (x - pop.offsetWidth / 2) + "px";
  pop.style.top = (y - pop.offsetHeight / 2) + "px";
  const a = pop.animate([
    { opacity: 0, transform: "translateY(6px)" },
    { opacity: 1, transform: "translateY(-4px)", offset: 0.2 },
    { opacity: 1, transform: "translateY(-12px)", offset: 0.75 },
    { opacity: 0, transform: "translateY(-20px)" }
  ], { duration: 1500, easing: "ease-out" });
  a.onfinish = function () { pop.remove(); };
}

/* ---- イベント ---- */
document.getElementById("hand0").addEventListener("click", function (e) {
  if (!(e.target instanceof Element)) return;
  const btn = e.target.closest("[data-uid]");
  if (btn) onTileClick(Number(btn.getAttribute("data-uid")));
});
document.getElementById("restart").addEventListener("click", newMatch);
document.getElementById("next").addEventListener("click", nextHand);
document.getElementById("riichi").addEventListener("click", toggleRiichi);
document.getElementById("kan").addEventListener("click", doKan);
document.getElementById("tsumo").addEventListener("click", declareWin);
document.getElementById("ron").addEventListener("click", doRon);
document.getElementById("pass").addEventListener("click", doPass);
document.getElementById("calls").addEventListener("click", function (e) {
  if (!(e.target instanceof Element)) return;
  const b = e.target.closest("[data-call]");
  if (b) doCall(Number(b.getAttribute("data-call")));
});

newMatch();
