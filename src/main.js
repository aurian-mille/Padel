import { 
  getTournament, updateTournament, getTeams, insertTeam, deleteTeam, updateTeam,
  getPoolMatches, insertPoolMatch, updatePoolMatch, getBracketMatches, insertBracketMatch, updateBracketMatch,
  subscribeTournament
} from './lib/db.js'
import { assignPools, makePoolMatches, rankTeams, teamShort } from './lib/logic.js'

let state = {
  tournament: null,
  teams: [],
  poolMatches: [],
  bracketMatches: [],
  isAdmin: false,
  activeTab: 'matches'
}

const params = new URLSearchParams(window.location.search)
const tournamentId = params.get('id')

function showToast(text, isErr = false) {
  const old = document.querySelector('.toast')
  if (old) old.remove()
  const el = document.createElement('div')
  el.className = `toast ${isErr ? 'err' : ''} show`
  el.innerText = text
  document.body.appendChild(el)
  setTimeout(() => el.classList.remove('show'), 3000)
}

async function init() {
  if (!tournamentId) {
    renderLanding()
    return
  }
  const savedCode = localStorage.getItem(`admin_${tournamentId}`)
  state.tournament = await getTournament(tournamentId)
  if (!state.tournament) {
    document.getElementById('app').innerHTML = `<div class="empty"><i class="ti ti-alert-triangle"></i><p>Tournoi introuvable.</p></div>`
    return
  }
  if (savedCode === state.tournament.admin_code) state.isAdmin = true
  await loadData()
  renderApp()

  subscribeTournament(tournamentId, async () => {
    await loadData()
    renderApp()
    showToast('Mise à jour en direct !')
  })
}

async function loadData() {
  state.tournament = await getTournament(tournamentId)
  state.teams = await getTeams(tournamentId)
  state.poolMatches = await getPoolMatches(tournamentId)
  state.bracketMatches = await getBracketMatches(tournamentId)
}

function renderLanding() {
  document.getElementById('app').innerHTML = `
    <div class="content">
      <div class="hero">
        <h1 class="hero-name">PADEL<span>LIVE</span></h1>
        <p class="hero-sub font-body">Gestion de tournois en temps réel</p>
      </div>
      <div class="card">
        <h3 class="card-title"><i class="ti ti-trophy"></i>Créer une compétition</h3>
        <div class="field">
          <label class="field-label">Nom du Tournoi</label>
          <input type="text" id="t-name" class="input" placeholder="P100 Open Club">
        </div>
        <div class="input-row">
          <div class="field">
            <label class="field-label">Équipes Max</label>
            <input type="number" id="t-max" class="input" value="16">
          </div>
          <div class="field">
            <label class="field-label">Par poule</label>
            <input type="number" id="t-perpool" class="input" value="4">
          </div>
        </div>
        <div class="field">
          <label class="field-label">Format des scores</label>
          <select id="t-fmt" class="input">
            <option value="sets">Nombre de Sets (ex: 2-1)</option>
            <option value="games">Détail des Jeux (ex: 6-4, 6-2)</option>
          </select>
        </div>
        <button id="btn-create" class="btn btn-primary btn-full" style="margin-top:10px;">
          GÉNÉRER LE TOURNOI
        </button>
      </div>
    </div>
  `
  document.getElementById('btn-create').onclick = async () => {
    const name = document.getElementById('t-name').value.trim()
    if (!name) return showToast('Nom obligatoire', true)
    const admin_code = Math.random().toString(36).slice(2,8).toUpperCase()
    const newT = await createTournament({
      name,
      max_teams: parseInt(document.getElementById('t-max').value) || 16,
      teams_per_pool: parseInt(document.getElementById('t-perpool').value) || 4,
      score_format: document.getElementById('t-fmt').value,
      admin_code,
      status: 'registration'
    })
    localStorage.setItem(`admin_${newT.id}`, admin_code)
    window.location.search = `?id=${newT.id}`
  }
}

