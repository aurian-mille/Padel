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
    document.getElementById('app').innerHTML = `<div class="card" style="text-align:center;margin:20px;"><p>Tournoi introuvable.</p></div>`
    return
  }
  if (savedCode === state.tournament.admin_code) state.isAdmin = true
  await loadData()
  renderApp()

  subscribeTournament(tournamentId, async () => {
    await loadData()
    renderApp()
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
        <h1 class="hero-name">PADEL<span>TORNEO</span></h1>
        <p class="hero-sub">Gestion pro & Live-Score</p>
      </div>
      <div class="card">
        <h3 class="card-title">⚙️ CONFIGURATION DU TOURNOI</h3>
        
        <div class="field">
          <label class="field-label">Nom de la compétition</label>
          <input type="text" id="t-name" class="input" placeholder="ex: P100 Open d'Automne">
        </div>
        
        <div class="field">
          <label class="field-label">Nombre maximal d'équipes</label>
          <input type="number" id="t-max" class="input" value="16" min="4">
        </div>

        <div class="input-row">
          <div class="field">
            <label class="field-label">Équipes par Poule</label>
            <input type="number" id="t-perpool" class="input" value="4" min="3" max="6">
          </div>
          <div class="field">
            <label class="field-label">Qualifiés par Poule</label>
            <select id="t-qperpool" class="input">
              <option value="1">Uniquement le 1er</option>
              <option value="2" selected>Les 2 premiers</option>
            </select>
          </div>
        </div>

        <button id="btn-create" class="btn btn-primary btn-full" style="margin-top:20px; font-weight:bold; letter-spacing:1px;">
          CRÉER LE TOURNOI 🚀
        </button>
      </div>
    </div>
  `
  document.getElementById('btn-create').onclick = async () => {
    const name = document.getElementById('t-name').value.trim()
    if (!name) return showToast('Le nom du tournoi est obligatoire', true)
    
    const admin_code = Math.random().toString(36).slice(2,8).toUpperCase()
    const newT = await updateTournament({
      name,
      max_teams: parseInt(document.getElementById('t-max').value) || 16,
      teams_per_pool: parseInt(document.getElementById('t-perpool').value) || 4,
      qualifiers_per_pool: parseInt(document.getElementById('t-qperpool').value) || 2,
      admin_code,
      status: 'registration'
    })
    localStorage.setItem(`admin_${newT.id}`, admin_code)
    window.location.search = `?id=${newT.id}`
  }
}

function renderApp() {
  const t = state.tournament
  let stepHtml = ''
  
  if (t.status === 'registration') stepHtml = `<div class="step-bar"><span class="step active">1. Inscriptions</span><span class="step">2. Poules</span><span class="step">3. Tableau</span></div>`
  if (t.status === 'pools') stepHtml = `<div class="step-bar"><span class="step done">1. Inscriptions</span><span class="step active">2. Phase de Poules</span><span class="step">3. Tableau</span></div>`
  if (t.status === 'bracket') stepHtml = `<div class="step-bar"><span class="step done">1. Inscriptions</span><span class="step done">2. Poules</span><span class="step active">3. Tableau Final</span></div>`
  if (t.status === 'finished') stepHtml = `<div class="step-bar"><span class="step done">🏆 TOURNOI TERMINÉ</span></div>`

  let html = `
    <header class="topbar">
      <div class="topbar-logo">PADEL<span>LIVE</span></div>
      <div class="topbar-title">${t.name}</div>
    </header>
    <div class="content">
      ${stepHtml}
  `

  if (t.status === 'registration') html += viewRegistration()
  else if (t.status === 'pools') html += viewPools()
  else if (t.status === 'bracket') html += viewBracket()
  else if (t.status === 'finished') html += viewFinished()

  html += `</div>`

  if (t.status !== 'registration' && t.status !== 'finished') {
    html += `
      <nav class="botnav">
        <button class="botnav-btn ${state.activeTab === 'matches' ? 'active' : ''}" id="nv-matches">🎾 MATCHS</button>
        <button class="botnav-btn ${state.activeTab === 'standings' ? 'active' : ''}" id="nv-standings">📊 CLASSEMENT</button>
      </nav>
    `
  }
  document.getElementById('app').innerHTML = html
  bindEvents()
}

function viewRegistration() {
  let html = `
    <div class="card">
      <h3 class="card-title">🔗 Lien public de suivi</h3>
      <div class="share-url" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; font-size:12px; word-break:break-all;">${window.location.href}</div>
    </div>
    <div class="card">
      <h3 class="card-title">👥 Ajouter une équipe (${state.teams.length} / ${state.tournament.max_teams})</h3>
      <div class="input-row">
        <input type="text" id="p1" class="input" placeholder="Joueur 1">
        <input type="text" id="p2" class="input" placeholder="Joueur 2">
      </div>
      <button id="btn-add-team" class="btn btn-primary btn-full" style="margin-top:12px;">+ INSCRIRE L'ÉQUIPE</button>
      
      <div class="divider" style="margin:20px 0;"></div>
      <h4 style="margin-bottom:10px; color:var(--text2)">Liste des inscrits :</h4>
      <div style="display:flex; flex-direction:column; gap:8px;">
  `
  if(state.teams.length === 0) html += `<p style="font-size:13px; color:var(--text3); text-align:center;">Aucune équipe inscrite.</p>`
  state.teams.forEach((tm, idx) => {
    html += `
      <div class="team-row" style="background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:bold; color:var(--accent);">#${idx+1}</span>
        <span style="flex:1; margin-left:15px; font-size:14px;">${tm.player1} / ${tm.player2}</span>
        ${state.isAdmin ? `<button class="btn btn-danger btn-del-team" data-id="${tm.id}" style="padding:2px 8px; font-size:11px;">X</button>` : ''}
      </div>
    `
  })
  html += `</div></div>`

  if (state.isAdmin) {
    html += `
      <div class="admin-box" style="margin-top:20px; background:rgba(230,126,34,0.1); border:1px dashed var(--warn); padding:15px; border-radius:8px; text-align:center;">
        <button id="btn-launch-pools" class="btn btn-warn btn-full" ${state.teams.length < 3 ? 'disabled' : ''}>
          🔒 VERROUILLER ET CRÉER LES POULES
        </button>
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
    const qCount = state.tournament ? (state.tournament.qualifiers_per_pool || 2) : 2;

    Object.keys(pools).sort().forEach(pName => {
      const ranked = rankTeams(pools[pName], state.poolMatches.filter(m => m.pool_name === pName))
      html += `
        <div class="card">
          <div style="font-weight:bold; color:var(--accent); margin-bottom:10px; font-size:16px;">POULE ${pName}</div>
          <table class="standings-tbl" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="border-bottom:1px solid var(--line); text-align:left; color:var(--text3);"><th style="padding:6px;">Pos</th><th>Équipe</th><th>Pts</th><th>J</th></tr></thead>
            <tbody>
      `
      ranked.forEach((team, idx) => {
        const isQualifie = idx < qCount;
        html += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); ${isQualifie ? 'background:rgba(0,230,118,0.03);' : ''}">
            <td style="padding:8px; font-weight:bold; color:${isQualifie ? 'var(--accent)' : 'var(--text3)'}">${idx+1}</td>
            <td>${teamShort(team)} ${isQualifie ? '⭐' : ''}</td>
            <td style="font-weight:bold;">${team.pts || 0}</td>
            <td>${team.played || 0}</td>
          </tr>
        `
      })
      html += `</tbody></table></div>`
    })

    if (state.isAdmin) {
      const allDone = state.poolMatches.every(m => m.played)
      html += `
        <div class="admin-box" style="margin-top:20px; background:rgba(0,230,118,0.1); border:1px solid var(--accent); padding:15px; border-radius:8px; text-align:center;">
          <p style="font-weight:bold; margin-bottom:10px;">PROGRES : ${state.poolMatches.filter(m=>m.played).length} / ${state.poolMatches.length} MATCHS</p>
          <button id="btn-go-bracket" class="btn btn-primary btn-full" ${!allDone ? 'disabled style="opacity:0.5;"' : ''}>
            ${allDone ? '👉 GENERER LE TABLEAU FINAL' : '⏳ EN ATTENTE DES SCORES'}
          </button>
        </div>
      `
    }
    return html
  }

  let html = '<div class="card"><h3 class="card-title">Matchs de Poules</h3>'
  state.poolMatches.forEach(m => {
    const isPlayed = m.played;
    html += `
      <div class="match-card" style="padding:15px; margin-bottom:15px; background:rgba(255,255,255,0.02); border-radius:8px; border-left:4px solid ${isPlayed ? 'var(--accent)' : 'var(--text3)'};">
        <div style="font-size:11px; color:var(--accent); margin-bottom:8px; font-weight:bold;">POULE ${m.pool_name}</div>
        
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="flex:1; font-size:14px; font-weight:${m.winner_id === m.team1_id ? 'bold' : 'normal'}">${teamShort(m.team1)}</div>
          
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="number" id="s1-${m.id}" class="input" value="${m.sets1 !== null ? m.sets1 : ''}" ${!state.isAdmin || isPlayed ? 'readonly' : ''} style="width:45px; text-align:center; padding:5px;" placeholder="0">
            <span style="color:var(--text3)">/</span>
            <input type="number" id="s2-${m.id}" class="input" value="${m.sets2 !== null ? m.sets2 : ''}" ${!state.isAdmin || isPlayed ? 'readonly' : ''} style="width:45px; text-align:center; padding:5px;" placeholder="0">
          </div>
          
          <div style="flex:1; text-align:right; font-size:14px; font-weight:${m.winner_id === m.team2_id ? 'bold' : 'normal'}">${teamShort(m.team2)}</div>
        </div>

        ${state.isAdmin && !isPlayed ? `
          <button class="btn btn-save-inline-pool" data-id="${m.id}" style="margin-top:12px; width:100%; background:var(--accent); color:#0f1923; font-weight:bold; padding:6px;">
            💾 ENREGISTRER
          </button>
        ` : ''}
        ${isPlayed && state.isAdmin ? `
          <button class="btn-modifier" data-id="${m.id}" data-type="pool" style="background:none; border:none; color:var(--text3); font-size:11px; text-decoration:underline; cursor:pointer; margin-top:8px; display:block; width:100%; text-align:center;">Modifier</button>
        ` : ''}
      </div>
    `
  })
  html += '</div>'
  return html
}

function viewBracket() {
  const rounds = {}
  state.bracketMatches.forEach(m => {
    if (!rounds[m.round_name]) rounds[m.round_name] = []
    rounds[m.round_name].push(m)
  })

  let html = ''
  
  Object.keys(rounds).sort((a,b) => rounds[b][0].round_index - rounds[a][0].round_index).forEach(rName => {
    const matches = rounds[rName]
    const allPlayed = matches.every(m => m.played)
    
    html += `
      <div class="card">
        <div style="font-weight:bold; color:var(--blue); font-size:16px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">🏆 ${rName.toUpperCase()}</div>
        <div style="display:flex; flex-direction:column; gap:12px;">
    `
    
    matches.forEach(m => {
      const isPlayed = m.played;
      html += `
        <div style="padding:12px; background:rgba(255,255,255,0.01); border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div style="flex:1; font-size:13px; font-weight:${m.winner_id === m.team1_id ? 'bold' : 'normal'}">${m.team1 ? teamShort(m.team1) : '⏳ Attente'}</div>
            
            <div style="display:flex; align-items:center; gap:4px;">
              <input type="number" id="bs1-${m.id}" class="input" value="${m.sets1 !== null ? m.sets1 : ''}" ${!state.isAdmin || isPlayed || !m.team1 || !m.team2 ? 'readonly' : ''} style="width:40px; text-align:center; padding:4px;" placeholder="0">
              <span style="color:var(--text3)">/</span>
              <input type="number" id="bs2-${m.id}" class="input" value="${m.sets2 !== null ? m.sets2 : ''}" ${!state.isAdmin || isPlayed || !m.team1 || !m.team2 ? 'readonly' : ''} style="width:40px; text-align:center; padding:4px;" placeholder="0">
            </div>
            
            <div style="flex:1; text-align:right; font-size:13px; font-weight:${m.winner_id === m.team2_id ? 'bold' : 'normal'}">${m.team2 ? teamShort(m.team2) : '⏳ Attente'}</div>
          </div>
          
          ${state.isAdmin && !isPlayed && m.team1 && m.team2 ? `
            <button class="btn btn-save-inline-bracket" data-id="${m.id}" style="margin-top:8px; width:100%; background:var(--blue); color:#fff; font-size:12px; padding:4px;">
              VALIDER LE SCORE
            </button>
          ` : ''}
        </div>
      `
    })
    
    html += `</div>`
    
    if (state.isAdmin && allPlayed && rName !== 'Finale') {
      const nextRoundName = rName === 'Quarts de finale' ? 'Demi-finales' : 'Finale';
      html += `
        <button class="btn btn-lock-round" data-round="${rName}" style="margin-top:15px; width:100%; background:var(--accent); color:#0f1923; font-weight:bold; padding:8px; border:none; border-radius:4px; cursor:pointer;">
          🔒 VALIDER LES ${rName.toUpperCase()} -> SOUMETTRE LES ${nextRoundName.toUpperCase()}
        </button>
      `
    }
    
    html += `</div>`
  })

  const hasFinale = state.bracketMatches.find(m => m.round_name === 'Finale');
  if (state.isAdmin && hasFinale && hasFinale.played) {
    html += `<button id="btn-finish-tournament" class="btn btn-warn btn-full" style="margin-top:20px; font-weight:bold;">🏆 CLOTURER LE TOURNOI 🏆</button>`
  }
  
  return html
}

function viewFinished() {
  return `
    <div class="card" style="text-align:center; padding:40px 20px;">
      <h1 style="color:var(--accent); font-size:32px;">🎉 TOURNOI TERMINE 🎉</h1>
      <button onclick="window.location.search=''" class="btn btn-primary" style="margin-top:25px;">Nouveau tournoi</button>
    </div>
  `
}

function bindEvents() {
  const nmBtn = document.getElementById('nv-matches'); if(nmBtn) nmBtn.onclick = () => { state.activeTab = 'matches'; renderApp() }
  const nsBtn = document.getElementById('nv-standings'); if(nsBtn) nsBtn.onclick = () => { state.activeTab = 'standings'; renderApp() }

  const btnAdd = document.getElementById('btn-add-team')
  if (btnAdd) {
    btnAdd.onclick = async () => {
      const p1 = document.getElementById('p1').value.trim()
      const p2 = document.getElementById('p2').value.trim()
      if (!p1 || !p2) return showToast('Veuillez inscrire les deux noms', true)
      await insertTeam({ tournament_id: tournamentId, player1: p1, player2: p2 })
      document.getElementById('p1').value = ''
      document.getElementById('p2').value = ''
      await loadData()
      renderApp()
    }
  }

  document.querySelectorAll('.btn-save-inline-pool').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id
      const s1 = parseInt(document.getElementById(`s1-${id}`).value)
      const s2 = parseInt(document.getElementById(`s2-${id}`).value)
      if (isNaN(s1) || isNaN(s2)) return showToast('Entrez des scores valides', true)
      
      const m = state.poolMatches.find(x => x.id === id)
      const winner_id = s1 > s2 ? m.team1_id : m.team2_id
      await updatePoolMatch(id, { sets1: s1, sets2: s2, played: true, winner_id })
      await loadData()
      renderApp()
    }
  });

  document.querySelectorAll('.btn-modifier').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id
      if(btn.dataset.type === 'pool') {
        await updatePoolMatch(id, { played: false, winner_id: null })
      } else {
        await updateBracketMatch(id, { played: false, winner_id: null })
      }
      await loadData()
      renderApp()
    }
  });

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

  document.querySelectorAll('.btn-save-inline-bracket').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id
      const s1 = parseInt(document.getElementById(`bs1-${id}`).value)
      const s2 = parseInt(document.getElementById(`bs2-${id}`).value)
      if (isNaN(s1) || isNaN(s2)) return showToast('Entrez le score', true)
      
      const m = state.bracketMatches.find(x => x.id === id)
      const winner_id = s1 > s2 ? m.team1_id : m.team2_id
      await updateBracketMatch(id, { sets1: s1, sets2: s2, played: true, winner_id })
      await loadData()
      renderApp()
    }
  });

  document.querySelectorAll('.btn-lock-round').forEach(btn => {
    btn.onclick = async () => {
      const rName = btn.dataset.round
      const currentMatches = state.bracketMatches.filter(m => m.round_name === rName)
      const nextRoundMatches = state.bracketMatches.filter(m => m.round_index === currentMatches[0].round_index + 1)
      
      for (let idx = 0; idx < currentMatches.length; idx++) {
        const m = currentMatches[idx]
        const target = nextRoundMatches[Math.floor(idx / 2)]
        if (target) {
          if (idx % 2 === 0) await updateBracketMatch(target.id, { team1_id: m.winner_id })
          else await updateBracketMatch(target.id, { team2_id: m.winner_id })
        }
      }
      await loadData()
      renderApp()
    }
  });

  const btnGoBracket = document.getElementById('btn-go-bracket')
  if (btnGoBracket) {
    btnGoBracket.onclick = async () => {
      const pools = {}
      state.teams.forEach(t => {
        if (!pools[t.pool_name]) pools[t.pool_name] = []
        pools[t.pool_name].push(t)
      })
      let qualifiers = []
      const qLimit = state.tournament ? (state.tournament.qualifiers_per_pool || 2) : 2;

      Object.keys(pools).sort().forEach(pName => {
        const ranked = rankTeams(pools[pName], state.poolMatches.filter(m => m.pool_name === pName))
        qualifiers = qualifiers.concat(ranked.slice(0, qLimit))
      })
      
      let rSize = qualifiers.length
      if(rSize < 2) return showToast("Pas assez de qualifiés.", true)
      let ri = 0
      while (rSize > 1) {
        let rName = rSize === 2 ? 'Finale' : rSize === 4 ? 'Demi-finales' : 'Quarts de finale'
        for (let mi = 0; mi < rSize / 2; mi++) {
          await insertBracketMatch({
            tournament_id: tournamentId,
            round_index: ri,
            round_name: rName,
            match_index: mi,
            team1_id: ri === 0 ? qualifiers[mi * 2]?.id || null : null,
            team2_id: ri === 0 ? qualifiers[mi * 2 + 1]?.id || null : null
          })
        }
        rSize /= 2; ri++
      }
      await updateTournament(tournamentId, { status: 'bracket' })
      state.activeTab = 'matches'
      await loadData()
      renderApp()
    }
  }

  const btnFinish = document.getElementById('btn-finish-tournament')
  if (btnFinish) { btnFinish.onclick = async () => { await updateTournament(tournamentId, { status: 'finished' }); await loadData(); renderApp() } }
}

window.onload = init;
