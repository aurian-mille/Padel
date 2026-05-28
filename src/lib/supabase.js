import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ---- TOURNOIS ----

export async function createTournament(data) {
  const { data: t, error } = await supabase
    .from('tournaments').insert([data]).select().single()
  if (error) throw error
  return t
}

export async function getTournament(id) {
  const { data, error } = await supabase
    .from('tournaments').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function updateTournamentStatus(id, status) {
  const { error } = await supabase
    .from('tournaments').update({ status }).eq('id', id)
  if (error) throw error
}

// ---- ÉQUIPES ----

export async function getTeams(tournamentId) {
  const { data, error } = await supabase
    .from('teams').select('*').eq('tournament_id', tournamentId).order('created_at')
  if (error) throw error
  return data
}

export async function addTeam(team) {
  const { data, error } = await supabase
    .from('teams').insert([team]).select().single()
  if (error) throw error
  return data
}

export async function deleteTeam(id) {
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) throw error
}

export async function updateTeamStats(id, stats) {
  const { error } = await supabase.from('teams').update(stats).eq('id', id)
  if (error) throw error
}

export async function assignTeamPool(id, poolName) {
  const { error } = await supabase
    .from('teams').update({ pool_name: poolName }).eq('id', id)
  if (error) throw error
}

// ---- MATCHS DE POULE ----

export async function getPoolMatches(tournamentId) {
  const { data, error } = await supabase
    .from('pool_matches').select('*, team1:team1_id(*), team2:team2_id(*)')
    .eq('tournament_id', tournamentId).order('created_at')
  if (error) throw error
  return data
}

export async function insertPoolMatch(match) {
  const { data, error } = await supabase
    .from('pool_matches').insert([match]).select().single()
  if (error) throw error
  return data
}

export async function updatePoolMatch(id, score1, score2) {
  const { error } = await supabase
    .from('pool_matches').update({ score1, score2, played: true }).eq('id', id)
  if (error) throw error
}

// ---- PHASE FINALE ----

export async function getBracketMatches(tournamentId) {
  const { data, error } = await supabase
    .from('bracket_matches').select('*, team1:team1_id(*), team2:team2_id(*)')
    .eq('tournament_id', tournamentId).order('round_index').order('match_index')
  if (error) throw error
  return data
}

export async function insertBracketMatch(match) {
  const { data, error } = await supabase
    .from('bracket_matches').insert([match]).select().single()
  if (error) throw error
  return data
}

export async function updateBracketMatch(id, score1, score2, winner) {
  const { error } = await supabase
    .from('bracket_matches')
    .update({ score1, score2, winner, played: true }).eq('id', id)
  if (error) throw error
}

export async function updateBracketTeam(id, field, teamId) {
  const update = {}
  update[field] = teamId
  const { error } = await supabase.from('bracket_matches').update(update).eq('id', id)
  if (error) throw error
}

// ---- REALTIME ----

export function subscribeToTournament(tournamentId, callbacks) {
  const channel = supabase.channel('tournament-' + tournamentId)

  channel
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'pool_matches',
      filter: `tournament_id=eq.${tournamentId}`
    }, callbacks.onPoolMatch)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'bracket_matches',
      filter: `tournament_id=eq.${tournamentId}`
    }, callbacks.onBracketMatch)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'teams',
      filter: `tournament_id=eq.${tournamentId}`
    }, callbacks.onTeam)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'tournaments',
      filter: `id=eq.${tournamentId}`
    }, callbacks.onTournament)
    .subscribe()

  return channel
}
