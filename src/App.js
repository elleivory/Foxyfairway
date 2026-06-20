/* eslint-disable */
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";

const SUPABASE_URL = "https://ktxlzzldpwexmrvdgwqu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0eGx6emxkcHdleG1ydmRnd3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTg4NDcsImV4cCI6MjA5NzI5NDg0N30.dFQSNEpTYrzbto7qjIqJbBO9xWaCWzMYdEOXA5EdwjQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_CODE = "CH";
const SUPER_ADMIN_CODE = "CH24";

const GAME_TYPES = {
  stroke:          { label: "Stroke Play",     description: "Lowest total score wins" },
  stableford:      { label: "Stableford",       description: "Points per hole, most points wins" },
  matchplay:       { label: "Match Play",        description: "Win holes, most wins" },
  matchplay_teams: { label: "Match Play Teams",  description: "Teams compete, best net per team wins hole" },
  banker:          { label: "Banker",           description: "Bet against the banker, lowest net wins" },
};

function genId() {
  return Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
}

function formatToPar(val) {
  if (val === 0) return "E";
  return val > 0 ? "+" + val : "" + val;
}

// =============================================================================
// PLAYER PROFILE (device-specific)
// =============================================================================
function getPlayerProfile() {
  try { return JSON.parse(localStorage.getItem("ff_profile") || "{}"); } catch { return {}; }
}
function savePlayerProfile(name, handicap) {
  localStorage.setItem("ff_profile", JSON.stringify({ name, handicap }));
}

// =============================================================================
// TOURNAMENT HELPERS (localStorage)
// =============================================================================
function getTournaments() {
  try { return JSON.parse(localStorage.getItem("ff_tournaments") || "[]"); } catch { return []; }
}
function saveTournament(t) {
  const all = getTournaments().filter((x) => x.id !== t.id);
  localStorage.setItem("ff_tournaments", JSON.stringify([t, ...all]));
}
function deleteTournament(id) {
  localStorage.setItem("ff_tournaments", JSON.stringify(getTournaments().filter((x) => x.id !== id)));
}
function addRoundToTournament(tournamentId, roundSummary) {
  const all = getTournaments();
  const t = all.find((x) => x.id === tournamentId);
  if (!t) return;
  t.rounds = [...(t.rounds || []).filter((r) => r.id !== roundSummary.id), roundSummary];
  saveTournament(t);
}

// =============================================================================
// COURSE DATA
// =============================================================================
const DEFAULT_COURSES = [
  { id: "cromwell-1", name: "Cromwell Golf Club", par: 71, holes: [
    {hole_number:1,par:5,stroke_index:3},{hole_number:2,par:4,stroke_index:5},
    {hole_number:3,par:3,stroke_index:17},{hole_number:4,par:5,stroke_index:7},
    {hole_number:5,par:3,stroke_index:13},{hole_number:6,par:4,stroke_index:9},
    {hole_number:7,par:4,stroke_index:15},{hole_number:8,par:4,stroke_index:11},
    {hole_number:9,par:4,stroke_index:1},{hole_number:10,par:4,stroke_index:12},
    {hole_number:11,par:5,stroke_index:18},{hole_number:12,par:4,stroke_index:8},
    {hole_number:13,par:4,stroke_index:10},{hole_number:14,par:3,stroke_index:14},
    {hole_number:15,par:4,stroke_index:6},{hole_number:16,par:3,stroke_index:2},
    {hole_number:17,par:4,stroke_index:16},{hole_number:18,par:4,stroke_index:4},
  ]},
  { id: "wanaka-1", name: "Wanaka Golf Club", par: 70, holes: [
    {hole_number:1,par:4,stroke_index:3},{hole_number:2,par:3,stroke_index:14},
    {hole_number:3,par:4,stroke_index:8},{hole_number:4,par:4,stroke_index:16},
    {hole_number:5,par:4,stroke_index:2},{hole_number:6,par:3,stroke_index:18},
    {hole_number:7,par:4,stroke_index:4},{hole_number:8,par:4,stroke_index:6},
    {hole_number:9,par:4,stroke_index:12},{hole_number:10,par:5,stroke_index:11},
    {hole_number:11,par:4,stroke_index:7},{hole_number:12,par:4,stroke_index:3},
    {hole_number:13,par:3,stroke_index:15},{hole_number:14,par:4,stroke_index:1},
    {hole_number:15,par:4,stroke_index:17},{hole_number:16,par:3,stroke_index:5},
    {hole_number:17,par:5,stroke_index:4},{hole_number:18,par:4,stroke_index:4},
  ]},
  { id: "jacks-1", name: "Jacks Point Golf Club", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:14},{hole_number:2,par:4,stroke_index:2},
    {hole_number:3,par:3,stroke_index:12},{hole_number:4,par:4,stroke_index:10},
    {hole_number:5,par:5,stroke_index:6},{hole_number:6,par:4,stroke_index:16},
    {hole_number:7,par:3,stroke_index:18},{hole_number:8,par:5,stroke_index:4},
    {hole_number:9,par:4,stroke_index:8},{hole_number:10,par:4,stroke_index:9},
    {hole_number:11,par:4,stroke_index:5},{hole_number:12,par:3,stroke_index:17},
    {hole_number:13,par:4,stroke_index:11},{hole_number:14,par:4,stroke_index:15},
    {hole_number:15,par:5,stroke_index:3},{hole_number:16,par:4,stroke_index:13},
    {hole_number:17,par:3,stroke_index:1},{hole_number:18,par:5,stroke_index:7},
  ]},
  { id: "alexandra-1", name: "Alexandra Golf Club", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:5},{hole_number:2,par:4,stroke_index:11},
    {hole_number:3,par:4,stroke_index:3},{hole_number:4,par:5,stroke_index:15},
    {hole_number:5,par:3,stroke_index:17},{hole_number:6,par:4,stroke_index:7},
    {hole_number:7,par:5,stroke_index:9},{hole_number:8,par:3,stroke_index:13},
    {hole_number:9,par:4,stroke_index:1},{hole_number:10,par:4,stroke_index:6},
    {hole_number:11,par:3,stroke_index:18},{hole_number:12,par:5,stroke_index:2},
    {hole_number:13,par:4,stroke_index:10},{hole_number:14,par:4,stroke_index:8},
    {hole_number:15,par:3,stroke_index:16},{hole_number:16,par:4,stroke_index:4},
    {hole_number:17,par:4,stroke_index:12},{hole_number:18,par:5,stroke_index:14},
  ]},
  { id: "arrowtown-1", name: "Arrowtown Golf Club", par: 70, holes: [
    {hole_number:1,par:5,stroke_index:13},{hole_number:2,par:4,stroke_index:8},
    {hole_number:3,par:3,stroke_index:15},{hole_number:4,par:5,stroke_index:11},
    {hole_number:5,par:3,stroke_index:10},{hole_number:6,par:4,stroke_index:1},
    {hole_number:7,par:3,stroke_index:14},{hole_number:8,par:4,stroke_index:6},
    {hole_number:9,par:4,stroke_index:2},{hole_number:10,par:3,stroke_index:16},
    {hole_number:11,par:5,stroke_index:5},{hole_number:12,par:4,stroke_index:7},
    {hole_number:13,par:4,stroke_index:9},{hole_number:14,par:4,stroke_index:3},
    {hole_number:15,par:4,stroke_index:18},{hole_number:16,par:3,stroke_index:12},
    {hole_number:17,par:4,stroke_index:4},{hole_number:18,par:3,stroke_index:17},
  ]},
  { id: "queenstown-1", name: "Queenstown Golf Club", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:4},{hole_number:2,par:4,stroke_index:12},
    {hole_number:3,par:3,stroke_index:16},{hole_number:4,par:4,stroke_index:6},
    {hole_number:5,par:5,stroke_index:2},{hole_number:6,par:4,stroke_index:10},
    {hole_number:7,par:3,stroke_index:18},{hole_number:8,par:5,stroke_index:8},
    {hole_number:9,par:4,stroke_index:14},{hole_number:10,par:4,stroke_index:5},
    {hole_number:11,par:4,stroke_index:11},{hole_number:12,par:3,stroke_index:17},
    {hole_number:13,par:4,stroke_index:7},{hole_number:14,par:5,stroke_index:1},
    {hole_number:15,par:4,stroke_index:9},{hole_number:16,par:4,stroke_index:15},
    {hole_number:17,par:3,stroke_index:3},{hole_number:18,par:5,stroke_index:13},
  ]},
  { id: "millbrook-remarkables", name: "Millbrook - Remarkables Course", par: 71, holes: [
    {hole_number:1,par:5,stroke_index:14},{hole_number:2,par:4,stroke_index:6},
    {hole_number:3,par:4,stroke_index:2},{hole_number:4,par:3,stroke_index:16},
    {hole_number:5,par:5,stroke_index:4},{hole_number:6,par:4,stroke_index:10},
    {hole_number:7,par:4,stroke_index:8},{hole_number:8,par:4,stroke_index:12},
    {hole_number:9,par:3,stroke_index:18},{hole_number:10,par:4,stroke_index:11},
    {hole_number:11,par:5,stroke_index:1},{hole_number:12,par:4,stroke_index:7},
    {hole_number:13,par:3,stroke_index:17},{hole_number:14,par:4,stroke_index:9},
    {hole_number:15,par:4,stroke_index:13},{hole_number:16,par:3,stroke_index:15},
    {hole_number:17,par:4,stroke_index:5},{hole_number:18,par:4,stroke_index:3},
  ]},
  { id: "millbrook-coronet", name: "Millbrook - Coronet Course", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:8},{hole_number:2,par:4,stroke_index:4},
    {hole_number:3,par:3,stroke_index:14},{hole_number:4,par:5,stroke_index:2},
    {hole_number:5,par:4,stroke_index:12},{hole_number:6,par:5,stroke_index:6},
    {hole_number:7,par:3,stroke_index:16},{hole_number:8,par:4,stroke_index:10},
    {hole_number:9,par:4,stroke_index:18},{hole_number:10,par:4,stroke_index:7},
    {hole_number:11,par:5,stroke_index:1},{hole_number:12,par:3,stroke_index:15},
    {hole_number:13,par:4,stroke_index:11},{hole_number:14,par:4,stroke_index:5},
    {hole_number:15,par:3,stroke_index:17},{hole_number:16,par:4,stroke_index:9},
    {hole_number:17,par:5,stroke_index:3},{hole_number:18,par:4,stroke_index:13},
  ]},
];

function getHolesForRound(round) {
  let holes = round.holes;
  if (typeof holes === "string") { try { holes = JSON.parse(holes); } catch { holes = null; } }
  if (Array.isArray(holes) && holes.length > 0) return holes;
  const course = DEFAULT_COURSES.find((c) => c.id === round.course_id);
  return course ? course.holes : [];
}

// =============================================================================
// GOLF LOGIC
// =============================================================================
function getHcpStrokes(handicap, strokeIndex, useHandicap = true) {
  if (!useHandicap) return 0; // Scratch mode
  if (!handicap || handicap === 0) return 0;
  const hcpFloat = parseFloat(handicap);
  const hcpWhole = Math.floor(hcpFloat);
  const fraction = hcpFloat - hcpWhole;
  const si = parseInt(strokeIndex);
  const extraHoles = Math.round(fraction * 18);
  let strokes = 0;
  if (hcpWhole >= 36) strokes = si <= (hcpWhole - 36) ? 3 : 2;
  else if (hcpWhole >= 18) strokes = si <= (hcpWhole - 18) ? 2 : 1;
  else strokes = si <= hcpWhole ? 1 : 0;
  if (extraHoles > 0 && si <= extraHoles) strokes++;
  return strokes;
}

function stablefordPoints(gross, par, hcpS) {
  return Math.max(0, par - (gross - hcpS) + 2);
}

function allPlayersScored(holeNumber, players, scores) {
  return players.every((p) => scores.some((s) => s.player_id === p.id && s.hole_number === holeNumber));
}

function calcLeaderboard(players, scores, holes, gameType) {
  return players.map((p) => {
    let total = 0, holesPlayed = 0, toPar = 0, grossTotal = 0;
    const holeScores = {};
    scores.filter((s) => s.player_id === p.id).forEach((s) => {
      const hole = holes.find((h) => h.hole_number === s.hole_number);
      if (!hole) return;
      const hcpS = getHcpStrokes(p.handicap, hole.stroke_index);
      holeScores[s.hole_number] = { gross: s.score, net: s.score - hcpS, par: hole.par, hcpS };
      if (gameType !== "matchplay" && gameType !== "banker")
        total += gameType === "stableford" ? stablefordPoints(s.score, hole.par, hcpS) : s.score - hcpS;
      toPar += s.score - hole.par;
      grossTotal += s.score;
      holesPlayed++;
    });
    const netTotal = grossTotal - parseInt(p.handicap || 0);

    if (gameType === "matchplay") {
      let myWon = 0, oppWon = 0;
      holes.forEach((hole) => {
        const myS = scores.find((s) => s.player_id === p.id && s.hole_number === hole.hole_number);
        if (!myS) return;
        const allH = scores.filter((s) => s.hole_number === hole.hole_number);
        if (!players.every((pl) => allH.some((s) => s.player_id === pl.id && s.score > 0))) return;
        // Find lowest net score
        let lowestNet = Infinity;
        allH.forEach((s) => { const pl = players.find((pl) => pl.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowestNet) lowestNet = net; });
        const holeWinners = allH.filter((s) => { const pl = players.find((pl) => pl.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowestNet; }).map((s) => s.player_id);
        const allTied = holeWinners.length === players.length;
        if (!allTied) {
          if (holeWinners.includes(p.id)) myWon++;
          else oppWon++;
        }
      });
      total = myWon - oppWon;
    }

    if (gameType === "matchplay_teams") {
      let myTeamWon = 0, oppTeamWon = 0;
      holes.forEach((hole) => {
        const myS = scores.find((s) => s.player_id === p.id && s.hole_number === hole.hole_number);
        if (!myS) return;
        const bestNet = (team) => team.reduce((best, tp) => {
          const ts = scores.find((s) => s.player_id === tp.id && s.hole_number === hole.hole_number);
          if (!ts) return best;
          return Math.min(best, ts.score - getHcpStrokes(tp.handicap, hole.stroke_index));
        }, Infinity);
        const my = bestNet(players.filter((pl) => pl.team === p.team));
        const opp = bestNet(players.filter((pl) => pl.team !== p.team));
        if (my !== Infinity && opp !== Infinity) {
          if (my < opp) myTeamWon++;
          else if (my > opp) oppTeamWon++;
          // equal = halved hole, no points
        }
      });
      total = myTeamWon - oppTeamWon;
    }

    if (gameType === "banker") {
      let bankerTotal = 0; const bankerHoleData = {};
      holes.forEach((hole) => {
        const myS = scores.find((s) => s.player_id === p.id && s.hole_number === hole.hole_number);
        if (!myS) return;
        const allH = scores.filter((s) => s.hole_number === hole.hole_number);
        if (!players.every((pl) => allH.some((s) => s.player_id === pl.id && s.score > 0))) return;
        const bankerId = myS.banker_id || allH[0]?.banker_id;
        const doubled = allH.some((s) => s.doubled);
        const iAmBanker = bankerId === p.id;
        // Find lowest net score and all players at that score
        let lowest = Infinity;
        allH.forEach((s) => {
          const pl = players.find((pl) => pl.id === s.player_id); if (!pl) return;
          if (s.score === 0) return; // skip placeholder scores
          const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index);
          if (net < lowest) lowest = net;
        });
        const winners = allH.filter((s) => {
          const pl = players.find((pl) => pl.id === s.player_id); if (!pl || s.score === 0) return false;
          return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowest;
        }).map((s) => s.player_id);
        
        const bankerIsWinner = winners.includes(bankerId);
        let holeChange = 0;
        
        if (iAmBanker) {
          if (bankerIsWinner) {
            // Banker won or tied for lead - collect from all losers
            allH.forEach((s) => {
              if (s.player_id === p.id || s.score === 0) return;
              if (!winners.includes(s.player_id)) {
                holeChange += (s.bet || 0);
              }
            });
          } else {
            // Banker lost - pay each winner their bet
            allH.forEach((s) => {
              if (s.player_id === p.id || s.score === 0) return;
              if (winners.includes(s.player_id)) {
                holeChange -= (s.bet || 0);
              }
            });
          }
        } else {
          const myBet = (myS.bet || 0);
          if (myBet > 0) {
            if (winners.includes(p.id) && !bankerIsWinner) {
              // I beat the banker - collect my bet from banker
              holeChange += myBet;
            } else if (bankerIsWinner && !winners.includes(p.id)) {
              // Banker beat me - pay my bet to banker
              holeChange -= myBet;
            }
            // If I tied with banker or tied with others but banker also won = $0
          }
        }
        bankerTotal += holeChange;
        bankerHoleData[hole.hole_number] = { bet: myS.bet || 0, effectiveBet: (myS.bet||0), iAmBanker, isWinner: winner === p.id, winnerId: winner, tied, holeChange, runningPot: bankerTotal, bankerId, doubled };
      });
      total = bankerTotal;
      holeScores.bankerHoleData = bankerHoleData;
    }

    return { ...p, total, holesPlayed, toPar, holeScores, grossTotal, netTotal };
  }).sort((a, b) => gameType === "stableford" || gameType === "banker" ? b.total - a.total : a.total - b.total);
}

function scoreColour(gross, par, hcpS) {
  if (!gross) return "#94a3b8";
  const diff = (gross - hcpS) - par;
  if (diff <= -2) return "#f59e0b"; if (diff === -1) return "#22c55e";
  if (diff === 0) return "#3b82f6"; if (diff === 1) return "#ef4444";
  return "#7f1d1d";
}

function getScoreShape(gross, par) {
  if (!gross) return { number: "", shape: "none" };
  const diff = gross - par;
  let shape = "none";
  if (diff <= -3) shape = "tripleCircle"; else if (diff === -2) shape = "doubleCircle";
  else if (diff === -1) shape = "circle"; else if (diff === 1) shape = "square";
  else if (diff === 2) shape = "doubleSquare"; else if (diff >= 3) shape = "triangle";
  return { number: gross, shape };
}

function getNetShape(gross, par, hcpS) {
  if (!gross) return { number: "", shape: "none" };
  const net = gross - hcpS, diff = net - par;
  let shape = "none";
  if (diff <= -3) shape = "tripleCircle"; else if (diff === -2) shape = "doubleCircle";
  else if (diff === -1) shape = "circle"; else if (diff === 1) shape = "square";
  else if (diff === 2) shape = "doubleSquare"; else if (diff >= 3) shape = "triangle";
  return { number: net, shape };
}