function renderApp() {
  const t = state.tournament
  let chip = `<div class="topbar-chip">INSCRIPTIONS</div>`
  if (t.status === 'pools') chip = `<div class="topbar-chip live"><span class="live-dot"></span> POULES</div>`
  if (t.status === 'bracket') chip = `<div class="topbar-chip live"><span class="live-dot"></span> PH. FINALE</div>`
  if (t.status === 'finished') chip = `<div class="topbar-chip done">TERMINÉ</div>`

  let html = `
    <header class="topbar">
      <div class="topbar-logo">PADEL<span>LIVE</span></div>
      <div class="topbar-title">${t.name}</div>
      ${chip}
    </header>
    <div class="content">
  `

  // ÉTAPES DU TOURNOI
  if (t.status === 'registration') html += viewRegistration()
  else if (t.status === 'pools') html += viewPools()
  else if (t.status === 'bracket') html += viewBracket()
  else if (t.status === 'finished') html += viewFinished()

  html += `</div>`

  // BARRE DE NAVIGATION DU BAS
  if (t.status !== 'registration') {
    html += `
      <nav class="botnav">
        <button class="botnav-btn ${state.activeTab === 'matches' ? 'active' : ''}" id="nv-matches"><i class="ti ti-ball-tennis"></i>MATCHS</button>
        <button class="botnav-btn ${state.activeTab === 'standings' ? 'active' : ''}" id="nv-standings"><i class="ti ti-list-numbers"></i>CLASSEMENT</button>
        <button class="botnav-btn ${state.activeTab === 'bracket' ? 'active' : ''}" id="nv-bracket"><i class="ti ti-tournament"></i>TABLEAU</button>
      </nav>
    `
  }
  html += `<div class="modal-bg" id="score-modal"></div>`
  document.getElementById('app').innerHTML = html
  bindEvents()
}

function viewRegistration() {
  let html = `
    <div class="card">
      <h3 class="card-title"><i class="ti ti-share"></i>Partager le tournoi</h3>
      <div class="share-url">${window.location.href}</div>
      <p style="font-size:11px; color:var(--text2);">Envoyez ce lien aux participants pour qu'ils suivent le direct.</p>
    </div>
    <div class="card">
      <h3 class="card-title"><i class="ti ti-users"></i>Inscrire une équipe (${state.teams.length}/${state.tournament.max_teams})</h3>
      <div class="field"><input type="text" id="p1" class="input" placeholder="Joueur 1"></div>
      <div class="field"><input type="text" id="p2" class="input" placeholder="Joueur 2"></div>
      <button id="btn-add-team" class="btn btn-primary btn-full">VALIDER L'INSCRIPTION</button>
      <div class="divider"></div>
      <div style="display:flex; flex-direction:column; gap:6px;">
  `
  state.teams.forEach((tm, idx) => {
    html += `
      <div class="team-row">
        <div class="team-num">${idx+1}</div>
        <div class="team-info"><div class="team-name">${tm.player1} / ${tm.player2}</div></div>
        ${state.isAdmin ? `<button class="btn btn-danger btn-xs btn-del-team" data-id="${tm.id}"><i class="ti ti-trash"></i></button>` : ''}
      </div>
    `
  })
  html += `</div></div>`

  if (state.isAdmin && state.teams.length >= 4) {
    html += `
      <div class="admin-box">
        <div class="admin-box-title"><i class="ti ti-settings"></i> Administration</div>
        <button id="btn-launch-pools" class="btn btn-warn btn-full">CLÔTURER & LANCER LES POULES</button>
      </div>
    `
  }
  return html
}

function viewPools() {
  if (state.activeTab === 'standings') {
    const pools = {}
    state.teams.forEach(t => {
      if (!pools[t.pool_name]) pools[t.pool_name] = []
      pools[t.pool_name].push(t)
    })
    let html = ''
    Object.keys(pools).sort().forEach(pName => {
      const ranked = rankTeams(pools[pName], state.poolMatches.filter(m => m.pool_name === pName))
      html += `
        <div class="pool-card">
          <div class="pool-head"><span class="pool-head-name">POULE ${pName}</span></div>
          <table class="standings-tbl">
            <thead><tr><th>Pos</th><th>Équipe</th><th>Pts</th><th>J</th><th>Sets</th></tr></thead>
            <tbody>
      `
      ranked.forEach((team, idx) => {
        const q = idx < (state.tournament.qualifiers_per_pool || 2)
        html += `
          <tr class="${q ? 'q' : ''}">
            <td class="cell-rank">${idx+1}</td>
            <td class="cell-team">${teamShort(team)}</td>
            <td class="cell-pts">${team.pts || 0}</td>
            <td>${team.played || 0}</td>
            <td>${team.sf || 0}/${team.sa || 0}</td>
          </tr>
        `
      })
      html += `</tbody></table></div>`
    })
    if (state.isAdmin) {
      html += `
        <div class="admin-box">
          <button id="btn-go-bracket" class="btn btn-primary btn-full">GÉNÉRER LE TABLEAU FINAL</button>
        </div>
      `
    }
    return html
  }

  // Onglet Matchs
  let html = ''
  state.poolMatches.forEach(m => {
    html += `
      <div class="match-card ${m.played ? 'locked' : ''}">
        <div class="match-top">
          <div class="match-team-col">
            <div class="match-player ${m.winner_id === m.team1_id && m.played ? 'winner' : ''}">${teamShort(m.team1)}</div>
          </div>
          <div class="match-score-col">
            <button class="btn ${m.played ? 'btn-ghost' : 'btn-primary'} btn-xs btn-score" data-id="${m.id}" data-type="pool">
              ${m.played ? `${m.sets1}-${m.sets2}` : 'SCORE'}
            </button>
            <span class="badge badge-gray" style="font-size:9px;">Poule ${m.pool_name}</span>
          </div>
          <div class="match-team-col right">
            <div class="match-player ${m.winner_id === m.team2_id && m.played ? 'winner' : ''}">${teamShort(m.team2)}</div>
          </div>
        </div>
      </div>
    `
  })
  return html
}

