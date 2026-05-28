// ---- GÉNÉRATION DES POULES ----

export function buildPools(teams) {
  const shuffled = shuffle([...teams])
  const n = shuffled.length
  const numPools = n <= 8 ? 2 : n <= 16 ? 4 : n <= 32 ? 8 : Math.ceil(n / 4)

  const pools = Array.from({ length: numPools }, (_, i) => ({
    name: String.fromCharCode(65 + i),
    teams: []
  }))

  shuffled.forEach((t, i) => {
    pools[i % numPools].teams.push(t)
  })

  return pools
}

export function buildPoolMatches(pools) {
  const matches = []
  pools.forEach(pool => {
    const ts = pool.teams
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        matches.push({
          pool_name: pool.name,
          team1_id: ts[i].id,
          team2_id: ts[j].id
        })
      }
    }
  })
  return matches
}

// ---- CLASSEMENT DE POULE ----

export function rankPoolTeams(teams, matches) {
  const stats = {}
  teams.forEach(t => {
    stats[t.id] = { ...t, pts: 0, w: 0, l: 0, gf: 0, ga: 0 }
  })

  matches.forEach(m => {
    if (!m.played || m.score1 == null || m.score2 == null) return
    const s1 = parseInt(m.score1)
    const s2 = parseInt(m.score2)
    const t1 = stats[m.team1_id]
    const t2 = stats[m.team2_id]
    if (!t1 || !t2) return
    t1.gf += s1; t1.ga += s2
    t2.gf += s2; t2.ga += s1
    if (s1 > s2) { t1.pts += 3; t1.w++; t2.l++ }
    else if (s2 > s1) { t2.pts += 3; t2.w++; t1.l++ }
    else { t1.pts += 1; t2.pts += 1 }
  })

  return Object.values(stats).sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
  )
}

// ---- GÉNÉRATION DU BRACKET ----

export function buildBracket(qualifiers) {
  // On remonte à la prochaine puissance de 2
  let size = 2
  while (size < qualifiers.length) size *= 2

  // Remplir avec des BYE si nécessaire
  const seeded = [...qualifiers]
  while (seeded.length < size) seeded.push(null)

  const rounds = []
  let current = seeded
  let roundIdx = 0

  const getRoundName = (n) => {
    if (n === 2) return 'Finale'
    if (n === 4) return 'Demi-finales'
    if (n === 8) return 'Quarts de finale'
    if (n === 16) return 'Huitièmes de finale'
    return `Tour ${roundIdx + 1}`
  }

  while (current.length > 1) {
    const matches = []
    for (let i = 0; i < current.length; i += 2) {
      matches.push({
        round_index: roundIdx,
        round_name: getRoundName(current.length),
        match_index: Math.floor(i / 2),
        team1_id: current[i]?.id || null,
        team2_id: current[i + 1]?.id || null,
      })
    }
    rounds.push({ name: getRoundName(current.length), matches })
    current = matches.map(() => null)
    roundIdx++
  }

  return rounds
}

// ---- UTILITAIRES ----

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function teamLabel(team) {
  if (!team) return 'À déterminer'
  return `${team.player1.split(' ')[0]} / ${team.player2.split(' ')[0]}`
}

export function generateAdminCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