function shapeStyle(shape) {
  // Use wrapper approach - inner element gets the shape, outer provides spacing
  const base = { display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#e2e8f0", width: 32, height: 32, flexShrink: 0, position: "relative" };
  switch (shape) {
    case "circle":
      return { ...base, borderRadius: "50%", border: "1.5px solid #e2e8f0", width: 24, height: 24 };
    case "doubleCircle":
      // Use box-shadow instead of outline - stays inside the element bounds
      return { ...base, borderRadius: "50%", border: "1.5px solid #e2e8f0", boxShadow: "0 0 0 3px #1e293b, 0 0 0 5px #e2e8f0", width: 20, height: 20, margin: "4px" };
    case "tripleCircle":
      return { ...base, borderRadius: "50%", border: "1.5px solid #e2e8f0", boxShadow: "0 0 0 2px #1e293b, 0 0 0 4px #e2e8f0, 0 0 0 6px #1e293b, 0 0 0 8px #e2e8f0", width: 14, height: 14, margin: "7px" };
    case "square":
      return { ...base, border: "1.5px solid #e2e8f0", width: 24, height: 24 };
    case "doubleSquare":
      return { ...base, border: "1.5px solid #e2e8f0", boxShadow: "0 0 0 3px #1e293b, 0 0 0 5px #e2e8f0", width: 20, height: 20, margin: "4px" };
    case "triangle":
      return { ...base, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)", border: "1.5px solid #e2e8f0", width: 22, height: 22 };
    default:
      return base;
  }
}

function scoreLabel(gross, par) {
  if (!gross) return "";
  const diff = gross - par;
  if (diff <= -2) return "Eagle"; if (diff === -1) return "Birdie";
  if (diff === 0) return "Par"; if (diff === 1) return "Bogey";
  if (diff === 2) return "Double"; return "+" + diff;
}

// =============================================================================
// SUPABASE HELPERS
// =============================================================================
async function dbCreateRound(data) {
  const row = { id: genId(), ...data };
  const { data: result, error } = await supabase.from("rounds").insert([row]).select().single();
  if (error) throw error;
  return result;
}

async function dbGetRound(code) {
  const { data, error } = await supabase.from("rounds").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (error) { console.error("dbGetRound error:", JSON.stringify(error)); throw error; }
  if (!data) throw new Error("Round not found for code: " + code);
  return data;
}

async function dbCreatePlayer(data) {
  const row = { id: genId(), ...data };
  const { data: result, error } = await supabase.from("players").insert([row]).select().single();
  if (error) throw error;
  return result;
}

async function dbGetPlayers(roundId) {
  const { data } = await supabase.from("players").select("*").eq("round_id", roundId).eq("is_placeholder", false);
  return data || [];
}

async function dbGetScores(roundId) {
  const { data } = await supabase.from("scores").select("*").eq("round_id", roundId);
  return data || [];
}

async function dbSaveScore(obj) {
  const { error } = await supabase.from("scores").upsert(obj, { onConflict: "player_id,hole_number,round_id" });
  if (error) {
    await supabase.from("scores").delete().eq("player_id", obj.player_id).eq("hole_number", obj.hole_number).eq("round_id", obj.round_id);
    await supabase.from("scores").insert([obj]);
  }
}

async function dbGetCourses() {
  const { data } = await supabase.from("courses").select("*").order("name");
  return data || [];
}

async function dbSaveCourse(course) {
  const { error } = await supabase.from("courses").upsert({ id: course.id, name: course.name, par: course.par || 72, holes: course.holes }, { onConflict: "id" });
  if (error) throw error;
}

async function dbDeleteCourse(courseId) {
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw error;
}

function getDeletedCourseIds() {
  try { return JSON.parse(localStorage.getItem("ff_deleted_courses") || "[]"); } catch { return []; }
}
function markCourseDeleted(id) {
  const ids = getDeletedCourseIds();
  if (!ids.includes(id)) localStorage.setItem("ff_deleted_courses", JSON.stringify([...ids, id]));
}

async function dbSeedCourses() {
  const existing = await dbGetCourses();
  const existingIds = existing.map((c) => c.id);
  const deletedIds = getDeletedCourseIds();
  const toInsert = DEFAULT_COURSES.filter((c) => !existingIds.includes(c.id) && !deletedIds.includes(c.id));
  if (toInsert.length > 0) {
    await supabase.from("courses").insert(toInsert.map((c) => ({ id: c.id, name: c.name, par: c.par, holes: c.holes })));
  }
}

async function dbGetChat(roundId) {
  const { data } = await supabase.from("chat_messages").select("*").eq("round_id", roundId).order("created_at", { ascending: true });
  return data || [];
}

async function dbSendChat(msg) {
  await supabase.from("chat_messages").insert([msg]);
}

async function dbGetAllRounds() {
  const { data } = await supabase.from("rounds").select("*, players(count)").order("created_at", { ascending: false }).limit(100);
  const deletedIds = JSON.parse(localStorage.getItem("ff_deleted_rounds") || "[]");
  return (data || []).filter((r) => !deletedIds.includes(r.id));
}

async function dbDeleteRound(roundId) {
  await supabase.from("scores").delete().eq("round_id", roundId);
  await supabase.from("players").delete().eq("round_id", roundId);
  await supabase.from("chat_messages").delete().eq("round_id", roundId);
  await supabase.from("rounds").delete().eq("id", roundId);
}

async function dbSaveBanker(roundId, bankerId) {
  await supabase.from("rounds").update({ initial_banker_id: bankerId, current_banker_id: bankerId }).eq("id", roundId);
}
async function dbSaveCurrentBanker(roundId, bankerId) {
  await supabase.from("rounds").update({ current_banker_id: bankerId }).eq("id", roundId);
}

async function dbSaveCurrentHole(roundId, holeNum) {
  await supabase.from("rounds").update({ current_hole: holeNum }).eq("id", roundId);
}

async function dbGetBanker(roundId) {
  const { data } = await supabase.from("rounds").select("initial_banker_id, current_banker_id, created_by, current_hole").eq("id", roundId).single();
  return data || {};
}

async function dbSaveRoundHistory(entry) {
  await supabase.from("saved_rounds").upsert({ id: entry.id, player_name: entry.createdBy, data: entry }, { onConflict: "id" });
}

async function dbGetRoundHistory(playerName) {
  const { data } = await supabase.from("saved_rounds").select("*").order("created_at", { ascending: false });
  if (!data) return [];
  return data.filter((r) => r.data?.players?.some((p) => p.name?.toLowerCase() === playerName?.toLowerCase())).map((r) => r.data);
}

async function dbGetBlockedPlayers() {
  const { data } = await supabase.from("blocked_players").select("*");
  return data || [];
}

async function dbBlockPlayer(name) {
  await supabase.from("blocked_players").insert([{ id: genId(), name: name.toLowerCase(), blocked_at: new Date().toISOString() }]);
}

async function dbUnblockPlayer(id) {
  await supabase.from("blocked_players").delete().eq("id", id);
}

async function dbIsPlayerBlocked(name) {
  const { data } = await supabase.from("blocked_players").select("id").eq("name", name.toLowerCase());
  return (data || []).length > 0;
}

async function dbFindPlayerByName(roundId, name) {
  const players = await dbGetPlayers(roundId);
  return players.find((p) => p.name.toLowerCase() === name.toLowerCase()) || null;
}

// Save/load last round from localStorage
function saveLastRound(round, me) {
  localStorage.setItem("ff_last_round", JSON.stringify({ round, me, savedAt: Date.now() }));
}

// Saved rounds history
function getSavedRounds(playerName = null) {
  try {
    const saved = localStorage.getItem("ff_saved_rounds");
    const all = saved ? JSON.parse(saved) : [];
    if (!playerName) return all;
    return all.filter((r) => r.players?.some((p) => p.name?.toLowerCase() === playerName.toLowerCase()));
  } catch { return []; }
}

async function getSavedRoundsFromSupabase(playerName) {
  try { return await dbGetRoundHistory(playerName); } catch { return []; }
}

async function saveRoundToHistory(round, players, scores, holes) {
  const existing = getSavedRounds();
  const creator = players[0]?.name || 'Unknown';
  const entry = {
    id: round.id,
    code: round.code,
    course_name: round.course_name,
    game_type: round.game_type,
    holes,
    players,
    scores,
    savedAt: Date.now(),
    date: new Date().toLocaleString("en-NZ", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
    createdBy: creator,
  };
  const filtered = existing.filter((r) => r.id !== round.id);
  const updated = [entry, ...filtered].slice(0, 20); // keep last 20
  localStorage.setItem("ff_saved_rounds", JSON.stringify(updated));
  try { await dbSaveRoundHistory(entry); } catch(e) { console.log("Remote save failed", e); }
}

function deleteSavedRound(roundId) {
  const existing = getSavedRounds();
  localStorage.setItem("ff_saved_rounds", JSON.stringify(existing.filter((r) => r.id !== roundId)));
}

function loadLastRound() {
  try {
    const saved = localStorage.getItem("ff_last_round");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // Only offer rejoin if saved within last 24 hours
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

// =============================================================================
// SCORECARD IMAGE EXPORT
// =============================================================================
async function exportScorecardPDF(round, players, scores, holes) {
  const front9 = holes.slice(0, 9);
  const back9 = holes.slice(9, 18);

  const shapeCell = (score, par, hcpS, gameType, extraMetric) => {
    if (!score) return `<td style="border:1px solid #ccc;padding:6px;text-align:center;color:#999;font-size:13px">—</td>`;
    const diff = score - par;
    const netDiff = score - hcpS - par;
    let shape = "";
    if (diff <= -2) shape = `border-radius:50%;border:2px solid #333;outline:2px solid #333;outline-offset:2px;`;
    else if (diff === -1) shape = `border-radius:50%;border:2px solid #333;`;
    else if (diff === 1) shape = `border:2px solid #333;`;
    else if (diff >= 2) shape = `border:2px solid #333;outline:2px solid #333;outline-offset:2px;`;
    let metric = "";
    if (gameType === "stableford") { const pts = Math.max(0, par - (score - hcpS) + 2); metric = `<div style="font-size:9px;color:#555">${pts}pt</div>`; }
    else if (gameType === "matchplay") metric = "";
    else if (gameType === "banker" && extraMetric !== undefined) { const c = extraMetric > 0 ? "green" : extraMetric < 0 ? "red" : "#555"; metric = `<div style="font-size:9px;color:${c}">${extraMetric >= 0 ? "+" : ""}$${extraMetric}</div>`; }
    return `<td style="border:1px solid #ccc;padding:4px;text-align:center"><div style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;font-size:13px;font-weight:bold;${shape}">${score}</div>${metric}</td>`;
  };

  const buildPlayerTable = (player, holeSet, setLabel) => {
    const lbData = calcLeaderboard([player], scores, holes, round.game_type)[0];
    const parRow = holeSet.map((h) => `<td style="border:1px solid #ccc;padding:5px;text-align:center;background:#f5f5f5;font-size:12px">${h.par}</td>`).join("");
    const holeRow = holeSet.map((h) => `<td style="border:1px solid #ccc;padding:5px;text-align:center;background:#e8e8e8;font-weight:bold;font-size:12px">${h.hole_number}</td>`).join("");
    const parTotal = holeSet.reduce((s, h) => s + h.par, 0);
    const playerScores = holeSet.map((h) => {
      const sc = scores.find((s) => s.player_id === player.id && s.hole_number === h.hole_number);
      const hcpS = getHcpStrokes(player.handicap, h.stroke_index);
      let extra;
      if (round.game_type === "banker" && lbData?.holeScores?.bankerHoleData?.[h.hole_number]) {
        extra = lbData.holeScores.bankerHoleData[h.hole_number].holeChange;
      }
      return shapeCell(sc?.score, h.par, hcpS, round.game_type, extra);
    }).join("");
    const grossSet = holeSet.reduce((s, h) => { const sc = scores.find((x) => x.player_id === player.id && x.hole_number === h.hole_number); return s + (sc?.score || 0); }, 0);
    const totalLabel = round.game_type === "stableford" ? (lbData?.total || 0) + "pts" : round.game_type === "banker" ? (lbData?.total >= 0 ? "+$" : "-$") + Math.abs(lbData?.total || 0) : formatToPar(lbData?.toPar || 0);
    return `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <div style="background:#1a2a3a;color:white;padding:8px 12px;font-weight:bold;font-size:14px;border-radius:4px 4px 0 0">
          ${player.name} (HCP ${player.handicap}) · ${setLabel} · ${GAME_TYPES[round.game_type]?.label}
        </div>
        <table style="width:100%;border-collapse:collapse;font-family:sans-serif">
          <tr><td style="border:1px solid #ccc;padding:5px;background:#e8e8e8;font-weight:bold;font-size:11px">Hole</td>${holeRow}<td style="border:1px solid #ccc;padding:5px;background:#e8e8e8;font-weight:bold;text-align:center;font-size:11px">Total</td></tr>
          <tr><td style="border:1px solid #ccc;padding:5px;background:#f5f5f5;font-size:12px">Par</td>${parRow}<td style="border:1px solid #ccc;padding:5px;text-align:center;background:#f5f5f5;font-weight:bold;font-size:12px">${parTotal}</td></tr>
          <tr><td style="border:1px solid #ccc;padding:5px;font-size:12px">Score</td>${playerScores}<td style="border:1px solid #ccc;padding:5px;text-align:center;font-weight:bold;font-size:13px;color:#1a2a3a">${grossSet || "—"} (${totalLabel})</td></tr>
        </table>
      </div>`;
  };

  const html = `<!DOCTYPE html><html><head><title>Foxy Fairways Scorecard</title>
    <style>
      body{font-family:sans-serif;padding:20px;background:#fff;color:#111}
      h1{color:#1a2a3a;margin:0 0 4px}
      .subtitle{color:#666;margin:0 0 20px;font-size:13px}
      @media print{body{padding:10px}}
    </style></head><body>
    <h1>⛳ Foxy Fairways</h1>
    <p class="subtitle">${round.course_name} · ${GAME_TYPES[round.game_type]?.label} · ${new Date().toLocaleDateString("en-NZ", { day:"numeric",month:"long",year:"numeric" })} · Code ${round.code} · Created by ${round.created_by || "Unknown"}${round.use_handicap === false ? " · Scratch Play" : ""}</p>
    ${players.map((p) => buildPlayerTable(p, front9, "Front 9") + buildPlayerTable(p, back9, "Back 9")).join("")}
    <p style="font-size:10px;color:#999;margin-top:20px">foxyfairways.netlify.app</p>
    </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

// OLD image export kept for reference but replaced by PDF
async function exportScorecardPDF_OLD(round, players, scores, holes) {
  // Build HTML scorecard then print as PDF
  const front9 = holes.slice(0, 9);
  const back9 = holes.slice(9, 18);
  
  const buildRow = (player, holeSet) => {
    const cells = holeSet.map((h) => {
      const s = scores.find((sc) => sc.player_id === player.id && sc.hole_number === h.hole_number);
      const score = s ? s.score : null;
      const diff = score ? score - h.par : null;
      let bg = "#1e293b";
      if (diff !== null) {
        if (diff <= -2) bg = "#dc2626"; // eagle - red
        else if (diff === -1) bg = "#dc2626"; // birdie - red
        else if (diff === 0) bg = "#1e3a5f";
        else if (diff === 1) bg = "#7f1d1d";
        else bg = "#4c0519";
      }
      return `<td style="background:${bg};color:#fff;text-align:center;padding:6px 4px;border:1px solid #0f172a;font-weight:bold">${score || "—"}</td>`;
    }).join("");
    const gross9 = holeSet.reduce((s, h) => s + (scores.find((sc) => sc.player_id === player.id && sc.hole_number === h.hole_number)?.score || 0), 0);
    return `<tr><td style="padding:6px 10px;background:#1e293b;color:#f8fafc;font-weight:bold;border:1px solid #0f172a">${player.name} (${player.handicap})</td>${cells}<td style="padding:6px 4px;background:#022c22;color:#22c55e;text-align:center;font-weight:bold;border:1px solid #0f172a">${gross9 || "—"}</td></tr>`;
  };
  
  const buildHalfTable = (holeSet, title) => {
    const parRow = holeSet.map((h) => `<td style="padding:6px 4px;background:#0f172a;color:#64748b;text-align:center;border:1px solid #0f172a">${h.par}</td>`).join("");
    const holeRow = holeSet.map((h) => `<td style="padding:6px 4px;background:#0f172a;color:#94a3b8;text-align:center;font-weight:bold;border:1px solid #0f172a">${h.hole_number}</td>`).join("");
    const playerRows = players.map((p) => buildRow(p, holeSet)).join("");
    const totalPar = holeSet.reduce((s, h) => s + h.par, 0);
    return `
      <div style="margin-bottom:24px">
        <div style="background:#22c55e;color:#0f172a;padding:8px 16px;font-weight:800;font-size:14px;border-radius:6px 6px 0 0">${title}</div>
        <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:13px">
          <tr><td style="padding:6px 10px;background:#0f172a;color:#64748b;border:1px solid #0f172a">Hole</td>${holeRow}<td style="padding:6px 4px;background:#0f172a;color:#64748b;text-align:center;border:1px solid #0f172a">Total</td></tr>
          <tr><td style="padding:6px 10px;background:#0f172a;color:#64748b;border:1px solid #0f172a">Par</td>${parRow}<td style="padding:6px 4px;background:#0f172a;color:#64748b;text-align:center;font-weight:bold;border:1px solid #0f172a">${totalPar}</td></tr>
          ${playerRows}
        </table>
      </div>`;
  };

  const html = `<!DOCTYPE html><html><head><title>Foxy Fairways Scorecard</title>
    <style>body{background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:24px}h1{color:#22c55e;margin:0 0 4px}p{color:#64748b;margin:0 0 20px}</style>
    </head><body>
    <h1>⛳ Foxy Fairways</h1>
    <p>${round.course_name} · ${round.game_type} · ${new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })} · Round ${round.code}</p>
    ${buildHalfTable(front9, "Front 9")}
    ${buildHalfTable(back9, "Back 9")}
    </body></html>`;
  
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

function exportScorecardImage(round, players, scores, holes) {
  const canvas = document.createElement("canvas");
  const colW = 36, rowH = 32, leftW = 140, padding = 20;
  const cols = holes.length + 2; // holes + name + total
  const rows = players.length + 3; // header + par row + players + total row
  canvas.width = leftW + colW * holes.length + colW + padding * 2;
  canvas.height = rowH * (players.length + 3) + padding * 2 + 80;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 22px Inter, system-ui, sans-serif";
  ctx.fillText("⛳ Foxy Fairways", padding, padding + 22);
  ctx.fillStyle = "#64748b";
  ctx.font = "14px Inter, system-ui, sans-serif";
  ctx.fillText(round.course_name + " · " + GAME_TYPES[round.game_type]?.label, padding, padding + 44);
  ctx.fillText(new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }), padding, padding + 62);

  const tableTop = padding + 80;

  const drawCell = (text, x, y, w, h, bg, fg, bold) => {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#1e293b";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = fg;
    ctx.font = (bold ? "bold " : "") + "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(text), x + w / 2, y + h / 2);
  };

  // Header row - hole numbers
  drawCell("Player", padding, tableTop, leftW, rowH, "#1e293b", "#94a3b8", true);
  holes.forEach((h, i) => {
    drawCell(h.hole_number, padding + leftW + i * colW, tableTop, colW, rowH, "#1e293b", "#64748b", false);
  });
  drawCell("Total", padding + leftW + holes.length * colW, tableTop, colW, rowH, "#1e293b", "#94a3b8", true);

  // Par row
  drawCell("Par", padding, tableTop + rowH, leftW, rowH, "#0f172a", "#64748b", false);
  holes.forEach((h, i) => {
    drawCell(h.par, padding + leftW + i * colW, tableTop + rowH, colW, rowH, "#0f172a", "#64748b", false);
  });
  const totalPar = holes.reduce((s, h) => s + h.par, 0);
  drawCell(totalPar, padding + leftW + holes.length * colW, tableTop + rowH, colW, rowH, "#0f172a", "#64748b", true);

  // Player rows
  players.forEach((p, pi) => {
    const y = tableTop + rowH * (pi + 2);
    const bg = pi % 2 === 0 ? "#0f172a" : "#111827";
    drawCell(p.name + " (" + p.handicap + ")", padding, y, leftW, rowH, bg, "#f8fafc", true);
    let gross = 0, toPar = 0;
    holes.forEach((h, hi) => {
      const s = scores.find((sc) => sc.player_id === p.id && sc.hole_number === h.hole_number);
      const score = s ? s.score : null;
      if (score) { gross += score; toPar += score - h.par; }
      const diff = score ? score - h.par : null;
      const cx = padding + leftW + hi * colW + colW / 2;
      const cy = y + rowH / 2;
      const r = 11; // circle radius - sized to never overlap

      // Draw cell background (plain, no colour fill)
      ctx.fillStyle = bg;
      ctx.fillRect(padding + leftW + hi * colW, y, colW, rowH);
      ctx.strokeStyle = "#1e293b";
      ctx.strokeRect(padding + leftW + hi * colW, y, colW, rowH);

      if (!score) {
        // No score yet
        ctx.fillStyle = "#334155";
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("—", cx, cy);
      } else {
        // Draw shape based on gross score vs par
        // Only birdie/eagle get red fill, others get outline only
        ctx.fillStyle = bg;
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1.5;

        if (diff <= -2) {
          // Eagle - red fill, double circle
          ctx.fillStyle = "#ef4444";
          ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        } else if (diff === -1) {
          // Birdie - red fill, circle
          ctx.fillStyle = "#ef4444";
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        } else if (diff === 0) {
          // Par - outline only, no shape
        } else if (diff === 1) {
          // Bogey - square outline
          ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
        } else if (diff === 2) {
          // Double bogey - double square outline
          ctx.strokeRect(cx - r + 2, cy - r + 2, (r - 2) * 2, (r - 2) * 2);
          ctx.strokeRect(cx - r - 1, cy - r - 1, (r + 1) * 2, (r + 1) * 2);
        } else if (diff >= 3) {
          // Triple+ - triangle
          ctx.beginPath();
          ctx.moveTo(cx, cy - r);
          ctx.lineTo(cx + r, cy + r);
          ctx.lineTo(cx - r, cy + r);
          ctx.closePath();
          ctx.stroke();
        }

        ctx.lineWidth = 1;
        // Score number
        ctx.fillStyle = diff <= -1 ? "#fff" : "#e2e8f0";
        ctx.font = "bold 12px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(score), cx, cy);
      }
    });
    const totalLabel = gross > 0 ? gross + " (" + formatToPar(toPar) + ")" : "—";
    drawCell(totalLabel, padding + leftW + holes.length * colW, y, colW, rowH, bg, "#22c55e", true);
  });

  // Footer
  ctx.fillStyle = "#334155";
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("foxyfairways.netlify.app · Round " + round.code, padding, canvas.height - 8);

  // Download
  const link = document.createElement("a");
  link.download = "scorecard-" + round.code + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// =============================================================================
// HOME SCREEN
// =============================================================================
function HomeScreen({ onCreateRound, onJoinRound, onAdminLogin, onRejoin, lastRound, savedRounds, onViewHistory, onViewTournaments }) {
  const [showShare, setShowShare] = useState(false);
  const link = window.location.origin + window.location.pathname;

  return (
    <div style={S.screen}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 56, paddingBottom: 28 }}>
        <img src="/logo.png" alt="Foxy Fairways"
          style={{ width: 110, height: 110, borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", marginBottom: 18 }}
          onError={(e) => { e.target.style.display = "none"; }} />
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0, color: "#f8fafc", letterSpacing: "-0.5px" }}>Foxy Fairways</h1>
        <p style={{ fontSize: 14, color: "#475569", margin: "6px 0 0" }}>Live scoring for your round</p>

      </div>
      <div style={{ flex: 1, padding: "0 24px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        {lastRound && (() => {
          const t = new Date(lastRound.savedAt).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
          return (
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Last Round</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lastRound.round.course_name}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>{lastRound.me.name} · {GAME_TYPES[lastRound.round.game_type]?.label}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{t}</div>
              </div>
              <button onClick={onRejoin} style={{ backgroundColor: "#022c22", color: "#22c55e", border: "1px solid #22c55e", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>Rejoin</button>
            </div>
          );
        })()}
        <div style={{ height: 1, backgroundColor: "#1e293b" }} />
        <button style={S.btnPrimary} onClick={onCreateRound}>Create a Round</button>
        <button style={{ ...S.btnSecondary, marginTop: 0, backgroundColor: "#1e293b", border: "1px solid #334155" }} onClick={onJoinRound}>Join a Round</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onViewHistory} style={{ flex: 1, backgroundColor: "transparent", color: "#64748b", border: "1px solid #1e293b", borderRadius: 12, padding: "13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Past Rounds{savedRounds.length > 0 ? " (" + savedRounds.length + ")" : ""}
          </button>
          <button onClick={onViewTournaments} style={{ flex: 1, backgroundColor: "transparent", color: "#64748b", border: "1px solid #1e293b", borderRadius: 12, padding: "13px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            🏆 Tournaments
          </button>
        </div>
        <button onClick={() => setShowShare(true)} style={{ backgroundColor: "transparent", color: "#64748b", border: "1px solid #1e293b", borderRadius: 12, padding: "13px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", fontFamily: "inherit" }}>Share App</button>

        <button style={{ background: "none", border: "none", color: "#334155", fontSize: 12, cursor: "pointer", padding: "8px 0 0", fontFamily: "inherit", textAlign: "center" }} onClick={onAdminLogin}>Admin</button>
      </div>

      {showShare && (
        <div style={S.modal}><div style={S.modalContent}>
          <h3 style={S.modalTitle}>Share with your mates</h3>
          <p style={S.modalHint}>Send them this link so they can join rounds</p>
          <div style={S.urlBox}>{link}</div>
          <button style={S.btnPrimary} onClick={() => { navigator.clipboard.writeText(link); alert("Copied!"); }}>Copy Link</button>
          <button style={S.btnSecondary} onClick={() => setShowShare(false)}>Close</button>
        </div></div>
      )}
    </div>
  );
}

// =============================================================================
// ADMIN
// =============================================================================
function AdminLoginScreen({ onBack, onLoginSuccess }) { // onLoginSuccess("super"|"regular")
  const [code, setCode] = useState(""), [err, setErr] = useState("");
  const login = () => {
    if (code === SUPER_ADMIN_CODE) { localStorage.setItem("ff_admin", "super"); onLoginSuccess("super"); }
    else if (code === ADMIN_CODE) { localStorage.setItem("ff_admin", "1"); onLoginSuccess("regular"); }
    else { setErr("Wrong code"); setCode(""); }
  };
  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>Admin Login</h2><div />
      </div>
      <div style={S.content}><div style={S.stepWrap}>
        <h3 style={S.stepTitle}>Enter admin code</h3>
        <input style={S.input} type="password" placeholder="••••••" value={code}
          onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
        {err && <p style={S.error}>{err}</p>}
        <button style={S.btnPrimary} onClick={login}>Login</button>
      </div></div>
    </div>
  );
}


// =============================================================================
// COURSE SEARCH COMPONENT (uses free golf course API)
// =============================================================================
function CourseSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults([]);
    try {
      // Using Golf Course API (free tier) - searches by name
      const res = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`, {
        headers: { "Authorization": "Key " + "free_public" }
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setResults((data.courses || []).slice(0, 8));
    } catch {
      // Fallback: show a message that manual entry is needed
      setResults([{ id: "manual", name: "Course not found - add manually below", manual: true }]);
    }
    setLoading(false);
  };

  const selectCourse = (course) => {
    if (course.manual) return;
    // Build hole data from API response
    const holes = (course.holes || Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      par: course.par_total ? Math.round(course.par_total / 18) : 4,
      stroke_index: i + 1,
    }))).map((h, i) => ({
      hole_number: h.hole_number || i + 1,
      par: h.par || 4,
      stroke_index: h.handicap || h.stroke_index || (i + 1),
    }));
    
    const courseObj = {
      id: genId(),
      name: course.course_name || course.name,
      par: course.par_total || holes.reduce((s, h) => s + h.par, 0),
      holes,
      location: [course.location?.city, course.location?.state, course.location?.country].filter(Boolean).join(", "),
    };
    onSelect(courseObj);
    setResults([]); setQuery(""); setPreview(null);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input style={{ ...{backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", color: "#f8fafc", fontSize: 16, outline: "none", flex: 1, fontFamily: "inherit"} }}
          placeholder="Search course name..." value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()} />
        <button onClick={search} disabled={loading}
          style={{ backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {loading ? "..." : "Search"}
        </button>
      </div>
      
      {results.map((course) => (
        <div key={course.id} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: course.manual ? "#475569" : "#f8fafc" }}>{course.course_name || course.name}</div>
              {!course.manual && (
                <>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {[course.location?.city, course.location?.state, course.location?.country].filter(Boolean).join(", ")}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    Par {course.par_total || "—"} · Rating {course.rating || "—"} · Slope {course.slope || "—"}
                  </div>
                </>
              )}
            </div>
            {!course.manual && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => setPreview(preview?.id === course.id ? null : course)}
                  style={{ backgroundColor: "#0f172a", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  {preview?.id === course.id ? "Hide" : "Preview"}
                </button>
                <button onClick={() => selectCourse(course)}
                  style={{ backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Add
                </button>
              </div>
            )}
          </div>
          
          {/* Scorecard preview */}
          {preview?.id === course.id && course.holes && (
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <div style={{ display: "flex", gap: 4, paddingBottom: 4 }}>
                {course.holes.map((h, i) => (
                  <div key={i} style={{ minWidth: 36, textAlign: "center", backgroundColor: "#0f172a", borderRadius: 6, padding: "4px 2px" }}>
                    <div style={{ fontSize: 9, color: "#475569" }}>H{h.hole_number || i + 1}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>P{h.par}</div>
                    <div style={{ fontSize: 9, color: "#334155" }}>{h.handicap || h.stroke_index || i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminDashboardScreen({ onLogout }) {
  const [courses, setCourses] = useState([]);
  const [newName, setNewName] = useState(""), [editing, setEditing] = useState(null), [holes, setHoles] = useState([]);
  const [saving, setSaving] = useState(false), [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      await dbSeedCourses();
      const c = await dbGetCourses();
      setCourses(c.length > 0 ? c : DEFAULT_COURSES);
    })();
  }, []);

  const startNew = () => {
    const c = { id: genId(), name: newName, par: 72, holes: Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: "", stroke_index: "" })) };
    setEditing(c); setHoles(c.holes); setNewName("");
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const final = { ...editing, holes };
      await dbSaveCourse(final);
      const updated = [...courses];
      const idx = updated.findIndex((c) => c.id === final.id);
      if (idx >= 0) updated[idx] = final; else updated.push(final);
      setCourses(updated);
      setMsg("Course saved successfully!");
      setTimeout(() => setMsg(""), 3000);
      setEditing(null); setHoles([]);
    } catch { setMsg("Save failed. Try again."); }
    setSaving(false);
  };

  const updateHole = (i, field, val) => { const h = [...holes]; h[i] = { ...h[i], [field]: parseInt(val) || 0 }; setHoles(h); };

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onLogout}>← Logout</button>
        <h2 style={S.headerTitle}>Admin Panel</h2>
        <div style={S.adminBadge}>ADMIN</div>
      </div>
      <div style={S.content}>
        {msg && <div style={{ backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#22c55e", fontSize: 14 }}>{msg}</div>}
        {!editing ? (
          <div>
            <h3 style={S.stepTitle}>Golf Courses</h3>
            {courses.map((c) => (
              <div key={c.id} style={S.courseItem}>
                <div><div style={S.courseName}>{c.name}</div><div style={S.courseAddr}>18 holes</div></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={S.smallBtn} onClick={() => { setEditing(c); setHoles(c.holes || []); }}>Edit</button>
                  <button style={{ ...S.smallBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={async () => {
                    if (window.confirm("Delete " + c.name + "? This cannot be undone.")) {
                      try {
                        await dbDeleteCourse(c.id);
                        markCourseDeleted(c.id);
                        setCourses((prev) => prev.filter((x) => x.id !== c.id));
                        setMsg("Course deleted.");
                        setTimeout(() => setMsg(""), 2000);
                      } catch { setMsg("Delete failed."); }
                    }
                  }}>Delete</button>
                </div>
              </div>
            ))}
            <div style={{ ...S.stepWrap, marginTop: 24 }}>
              <h4 style={S.stepTitle}>Add New Course</h4>
              <label style={S.label}>Search for a course</label>
              <CourseSearch onSelect={(course) => { setEditing(course); setHoles(course.holes || []); }} />
              <div style={{ textAlign: "center", color: "#475569", fontSize: 13, margin: "8px 0" }}>or add manually</div>
              <input style={S.input} placeholder="Course name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <button style={newName ? S.btnPrimary : S.btnDisabled} disabled={!newName} onClick={startNew}>Create Course Manually</button>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={S.stepTitle}>{editing.name}</h3>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              {/* Front 9 */}
              <div style={{ flex: 1, backgroundColor: "#0f172a", border: "2px solid #334155", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, textAlign: "center" }}>Front 9</div>
                {holes.slice(0, 9).map((hole, idx) => (
                  <div key={hole.hole_number} style={{ ...S.holeEdit, marginBottom: 8 }}>
                    <div style={S.holeEditNum}>Hole {hole.hole_number}</div>
                    <div style={S.holeEditRow}>
                      <div><label style={S.smallLabel}>Par</label><input style={S.smallInput} type="number" min="3" max="6" value={hole.par} onChange={(e) => updateHole(idx, "par", e.target.value)} /></div>
                      <div><label style={S.smallLabel}>SI</label><input style={S.smallInput} type="number" min="1" max="18" value={hole.stroke_index} onChange={(e) => updateHole(idx, "stroke_index", e.target.value)} /></div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Back 9 */}
              <div style={{ flex: 1, backgroundColor: "#0f172a", border: "2px solid #334155", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, textAlign: "center" }}>Back 9</div>
                {holes.slice(9, 18).map((hole, idx) => (
                  <div key={hole.hole_number} style={{ ...S.holeEdit, marginBottom: 8 }}>
                    <div style={S.holeEditNum}>Hole {hole.hole_number}</div>
                    <div style={S.holeEditRow}>
                      <div><label style={S.smallLabel}>Par</label><input style={S.smallInput} type="number" min="3" max="6" value={hole.par} onChange={(e) => updateHole(idx + 9, "par", e.target.value)} /></div>
                      <div><label style={S.smallLabel}>SI</label><input style={S.smallInput} type="number" min="1" max="18" value={hole.stroke_index} onChange={(e) => updateHole(idx + 9, "stroke_index", e.target.value)} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.courseActions}>
              <button style={S.btnPrimary} disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Course"}</button>
              <button style={S.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// =============================================================================
// SUPER ADMIN SCREEN
// =============================================================================
function SuperAdminScreen({ onLogout }) {
  const [tab, setTab] = useState("rounds");
  const [rounds, setRounds] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [blockName, setBlockName] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [r, b] = await Promise.all([dbGetAllRounds(), dbGetBlockedPlayers()]);
      setRounds(r); setBlocked(b); setLoading(false);
    })();
  }, []);

  const handleDeleteRound = async (r) => {
    if (!window.confirm("Delete round " + r.code + " at " + r.course_name + "? Cannot be undone.")) return;
    await dbDeleteRound(r.id);
    // Blacklist so it doesn't reappear
    try { const ids = JSON.parse(localStorage.getItem("ff_deleted_rounds") || "[]"); localStorage.setItem("ff_deleted_rounds", JSON.stringify([...ids, r.id])); } catch {}
    setRounds((prev) => prev.filter((x) => x.id !== r.id));
    setMsg("Round deleted."); setTimeout(() => setMsg(""), 2000);
  };

  const handleBlock = async () => {
    if (!blockName.trim()) return;
    await dbBlockPlayer(blockName.trim());
    const b = await dbGetBlockedPlayers();
    setBlocked(b); setBlockName("");
    setMsg(blockName + " blocked."); setTimeout(() => setMsg(""), 2000);
  };

  const handleUnblock = async (b) => {
    await dbUnblockPlayer(b.id);
    setBlocked((prev) => prev.filter((x) => x.id !== b.id));
    setMsg(b.name + " unblocked."); setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onLogout}>← Logout</button>
        <h2 style={S.headerTitle}>Super Admin</h2>
        <div style={{ ...S.adminBadge, backgroundColor: "#ef4444" }}>SUPER</div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
        {["rounds", "blocked", "stats"].map((t) => (
          <button key={t} style={{ flex: 1, padding: "12px 0", background: "none", border: "none", color: tab === t ? "#22c55e" : "#64748b", fontWeight: tab === t ? 700 : 400, fontSize: 13, cursor: "pointer", borderBottom: tab === t ? "2px solid #22c55e" : "none", fontFamily: "inherit", textTransform: "capitalize" }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div style={S.content}>
        {msg && <div style={{ backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#22c55e", fontSize: 13 }}>{msg}</div>}
        {loading ? <div style={S.empty}>Loading...</div> : null}

        {tab === "rounds" && !loading && (
          <div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{rounds.length} total rounds</div>
            {rounds.map((r) => (
              <div key={r.id} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>{r.course_name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{r.code} · {GAME_TYPES[r.game_type]?.label} · {new Date(r.created_at).toLocaleDateString("en-NZ")}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button style={{ ...S.smallBtn, color: "#22c55e", borderColor: "#22c55e" }} onClick={() => { navigator.clipboard.writeText(window.location.origin + "?join=" + r.code); setMsg("Join link copied for " + r.code); setTimeout(() => setMsg(""), 2000); }}>Share</button>
                    <button style={{ ...S.smallBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => handleDeleteRound(r)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "blocked" && !loading && (
          <div>
            <h3 style={S.stepTitle}>Blocked Players</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Player name to block" value={blockName} onChange={(e) => setBlockName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleBlock()} />
              <button style={{ ...S.lbBtn, padding: "0 16px", borderRadius: 12, flexShrink: 0 }} onClick={handleBlock}>Block</button>
            </div>
            {blocked.length === 0 ? <div style={S.empty}>No blocked players.</div> : blocked.map((b) => (
              <div key={b.id} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, color: "#f8fafc" }}>{b.name}</div>
                <button style={{ ...S.smallBtn, color: "#22c55e", borderColor: "#22c55e" }} onClick={() => handleUnblock(b)}>Unblock</button>
              </div>
            ))}
          </div>
        )}

        {tab === "stats" && !loading && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Rounds", value: rounds.length },
                { label: "Blocked Players", value: blocked.length },
                { label: "This Month", value: rounds.filter((r) => new Date(r.created_at).getMonth() === new Date().getMonth()).length },
                { label: "Most Popular", value: rounds.reduce((acc, r) => { acc[r.course_name] = (acc[r.course_name] || 0) + 1; return acc; }, {}) && Object.entries(rounds.reduce((acc, r) => { acc[r.course_name] = (acc[r.course_name] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0]?.split(" ")[0] || "—" },
              ].map((s) => (
                <div key={s.label} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "14px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{s.value}</div>
                </div>
              ))}
            </div>
            <h3 style={S.stepTitle}>Game Types</h3>
            {Object.entries(rounds.reduce((acc, r) => { acc[r.game_type] = (acc[r.game_type] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
                <div style={{ fontSize: 14, color: "#f8fafc" }}>{GAME_TYPES[type]?.label || type}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>{count} rounds</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CHAT PANEL (used inside ScorecardScreen)
// =============================================================================
function ChatPanel({ round, me, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const QUICK_REACTIONS = ["⛳", "🎉", "👏", "🔥", "😬", "🍺"];

  const load = useCallback(async () => {
    const msgs = await dbGetChat(round.id);
    setMessages(msgs);
  }, [round.id]);

  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t); }, [load]);
  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }, [messages]);

  const send = async (text) => {
    if (!text.trim()) return;
    const msg = { id: genId(), round_id: round.id, player_id: me.id, player_name: me.name, text: text.trim(), created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, msg]);
    setInput("");
    await dbSendChat(msg);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const timeStr = (iso) => { const d = new Date(iso); return d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0"); };
  const isEmoji = (text) => /^[\p{Emoji}\s]+$/u.test(text.trim());

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, display: "flex", flexDirection: "column", maxHeight: "75vh", border: "1px solid #334155" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>Round Chat</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Cromwell · {round.code}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          {messages.length === 0 && <div style={{ textAlign: "center", color: "#475569", paddingTop: 20, fontSize: 13 }}>No messages yet. Say something!</div>}
          {messages.map((msg) => {
            const isMe = msg.player_id === me.id;
            const emoji = isEmoji(msg.text);
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, marginBottom: 2, marginLeft: 4 }}>{msg.player_name}</div>}
                <div style={{ backgroundColor: isMe ? "#22c55e" : "#0f172a", color: isMe ? "#0f172a" : "#f8fafc", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: emoji ? "4px 8px" : "10px 14px", fontSize: emoji ? 28 : 14, fontWeight: isMe ? 600 : 400, maxWidth: "75%", border: isMe ? "none" : "1px solid #334155" }}>
                  {msg.text}
                </div>
                <div style={{ fontSize: 9, color: "#475569", marginTop: 2, marginLeft: 4, marginRight: 4 }}>{timeStr(msg.created_at)}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {/* Quick reactions */}
        <div style={{ display: "flex", gap: 6, padding: "8px 16px", borderTop: "1px solid #334155", flexShrink: 0 }}>
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} onClick={() => send(emoji)} style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 0", fontSize: 18, cursor: "pointer" }}>{emoji}</button>
          ))}
        </div>
        {/* Input */}
        <div style={{ display: "flex", gap: 8, padding: "8px 16px 32px", flexShrink: 0 }}>
          <input style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 20, padding: "10px 16px", color: "#f8fafc", fontSize: 14, outline: "none", fontFamily: "inherit" }}
            placeholder="Message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} />
          <button onClick={() => send(input)} style={{ backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 20, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ROUND COMPLETE SCREEN
// =============================================================================
function RoundCompleteScreen({ round, players, scores, onSave, onDismiss }) {
  const holes = round.holes || [];
  let lb = [];
  try { lb = calcLeaderboard(players, scores, holes, round.game_type); } catch(e) { lb = []; }
  const winner = lb[0];

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ backgroundColor: "#1e293b", borderRadius: 20, padding: 28, width: "100%", border: "1px solid #334155", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b", margin: "0 0 4px" }}>Round Complete!</h2>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 20px" }}>{round.course_name} · {GAME_TYPES[round.game_type]?.label}</p>

        {winner && (
          <div style={{ backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 12, padding: "16px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Winner</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#f8fafc" }}>{winner.name}</div>
            <div style={{ fontSize: 16, color: "#22c55e", fontWeight: 700, marginTop: 4 }}>
              {round.game_type === "stableford" ? winner.total + " pts"
                : round.game_type === "banker" ? "$" + winner.total
                : round.game_type === "matchplay" ? (winner.total === 0 ? "All Sq" : winner.total > 0 ? Math.floor(winner.total) + " Up" : Math.abs(Math.floor(winner.total)) + " Dn")
                : formatToPar(winner.toPar) + " (" + winner.grossTotal + " gross)"}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          {lb.slice(1).map((p, i) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
              <div style={{ fontSize: 14, color: "#94a3b8" }}>{i + 2}. {p.name}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>
                {round.game_type === "stableford" ? p.total + " pts" : round.game_type === "banker" ? (p.total >= 0 ? "+$" : "-$") + Math.abs(p.total) : formatToPar(p.toPar)}
              </div>
            </div>
          ))}
        </div>

        <button style={S.btnPrimary} onClick={onSave}>Save Round</button>
        <button style={S.btnSecondary} onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

// =============================================================================
// TOURNAMENT SCREEN
// =============================================================================
function TournamentScreen({ onBack }) {
  const [tournaments, setTournaments] = useState(getTournaments());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [viewing, setViewing] = useState(null);

  const create = () => {
    if (!newName.trim()) return;
    const t = { id: genId(), name: newName.trim(), createdAt: Date.now(), rounds: [] };
    saveTournament(t);
    setTournaments(getTournaments());
    setNewName(""); setCreating(false);
  };

  if (viewing) {
    const lb = {};
    viewing.rounds.forEach((r) => {
      r.players?.forEach((p) => {
        if (!lb[p.name]) lb[p.name] = { name: p.name, handicap: p.handicap, rounds: 0, totalToPar: 0, totalGross: 0, totalPoints: 0 };
        lb[p.name].rounds++;
        const calc = calcLeaderboard(r.players, r.scores, r.holes, r.game_type);
        const pData = calc.find((x) => x.name === p.name);
        if (pData) { lb[p.name].totalToPar += pData.toPar || 0; lb[p.name].totalGross += pData.grossTotal || 0; lb[p.name].totalPoints += pData.total || 0; }
      });
    });
    const sorted = Object.values(lb).sort((a, b) => a.totalToPar - b.totalToPar);

    return (
      <div style={S.screen}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => setViewing(null)}>← Back</button>
          <h2 style={S.headerTitle}>{viewing.name}</h2>
          <div style={{ fontSize: 12, color: "#64748b" }}>{viewing.rounds.length} rounds</div>
        </div>
        <div style={S.content}>
          <h3 style={S.stepTitle}>Season Leaderboard</h3>
          {sorted.length === 0 ? <div style={S.empty}>No rounds saved to this tournament yet.</div> : sorted.map((p, i) => (
            <div key={p.name} style={{ ...S.lbRow, ...(i === 0 ? { backgroundColor: "#022c22", borderRadius: 10, padding: "14px 12px", margin: "0 -12px" } : {}) }}>
              <div style={{ ...S.lbPos, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>{i + 1}</div>
              <div style={S.lbName}>{p.name}<span style={S.lbHcp}>HCP {p.handicap}</span></div>
              <div style={S.lbRight}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{formatToPar(p.totalToPar)}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{p.rounds} rounds</div>
              </div>
            </div>
          ))}

          <h3 style={{ ...S.stepTitle, marginTop: 24 }}>Rounds</h3>
          {viewing.rounds.map((r) => (
            <div key={r.id} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>{r.course_name}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{r.date} · {GAME_TYPES[r.game_type]?.label} · {r.players?.length || 0} players</div>
              {r.createdBy && <div style={{ fontSize: 11, color: "#475569" }}>Created by {r.createdBy}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>Tournaments</h2>
        <button style={S.lbBtn} onClick={() => setCreating(true)}>+ New</button>
      </div>
      <div style={S.content}>
        {creating && (
          <div style={{ ...S.stepWrap, marginBottom: 24 }}>
            <h3 style={S.stepTitle}>New Tournament</h3>
            <input style={S.input} placeholder="e.g. Summer Series 2026" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
            <button style={newName ? S.btnPrimary : S.btnDisabled} disabled={!newName} onClick={create}>Create Tournament</button>
            <button style={S.btnSecondary} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        )}
        {tournaments.length === 0 && !creating ? (
          <div style={S.empty}>No tournaments yet. Create one to track a season!</div>
        ) : (
          tournaments.map((t) => (
            <button key={t.id} style={{ ...S.courseCard, marginBottom: 8, width: "100%" }} onClick={() => setViewing(t)}>
              <span style={S.courseIcon}>🏆</span>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={S.courseName}>{t.name}</div>
                <div style={S.courseAddr}>{t.rounds?.length || 0} rounds · Started {new Date(t.createdAt).toLocaleDateString("en-NZ")}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SHARE MODAL WITH QR CODE
// =============================================================================
function ShareModal({ round, onClose }) {
  const joinUrl = window.location.origin + window.location.pathname + "?join=" + round.code;
  return (
    <div style={S.modal}>
      <div style={S.modalContent}>
        <h3 style={S.modalTitle}>Invite Players</h3>
        <p style={S.modalHint}>Scan the QR code or share the link</p>

        {/* QR Code */}
        <div style={{ display: "flex", justifyContent: "center", backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <QRCodeSVG value={joinUrl} size={180} bgColor="#ffffff" fgColor="#0f172a" />
        </div>

        <p style={S.modalHint}>Or share the round code</p>
        <div style={S.codeDisplay}>{round.code}</div>
        <button style={S.btnPrimary} onClick={() => { navigator.clipboard.writeText(round.code); alert("Code copied!"); }}>Copy Code</button>
        <p style={{ ...S.modalHint, marginTop: 16 }}>Or the full link</p>
        <div style={S.urlBox}>{joinUrl}</div>
        <button style={S.btnSecondary} onClick={() => { navigator.clipboard.writeText(joinUrl); alert("Link copied!"); }}>Copy Link</button>
        <button style={S.btnSecondary} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// =============================================================================
// CREATE ROUND
// =============================================================================
function CreateRoundScreen({ onBack, onRoundCreated }) {
  const profile = getPlayerProfile();
  const [step, setStep] = useState(1), [courses, setCourses] = useState(DEFAULT_COURSES);
  const [course, setCourse] = useState(null), [gameType, setGameType] = useState("stroke");
  const [name, setName] = useState(profile.name || ""), [hcp, setHcp] = useState(profile.handicap || ""), [team, setTeam] = useState("A");
  const [selectedTournament, setSelectedTournament] = useState("");
  const [useHandicap, setUseHandicap] = useState(true);
  const [loading, setLoading] = useState(false), [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      await dbSeedCourses();
      const c = await dbGetCourses();
      if (c.length > 0) setCourses(c);
    })();
  }, []);

  const create = async () => {
    if (!course || !name) return;
    setLoading(true); setErr("");
    try {
      const code = Math.random().toString(36).substr(2, 6).toUpperCase();
      const round = await dbCreateRound({ code, course_name: course.name, course_id: course.id, game_type: gameType, holes: course.holes, use_handicap: useHandicap, created_at: new Date().toISOString(), created_by: name });
      const me = await dbCreatePlayer({ name, handicap: useHandicap ? (parseFloat(hcp) || 0) : 0, round_id: round.id, team: gameType === "matchplay_teams" ? team : null, is_placeholder: false });
      savePlayerProfile(name, parseFloat(hcp) || 0);
      const fullRound = { ...round, holes: course.holes };
      saveLastRound(fullRound, me);
      if (selectedTournament) {
        addRoundToTournament(selectedTournament, { id: round.id, code: round.code, course_name: round.course_name, game_type: round.game_type, holes: course.holes, players: [], scores: [], date: new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) });
      }
      onRoundCreated(fullRound, me);
    } catch (e) { console.error(e); setErr("Could not create round. Please check your connection."); }
    setLoading(false);
  };

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>New Round</h2><div />
      </div>
      <div style={S.content}>
        {step === 1 && (
          <div style={S.stepWrap}>
            <h3 style={S.stepTitle}>Where are you playing?</h3>
            <div style={S.courseList}>
              {courses.map((c) => (
                <button key={c.id} style={{ ...S.courseCard, ...(course?.id === c.id ? S.courseCardSelected : {}) }} onClick={() => setCourse(c)}>
                  <span style={S.courseIcon}>⛳</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.courseName}>{c.name}</div>
                    <div style={S.courseAddr}>18 holes · Par {c.par || (c.holes ? c.holes.reduce((s, h) => s + (h.par || 0), 0) : "—")}</div>
                  </div>
                </button>
              ))}
            </div>
            <button style={course ? S.btnPrimary : S.btnDisabled} disabled={!course} onClick={() => setStep(2)}>Next</button>
          </div>
        )}
        {step === 2 && (
          <div style={S.stepWrap}>
            <h3 style={S.stepTitle}>What game are you playing?</h3>
            <div style={S.gameList}>
              {Object.entries(GAME_TYPES).map(([key, g]) => (
                <button key={key} style={{ ...S.gameCard, ...(gameType === key ? S.gameCardSelected : {}) }} onClick={() => setGameType(key)}>
                  <div style={S.gameName}>{g.label}</div><div style={S.gameDesc}>{g.description}</div>
                </button>
              ))}
            </div>
            <button style={S.btnPrimary} onClick={() => setStep(3)}>Next</button>
          </div>
        )}
        {step === 3 && (
          <div style={S.stepWrap}>
            <h3 style={S.stepTitle}>Your details</h3>
            <label style={S.label}>Your name</label>
            <input style={S.input} placeholder="e.g. Jamie" value={name} onChange={(e) => setName(e.target.value)} />
            {useHandicap && <label style={S.label}>Your handicap</label>}
            {useHandicap && <input style={S.input} type="number" step="0.1" placeholder="0" value={hcp} onChange={(e) => setHcp(e.target.value)} />}
            {useHandicap && <p style={S.hint}>Decimals OK e.g. 9.2</p>}
            <label style={S.label}>Handicap scoring</label>
            <div style={{ display: "flex", backgroundColor: "#1e293b", borderRadius: 10, padding: 4, gap: 4 }}>
              <button onClick={() => setUseHandicap(true)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, backgroundColor: useHandicap ? "#22c55e" : "transparent", color: useHandicap ? "#0f172a" : "#64748b" }}>Apply Handicaps</button>
              <button onClick={() => setUseHandicap(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, backgroundColor: !useHandicap ? "#f59e0b" : "transparent", color: !useHandicap ? "#0f172a" : "#64748b" }}>Scratch</button>
            </div>
            {gameType === "matchplay_teams" && (<>
              <label style={S.label}>Your team</label>
              <select style={S.input} value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="A">Team A</option><option value="B">Team B</option>
              </select>
            </>)}
            {(() => {
              const tournaments = getTournaments();
              if (tournaments.length === 0) return null;
              return (<>
                <label style={S.label}>Link to Tournament (optional)</label>
                <select style={S.input} value={selectedTournament} onChange={(e) => setSelectedTournament(e.target.value)}>
                  <option value="">No tournament</option>
                  {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </>);
            })()}
            {err && <p style={S.error}>{err}</p>}
            {(() => {
              const tournaments = getTournaments();
              return tournaments.length > 0 ? (
                <>
                  <label style={S.label}>Link to tournament (optional)</label>
                  <select style={S.input} value={selectedTournament} onChange={(e) => setSelectedTournament(e.target.value)}>
                    <option value="">No tournament</option>
                    {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </>
              ) : null;
            })()}
            <button style={name ? S.btnPrimary : S.btnDisabled} disabled={!name || loading} onClick={create}>{loading ? "Creating..." : "Create Round"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// JOIN ROUND
// =============================================================================
function JoinRoundScreen({ onBack, onJoined, prefillCode }) {
  const profile2 = getPlayerProfile();
  const [code, setCode] = useState(prefillCode || ""), [name, setName] = useState(profile2.name || ""), [hcp, setHcp] = useState(profile2.handicap || ""), [team, setTeam] = useState("A");
  const [step, setStep] = useState(prefillCode ? 0 : 1), [round, setRound] = useState(null), [err, setErr] = useState(""), [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillCode) {
      (async () => {
        setLoading(true);
        try { setRound(await dbGetRound(prefillCode)); setStep(2); }
        catch { setErr("Round not found."); setStep(1); }
        setLoading(false);
      })();
    }
  }, [prefillCode]);

  const findRound = async () => {
    setLoading(true); setErr("");
    try { setRound(await dbGetRound(code)); setStep(2); }
    catch { setErr("Round not found. Check the code and try again."); }
    setLoading(false);
  };

  const join = async () => {
    if (!name) return;
    setLoading(true); setErr("");
    try {
      const blocked = await dbIsPlayerBlocked(name);
      if (blocked) { setErr("This name has been blocked. Please contact the organiser."); setLoading(false); return; }
      const existing = await dbFindPlayerByName(round.id, name);
      const me = existing || await dbCreatePlayer({ name, handicap: round.use_handicap === false ? 0 : (parseFloat(hcp) || 0), round_id: round.id, team: round.game_type === "matchplay_teams" ? team : null, is_placeholder: false });
      savePlayerProfile(name, parseFloat(hcp) || 0);
      const fullRound = { ...round, holes: getHolesForRound(round) };
      saveLastRound(fullRound, me);
      onJoined(fullRound, me);
    } catch (e) { console.error(e); setErr("Failed to join. Please try again."); }
    setLoading(false);
  };

  if (loading && step === 0) return <div style={S.screen}><div style={S.content}><div style={S.empty}>Loading round...</div></div></div>;

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>Join a Round</h2><div />
      </div>
      <div style={S.content}>
        {step === 1 && (
          <div style={S.stepWrap}>
            <h3 style={S.stepTitle}>Enter your round code</h3>
            <input style={{ ...S.input, ...S.codeInput }} placeholder="ABC123" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} />
            {err && <p style={S.error}>{err}</p>}
            <button style={code.length >= 4 ? S.btnPrimary : S.btnDisabled} disabled={code.length < 4 || loading} onClick={findRound}>{loading ? "Searching..." : "Find Round"}</button>
          </div>
        )}
        {step === 2 && round && (
          <div style={S.stepWrap}>
            <div style={S.roundInfo}>
              <span style={S.courseIcon}>⛳</span>
              <div><div style={S.courseName}>{round.course_name}</div><div style={S.courseAddr}>{GAME_TYPES[round.game_type]?.label}</div></div>
            </div>
            <h3 style={S.stepTitle}>Your details</h3>
            <p style={S.hint}>Already in this round? Enter the same name to rejoin your scores.</p>
            <label style={S.label}>Your name</label>
            <input style={S.input} placeholder="e.g. Chris" value={name} onChange={(e) => setName(e.target.value)} />
            {round.use_handicap !== false && <label style={S.label}>Your handicap</label>}
            {round.use_handicap !== false && <input style={S.input} type="number" placeholder="0" value={hcp} onChange={(e) => setHcp(e.target.value)} />}
            {round.use_handicap === false && <p style={{ ...S.hint, color: "#f59e0b" }}>This is a scratch round - no handicaps applied</p>}
            {round.game_type === "matchplay_teams" && (<>
              <label style={S.label}>Your team</label>
              <select style={S.input} value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="A">Team A</option><option value="B">Team B</option>
              </select>
            </>)}
            {err && <p style={S.error}>{err}</p>}
            <button style={name ? S.btnPrimary : S.btnDisabled} disabled={!name || loading} onClick={join}>{loading ? "Joining..." : "Join Round"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PLAYER DASHBOARD
// =============================================================================
function PlayerDashboardScreen({ round, me, onViewScorecard, onBack }) {
  const [players, setPlayers] = useState([]), [scores, setScores] = useState([]), [showShare, setShowShare] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const completeDismissedRef = useRef(false);
  const holes = round.holes || [];

  const refresh = useCallback(async () => {
    const [p, s] = await Promise.all([dbGetPlayers(round.id), dbGetScores(round.id)]);
    setPlayers(p); setScores(s);
    // Check if all players have completed all 18 holes
    if (p.length > 0 && s.length > 0) {
      const allDone = p.every((pl) => holes.filter((h) => s.some((sc) => sc.player_id === pl.id && sc.hole_number === h.hole_number)).length === holes.length);
      if (allDone && !completeDismissedRef.current) setShowComplete(true);
    }
  }, [round.id, holes]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t); }, [refresh]);

  let lb = [];
  try { lb = calcLeaderboard(players, scores, holes, round.game_type); } catch(e) { lb = []; }

  return (
    <div style={S.screen}>
      <div style={{ backgroundColor: "#1e293b", borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 8px" }}>
          <button style={S.backBtn} onClick={() => { if (window.confirm("Exit round? It stays saved.")) onBack(); }}>← Back</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{round.course_name}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{GAME_TYPES[round.game_type]?.label}{round.use_handicap === false ? " · Scratch" : ""} · {me?.name} (HCP {me?.handicap})</div>
          </div>
          <button onClick={() => setShowShare(true)} style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 10px", fontFamily: "inherit", flexShrink: 0 }}>🔗</button>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "0 16px 10px" }}>
          <button style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 4px", fontFamily: "inherit" }} onClick={() => { saveRoundToHistory(round, players, scores, holes); alert("Round saved!"); }}>💾 Save Round</button>
          <button style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 4px", fontFamily: "inherit" }} onClick={() => exportScorecardPDF(round, players, scores, holes)}>📄 Scorecard</button>
        </div>
      </div>

      <div style={S.content}>
        <div style={{ textAlign: "center", marginBottom: 20, padding: 16, backgroundColor: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>
          <div style={{ display: "inline-block", backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <QRCodeSVG value={window.location.origin + window.location.pathname + "?join=" + round.code} size={100} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Scan to join · Code: <span style={{ color: "#22c55e", fontWeight: 700, letterSpacing: 2 }}>{round.code}</span></div>
        </div>
        <button style={{ ...S.btnPrimary, marginBottom: 16, fontSize: 17 }} onClick={onViewScorecard}>
          ⛳ Live Scoring
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ ...S.stepTitle, margin: 0 }}>Leaderboard</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 11, color: "#475569" }}>Live</span>
          </div>
        </div>
        {lb.length === 0 ? <div style={S.empty}>Waiting for players...</div>
        : round.game_type === "matchplay_teams" ? (
          ["A", "B"].map((tl) => {
            const tp = lb.filter((p) => p.team === tl), tt = tp[0]?.total || 0;
            return (
              <div key={"t" + tl} style={{ marginBottom: 20 }}>
                <div style={{ ...S.lbRow, backgroundColor: tl === "A" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: tl === "A" ? "#22c55e" : "#3b82f6", width: 40 }}>Team {tl}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>{tt === 0 ? "All sq" : tt > 0 ? "+" + tt + " holes" : tt + " holes"}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{tp.map((p) => p.name + " (HCP " + p.handicap + ")").join(" & ")}</div>
                  </div>
                  <div style={S.lbHoles}>{(tp[0]?.holesPlayed || 0) + "/18"}</div>
                </div>
              </div>
            );
          })
        ) : (
          lb.map((p, i) => (
            <div key={p.id} style={{ ...S.lbRow, ...(p.id === me?.id ? S.lbRowMe : {}) }}>
              <div style={{ ...S.lbPos, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>{i + 1}</div>
              <div style={S.lbName}>{p.name}<span style={S.lbHcp}>HCP {p.handicap}</span></div>
              <div style={S.lbRight}>
                <div style={S.lbScore}>
                  {round.game_type === "stableford" ? (p.total + " pts")
                    : round.game_type === "matchplay" ? (p.total === 0 ? "All Sq" : p.total > 0 ? Math.floor(p.total) + " Up" : Math.abs(Math.floor(p.total)) + " Dn")
                    : round.game_type === "banker" ? <span style={{ color: p.total > 0 ? "#22c55e" : p.total < 0 ? "#ef4444" : "#94a3b8", fontSize: 18, fontWeight: 800 }}>{p.total >= 0 ? "+$" : "-$"}{Math.abs(p.total)}</span>
                    : <><div style={{ fontSize: 14, color: "#94a3b8" }}>Gross: {p.grossTotal || 0}</div>
                       <div style={{ fontSize: 14, fontWeight: 700 }}>{formatToPar(p.toPar)}</div></>}
                </div>
                <div style={S.lbHoles}>{p.holesPlayed}/18</div>
              </div>
            </div>
          ))
        )}

        {/* Banker hole breakdown */}
        {round.game_type === "banker" && lb.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={S.stepTitle}>Banker Story</h3>
            {/* Per hole banker result - who was banker and what they won */}
            <div style={{ overflowX: "auto", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {holes.map((hole) => {
                  const holeScores = scores.filter((s) => s.hole_number === hole.hole_number);
                  const bankerId = holeScores[0]?.banker_id;
                  const bankerPlayer = players.find((p) => p.id === bankerId);
                  // Only show when ALL players have real scores
                  const allScored = players.every((p) => holeScores.some((s) => s.player_id === p.id && s.score > 0));
                  if (!allScored || !bankerPlayer) return (
                    <div key={hole.hole_number} style={{ minWidth: 44, backgroundColor: "#1e293b", borderRadius: 8, padding: "8px 4px", textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>H{hole.hole_number}</div>
                      <div style={{ fontSize: 10, color: "#334155" }}>—</div>
                    </div>
                  );
                  // Find winner
                  let lowest = Infinity, winner = null, tied = false;
                  holeScores.forEach((s) => { const pl = players.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) { lowest = net; winner = s.player_id; tied = false; } else if (net === lowest) tied = true; });
                  const bankerWon = winner === bankerId && !tied;
                  const bankerBets = holeScores.filter((s) => s.player_id !== bankerId).reduce((sum, s) => sum + (s.bet || 0), 0);
                  return (
                    <div key={hole.hole_number} style={{ minWidth: 52, backgroundColor: "#1e293b", borderRadius: 8, padding: "8px 4px", textAlign: "center", flexShrink: 0, border: "1px solid #334155" }}>
                      <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>H{hole.hole_number}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>{bankerPlayer.name.split(" ")[0]}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: bankerWon ? "#22c55e" : tied ? "#94a3b8" : "#ef4444" }}>{tied ? "TIE" : bankerWon ? "WIN" : "LOSS"}</div>
                      <div style={{ fontSize: 10, color: bankerWon ? "#22c55e" : tied ? "#94a3b8" : "#ef4444" }}>{tied ? "" : (bankerWon ? "+" : "-") + "$" + bankerBets}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Individual player breakdown */}
            <h3 style={S.stepTitle}>Player Balances</h3>
            {lb.map((player) => (
              <div key={player.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{player.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: player.total > 0 ? "#22c55e" : player.total < 0 ? "#ef4444" : "#94a3b8" }}>{player.total >= 0 ? "+$" : "-$"}{Math.abs(player.total)}</div>
                </div>
                <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
                  {holes.map((hole) => {
                    const hd = player.holeScores?.bankerHoleData?.[hole.hole_number];
                    if (!hd) return (
                      <div key={hole.hole_number} style={{ minWidth: 36, backgroundColor: "#1e293b", borderRadius: 6, padding: "6px 4px", textAlign: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 9, color: "#475569" }}>H{hole.hole_number}</div>
                        <div style={{ fontSize: 11, color: "#334155" }}>—</div>
                      </div>
                    );
                    const color = hd.holeChange > 0 ? "#22c55e" : hd.holeChange < 0 ? "#ef4444" : "#94a3b8";
                    return (
                      <div key={hole.hole_number} style={{ minWidth: 40, backgroundColor: "#1e293b", borderRadius: 6, padding: "6px 4px", textAlign: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>H{hole.hole_number}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color }}>{hd.iAmBanker ? "🏦" : hd.isWinner ? "W" : hd.tied ? "T" : "L"}</div>
                        <div style={{ fontSize: 10, color, fontWeight: 700 }}>{hd.holeChange !== 0 ? (hd.holeChange > 0 ? "+" : "") + "$" + hd.holeChange : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Round complete modal */}
        {showComplete && (
          <RoundCompleteScreen round={round} players={players} scores={scores}
            onSave={() => { saveRoundToHistory(round, players, scores, holes); setShowComplete(false); completeDismissedRef.current = true; alert("Round saved!"); }}
            onDismiss={() => { setShowComplete(false); completeDismissedRef.current = true; }} />
        )}


      </div>

      {showShare && <ShareModal round={round} onClose={() => setShowShare(false)} />}
    </div>
  );
}

// =============================================================================
// SCORECARD
// =============================================================================
function ScorecardScreen({ round, me, onViewDashboard }) {
  const [myScores, setMyScores] = useState({}), [myBets, setMyBets] = useState({});
  const [allScores, setAllScores] = useState([]), [others, setOthers] = useState([]);
  const [activeHole, setActiveHole] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [lastMsgCount, setLastMsgCount] = useState(0);
  const [initialBankerId, setInitialBankerId] = useState(null);
  const [currentBankerId, setCurrentBankerId] = useState(null);
  const [pendingBets, setPendingBets] = useState({}); // unsubmitted bet amounts
  const doubledHolesRef = useRef({}); // tracks which holes have been doubled - immune to refresh
  const originalPotRef = useRef({}); // stores original pot per hole - immune to refresh
  const holes = round.holes || [];
  const curHole = holes.find((h) => h.hole_number === activeHole);

  useEffect(() => {
    (async () => {
      const [s, p, bankerData] = await Promise.all([dbGetScores(round.id), dbGetPlayers(round.id), round.game_type === "banker" ? dbGetBanker(round.id) : Promise.resolve({})]);
      setAllScores(s); setOthers(p.filter((pl) => pl.id !== me.id));
      const sc = {}, bt = {};
      s.filter((x) => x.player_id === me.id).forEach((x) => { sc[x.hole_number] = x.score; if (x.bet) bt[x.hole_number] = x.bet; });
      setMyScores(sc); setMyBets(bt);
      // Load banker from Supabase
      if (bankerData?.initial_banker_id) {
        setInitialBankerId(bankerData.initial_banker_id);
        // Determine current banker hole by hole (winner becomes banker next hole)
        let runningBanker = bankerData.initial_banker_id;
        const allP = [...p, me];
        // Go through each completed hole in order to track banker rotation
        const maxHole = Math.max(0, ...s.map((x) => x.hole_number));
        for (let hn = 1; hn <= maxHole; hn++) {
          const hScores = s.filter((x) => x.hole_number === hn);
          if (!allP.every((pl) => hScores.some((x) => x.player_id === pl.id))) break;
          let lowest = Infinity, winner = null, tied = false;
          hScores.forEach((x) => { const pl = allP.find((pp) => pp.id === x.player_id); if (!pl) return; const hole = round.holes?.find((h) => h.hole_number === hn); const net = x.score - getHcpStrokes(pl.handicap, hole?.stroke_index || 1); if (net < lowest) { lowest = net; winner = x.player_id; tied = false; } else if (net === lowest) { tied = true; } });
          if (!tied && winner) runningBanker = winner; // winner becomes banker next hole
        }
        setCurrentBankerId(runningBanker);
        // Restore active hole to next unscored hole
        const myScoreHoles = s.filter((x) => x.player_id === me.id).map((x) => x.hole_number);
        const nextHole = Math.max(1, myScoreHoles.length > 0 ? Math.max(...myScoreHoles) + 1 : 1);
        if (nextHole <= 18) setActiveHole(Math.min(nextHole, 18));
      } else {
        // No banker game - still restore active hole
        const myScoreHoles = s.filter((x) => x.player_id === me.id).map((x) => x.hole_number);
        if (myScoreHoles.length > 0) {
          const nextHole = Math.min(Math.max(...myScoreHoles) + 1, 18);
          setActiveHole(nextHole);
        }
      }
    })();
  }, [round.id, me.id]);

  useEffect(() => {
    const t = setInterval(async () => {
      const [s, p, msgs] = await Promise.all([dbGetScores(round.id), dbGetPlayers(round.id), dbGetChat(round.id)]);
      // MERGE: never overwrite a field that exists locally with null from Supabase
      setAllScores((prev) => {
        const merged = [...s];
        prev.forEach((localScore) => {
          const idx = merged.findIndex((r) => r.player_id === localScore.player_id && r.hole_number === localScore.hole_number && r.round_id === localScore.round_id);
          if (idx >= 0) {
            // Keep local values if Supabase returned null for that field
            merged[idx] = {
              ...merged[idx],
              bet: merged[idx].bet ?? localScore.bet,
              banker_id: merged[idx].banker_id ?? localScore.banker_id,
              doubled: merged[idx].doubled ?? localScore.doubled,
              bet_locked: merged[idx].bet_locked ?? localScore.bet_locked,
            };
          }
        });
        return merged;
      });
      setOthers(p.filter((pl) => pl.id !== me.id));
      if (!showChat) {
        setLastMsgCount((prev) => { if (msgs.length > prev && prev > 0) setUnreadChat((u) => u + (msgs.length - prev)); return msgs.length; });
      }
      // Sync doubled bets to player - if banker doubled, update myBets to show doubled amount
      if (round.game_type === "banker") {
        const myActiveScore = s.find((x) => x.player_id === me.id && x.hole_number === activeHole);
        if (myActiveScore?.doubled && myActiveScore?.bet) {
          setMyBets((prev) => ({ ...prev, [activeHole]: myActiveScore.bet }));
          doubledHolesRef.current = { ...doubledHolesRef.current, [activeHole]: true };
        }
      }
      if (round.game_type === "banker") {
        const bankerData = await dbGetBanker(round.id);
        // ALWAYS sync banker from Supabase - fixes "waiting" bug on all devices
        if (bankerData?.initial_banker_id) {
          if (bankerData.initial_banker_id !== initialBankerId) {
            setInitialBankerId(bankerData.initial_banker_id);
          }
          // Use current_banker_id from Supabase as the source of truth
          if (bankerData.current_banker_id && bankerData.current_banker_id !== currentBankerId) {
            setCurrentBankerId(bankerData.current_banker_id);
          }
        }
        // Sync current hole from Supabase (hole progression)
        // Only advance if ALL players on THIS device have scored the current hole
        if (bankerData?.current_hole && bankerData.current_hole > activeHole) {
          const myCurrentHoleScore = s.find((x) => x.player_id === me.id && x.hole_number === activeHole && x.score > 0);
          if (myCurrentHoleScore) {
            setActiveHole(bankerData.current_hole);
            setTimeout(() => {
              const pos = Math.max(0, (bankerData.current_hole - 1) * 44 - 120);
              document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
            }, 50);
          }
        }
        // Recalculate current banker from all scores (hole by hole rotation)
        if (bankerData?.initial_banker_id) {
          let runningBanker = bankerData.initial_banker_id;
          const allP5 = [...p, me];
          const maxHole = Math.max(0, ...s.map((x) => x.hole_number));
          for (let hn = 1; hn <= maxHole; hn++) {
            const hScores = s.filter((x) => x.hole_number === hn);
            if (!allP5.every((pl) => hScores.some((x) => x.player_id === pl.id && x.score > 0))) break;
            let lowest = Infinity, winner = null, tied = false;
            hScores.forEach((x) => { 
              const pl = allP5.find((pp) => pp.id === x.player_id); if (!pl) return;
              const hole = holes.find((h) => h.hole_number === hn);
              const net = x.score - getHcpStrokes(pl.handicap, hole?.stroke_index || 1);
              if (net < lowest) { lowest = net; winner = x.player_id; tied = false; }
              else if (net === lowest) { tied = true; }
            });
            if (!tied && winner) runningBanker = winner;
          }
          setCurrentBankerId(runningBanker);
          if (runningBanker !== bankerData?.current_banker_id) { dbSaveCurrentBanker(round.id, runningBanker); }
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [round.id, me.id, showChat]);

  const syncScroll = (e) => {
    const pos = e.target.scrollLeft;
    document.querySelectorAll("[data-ss]").forEach((el) => { if (el !== e.target) el.scrollLeft = pos; });
  };

  const saveScore = async (holeNum, score, bet = null) => {
    if (score < 1 || score > 15) return;
    const thisBankerId = holeNum === 1 ? initialBankerId : currentBankerId;
    const iAmBankerNow = thisBankerId === me.id;
    // Non-banker must have submitted a bet first
    if (round.game_type === "banker" && !iAmBankerNow && !myBets[holeNum]) return;
    
    setMyScores((prev) => ({ ...prev, [holeNum]: score }));
    if (bet !== null) setMyBets((prev) => ({ ...prev, [holeNum]: bet }));
    
    // Build score object - preserve existing bet if already submitted
    const existingRecord = allScores.find((s) => s.player_id === me.id && s.hole_number === holeNum);
    const obj = {
      player_id: me.id, hole_number: holeNum, score, round_id: round.id,
      bet: bet !== null ? bet : (existingRecord?.bet || myBets[holeNum] || null),
      banker_id: round.game_type === "banker" ? thisBankerId : undefined,
      doubled: existingRecord?.doubled || false,
      bet_locked: existingRecord?.bet_locked || false,
    };
    // Remove undefined keys
    Object.keys(obj).forEach((k) => obj[k] === undefined && delete obj[k]);
    
    setAllScores((prev) => {
      const f = prev.filter((s) => !(s.player_id === me.id && s.hole_number === holeNum));
      return [...f, obj];
    });
    
    try {
      await dbSaveScore(obj);
    } catch (e) {
      console.error("saveScore error:", e);
      return; // Don't advance if save failed
    }
    
    // Banker rotation - fetch fresh scores from Supabase to ensure we have everyone's score
    if (round.game_type === "banker") {
      const allPlayersList2 = [...others, me];
      // Fetch fresh from Supabase so we have everyone's latest score
      const freshFromDB = await dbGetScores(round.id);
      const realHoleScores = freshFromDB.filter((s) => s.hole_number === holeNum && s.score > 0);
      const allRealScored = allPlayersList2.every((p) => realHoleScores.some((s) => s.player_id === p.id));
      if (allRealScored) {
        let lowest = Infinity, winner = null, tied = false;
        realHoleScores.forEach((s) => {
          const pl = allPlayersList2.find((p) => p.id === s.player_id); if (!pl) return;
          const hole = holes.find((h) => h.hole_number === holeNum);
          const net = s.score - getHcpStrokes(pl.handicap, hole?.stroke_index || 1);
          if (net < lowest) { lowest = net; winner = s.player_id; tied = false; }
          else if (net === lowest) { tied = true; }
        });
        if (winner && !tied) {
          setCurrentBankerId(winner);
          try { await dbSaveCurrentBanker(round.id, winner); } catch(e) { console.error(e); }
        }
        if (holeNum < 18) {
          try { await dbSaveCurrentHole(round.id, holeNum + 1); } catch(e) { console.error(e); }
        }
        // Update local scores with fresh data
        setAllScores(freshFromDB);
      }
    }
    
    if (holeNum < 18) {
      if (round.game_type !== "banker") {
        // Non-banker games advance immediately
        const next = holeNum + 1;
        setActiveHole(next);
        setTimeout(() => {
          const pos = Math.max(0, (next - 1) * 44 - 120);
          document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
        }, 50);
      }
      // Banker: hole advance happens via Supabase sync in 2s refresh
    } else {
      setTimeout(() => onViewDashboard(), 800);
    }
  };

  const hcpS = curHole ? getHcpStrokes(me.handicap, curHole.stroke_index) : 0;

  const myGrossTotal = holes.reduce((sum, h) => sum + (myScores[h.hole_number] ? myScores[h.hole_number] - h.par : 0), 0);
  const myNetTotal = holes.reduce((sum, h) => { const g = myScores[h.hole_number]; if (!g) return sum; return sum + (g - getHcpStrokes(me.handicap, h.stroke_index) - h.par); }, 0);
  const myStablefordTotal = holes.reduce((sum, h) => { const g = myScores[h.hole_number]; if (!g) return sum; return sum + stablefordPoints(g, h.par, getHcpStrokes(me.handicap, h.stroke_index)); }, 0);
  const allPlayers = [...others, me];
  const myMatchTotal = (() => {
    let myHolesWon = 0, oppHolesWon = 0;
    holes.forEach((hole) => {
      const myG = myScores[hole.hole_number]; if (!myG) return;
      const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
      // Only count hole if ALL players have scored it
      const allScored = allPlayers.every((p) => holeScores.some((s) => s.player_id === p.id));
      if (!allScored) return;
      // Find lowest net score
      let lowestNet = Infinity;
      holeScores.forEach((s) => {
        const pl = allPlayers.find((p) => p.id === s.player_id); if (!pl) return;
        const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index);
        if (net < lowestNet) lowestNet = net;
      });
      // All players at that score are "winners"
      const holeWinners = holeScores.filter((s) => {
        const pl = allPlayers.find((p) => p.id === s.player_id); if (!pl) return false;
        return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowestNet;
      }).map((s) => s.player_id);
      const allTied = holeWinners.length === allPlayers.length;
      if (!allTied) {
        // If I'm among the winners and beat at least one other player - I win the hole
        if (holeWinners.includes(me.id)) myHolesWon++;
        else oppHolesWon++;
      }
    });
    return myHolesWon - oppHolesWon;
  })();
  // Direct calculation - most reliable
  const myBankerTotal = (() => {
    if (!holes || !holes.length || !me) return 0;
    let total = 0;
    holes.forEach((hole) => {
      const myG = myScores[hole.hole_number]; if (!myG) return;
      const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
      // Only count when ALL players have REAL scores (score > 0, not placeholder bet records)
      if (!allPlayers.every((p) => holeScores.some((s) => s.player_id === p.id && s.score > 0))) return;
      const myScore = holeScores.find((s) => s.player_id === me.id);
      const bankerId = myScore?.banker_id || holeScores[0]?.banker_id;
      const doubled = holeScores.some((s) => s.doubled);
      const iAmBanker = bankerId === me.id;
      // Find lowest net and all winners
      let lowest2 = Infinity;
      holeScores.forEach((s) => {
        const pl = allPlayers.find((p) => p.id === s.player_id); if (!pl || s.score === 0) return;
        const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index);
        if (net < lowest2) lowest2 = net;
      });
      const winners2 = holeScores.filter((s) => {
        const pl = allPlayers.find((p) => p.id === s.player_id); if (!pl || s.score === 0) return false;
        return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowest2;
      }).map((s) => s.player_id);
      const bankerIsWinner2 = winners2.includes(bankerId);
      if (iAmBanker) {
        if (bankerIsWinner2) {
          holeScores.forEach((s) => {
            if (s.player_id === me.id || s.score === 0) return;
            if (!winners2.includes(s.player_id)) total += (s.bet || 0);
          });
        } else {
          holeScores.forEach((s) => {
            if (s.player_id === me.id || s.score === 0) return;
            if (winners2.includes(s.player_id)) total -= (s.bet || 0);
          });
        }
      } else {
        const myBet = (myScore?.bet || 0);
        if (!myBet) return;
        if (winners2.includes(me.id) && !bankerIsWinner2) total += myBet;
        else if (bankerIsWinner2 && !winners2.includes(me.id)) total -= myBet;
      }
    });
    return total;
  })();

  const RunningTotal = ({ value, label, color }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 48, paddingLeft: 8, borderLeft: "1px solid #334155", flexShrink: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: color || (value > 0 ? "#ef4444" : value < 0 ? "#22c55e" : "#94a3b8") }}>
        {label || (value === 0 ? "E" : value > 0 ? "+" + value : value)}
      </span>
    </div>
  );

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onViewDashboard}>← Back</button>
        <h2 style={S.headerTitle}>Enter Score</h2>
        <button onClick={() => { setShowChat(true); setUnreadChat(0); }}
          style={{ position: "relative", backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "10px 16px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          💬
          {unreadChat > 0 && <span style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#ef4444", color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 1s infinite", boxShadow: "0 0 0 3px rgba(239,68,68,0.3)" }}>{unreadChat}</span>}
        </button>
      </div>
      {showChat && <ChatPanel round={round} me={me} onClose={() => { setShowChat(false); setUnreadChat(0); }} />}

      {/* Hole nav - master scroll, drives all score rows */}
      <div style={{ backgroundColor: "#1e293b", borderBottom: "1px solid #334155", padding: "10px 16px" }}>
        <div id="ff-master-scroll" style={S.holeNav} onScroll={(e) => {
          document.querySelectorAll(".ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; });
        }}>
          {holes.map((h) => {
              const holeAllScored = allPlayers.length > 1 && allScores.filter((s) => s.hole_number === h.hole_number).length >= allPlayers.length;
              const isActive = h.hole_number === activeHole;
              const isDone = !!myScores[h.hole_number] && !isActive;
              return (
                <button key={h.hole_number} onClick={() => {
                  setActiveHole(h.hole_number);
                  const pos = Math.max(0, (h.hole_number - 1) * 44 - 140);
                  document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
                }}
                  style={{
                    minWidth: 40, width: 40, height: 40, borderRadius: 8, border: "none",
                    backgroundColor: isActive ? "#22c55e" : "transparent",
                    color: isActive ? "#0f172a" : isDone ? "#334155" : "#64748b",
                    fontSize: isActive ? 15 : 13,
                    fontWeight: isActive ? 900 : isDone ? 600 : 500,
                    cursor: "pointer", flexShrink: 0, fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                    opacity: isDone && !isActive ? 0.6 : 1,
                  }}>
                  {h.hole_number}
                  {isDone && !isActive && <span style={{ position: "absolute", top: 1, right: 3, fontSize: 8, color: "#22c55e", fontWeight: 900 }}>✓</span>}
                </button>
              );
            })}
        </div>
      </div>

      {curHole && (
        <div style={S.holeCard}>
          <div style={S.holeTop}>
            <div>
              <div style={S.holeNum}>Hole {curHole.hole_number}</div>
              <div style={S.holeMeta}>SI {curHole.stroke_index}</div>
              {round.game_type === "banker" && (() => {
                const thisBankerId2 = activeHole === 1 ? initialBankerId : currentBankerId;
                const bankerName = [...others, me].find((p) => p.id === thisBankerId2)?.name;
                if (!bankerName) return null;
                return <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginTop: 2 }}>🏦 {thisBankerId2 === me.id ? "YOU ARE BANKER" : bankerName + " is Banker"}</div>;
              })()}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              {(() => {
                let label, value, color;
                if (round.game_type === "stableford") {
                  label = "Points"; value = myStablefordTotal + " pts"; color = "#22c55e";
                } else if (round.game_type === "matchplay" || round.game_type === "matchplay_teams") {
                  const lead = Math.floor(myMatchTotal);
                  label = "Match"; color = lead > 0 ? "#22c55e" : lead < 0 ? "#ef4444" : "#94a3b8";
                  value = lead === 0 ? "All Sq" : lead > 0 ? lead + " Up" : Math.abs(lead) + " Dn";
                  // Add holes played context
                } else if (round.game_type === "banker") {
                  // Show MY running balance, not the pot
                  label = "Balance"; 
                  color = myBankerTotal > 0 ? "#22c55e" : myBankerTotal < 0 ? "#ef4444" : "#94a3b8";
                  value = (myBankerTotal >= 0 ? "+$" : "-$") + Math.abs(myBankerTotal);
                } else {
                  label = "Gross"; value = formatToPar(myGrossTotal); color = "#e2e8f0";
                }
                return (
                  <div style={{ backgroundColor: "#0f172a", border: "1px solid #475569", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: color || "#e2e8f0" }}>{value}</div>
                  </div>
                );
              })()}
              <div style={S.parBadge}>
                <div style={S.parNum}>Par {curHole.par}</div>
                {hcpS > 0 && <div style={S.hcpBadge}>+{hcpS} stroke{hcpS > 1 ? "s" : ""}</div>}
              </div>
            </div>
          </div>

          {/* Banker game - full banker UI */}
          {round.game_type === "banker" && (() => {
            const thisBanker = currentBankerId || initialBankerId;
            const iAmBanker = thisBanker === me.id;
            const bankerPlayer = [...others, me].find((p) => p.id === thisBanker);
            const nonBankerPlayers = [...others, me].filter((p) => p.id !== thisBanker);
            // Get bets - if thisBanker is null show all bets
            const submittedBets = thisBanker
              ? allScores.filter((s) => s.hole_number === activeHole && s.player_id !== thisBanker && s.bet > 0)
              : allScores.filter((s) => s.hole_number === activeHole && s.bet > 0);
            const uniqueBettors = [...new Set(submittedBets.map((s) => s.player_id))];
            const isDoubled = doubledHolesRef.current[activeHole] === true || allScores.some((s) => s.hole_number === activeHole && s.doubled === true);
            const originalPot = originalPotRef.current[activeHole] || submittedBets.reduce((sum, s) => sum + (s.bet || 0), 0);
            const doubledPot = originalPot * 2;
            const totalPot = isDoubled ? doubledPot : originalPot;
            const allBetsIn = uniqueBettors.length >= nonBankerPlayers.length && nonBankerPlayers.length > 0;
            const myBetConfirmed = !!myBets[activeHole];

            return (
              <>
                {/* STEP 1: Select banker - only if no banker set */}
                {!thisBanker && round.created_by === me.name && (
                  <div style={{ backgroundColor: "#1e293b", border: "1.5px solid #f59e0b", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>⚠ SELECT INITIAL BANKER</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[...others, me].map((p) => (
                        <button key={p.id} onClick={async () => {
                          setInitialBankerId(p.id);
                          setCurrentBankerId(p.id);
                          await dbSaveBanker(round.id, p.id);
                        }} style={{ backgroundColor: "#0f172a", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          {p.name}{p.id === me.id ? " (You)" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!thisBanker && round.created_by !== me.name && (
                  <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "12px 16px", marginBottom: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "#64748b" }}>⏳ Waiting for creator to select the banker...</div>
                  </div>
                )}

                {/* STEP 2+: Banker is set - show role */}
                {thisBanker && (
                  <div style={{ backgroundColor: iAmBanker ? "#022c22" : "#0f172a", border: iAmBanker ? "1.5px solid #22c55e" : "1px solid #334155", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
                    {iAmBanker ? (
                      /* BANKER VIEW */
                      <>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#22c55e", marginBottom: 6 }}>🏦 YOU ARE THE BANKER</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                          Pot: <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 20 }}>${totalPot}</span>
                          {isDoubled && <span style={{ color: "#f59e0b", fontSize: 11, marginLeft: 6 }}>🔥 DOUBLED</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>
                          {allBetsIn ? "✓ All bets in - ready to play or double" : `Bets in: ${submittedBets.length}/${nonBankerPlayers.length}`}
                        </div>
                        {/* Double button - only when all bets in and not yet doubled */}
                        {allBetsIn && !isDoubled && (
                          <button onClick={async () => {
                            // Prevent double-firing
                            if (doubledHolesRef.current[activeHole]) return;
                            if (!window.confirm("Double all bets on hole " + activeHole + "? Cannot be undone.")) return;
                            // Store original pot and mark doubled IMMEDIATELY
                            originalPotRef.current = { ...originalPotRef.current, [activeHole]: originalPot };
                            doubledHolesRef.current = { ...doubledHolesRef.current, [activeHole]: true };
                            // Get the ORIGINAL bets (before any doubling)
                            const hScores = allScores.filter((s) => s.hole_number === activeHole && s.bet > 0);
                            // Save DOUBLED amount directly to Supabase so all devices see it
                            for (const s of hScores) {
                              await supabase.from("scores")
                                .update({ bet: s.bet * 2, doubled: true })
                                .eq("player_id", s.player_id)
                                .eq("hole_number", s.hole_number)
                                .eq("round_id", s.round_id);
                            }
                            // Update local state immediately
                            setAllScores((prev) => prev.map((s) => {
                              if (s.hole_number === activeHole && s.bet > 0) {
                                return { ...s, bet: s.bet * 2, doubled: true };
                              }
                              return s;
                            }));
                            await dbSendChat({ id: genId(), round_id: round.id, player_id: me.id, player_name: me.name, text: "🔥 " + me.name + " DOUBLED the bets on hole " + activeHole + "! All bets are now x2.", created_at: new Date().toISOString() });
                          }} style={{ width: "100%", backgroundColor: "#f59e0b", color: "#0f172a", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}>
                            💥 DOUBLE — ${originalPot} → ${doubledPot}
                          </button>
                        )}
                        {isDoubled && (
                          <div style={{ backgroundColor: "#f59e0b22", border: "1px solid #f59e0b", borderRadius: 8, padding: "6px 12px", textAlign: "center", fontSize: 12, color: "#f59e0b", fontWeight: 700, marginBottom: 8 }}>
                            🔥 DOUBLED — All bets x2
                          </div>
                        )}
                        {/* Scoring active indicator */}
                        {allBetsIn && (
                          <div style={{ backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 12px", textAlign: "center", fontSize: 13, color: "#22c55e", fontWeight: 700 }}>
                            ⛳ Scoring is LIVE — Enter your score below
                          </div>
                        )}
                      </>
                    ) : (
                      /* NON-BANKER VIEW */
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>🏦 {bankerPlayer?.name || "?"} is Banker</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: myBankerTotal > 0 ? "#22c55e" : myBankerTotal < 0 ? "#ef4444" : "#94a3b8" }}>
                            {myBankerTotal >= 0 ? "+$" : "-$"}{Math.abs(myBankerTotal)}
                          </div>
                        </div>

                        {myBetConfirmed ? (
                          /* Bet locked */
                          <div style={{ backgroundColor: "#022c22", border: "1.5px solid #22c55e", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>✓ Bet Locked</div>
                            <div style={{ fontSize: 22, fontWeight: 900, color: "#22c55e" }}>
                              ${myBets[activeHole]}
                              {isDoubled && <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: 6 }}>🔥x2</span>}
                            </div>
                          </div>
                        ) : (
                          /* Enter bet */
                          <div>
                            <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginBottom: 8 }}>⚠ Enter your bet to unlock scoring</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 16, color: "#64748b", fontWeight: 700 }}>$</span>
                              <input
                                style={{ ...S.customInput, flex: 1, fontSize: 22, fontWeight: 900, borderColor: pendingBets[activeHole] ? "#22c55e" : "#f59e0b" }}
                                type="number" min="1" placeholder="0"
                                value={pendingBets[activeHole] || ""}
                                onChange={(e) => setPendingBets((prev) => ({ ...prev, [activeHole]: e.target.value ? parseInt(e.target.value) : "" }))}
                              />
                              <button
                                onClick={async () => {
                                  const betVal = pendingBets[activeHole];
                                  if (!betVal || betVal < 1) return;
                                  const obj = { player_id: me.id, hole_number: activeHole, round_id: round.id, score: 0, bet: betVal, banker_id: thisBanker };
                                  await dbSaveScore(obj);
                                  setMyBets((prev) => ({ ...prev, [activeHole]: betVal }));
                                  const updated = await dbGetScores(round.id);
                                  setAllScores(updated);
                                }}
                                disabled={!pendingBets[activeHole]}
                                style={{ backgroundColor: pendingBets[activeHole] ? "#22c55e" : "#334155", color: pendingBets[activeHole] ? "#0f172a" : "#64748b", border: "none", borderRadius: 8, padding: "12px 16px", fontSize: 14, fontWeight: 800, cursor: pendingBets[activeHole] ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0 }}>
                                Submit
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Show scoring active once bet confirmed */}
                        {myBetConfirmed && (
                          <div style={{ marginTop: 8, backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 8, padding: "6px 12px", textAlign: "center", fontSize: 12, color: "#22c55e", fontWeight: 700 }}>
                            ⛳ Scoring LIVE — Enter your score below
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            );
          })()}

                    <div style={{ position: "relative" }}>
          {round.game_type === "banker" && (() => {
            const thisBankerNow = activeHole === 1 ? initialBankerId : currentBankerId;
            const iAmBankerNow2 = thisBankerNow === me.id;
            const nonBankers2 = [...others, me].filter((p) => p.id !== thisBankerNow);
            const betsIn = allScores.filter((s) => s.hole_number === activeHole && s.player_id !== thisBankerNow && s.bet > 0).length;
            const allBetsIn = betsIn >= nonBankers2.length && nonBankers2.length > 0;
            const showLock = (!iAmBankerNow2 && !myBets[activeHole]) || (iAmBankerNow2 && !allBetsIn);
            const lockMsg = iAmBankerNow2 ? "⏳ Waiting for all bets (" + betsIn + "/" + nonBankers2.length + ")" : "🔒 Submit your bet to unlock";
            if (!showLock) return null;
            return (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 16, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "rgba(15,23,42,0.75)" }}>
                <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>{lockMsg}</span>
              </div>
            );
          })()}
          {(() => {
            // Banker lock logic
            const tb = activeHole === 1 ? initialBankerId : currentBankerId;
            const iAmBkr = tb === me.id;
            const nonBkrs = [...others, me].filter((p) => p.id !== tb);
            const betsInNow = allScores.filter((s) => s.hole_number === activeHole && s.player_id !== tb && s.bet > 0).length;
            const allBetsInNow = betsInNow >= nonBkrs.length && nonBkrs.length > 0;
            const isLocked = round.game_type === "banker" && (!iAmBkr ? !myBets[activeHole] : !allBetsInNow);
            return (
              <div style={S.scoreRow}>
                {[curHole.par - 1, curHole.par, curHole.par + 1, curHole.par + 2, curHole.par + 3].map((s) => (
                  <button key={s} onClick={() => !isLocked && saveScore(activeHole, s)}
                    style={{ ...S.scoreBtn,
                    backgroundColor: isLocked ? "#1a2234" : myScores[activeHole] === s ? scoreColour(s, curHole.par, hcpS) : "#e2e8f0",
                    color: isLocked ? "#2d3f5a" : myScores[activeHole] === s ? "#fff" : "#0f172a",
                    border: "none", opacity: isLocked ? 0.4 : 1,
                    cursor: isLocked ? "not-allowed" : "pointer",
                    boxShadow: !isLocked && myScores[activeHole] !== s ? "0 2px 4px rgba(0,0,0,0.3)" : "none" }}>
                    <span style={S.scoreBtnNum}>{s}</span>
                    <span style={S.scoreBtnLabel}>{scoreLabel(s, curHole.par)}</span>
                  </button>
                ))}
              </div>
            );
          })()}
          </div>

          <div style={S.customScore}>
            <span style={S.customLabel}>Other score</span>
            <input style={S.customInput} type="number" min="1" max="15" placeholder="—"
              value={myScores[activeHole] && ![curHole.par-1,curHole.par,curHole.par+1,curHole.par+2,curHole.par+3].includes(myScores[activeHole]) ? myScores[activeHole] : ""}
              onChange={(e) => e.target.value && saveScore(activeHole, parseInt(e.target.value))} />
          </div>



          <div style={S.scoreInfoBoxes}>
            {/* Combined Course Info row - hole number dominant, par secondary, SI subtle */}
            <div style={{ ...S.scoreInfoSection, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "8px 12px 0", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>Course</div>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div className="ff-slave-scroll" style={{ ...S.scoreInfoRow, flex: 1, padding: "8px 0 10px 12px" }} onScroll={(e) => {
                  document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; });
                }}>
                  {holes.map((h) => {
                    const isActive = h.hole_number === activeHole;
                    return (
                      <div key={"ci"+h.hole_number} onClick={() => {
                        setActiveHole(h.hole_number);
                        const pos = Math.max(0, (h.hole_number - 1) * 54 - 20);
                        document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
                      }}
                        style={{ minWidth: 40, width: 40, flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer",
                          backgroundColor: isActive ? "#022c22" : "transparent", borderRadius: 8, padding: "6px 0", gap: 1,
                          outline: isActive ? "1px solid #22c55e" : "none", outlineOffset: -1 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: isActive ? "#22c55e" : "#f8fafc", lineHeight: 1 }}>{h.hole_number}</div>
                        <div style={{ width: 20, height: 1, backgroundColor: isActive ? "#22c55e" : "#334155", margin: "3px 0" }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#22c55e" : "#94a3b8", lineHeight: 1 }}>P{h.par}</div>
                        <div style={{ fontSize: 9, fontWeight: 400, color: "#475569", lineHeight: 1.4 }}>{h.stroke_index}</div>
                        {getHcpStrokes(me.handicap, h.stroke_index) > 0 && <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "#f59e0b", marginTop: 1 }} />}
                        {round.game_type === "stableford" && <div style={{ fontSize: 8, color: "#22c55e", lineHeight: 1, fontWeight: 600 }}>{2 + getHcpStrokes(me.handicap, h.stroke_index)}pt</div>}
                      </div>
                    );
                  })}
                </div>
                {/* Invisible spacer matching TotalPin width so scroll endpoint aligns */}
                <div style={{ minWidth: 40, width: 40, flexShrink: 0 }} />
              </div>
            </div>

            <div style={S.scoreInfoSection}>
              <div style={S.scoreInfoSectionTitle}>Gross Score</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div className="ff-slave-scroll" style={{ ...S.scoreInfoRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
                  {holes.map((h) => { const g = myScores[h.hole_number]; const { number, shape } = getScoreShape(g, h.par); return (
                    <div key={"gs"+h.hole_number} style={S.scoreInfoCell}>
                      {g ? <div style={{ ...S.scoreInfoCellValue, ...shapeStyle(shape) }}>{number}</div> : <div style={S.scoreInfoCellValue}>—</div>}
                    </div>); })}
                </div>
                <RunningTotal value={myGrossTotal} />
              </div>
            </div>

            <div style={S.scoreInfoSection}>
              <div style={S.scoreInfoSectionTitle}>Net Score</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div className="ff-slave-scroll" style={{ ...S.scoreInfoRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
                  {holes.map((h) => { const hs = getHcpStrokes(me.handicap, h.stroke_index); const g = myScores[h.hole_number]; const { number, shape } = getNetShape(g, h.par, hs); return (
                    <div key={"ns"+h.hole_number} style={S.scoreInfoCell}>
                      {g ? <div style={{ ...S.scoreInfoCellValue, ...shapeStyle(shape) }}>{number}</div> : <div style={S.scoreInfoCellValue}>—</div>}
                    </div>); })}
                </div>
                <RunningTotal value={myNetTotal} />
              </div>
            </div>

            {round.game_type === "stableford" && (
              <div style={S.scoreInfoSection}>
                <div style={S.scoreInfoSectionTitle}>Points</div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div className="ff-slave-scroll" style={{ ...S.scoreInfoRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
                    {holes.map((h) => { const hs = getHcpStrokes(me.handicap, h.stroke_index); const g = myScores[h.hole_number]; return (
                      <div key={"sp"+h.hole_number} style={S.scoreInfoCell}><div style={S.scoreInfoCellNumber}>{h.hole_number}</div>
                        <div style={S.scoreInfoCellValue}>{g ? stablefordPoints(g, h.par, hs) : "—"}</div>
                      </div>); })}
                  </div>
                  <RunningTotal value={myStablefordTotal} label={myStablefordTotal + "pts"} color="#22c55e" />
                </div>
              </div>
            )}

            {round.game_type === "matchplay" && (
              <div style={S.scoreInfoSection}>
                <div style={S.scoreInfoSectionTitle}>Hole Result</div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div className="ff-slave-scroll" style={{ ...S.scoreInfoRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
                    {holes.map((h) => {
                      let label = "—", color = "#94a3b8";
                      const myG = myScores[h.hole_number];
                      if (myG) {
                        const holeScores = allScores.filter((s) => s.hole_number === h.hole_number);
                        const allPlayers2 = [...others, me];
                        const allScored2 = allPlayers2.every((p) => holeScores.some((s) => s.player_id === p.id));
                        if (allScored2) {
                          let lowestWL = Infinity;
                          holeScores.forEach((s) => { const pl = allPlayers2.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, h.stroke_index); if (net < lowestWL) lowestWL = net; });
                          const hWinnersWL = holeScores.filter((s) => { const pl = allPlayers2.find((p) => p.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, h.stroke_index)) === lowestWL; }).map((s) => s.player_id);
                          const allTiedWL = hWinnersWL.length === allPlayers2.length;
                          if (allTiedWL) { label = "T"; color = "#94a3b8"; } // everyone same score
                          else if (hWinnersWL.includes(me.id)) { label = "W"; color = "#22c55e"; } // I beat at least one
                          else { label = "L"; color = "#ef4444"; } // I didn't match the lowest
                        }
                      }
                      return (<div key={"mp"+h.hole_number} style={S.scoreInfoCell}><div style={S.scoreInfoCellNumber}>{h.hole_number}</div><div style={{ ...S.scoreInfoCellValue, color }}>{label}</div></div>);
                    })}
                  </div>
                  <RunningTotal value={myMatchTotal} label={myMatchTotal === 0 ? "All Sq" : myMatchTotal > 0 ? Math.floor(myMatchTotal) + " Up" : Math.abs(Math.floor(myMatchTotal)) + " Dn"} color={myMatchTotal > 0 ? "#22c55e" : myMatchTotal < 0 ? "#ef4444" : "#94a3b8"} />
                </div>
              </div>
            )}

            {round.game_type === "banker" && (
              <div style={{ ...S.scoreInfoSection, padding: "8px 10px" }}>
                <div style={S.scoreInfoSectionTitle}>Your Balance</div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div className="ff-slave-scroll" style={{ ...S.scoreInfoRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
                    {holes.map((h) => {
                      const holeScores = allScores.filter((s) => s.hole_number === h.hole_number);
                      const myScore = holeScores.find((s) => s.player_id === me.id);
                      const allScoredBk = myScore && allPlayers.every((p) => holeScores.some((s) => s.player_id === p.id && s.score > 0));
                      if (!allScoredBk) return (<div key={"bk"+h.hole_number} style={S.scoreInfoCell}><div style={{ fontSize: 14, color: "#334155" }}>—</div></div>);
                      const bankerId = myScore?.banker_id || holeScores[0]?.banker_id;
                      const doubled = holeScores.some((s) => s.doubled);
                      const iAmBankerHole = bankerId === me.id;
                      let lowest = Infinity, winner = null, tied = false;
                      holeScores.forEach((s) => { const pl = allPlayers.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, h.stroke_index); if (net < lowest) { lowest = net; winner = s.player_id; tied = false; } else if (net === lowest) { tied = true; } });
                      let holeChange = 0;
                      if (!tied) {
                        if (iAmBankerHole) { holeScores.forEach((s) => { if (s.player_id === me.id) return; const bet = (s.bet||0); if (winner===me.id) holeChange+=bet; else holeChange-=bet; }); }
                        else { const myBet=(myScore?.bet||0); if(myBet>0){if(winner===me.id)holeChange+=myBet;else if(winner===bankerId)holeChange-=myBet;} }
                      }
                      const color = holeChange > 0 ? "#22c55e" : holeChange < 0 ? "#ef4444" : "#94a3b8";
                      return (
                        <div key={"bk"+h.hole_number} style={{ ...S.scoreInfoCell, minWidth: 40 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color }}>{tied ? "T" : winner === me.id ? "W" : "L"}</div>
                          {iAmBankerHole && <div style={{ fontSize: 9 }}>🏦</div>}
                          {doubled && <div style={{ fontSize: 9 }}>🔥</div>}
                          <div style={{ fontSize: 9, color, fontWeight: 700 }}>{holeChange !== 0 ? (holeChange > 0 ? "+$" : "-$") + Math.abs(holeChange) : ""}{doubled ? "×2" : ""}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 48, paddingLeft: 8, borderLeft: "1px solid #334155", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: myBankerTotal > 0 ? "#22c55e" : myBankerTotal < 0 ? "#ef4444" : "#94a3b8" }}>{myBankerTotal >= 0 ? "+$" : "-$"}{Math.abs(myBankerTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Match play status banner */}
      {(round.game_type === "matchplay" || round.game_type === "matchplay_teams") && (() => {
        const holesPlayed = Object.keys(myScores).length;
        if (holesPlayed === 0) return null;
        const lead = Math.floor(myMatchTotal);
        const color = lead > 0 ? "#22c55e" : lead < 0 ? "#ef4444" : "#94a3b8";
        const bg = lead > 0 ? "#022c22" : lead < 0 ? "#1a0a0a" : "#1e293b";
        const border = lead > 0 ? "#22c55e" : lead < 0 ? "#ef4444" : "#334155";
        const status = lead === 0 ? "All Square" : lead > 0 ? lead + " Up" : Math.abs(lead) + " Down";
        return (
          <div style={{ margin: "0 16px 12px", backgroundColor: bg, border: "1px solid " + border, borderRadius: 10, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>After {holesPlayed} hole{holesPlayed !== 1 ? "s" : ""}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color }}>{status}</span>
          </div>
        );
      })()}

      {others.length > 0 && (
        <div style={S.otherPlayersSection}>
          <div style={S.otherPlayersTitle}>Other Players</div>
          {others.map((player) => {
            const ps = allScores.filter((s) => s.player_id === player.id);
            const pGrossTotal = holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); return sum + (s ? s.score - h.par : 0); }, 0);
            const pNetTotal = holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + (s.score - getHcpStrokes(player.handicap, h.stroke_index) - h.par); }, 0);
            return (
              <div key={player.id} style={S.playerCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={S.playerCardName}>{player.name} (HCP {player.handicap})</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    G: <span style={{ color: pGrossTotal === 0 ? "#94a3b8" : pGrossTotal > 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{formatToPar(pGrossTotal)}</span>
                    {"  "}N: <span style={{ color: pNetTotal === 0 ? "#94a3b8" : pNetTotal > 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{formatToPar(pNetTotal)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  {/* G / N labels on far left */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 14, marginRight: 4, flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>G</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>N</div>
                    {(round.game_type === "stableford" || round.game_type === "matchplay" || round.game_type === "banker") && (
                      <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>
                        {round.game_type === "stableford" ? "Pts" : round.game_type === "matchplay" ? "W/L" : "$"}
                      </div>
                    )}
                  </div>
                  {/* Scrollable scores */}
                  <div style={{ ...S.playerScoresRow, flex: 1 }}>
                    {holes.map((h) => {
                      const sc = ps.find((s) => s.hole_number === h.hole_number);
                      const g = sc ? sc.score : null, hs = getHcpStrokes(player.handicap, h.stroke_index);
                      const { number: gn, shape: gs } = getScoreShape(g, h.par);
                      const { number: nn, shape: ns } = getNetShape(g, h.par, hs);
                      let thirdValue = "—", thirdColor = "#94a3b8";
                      if (g) {
                        if (round.game_type === "stableford") { thirdValue = stablefordPoints(g, h.par, hs); thirdColor = "#22c55e"; }
                        else if (round.game_type === "matchplay") {
                          const holeScores = allScores.filter((s) => s.hole_number === h.hole_number);
                          const allPlayers3 = [...others, me];
                          if (!allPlayers3.every((p) => holeScores.some((s) => s.player_id === p.id))) { thirdValue = "—"; thirdColor = "#475569"; }
                          else {
                            // Find lowest net
                            let lowestNet3 = Infinity;
                            holeScores.forEach((s) => { const pl = allPlayers3.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, h.stroke_index); if (net < lowestNet3) lowestNet3 = net; });
                            const hWinners3 = holeScores.filter((s) => { const pl = allPlayers3.find((p) => p.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, h.stroke_index)) === lowestNet3; }).map((s) => s.player_id);
                            const allTied3 = hWinners3.length === allPlayers3.length;
                            if (allTied3) { thirdValue = "T"; thirdColor = "#94a3b8"; } // everyone same score = true tie
                            else if (hWinners3.includes(player.id)) { thirdValue = "W"; thirdColor = "#22c55e"; } // beat at least one
                            else { thirdValue = "L"; thirdColor = "#ef4444"; } // didn't match lowest
                          }
                        } else if (round.game_type === "banker") {
                          const bet = sc?.bet || 0;
                          const holeScores = allScores.filter((s) => s.hole_number === h.hole_number);
                          let lowest = Infinity, winner = null;
                          holeScores.forEach((s) => {
                            const pl = [...others, me].find((p) => p.id === s.player_id); if (!pl) return;
                            const net = s.score - getHcpStrokes(pl.handicap, h.stroke_index);
                            if (net < lowest) { lowest = net; winner = s.player_id; }
                          });
                          thirdValue = (winner === player.id ? "W" : "L") + " $" + bet;
                          thirdColor = winner === player.id ? "#22c55e" : "#ef4444";
                        }
                      }
                      return (
                        <div key={player.id + h.hole_number} style={{ minWidth: 36, flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ fontSize: 9, color: "#475569", height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{h.hole_number}</div>
                          <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {g ? <div style={{ ...shapeStyle(gs), fontSize: 11 }}>{gn}</div> : <div style={{ fontSize: 12, color: "#334155" }}>—</div>}
                          </div>
                          <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {g ? <div style={{ ...shapeStyle(ns), fontSize: 11 }}>{nn}</div> : <div style={{ fontSize: 12, color: "#334155" }}>—</div>}
                          </div>
                          {(round.game_type === "stableford" || round.game_type === "matchplay") && (
                            <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: thirdColor }}>{thirdValue}</div>
                          )}
                          {round.game_type === "banker" && (() => {
                            const hScores = allScores.filter((s) => s.hole_number === h.hole_number);
                            const allP5 = [...others, me];
                            const allScored5 = allP5.every((p) => hScores.some((s) => s.player_id === p.id && s.score > 0));
                            if (!allScored5) return <div style={{ height: 20 }} />;
                            const bankerId5 = hScores[0]?.banker_id;
                            const doubled5 = hScores.some((s) => s.doubled);
                            let low5 = Infinity, win5 = null, tie5 = false;
                            hScores.forEach((s) => { const pl = allP5.find((p) => p.id === s.player_id); if (!pl || !s.score) return; const net = s.score - getHcpStrokes(pl.handicap, h.stroke_index); if (net < low5) { low5 = net; win5 = s.player_id; tie5 = false; } else if (net === low5) tie5 = true; });
                            const pScore = hScores.find((s) => s.player_id === player.id);
                            const pBet = pScore?.bet || 0;
                            let pChange = 0;
                            if (!tie5 && pBet > 0) {
                              if (player.id === bankerId5) {
                                hScores.forEach((s) => { if (s.player_id === bankerId5 || !s.score) return; if (win5 === bankerId5) pChange += (s.bet||0); else pChange -= (s.bet||0); });
                              } else {
                                if (win5 === player.id && win5 !== bankerId5) pChange = pBet;
                                else if (win5 === bankerId5) pChange = -pBet;
                              }
                            }
                            const pCol = pChange > 0 ? "#22c55e" : pChange < 0 ? "#ef4444" : "#94a3b8";
                            const isBanker5 = player.id === bankerId5;
                            return (
                              <div style={{ height: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: pCol }}>{tie5 ? "T" : pChange > 0 ? "W" : "L"}</div>
                                <div style={{ fontSize: 8, color: pCol }}>{pChange !== 0 ? (pChange > 0 ? "+$" : "-$") + Math.abs(pChange) : ""}</div>
                                {isBanker5 && <div style={{ fontSize: 7 }}>🏦</div>}
                                {doubled5 && <div style={{ fontSize: 7 }}>🔥</div>}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                  {/* Running totals pinned right */}
                  <div style={{ display: "flex", flexDirection: "column", paddingTop: 14, marginLeft: 6, paddingLeft: 6, borderLeft: "1px solid #334155", flexShrink: 0 }}>
                    <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: pGrossTotal === 0 ? "#94a3b8" : pGrossTotal > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(pGrossTotal)}</div>
                    <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: pNetTotal === 0 ? "#94a3b8" : pNetTotal > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(pNetTotal)}</div>
                    {round.game_type === "stableford" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: "#22c55e" }}>
                        {holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + stablefordPoints(s.score, h.par, getHcpStrokes(player.handicap, h.stroke_index)); }, 0)}pts
                      </div>
                    )}
                    {round.game_type === "matchplay" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                        {(() => {
                          let won = 0, lost = 0;
                          holes.forEach((hole) => {
                            const myS = ps.find((s) => s.hole_number === hole.hole_number); if (!myS) return;
                            const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
                            const allP3 = [...others, me];
                            if (!allP3.every((p) => holeScores.some((s) => s.player_id === p.id))) return;
                            let lowest = Infinity, winner = null, tied = false;
                            holeScores.forEach((s) => { const pl = allP3.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) { lowest = net; winner = s.player_id; tied = false; } else if (net === lowest) { tied = true; } });
                            if (!tied) { if (winner === player.id) won++; else lost++; }
                          });
                          const lead = won - lost;
                          const col = lead > 0 ? "#22c55e" : lead < 0 ? "#ef4444" : "#94a3b8";
                          return <span style={{ color: col }}>{lead === 0 ? "Sq" : lead > 0 ? lead + " Up" : Math.abs(lead) + " Dn"}</span>;
                        })()}
                      </div>
                    )}
                    {round.game_type === "banker" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                        {(() => {
                          // Same direct calc as myBankerTotal but for this player
                          let total = 0;
                          holes.forEach((hole) => {
                            const pScore = ps.find((s) => s.hole_number === hole.hole_number); if (!pScore || !pScore.score) return;
                            const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
                            const allP = [...others, me];
                            if (!allP.every((p) => holeScores.some((s) => s.player_id === p.id && s.score > 0))) return;
                            const bankerId = pScore.banker_id || holeScores[0]?.banker_id;
                            const isBanker = bankerId === player.id;
                            let lowest = Infinity;
                            holeScores.forEach((s) => { const pl = allP.find((p) => p.id === s.player_id); if (!pl || !s.score) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) lowest = net; });
                            const winners = holeScores.filter((s) => { const pl = allP.find((p) => p.id === s.player_id); if (!pl || !s.score) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowest; }).map((s) => s.player_id);
                            const allTied = winners.length === allP.length;
                            if (allTied) return;
                            const bankerWon = winners.includes(bankerId);
                            if (isBanker) {
                              if (bankerWon) { holeScores.forEach((s) => { if (s.player_id === player.id || !s.score) return; if (!winners.includes(s.player_id)) total += (s.bet || 0); }); }
                              else { holeScores.forEach((s) => { if (s.player_id === player.id || !s.score) return; if (winners.includes(s.player_id)) total -= (s.bet || 0); }); }
                            } else {
                              const bet = pScore.bet || 0;
                              if (!bet) return;
                              if (winners.includes(player.id) && !bankerWon) total += bet;
                              else if (bankerWon && !winners.includes(player.id)) total -= bet;
                            }
                          });
                          return <span style={{ color: total > 0 ? "#22c55e" : total < 0 ? "#ef4444" : "#94a3b8" }}>{total >= 0 ? "+$" : "-$"}{Math.abs(total)}</span>;
                        })()}
                      </div>
                    )}
                    {false && round.game_type === "banker_disabled" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                        {(() => {
                          let total = 0;
                          const allP4 = [...others, me];
                          holes.forEach((hole) => {
                            const myS = ps.find((s) => s.hole_number === hole.hole_number); if (!myS) return;
                            const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
                            if (!allP4.every((p) => holeScores.some((s) => s.player_id === p.id))) return;
                            const bankerId = myS.banker_id || holeScores[0]?.banker_id;
                            const doubled = holeScores.some((s) => s.doubled);
                            const isBanker = bankerId === player.id;
                            let lowest = Infinity, winner = null, tied = false;
                            holeScores.forEach((s) => { const pl = allP4.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) { lowest = net; winner = s.player_id; tied = false; } else if (net === lowest) { tied = true; } });
                            if (tied) return;
                            // Find lowest net and winners for this hole
                            let lowestOth = Infinity;
                            holeScores.forEach((s) => { const pl = allP4.find((p) => p.id === s.player_id); if (!pl || s.score === 0) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowestOth) lowestOth = net; });
                            const winnersOth = holeScores.filter((s) => { const pl = allP4.find((p) => p.id === s.player_id); if (!pl || s.score === 0) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowestOth; }).map((s) => s.player_id);
                            const bankerWonOth = winnersOth.includes(bankerId);
                            if (isBanker) {
                              if (bankerWonOth) { holeScores.forEach((s) => { if (s.player_id === player.id || s.score === 0) return; if (!winnersOth.includes(s.player_id)) total += (s.bet || 0); }); }
                              else { holeScores.forEach((s) => { if (s.player_id === player.id || s.score === 0) return; if (winnersOth.includes(s.player_id)) total -= (s.bet || 0); }); }
                            } else {
                              const myBet = (myS.bet || 0);
                              if (myBet > 0) { if (winnersOth.includes(player.id) && !bankerWonOth) total += myBet; else if (bankerWonOth && !winnersOth.includes(player.id)) total -= myBet; }
                            }
                          });
                          return <span style={{ color: total > 0 ? "#22c55e" : total < 0 ? "#ef4444" : "#94a3b8" }}>{total >= 0 ? "+$" : "-$"}{Math.abs(total)}</span>;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PAST ROUNDS SCREEN
// =============================================================================
function PastRoundsScreen({ onBack, onViewRound }) {
  const [rounds, setRounds] = useState(getSavedRounds());
  const profile = getPlayerProfile();
  useEffect(() => {
    (async () => {
      if (profile.name) {
        const remote = await getSavedRoundsFromSupabase(profile.name);
        const local = getSavedRounds();
        const merged = [...remote, ...local.filter((l) => !remote.some((r) => r.id === l.id))];
        setRounds(merged);
      }
    })();
  }, []);

  const handleDelete = (roundId, courseName) => {
    if (window.confirm("Remove " + courseName + " from your history?")) {
      deleteSavedRound(roundId);
      setRounds(getSavedRounds());
    }
  };

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>Past Rounds</h2>
        <div />
      </div>
      <div style={S.content}>
        {rounds.length === 0 ? (
          <div style={S.empty}>No saved rounds yet. Save a round from the leaderboard screen.</div>
        ) : (
          rounds.map((r) => {
            const lb = calcLeaderboard(r.players, r.scores, r.holes, r.game_type);
            const winner = lb[0];
            return (
              <div key={r.id} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "16px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{r.course_name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{GAME_TYPES[r.game_type]?.label} · {r.date}</div>
                  </div>
                  <button style={{ ...S.smallBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => handleDelete(r.id, r.course_name)}>Remove</button>
                </div>
                {winner && (
                  <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>
                    🏆 <span style={{ color: "#f59e0b", fontWeight: 700 }}>{winner.name}</span>
                    {" · "}
                    {r.game_type === "stableford" ? winner.total + " pts"
                      : r.game_type === "banker" ? "$" + winner.total
                      : formatToPar(winner.toPar)}
                  </div>
                )}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                  {lb.map((p) => (
                    <div key={p.id} style={{ backgroundColor: "#0f172a", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#94a3b8" }}>
                      {p.name} ({p.holesPlayed}/18)
                    </div>
                  ))}
                </div>
                <button style={{ ...S.btnSecondary, marginTop: 0, padding: "10px", fontSize: 13 }} onClick={() => onViewRound(r)}>
                  View Scorecard
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN APP
// =============================================================================
export default function GolfApp() {
  const [screen, setScreen] = useState("home");
  const [round, setRound] = useState(null);
  const [me, setMe] = useState(null);
  const [lastRound, setLastRound] = useState(null);
  const [joinCode, setJoinCode] = useState(null);
  const [savedRounds, setSavedRounds] = useState(getSavedRounds());
  const [viewingRound, setViewingRound] = useState(null);
  const [adminLevel, setAdminLevel] = useState("regular");

  useEffect(() => {
    // Check for QR code join link ?join=XXXXXX
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    if (code) { setJoinCode(code); setScreen("join"); }

    // Load last round
    setLastRound(loadLastRound());
  }, []);

  const handleRejoin = () => {
    if (!lastRound) return;
    setRound(lastRound.round);
    setMe(lastRound.me);
    setScreen("dashboard");
  };

  return (
    <div style={S.app}>
      {screen === "home" && <HomeScreen onCreateRound={() => setScreen("create")} onJoinRound={() => setScreen("join")} onAdminLogin={() => setScreen("admin_login")} onRejoin={handleRejoin} lastRound={lastRound} savedRounds={savedRounds} onViewHistory={() => setScreen("history")} onViewTournaments={() => setScreen("tournaments")} />}
      {screen === "history" && <PastRoundsScreen onBack={() => setScreen("home")} onViewRound={(r) => { setViewingRound(r); setScreen("view_round"); }} />}
      {screen === "tournaments" && <TournamentScreen onBack={() => setScreen("home")} />}
      {screen === "view_round" && viewingRound && (
        <div style={S.screen}>
          <div style={S.header}>
            <button style={S.backBtn} onClick={() => setScreen("history")}>← Back</button>
            <h2 style={S.headerTitle}>{viewingRound.course_name}</h2>
            <button style={{ ...S.smallIconBtn, fontSize: 11, padding: "5px 8px" }} onClick={() => exportScorecardPDF(viewingRound, viewingRound.players, viewingRound.scores, viewingRound.holes)}>PDF</button>
          </div>
          <div style={S.content}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{GAME_TYPES[viewingRound.game_type]?.label} · {viewingRound.date} · Created by {viewingRound.createdBy || "Unknown"}</div>
            <div style={{ overflowX: "auto", marginBottom: 20 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%" }}>
                <thead>
                  <tr>
                    <td style={{ padding: "6px 8px", backgroundColor: "#1e293b", color: "#64748b", fontWeight: 700, whiteSpace: "nowrap", minWidth: 100 }}>Player</td>
                    {viewingRound.holes?.map((h) => <td key={h.hole_number} style={{ padding: "5px 3px", backgroundColor: "#1e293b", color: "#64748b", textAlign: "center", minWidth: 24 }}>{h.hole_number}</td>)}
                    <td style={{ padding: "5px 6px", backgroundColor: "#1e293b", color: "#94a3b8", fontWeight: 700, textAlign: "center" }}>Tot</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 8px", backgroundColor: "#0f172a", color: "#475569" }}>Par</td>
                    {viewingRound.holes?.map((h) => <td key={h.hole_number} style={{ padding: "4px 3px", backgroundColor: "#0f172a", color: "#475569", textAlign: "center" }}>{h.par}</td>)}
                    <td style={{ padding: "4px 6px", backgroundColor: "#0f172a", color: "#475569", textAlign: "center" }}>{viewingRound.holes?.reduce((s, h) => s + h.par, 0)}</td>
                  </tr>
                </thead>
                <tbody>
                  {calcLeaderboard(viewingRound.players, viewingRound.scores, viewingRound.holes, viewingRound.game_type).map((p, i) => (
                    <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? "#0f172a" : "#111827" }}>
                      <td style={{ padding: "5px 8px", color: "#f8fafc", fontWeight: 600, whiteSpace: "nowrap" }}>{i+1}. {p.name}</td>
                      {viewingRound.holes?.map((h) => {
                        const s = viewingRound.scores?.find((sc) => sc.player_id === p.id && sc.hole_number === h.hole_number);
                        const score = s?.score; const diff = score ? score - h.par : null;
                        let bg = "transparent";
                        if (diff !== null) { if (diff <= -1) bg = "#991b1b"; else if (diff === 1) bg = "#7f1d1d"; else if (diff >= 2) bg = "#4c0519"; }
                        return <td key={h.hole_number} style={{ padding: "4px 3px", textAlign: "center", backgroundColor: bg, color: "#fff", fontWeight: score ? 700 : 400, fontSize: 11 }}>{score || "—"}</td>;
                      })}
                      <td style={{ padding: "5px 6px", textAlign: "center", color: "#22c55e", fontWeight: 800 }}>
                        {viewingRound.game_type === "stableford" ? p.total + "pt" : viewingRound.game_type === "banker" ? (p.total >= 0 ? "+$" : "-$") + Math.abs(p.total) : formatToPar(p.toPar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 style={S.stepTitle}>Final Standings</h3>
            {calcLeaderboard(viewingRound.players, viewingRound.scores, viewingRound.holes, viewingRound.game_type).map((p, i) => (
              <div key={p.id} style={{ ...S.lbRow }}>
                <div style={{ ...S.lbPos, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>{i + 1}</div>
                <div style={S.lbName}>{p.name}<span style={S.lbHcp}>HCP {p.handicap}</span></div>
                <div style={S.lbRight}>
                  <div style={S.lbScore}>
                    {viewingRound.game_type === "stableford" ? p.total + " pts"
                      : viewingRound.game_type === "banker" ? (p.total >= 0 ? "+$" : "-$") + Math.abs(p.total)
                      : viewingRound.game_type === "matchplay" ? (p.total === 0 ? "All Sq" : p.total > 0 ? Math.floor(p.total) + " Up" : Math.abs(Math.floor(p.total)) + " Dn")
                      : <><div style={{ fontSize: 13, color: "#94a3b8" }}>Gross: {p.grossTotal}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{formatToPar(p.toPar)}</div></>}
                  </div>
                  <div style={S.lbHoles}>{p.holesPlayed}/18</div>
                  {/* Front 9 / Back 9 stats */}
                  {(() => {
                    const f9 = holes.filter((h) => h.hole_number <= 9);
                    const b9 = holes.filter((h) => h.hole_number > 9);
                    const calcNine = (nineHoles) => {
                      const playerScores = scores.filter((s) => s.player_id === p.id && nineHoles.some((h) => h.hole_number === s.hole_number));
                      if (playerScores.length === 0) return null;
                      const gross = playerScores.reduce((sum, s) => sum + s.score, 0);
                      const par = playerScores.reduce((sum, s) => sum + (nineHoles.find((h) => h.hole_number === s.hole_number)?.par || 0), 0);
                      return { gross, diff: gross - par, played: playerScores.length };
                    };
                    const f = calcNine(f9); const b = calcNine(b9);
                    if (!f) return null;
                    return (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        {f && <div style={{ flex: 1, backgroundColor: "#0f172a", borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>Front {f.played < 9 ? f.played + "/9" : "9"}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{f.gross}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: f.diff < 0 ? "#22c55e" : f.diff > 0 ? "#ef4444" : "#94a3b8" }}>{f.diff === 0 ? "E" : (f.diff > 0 ? "+" : "") + f.diff}</div>
                        </div>}
                        {b && <div style={{ flex: 1, backgroundColor: "#0f172a", borderRadius: 6, padding: "4px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase" }}>Back {b.played < 9 ? b.played + "/9" : "9"}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{b.gross}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: b.diff < 0 ? "#22c55e" : b.diff > 0 ? "#ef4444" : "#94a3b8" }}>{b.diff === 0 ? "E" : (b.diff > 0 ? "+" : "") + b.diff}</div>
                        </div>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {screen === "admin_login" && <AdminLoginScreen onBack={() => setScreen("home")} onLoginSuccess={(level) => { setAdminLevel(level); setScreen("admin"); }} />}
      {screen === "admin" && adminLevel === "super" && <SuperAdminScreen onLogout={() => { localStorage.removeItem("ff_admin"); setScreen("home"); }} />}
      {screen === "admin" && adminLevel !== "super" && <AdminDashboardScreen onLogout={() => { localStorage.removeItem("ff_admin"); setScreen("home"); }} />}
      {screen === "create" && <CreateRoundScreen onBack={() => setScreen("home")} onRoundCreated={(r, p) => { setRound(r); setMe(p); setScreen("dashboard"); }} />}
      {screen === "join" && <JoinRoundScreen onBack={() => { setJoinCode(null); setScreen("home"); }} onJoined={(r, p) => { setRound(r); setMe(p); setJoinCode(null); setScreen("dashboard"); }} prefillCode={joinCode} />}
      {screen === "dashboard" && round && me && <PlayerDashboardScreen round={round} me={me} onViewScorecard={() => setScreen("scorecard")} onBack={() => { setScreen("home"); setRound(null); setMe(null); setLastRound(loadLastRound()); setSavedRounds(getSavedRounds()); }} />}
      {screen === "scorecard" && round && me && <ScorecardScreen round={round} me={me} onViewDashboard={() => setScreen("dashboard")} />}
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================
const S = {
  app: { minHeight: "100vh", backgroundColor: "#0f172a", color: "#e2e8f0", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", maxWidth: 480, margin: "0 auto", position: "relative" },
  screen: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  hero: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" },
  logoWrap: { textAlign: "center", marginBottom: 48 },
  logoIcon: { fontSize: 64, display: "block", marginBottom: 12 },
  appTitle: { fontSize: 42, fontWeight: 800, margin: 0, letterSpacing: "-1px", color: "#f8fafc" },
  tagline: { fontSize: 16, color: "#64748b", margin: "8px 0 0" },
  homeButtons: { width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 },
  adminLink: { background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 20px 16px", backgroundColor: "#1e293b", borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 10 },
  headerLeft: { display: "flex", flexDirection: "column" },
  headerCourse: { fontSize: 14, fontWeight: 600, color: "#f8fafc" },
  headerGame: { fontSize: 12, color: "#64748b" },
  headerTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#f8fafc" },
  adminBadge: { backgroundColor: "#f59e0b", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 6, letterSpacing: 1 },
  backBtn: { background: "none", border: "1px solid #334155", borderRadius: 8, color: "#22c55e", fontSize: 14, cursor: "pointer", padding: "8px 12px", fontFamily: "inherit" },
  lbBtn: { backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  smallIconBtn: { backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  content: { flex: 1, padding: "20px 20px 40px", overflowY: "auto" },
  stepWrap: { display: "flex", flexDirection: "column", gap: 16 },
  stepTitle: { fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "#f8fafc" },
  label: { fontSize: 13, color: "#94a3b8", fontWeight: 500 },
  input: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", color: "#f8fafc", fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit", WebkitAppearance: "none" },
  codeInput: { fontSize: 28, fontWeight: 800, textAlign: "center", letterSpacing: 6 },
  hint: { fontSize: 13, color: "#475569", margin: 0 },
  error: { fontSize: 13, color: "#ef4444", margin: 0 },
  btnPrimary: { backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer", width: "100%", fontFamily: "inherit", WebkitAppearance: "none" },
  btnSecondary: { backgroundColor: "transparent", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 8, fontFamily: "inherit", WebkitAppearance: "none" },
  btnShare: { backgroundColor: "#1e293b", color: "#f59e0b", border: "1px solid #f59e0b", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", fontFamily: "inherit", WebkitAppearance: "none" },
  btnDisabled: { backgroundColor: "#1e293b", color: "#475569", border: "none", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "not-allowed", width: "100%", fontFamily: "inherit", WebkitAppearance: "none" },
  courseList: { display: "flex", flexDirection: "column", gap: 8 },
  courseCard: { display: "flex", alignItems: "center", gap: 12, backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "12px 16px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", WebkitAppearance: "none" },
  courseCardSelected: { border: "1px solid #22c55e", backgroundColor: "#022c22" },
  courseIcon: { fontSize: 24 },
  courseName: { fontSize: 15, fontWeight: 600, color: "#f8fafc" },
  courseAddr: { fontSize: 12, color: "#64748b", marginTop: 2 },
  courseItem: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #1e293b" },
  courseActions: { display: "flex", gap: 8, width: "100%", flexDirection: "column", marginTop: 16 },
  smallBtn: { backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  holesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
  holeEdit: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px" },
  holeEditNum: { fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 },
  holeEditRow: { display: "flex", gap: 8 },
  smallLabel: { fontSize: 11, color: "#94a3b8", fontWeight: 500, display: "block", marginBottom: 4 },
  smallInput: { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 8px", color: "#f8fafc", fontSize: 14, fontWeight: 700, width: 50, textAlign: "center", outline: "none", fontFamily: "inherit" },
  gameList: { display: "flex", flexDirection: "column", gap: 8 },
  gameCard: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", WebkitAppearance: "none" },
  gameCardSelected: { border: "1px solid #22c55e", backgroundColor: "#022c22" },
  gameName: { fontSize: 15, fontWeight: 700, color: "#f8fafc" },
  gameDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },
  roundInfo: { display: "flex", alignItems: "center", gap: 12, backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 12, padding: "14px 16px", marginBottom: 20 },
  holeNav: { display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" },
  holeNavBtn: { minWidth: 40, width: 40, height: 36, borderRadius: 8, border: "none", outline: "1px solid #334155", outlineOffset: -1, backgroundColor: "#0f172a", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", WebkitAppearance: "none" },
  holeNavActive: { outline: "2px solid #22c55e", outlineOffset: -1, color: "#22c55e", backgroundColor: "#022c22", fontSize: 15, fontWeight: 900, zIndex: 1 },
  holeNavDone: { backgroundColor: "#1e3a1e", color: "#22c55e", border: "1px solid #22c55e" },
  holeCard: { margin: "16px", backgroundColor: "#1e293b", borderRadius: 16, padding: "20px", border: "1px solid #334155" },
  holeTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  holeNum: { fontSize: 24, fontWeight: 800, color: "#f8fafc" },
  holeMeta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  parBadge: { textAlign: "right" },
  parNum: { fontSize: 20, fontWeight: 700, color: "#f8fafc" },
  hcpBadge: { fontSize: 11, color: "#0f172a", backgroundColor: "#f59e0b", borderRadius: 6, padding: "2px 6px", fontWeight: 700, marginTop: 4, display: "inline-block" },
  scoreRow: { display: "flex", gap: 8, marginBottom: 16 },
  scoreBtn: { flex: 1, borderRadius: 12, padding: "12px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit", WebkitAppearance: "none" },
  scoreBtnNum: { fontSize: 22, fontWeight: 800 },
  scoreBtnLabel: { fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  customScore: { display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #334155", paddingTop: 12, marginTop: 4, gap: 12 },
  customLabel: { fontSize: 13, color: "#64748b" },
  customInput: { backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 8, padding: "8px 12px", color: "#f8fafc", fontSize: 18, fontWeight: 700, width: 60, textAlign: "center", outline: "none", fontFamily: "inherit" },
  scoreInfoBoxes: { display: "flex", flexDirection: "column", gap: 6, marginTop: 10 },
  scoreInfoSection: { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "6px 10px" },
  scoreInfoSectionTitle: { fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  scoreInfoRow: { display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" },
  scoreInfoCell: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 40, width: 40, flex: "0 0 auto", padding: "2px 0" },
  scoreInfoCellNumber: { fontSize: 9, color: "#64748b", fontWeight: 700, marginBottom: 2 },
  scoreInfoCellValue: { fontSize: 14, fontWeight: 800, color: "#22c55e" },
  lbRow: { display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #1e293b" },
  lbRowMe: { backgroundColor: "#022c22", borderRadius: 10, padding: "14px 12px", margin: "0 -12px" },
  lbPos: { fontSize: 18, fontWeight: 800, color: "#475569", width: 28, flexShrink: 0 },
  lbName: { flex: 1, fontSize: 16, fontWeight: 600, color: "#f8fafc" },
  lbHcp: { fontSize: 11, color: "#475569", fontWeight: 400, marginLeft: 8 },
  lbRight: { textAlign: "right" },
  lbScore: { fontSize: 18, fontWeight: 800, color: "#f8fafc" },
  lbHoles: { fontSize: 11, color: "#475569" },
  empty: { textAlign: "center", color: "#475569", padding: "40px 0", fontSize: 15 },
  modal: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", zIndex: 100 },
  modalContent: { backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "24px 20px 40px", width: "100%", maxHeight: "80vh", overflowY: "auto" },
  modalTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#f8fafc" },
  modalHint: { fontSize: 13, color: "#64748b", margin: "0 0 12px" },
  codeDisplay: { fontSize: 48, fontWeight: 900, letterSpacing: 6, color: "#22c55e", backgroundColor: "#022c22", padding: "16px 20px", borderRadius: 12, border: "1px solid #22c55e", marginBottom: 12, textAlign: "center" },
  urlBox: { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#64748b", wordBreak: "break-all", width: "100%", boxSizing: "border-box", marginBottom: 12 },
  otherPlayersSection: { margin: "16px", backgroundColor: "#1e293b", borderRadius: 12, padding: "16px", border: "1px solid #334155" },
  otherPlayersTitle: { fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  playerCard: { backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "12px", marginBottom: 12 },
  playerCardName: { fontSize: 12, fontWeight: 700, color: "#f8fafc", textTransform: "uppercase", letterSpacing: 0.5 },
  playerScoresRow: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" },
  playerHoleCell: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36, flex: "0 0 auto" },
  playerHoleNumber: { fontSize: 8, color: "#64748b", fontWeight: 700, marginBottom: 2 },
  playerScoreLine: { display: "flex", alignItems: "center", gap: 2 },
  playerScoreLabel: { color: "#94a3b8", fontWeight: 600, fontSize: 9 },
  playerScoreValue: { color: "#22c55e", fontWeight: 700, fontSize: 10, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" },
};