function viewBracket() {
  const rounds = {}
  state.bracketMatches.forEach(m => {
    if (!rounds[m.round_name]) rounds[m.round_name] = []
    rounds[m.round_name].push(m)
  })
  let html = ''
  Object.keys(rounds).forEach(rName => {
    html += `
      <div class="round-controls">
        <div class="round-controls-title"><i class="ti ti-trophy"></i> ${rName}</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
    `
    rounds[rName].forEach(m => {
      html += `
        <div class="match-card ${m.played ? 'locked' : ''}">
          <div class="match-top">
            <div class="match-team-col">
              <div class="match-player ${m.winner_id === m.team1_id && m.played ? 'winner' : ''}">${teamShort(m.team1)}</div>
            </div>
            <div class="match-score-col">
              <button class="btn ${m.played ? 'btn-ghost' : 'btn-primary'} btn-xs btn-score" data-id="${m.id}" data-type="bracket">
                ${m.played ? `${m.sets1}-${m.sets2}` : 'SCORE'}
              </button>
            </div>
            <div class="match-team-col right">
              <div class="match-player ${m.winner_id === m.team2_id && m.played ? 'winner' : ''}">${teamShort(m.team2)}</div>
            </div>
          </div>
        </div>
      `
    })
    html += `</div>`
    if (state.isAdmin && !rounds[rName].every(m => m.locked)) {
      html += `<button class="btn btn-success btn-xs btn-full btn-lock-round" data-round="${rName}" style="margin-top:10px;">FIGER ET PROPAGEZ LE TOUR</button>`
    }
    html += `</div>`
  })

  if (state.isAdmin && state.bracketMatches.length > 0 && state.bracketMatches.every(m => m.locked)) {
    html += `<button id="btn-finish-tournament" class="btn btn-primary btn-full" style="margin-top:15px;">CLÔTURER DÉFINITIVEMENT LE TOURNOI</button>`
  }
  return html
}

function viewFinished() {
  const finale = state.bracketMatches.find(m => m.round_name === 'Finale')
  let v1 = 'Équipe 1', v2 = 'Équipe 2'
  if (finale && finale.played) {
    v1 = finale.winner_id === finale.team1_id ? teamShort(finale.team1) : teamShort(finale.team2)
    v2 = finale.winner_id === finale.team1_id ? teamShort(finale.team2) : teamShort(finale.team1)
  }
  return `
    <div class="hero"><h2>PODIUM FINAL</h2></div>
    <div class="podium">
      <div class="podium-col">
        <div class="podium-label"><div class="podium-name">${v2}</div></div>
        <div class="podium-box s"><span class="podium-rank s">2</span></div>
      </div>
      <div class="podium-col">
        <div class="podium-label"><div class="podium-name">${v1}</div></div>
        <div class="podium-box g"><span class="podium-rank g">1</span></div>
      </div>
    </div>
  `
}

