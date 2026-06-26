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
  matchplay_teams: { label: "Team Best Ball",  description: "Teams compete, best net score per team wins each hole" },
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
// =============================================================================
// TOURNAMENT DB FUNCTIONS (Supabase)
// =============================================================================
async function dbGetTournaments() {
  const { data, error } = await supabase.from("tournaments").select("*").order("created_at", { ascending: false });
  if (error) { console.error("dbGetTournaments error:", error); return []; }
  // For each tournament, fetch its rounds
  const tournaments = data || [];
  await Promise.all(tournaments.map(async (t) => {
    const { data: rounds } = await supabase.from("tournament_rounds").select("*").eq("tournament_id", t.id).order("added_at", { ascending: true });
    t.rounds = (rounds || []).map((r) => ({ id: r.round_id, code: r.round_code, course_name: r.course_name, game_type: r.game_type, holes: r.holes, date: r.date, createdBy: r.created_by }));
  }));
  return tournaments;
}

async function dbCreateTournament(name, createdBy) {
  const id = genId();
  const { error } = await supabase.from("tournaments").insert([{ id, name, created_by: createdBy, created_at: new Date().toISOString() }]);
  if (error) throw error;
  return { id, name, created_by: createdBy, rounds: [] };
}

async function dbDeleteTournament(id) {
  await supabase.from("tournament_rounds").delete().eq("tournament_id", id);
  await supabase.from("tournaments").delete().eq("id", id);
}

async function dbAddRoundToTournament(tournamentId, roundSummary) {
  const row = {
    id: genId(),
    tournament_id: tournamentId,
    round_id: roundSummary.id,
    round_code: roundSummary.code,
    course_name: roundSummary.course_name,
    game_type: roundSummary.game_type,
    holes: roundSummary.holes,
    date: roundSummary.date,
    created_by: roundSummary.createdBy || null,
    added_at: new Date().toISOString(),
  };
  // Upsert by round_id + tournament_id to avoid duplicates
  const { data: existing } = await supabase.from("tournament_rounds").select("id").eq("tournament_id", tournamentId).eq("round_id", roundSummary.id);
  if (existing?.length > 0) {
    await supabase.from("tournament_rounds").update({ course_name: row.course_name, game_type: row.game_type, holes: row.holes, date: row.date }).eq("tournament_id", tournamentId).eq("round_id", roundSummary.id);
  } else {
    await supabase.from("tournament_rounds").insert([row]);
  }
}

// Legacy localStorage helpers kept for migration only
function getLegacyTournaments() {
  try { return JSON.parse(localStorage.getItem("ff_tournaments") || "[]"); } catch { return []; }
}
// Stub - no longer used for writes
function addRoundToTournament(tournamentId, roundSummary) {
  dbAddRoundToTournament(tournamentId, roundSummary).catch((e) => console.error("addRoundToTournament error:", e));
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
    {hole_number:9,par:4,stroke_index:8},{hole_number:10,par:4,stroke_index:17},
    {hole_number:11,par:4,stroke_index:11},{hole_number:12,par:3,stroke_index:3},
    {hole_number:13,par:4,stroke_index:13},{hole_number:14,par:4,stroke_index:15},
    {hole_number:15,par:5,stroke_index:9},{hole_number:16,par:4,stroke_index:7},
    {hole_number:17,par:3,stroke_index:1},{hole_number:18,par:5,stroke_index:5},
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
    {hole_number:1,par:4,stroke_index:13},{hole_number:2,par:4,stroke_index:11},
    {hole_number:3,par:3,stroke_index:7},{hole_number:4,par:4,stroke_index:15},
    {hole_number:5,par:5,stroke_index:5},{hole_number:6,par:4,stroke_index:1},
    {hole_number:7,par:3,stroke_index:9},{hole_number:8,par:5,stroke_index:17},
    {hole_number:9,par:4,stroke_index:3},{hole_number:10,par:4,stroke_index:14},
    {hole_number:11,par:4,stroke_index:8},{hole_number:12,par:3,stroke_index:18},
    {hole_number:13,par:4,stroke_index:2},{hole_number:14,par:5,stroke_index:12},
    {hole_number:15,par:4,stroke_index:10},{hole_number:16,par:4,stroke_index:16},
    {hole_number:17,par:3,stroke_index:4},{hole_number:18,par:5,stroke_index:6},
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
    {hole_number:1,par:5,stroke_index:14},{hole_number:2,par:3,stroke_index:6},
    {hole_number:3,par:4,stroke_index:10},{hole_number:4,par:4,stroke_index:2},
    {hole_number:5,par:4,stroke_index:16},{hole_number:6,par:4,stroke_index:4},
    {hole_number:7,par:3,stroke_index:12},{hole_number:8,par:5,stroke_index:8},
    {hole_number:9,par:4,stroke_index:18},{hole_number:10,par:4,stroke_index:7},
    {hole_number:11,par:5,stroke_index:1},{hole_number:12,par:3,stroke_index:15},
    {hole_number:13,par:4,stroke_index:11},{hole_number:14,par:4,stroke_index:5},
    {hole_number:15,par:3,stroke_index:17},{hole_number:16,par:4,stroke_index:9},
    {hole_number:17,par:4,stroke_index:3},{hole_number:18,par:5,stroke_index:13},
  ]},
  // SINGAPORE ELITE PRIVATE COURSES
  { id: "sentosa-serapong", name: "Sentosa Golf Club (Serapong)", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:9},{hole_number:2,par:3,stroke_index:15},
    {hole_number:3,par:4,stroke_index:1},{hole_number:4,par:5,stroke_index:5},
    {hole_number:5,par:4,stroke_index:3},{hole_number:6,par:4,stroke_index:7},
    {hole_number:7,par:4,stroke_index:11},{hole_number:8,par:3,stroke_index:17},
    {hole_number:9,par:4,stroke_index:13},{hole_number:10,par:4,stroke_index:10},
    {hole_number:11,par:4,stroke_index:4},{hole_number:12,par:5,stroke_index:14},
    {hole_number:13,par:4,stroke_index:6},{hole_number:14,par:3,stroke_index:16},
    {hole_number:15,par:5,stroke_index:8},{hole_number:16,par:4,stroke_index:2},
    {hole_number:17,par:3,stroke_index:18},{hole_number:18,par:4,stroke_index:12},
  ]},
  { id: "sentosa-tanjong", name: "Sentosa Golf Club (Tanjong)", par: 72, holes: [
    {hole_number:1,par:5,stroke_index:7},{hole_number:2,par:4,stroke_index:3},
    {hole_number:3,par:4,stroke_index:11},{hole_number:4,par:3,stroke_index:17},
    {hole_number:5,par:4,stroke_index:1},{hole_number:6,par:5,stroke_index:13},
    {hole_number:7,par:3,stroke_index:15},{hole_number:8,par:4,stroke_index:5},
    {hole_number:9,par:4,stroke_index:9},{hole_number:10,par:4,stroke_index:6},
    {hole_number:11,par:3,stroke_index:16},{hole_number:12,par:5,stroke_index:2},
    {hole_number:13,par:4,stroke_index:10},{hole_number:14,par:4,stroke_index:4},
    {hole_number:15,par:4,stroke_index:12},{hole_number:16,par:3,stroke_index:18},
    {hole_number:17,par:5,stroke_index:8},{hole_number:18,par:4,stroke_index:14},
  ]},
  { id: "laguna-masters", name: "Laguna National (Masters Course)", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:11},{hole_number:2,par:4,stroke_index:5},
    {hole_number:3,par:5,stroke_index:15},{hole_number:4,par:3,stroke_index:17},
    {hole_number:5,par:4,stroke_index:3},{hole_number:6,par:4,stroke_index:7},
    {hole_number:7,par:3,stroke_index:13},{hole_number:8,par:5,stroke_index:9},
    {hole_number:9,par:4,stroke_index:1},{hole_number:10,par:4,stroke_index:8},
    {hole_number:11,par:3,stroke_index:18},{hole_number:12,par:4,stroke_index:4},
    {hole_number:13,par:5,stroke_index:14},{hole_number:14,par:4,stroke_index:6},
    {hole_number:15,par:4,stroke_index:10},{hole_number:16,par:3,stroke_index:16},
    {hole_number:17,par:4,stroke_index:12},{hole_number:18,par:4,stroke_index:2},
  ]},
  { id: "tanah-merah-tampines", name: "Tanah Merah CC (Tampines)", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:11},{hole_number:2,par:4,stroke_index:1},
    {hole_number:3,par:4,stroke_index:5},{hole_number:4,par:3,stroke_index:7},
    {hole_number:5,par:5,stroke_index:3},{hole_number:6,par:3,stroke_index:15},
    {hole_number:7,par:4,stroke_index:9},{hole_number:8,par:5,stroke_index:13},
    {hole_number:9,par:4,stroke_index:17},{hole_number:10,par:5,stroke_index:8},
    {hole_number:11,par:4,stroke_index:14},{hole_number:12,par:4,stroke_index:12},
    {hole_number:13,par:4,stroke_index:10},{hole_number:14,par:3,stroke_index:18},
    {hole_number:15,par:4,stroke_index:4},{hole_number:16,par:3,stroke_index:16},
    {hole_number:17,par:4,stroke_index:2},{hole_number:18,par:5,stroke_index:6},
  ]},
  { id: "tanah-merah-garden", name: "Tanah Merah CC (Garden)", par: 71, holes: [
    {hole_number:1,par:4,stroke_index:9},{hole_number:2,par:4,stroke_index:3},
    {hole_number:3,par:4,stroke_index:11},{hole_number:4,par:4,stroke_index:1},
    {hole_number:5,par:3,stroke_index:17},{hole_number:6,par:4,stroke_index:7},
    {hole_number:7,par:5,stroke_index:13},{hole_number:8,par:3,stroke_index:15},
    {hole_number:9,par:4,stroke_index:5},{hole_number:10,par:4,stroke_index:8},
    {hole_number:11,par:4,stroke_index:2},{hole_number:12,par:3,stroke_index:16},
    {hole_number:13,par:4,stroke_index:10},{hole_number:14,par:3,stroke_index:18},
    {hole_number:15,par:4,stroke_index:4},{hole_number:16,par:5,stroke_index:14},
    {hole_number:17,par:4,stroke_index:6},{hole_number:18,par:5,stroke_index:12},
  ]},
  { id: "sicc-bukit", name: "Singapore Island CC (Bukit)", par: 71, holes: [
    {hole_number:1,par:4,stroke_index:13},{hole_number:2,par:3,stroke_index:15},
    {hole_number:3,par:4,stroke_index:7},{hole_number:4,par:5,stroke_index:3},
    {hole_number:5,par:3,stroke_index:17},{hole_number:6,par:4,stroke_index:1},
    {hole_number:7,par:4,stroke_index:5},{hole_number:8,par:4,stroke_index:11},
    {hole_number:9,par:4,stroke_index:9},{hole_number:10,par:4,stroke_index:14},
    {hole_number:11,par:4,stroke_index:2},{hole_number:12,par:3,stroke_index:8},
    {hole_number:13,par:5,stroke_index:6},{hole_number:14,par:3,stroke_index:16},
    {hole_number:15,par:4,stroke_index:4},{hole_number:16,par:4,stroke_index:10},
    {hole_number:17,par:4,stroke_index:12},{hole_number:18,par:4,stroke_index:18},
  ]},
  { id: "sicc-island", name: "Singapore Island CC (Island)", par: 72, holes: [
    {hole_number:1,par:4,stroke_index:13},{hole_number:2,par:4,stroke_index:3},
    {hole_number:3,par:3,stroke_index:15},{hole_number:4,par:5,stroke_index:5},
    {hole_number:5,par:4,stroke_index:1},{hole_number:6,par:4,stroke_index:11},
    {hole_number:7,par:3,stroke_index:17},{hole_number:8,par:5,stroke_index:9},
    {hole_number:9,par:4,stroke_index:7},{hole_number:10,par:4,stroke_index:7},
    {hole_number:11,par:3,stroke_index:13},{hole_number:12,par:5,stroke_index:9},
    {hole_number:13,par:3,stroke_index:17},{hole_number:14,par:4,stroke_index:11},
    {hole_number:15,par:4,stroke_index:3},{hole_number:16,par:4,stroke_index:5},
    {hole_number:17,par:4,stroke_index:15},{hole_number:18,par:5,stroke_index:1},
  ]},
  { id: "rnzaf-whenuapai", name: "RNZAF Whenuapai", par: 71, holes: [
    {hole_number:1,par:4,stroke_index:10},{hole_number:2,par:4,stroke_index:14},
    {hole_number:3,par:3,stroke_index:18},{hole_number:4,par:4,stroke_index:6},
    {hole_number:5,par:4,stroke_index:2},{hole_number:6,par:3,stroke_index:16},
    {hole_number:7,par:4,stroke_index:12},{hole_number:8,par:4,stroke_index:4},
    {hole_number:9,par:5,stroke_index:8},{hole_number:10,par:4,stroke_index:1},
    {hole_number:11,par:5,stroke_index:5},{hole_number:12,par:3,stroke_index:13},
    {hole_number:13,par:5,stroke_index:3},{hole_number:14,par:4,stroke_index:15},
    {hole_number:15,par:3,stroke_index:17},{hole_number:16,par:4,stroke_index:9},
    {hole_number:17,par:4,stroke_index:11},{hole_number:18,par:4,stroke_index:7},
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
      let myWon = 0;
      holes.forEach((hole) => {
        const myS = scores.find((s) => s.player_id === p.id && s.hole_number === hole.hole_number);
        if (!myS) return;
        const allH = scores.filter((s) => s.hole_number === hole.hole_number);
        if (!players.every((pl) => allH.some((s) => s.player_id === pl.id && s.score > 0))) return;
        let lowestNet = Infinity;
        allH.forEach((s) => { const pl = players.find((pl) => pl.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowestNet) lowestNet = net; });
        const holeWinners = allH.filter((s) => { const pl = players.find((pl) => pl.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowestNet; }).map((s) => s.player_id);
        const allTied = holeWinners.length === players.length;
        if (!allTied && holeWinners.includes(p.id)) myWon++;
      });
      total = myWon;
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
      total = myTeamWon;
    }

    if (gameType === "banker") {
      let bankerTotal = 0; const bankerHoleData = {};
      holes.forEach((hole) => {
        const myS = scores.find((s) => s.player_id === p.id && s.hole_number === hole.hole_number);
        if (!myS) return;
        const allH = scores.filter((s) => s.hole_number === hole.hole_number);
        const allHScores = allH.filter((s) => s.score > 0);
        if (!players.every((pl) => allHScores.some((s) => s.player_id === pl.id))) return;
        const bankerId = myS.banker_id || allH.find((s) => s.banker_id)?.banker_id;
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
        const holeWinner = winners.length === 1 ? winners[0] : null;
        const holeTied = winners.length !== 1 && winners.length > 0;
        // For display: did THIS player tie specifically with the banker?
        const bankerScore = allHScores.find((s) => s.player_id === bankerId);
        const myScore2 = allHScores.find((s) => s.player_id === p.id);
        const bankerNet = bankerScore ? (() => { const bp = players.find((pl) => pl.id === bankerId); return bp ? bankerScore.score - getHcpStrokes(bp.handicap, hole.stroke_index) : null; })() : null;
        const myNet2 = myScore2 ? (() => { const mp = players.find((pl) => pl.id === p.id); return mp ? myScore2.score - getHcpStrokes(mp.handicap, hole.stroke_index) : null; })() : null;
        const tiedWithBanker = !iAmBanker && bankerNet !== null && myNet2 !== null && myNet2 === bankerNet;
        let holeChange = 0;
        
        if (iAmBanker) {
          // Compare banker against each non-banker player individually
          allHScores.forEach((s) => {
            if (s.player_id === p.id) return; // skip self
            const pl = players.find((pl) => pl.id === s.player_id); if (!pl) return;
            const theirNet = s.score - getHcpStrokes(pl.handicap, hole.stroke_index);
            const bet = s.bet || allH.find((r) => r.player_id === s.player_id && r.bet > 0)?.bet || 0;
            if (bankerNet !== null && bet > 0) {
              if (bankerNet < theirNet) holeChange += bet;  // banker beat this player
              else if (bankerNet > theirNet) holeChange -= bet; // this player beat banker
              // equal = tied = $0
            }
          });
        } else {
          const myBet = myS.bet || allH.find((s) => s.player_id === p.id && s.bet > 0)?.bet || 0;
          if (myBet > 0 && bankerNet !== null && myNet2 !== null) {
            if (myNet2 < bankerNet) {
              // I beat the banker - collect my bet
              holeChange += myBet;
            } else if (myNet2 > bankerNet) {
              // Banker beat me - pay my bet
              holeChange -= myBet;
            }
            // myNet2 === bankerNet means tied with banker = $0
          }
        }
        bankerTotal += holeChange;
        const iBeatedBanker = !iAmBanker && bankerNet !== null && myNet2 !== null && myNet2 < bankerNet;
        bankerHoleData[hole.hole_number] = { bet: myS.bet || 0, effectiveBet: (myS.bet||0), iAmBanker, isWinner: iBeatedBanker, winnerId: holeWinner, tied: tiedWithBanker, holeChange, runningPot: bankerTotal, bankerId, doubled };
      });
      total = bankerTotal;
      holeScores.bankerHoleData = bankerHoleData;
    }

    return { ...p, total, holesPlayed, toPar, holeScores, grossTotal, netTotal };
  }).sort((a, b) => gameType === "stableford" || gameType === "banker" || gameType === "matchplay" || gameType === "matchplay_teams" ? b.total - a.total : a.total - b.total);
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
  // Always fetch fresh course holes from Supabase so fixing a course updates active rounds
  try {
    const { data: courseData } = await supabase.from("courses").select("holes").eq("id", data.course_id).maybeSingle();
    if (courseData?.holes && Array.isArray(courseData.holes) && courseData.holes.length > 0) {
      return { ...data, holes: courseData.holes };
    }
  } catch(e) { console.log("Fresh holes fetch failed, using stored holes", e); }
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
  const deletedIds = getDeletedCourseIds();
  return (data || []).filter((c) => !deletedIds.includes(c.id));
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

// Device ID - unique per device, stored in localStorage forever
function getDeviceId() {
  let id = localStorage.getItem("ff_device_id");
  if (!id) { id = genId(); localStorage.setItem("ff_device_id", id); }
  return id;
}

async function dbSaveRoundHistory(entry) {
  await supabase.from("saved_rounds").upsert({ id: entry.id, player_name: entry.createdBy, device_id: getDeviceId(), data: entry }, { onConflict: "id" });
}