function bindEvents() {
  ['matches', 'standings', 'bracket'].forEach(t => {
    const btn = document.getElementById(`nv-${t}`)
    if (btn) btn.onclick = () => { state.activeTab = t; renderApp() }
  })

  const btnAdd = document.getElementById('btn-add-team')
  if (btnAdd) {
    btnAdd.onclick = async () => {
      const p1 = document.getElementById('p1').value.trim()
      const p2 = document.getElementById('p2').value.trim()
      if (!p1 || !p2) return showToast('Deux joueurs requis', true)
      await insertTeam({ tournament_id: tournamentId, player1: p1, player2: p2 })
      await loadData()
      renderApp()
    }
  }

  const btnLaunch = document.getElementById('btn-launch-pools')
  if (btnLaunch) {
    btnLaunch.onclick = async () => {
      const poolMap = assignPools(state.teams, state.tournament.teams_per_pool)
      for (const pName of Object.keys(poolMap)) {
        for (const team of poolMap[pName]) {
          await updateTeam(team.id, { pool_name: pName })
        }
        const matches = makePoolMatches(pName, poolMap[pName])
        for (const m of matches) {
          await insertPoolMatch({ tournament_id: tournamentId, ...m })
        }
      }
      await updateTournament(tournamentId, { status: 'pools' })
      state.activeTab = 'matches'
      await loadData()
      renderApp()
    }
  }

  document.querySelectorAll('.btn-score').forEach(btn => {
    btn.onclick = () => {
      if (!state.isAdmin) return showToast('Action réservée à l\'organisateur', true)
      const id = btn.dataset.id
      const match = btn.dataset.type === 'pool' ? state.poolMatches.find(m=>m.id===id) : state.bracketMatches.find(m=>m.id===id)
      openScoreModal(match, btn.dataset.type)
    }
  })

  document.querySelectorAll('.btn-lock-round').forEach(btn => {
    btn.onclick = async () => {
      const rName = btn.dataset.round
      const matches = state.bracketMatches.filter(m => m.round_name === rName)
      if (matches.some(m => !m.played)) return showToast('Matchs non terminés !', true)
      
      for (const m of matches) { await updateBracketMatch(m.id, { locked: true }) }

      if (rName !== 'Finale') {
        const nextMatches = state.bracketMatches.filter(m => m.round_index === matches[0].round_index + 1)
        matches.forEach((m, idx) => {
          const target = nextMatches.find(nm => nm.match_index === Math.floor(idx / 2))
          if (target) {
            const data = idx % 2 === 0 ? { team1_id: m.winner_id } : { team2_id: m.winner_id }
            updateBracketMatch(target.id, data)
          }
        })
      }
      await loadData()
      renderApp()
    }
  }

  const btnGoBracket = document.getElementById('btn-go-bracket')
  if (btnGoBracket) {
    btnGoBracket.onclick = async () => {
      const pools = {}
      state.teams.forEach(t => {
        if (!pools[t.pool_name]) pools[t.pool_name] = []
        pools[t.pool_name].push(t)
      })
      let qualifiers = []
      Object.keys(pools).sort().forEach(pName => {
        const ranked = rankTeams(pools[pName], state.poolMatches.filter(m => m.pool_name === pName))
        qualifiers = qualifiers.concat(ranked.slice(0, state.tournament.qualifiers_per_pool))
      })
      
      let rSize = qualifiers.length
      let ri = 0
      while (rSize > 1) {
        let rName = rSize === 2 ? 'Finale' : rSize === 4 ? 'Demi-finales' : 'Quarts de finale'
        for (let mi = 0; mi < rSize / 2; mi++) {
          await insertBracketMatch({
            tournament_id: tournamentId,
            round_index: ri,
            round_name: rName,
            match_index: mi,
            team1_id: ri === 0 ? qualifiers[mi * 2]?.id : null,
            team2_id: ri === 0 ? qualifiers[mi * 2 + 1]?.id : null
          })
        }
        rSize /= 2; ri++
      }
      await updateTournament(tournamentId, { status: 'bracket' })
      state.activeTab = 'bracket'
      await loadData()
      renderApp()
    }
  }

  const btnFinish = document.getElementById('btn-finish-tournament')
  if (btnFinish) {
    btnFinish.onclick = async () => {
      await updateTournament(tournamentId, { status: 'finished' })
      await loadData()
      renderApp()
    }
  }
}

function openScoreModal(m, type) {
  const overlay = document.getElementById('score-modal')
  overlay.className = 'modal-bg open'
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title"><span>SAISIE DU SCORE</span></div>
      <p style="text-align:center; margin-bottom:15px; font-weight:700;">${teamShort(m.team1)} VS ${teamShort(m.team2)}</p>
      <div class="input-row" style="margin-bottom:15px;">
        <div>
          <label class="field-label">Sets Équipe 1</label>
          <input type="number" id="sc-s1" class="input" value="${m.sets1 || 0}">
        </div>
        <div>
          <label class="field-label">Sets Équipe 2</label>
          <input type="number" id="sc-s2" class="input" value="${m.sets2 || 0}">
        </div>
      </div>
      <button id="btn-save-score" class="btn btn-primary btn-full">ENREGISTRER</button>
    </div>
  `
  document.getElementById('btn-save-score').onclick = async () => {
    const s1 = parseInt(document.getElementById('sc-s1').value) || 0
    const s2 = parseInt(document.getElementById('sc-s2').value) || 0
    const winner_id = s1 > s2 ? m.team1_id : m.team2_id
    const data = { sets1: s1, sets2: s2, played: true, winner_id }

    if (type === 'pool') await updatePoolMatch(m.id, data)
    else await updateBracketMatch(m.id, data)

    overlay.className = 'modal-bg'
    await loadData()
    renderApp()
  }
}

window.onload = init;