async function dbGetRoundHistory(playerName) {
  const deviceId = getDeviceId();
  const { data } = await supabase.from("saved_rounds").select("*").order("created_at", { ascending: false });
  if (!data) return [];
  // Filter by device ID first, fall back to name match for rounds saved before device ID was added
  return data.filter((r) => {
    if (r.device_id && r.device_id !== deviceId) return false;
    return r.data?.players?.some((p) => p.name?.toLowerCase() === playerName?.toLowerCase());
  }).map((r) => r.data);
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
    const deviceId = getDeviceId();
    return all.filter((r) => {
      if (r.device_id && r.device_id !== deviceId) return false;
      return r.players?.some((p) => p.name?.toLowerCase() === playerName.toLowerCase());
    });
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
    device_id: getDeviceId(),
    date: new Date().toLocaleString("en-NZ", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
    createdBy: creator,
  };
  const filtered = existing.filter((r) => r.id !== round.id);
  const updated = [entry, ...filtered].slice(0, 20); // keep last 20
  localStorage.setItem("ff_saved_rounds", JSON.stringify(updated));
  try { await dbSaveRoundHistory(entry); } catch(e) { console.log("Remote save failed", e); }
  // Also refresh this round's data in any Supabase tournament it belongs to
  try {
    const allTourneys = await dbGetTournaments();
    await Promise.all(allTourneys.map(async (t) => {
      const existingR = t.rounds?.find((r) => r.id === round.id);
      if (existingR) { await dbAddRoundToTournament(t.id, { ...existingR, players, scores, holes }); }
    }));
  } catch(e) { console.log("Tournament refresh failed", e); }
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
function HomeScreen({ onCreateRound, onJoinRound, onWatchRound, onAdminLogin, onRejoin, lastRound, savedRounds, onViewHistory, onViewTournaments }) {
  const shareApp = () => {
    if (navigator.share) {
      navigator.share({ title: "Foxy Fairways", text: "Golf scoring app", url: "https://foxyfairway.netlify.app" }).catch(() => {});
    } else {
      navigator.clipboard.writeText("https://foxyfairway.netlify.app");
      alert("Link copied!");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Fixed background - iOS Safari compatible */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "url('/IMG_8877.jpeg')", backgroundSize: "cover", backgroundPosition: "center top", zIndex: 0 }} />
      {/* Lighter overlay */}
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(to bottom, rgba(10,18,35,0.4) 0%, rgba(10,18,35,0.35) 40%, rgba(10,18,35,0.65) 70%, rgba(10,18,35,0.92) 100%)", zIndex: 1, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(env(safe-area-inset-top, 44px) + 8px) 16px 0" }}>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>v1.1.25</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={shareApp} style={{ background: "rgba(15,23,42,0.6)", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8", fontSize: 10, fontWeight: 700, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(4px)" }}>SHARE</button>
            <button onClick={onAdminLogin} style={{ background: "rgba(15,23,42,0.6)", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8", fontSize: 10, fontWeight: 700, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.5px", backdropFilter: "blur(4px)" }}>ADMIN</button>
          </div>
        </div>

        {/* Header */}
        <div style={{ padding: "20px 24px 20px", textAlign: "center" }}>
          <img src="/logo.png" alt="Foxy Fairways" style={{ width: 80, height: 80, borderRadius: 20, boxShadow: "0 8px 40px rgba(0,0,0,0.5)", display: "block", margin: "0 auto 14px" }} onError={(e) => { e.target.style.display = "none"; }} />
          <div style={{ fontSize: 34, fontWeight: 900, color: "#f8fafc", letterSpacing: "-1px", lineHeight: 1, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>Foxy Fairways</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>Live Golf Scoring</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column" }}>

          {/* Last round */}
          {lastRound && (() => {
            const t = new Date(lastRound.savedAt).toLocaleString("en-NZ", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
            return (
              <div style={{ backgroundColor: "rgba(2,44,34,0.7)", border: "1px solid #22c55e22", borderRadius: 14, padding: "14px 16px", marginBottom: 16, backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>↩ Last Round</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lastRound.round.course_name}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2, marginBottom: 10 }}>{lastRound.me.name} · {GAME_TYPES[lastRound.round.game_type]?.label} · {t}</div>
                <button onClick={onRejoin} style={{ backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, width: "100%", cursor: "pointer", fontFamily: "inherit" }}>Continue →</button>
              </div>
            );
          })()}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(30,41,59,0.6)" }} />
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>New Round</div>
            <div style={{ flex: 1, height: 1, background: "rgba(30,41,59,0.6)" }} />
          </div>

          {/* Create button */}
          <button style={{ ...S.btnPrimary, marginBottom: 10 }} onClick={onCreateRound}>Create a Round</button>

          {/* Spacer */}
          <div style={{ flex: 1, minHeight: 20 }} />

          {/* Four small bottom buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[
              { label: "Join", icon: "\uD83E\uDD1D", action: onJoinRound },
              { label: "Watch", icon: "\uD83D\uDC40", action: onWatchRound },
              { label: "Past Rounds", icon: "\uD83D\uDCCB", action: onViewHistory },
              { label: "Tournaments", icon: "\uD83C\uDFC6", action: onViewTournaments },
            ].map((btn) => (
              <button key={btn.label} onClick={btn.action} style={{ background: "rgba(30,41,59,0.7)", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, color: "#94a3b8", fontSize: 10, fontWeight: 600, padding: "10px 4px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit", backdropFilter: "blur(8px)" }}>
                <span style={{ fontSize: 16 }}>{btn.icon}</span>
                <span style={{ fontSize: 9, textAlign: "center", lineHeight: 1.2 }}>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
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
    <BgScreen bg={BG_OTHER}>
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
    </BgScreen>
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
  const [saving, setSaving] = useState(false), [msg, setMsg] = useState(""), [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    (async () => {
      await dbSeedCourses();
      const c = await dbGetCourses();
      setCourses(c.length > 0 ? c.sort((a, b) => a.name.localeCompare(b.name)) : DEFAULT_COURSES.sort((a, b) => a.name.localeCompare(b.name)));
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
    } catch(e) { setMsg("Save failed: " + (e?.message || e?.toString() || "Unknown error")); }
    setSaving(false);
  };

  const updateHole = (i, field, val) => { const h = [...holes]; h[i] = { ...h[i], [field]: val === "" ? null : parseInt(val) }; setHoles(h); };

  return (
    <BgScreen bg={BG_OTHER}>
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
                {confirmDeleteId === c.id ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...S.smallBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={async () => {
                      try {
                        await dbDeleteCourse(c.id);
                        markCourseDeleted(c.id);
                        setCourses((prev) => prev.filter((x) => x.id !== c.id));
                        setMsg("Course deleted.");
                        setTimeout(() => setMsg(""), 2000);
                      } catch { setMsg("Delete failed."); }
                      setConfirmDeleteId(null);
                    }}>Confirm</button>
                    <button style={S.smallBtn} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={S.smallBtn} onClick={() => { setEditing(c); setHoles(c.holes || []); }}>Edit</button>
                    <button style={{ ...S.smallBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => setConfirmDeleteId(c.id)}>Delete</button>
                  </div>
                )}
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
            {/* Live par totals and SI validator */}
            {(() => {
              const front = holes.slice(0, 9).reduce((s, h) => s + (parseInt(h.par) || 0), 0);
              const back = holes.slice(9, 18).reduce((s, h) => s + (parseInt(h.par) || 0), 0);
              const total = front + back;
              const siVals = holes.map((h) => parseInt(h.stroke_index)).filter((v) => v > 0);
              const siSet = new Set(siVals);
              const siValid = siVals.length === 18 && siSet.size === 18 && siVals.reduce((s, v) => s + v, 0) === 171;
              return (
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Par Totals</div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>F9: <strong style={{ color: "#f8fafc" }}>{front}</strong></span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>B9: <strong style={{ color: "#f8fafc" }}>{back}</strong></span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>Total: <strong style={{ color: "#22c55e" }}>{total}</strong></span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: siValid ? "#22c55e" : "#ef4444" }}>
                    {siValid ? "✅ SI Balanced" : "❌ Check SI values"}
                  </div>
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              {/* Front 9 */}
              <div style={{ flex: 1, backgroundColor: "#0f172a", border: "2px solid #334155", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, textAlign: "center" }}>Front 9</div>
                {holes.slice(0, 9).map((hole, idx) => (
                  <div key={hole.hole_number} style={{ ...S.holeEdit, marginBottom: 8 }}>
                    <div style={S.holeEditNum}>Hole {hole.hole_number}</div>
                    <div style={S.holeEditRow}>
                      <div><label style={S.smallLabel}>Par</label>
                        <select value={hole.par} onChange={(e) => updateHole(idx, "par", e.target.value)} style={{ ...S.smallInput, backgroundColor: hole.par ? "#22c55e" : "#1e293b", color: hole.par ? "#0f172a" : "#f8fafc", fontWeight: hole.par ? 700 : 400 }}>
                          <option value="">-</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                        </select>
                      </div>
                      <div><label style={S.smallLabel}>SI</label>
                        <select value={hole.stroke_index} onChange={(e) => updateHole(idx, "stroke_index", e.target.value)} style={{ ...S.smallInput, backgroundColor: hole.stroke_index ? "#22c55e" : "#1e293b", color: hole.stroke_index ? "#0f172a" : "#f8fafc", fontWeight: hole.stroke_index ? 700 : 400 }}>
                          <option value="">-</option>{Array.from({length: 18}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                        </select>
                      </div>
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
                      <div><label style={S.smallLabel}>Par</label>
                        <select value={hole.par} onChange={(e) => updateHole(idx + 9, "par", e.target.value)} style={{ ...S.smallInput, backgroundColor: hole.par ? "#22c55e" : "#1e293b", color: hole.par ? "#0f172a" : "#f8fafc", fontWeight: hole.par ? 700 : 400 }}>
                          <option value="">-</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                        </select>
                      </div>
                      <div><label style={S.smallLabel}>SI</label>
                        <select value={hole.stroke_index} onChange={(e) => updateHole(idx + 9, "stroke_index", e.target.value)} style={{ ...S.smallInput, backgroundColor: hole.stroke_index ? "#22c55e" : "#1e293b", color: hole.stroke_index ? "#0f172a" : "#f8fafc", fontWeight: hole.stroke_index ? 700 : 400 }}>
                          <option value="">-</option>{Array.from({length: 18}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                        </select>
                      </div>
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
    </BgScreen>
  );
}


// =============================================================================
// SUPER ADMIN SCREEN
// =============================================================================
function SuperAdminScreen({ onLogout }) {
  const [tab, setTab] = useState("rounds");
  const [rounds, setRounds] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [blockName, setBlockName] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [editingTournamentId, setEditingTournamentId] = useState(null);
  const [editingTournamentName, setEditingTournamentName] = useState("");
  const [saCourses, setSaCourses] = useState([]);
  const [saEditingCourse, setSaEditingCourse] = useState(null);
  const [saEditingHoles, setSaEditingHoles] = useState([]);
  const [saSaving, setSaSaving] = useState(false);
  const [saConfirmDeleteCourseId, setSaConfirmDeleteCourseId] = useState(null);
  const [saScanning, setSaScanning] = useState(false);
  const [saScanError, setSaScanError] = useState("");
  const saFileInputRef = React.useRef(null);

  const handleScanScorecard = async (files) => {
    if (!files || files.length === 0) return;
    setSaScanning(true); setSaScanError("");
    try {
      const toBase64 = (file) => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const images = await Promise.all(Array.from(files).slice(0, 2).map(async (f) => ({
        type: "image",
        source: { type: "base64", media_type: f.type || "image/jpeg", data: await toBase64(f) }
      })));
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              ...images,
              { type: "text", text: "Read this golf scorecard. Return ONLY valid JSON, no other text. Format: {name: string, holes: array of 18 objects each with hole_number, par, stroke_index}. Use the official course name from the scorecard header. Include all 18 holes with correct par and stroke_index values." }
            ]
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed.name || !parsed.holes || parsed.holes.length !== 18) throw new Error("Invalid scorecard data");
      const newCourse = { id: genId(), name: parsed.name, par: parsed.holes.reduce((s, h) => s + h.par, 0), holes: parsed.holes.map((h) => ({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index })) };
      setSaEditingCourse(newCourse);
      setSaEditingHoles(newCourse.holes);
    } catch(e) {
      console.error(e);
      setSaScanError("Could not read scorecard. Please check the image is clear and try again.");
    }
    setSaScanning(false);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [r, b, t, c] = await Promise.all([dbGetAllRounds(), dbGetBlockedPlayers(), dbGetTournaments(), dbGetCourses()]);
      const { data: pd } = await supabase.from("players").select("*").eq("is_placeholder", false).order("created_at", { ascending: false });
      setRounds(r); setBlocked(b); setAllPlayers(pd || []); setTournaments(t); setSaCourses(c); setLoading(false);
    })();
  }, []);

  const saUpdateHole = (i, field, val) => { const h = [...saEditingHoles]; h[i] = { ...h[i], [field]: val === "" ? null : parseInt(val) }; setSaEditingHoles(h); };

  const saSaveCourse = async () => {
    if (!saEditingCourse) return;
    setSaSaving(true);
    try {
      const final = { ...saEditingCourse, holes: saEditingHoles };
      await dbSaveCourse(final);
      setSaCourses((prev) => { const idx = prev.findIndex((c) => c.id === final.id); if (idx >= 0) { const u = [...prev]; u[idx] = final; return u; } return [...prev, final]; });
      setMsg("Course saved."); setTimeout(() => setMsg(""), 2000);
      setSaEditingCourse(null); setSaEditingHoles([]);
    } catch(e) { setMsg("Save failed."); }
    setSaSaving(false);
  };

  const handleDeleteTournament = async (t) => {
    if (!window.confirm('Delete tournament ' + t.name + '? Cannot be undone.')) return;
    await dbDeleteTournament(t.id);
    setTournaments((prev) => prev.filter((x) => x.id !== t.id));
    setMsg("Tournament deleted."); setTimeout(() => setMsg(""), 2000);
  };

  const handleRenameTournament = async (t) => {
    if (!editingTournamentName.trim()) return;
    await supabase.from("tournaments").update({ name: editingTournamentName.trim() }).eq("id", t.id);
    setTournaments((prev) => prev.map((x) => x.id === t.id ? { ...x, name: editingTournamentName.trim() } : x));
    setEditingTournamentId(null); setEditingTournamentName("");
    setMsg("Tournament renamed."); setTimeout(() => setMsg(""), 2000);
  };

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
    <BgScreen bg={BG_OTHER}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onLogout}>← Logout</button>
        <h2 style={S.headerTitle}>Super Admin</h2>
        <div style={{ ...S.adminBadge, backgroundColor: "#ef4444" }}>SUPER</div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #334155" }}>
        {["rounds", "players", "blocked", "tournaments", "courses", "stats"].map((t) => (
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

        {tab === "players" && !loading && (
          <div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>{allPlayers.length} total players</div>
            {allPlayers.map((p) => (
              <div key={p.id} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>HCP {p.handicap} · {new Date(p.created_at).toLocaleDateString("en-NZ")} {new Date(p.created_at).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}</div>
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

        {tab === "tournaments" && !loading && (
          <div>
            {tournaments.length === 0 && <div style={S.empty}>No tournaments yet.</div>}
            {tournaments.map((t) => (
              <div key={t.id} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                {editingTournamentId === t.id ? (
                  <div>
                    <input style={{ ...S.input, marginBottom: 8 }} value={editingTournamentName} onChange={(e) => setEditingTournamentName(e.target.value)} autoFocus />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.lbBtn, flex: 1 }} onClick={() => handleRenameTournament(t)}>Save</button>
                      <button style={{ ...S.btnSecondary, marginTop: 0, flex: 1, padding: "8px" }} onClick={() => { setEditingTournamentId(null); setEditingTournamentName(""); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{t.rounds?.length || 0} rounds</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setEditingTournamentId(t.id); setEditingTournamentName(t.name); }} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8", fontSize: 11, fontWeight: 600, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>Rename</button>
                      <button onClick={() => handleDeleteTournament(t)} style={{ background: "none", border: "1px solid #ef4444", borderRadius: 6, color: "#ef4444", fontSize: 11, fontWeight: 600, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                    </div>
                  </div>
                  {/* Round refresh buttons */}
                  {t.rounds?.length > 0 && (
                    <div style={{ marginTop: 10, borderTop: "1px solid #334155", paddingTop: 10 }}>
                      <div style={{ fontSize: 10, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Refresh course data per round</div>
                      {t.rounds.map((r) => (
                        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.course_name} · {r.code}</span>
                          <button onClick={async () => {
                            try {
                              // Fetch round to get course_id, then fetch fresh holes by ID
                              const { data: rd } = await supabase.from("rounds").select("course_id, holes").eq("id", r.id).maybeSingle();
                              const courseId = rd?.course_id;
                              const { data: cd } = courseId
                                ? await supabase.from("courses").select("holes").eq("id", courseId).maybeSingle()
                                : await supabase.from("courses").select("holes").eq("name", r.course_name).maybeSingle();
                              if (cd?.holes) {
                                await Promise.all([
                                  supabase.from("tournament_rounds").update({ holes: cd.holes }).eq("round_id", r.id).eq("tournament_id", t.id),
                                  supabase.from("rounds").update({ holes: cd.holes }).eq("id", r.id),
                                ]);
                                setMsg("Refreshed: " + r.course_name); setTimeout(() => setMsg(""), 3000);
                              } else { setMsg("Course not found in Supabase. Fix the course in Admin first."); setTimeout(() => setMsg(""), 4000); }
                            } catch(e) { setMsg("Refresh failed: " + e.message); setTimeout(() => setMsg(""), 3000); }
                          }} style={{ background: "none", border: "1px solid #22c55e", borderRadius: 6, color: "#22c55e", fontSize: 10, fontWeight: 600, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}>Refresh</button>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === "courses" && !loading && (
          <div>
            {!saEditingCourse ? (
              <div>
                {/* Scan Scorecard button */}
                <input ref={saFileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleScanScorecard(e.target.files)} />
                <button onClick={() => saFileInputRef.current?.click()} disabled={saScanning} style={{ width: "100%", backgroundColor: "#1e293b", border: "2px dashed #22c55e", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, color: saScanning ? "#475569" : "#22c55e", cursor: saScanning ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 8 }}>
                  {saScanning ? "📷 Reading scorecard..." : "📷 Scan Scorecard (1-2 photos)"}
                </button>
                {saScanError && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{saScanError}</div>}
                <button onClick={() => { const c = { id: genId(), name: "", par: 72, holes: Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: null, stroke_index: null })) }; setSaEditingCourse(c); setSaEditingHoles(c.holes); }} style={{ width: "100%", backgroundColor: "#1e293b", border: "1px dashed #334155", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, color: "#64748b", cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>+ Add Course Manually</button>
                {saCourses.map((c) => (
                  <div key={c.id} style={S.courseItem}>
                    <div><div style={S.courseName}>{c.name}</div><div style={S.courseAddr}>18 holes</div></div>
                    {saConfirmDeleteCourseId === c.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...S.smallBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={async () => {
                          try { await dbDeleteCourse(c.id); markCourseDeleted(c.id); setSaCourses((prev) => prev.filter((x) => x.id !== c.id)); setMsg("Course deleted."); setTimeout(() => setMsg(""), 2000); } catch { setMsg("Delete failed."); }
                          setSaConfirmDeleteCourseId(null);
                        }}>Confirm</button>
                        <button style={S.smallBtn} onClick={() => setSaConfirmDeleteCourseId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={S.smallBtn} onClick={() => { setSaEditingCourse(c); setSaEditingHoles(c.holes || []); }}>Edit</button>
                        <button style={{ ...S.smallBtn, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => setSaConfirmDeleteCourseId(c.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <input style={{ ...S.input, marginBottom: 12, fontSize: 15, fontWeight: 700 }} placeholder="Course name" value={saEditingCourse.name || ""} onChange={(e) => setSaEditingCourse((prev) => ({ ...prev, name: e.target.value }))} />
                {(() => {
                  const front = saEditingHoles.slice(0, 9).reduce((s, h) => s + (parseInt(h.par) || 0), 0);
                  const back = saEditingHoles.slice(9, 18).reduce((s, h) => s + (parseInt(h.par) || 0), 0);
                  const siVals = saEditingHoles.map((h) => parseInt(h.stroke_index)).filter((v) => v > 0);
                  const siValid = siVals.length === 18 && new Set(siVals).size === 18 && siVals.reduce((s, v) => s + v, 0) === 171;
                  return (
                    <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Par Totals</div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>F9: <strong style={{ color: "#f8fafc" }}>{front}</strong></span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>B9: <strong style={{ color: "#f8fafc" }}>{back}</strong></span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>Total: <strong style={{ color: "#22c55e" }}>{front + back}</strong></span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: siValid ? "#22c55e" : "#ef4444" }}>{siValid ? "✅ SI Balanced" : "❌ Check SI values"}</div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  {[saEditingHoles.slice(0, 9), saEditingHoles.slice(9, 18)].map((nineHoles, ni) => (
                    <div key={ni} style={{ flex: 1, backgroundColor: "#0f172a", border: "2px solid #334155", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: ni === 0 ? "#22c55e" : "#3b82f6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, textAlign: "center" }}>{ni === 0 ? "Front 9" : "Back 9"}</div>
                      {nineHoles.map((hole, idx) => (
                        <div key={hole.hole_number} style={{ ...S.holeEdit, marginBottom: 8 }}>
                          <div style={S.holeEditNum}>Hole {hole.hole_number}</div>
                          <div style={S.holeEditRow}>
                            <div><label style={S.smallLabel}>Par</label>
                              <select value={hole.par || ""} onChange={(e) => saUpdateHole(ni * 9 + idx, "par", e.target.value)} style={{ ...S.smallInput, backgroundColor: hole.par ? "#22c55e" : "#1e293b", color: hole.par ? "#0f172a" : "#f8fafc", fontWeight: hole.par ? 700 : 400 }}>
                                <option value="">-</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                              </select>
                            </div>
                            <div><label style={S.smallLabel}>SI</label>
                              <select value={hole.stroke_index || ""} onChange={(e) => saUpdateHole(ni * 9 + idx, "stroke_index", e.target.value)} style={{ ...S.smallInput, backgroundColor: hole.stroke_index ? "#22c55e" : "#1e293b", color: hole.stroke_index ? "#0f172a" : "#f8fafc", fontWeight: hole.stroke_index ? 700 : 400 }}>
                                <option value="">-</option>{Array.from({length: 18}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={S.courseActions}>
                  <button style={S.btnPrimary} disabled={saSaving} onClick={saSaveCourse}>{saSaving ? "Saving..." : "Save Course"}</button>
                  <button style={S.btnSecondary} onClick={() => { setSaEditingCourse(null); setSaEditingHoles([]); }}>Cancel</button>
                </div>
              </div>
            )}
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
    </BgScreen>
  );
}

// =============================================================================
// CHAT PANEL (used inside ScorecardScreen)
// =============================================================================
function ChatPanel({ round, me, onClose, isSpectator }) {
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
    const msg = { id: genId(), round_id: round.id, player_id: me.id, player_name: isSpectator ? "Spectator" : me.name, text: text.trim(), created_at: new Date().toISOString() };
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
        {/* Quick reactions - hidden for spectators */}
        {!isSpectator && <div style={{ display: "flex", gap: 6, padding: "8px 16px", borderTop: "1px solid #334155", flexShrink: 0 }}>
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} onClick={() => send(emoji)} style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 0", fontSize: 18, cursor: "pointer" }}>{emoji}</button>
          ))}
        </div>}
        {/* Input - hidden for spectators */}
        {!isSpectator && <div style={{ display: "flex", gap: 8, padding: "8px 16px 32px", flexShrink: 0 }}>
          <input style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 20, padding: "10px 16px", color: "#f8fafc", fontSize: 14, outline: "none", fontFamily: "inherit" }}
            placeholder="Message..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} />
          <button onClick={() => send(input)} style={{ backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 20, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
        </div>}
        {isSpectator && <div style={{ padding: "10px 16px 32px", textAlign: "center", fontSize: 11, color: "#334155" }}>👀 Watching — join the round to chat</div>}
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
function RoundDetailScreen({ roundStub, onBack }) {
  const [round, setRound] = useState(null);
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewingScorecard, setViewingScorecard] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await dbGetRound(roundStub.code);
        const fullRound = { ...r, holes: r.holes?.length ? r.holes : (roundStub.holes || getHolesForRound(r)) };
        setRound(fullRound);
        const [p, s] = await Promise.all([dbGetPlayers(r.id), dbGetScores(r.id)]);
        setPlayers(p);
        setScores(s);
      } catch(e) {
        setErr("Could not load round data. Check your connection.");
      }
      setLoading(false);
    })();
  }, [roundStub.code]);

  if (loading) return (
    <BgScreen bg={BG_GAME}>
      <div style={S.header}><button style={S.backBtn} onClick={onBack}>← Back</button><h2 style={S.headerTitle}>{roundStub.course_name}</h2><div /></div>
      <div style={S.content}><div style={S.empty}>Loading round data...</div></div>
    </BgScreen>
  );

  if (err || !round) return (
    <BgScreen bg={BG_GAME}>
      <div style={S.header}><button style={S.backBtn} onClick={onBack}>← Back</button><h2 style={S.headerTitle}>{roundStub.course_name}</h2><div /></div>
      <div style={S.content}><div style={S.empty}>{err || "Round not found."}</div></div>
    </BgScreen>
  );

  if (viewingScorecard) {
    return <ScorecardScreen round={round} me={{ id: "spectator", name: "Spectator", handicap: 0 }} onViewDashboard={() => setViewingScorecard(false)} isSpectator={true} />;
  }

  return <PlayerDashboardScreen round={round} me={{ id: "spectator", name: "Spectator", handicap: 0 }} onViewScorecard={() => setViewingScorecard(true)} onBack={onBack} isSpectator={true} />;
}

function TournamentScreen({ onBack }) {
  const [tournaments, setTournaments] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [viewing, setViewing] = useState(null);
  const [viewingRound, setViewingRound] = useState(null);
  const [viewingScorecardFromTournament, setViewingScorecardFromTournament] = useState(false);
  const [liveRoundData, setLiveRoundData] = useState({}); // { [roundId]: { players, scores } }

  // Load tournaments from Supabase on mount
  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true);
    try {
      const t = await dbGetTournaments();
      setTournaments(t);
    } catch(e) { console.error("loadTournaments error:", e); }
    setLoadingTournaments(false);
  }, []);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  // When a tournament is opened, fetch live player+score data for all its rounds from Supabase
  useEffect(() => {
    if (!viewing) return;
    let cancelled = false;
    (async () => {
      const results = {};
      await Promise.all(viewing.rounds.map(async (r) => {
        try {
          const [p, s] = await Promise.all([dbGetPlayers(r.id), dbGetScores(r.id)]);
          if (!cancelled) results[r.id] = { players: p, scores: s };
        } catch(e) {}
      }));
      if (!cancelled) setLiveRoundData(results);
    })();
    return () => { cancelled = true; };
  }, [viewing?.id]);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      const t = await dbCreateTournament(newName.trim(), null);
      await loadTournaments();
      setNewName(""); setCreating(false);
    } catch(e) { console.error("create tournament error:", e); alert("Could not create tournament. Check your connection."); }
  };

  if (viewingRound) {
    return <RoundDetailScreen roundStub={viewingRound} onBack={() => setViewingRound(null)} />;
  }

  if (viewing) {
    // Build per-game-type season aggregates using live Supabase data
    const gameTypes = [...new Set(viewing.rounds.map((r) => r.game_type))];
    const seasonStats = {};
    gameTypes.forEach((gt) => {
      const gtRounds = viewing.rounds.filter((r) => r.game_type === gt);
      const playerMap = {};
      gtRounds.forEach((r) => {
        // Use live Supabase data if available, fall back to cached
        const live = liveRoundData[r.id];
        const players = live?.players || r.players;
        const scores = live?.scores || r.scores;
        if (!players?.length || !scores?.length) return;
        try {
          const lb = calcLeaderboard(players, scores, r.holes, gt);
          lb.forEach((p) => {
            if (!playerMap[p.name]) playerMap[p.name] = { name: p.name, rounds: 0, total: 0, toPar: 0, grossTotal: 0 };
            playerMap[p.name].rounds++;
            playerMap[p.name].total += p.total || 0;
            playerMap[p.name].toPar += p.toPar || 0;
            playerMap[p.name].grossTotal += p.grossTotal || 0;
          });
        } catch(e) {}
      });
      const sorted = Object.values(playerMap).sort((a, b) => {
        if (gt === "stableford" || gt === "matchplay" || gt === "matchplay_teams" || gt === "banker") return b.total - a.total;
        return a.toPar - b.toPar;
      });
      seasonStats[gt] = { rounds: gtRounds.length, players: sorted };
    });

    const gtLabel = { banker: "Banker", stableford: "Stableford", matchplay: "Match Play", matchplay_teams: "Team Best Ball", stroke: "Stroke Play" };
    const gtIcon = { banker: "🏦", stableford: "⭐", matchplay: "🏌️", matchplay_teams: "👥", stroke: "⛳" };

    const seasonMetricValue = (p, gt) => {
      if (gt === "banker") return (p.total >= 0 ? "+" : "") + "$" + Math.abs(p.total);
      if (gt === "stableford") return p.total + " pts";
      if (gt === "matchplay" || gt === "matchplay_teams") return p.total + " holes";
      return formatToPar(p.toPar);
    };
    const seasonMetricColor = (p, gt) => {
      if (gt === "banker") return p.total > 0 ? "#22c55e" : p.total < 0 ? "#ef4444" : "#94a3b8";
      if (gt === "stableford" || gt === "matchplay" || gt === "matchplay_teams") return "#22c55e";
      return p.toPar < 0 ? "#22c55e" : p.toPar > 0 ? "#ef4444" : "#3b82f6";
    };

    const tileMetricValue = (p, gt) => {
      if (gt === "banker") return (p.total >= 0 ? "+" : "") + "$" + Math.abs(p.total);
      if (gt === "stableford") return p.total + " pts";
      if (gt === "matchplay" || gt === "matchplay_teams") return p.total + " W";
      return formatToPar(p.toPar);
    };
    const tileMetricColor = (p, gt) => {
      if (gt === "banker") return p.total > 0 ? "#22c55e" : p.total < 0 ? "#ef4444" : "#94a3b8";
      return gt === "stroke" ? (p.toPar < 0 ? "#22c55e" : p.toPar > 0 ? "#ef4444" : "#3b82f6") : "#22c55e";
    };

    return (
      <BgScreen bg={BG_OTHER}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => setViewing(null)}>← Back</button>
          <h2 style={S.headerTitle}>{viewing.name}</h2>
          <div style={{ fontSize: 12, color: "#64748b" }}>{viewing.rounds.length} rounds</div>
        </div>
        <div style={S.content}>

          {/* Season Summaries per game type */}
          {gameTypes.length === 0 && <div style={S.empty}>No rounds with data yet. Save rounds after playing to see season stats.</div>}
          {gameTypes.map((gt) => {
            const stats = seasonStats[gt];
            if (!stats?.players?.length) return null;
            return (
              <div key={gt} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>{gtIcon[gt]} {gtLabel[gt]} Season · {stats.rounds} {stats.rounds === 1 ? "round" : "rounds"}</div>
                {stats.players.map((p, i) => (
                  <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < stats.players.length - 1 ? "1px solid #334155" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? "#f59e0b" : "#475569", width: 16 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: "#f8fafc" }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{p.rounds}R</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: seasonMetricColor(p, gt) }}>{seasonMetricValue(p, gt)}</span>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Individual Rounds */}
          {viewing.rounds.length > 0 && <h3 style={{ ...S.stepTitle, marginTop: 8 }}>Rounds</h3>}
          {viewing.rounds.map((r) => {
            const live = liveRoundData[r.id];
            const tilePlayers = live?.players || r.players;
            const tileScores = live?.scores || r.scores;
            const hasData = tilePlayers?.length > 0 && tileScores?.length > 0;
            let roundLb = [];
            if (hasData) {
              try { roundLb = calcLeaderboard(tilePlayers, tileScores, r.holes, r.game_type); } catch(e) {}
            }
            return (
              <div key={r.id} onClick={() => setViewingRound(r)} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: hasData ? 8 : 0 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>{r.course_name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{r.date} · {GAME_TYPES[r.game_type]?.label}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "#475569" }}>›</span>
                </div>
                {hasData && roundLb.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {roundLb.map((p, i) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: i === 0 ? "#f59e0b" : "#475569", width: 14, fontWeight: 700 }}>{i + 1}</span>
                          <span style={{ fontSize: 12, color: "#f8fafc" }}>{p.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: tileMetricColor(p, r.game_type) }}>{tileMetricValue(p, r.game_type)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!hasData && <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>Save round to see full data</div>}
              </div>
            );
          })}
        </div>
      </BgScreen>
    );
  }

  return (
    <BgScreen bg={BG_OTHER}>
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
        {loadingTournaments ? (
          <div style={S.empty}>Loading tournaments...</div>
        ) : tournaments.length === 0 && !creating ? (
          <div style={S.empty}>No tournaments yet. Create one to track a season!</div>
        ) : (
          tournaments.map((t) => (
            <button key={t.id} style={{ ...S.courseCard, marginBottom: 8, width: "100%" }} onClick={() => setViewing(t)}>
              <span style={S.courseIcon}>🏆</span>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={S.courseName}>{t.name}</div>
                <div style={S.courseAddr}>{t.rounds?.length || 0} rounds · Started {new Date(t.created_at).toLocaleDateString("en-NZ")}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </BgScreen>
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
  const [step, setStep] = useState(1), [courses, setCourses] = useState([...DEFAULT_COURSES].sort((a, b) => a.name.localeCompare(b.name)));
  const [course, setCourse] = useState(null), [gameType, setGameType] = useState("stroke");
  const [name, setName] = useState(profile.name || ""), [hcp, setHcp] = useState(profile.handicap || ""), [team, setTeam] = useState("A");
  const [selectedTournament, setSelectedTournament] = useState("");
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [availableTournaments, setAvailableTournaments] = useState([]);
  const [loadingAvailableTournaments, setLoadingAvailableTournaments] = useState(false);
  const [useHandicap, setUseHandicap] = useState(true);
  const [loading, setLoading] = useState(false), [err, setErr] = useState("");
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [courseEditing, setCourseEditing] = useState(null);
  const [courseHoles, setCourseHoles] = useState([]);
  const [addingCourse, setAddingCourse] = useState(false);

  useEffect(() => {
    (async () => {
      await dbSeedCourses();
      const c = await dbGetCourses();
      if (c.length > 0) setCourses(c);
    })();
  }, []);

  const startNewCourse = () => {
    const c = { id: genId(), name: newCourseName, par: 72, holes: Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: "", stroke_index: "" })) };
    setCourseEditing(c); setCourseHoles(c.holes); setNewCourseName("");
  };

  const saveNewCourse = async () => {
    if (!courseEditing) return;
    setAddingCourse(true);
    try {
      const final = { ...courseEditing, holes: courseHoles };
      await dbSaveCourse(final);
      const updated = await dbGetCourses();
      setCourses(updated);
      setCourse(final);
      setCourseEditing(null); setCourseHoles([]); setShowAddCourse(false);
    } catch(e) { console.error(e); alert("Save failed: " + (e?.message || e?.toString() || "Unknown error")); }
    setAddingCourse(false);
  };

  const updateCourseHole = (i, field, val) => {
    const h = [...courseHoles];
    h[i] = { ...h[i], [field]: val === "" ? null : parseInt(val) };
    setCourseHoles(h);
  };

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
        // Fetch full player and score data at round creation time so tournament has real data
        const [tournPlayers, tournScores] = await Promise.all([dbGetPlayers(round.id), dbGetScores(round.id)]);
        addRoundToTournament(selectedTournament, { id: round.id, code: round.code, course_name: round.course_name, game_type: round.game_type, holes: course.holes, players: tournPlayers, scores: tournScores, date: new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }), createdBy: name });
      }
      onRoundCreated(fullRound, me);
    } catch (e) { console.error(e); setErr("Could not create round. Please check your connection."); }
    setLoading(false);
  };

  return (
    <BgScreen bg={BG_HOME}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>New Round</h2><div />
      </div>
      <div style={S.content}>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "0 0 8px" }}>
              <h3 style={S.stepTitle}>Where are you playing?</h3>
              <button style={course ? S.btnPrimary : S.btnDisabled} disabled={!course} onClick={() => setStep(2)}>
                {course ? "Next → " + course.name : "Select a course to continue"}
              </button>
            </div>
            <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>

            {!showAddCourse && !courseEditing && (
              <button onClick={() => setShowAddCourse(true)} style={{ width: "100%", backgroundColor: "#1e293b", border: "1px dashed #334155", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, color: "#64748b", cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
                + Add a Course
              </button>
            )}

            {showAddCourse && !courseEditing && (
              <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 10 }}>Add New Course</div>
                <input style={{ ...S.input, marginBottom: 8 }} placeholder="Course name" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button style={newCourseName ? S.btnPrimary : S.btnDisabled} disabled={!newCourseName} onClick={startNewCourse}>Next: Enter Holes</button>
                  <button style={S.btnSecondary} onClick={() => { setShowAddCourse(false); setNewCourseName(""); }}>Cancel</button>
                </div>
              </div>
            )}

            {courseEditing && (
              <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 12 }}>{courseEditing.name}</div>
              {/* Live par totals */}
              {(() => {
                const front = courseHoles.slice(0, 9).reduce((s, h) => s + (parseInt(h.par) || 0), 0);
                const back = courseHoles.slice(9, 18).reduce((s, h) => s + (parseInt(h.par) || 0), 0);
                const total = front + back;
                const siVals = courseHoles.map((h) => parseInt(h.stroke_index)).filter((v) => v > 0);
                const siSet = new Set(siVals);
                const siValid = siVals.length === 18 && siSet.size === 18 && siVals.reduce((s, v) => s + v, 0) === 171;
                return (
                  <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Par Totals</div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>F9: <strong style={{ color: front > 0 ? "#f8fafc" : "#475569" }}>{front || "—"}</strong></span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>B9: <strong style={{ color: back > 0 ? "#f8fafc" : "#475569" }}>{back || "—"}</strong></span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>Total: <strong style={{ color: total > 0 ? "#22c55e" : "#475569" }}>{total || "—"}</strong></span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: siValid ? "#22c55e" : "#ef4444" }}>
                      {siValid ? "✅ SI Balanced" : "❌ Check SI values"}
                    </div>
                  </div>
                );
              })()}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, textAlign: "center" }}>Front 9</div>
                    {courseHoles.slice(0, 9).map((hole, idx) => (
                      <div key={hole.hole_number} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <div style={{ fontSize: 10, color: "#64748b", width: 36 }}>H{hole.hole_number}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: "#475569" }}>Par</div>
                          <select value={hole.par} onChange={(e) => updateCourseHole(idx, "par", e.target.value)} style={{ width: "100%", backgroundColor: hole.par ? "#22c55e" : "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "4px 8px", color: hole.par ? "#0f172a" : "#f8fafc", fontSize: 12, fontFamily: "inherit", fontWeight: hole.par ? 700 : 400 }}>
                            <option value="">-</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: "#475569" }}>SI</div>
                          <select value={hole.stroke_index} onChange={(e) => updateCourseHole(idx, "stroke_index", e.target.value)} style={{ width: "100%", backgroundColor: hole.stroke_index ? "#22c55e" : "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "4px 8px", color: hole.stroke_index ? "#0f172a" : "#f8fafc", fontSize: 12, fontFamily: "inherit", fontWeight: hole.stroke_index ? 700 : 400 }}>
                            <option value="">-</option>
                            {Array.from({length: 18}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, textAlign: "center" }}>Back 9</div>
                    {courseHoles.slice(9, 18).map((hole, idx) => (
                      <div key={hole.hole_number} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <div style={{ fontSize: 10, color: "#64748b", width: 36 }}>H{hole.hole_number}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: "#475569" }}>Par</div>
                          <select value={hole.par} onChange={(e) => updateCourseHole(idx + 9, "par", e.target.value)} style={{ width: "100%", backgroundColor: hole.par ? "#22c55e" : "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "4px 8px", color: hole.par ? "#0f172a" : "#f8fafc", fontSize: 12, fontFamily: "inherit", fontWeight: hole.par ? 700 : 400 }}>
                            <option value="">-</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: "#475569" }}>SI</div>
                          <select value={hole.stroke_index} onChange={(e) => updateCourseHole(idx + 9, "stroke_index", e.target.value)} style={{ width: "100%", backgroundColor: hole.stroke_index ? "#22c55e" : "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: "4px 8px", color: hole.stroke_index ? "#0f172a" : "#f8fafc", fontSize: 12, fontFamily: "inherit", fontWeight: hole.stroke_index ? 700 : 400 }}>
                            <option value="">-</option>
                            {Array.from({length: 18}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.btnPrimary} disabled={addingCourse} onClick={saveNewCourse}>{addingCourse ? "Saving..." : "Save Course"}</button>
                  <button style={S.btnSecondary} onClick={() => { setCourseEditing(null); setCourseHoles([]); setShowAddCourse(false); }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={S.courseList}>
              {courses.map((c) => (
                <button key={c.id} style={{ ...S.courseCard, ...(course?.id === c.id ? S.courseCardSelected : {}) }} onClick={() => setCourse(c)}>
                  <span style={S.courseIcon}>⛳</span>
                  <div style={{ flex: 1 }}>
                    <div style={S.courseName}>{c.name}</div>
                    <div style={S.courseAddr}>18 holes · Par {c.holes ? c.holes.reduce((s, h) => s + (h.par || 0), 0) : (c.par || "—")}</div>
                  </div>
                </button>
              ))}
            </div>
            </div>
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
            {err && <p style={S.error}>{err}</p>}
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => { setShowTournamentPicker(!showTournamentPicker); if (showTournamentPicker) setSelectedTournament(""); }}
                style={{ background: "none", border: "none", color: showTournamentPicker ? "#22c55e" : "#f8fafc", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>
                {showTournamentPicker ? "Remove tournament link" : "+ Link to a tournament (optional)"}
              </button>
              {showTournamentPicker && (() => {
                // Load tournaments from Supabase when picker opens
                if (availableTournaments.length === 0 && !loadingAvailableTournaments) {
                  setLoadingAvailableTournaments(true);
                  dbGetTournaments().then((t) => { setAvailableTournaments(t); setLoadingAvailableTournaments(false); }).catch(() => { setLoadingAvailableTournaments(false); });
                }
                return (
                  <div style={{ marginTop: 10 }}>
                    {loadingAvailableTournaments
                      ? <p style={{ ...S.hint, color: "#475569" }}>Loading tournaments...</p>
                      : availableTournaments.length === 0
                        ? <p style={{ ...S.hint, color: "#475569" }}>No tournaments yet. Create one from the Tournaments screen first.</p>
                        : <select style={S.input} value={selectedTournament} onChange={(e) => setSelectedTournament(e.target.value)}>
                            <option value="">Select tournament...</option>
                            {availableTournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                    }
                  </div>
                );
              })()}
            </div>
            <button style={name ? S.btnPrimary : S.btnDisabled} disabled={!name || loading} onClick={create}>{loading ? "Creating..." : "Create Round"}</button>
          </div>
        )}
      </div>
    </BgScreen>
  );
}

// =============================================================================
// JOIN ROUND
// =============================================================================
// WATCH ROUND SCREEN
// =============================================================================
function WatchRoundScreen({ onBack, onWatch, prefillCode }) {
  const [code, setCode] = useState(prefillCode || "");
  const [err, setErr] = useState(""), [loading, setLoading] = useState(false);


  useEffect(() => {
    if (prefillCode) {
      (async () => {
        setLoading(true);
        try { const r = await dbGetRound(prefillCode); onWatch({ ...r, holes: r.holes?.length ? r.holes : getHolesForRound(r) }); }
        catch { setErr("Round not found."); }
        setLoading(false);
      })();
    }
  }, [prefillCode]);

  const findAndWatch = async () => {
    if (!code) return;
    setLoading(true); setErr("");
    try {
      const r = await dbGetRound(code);
      onWatch({ ...r, holes: r.holes?.length ? r.holes : getHolesForRound(r) });
    } catch { setErr("Round not found. Check the code and try again."); }
    setLoading(false);
  };

  return (
    <BgScreen bg={BG_HOME}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>Watch a Round</h2><div />
      </div>
      <div style={S.content}>
        <div style={S.stepWrap}>
          <h3 style={S.stepTitle}>Enter round code</h3>
          <p style={S.hint}>Ask the round creator for the 6-letter code.</p>
          <input style={{ ...S.input, ...S.codeInput }} placeholder="ABC123" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} />
          {err && <p style={S.error}>{err}</p>}
          <button style={code.length >= 4 ? S.btnPrimary : S.btnDisabled} disabled={code.length < 4 || loading} onClick={findAndWatch}>{loading ? "Finding round..." : "👀 Watch Round"}</button>
        </div>
      </div>
    </BgScreen>
  );
}

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
      const fullRound = { ...round, holes: round.holes?.length ? round.holes : getHolesForRound(round) };
      saveLastRound(fullRound, me);
      onJoined(fullRound, me);
    } catch (e) { console.error(e); setErr("Failed to join. Please try again."); }
    setLoading(false);
  };

  if (loading && step === 0) return <BgScreen bg={BG_HOME}><div style={S.content}><div style={S.empty}>Loading round...</div></div></BgScreen>;

  return (
    <BgScreen bg={BG_HOME}>
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
    </BgScreen>
  );
}

// =============================================================================
// PLAYER DASHBOARD
// =============================================================================
function PlayerDashboardScreen({ round, me, onViewScorecard, onBack, isSpectator }) {
  const [players, setPlayers] = useState([]), [scores, setScores] = useState([]), [showShare, setShowShare] = useState(false), [showSpectatorQR, setShowSpectatorQR] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState(""), [guestHcp, setGuestHcp] = useState(""), [guestTeam, setGuestTeam] = useState("A"), [addingGuest, setAddingGuest] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerHcp, setEditPlayerHcp] = useState("");
  const [showTournamentLink, setShowTournamentLink] = useState(false);
  const [linkTournaments, setLinkTournaments] = useState([]);
  const [linkingTournament, setLinkingTournament] = useState("");
  const [linkingInProgress, setLinkingInProgress] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const completeDismissedRef = useRef(false);
  const holes = round.holes || [];

  const addGuest = async () => {
    if (!guestName.trim()) return;
    setAddingGuest(true);
    try {
      await dbCreatePlayer({ name: guestName.trim() + " (Guest)", handicap: round.use_handicap === false ? 0 : (parseFloat(guestHcp) || 0), round_id: round.id, team: round.game_type === "matchplay_teams" ? guestTeam : null, is_placeholder: false });
      setGuestName(""); setGuestHcp(""); setGuestTeam("A"); setShowAddGuest(false);
      const p = await dbGetPlayers(round.id); setPlayers(p);
    } catch(e) { console.error(e); }
    setAddingGuest(false);
  };

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
  const isHandicap = round.use_handicap !== false && round.use_handicap !== "false" && round.use_handicap !== 0;
  try { lb = calcLeaderboard(players, scores, holes, round.game_type); } catch(e) { lb = []; }
  if (lb.length === 0 && players.length > 0) { lb = players.map((p) => ({ ...p, total: 0, toPar: 0, grossTotal: 0, holesPlayed: 0 })); }

  return (
    <BgScreen bg={BG_GAME}>
      <div style={{ backgroundColor: "#1e293b", borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(env(safe-area-inset-top, 44px) + 8px) 16px 8px" }}>
          <button style={S.backBtn} onClick={() => { if (isSpectator || window.confirm("Exit round? It stays saved.")) onBack(); }}>← Back</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{round.course_name}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{GAME_TYPES[round.game_type]?.label}{round.use_handicap === false ? " · Scratch" : ""} · {me?.name} (HCP {me?.handicap})</div>
          </div>
          <button onClick={() => setShowShare(true)} style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 10px", fontFamily: "inherit", flexShrink: 0, opacity: 0 }} disabled>🔗</button>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "0 16px 10px" }}>
          {!isSpectator && <button style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 4px", fontFamily: "inherit" }} onClick={() => { saveRoundToHistory(round, players, scores, holes); alert("Round saved!"); }}>💾 Save Round</button>}
          <button style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 4px", fontFamily: "inherit" }} onClick={async () => { try { await exportScorecardPDF(round, players, scores, holes); } catch(e) { alert("Please allow popups to export scorecard"); } }}>📄 Scorecard</button>
        </div>
      </div>

      <div style={S.content}>
        <div style={{ textAlign: "center", marginBottom: 20, padding: 16, backgroundColor: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>
          {isSpectator
            ? <div style={{ display: "inline-block", backgroundColor: "#fff", borderRadius: 8, padding: 8, marginBottom: 8 }}>
                <QRCodeSVG value={window.location.origin + window.location.pathname + "?watch=" + round.code} size={72} bgColor="#ffffff" fgColor="#0f172a" />
              </div>
            : <div style={{ display: "inline-block", backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <QRCodeSVG value={window.location.origin + window.location.pathname + "?join=" + round.code} size={100} bgColor="#ffffff" fgColor="#0f172a" />
              </div>}
          <div style={{ fontSize: 13, color: "#94a3b8" }}>{isSpectator ? "Round code: " : "Scan to join · Code: "}<span style={{ color: "#22c55e", fontWeight: 700, letterSpacing: 2 }}>{round.code}</span></div>
          {isSpectator
            ? <button onClick={(e) => { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?watch=" + round.code); const btn = e.target; btn.textContent = "✓ Copied!"; btn.style.color = "#22c55e"; btn.style.borderColor = "#22c55e"; setTimeout(() => { btn.textContent = "👀 Copy Watch Link"; btn.style.color = "#94a3b8"; btn.style.borderColor = "#334155"; }, 1500); }} style={{ marginTop: 10, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "8px 16px", fontFamily: "inherit" }}>👀 Copy Watch Link</button>
            : <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={(e) => { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?join=" + round.code); const btn = e.target; btn.textContent = "✓ Copied!"; btn.style.color = "#22c55e"; btn.style.borderColor = "#22c55e"; setTimeout(() => { btn.textContent = "🏌️ Players Link"; btn.style.color = "#94a3b8"; btn.style.borderColor = "#334155"; }, 1500); }} style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 10px", fontFamily: "inherit" }}>🏌️ Players Link</button>
                <button onClick={() => setShowSpectatorQR(true)} style={{ flex: 1, backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "8px 10px", fontFamily: "inherit" }}>👀 Spectators</button>
              </div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button style={{ ...S.btnPrimary, flex: 1, fontSize: 17, marginBottom: 0 }} onClick={onViewScorecard}>⛳ Live Scoring</button>
          {me?.name === round.created_by && !isSpectator && <button onClick={() => setShowAddGuest(true)} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, color: "#94a3b8", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "0 14px", flexShrink: 0 }}>+ Guest</button>}
        </div>

        {/* Link to Tournament - creator only, not spectator */}
        {me?.name === round.created_by && !isSpectator && (
          <div style={{ marginBottom: 12 }}>
            {!showTournamentLink
              ? <button onClick={async () => { setShowTournamentLink(true); const t = await dbGetTournaments(); setLinkTournaments(t); }} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>🏆 Link to Tournament</button>
              : <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 10 }}>Link to Tournament</div>
                  {linkSuccess
                    ? <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>✓ Round linked to tournament!</div>
                    : linkTournaments.length === 0
                      ? <div style={{ fontSize: 12, color: "#475569" }}>No tournaments found. Create one from the home screen first.</div>
                      : <>
                          <select style={S.input} value={linkingTournament} onChange={(e) => setLinkingTournament(e.target.value)}>
                            <option value="">Select tournament...</option>
                            {linkTournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                          <button style={linkingTournament ? { ...S.btnPrimary, marginTop: 8, marginBottom: 0 } : { ...S.btnDisabled, marginTop: 8, marginBottom: 0 }} disabled={!linkingTournament || linkingInProgress} onClick={async () => {
                            if (!linkingTournament) return;
                            setLinkingInProgress(true);
                            try {
                              const [p, s] = await Promise.all([dbGetPlayers(round.id), dbGetScores(round.id)]);
                              await dbAddRoundToTournament(linkingTournament, { id: round.id, code: round.code, course_name: round.course_name, game_type: round.game_type, holes, players: p, scores: s, date: new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }), createdBy: me.name });
                              setLinkSuccess(true);
                              setTimeout(() => { setShowTournamentLink(false); setLinkSuccess(false); setLinkingTournament(""); }, 2000);
                            } catch(e) { console.error(e); alert("Could not link round. Check your connection."); }
                            setLinkingInProgress(false);
                          }}>{linkingInProgress ? "Linking..." : "Link Round"}</button>
                        </>
                  }
                  {!linkSuccess && <button onClick={() => { setShowTournamentLink(false); setLinkingTournament(""); }} style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 8, padding: 0 }}>Cancel</button>}
                </div>
            }
          </div>
        )}

        {showAddGuest && !isSpectator && (
          <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 12 }}>Add Guest Player</div>
            <label style={S.label}>Name</label>
            <input style={{ ...S.input, marginBottom: 10 }} placeholder="e.g. Matt" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            {round.use_handicap !== false && <>
              <label style={S.label}>Handicap</label>
              <input style={{ ...S.input, marginBottom: 10 }} type="number" step="0.1" placeholder="0" value={guestHcp} onChange={(e) => setGuestHcp(e.target.value)} />
            </>}
            {round.game_type === "matchplay_teams" && (
              <div style={{ marginBottom: 10 }}>
                <label style={S.label}>Team</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["A", "B"].map((t) => (
                    <button key={t} onClick={() => setGuestTeam(t)} style={{ flex: 1, backgroundColor: guestTeam === t ? "#22c55e" : "#0f172a", color: guestTeam === t ? "#0f172a" : "#94a3b8", border: "1px solid " + (guestTeam === t ? "#22c55e" : "#334155"), borderRadius: 10, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Team {t}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addGuest} disabled={!guestName.trim() || addingGuest} style={{ flex: 1, backgroundColor: guestName.trim() ? "#22c55e" : "#334155", color: guestName.trim() ? "#0f172a" : "#64748b", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: guestName.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>{addingGuest ? "Adding..." : "Add Guest"}</button>
              <button onClick={() => { setShowAddGuest(false); setGuestName(""); setGuestHcp(""); }} style={{ flex: 1, backgroundColor: "transparent", color: "#64748b", border: "1px solid #334155", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <h3 style={{ ...S.stepTitle, margin: 0 }}>Leaderboard</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 11, color: "#475569" }}>Live</span>
          </div>
          {round.game_type === "matchplay_teams" && lb.length > 0 && (() => {
            const teamAPts = lb.filter((p) => p.team === "A")[0]?.total || 0;
            const teamBPts = lb.filter((p) => p.team === "B")[0]?.total || 0;
            const diff = teamAPts - teamBPts;
            const label = diff === 0 ? "All Square" : diff > 0 ? `Team A leads by ${diff}` : `Team B leads by ${Math.abs(diff)}`;
            return (
              <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: diff === 0 ? "#94a3b8" : "#f59e0b", background: diff === 0 ? "#1e293b" : "#1a1200", border: `1px solid ${diff === 0 ? "#334155" : "#f59e0b66"}`, borderRadius: 8, padding: "4px 12px", whiteSpace: "nowrap" }}>{label}</div>
            );
          })()}
        </div>
        {lb.length === 0 ? <div style={S.empty}>Waiting for players...</div>
        : round.game_type === "matchplay_teams" ? (() => {
          const allPlayers = [...players];
          const teamAPts = lb.filter((p) => p.team === "A")[0]?.total || 0;
          const teamBPts = lb.filter((p) => p.team === "B")[0]?.total || 0;
          const diff = teamAPts - teamBPts;
          const statusLabel = diff === 0 ? "All Square" : diff > 0 ? `Team A leads by ${diff}` : `Team B leads by ${Math.abs(diff)}`;
          return (
            <div>
              {["A", "B"].map((tl, ti) => {
                const tc = tl === "A" ? "#22c55e" : "#3b82f6";
                const tp = lb.filter((p) => p.team === tl);
                const tt = tp[0]?.total || 0;
                // Per-hole team result pills
                const holePills = holes.map((hole) => {
                  const teamPlayers = allPlayers.filter((p) => p.team === tl);
                  const oppPlayers = allPlayers.filter((p) => p.team !== tl);
                  const allScored = allPlayers.every((pl) => {
                    const s = scores.find((x) => x.player_id === pl.id && x.hole_number === hole.hole_number);
                    return s && s.score > 0;
                  });
                  if (!allScored) return { h: hole.hole_number, res: null };
                  const bestNet = (grp) => grp.reduce((best, pl) => {
                    const s = scores.find((x) => x.player_id === pl.id && x.hole_number === hole.hole_number);
                    if (!s || !s.score) return best;
                    return Math.min(best, s.score - getHcpStrokes(pl.handicap, hole.stroke_index));
                  }, Infinity);
                  const myBest = bestNet(teamPlayers), oppBest = bestNet(oppPlayers);
                  if (myBest === Infinity || oppBest === Infinity) return { h: hole.hole_number, res: null };
                  if (myBest < oppBest) return { h: hole.hole_number, res: "W" };
                  if (myBest > oppBest) return { h: hole.hole_number, res: "L" };
                  return { h: hole.hole_number, res: "T" };
                });
                return (
                  <div key={tl} style={{ backgroundColor: tl === "A" ? "rgba(34,197,94,0.06)" : "rgba(59,130,246,0.06)", border: `1.5px solid ${tl === "A" ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)"}`, borderRadius: 14, padding: 14, marginBottom: ti === 0 ? 4 : 0, overflow: "hidden" }}>
                    {/* Team header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 10, borderBottom: "1px solid #1e293b", marginBottom: 10 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: tc, width: 28, flexShrink: 0 }}>{tl}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 3 }}>{tt === 0 ? "0 pts" : tt + (tt === 1 ? " pt" : " pts")} won</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5 }}>{tp.map((p) => p.name.replace(" (Guest)", "") + " (HCP " + p.handicap + ")").join(" & ")}</div>
                        <div style={{ display: "flex", gap: 3, overflowX: "auto", scrollbarWidth: "none" }}>
                          {holePills.map(({ h, res }) => (
                            <div key={h} style={{ minWidth: 26, background: "#0f172a", borderRadius: 5, padding: "2px 4px", textAlign: "center", border: "1px solid #1e293b", flexShrink: 0 }}>
                              <div style={{ fontSize: 7, color: "#475569" }}>H{h}</div>
                              <div style={{ fontSize: 10, fontWeight: 800, color: res === "W" ? "#22c55e" : res === "L" ? "#ef4444" : res === "T" ? "#94a3b8" : "#334155" }}>{res || "—"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: tc }}>{tt} {tt === 1 ? "pt" : "pts"}</div>
                        <div style={{ fontSize: 11, color: "#475569" }}>{(tp[0]?.holesPlayed || 0)}/18</div>
                      </div>
                    </div>
                    {/* Individual players */}
                    {tp.map((p, pi) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: pi < tp.length - 1 ? "1px solid #0f172a" : "none" }}>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#f8fafc" }}>{p.name.replace(" (Guest)", "")}{p.name.endsWith("(Guest)") ? <span style={{ fontSize: 10, color: "#475569", marginLeft: 4 }}>(Guest)</span> : ""}<span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, marginLeft: 6 }}>HCP {p.handicap}</span></div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: p.total > 0 ? tc : "#94a3b8" }}>{p.total} {p.total === 1 ? "pt" : "pts"}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })() : (
          lb.map((p, i) => (
            <div key={p.id}>
              <div style={{ ...S.lbRow, ...(p.id === me?.id ? S.lbRowMe : {}) }}>
                <div style={{ ...S.lbPos, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>{i + 1}</div>
                <div style={S.lbName}>{p.name}<span style={S.lbHcp}>HCP {p.handicap}</span></div>
                <div style={S.lbRight}>
                  <div style={S.lbScore}>
                    {round.game_type === "stableford" ? (p.total + " pts")
                      : round.game_type === "matchplay" ? (p.total === 0 ? "0 pts" : p.total + (p.total === 1 ? " pt" : " pts"))
                      : round.game_type === "banker" ? <span style={{ color: p.total > 0 ? "#22c55e" : p.total < 0 ? "#ef4444" : "#94a3b8", fontSize: 18, fontWeight: 800 }}>{p.total >= 0 ? "+$" : "-$"}{Math.abs(p.total)}</span>
                      : <>
                          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>Gross: {p.grossTotal || 0}{isHandicap ? "  Net: " + (p.netTotal || 0) : ""}</div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: p.toPar < 0 ? "#22c55e" : p.toPar > 0 ? "#ef4444" : "#94a3b8" }}>{formatToPar(p.toPar)}</span>
                            {isHandicap && <span style={{ fontSize: 14, fontWeight: 800, color: (p.toPar - parseInt(p.handicap||0)) < 0 ? "#22c55e" : (p.toPar - parseInt(p.handicap||0)) > 0 ? "#ef4444" : "#94a3b8" }}>{formatToPar(p.toPar - parseInt(p.handicap||0))}</span>}
                          </div>
                        </>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={S.lbHoles}>{p.holesPlayed}/18</div>
                    {!isSpectator && me?.name === round.created_by && p.id !== me?.id && scores.filter(s => s.score > 0).length === 0 && (
                      <>
                        <span onClick={() => { setEditingPlayerId(p.id); setEditPlayerName(p.name?.replace(" (Guest)", "") || p.name); setEditPlayerHcp(String(p.handicap)); }} style={{ fontSize: 12, cursor: "pointer", padding: "2px 4px" }}>✏️</span>
                        <span onClick={async () => { await supabase.from("players").delete().eq("id", p.id); refresh(); }} style={{ fontSize: 12, cursor: "pointer", color: "#ef4444", padding: "2px 4px", fontWeight: 700, fontSize: 14 }}>✕</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Edit player form - outside map, no hooks in loops */}
        {editingPlayerId && !isSpectator && (() => {
          const ep = players.find((p) => p.id === editingPlayerId);
          if (!ep) return null;
          return (
            <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 10 }}>Edit {ep.name}</div>
              <input style={{ ...S.input, marginBottom: 8 }} placeholder="Name" value={editPlayerName} onChange={(e) => setEditPlayerName(e.target.value)} />
              <input style={{ ...S.input, marginBottom: 10 }} type="number" placeholder="Handicap" value={editPlayerHcp} onChange={(e) => setEditPlayerHcp(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={async () => { const isGuest = ep.name?.endsWith("(Guest)"); const finalName = isGuest && !editPlayerName.endsWith("(Guest)") ? editPlayerName.trim() + " (Guest)" : editPlayerName.trim(); await supabase.from("players").update({ name: finalName, handicap: parseFloat(editPlayerHcp) || 0 }).eq("id", ep.id); setEditingPlayerId(null); refresh(); }} style={{ flex: 1, backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                <button onClick={() => setEditingPlayerId(null)} style={{ flex: 1, backgroundColor: "transparent", color: "#64748b", border: "1px solid #334155", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              </div>
            </div>
          );
        })()}

        {/* Banker hole breakdown */}
        {round.game_type === "banker" && lb.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={S.stepTitle}>Banker Story</h3>
            {/* Per hole banker result - who was banker and what they won */}
            <div style={{ overflowX: "auto", marginBottom: 20, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              <div style={{ display: "flex", gap: 6, minWidth: "max-content" }}>
                {holes.map((hole) => {
                  const holeScores = scores.filter((s) => s.hole_number === hole.hole_number);
                  const holeScoresReal = holeScores.filter((s) => s.score > 0);
                  const bankerId = holeScores.find((s) => s.banker_id)?.banker_id;
                  const bankerPlayer = players.find((p) => p.id === bankerId);
                  const allScored = players.every((p) => holeScoresReal.some((s) => s.player_id === p.id));
                  if (!allScored || !bankerPlayer) return (
                    <div key={hole.hole_number} style={{ minWidth: 52, backgroundColor: "#1e293b", borderRadius: 8, padding: "8px 4px", textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: "#475569", marginBottom: 4 }}>H{hole.hole_number}</div>
                      <div style={{ fontSize: 10, color: "#334155" }}>—</div>
                    </div>
                  );
                  let lowest = Infinity, winner = null, tied = false;
                  holeScoresReal.forEach((s) => { const pl = players.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) { lowest = net; winner = s.player_id; tied = false; } else if (net === lowest) tied = true; });
                  const bankerWon = winner === bankerId && !tied;
                  const doubled = holeScores.some((s) => s.doubled);
                  const bankerBets = holeScores.filter((s) => s.player_id !== bankerId && s.bet > 0).reduce((sum, s) => sum + (s.bet || 0), 0);
                  const color = bankerWon ? "#22c55e" : tied ? "#94a3b8" : "#ef4444";
                  return (
                    <div key={hole.hole_number} style={{ minWidth: 52, backgroundColor: "#1e293b", borderRadius: 8, padding: "6px 4px", textAlign: "center", flexShrink: 0, border: "1px solid #334155" }}>
                      <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>H{hole.hole_number}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 1 }}>{bankerPlayer.name.split(" ")[0]}</div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{doubled ? "🏦🔥" : "🏦"}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color }}>{tied ? "$0" : (bankerWon ? "+" : "-") + "$" + bankerBets}</div>
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
                <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", WebkitOverflowScrolling: "touch", minWidth: 0 }}>
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
                      <div key={hole.hole_number} style={{ minWidth: 52, backgroundColor: "#1e293b", borderRadius: 6, padding: "6px 4px", textAlign: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>H{hole.hole_number}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color }}>
                          {hd.iAmBanker ? (hd.doubled ? "🏦🔥" : "🏦") : hd.isWinner ? "W" : hd.tied ? "T" : "L"}
                          {!hd.iAmBanker && hd.doubled ? " 🔥" : ""}
                        </div>
                        <div style={{ fontSize: 10, color, fontWeight: 700 }}>{hd.holeChange !== 0 ? (hd.holeChange > 0 ? "+" : "") + "$" + hd.holeChange : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Banker settlement - who owes who */}
        {round.game_type === "banker" && lb.length > 1 && (() => {
          const settlements = [];
          const balances = lb.map((p) => ({ ...p, balance: p.total }));
          const debtors = balances.filter((p) => p.balance < 0).sort((a, b) => a.balance - b.balance);
          const creditors = balances.filter((p) => p.balance > 0).sort((a, b) => b.balance - a.balance);
          const d = debtors.map((p) => ({ ...p, remaining: Math.abs(p.balance) }));
          const c = creditors.map((p) => ({ ...p, remaining: p.balance }));
          let di = 0, ci = 0;
          while (di < d.length && ci < c.length) {
            const amount = Math.min(d[di].remaining, c[ci].remaining);
            if (amount > 0) settlements.push({ from: d[di].name, to: c[ci].name, amount });
            d[di].remaining -= amount; c[ci].remaining -= amount;
            if (d[di].remaining <= 0) di++;
            if (c[ci].remaining <= 0) ci++;
          }
          if (settlements.length === 0) return null;
          return (
            <div style={{ marginTop: 24, backgroundColor: "#1e293b", borderRadius: 12, padding: "16px", border: "1px solid #334155" }}>
              <h3 style={{ ...S.stepTitle, marginBottom: 12 }}>Settlement</h3>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>Who owes who to square up</p>
              {settlements.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0f172a", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid #334155" }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>{s.from}</span>
                    <span style={{ fontSize: 13, color: "#64748b" }}> owes </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>{s.to}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>${s.amount}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Round complete modal */}
        {showComplete && (
          <RoundCompleteScreen round={round} players={players} scores={scores}
            onSave={() => { saveRoundToHistory(round, players, scores, holes); setShowComplete(false); completeDismissedRef.current = true; alert("Round saved!"); }}
            onDismiss={() => { setShowComplete(false); completeDismissedRef.current = true; }} />
        )}

        {/* Live scorecards - all game modes */}
        {players.length > 0 && holes.length > 0 && (() => {
          const front9 = holes.filter((h) => h.hole_number <= 9);
          const back9 = holes.filter((h) => h.hole_number > 9);
          const shapeEl = (score, par) => {
            if (!score) return <span style={{ color: "#d1d5db", fontSize: 8 }}>—</span>;
            const diff = score - par;
            const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, fontSize: 8, fontWeight: 800 };
            if (diff <= -2) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #1e293b", color: "#0f172a", boxShadow: "0 0 0 1px #334155" }}>{score}</span>;
            if (diff === -1) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #1e293b", color: "#0f172a" }}>{score}</span>;
            if (diff === 0) return <span style={{ ...base, color: "#374151" }}>{score}</span>;
            if (diff === 1) return <span style={{ ...base, border: "1.5px solid #1e293b", color: "#0f172a", borderRadius: 2 }}>{score}</span>;
            return <span style={{ ...base, border: "1.5px solid #1e293b", color: "#0f172a", borderRadius: 2, boxShadow: "0 0 0 1px #334155" }}>{score}</span>;
          };
          const nineTotal = (p, nine) => nine.reduce((sum, h) => { const s = scores.find((sc) => sc.player_id === p.id && sc.hole_number === h.hole_number); return sum + (s?.score || 0); }, 0);
          const nineParFull = (nine) => nine.reduce((sum, h) => sum + h.par, 0);
          const ninePar = (p, nine) => nine.reduce((sum, h) => { const s = scores.find((sc) => sc.player_id === p.id && sc.hole_number === h.hole_number); return s?.score ? sum + h.par : sum; }, 0);
          const tparStr = (val, par) => { if (par === 0) return "—"; const d = val - par; return d === 0 ? "E" : d > 0 ? "+" + d : "" + d; };
          const tparColor = (val, par) => { if (par === 0) return "#64748b"; const d = val - par; return d < 0 ? "#22c55e" : d > 0 ? "#ef4444" : "#64748b"; };

          const cellStyle = { textAlign: "center", padding: "2px 0", borderRight: "1px solid #e8edf2", fontSize: 8, overflow: "hidden", whiteSpace: "nowrap" };
          const hdrStyle = { ...cellStyle, background: "#f1f5f9", fontWeight: 700, color: "#475569", fontSize: 7, textTransform: "uppercase" };
          const parStyle = { ...cellStyle, color: "#64748b", background: "#f8fafc", fontSize: 7 };
          const totStyle = { ...cellStyle, background: "#f1f5f9", fontWeight: 800, color: "#1e293b", fontSize: 8, width: 22 };
          const lblW = 34;
          const totW = 22;

          return (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Scorecards · Live</div>
              {players.filter((player) => player.id !== "spectator").map((player, pi) => (
                <div key={player.id} style={{ marginBottom: 12 }}>
                  {/* Header */}
                  {(() => {
                    const psc = scores.filter((s) => s.player_id === player.id);
                    const pGross = psc.reduce((sum, s) => sum + s.score, 0);
                    const pGrossPar = holes.reduce((sum, h) => { const s = psc.find((x) => x.hole_number === h.hole_number); return s ? sum + h.par : sum; }, 0);
                    const pGrossToPar = pGross - pGrossPar;
                    const pNet = holes.reduce((sum, h) => { const s = psc.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + (s.score - getHcpStrokes(player.handicap, h.stroke_index)); }, 0);
                    const pNetPar = pGrossPar;
                    const pNetToPar = pNet - pNetPar;
                    const fmtPar = (v) => v === 0 ? "E" : v > 0 ? "+" + v : "" + v;
                    return (
                      <div style={{ background: "#1e3a5f", borderRadius: "6px 6px 0 0", padding: "5px 8px", border: "1px solid #334155", borderBottom: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#f8fafc" }}>{player.name}</span>
                        <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>
                          {pGross > 0 ? pGross : "—"}{pGross > 0 ? <span style={{ color: "#64748b" }}> {fmtPar(pGrossToPar)}</span> : null}{pGross > 0 && <span style={{ color: "#64748b" }}> · N {fmtPar(pNetToPar)}</span>}
                        </span>
                      </div>
                    );
                  })()}
                  {/* Front 9 */}
                  <div style={{ background: "#fff", borderLeft: "1px solid #334155", borderRight: "1px solid #334155", overflowX: "hidden" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: lblW }} />
                        {front9.map((h) => <col key={h.hole_number} style={{ width: `calc((100% - ${lblW + totW}px) / ${front9.length})` }} />)}
                        <col style={{ width: totW }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ ...hdrStyle, textAlign: "left", paddingLeft: 4 }}>Score (Gross)</th>
                          {front9.map((h) => <th key={h.hole_number} style={hdrStyle}>{h.hole_number}</th>)}
                          <th style={{ ...hdrStyle, borderRight: "none" }}>Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ ...parStyle, textAlign: "left", paddingLeft: 4 }}>Par</td>
                          {front9.map((h) => <td key={h.hole_number} style={parStyle}>{h.par}</td>)}
                          <td style={{ ...totStyle, borderRight: "none" }}>{nineParFull(front9)}</td>
                        </tr>
                        <tr>
                          <td style={{ ...cellStyle, textAlign: "left", paddingLeft: 4, background: "#fff", fontSize: 7, color: "#64748b" }}></td>
                          {front9.map((h) => {
                            const s = scores.find((sc) => sc.player_id === player.id && sc.hole_number === h.hole_number);
                            return <td key={h.hole_number} style={{ ...cellStyle, background: "#fff", height: 20 }}>{shapeEl(s?.score, h.par)}</td>;
                          })}
                          {(() => { const t = nineTotal(player, front9); return <td style={{ ...totStyle, borderRight: "none", color: "#1e293b" }}>{t > 0 ? t : "—"}</td>; })()}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {/* Divider */}
                  <div style={{ height: 1, background: "#1e3a5f", borderLeft: "1px solid #334155", borderRight: "1px solid #334155" }} />
                  {/* Back 9 */}
                  <div style={{ background: "#fff", borderLeft: "1px solid #334155", borderRight: "1px solid #334155", borderBottom: "1px solid #334155", borderRadius: "0 0 6px 6px", overflowX: "hidden" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                      <colgroup>
                        <col style={{ width: lblW }} />
                        {back9.map((h) => <col key={h.hole_number} style={{ width: `calc((100% - ${lblW + totW}px) / ${back9.length})` }} />)}
                        <col style={{ width: totW }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={{ ...hdrStyle, textAlign: "left", paddingLeft: 4 }}></th>
                          {back9.map((h) => <th key={h.hole_number} style={hdrStyle}>{h.hole_number}</th>)}
                          <th style={{ ...hdrStyle, borderRight: "none" }}>In</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ ...parStyle, textAlign: "left", paddingLeft: 4 }}>Par</td>
                          {back9.map((h) => <td key={h.hole_number} style={parStyle}>{h.par}</td>)}
                          <td style={{ ...totStyle, borderRight: "none" }}>{nineParFull(back9)}</td>
                        </tr>
                        <tr>
                          <td style={{ ...cellStyle, textAlign: "left", paddingLeft: 4, background: "#fff", fontSize: 7, color: "#64748b" }}></td>
                          {back9.map((h) => {
                            const s = scores.find((sc) => sc.player_id === player.id && sc.hole_number === h.hole_number);
                            return <td key={h.hole_number} style={{ ...cellStyle, background: "#fff", height: 20 }}>{shapeEl(s?.score, h.par)}</td>;
                          })}
                          {(() => { const t = nineTotal(player, back9); return <td style={{ ...totStyle, borderRight: "none", color: "#1e293b" }}>{t > 0 ? t : "—"}</td>; })()}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {/* Gap between players */}
                  {pi < players.length - 1 && <div style={{ height: 8 }} />}
                </div>
              ))}
            </div>
          );
        })()}


      </div>

      {showShare && <ShareModal round={round} onClose={() => setShowShare(false)} />}
      {showSpectatorQR && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>Spectator Access Only</div>
          <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <QRCodeSVG value={window.location.origin + window.location.pathname + "?watch=" + round.code} size={220} bgColor="#ffffff" fgColor="#0f172a" />
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>Watch-only link</div>
          <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, marginBottom: 20, letterSpacing: 1 }}>{round.code}</div>
          <button onClick={(e) => { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?watch=" + round.code); const btn = e.target; btn.textContent = "✓ Copied!"; btn.style.color = "#22c55e"; setTimeout(() => { btn.textContent = "👀 Copy Watch Link"; btn.style.color = "#94a3b8"; }, 1500); }} style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "12px 24px", fontFamily: "inherit", marginBottom: 12, width: "100%" }}>👀 Copy Watch Link</button>
          <button onClick={() => setShowSpectatorQR(false)} style={{ backgroundColor: "transparent", border: "1px solid #334155", borderRadius: 10, color: "#475569", fontSize: 13, cursor: "pointer", padding: "12px 24px", fontFamily: "inherit", width: "100%" }}>Close</button>
        </div>
      )}
    </BgScreen>
  );
}

// =============================================================================
// SCORECARD
// =============================================================================
function ScorecardScreen({ round, me, onViewDashboard, isSpectator }) {
  const isHandicap = round.use_handicap !== false && round.use_handicap !== "false" && round.use_handicap !== 0;
  const [myScores, setMyScores] = useState({}), [myBets, setMyBets] = useState({});
  const [allScores, setAllScores] = useState([]), [others, setOthers] = useState([]);
  const [guestScores, setGuestScores] = useState({}); // { [playerId]: { [holeNum]: score } }
  const [guestCustomScores, setGuestCustomScores] = useState({}); // { [playerId]: string } for custom input
  
  const [activeHole, setActiveHole] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [lastMsgCount, setLastMsgCount] = useState(0);
  const [initialBankerId, setInitialBankerId] = useState(null);
  const [currentBankerId, setCurrentBankerId] = useState(null);
  const [pendingBets, setPendingBets] = useState({}); // unsubmitted bet amounts
  const [guestPendingBets, setGuestPendingBets] = useState({}); // keyed by guest player id
  const doubledHolesRef = useRef({}); // tracks which holes have been doubled - immune to refresh
  const originalPotRef = useRef({}); // stores original pot per hole - immune to refresh
  const betsAcceptedRef = useRef({}); // tracks which holes banker has accepted/doubled - unlocks scoring
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
        // Sync betsAccepted from Supabase - check if banker has hole_pot set for active hole
        const thisBankerNowId = activeHole === 1 ? initialBankerId : currentBankerId;
        if (thisBankerNowId) {
          const bankerHolePot = s.find((x) => x.player_id === thisBankerNowId && x.hole_number === activeHole && x.hole_pot > 0);
          if (bankerHolePot && !betsAcceptedRef.current[activeHole]) {
            betsAcceptedRef.current = { ...betsAcceptedRef.current, [activeHole]: true };
          }
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
    // Everyone locked until banker has accepted or doubled bets
    if (round.game_type === "banker") {
      const betsOpen = betsAcceptedRef.current[holeNum] || allScores.some((s) => s.player_id === (holeNum === 1 ? initialBankerId : currentBankerId) && s.hole_number === holeNum && s.hole_pot > 0);
      if (!betsOpen) return;
      // Non-banker also needs their own bet submitted
      if (!iAmBankerNow && !myBets[holeNum] && !allScores.some((s) => s.player_id === me.id && s.hole_number === holeNum && s.bet > 0)) return;
    }
    
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
      const allPlayersList2 = isSpectator ? [...others] : [...others, me];
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
        // Auto advance to next hole now that all scores are in
        if (holeNum < 18) {
          try { await dbSaveCurrentHole(round.id, holeNum + 1); } catch(e) { console.error(e); }
          const next = holeNum + 1;
          setActiveHole(next);
          setTimeout(() => {
            const pos = Math.max(0, (next - 1) * 48 - 120);
            document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
          }, 100);
        }
        setAllScores(freshFromDB);
      }
    }
    
    if (holeNum < 18) {
      if (round.game_type !== "banker") {
        // Auto-advance based on local device scores only - don't wait for other devices
        // Only round creator has guests to score; other devices advance immediately
        const myGuests = me.name === round.created_by
          ? others.filter((p) => p.name?.endsWith("(Guest)"))
          : [];
        const allLocalGuestsScored = myGuests.every((g) =>
          (guestScores[g.id]?.[holeNum] > 0)
        );
        if (myGuests.length === 0 || allLocalGuestsScored) {
          const next = holeNum + 1;
          setActiveHole(next);
          setTimeout(() => {
            const pos = Math.max(0, (next - 1) * 48 - 120);
            document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
          }, 50);
        }
        // else guests on this device haven't all scored yet - tryAdvance will fire when they do
      }
      // Banker: hole advance happens via Supabase sync in 2s refresh
    } else {
      setTimeout(() => onViewDashboard(), 800);
    }
  };

  const tryAdvanceHole = (holeNum, updatedGuestScores) => {
    if (round.game_type === "banker" || holeNum >= 18) return;
    const myGuests = me.name === round.created_by
      ? others.filter((p) => p.name?.endsWith("(Guest)"))
      : [];
    const myScored = myScores[holeNum] > 0;
    if (!myScored) return;
    const scores = updatedGuestScores || guestScores;
    const allLocalGuestsScored = myGuests.every((g) => scores[g.id]?.[holeNum] > 0);
    if (allLocalGuestsScored) {
      const next = holeNum + 1;
      setActiveHole(next);
      setTimeout(() => {
        const pos = Math.max(0, (next - 1) * 48 - 120);
        document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
      }, 50);
    }
  };

  const saveGuestScore = async (player, holeNum, score) => {
    if (score < 1 || score > 15) return;
    // In banker mode, check bets have been accepted before allowing score entry
    if (round.game_type === "banker") {
      const thisBankerId = holeNum === 1 ? initialBankerId : currentBankerId;
      const betsOpen = betsAcceptedRef.current[holeNum] || allScores.some((s) => s.player_id === thisBankerId && s.hole_number === holeNum && s.hole_pot > 0);
      if (!betsOpen) return;
    }
    setGuestScores((prev) => ({ ...prev, [player.id]: { ...(prev[player.id] || {}), [holeNum]: score } }));
    const updatedGuestScores = { ...guestScores, [player.id]: { ...(guestScores[player.id] || {}), [holeNum]: score } };
    const obj = { player_id: player.id, hole_number: holeNum, score, round_id: round.id };
    const updatedScores = [...allScores.filter((s) => !(s.player_id === player.id && s.hole_number === holeNum)), obj];
    setAllScores(updatedScores);
    try { await dbSaveScore(obj); } catch(e) { console.error(e); }

    if (round.game_type === "banker") {
      // Check if all players have now scored this hole and advance if so
      const freshScores = await dbGetScores(round.id);
      setAllScores(freshScores);
      const allPlayersList = isSpectator ? [...others] : [...others, me];
      const realHoleScores = freshScores.filter((s) => s.hole_number === holeNum && s.score > 0);
      const allRealScored = allPlayersList.every((p) => realHoleScores.some((s) => s.player_id === p.id));
      if (allRealScored && holeNum < 18) {
        // Recalculate banker rotation
        let lowest = Infinity, winner = null, tied = false;
        realHoleScores.forEach((s) => {
          const pl = allPlayersList.find((p) => p.id === s.player_id); if (!pl) return;
          const hole = holes.find((h) => h.hole_number === holeNum);
          const net = s.score - getHcpStrokes(pl.handicap, hole?.stroke_index || 1);
          if (net < lowest) { lowest = net; winner = s.player_id; tied = false; }
          else if (net === lowest) { tied = true; }
        });
        if (winner && !tied) {
          setCurrentBankerId(winner);
          try { await dbSaveCurrentBanker(round.id, winner); } catch(e) { console.error(e); }
        }
        // Auto advance to next hole
        try { await dbSaveCurrentHole(round.id, holeNum + 1); } catch(e) { console.error(e); }
        const next = holeNum + 1;
        setActiveHole(next);
        setTimeout(() => {
          const pos = Math.max(0, (next - 1) * 48 - 120);
          document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { el.scrollLeft = pos; });
        }, 100);
        setAllScores(freshScores);
      }
    } else {
      tryAdvanceHole(holeNum, updatedGuestScores);
    }
  };

  const hcpS = curHole ? getHcpStrokes(me.handicap, curHole.stroke_index) : 0;

  const myGrossTotal = holes.reduce((sum, h) => sum + (myScores[h.hole_number] ? myScores[h.hole_number] - h.par : 0), 0);
  const myNetTotal = holes.reduce((sum, h) => { const g = myScores[h.hole_number]; if (!g) return sum; return sum + (g - getHcpStrokes(me.handicap, h.stroke_index) - h.par); }, 0);
  const myStablefordTotal = holes.reduce((sum, h) => { const g = myScores[h.hole_number]; if (!g) return sum; return sum + stablefordPoints(g, h.par, getHcpStrokes(me.handicap, h.stroke_index)); }, 0);
  const allPlayers = isSpectator ? [...others] : [...others, me];
  const myMatchTotal = (() => {
    let myHolesWon = 0;
    holes.forEach((hole) => {
      const myG = myScores[hole.hole_number]; if (!myG) return;
      const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
      const allScored = allPlayers.every((p) => holeScores.some((s) => s.player_id === p.id));
      if (!allScored) return;
      let lowestNet = Infinity;
      holeScores.forEach((s) => { const pl = allPlayers.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowestNet) lowestNet = net; });
      const holeWinners = holeScores.filter((s) => { const pl = allPlayers.find((p) => p.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowestNet; }).map((s) => s.player_id);
      const allTied = holeWinners.length === allPlayers.length;
      if (!allTied && holeWinners.includes(me.id)) myHolesWon++;
    });
    return myHolesWon;
  })();
  // Use calcLeaderboard for banker - same proven logic as dashboard
  const scorecardLb = round.game_type === "banker" ? (() => {
    try { return calcLeaderboard(isSpectator ? [...others] : [...others, me], allScores, holes, "banker"); } catch(e) { return []; }
  })() : [];
  const myLbData = scorecardLb.find((p) => p.id === me.id);
  const bankerHoleMap = myLbData?.holeScores?.bankerHoleData || {};
  const myBankerTotal = myLbData?.total || 0;

  const RunningTotal = ({ value, label, color }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 48, paddingLeft: 8, borderLeft: "1px solid #334155", flexShrink: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: color || (value > 0 ? "#ef4444" : value < 0 ? "#22c55e" : "#94a3b8") }}>
        {label || (value === 0 ? "E" : value > 0 ? "+" + value : value)}
      </span>
    </div>
  );

  return (
    <BgScreen bg={BG_OTHER}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onViewDashboard}>← Back</button>
        <h2 style={S.headerTitle}>Enter Score</h2>
        <button onClick={() => { setShowChat(true); setUnreadChat(0); }}
          style={{ position: "relative", backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "10px 16px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          💬
          {unreadChat > 0 && <span style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#ef4444", color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 1s infinite", boxShadow: "0 0 0 3px rgba(239,68,68,0.3)" }}>{unreadChat}</span>}
        </button>
      </div>
      {showChat && <ChatPanel round={round} me={me} onClose={() => { setShowChat(false); setUnreadChat(0); }} isSpectator={isSpectator} />}

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
                const bankerName = (isSpectator ? [...others] : [...others, me]).find((p) => p.id === thisBankerId2)?.name;
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
                  label = "Match"; color = lead > 0 ? "#22c55e" : "#94a3b8";
                  value = lead === 0 ? "0 pts" : lead + (lead === 1 ? " pt" : " pts");
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

          {/* Banker game - full banker UI - hidden for spectators */}
          {round.game_type === "banker" && !isSpectator && (() => {
            const thisBanker = currentBankerId || initialBankerId;
            const bankerPlayer = [...others, me].find((p) => p.id === thisBanker);
            const iAmBanker = thisBanker === me.id || (bankerPlayer?.name?.endsWith("(Guest)") && me.name === round.created_by);
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
            const allScoresIn = (isSpectator ? [...others] : [...others, me]).every((p) => allScores.some((s) => s.player_id === p.id && s.hole_number === activeHole && s.score > 0));
            const myBetConfirmed = !!myBets[activeHole] || allScores.some((s) => s.player_id === me.id && s.hole_number === activeHole && s.bet > 0);

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

                {/* STEP 2+: Banker is set - show per-player bet rows */}
                {thisBanker && (
                  <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: iAmBanker ? "#22c55e" : "#94a3b8" }}>
                        {iAmBanker ? "🏦 YOU ARE THE BANKER" : "🏦 " + (bankerPlayer?.name || "?") + " is Banker"}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b" }}>
                        Pot: ${totalPot}{isDoubled ? " 🔥" : ""}
                      </div>
                    </div>

                    {/* Per player row */}
                    {[me, ...others].map((player) => {
                      const isBankerPlayer = player.id === thisBanker;
                      const isMe = player.id === me.id;
                      const playerBet = allScores.find((s) => s.player_id === player.id && s.hole_number === activeHole && s.bet > 0)?.bet;
                      const playerPending = isMe ? pendingBets[activeHole] : (guestPendingBets[player.id] || "");
                      const isGuest = player.name?.endsWith("(Guest)");
                      const canEdit = isMe || (isGuest && me.name === round.created_by);

                      const submitBet = async () => {
                        const betVal = isMe ? pendingBets[activeHole] : guestPendingBets[player.id];
                        if (!betVal || betVal < 1) return;
                        const obj = { player_id: player.id, hole_number: activeHole, round_id: round.id, score: 0, bet: betVal, banker_id: thisBanker };
                        await dbSaveScore(obj);
                        if (isMe) {
                          setMyBets((prev) => ({ ...prev, [activeHole]: betVal }));
                        } else {
                          setGuestPendingBets((prev) => ({ ...prev, [player.id]: "" }));
                        }
                        const updated = await dbGetScores(round.id);
                        setAllScores(updated);
                      };

                      return (
                        <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingVertical: 6, borderBottom: "1px solid #1e293b", paddingTop: 8, paddingBottom: 8 }}>
                          {/* Name */}
                          <div style={{ width: 72, flexShrink: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: isBankerPlayer ? "#f59e0b" : isMe ? "#22c55e" : "#e2e8f0" }}>
                              {player.name.replace(" (Guest)", "")}
                            </div>
                            <div style={{ fontSize: 9, color: isBankerPlayer ? "#f59e0b" : isGuest ? "#64748b" : "#475569" }}>
                              {isBankerPlayer ? "🏦 Banker" : isGuest ? "Guest" : isMe ? "You" : ""}
                            </div>
                          </div>

                          {/* Bet area */}
                          {isBankerPlayer ? (
                            <div style={{ flex: 1, fontSize: 11, color: "#475569", fontStyle: "italic" }}>Waiting for bets...</div>
                          ) : playerBet ? (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 10, color: "#22c55e" }}>✓</span>
                              <span style={{ fontSize: 16, fontWeight: 900, color: "#22c55e" }}>${playerBet}{isDoubled ? " 🔥" : ""}</span>
                            </div>
                          ) : canEdit ? (
                            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>$</span>
                              <input
                                style={{ ...S.customInput, flex: 1, fontSize: 16, fontWeight: 800, padding: "6px 8px", height: 34, borderColor: playerPending ? "#22c55e" : "#475569" }}
                                type="number" min="1" placeholder="0"
                                value={playerPending}
                                onChange={(e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : "";
                                  if (isMe) setPendingBets((prev) => ({ ...prev, [activeHole]: val }));
                                  else setGuestPendingBets((prev) => ({ ...prev, [player.id]: val }));
                                }}
                              />
                              <button onClick={submitBet} disabled={!playerPending}
                                style={{ backgroundColor: playerPending ? "#22c55e" : "#334155", color: playerPending ? "#0f172a" : "#64748b", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: playerPending ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0 }}>
                                Submit
                              </button>
                            </div>
                          ) : (
                            <div style={{ flex: 1, fontSize: 11, color: "#475569" }}>—</div>
                          )}

                          {/* Doubled indicator */}
                          {isDoubled && <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>🔥</div>}
                        </div>
                      );
                    })}

                    {/* All bets in - banker must Accept or Double before scoring unlocks */}
                    {allBetsIn && (() => {
                      const betsOpen = betsAcceptedRef.current[activeHole] || allScores.some((s) => s.player_id === thisBanker && s.hole_number === activeHole && s.hole_pot > 0);
                      if (betsOpen) {
                        // Scoring is unlocked - show status
                        return (
                          <div style={{ marginTop: 10 }}>
                            {isDoubled && <div style={{ backgroundColor: "#f59e0b22", border: "1px solid #f59e0b", borderRadius: 8, padding: "8px 12px", textAlign: "center", fontSize: 12, color: "#f59e0b", fontWeight: 700, marginBottom: 8 }}>🔥 DOUBLED — All bets x2</div>}
                            <div style={{ backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 12px", textAlign: "center", fontSize: 13, color: "#22c55e", fontWeight: 700 }}>
                              ⛳ {iAmBanker ? "Scoring unlocked — enter scores below" : "Scoring unlocked — enter your score"}
                            </div>
                          </div>
                        );
                      }
                      // Banker must decide
                      if (!iAmBanker) {
                        return (
                          <div style={{ marginTop: 10, backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", textAlign: "center", fontSize: 12, color: "#64748b" }}>
                            ⏳ Waiting for banker to accept or double bets...
                          </div>
                        );
                      }
                      const potTotal = submittedBets.reduce((s, b) => s + (b.bet || 0), 0);
                      const acceptBets = async () => {
                        betsAcceptedRef.current = { ...betsAcceptedRef.current, [activeHole]: true };
                        // Update hole_pot on banker's existing record - don't overwrite score
                        const bankerExisting = allScores.find((s) => s.player_id === thisBanker && s.hole_number === activeHole);
                        if (bankerExisting) {
                          await supabase.from("scores").update({ hole_pot: potTotal }).eq("player_id", thisBanker).eq("hole_number", activeHole).eq("round_id", round.id);
                        } else {
                          await supabase.from("scores").upsert({ player_id: thisBanker, hole_number: activeHole, round_id: round.id, score: 0, hole_pot: potTotal }, { onConflict: "player_id,hole_number,round_id" });
                        }
                        const updated = await dbGetScores(round.id);
                        setAllScores(updated);
                      };
                      return (
                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <button onClick={acceptBets} style={{ flex: 1, backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                            {"✓ Accept Bets $" + potTotal}
                          </button>
                          <button onClick={async () => {
                            if (doubledHolesRef.current[activeHole]) return;
                            doubledHolesRef.current = { ...doubledHolesRef.current, [activeHole]: true };
                            betsAcceptedRef.current = { ...betsAcceptedRef.current, [activeHole]: true };
                            const freshBets = await dbGetScores(round.id);
                            const holeBets = freshBets.filter((s) => s.hole_number === activeHole && s.bet > 0 && s.player_id !== thisBanker);
                            for (const s of holeBets) {
                              await supabase.from("scores").update({ bet: s.bet * 2, doubled: true }).eq("player_id", s.player_id).eq("hole_number", s.hole_number).eq("round_id", s.round_id);
                            }
                            // Update hole_pot on banker record to unlock scoring - don't overwrite score
                            const bankerExisting2 = allScores.find((s) => s.player_id === thisBanker && s.hole_number === activeHole);
                            if (bankerExisting2) {
                              await supabase.from("scores").update({ hole_pot: potTotal * 2 }).eq("player_id", thisBanker).eq("hole_number", activeHole).eq("round_id", round.id);
                            } else {
                              await supabase.from("scores").upsert({ player_id: thisBanker, hole_number: activeHole, round_id: round.id, score: 0, hole_pot: potTotal * 2 }, { onConflict: "player_id,hole_number,round_id" });
                            }
                            const updated = await dbGetScores(round.id);
                            setAllScores(updated);
                            await dbSendChat({ id: genId(), round_id: round.id, player_id: me.id, player_name: me.name, text: "🔥 " + me.name + " DOUBLED on hole " + activeHole + "!", created_at: new Date().toISOString() });
                          }} style={{ flex: 1, backgroundColor: "#f59e0b", color: "#0f172a", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                            {"💥 Double $" + potTotal + "→$" + potTotal * 2}
                          </button>
                        </div>
                      );
                    })()}

                    {/* All scores in - auto advance happens in saveScore/saveGuestScore */}
                    {allBetsIn && allScoresIn && (
                      <div style={{ marginTop: 10, backgroundColor: "#022c22", border: "1px solid #22c55e", borderRadius: 8, padding: "8px 12px", textAlign: "center", fontSize: 12, color: "#22c55e", fontWeight: 700 }}>
                        ✓ All scored — advancing...
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          

                    <div style={{ position: "relative" }}>
          {!isSpectator && round.game_type === "banker" && (() => {
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
          {!isSpectator && (() => {
            // Banker lock logic
            const tb = activeHole === 1 ? initialBankerId : currentBankerId;
            const iAmBkr = tb === me.id;
            const nonBkrs = [...others, me].filter((p) => p.id !== tb);
            const betsInNow = allScores.filter((s) => s.hole_number === activeHole && s.player_id !== tb && s.bet > 0).length;
            const allBetsInNow = betsInNow >= nonBkrs.length && nonBkrs.length > 0;
            const myBetConfirmedLocal = !!myBets[activeHole] || allScores.some((s) => s.player_id === me.id && s.hole_number === activeHole && s.bet > 0);
            const betsAccepted = betsAcceptedRef.current[activeHole] || allScores.some((s) => s.player_id === tb && s.hole_number === activeHole && s.hole_pot > 0);
            const isLocked = round.game_type === "banker" && (!betsAccepted || (!iAmBkr && !myBetConfirmedLocal));
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px 6px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: 0.5 }}>{me.name} (You){hcpS > 0 ? " +" + hcpS : ""}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {myScores[activeHole] && <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>{myScores[activeHole]} {scoreLabel(myScores[activeHole], curHole?.par)}</span>}
                    {myScores[activeHole] && !isLocked && <button onClick={async () => { setMyScores((prev) => { const n = {...prev}; delete n[activeHole]; return n; }); try { await supabase.from("scores").delete().eq("player_id", me.id).eq("hole_number", activeHole).eq("round_id", round.id); } catch(e) { console.error(e); } }} style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "none", border: "1px solid #ef4444", borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>}
                  </div>
                </div>
                <div style={S.scoreRow}>
                  {[curHole.par - 1, curHole.par, curHole.par + 1, curHole.par + 2, curHole.par + 3].map((s) => (
                    <button key={s} onClick={() => !isLocked && saveScore(activeHole, s)}
                      style={{ ...S.scoreBtn,
                      backgroundColor: isLocked ? "#0f172a" : myScores[activeHole] === s ? "#22c55e" : "#ffffff",
                      color: isLocked ? "#2d3f5a" : myScores[activeHole] === s ? "#0f172a" : "#0f172a",
                      border: "none", opacity: isLocked ? 0.4 : 1,
                      cursor: isLocked ? "not-allowed" : "pointer",
                      boxShadow: !isLocked ? "0 2px 4px rgba(0,0,0,0.3)" : "none" }}>
                      <span style={S.scoreBtnNum}>{s}</span>
                      <span style={{ ...S.scoreBtnLabel, color: isLocked ? "#2d3f5a" : myScores[activeHole] === s ? "#065f46" : "#475569" }}>{scoreLabel(s, curHole.par)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
          </div>

          {!isSpectator && <div style={S.customScore}>
            <span style={S.customLabel}>Other score</span>
            <input style={S.customInput} type="number" min="1" max="15" placeholder="—"
              value={myScores[activeHole] && ![curHole.par-1,curHole.par,curHole.par+1,curHole.par+2,curHole.par+3].includes(myScores[activeHole]) ? myScores[activeHole] : ""}
              onChange={(e) => e.target.value && saveScore(activeHole, parseInt(e.target.value))} />
          </div>}

          {/* Guest player score rows - only shown to round creator AND only after banker accepts bets */}
          {me.name === round.created_by && others.filter((p) => p.name?.endsWith("(Guest)")).map((guest) => {
            if (round.game_type === "banker") {
              const thisBankerNow = activeHole === 1 ? initialBankerId : currentBankerId;
              const betsOpen = betsAcceptedRef.current[activeHole] || allScores.some((s) => s.player_id === thisBankerNow && s.hole_number === activeHole && s.hole_pot > 0);
              if (!betsOpen) return null;
            }
            const gHcpS = curHole ? getHcpStrokes(guest.handicap, curHole.stroke_index) : 0;
            const gScore = (guestScores[guest.id] || {})[activeHole] || allScores.find((s) => s.player_id === guest.id && s.hole_number === activeHole)?.score;
            return (
              <div key={guest.id} style={{ marginBottom: 12, backgroundColor: "#0f2233", border: "1px solid #1e3a5f", borderRadius: 12, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px 6px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{guest.name}{gHcpS > 0 ? " +" + gHcpS : ""}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {gScore && <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>{gScore} {scoreLabel(gScore, curHole?.par)}</span>}
                    {gScore && <button onClick={async () => { setGuestScores((prev) => { const n = {...prev}; if (n[guest.id]) { const nh = {...n[guest.id]}; delete nh[activeHole]; n[guest.id] = nh; } return n; }); try { await supabase.from("scores").delete().eq("player_id", guest.id).eq("hole_number", activeHole).eq("round_id", round.id); } catch(e) { console.error(e); } }} style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "none", border: "1px solid #ef4444", borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>Clear</button>}
                  </div>
                </div>
                <div style={S.scoreRow}>
                  {curHole && [curHole.par - 1, curHole.par, curHole.par + 1, curHole.par + 2, curHole.par + 3].map((s) => (
                    <button key={s} onClick={() => { saveGuestScore(guest, activeHole, s); setGuestCustomScores((prev) => ({ ...prev, [guest.id]: "" })); }}
                      style={{ ...S.scoreBtn,
                        backgroundColor: gScore === s ? "#22c55e" : "#ffffff",
                        color: "#0f172a",
                        border: "none", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
                      <span style={S.scoreBtnNum}>{s}</span>
                      <span style={{ ...S.scoreBtnLabel, color: gScore === s ? "#065f46" : "#475569" }}>{scoreLabel(s, curHole.par)}</span>
                    </button>
                  ))}
                </div>
                <div style={S.customScore}>
                  <span style={S.customLabel}>Other score</span>
                  <input style={S.customInput} type="number" min="1" max="15" placeholder="—"
                    value={guestCustomScores[guest.id] || (gScore && ![curHole.par-1,curHole.par,curHole.par+1,curHole.par+2,curHole.par+3].includes(gScore) ? gScore : "")}
                    onChange={(e) => { const v = parseInt(e.target.value); setGuestCustomScores((prev) => ({ ...prev, [guest.id]: e.target.value })); if (v >= 1 && v <= 15) saveGuestScore(guest, activeHole, v); }} />
                </div>
              </div>
            );
          })}

          <div style={S.scoreInfoBoxes}>
            {/* Combined Course Info row */}
            <div style={{ ...S.scoreInfoSection, padding: 0 }}>
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
                        style={{ minWidth: 48, width: 48, flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer",
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
                <div style={{ minWidth: 48, width: 48, flexShrink: 0 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact leaderboard strip - replaces the old match play banner */}
      {(() => {
        const allP = [me, ...others];
        const holesPlayed = Object.keys(myScores).length;
        if (holesPlayed === 0) return null;

        const getScore = (player) => {
          const ps = allScores.filter((s) => s.player_id === player.id);
          if (round.game_type === "stableford") {
            return { val: holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + stablefordPoints(s.score, h.par, getHcpStrokes(player.handicap, h.stroke_index)); }, 0) + "pts", color: "#22c55e" };
          } else if (round.game_type === "matchplay" || round.game_type === "matchplay_teams") {
            let won = 0;
            holes.forEach((hole) => {
              const myS = ps.find((s) => s.hole_number === hole.hole_number); if (!myS) return;
              const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
              if (!allP.every((p) => holeScores.some((s) => s.player_id === p.id))) return;
              let lowest = Infinity;
              holeScores.forEach((s) => { const pl = allP.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) lowest = net; });
              const winners = holeScores.filter((s) => { const pl = allP.find((p) => p.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowest; }).map((s) => s.player_id);
              if (winners.length < allP.length && winners.includes(player.id)) won++;
            });
            return { val: won === 0 ? "0" : won + (won === 1 ? " pt" : " pts"), color: won > 0 ? "#22c55e" : "#94a3b8" };
          } else if (round.game_type === "banker") {
            const isMe = player.id === me.id;
            const total = isMe ? myBankerTotal : (() => {
              let t = 0;
              holes.forEach((hole) => {
                const pScore = ps.find((s) => s.hole_number === hole.hole_number); if (!pScore || !pScore.score) return;
                const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
                if (!allP.every((p) => holeScores.some((s) => s.player_id === p.id && s.score > 0))) return;
                const bankerId = pScore.banker_id || holeScores[0]?.banker_id;
                const isBanker = bankerId === player.id;
                let lowest = Infinity;
                holeScores.forEach((s) => { const pl = allP.find((p) => p.id === s.player_id); if (!pl || !s.score) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) lowest = net; });
                const winners = holeScores.filter((s) => { const pl = allP.find((p) => p.id === s.player_id); if (!pl || !s.score) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowest; }).map((s) => s.player_id);
                if (winners.length === allP.length) return;
                const bankerWon = winners.includes(bankerId);
                if (isBanker) { if (bankerWon) { holeScores.forEach((s) => { if (s.player_id === player.id || !s.score || winners.includes(s.player_id)) return; t += (s.bet||0); }); } else { holeScores.forEach((s) => { if (s.player_id === player.id || !s.score || !winners.includes(s.player_id)) return; t -= (s.bet||0); }); } }
                else { const bet = pScore.bet||0; if (bet > 0) { if (winners.includes(player.id) && !bankerWon) t += bet; else if (bankerWon && !winners.includes(player.id)) t -= bet; } }
              });
              return t;
            })();
            return { val: (total >= 0 ? "+$" : "-$") + Math.abs(total), color: total > 0 ? "#22c55e" : total < 0 ? "#ef4444" : "#94a3b8" };
          } else {
            const gross = ps.reduce((sum, s) => sum + (s.score || 0), 0);
            const par = holes.filter((h) => ps.some((s) => s.hole_number === h.hole_number)).reduce((sum, h) => sum + h.par, 0);
            const diff = gross - par;
            return { val: diff === 0 ? "E" : (diff > 0 ? "+" : "") + diff, color: diff < 0 ? "#22c55e" : diff > 0 ? "#ef4444" : "#94a3b8" };
          }
        };

        const rows = [];
        for (let i = 0; i < allP.length; i += 4) rows.push(allP.slice(i, i + 4));

        return (
          <div style={{ margin: "0 16px 12px" }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: 6, marginBottom: ri < rows.length - 1 ? 6 : 0 }}>
                {row.map((player) => {
                  const { val, color } = getScore(player);
                  const isMe = player.id === me.id;
                  const shortName = ((isMe && !player.name) ? round.created_by : player.name || "").replace(" (Guest)", "").split(" ")[0];
                  return (
                    <div key={player.id} style={{ flex: 1, backgroundColor: isMe ? "#022c22" : "#1e293b", border: "1px solid " + (isMe ? "#22c55e44" : "#334155"), borderRadius: 10, padding: "7px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: isMe ? "#22c55e" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", textAlign: "center" }}>{shortName}</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

      {/* All players section - grouped by team for matchplay_teams, otherwise my card first */}
      <div style={S.otherPlayersSection}>
        <div style={S.otherPlayersTitle}>Players</div>

        {round.game_type === "matchplay_teams" ? (() => {
          const allP = [me, ...others];
          return ["A", "B"].map((tl, ti) => {
            const tc = tl === "A" ? "#22c55e" : "#3b82f6";
            const teamPlayers = allP.filter((p) => p.team === tl);
            const oppPlayers = allP.filter((p) => p.team !== tl);
            // Per-hole team W/L/T pills
            const teamHolePills = holes.map((hole) => {
              const allP2 = [me, ...others];
              const allScored = allP2.every((pl) => {
                const s = pl.id === me.id ? myScores[hole.hole_number] : allScores.find((x) => x.player_id === pl.id && x.hole_number === hole.hole_number)?.score;
                return s && s > 0;
              });
              if (!allScored) return { h: hole.hole_number, res: null };
              const bestNet = (grp) => grp.reduce((best, pl) => {
                const s = pl.id === me.id ? myScores[hole.hole_number] : allScores.find((x) => x.player_id === pl.id && x.hole_number === hole.hole_number)?.score;
                if (!s) return best;
                return Math.min(best, s - getHcpStrokes(pl.handicap, hole.stroke_index));
              }, Infinity);
              const myBest = bestNet(teamPlayers), oppBest = bestNet(oppPlayers);
              if (myBest === Infinity || oppBest === Infinity) return { h: hole.hole_number, res: null };
              if (myBest < oppBest) return { h: hole.hole_number, res: "W" };
              if (myBest > oppBest) return { h: hole.hole_number, res: "L" };
              return { h: hole.hole_number, res: "T" };
            });
            return (
              <div key={tl} style={{ backgroundColor: tl === "A" ? "rgba(34,197,94,0.06)" : "rgba(59,130,246,0.06)", border: `1.5px solid ${tl === "A" ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)"}`, borderRadius: 14, padding: 12, marginBottom: ti === 0 ? 10 : 0, overflow: "hidden" }}>
                {/* Team header with hole pills */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: tc }}>Team {tl}</div>
                  <div style={{ display: "flex", gap: 3, overflowX: "auto", scrollbarWidth: "none", flex: 1 }}>
                    {teamHolePills.map(({ h, res }) => (
                      <div key={h} style={{ minWidth: 24, background: "#0f172a", borderRadius: 4, padding: "2px 3px", textAlign: "center", border: "1px solid #1e293b", flexShrink: 0 }}>
                        <div style={{ fontSize: 7, color: "#475569" }}>H{h}</div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: res === "W" ? "#22c55e" : res === "L" ? "#ef4444" : res === "T" ? "#94a3b8" : "#334155" }}>{res || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Player cards inside team */}
                {teamPlayers.map((player) => {
                  const isMe = player.id === me.id;
                  const ps = isMe ? [] : allScores.filter((s) => s.player_id === player.id);
                  const myGrossTotal2 = isMe ? holes.reduce((sum, h) => sum + (myScores[h.hole_number] ? myScores[h.hole_number] - h.par : 0), 0) : holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); return sum + (s ? s.score - h.par : 0); }, 0);
                  const myNetTotal2 = isMe ? holes.reduce((sum, h) => { const g = myScores[h.hole_number]; if (!g) return sum; return sum + (g - getHcpStrokes(me.handicap, h.stroke_index) - h.par); }, 0) : holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + (s.score - getHcpStrokes(player.handicap, h.stroke_index) - h.par); }, 0);
                  return (
                    <div key={player.id} style={{ ...S.playerCard, marginBottom: 8, overflow: "hidden", ...(isMe ? { border: "1px solid #22c55e33" } : {}) }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ ...S.playerCardName, color: isMe ? "#22c55e" : "#f8fafc" }}>{player.name} (HCP {player.handicap}) {isMe && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>YOU</span>}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          G: <span style={{ color: myGrossTotal2 === 0 ? "#94a3b8" : myGrossTotal2 > 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{formatToPar(myGrossTotal2)}</span>
                          {isHandicap && <>{" "}N: <span style={{ color: myNetTotal2 === 0 ? "#94a3b8" : myNetTotal2 > 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{formatToPar(myNetTotal2)}</span></>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 14, marginRight: 4, flexShrink: 0 }}>
                          <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>G</div>
                          {isHandicap && <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>N</div>}
                        </div>
                        <div className="ff-slave-scroll" style={{ ...S.playerScoresRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
                          {holes.map((h) => {
                            const g = isMe ? myScores[h.hole_number] : (ps.find((s) => s.hole_number === h.hole_number)?.score || null);
                            const hs = getHcpStrokes(player.handicap, h.stroke_index);
                            // Highlight if this player's score is the team best for this hole
                            const teamBestNet = teamPlayers.reduce((best, pl) => {
                              const sc = pl.id === me.id ? myScores[h.hole_number] : allScores.find((s) => s.player_id === pl.id && s.hole_number === h.hole_number)?.score;
                              if (!sc) return best;
                              return Math.min(best, sc - getHcpStrokes(pl.handicap, h.stroke_index));
                            }, Infinity);
                            const myNet = g ? g - hs : null;
                            const isBestBall = myNet !== null && myNet === teamBestNet && teamBestNet !== Infinity;
                            return (
                              <div key={player.id + h.hole_number} style={{ minWidth: 44, flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", overflow: "visible" }}>
                                <div style={{ fontSize: 8, color: "#94a3b8", height: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{h.hole_number}</div>
                                <div style={{ fontSize: 7, color: "#475569", height: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>P{h.par}</div>
                                <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                                  {g ? (() => {
                                    const diff = g - h.par;
                                    const base = { fontSize: 10, fontWeight: 800, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" };
                                    const highlight = isBestBall ? { backgroundColor: "#22c55e22", outline: "1.5px solid #22c55e66" } : {};
                                    if (diff <= -2) return <span style={{ ...base, ...highlight, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0", boxShadow: "0 0 0 1.5px #475569" }}>{g}</span>;
                                    if (diff === -1) return <span style={{ ...base, ...highlight, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0" }}>{g}</span>;
                                    if (diff === 0) return <span style={{ ...base, ...highlight, color: "#e2e8f0" }}>{g}</span>;
                                    if (diff === 1) return <span style={{ ...base, ...highlight, border: "1.5px solid #94a3b8", color: "#e2e8f0", borderRadius: 2 }}>{g}</span>;
                                    return <span style={{ ...base, ...highlight, border: "1.5px solid #64748b", color: "#e2e8f0", borderRadius: 2, boxShadow: "0 0 0 1.5px #475569" }}>{g}</span>;
                                  })() : <span style={{ color: "#334155" }}>—</span>}
                                </div>
                                {isHandicap && <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                                  {g ? (() => {
                                    const net = g - hs;
                                    const diff = net - h.par;
                                    const base = { fontSize: 10, fontWeight: 800, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" };
                                    const highlight = isBestBall ? { backgroundColor: "#22c55e22", outline: "1.5px solid #22c55e66" } : {};
                                    if (diff <= -2) return <span style={{ ...base, ...highlight, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0", boxShadow: "0 0 0 1.5px #475569" }}>{net}</span>;
                                    if (diff === -1) return <span style={{ ...base, ...highlight, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0" }}>{net}</span>;
                                    if (diff === 0) return <span style={{ ...base, ...highlight, color: "#e2e8f0" }}>{net}</span>;
                                    if (diff === 1) return <span style={{ ...base, ...highlight, border: "1.5px solid #94a3b8", color: "#e2e8f0", borderRadius: 2 }}>{net}</span>;
                                    return <span style={{ ...base, ...highlight, border: "1.5px solid #64748b", color: "#e2e8f0", borderRadius: 2, boxShadow: "0 0 0 1.5px #475569" }}>{net}</span>;
                                  })() : <span style={{ color: "#334155" }}>—</span>}
                                </div>}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", paddingTop: 14, marginLeft: 6, paddingLeft: 6, borderLeft: "1px solid #334155", flexShrink: 0 }}>
                          <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: myGrossTotal2 === 0 ? "#94a3b8" : myGrossTotal2 > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(myGrossTotal2)}</div>
                          {isHandicap && <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: myNetTotal2 === 0 ? "#94a3b8" : myNetTotal2 > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(myNetTotal2)}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          });
        })() : (<>

        {/* MY card - hidden for spectators */}
        {!isSpectator && (() => {
          const myGrossTotal2 = holes.reduce((sum, h) => sum + (myScores[h.hole_number] ? myScores[h.hole_number] - h.par : 0), 0);
          const myNetTotal2 = holes.reduce((sum, h) => { const g = myScores[h.hole_number]; if (!g) return sum; return sum + (g - getHcpStrokes(me.handicap, h.stroke_index) - h.par); }, 0);
          return (
            <div style={{ ...S.playerCard, border: "1px solid #22c55e33", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ ...S.playerCardName, color: "#22c55e" }}>{me.name} (HCP {me.handicap}) <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>YOU</span></div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                  {(() => { const gross = holes.reduce((sum, h) => sum + (myScores[h.hole_number] || 0), 0); const grossPar = holes.reduce((sum, h) => myScores[h.hole_number] ? sum + h.par : sum, 0); const gtp = gross - grossPar; const net = holes.reduce((sum, h) => { const g = myScores[h.hole_number]; if (!g) return sum; return sum + (g - getHcpStrokes(me.handicap, h.stroke_index)); }, 0); const ntp = net - grossPar; const f = (v) => v === 0 ? "E" : v > 0 ? "+" + v : "" + v; return gross > 0 ? <>{gross} · {f(gtp)}{isHandicap ? <> · N {f(ntp)}</> : null}</> : "—"; })()}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 14, marginRight: 4, flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>G</div>
                  {isHandicap && <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>N</div>}
                  {(round.game_type === "stableford" || round.game_type === "matchplay" || round.game_type === "banker") && (
                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>
                      {round.game_type === "stableford" ? "Pts" : round.game_type === "matchplay" ? "W" : "$"}
                    </div>
                  )}
                </div>
                <div className="ff-slave-scroll" style={{ ...S.playerScoresRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
                  {holes.map((h) => {
                    const g = myScores[h.hole_number];
                    const hs = getHcpStrokes(me.handicap, h.stroke_index);
                    const { number: gn, shape: gs } = getScoreShape(g, h.par);
                    const { number: nn, shape: ns } = getNetShape(g, h.par, hs);
                    let thirdValue = "  ", thirdColor = "#94a3b8";
                    if (g) {
                      if (round.game_type === "stableford") { thirdValue = stablefordPoints(g, h.par, hs); thirdColor = "#22c55e"; }
                      else if (round.game_type === "matchplay") {
                        const holeScores = allScores.filter((s) => s.hole_number === h.hole_number);
                        const allPlayers2 = isSpectator ? [...others] : [...others, me];
                        if (!allPlayers2.every((p) => holeScores.some((s) => s.player_id === p.id))) { thirdValue = "  "; thirdColor = "#475569"; }
                        else {
                          let lowestNet = Infinity;
                          holeScores.forEach((s) => { const pl = allPlayers2.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, h.stroke_index); if (net < lowestNet) lowestNet = net; });
                          const hWinners = holeScores.filter((s) => { const pl = allPlayers2.find((p) => p.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, h.stroke_index)) === lowestNet; }).map((s) => s.player_id);
                          const allTied = hWinners.length === allPlayers2.length;
                          if (allTied) { thirdValue = "T"; thirdColor = "#94a3b8"; }
                          else if (hWinners.includes(me.id)) { thirdValue = "W"; thirdColor = "#22c55e"; }
                          else { thirdValue = "L"; thirdColor = "#ef4444"; }
                        }
                      } else if (round.game_type === "banker") {
                        const hd = bankerHoleMap[h.hole_number];
                        if (hd) {
                          const icons = (hd.iAmBanker ? "🏦" : "") + (hd.doubled ? "🔥" : "");
                          const amt = hd.holeChange !== 0 ? (hd.holeChange > 0 ? "+$" : "-$") + Math.abs(hd.holeChange) : "T";
                          thirdValue = icons ? icons + " " + amt : amt;
                          thirdColor = hd.holeChange > 0 ? "#22c55e" : hd.holeChange < 0 ? "#ef4444" : "#94a3b8";
                        }
                      }
                    }
                    return (
                      <div key={"me"+h.hole_number} style={{ minWidth: 44, flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", overflow: "visible" }}>
                        <div style={{ fontSize: 8, color: "#94a3b8", height: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{h.hole_number}</div>
                        <div style={{ fontSize: 7, color: "#475569", height: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>P{h.par}</div>
                        <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                          {g ? (() => {
                            const diff = g - h.par;
                            const base = { fontSize: 10, fontWeight: 800, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" };
                            if (diff <= -2) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0", boxShadow: "0 0 0 1.5px #475569" }}>{g}</span>;
                            if (diff === -1) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0" }}>{g}</span>;
                            if (diff === 0) return <span style={{ ...base, color: "#e2e8f0" }}>{g}</span>;
                            if (diff === 1) return <span style={{ ...base, border: "1.5px solid #94a3b8", color: "#e2e8f0", borderRadius: 2 }}>{g}</span>;
                            return <span style={{ ...base, border: "1.5px solid #64748b", color: "#e2e8f0", borderRadius: 2, boxShadow: "0 0 0 1.5px #475569" }}>{g}</span>;
                          })() : <span style={{ color: "#334155" }}>—</span>}
                        </div>
                        {isHandicap && <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                          {g ? (() => {
                            const net = g - hs;
                            const diff = net - h.par;
                            const base = { fontSize: 10, fontWeight: 800, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" };
                            if (diff <= -2) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0", boxShadow: "0 0 0 1.5px #475569" }}>{net}</span>;
                            if (diff === -1) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0" }}>{net}</span>;
                            if (diff === 0) return <span style={{ ...base, color: "#e2e8f0" }}>{net}</span>;
                            if (diff === 1) return <span style={{ ...base, border: "1.5px solid #94a3b8", color: "#e2e8f0", borderRadius: 2 }}>{net}</span>;
                            return <span style={{ ...base, border: "1.5px solid #64748b", color: "#e2e8f0", borderRadius: 2, boxShadow: "0 0 0 1.5px #475569" }}>{net}</span>;
                          })() : <span style={{ color: "#334155" }}>—</span>}
                        </div>}
                        {(round.game_type === "stableford" || round.game_type === "matchplay" || round.game_type === "banker") && (
                          <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: thirdColor }}>{thirdValue}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", paddingTop: 14, marginLeft: 6, paddingLeft: 6, borderLeft: "1px solid #334155", flexShrink: 0 }}>
                  <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: myGrossTotal2 === 0 ? "#94a3b8" : myGrossTotal2 > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(myGrossTotal2)}</div>
                  {isHandicap && <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: myNetTotal2 === 0 ? "#94a3b8" : myNetTotal2 > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(myNetTotal2)}</div>}
                  {round.game_type === "stableford" && <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: "#22c55e" }}>{myStablefordTotal}pts</div>}
                  {round.game_type === "matchplay" && <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: myMatchTotal > 0 ? "#22c55e" : "#94a3b8" }}>{myMatchTotal === 0 ? "0" : myMatchTotal + (myMatchTotal === 1 ? " pt" : " pts")}</div>}
                  {round.game_type === "banker" && <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: myBankerTotal > 0 ? "#22c55e" : myBankerTotal < 0 ? "#ef4444" : "#94a3b8" }}>{myBankerTotal >= 0 ? "+$" : "-$"}{Math.abs(myBankerTotal)}</div>}
                </div>
              </div>
            </div>
          );
        })()}

        {others.map((player) => {
            const ps = allScores.filter((s) => s.player_id === player.id);
            const pGrossTotal = holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); return sum + (s ? s.score - h.par : 0); }, 0);
            const pNetTotal = holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + (s.score - getHcpStrokes(player.handicap, h.stroke_index) - h.par); }, 0);
            return (
              <div key={player.id} style={S.playerCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={S.playerCardName}>{player.name} (HCP {player.handicap})</div>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                    {(() => { const gross = ps.reduce((sum, s) => sum + s.score, 0); const grossPar = holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); return s ? sum + h.par : sum; }, 0); const gtp = gross - grossPar; const net = holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + (s.score - getHcpStrokes(player.handicap, h.stroke_index)); }, 0); const ntp = net - grossPar; const f = (v) => v === 0 ? "E" : v > 0 ? "+" + v : "" + v; return gross > 0 ? <>{gross} · {f(gtp)}{isHandicap ? <> · N {f(ntp)}</> : null}</> : "—"; })()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 14, marginRight: 4, flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>G</div>
                    {isHandicap && <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>N</div>}
                    {(round.game_type === "stableford" || round.game_type === "matchplay" || round.game_type === "banker") && (
                      <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, height: 28, display: "flex", alignItems: "center" }}>
                        {round.game_type === "stableford" ? "Pts" : round.game_type === "matchplay" ? "W/L" : "$"}
                      </div>
                    )}
                  </div>
                  {/* Scrollable scores */}
                  <div className="ff-slave-scroll" style={{ ...S.playerScoresRow, flex: 1 }} onScroll={(e) => { document.querySelectorAll("#ff-master-scroll, .ff-slave-scroll").forEach((el) => { if (el !== e.target) el.scrollLeft = e.target.scrollLeft; }); }}>
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
                          const allPlayers3 = isSpectator ? [...others] : [...others, me];
                          if (!allPlayers3.every((p) => holeScores.some((s) => s.player_id === p.id))) { thirdValue = "—"; thirdColor = "#475569"; }
                          else {
                            let lowestNet3 = Infinity;
                            holeScores.forEach((s) => { const pl = allPlayers3.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, h.stroke_index); if (net < lowestNet3) lowestNet3 = net; });
                            const hWinners3 = holeScores.filter((s) => { const pl = allPlayers3.find((p) => p.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, h.stroke_index)) === lowestNet3; }).map((s) => s.player_id);
                            const allTied3 = hWinners3.length === allPlayers3.length;
                            if (allTied3) { thirdValue = "T"; thirdColor = "#94a3b8"; }
                            else if (hWinners3.includes(player.id)) { thirdValue = "W"; thirdColor = "#22c55e"; }
                            else { thirdValue = "L"; thirdColor = "#ef4444"; }
                          }
                        }
                      }
                      // Banker $ from scorecardLb
                      const plLb = round.game_type === "banker" ? scorecardLb.find((p) => p.id === player.id) : null;
                      const hd = plLb?.holeScores?.bankerHoleData?.[h.hole_number];
                      return (
                        <div key={player.id + h.hole_number} style={{ minWidth: 44, flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", overflow: "visible" }}>
                          <div style={{ fontSize: 8, color: "#94a3b8", height: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{h.hole_number}</div>
                          <div style={{ fontSize: 7, color: "#475569", height: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>P{h.par}</div>
                          <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                            {g ? (() => {
                              const diff = g - h.par;
                              const base = { fontSize: 10, fontWeight: 800, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" };
                              if (diff <= -2) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0", boxShadow: "0 0 0 1.5px #475569" }}>{g}</span>;
                              if (diff === -1) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0" }}>{g}</span>;
                              if (diff === 0) return <span style={{ ...base, color: "#e2e8f0" }}>{g}</span>;
                              if (diff === 1) return <span style={{ ...base, border: "1.5px solid #94a3b8", color: "#e2e8f0", borderRadius: 2 }}>{g}</span>;
                              return <span style={{ ...base, border: "1.5px solid #64748b", color: "#e2e8f0", borderRadius: 2, boxShadow: "0 0 0 1.5px #475569" }}>{g}</span>;
                            })() : <span style={{ color: "#334155" }}>—</span>}
                          </div>
                          {isHandicap && (
                            <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                              {g ? (() => {
                                const net = g - hs;
                                const diff = net - h.par;
                                const base = { fontSize: 10, fontWeight: 800, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" };
                                if (diff <= -2) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0", boxShadow: "0 0 0 1.5px #475569" }}>{net}</span>;
                                if (diff === -1) return <span style={{ ...base, borderRadius: "50%", border: "1.5px solid #94a3b8", color: "#e2e8f0" }}>{net}</span>;
                                if (diff === 0) return <span style={{ ...base, color: "#e2e8f0" }}>{net}</span>;
                                if (diff === 1) return <span style={{ ...base, border: "1.5px solid #94a3b8", color: "#e2e8f0", borderRadius: 2 }}>{net}</span>;
                                return <span style={{ ...base, border: "1.5px solid #64748b", color: "#e2e8f0", borderRadius: 2, boxShadow: "0 0 0 1.5px #475569" }}>{net}</span>;
                              })() : <span style={{ color: "#334155" }}>—</span>}
                            </div>
                          )}
                          {(round.game_type === "stableford" || round.game_type === "matchplay") && (
                            <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: thirdColor }}>{thirdValue}</div>
                          )}
                          {round.game_type === "banker" && (
                            <div style={{ height: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                              {hd ? <>
                                <div style={{ fontSize: 9, fontWeight: 700, color: hd.holeChange > 0 ? "#22c55e" : hd.holeChange < 0 ? "#ef4444" : "#94a3b8" }}>
                                  {hd.iAmBanker ? "🏦" : hd.tied ? "T" : hd.isWinner ? "W" : "L"}{hd.doubled ? "🔥" : ""}
                                </div>
                                <div style={{ fontSize: 8, color: hd.holeChange > 0 ? "#22c55e" : hd.holeChange < 0 ? "#ef4444" : "#94a3b8" }}>
                                  {hd.holeChange !== 0 ? (hd.holeChange > 0 ? "+$" : "-$") + Math.abs(hd.holeChange) : ""}
                                </div>
                              </> : <span style={{ color: "#334155" }}>—</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Running totals pinned right */}
                  <div style={{ display: "flex", flexDirection: "column", paddingTop: 14, marginLeft: 6, paddingLeft: 6, borderLeft: "1px solid #334155", flexShrink: 0 }}>
                    <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: pGrossTotal === 0 ? "#94a3b8" : pGrossTotal > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(pGrossTotal)}</div>
                    {isHandicap && <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: pNetTotal === 0 ? "#94a3b8" : pNetTotal > 0 ? "#ef4444" : "#22c55e" }}>{formatToPar(pNetTotal)}</div>}
                    {round.game_type === "stableford" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800, color: "#22c55e" }}>
                        {holes.reduce((sum, h) => { const s = ps.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + stablefordPoints(s.score, h.par, getHcpStrokes(player.handicap, h.stroke_index)); }, 0)}pts
                      </div>
                    )}
                    {round.game_type === "matchplay" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                        {(() => {
                          let won = 0;
                          holes.forEach((hole) => {
                            const myS = ps.find((s) => s.hole_number === hole.hole_number); if (!myS) return;
                            const holeScores = allScores.filter((s) => s.hole_number === hole.hole_number);
                            const allP3 = isSpectator ? [...others] : [...others, me];
                            if (!allP3.every((p) => holeScores.some((s) => s.player_id === p.id))) return;
                            let lowest = Infinity;
                            holeScores.forEach((s) => { const pl = allP3.find((p) => p.id === s.player_id); if (!pl) return; const net = s.score - getHcpStrokes(pl.handicap, hole.stroke_index); if (net < lowest) lowest = net; });
                            const winners = holeScores.filter((s) => { const pl = allP3.find((p) => p.id === s.player_id); if (!pl) return false; return (s.score - getHcpStrokes(pl.handicap, hole.stroke_index)) === lowest; }).map((s) => s.player_id);
                            const allTied = winners.length === allP3.length;
                            if (!allTied && winners.includes(player.id)) won++;
                          });
                          const col = won > 0 ? "#22c55e" : "#94a3b8";
                          return <span style={{ color: col }}>{won === 0 ? "0" : won + (won === 1 ? " pt" : " pts")}</span>;
                        })()}
                      </div>
                    )}
                    {round.game_type === "banker" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                        {(() => {
                          const plLb = scorecardLb.find((p) => p.id === player.id);
                          const total = plLb?.total || 0;
                          return <span style={{ color: total > 0 ? "#22c55e" : total < 0 ? "#ef4444" : "#94a3b8" }}>{total >= 0 ? "+$" : "-$"}{Math.abs(total)}</span>;
                        })()}
                      </div>
                    )}
                    {false && round.game_type === "banker_disabled" && (
                      <div style={{ height: 28, display: "flex", alignItems: "center", fontSize: 11, fontWeight: 800 }}>
                        {(() => {
                          let total = 0;
                          const allP4 = isSpectator ? [...others] : [...others, me];
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
        </>)}
        </div>

      {showChat && <ChatPanel round={round} me={me} onClose={() => { setShowChat(false); setUnreadChat(0); }} />}
    </BgScreen>
  );
}

// =============================================================================
// PAST ROUNDS SCREEN
// =============================================================================
function PastRoundDetailScreen({ round, onBack }) {
  const [players, setPlayers] = useState(round.players || []);
  const [scores, setScores] = useState(round.scores || []);
  const [loading, setLoading] = useState(false);
  const holes = round.holes || [];
  const front9 = holes.filter((h) => h.hole_number <= 9);
  const back9 = holes.filter((h) => h.hole_number > 9);
  const isHandicap = round.use_handicap !== false;

  useEffect(() => {
    // Always fetch fresh from Supabase if we have a round ID
    if (!round.id) return;
    setLoading(true);
    Promise.all([dbGetPlayers(round.id), dbGetScores(round.id)])
      .then(([p, s]) => { if (p.length) setPlayers(p); if (s.length) setScores(s); })
      .catch((e) => console.log("Past round fetch failed", e))
      .finally(() => setLoading(false));
  }, [round.id]);

  if (!holes.length || !players.length) {
    return (
      <BgScreen bg={BG_OTHER}>
        <div style={S.header}><button style={S.backBtn} onClick={onBack}>← Back</button><h2 style={S.headerTitle}>{round.course_name}</h2><div /></div>
        <div style={S.content}><div style={S.empty}>{loading ? "Loading..." : "No scorecard data available for this round."}</div></div>
      </BgScreen>
    );
  }

  let lb = [];
  try { lb = calcLeaderboard(players, scores, holes, round.game_type); } catch(e) { console.log("lb error", e); }

  const metricColor = (p) => {
    if (round.game_type === "banker") return p.total > 0 ? "#22c55e" : p.total < 0 ? "#ef4444" : "#94a3b8";
    if (round.game_type === "stableford" || round.game_type === "matchplay" || round.game_type === "matchplay_teams") return "#22c55e";
    return p.toPar < 0 ? "#22c55e" : p.toPar > 0 ? "#ef4444" : "#3b82f6";
  };
  const metricValue = (p) => {
    if (round.game_type === "banker") return (p.total >= 0 ? "+$" : "-$") + Math.abs(p.total);
    if (round.game_type === "stableford") return p.total + " pts";
    if (round.game_type === "matchplay" || round.game_type === "matchplay_teams") return p.total + " holes";
    return "Gross: " + p.grossTotal + "  " + formatToPar(p.toPar);
  };

  const cellStyle = { textAlign: "center", padding: "2px 0", borderRight: "1px solid #e8edf2", fontSize: 8, overflow: "hidden", whiteSpace: "nowrap" };
  const hdrStyle = { ...cellStyle, background: "#f1f5f9", fontWeight: 700, color: "#475569", fontSize: 7, textTransform: "uppercase" };
  const parStyle = { ...cellStyle, color: "#64748b", background: "#f8fafc", fontSize: 7 };
  const totStyle = { ...cellStyle, background: "#f1f5f9", fontWeight: 800, color: "#1e293b", fontSize: 8, width: 22 };
  const lblW = 34; const totW = 22;

  return (
    <BgScreen bg={BG_OTHER}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <h2 style={S.headerTitle}>{round.course_name}</h2>
        <button style={{ ...S.smallIconBtn, fontSize: 11, padding: "5px 8px" }} onClick={() => exportScorecardPDF(round, players, scores, holes)}>PDF</button>
      </div>
      <div style={S.content}>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>{GAME_TYPES[round.game_type]?.label} · {round.date} · {round.createdBy || ""}</div>

        {/* Leaderboard */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Leaderboard</div>
        {lb.map((p, i) => (
          <div key={p.id} style={{ ...S.lbRow }}>
            <div style={{ ...S.lbPos, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2f" : "#475569" }}>{i + 1}</div>
            <div style={S.lbName}>{p.name}<span style={S.lbHcp}>HCP {p.handicap}</span></div>
            <div style={{ fontSize: 14, fontWeight: 700, color: metricColor(p) }}>{metricValue(p)}</div>
          </div>
        ))}

        {/* Scorecards */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, margin: "20px 0 8px" }}>Scorecards</div>
        {players.map((player) => {
          const playerScores = scores.filter((s) => s.player_id === player.id);
          const lbPlayer = lb.find((p) => p.id === player.id);

          return (
            <div key={player.id} style={{ marginBottom: 16 }}>
              <div style={{ background: "#1e3a5f", borderRadius: "6px 6px 0 0", padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#f8fafc" }}>{player.name}</span>
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>
                  {(() => {
                    const ps2 = scores.filter((s) => s.player_id === player.id);
                    const gross = ps2.reduce((sum, s) => sum + s.score, 0);
                    const grossPar = holes.reduce((sum, h) => { const s = ps2.find((x) => x.hole_number === h.hole_number); return s ? sum + h.par : sum; }, 0);
                    const gtp = gross - grossPar;
                    const net = holes.reduce((sum, h) => { const s = ps2.find((x) => x.hole_number === h.hole_number); if (!s) return sum; return sum + (s.score - getHcpStrokes(player.handicap, h.stroke_index)); }, 0);
                    const ntp = net - grossPar;
                    const f = (v) => v === 0 ? "E" : v > 0 ? "+" + v : "" + v;
                    return gross > 0 ? `${gross} · ${f(gtp)} · N ${f(ntp)}` : `HCP ${player.handicap}`;
                  })()}
                </span>
              </div>
              {[front9, back9].map((nineHoles, ni) => {
                const label = ni === 0 ? "OUT" : "IN";
                const nineScores = playerScores.filter((s) => nineHoles.some((h) => h.hole_number === s.hole_number));
                const nineGross = nineScores.reduce((sum, s) => sum + s.score, 0);

                return (
                  <div key={ni} style={{ background: "#fff", borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", ...(ni === 1 ? { borderBottom: "1px solid #e2e8f0", borderRadius: "0 0 6px 6px" } : {}), overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 300 }}>
                      <thead>
                        <tr>
                          <th style={{ ...hdrStyle, width: lblW, textAlign: "left", paddingLeft: 4 }}></th>
                          {nineHoles.map((h) => <th key={h.hole_number} style={{ ...hdrStyle, minWidth: 20 }}>{h.hole_number}</th>)}
                          <th style={{ ...hdrStyle, width: totW }}>{label}</th>
                        </tr>
                        <tr>
                          <td style={{ ...parStyle, textAlign: "left", paddingLeft: 4, fontWeight: 700 }}>Par</td>
                          {nineHoles.map((h) => <td key={h.hole_number} style={parStyle}>{h.par}</td>)}
                          <td style={{ ...parStyle, ...totStyle }}>{nineHoles.reduce((s, h) => s + (h.par || 0), 0)}</td>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Gross row */}
                        <tr>
                          <td style={{ ...cellStyle, textAlign: "left", paddingLeft: 4, fontWeight: 700, color: "#475569", background: "#fff" }}>G</td>
                          {nineHoles.map((h) => {
                            const s = playerScores.find((sc) => sc.hole_number === h.hole_number);
                            const g = s?.score;
                            const hs = isHandicap ? getHcpStrokes(player.handicap, h.stroke_index) : 0;
                            const { shape } = g ? getScoreShape(g, h.par) : { shape: "none" };
                            const shapeStyle = shape === "eagle" ? { borderRadius: "50%", border: "1.5px solid #1e293b", outline: "1.5px solid #1e293b", outlineOffset: 2 }
                              : shape === "birdie" ? { borderRadius: "50%", border: "1.5px solid #1e293b" }
                              : shape === "bogey" ? { border: "1.5px solid #1e293b", borderRadius: 3 }
                              : shape === "double" ? { border: "1.5px solid #1e293b", borderRadius: 3, outline: "1.5px solid #1e293b", outlineOffset: 2 }
                              : {};
                            return (
                              <td key={h.hole_number} style={{ ...cellStyle, background: "#fff", padding: "2px 1px" }}>
                                {g ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, fontSize: 8, fontWeight: 800, color: "#1e293b", ...shapeStyle }}>{g}</span>
                                  : <span style={{ color: "#cbd5e1", fontSize: 9 }}>—</span>}
                              </td>
                            );
                          })}
                          <td style={{ ...totStyle, background: "#f1f5f9" }}>{nineGross || "—"}</td>
                        </tr>
                        {/* Net row */}
                        {isHandicap && (
                          <tr>
                            <td style={{ ...cellStyle, textAlign: "left", paddingLeft: 4, fontWeight: 700, color: "#475569", background: "#fff" }}>N</td>
                            {nineHoles.map((h) => {
                              const s = playerScores.find((sc) => sc.hole_number === h.hole_number);
                              const g = s?.score;
                              const hs = getHcpStrokes(player.handicap, h.stroke_index);
                              const net = g ? g - hs : null;
                              const { shape } = net ? getScoreShape(net, h.par) : { shape: "none" };
                              const shapeStyle = shape === "eagle" ? { borderRadius: "50%", border: "1.5px solid #1e293b", outline: "1.5px solid #1e293b", outlineOffset: 2 }
                                : shape === "birdie" ? { borderRadius: "50%", border: "1.5px solid #1e293b" }
                                : shape === "bogey" ? { border: "1.5px solid #1e293b", borderRadius: 3 }
                                : shape === "double" ? { border: "1.5px solid #1e293b", borderRadius: 3, outline: "1.5px solid #1e293b", outlineOffset: 2 }
                                : {};
                              return (
                                <td key={h.hole_number} style={{ ...cellStyle, background: "#fff", padding: "2px 1px" }}>
                                  {net ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, fontSize: 8, fontWeight: 800, color: "#1e293b", ...shapeStyle }}>{net}</span>
                                    : <span style={{ color: "#cbd5e1", fontSize: 9 }}>—</span>}
                                </td>
                              );
                            })}
                            <td style={{ ...totStyle, background: "#f1f5f9" }}>{nineScores.reduce((sum, s) => { const h = nineHoles.find((hh) => hh.hole_number === s.hole_number); return sum + (h ? s.score - getHcpStrokes(player.handicap, h.stroke_index) : 0); }, 0) || "—"}</td>
                          </tr>
                        )}
                        {/* $ row for banker / pts for stableford / W/L for matchplay */}
                        {(round.game_type === "banker" || round.game_type === "stableford" || round.game_type === "matchplay" || round.game_type === "matchplay_teams") && (
                          <tr>
                            <td style={{ ...cellStyle, textAlign: "left", paddingLeft: 4, fontWeight: 700, color: "#475569", background: "#fff" }}>
                              {round.game_type === "banker" ? "$" : round.game_type === "stableford" ? "Pts" : "W"}
                            </td>
                            {nineHoles.map((h) => {
                              const s = playerScores.find((sc) => sc.hole_number === h.hole_number);
                              const g = s?.score;
                              let val = "—"; let col = "#94a3b8";
                              if (g && round.game_type === "stableford") {
                                const hs = getHcpStrokes(player.handicap, h.stroke_index);
                                const pts = stablefordPoints(g, h.par, hs);
                                val = pts; col = pts > 0 ? "#22c55e" : "#94a3b8";
                              } else if (g && (round.game_type === "matchplay" || round.game_type === "matchplay_teams" || round.game_type === "banker")) {
                                const holeScores = scores.filter((sc) => sc.hole_number === h.hole_number);
                                const allP = players;
                                if (allP.every((p) => holeScores.some((sc) => sc.player_id === p.id))) {
                                  if (round.game_type === "banker") {
                                    const bankerId = lbPlayer?.bankerHoles?.[h.hole_number];
                                    const myNet = g - getHcpStrokes(player.handicap, h.stroke_index);
                                    const bankerScore = holeScores.find((sc) => { const bp = players.find((p) => p.id === sc.player_id); return bp && sc.player_id !== player.id; });
                                    if (bankerScore) {
                                      const bankerNet = bankerScore.score - getHcpStrokes(players.find((p) => p.id === bankerScore.player_id)?.handicap || 0, h.stroke_index);
                                      val = myNet < bankerNet ? "W" : myNet > bankerNet ? "L" : "T";
                                      col = val === "W" ? "#22c55e" : val === "L" ? "#ef4444" : "#94a3b8";
                                    }
                                  } else {
                                    const nets = allP.map((p) => { const sc = holeScores.find((x) => x.player_id === p.id); return sc ? sc.score - getHcpStrokes(p.handicap, h.stroke_index) : Infinity; });
                                    const minNet = Math.min(...nets);
                                    const myNet = g - getHcpStrokes(player.handicap, h.stroke_index);
                                    val = myNet === minNet ? "W" : "L";
                                    col = val === "W" ? "#22c55e" : "#ef4444";
                                  }
                                } else { val = ""; }
                              }
                              return <td key={h.hole_number} style={{ ...cellStyle, background: "#fff", fontSize: 7, fontWeight: 700, color: col }}>{val}</td>;
                            })}
                            <td style={{ ...totStyle, background: "#f1f5f9", color: "#1e293b" }}> </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Settlement for banker */}
        {round.game_type === "banker" && lb.some((p) => p.total !== 0) && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, margin: "8px 0 8px" }}>Settlement</div>
            <div style={{ backgroundColor: "#1e293b", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>Who owes who to square up</div>
              {lb.filter((p) => p.total < 0).map((debtor) => {
                const creditor = lb.find((p) => p.total > 0);
                if (!creditor) return null;
                return (
                  <div key={debtor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #334155" }}>
                    <span style={{ fontSize: 13, color: "#f8fafc" }}>{debtor.name} owes <strong>{creditor.name}</strong></span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>${Math.abs(debtor.total)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </BgScreen>
  );
}

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
    <BgScreen bg={BG_OTHER}>
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
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2, letterSpacing: 1, fontWeight: 600 }}>{r.code}</div>
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
    </BgScreen>
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
  const [spectatorRound, setSpectatorRound] = useState(null);

  useEffect(() => {
    // Check for QR code join link ?join=XXXXXX or watch link ?watch=XXXXXX
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    const watchCode = params.get("watch");
    if (code) { setJoinCode(code); setScreen("join"); }
    if (watchCode) { setJoinCode(watchCode); setScreen("watch"); }

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
      {screen === "home" && <HomeScreen onCreateRound={() => setScreen("create")} onJoinRound={() => setScreen("join")} onWatchRound={() => setScreen("watch")} onAdminLogin={() => setScreen("admin_login")} onRejoin={handleRejoin} lastRound={lastRound} savedRounds={savedRounds} onViewHistory={() => setScreen("history")} onViewTournaments={() => setScreen("tournaments")} />}
      {screen === "history" && <PastRoundsScreen onBack={() => setScreen("home")} onViewRound={(r) => { setViewingRound(r); setScreen("view_round"); }} />}
      {screen === "tournaments" && <TournamentScreen onBack={() => setScreen("home")} />}
      {screen === "watch" && <WatchRoundScreen onBack={() => setScreen("home")} onWatch={(r) => { setSpectatorRound(r); setRound(r); setMe({ id: "spectator", name: "Spectator", handicap: 0 }); setScreen("dashboard_spectator"); }} prefillCode={joinCode} />}
      {screen === "dashboard_spectator" && round && <PlayerDashboardScreen round={round} me={{ id: "spectator", name: "Spectator", handicap: 0 }} onViewScorecard={() => setScreen("scorecard_spectator")} onBack={() => { setScreen("home"); setRound(null); setSpectatorRound(null); }} isSpectator={true} />}
      {screen === "scorecard_spectator" && round && <ScorecardScreen round={round} me={{ id: "spectator", name: "Spectator", handicap: 0 }} onViewDashboard={() => setScreen("dashboard_spectator")} isSpectator={true} />}
      {screen === "view_round" && viewingRound && <PastRoundDetailScreen round={viewingRound} onBack={() => setScreen("history")} />}
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
// Background image helpers
const BG_HOME = "url('/IMG_8877.jpeg')";
const BG_GAME = "url('/IMG_8887.jpeg')";
const BG_OTHER = "url('/IMG_8886.jpeg')";
const BG_POS = { HOME: "center top", GAME: "center center", OTHER: "center center" };

// Lighter overlay so backgrounds show through more
const BG_OVERLAY = "linear-gradient(to bottom, rgba(10,18,35,0.4) 0%, rgba(10,18,35,0.35) 40%, rgba(10,18,35,0.65) 70%, rgba(10,18,35,0.92) 100%)";

// iOS Safari fix: use a fixed-position div as background instead of background-attachment:fixed
const BgScreen = ({ bg, children, style }) => {
  const pos = bg === BG_HOME ? "center top" : "center center";
  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: bg, backgroundSize: "cover", backgroundPosition: pos, zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, background: BG_OVERLAY, zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", flex: 1, minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
};

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
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(env(safe-area-inset-top, 44px) + 8px) 20px 16px", backgroundColor: "#1e293b", borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 10 },
  headerLeft: { display: "flex", flexDirection: "column" },
  headerCourse: { fontSize: 14, fontWeight: 600, color: "#f8fafc" },
  headerGame: { fontSize: 12, color: "#64748b" },
  headerTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#f8fafc" },
  adminBadge: { backgroundColor: "#f59e0b", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 6, letterSpacing: 1 },
  backBtn: { background: "none", border: "1px solid #334155", borderRadius: 8, color: "#22c55e", fontSize: 14, cursor: "pointer", padding: "8px 12px", fontFamily: "inherit", outline: "none", WebkitTapHighlightColor: "transparent" },
  lbBtn: { backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", outline: "none", WebkitTapHighlightColor: "transparent" },
  smallIconBtn: { backgroundColor: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  content: { flex: 1, padding: "20px 20px 40px", overflowY: "auto" },
  stepWrap: { display: "flex", flexDirection: "column", gap: 16 },
  stepTitle: { fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "#f8fafc" },
  label: { fontSize: 13, color: "#94a3b8", fontWeight: 500 },
  input: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px", color: "#f8fafc", fontSize: 16, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit", WebkitAppearance: "none" },
  codeInput: { fontSize: 28, fontWeight: 800, textAlign: "center", letterSpacing: 6 },
  hint: { fontSize: 13, color: "#475569", margin: 0 },
  error: { fontSize: 13, color: "#ef4444", margin: 0 },
  btnPrimary: { backgroundColor: "#22c55e", color: "#0f172a", border: "none", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer", width: "100%", fontFamily: "inherit", WebkitAppearance: "none", outline: "none", WebkitTapHighlightColor: "transparent" },
  btnSecondary: { backgroundColor: "transparent", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 8, fontFamily: "inherit", WebkitAppearance: "none", outline: "none", WebkitTapHighlightColor: "transparent" },
  btnShare: { backgroundColor: "#1e293b", color: "#f59e0b", border: "1px solid #f59e0b", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", fontFamily: "inherit", WebkitAppearance: "none" },
  btnDisabled: { backgroundColor: "#1e293b", color: "#475569", border: "none", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "not-allowed", width: "100%", fontFamily: "inherit", WebkitAppearance: "none", outline: "none", WebkitTapHighlightColor: "transparent" },
  courseList: { display: "flex", flexDirection: "column", gap: 8 },
  courseCard: { display: "flex", alignItems: "center", gap: 12, backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "12px 16px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", WebkitAppearance: "none", outline: "none", WebkitTapHighlightColor: "transparent" },
  courseCardSelected: { border: "2px solid #22c55e", backgroundColor: "#022c22", outline: "none", WebkitTapHighlightColor: "transparent" },
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
  scoreInfoSection: { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "6px 10px", overflow: "visible" },
  scoreInfoSectionTitle: { fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  scoreInfoRow: { display: "flex", gap: 4, overflowX: "auto", paddingBottom: 6, paddingTop: 4, scrollbarWidth: "none" },
  scoreInfoCell: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 48, width: 48, flex: "0 0 auto", padding: "4px 0", overflow: "visible" },
  scoreInfoCellNumber: { fontSize: 9, color: "#64748b", fontWeight: 700, marginBottom: 2 },
  scoreInfoCellValue: { fontSize: 14, fontWeight: 800, color: "#22c55e" },
  lbRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)", marginBottom: 6 },
  lbRowMe: { border: "1px solid rgba(34,197,94,0.6)", borderRadius: 10, padding: "12px 14px", marginBottom: 6 },
  lbPos: { fontSize: 18, fontWeight: 800, color: "#475569", width: 28, flexShrink: 0 },
  lbName: { flex: 1, fontSize: 16, fontWeight: 600, color: "#f8fafc" },
  lbHcp: { fontSize: 11, color: "#94a3b8", fontWeight: 400, marginLeft: 8 },
  lbRight: { textAlign: "right" },
  lbScore: { fontSize: 18, fontWeight: 800, color: "#f8fafc" },
  lbHoles: { fontSize: 11, color: "#94a3b8" },
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
  playerScoresRow: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, paddingTop: 4, scrollbarWidth: "none" },
  playerHoleCell: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44, flex: "0 0 auto", overflow: "visible" },
  playerHoleNumber: { fontSize: 8, color: "#64748b", fontWeight: 700, marginBottom: 2 },
  playerScoreLine: { display: "flex", alignItems: "center", gap: 2 },
  playerScoreLabel: { color: "#94a3b8", fontWeight: 600, fontSize: 9 },
  playerScoreValue: { color: "#22c55e", fontWeight: 700, fontSize: 10, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" },
};
