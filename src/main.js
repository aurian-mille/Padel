import './styles.css'
import {
  createTournament, getTournament, updateTournamentStatus,
  getTeams, addTeam, deleteTeam, updateTeamStats, assignTeamPool,
  getPoolMatches, insertPoolMatch, updatePoolMatch,
  getBracketMatches, insertBracketMatch, updateBracketMatch, updateBracketTeam,
  subscribeToTournament
} from './lib/supabase.js'
import {
  buildPools, buildPoolMatches, rankPoolTeams,
  buildBracket, teamLabel, generateAdminCode
} from './lib/tournament.js'

// ─── STATE ──────────────────────────────────────────────────────────────────
let state = {
  tournamentId: null,
  tournament: null,
  teams: [],
  poolMatches: [],
  bracketMatches: [],
  adminMode: false,
  adminCode: null,
  currentPage: 'home',
  loading: false,
  realtimeChannel: null
}

// ─── INIT ────────────────────────────────────────────────────────────────────
async function init() {
  renderShell()
  const params = new URLSearchParams(location.search)
  const tid = params.get('t') || localStorage.getItem('last_tournament')

  if (tid) {
    await loadTournament(tid)
  } else {
    showPage('home')
  }
}

async function loadTournament(id) {
  setLoading(true)
  try {
    state.tournamentId = id
    state.tournament = await getTournament(id)
    state.teams = await getTeams(id)
    state.poolMatches = await getPoolMatches(id)
    state.bracketMatches = await getBracketMatches(id)
    localStorage.setItem('last_tournament', id)

    // Reconnect realtime
    if (state.realtimeChannel) state.realtimeChannel.unsubscribe()
    state.realtimeChannel = subscribeToTournament(id, {
      onPoolMatch:    () => refreshPoolMatches(),
      onBracketMatch: () => refreshBracketMatches(),
      onTeam:         () => refreshTeams(),
      onTournament:   () => refreshTournament()
    })
  } catch (e) {
    toast('Tournoi introuvable')
    localStorage.removeItem('last_tournament')
  }
  setLoading(false)
  renderAll()
}

async function refreshPoolMatches() {
  state.poolMatches = await getPoolMatches(state.tournamentId)
  if (state.currentPage === 'pools') renderPoolsPage()
}
async function refreshBracketMatches() {
  state.bracketMatches = await getBracketMatches(state.tournamentId)
  if (state.currentPage === 'bracket') renderBracketPage()
  if (state.currentPage === 'ranking') renderRankingPage()
}
async function refreshTeams() {
  state.teams = await getTeams(state.tournamentId)
  if (state.currentPage === 'register') renderRegisterPage()
  if (state.currentPage === 'home') renderHomePage()
  updateStats()
}
async function refreshTournament() {
  state.tournament = await getTournament(state.tournamentId)
  renderHomePage()
  updateStats()
}

// ─── SHELL ────────────────────────────────────────────────────────────────────
function renderShell() {
  document.getElementById('app').innerHTML = `
    <div class="header">
      <div class="logo">PADEL<span>TOURNOI</span></div>
      <div id="header-status" class="header-status">—</div>
    </div>
    <div class="content" id="content"></div>
    <nav class="nav">
      <button class="nav-btn" data-page="home"     onclick="nav('home')"><i class="ti ti-home"></i>Accueil</button>
      <button class="nav-btn" data-page="register" onclick="nav('register')"><i class="ti ti-user-plus"></i>Inscrire</button>
      <button class="nav-btn" data-page="pools"    onclick="nav('pools')"><i class="ti ti-grid-dots"></i>Poules</button>
      <button class="nav-btn" data-page="bracket"  onclick="nav('bracket')"><i class="ti ti-tournament"></i>Finale</button>
      <button class="nav-btn" data-page="ranking"  onclick="nav('ranking')"><i class="ti ti-trophy"></i>Palmarès</button>
    </nav>
    <div class="toast" id="toast"></div>
  `
}

function renderAll() {
  updateStats()
  showPage(state.currentPage)
}

function nav(page) { showPage(page) }
window.nav = nav

function showPage(page) {
  state.currentPage = page
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page)
  })
  const map = {
    home:     renderHomePage,
    register: renderRegisterPage,
    pools:    renderPoolsPage,
    bracket:  renderBracketPage,
    ranking:  renderRankingPage
  }
  map[page]?.()
}

function setLoading(v) {
  state.loading = v
  if (v) document.getElementById('content').innerHTML = '<div class="loading"><i class="ti ti-loader-2"></i>Chargement…</div>'
}

function updateStats() {
  const s = document.getElementById('header-status')
  if (!s) return
  if (!state.tournament) { s.textContent = 'Aucun tournoi'; return }
  const phases = { registration: 'Inscriptions', pools: 'Poules', bracket: 'Finale', finished: '🏆 Terminé' }
  s.textContent = phases[state.tournament?.status] || '—'
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function renderHomePage() {
  const t = state.tournament
  const matchCount = state.poolMatches.length + state.bracketMatches.length
  document.getElementById('content').innerHTML = `
    <div class="hero">
      <div class="hero-title">${t ? t.name.toUpperCase() : 'PADEL TOURNOI'}</div>
      <div class="hero-sub">${t ? (t.date || '') + (t.location ? ' · ' + t.location : '') : 'Bienvenue'}</div>
      ${t ? '<span class="live-tag"><span class="live-dot"></span> LIVE</span>' : ''}
      <div class="hero-stats">
        <div class="stat-box"><div class="stat-val">${state.teams.length}</div><div class="stat-lbl">Équipes</div></div>
        <div class="stat-box"><div class="stat-val">${[...new Set(state.teams.map(t => t.pool_name).filter(Boolean))].length}</div><div class="stat-lbl">Poules</div></div>
        <div class="stat-box"><div class="stat-val">${matchCount}</div><div class="stat-lbl">Matchs</div></div>
      </div>
    </div>

    ${!t ? `
    <div class="card">
      <div class="card-title"><i class="ti ti-plus"></i> Créer un tournoi</div>
      <div class="input-group"><label class="input-label">Nom du tournoi</label><input class="input" id="t-name" placeholder="Open Padel Paris 2025" maxlength="50"></div>
      <div class="form-row">
        <div class="input-group"><label class="input-label">Date</label><input class="input" id="t-date" type="date"></div>
        <div class="input-group"><label class="input-label">Lieu</label><input class="input" id="t-loc" placeholder="Club XYZ"></div>
      </div>
      <button class="btn btn-primary btn-full" onclick="doCreateTournament()"><i class="ti ti-plus"></i> Créer le tournoi</button>
    </div>
    <div class="card">
      <div class="card-title"><i class="ti ti-link"></i> Rejoindre un tournoi</div>
      <div class="input-group"><label class="input-label">ID du tournoi</label><input class="input" id="t-join" placeholder="Colle l'ID partagé par l'organisateur"></div>
      <button class="btn btn-secondary btn-full" onclick="doJoinTournament()"><i class="ti ti-arrow-right"></i> Rejoindre</button>
    </div>
    ` : `
    <div class="card">
      <div class="card-title"><i class="ti ti-share"></i> Partager</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Partagez ce lien aux joueurs pour qu'ils suivent le tournoi :</div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 12px;font-family:var(--font);font-size:12px;color:var(--accent);word-break:break-all" id="share-url">${location.origin}/?t=${t.id}</div>
      <button class="btn btn-secondary btn-full" style="margin-top:10px" onclick="copyLink()"><i class="ti ti-copy"></i> Copier le lien</button>
    </div>

    <div class="card">
      <div class="toggle-row" onclick="toggleAdmin()">
        <div class="toggle ${state.adminMode ? 'on' : ''}" id="admin-toggle"></div>
        <div>
          <div style="font-family:var(--font);font-size:14px;font-weight:700">Mode organisateur</div>
          <div style="font-size:11px;color:var(--text2)">Saisir les scores et gérer le tournoi</div>
        </div>
      </div>
      ${state.adminMode ? `
      <div class="admin-section">
        <div class="admin-title"><i class="ti ti-settings"></i> Actions</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-secondary btn-full btn-sm" onclick="doGeneratePools()"><i class="ti ti-grid-dots"></i> Générer les poules</button>
          <button class="btn btn-secondary btn-full btn-sm" onclick="doGenerateBracket()"><i class="ti ti-tournament"></i> Lancer la phase finale</button>
        </div>
      </div>` : ''}
    </div>
    `}
  `
}

// ─── REGISTER PAGE ────────────────────────────────────────────────────────────
function renderRegisterPage() {
  if (!state.tournament) { document.getElementById('content').innerHTML = '<div class="empty"><i class="ti ti-alert-circle"></i><p>Créez ou rejoignez un tournoi d\'abord</p></div>'; return }
  document.getElementById('content').innerHTML = `
    <div class="section-title"><i class="ti ti-user-plus"></i> Inscription</div>
    <div class="card">
      <div class="card-title">Inscrire une équipe</div>
      <div class="input-group"><label class="input-label">Joueur 1</label><input class="input" id="p1" placeholder="Prénom Nom" maxlength="30"></div>
      <div class="input-group"><label class="input-label">Joueur 2</label><input class="input" id="p2" placeholder="Prénom Nom" maxlength="30"></div>
      <div class="input-group"><label class="input-label">Niveau (optionnel)</label>
        <select class="input" id="lvl">
          <option value="">— Choisir —</option>
          <option>P25 / Débutant</option><option>P100</option><option>P250</option>
          <option>P500 / Intermédiaire</option><option>P1000 / Confirmé</option><option>Open / Expert</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" onclick="doAddTeam()"><i class="ti ti-plus"></i> Inscrire l'équipe</button>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin-bottom:0">Équipes inscrites</div>
        <span class="badge badge-green">${state.teams.length} équipe${state.teams.length > 1 ? 's' : ''}</span>
      </div>
      ${state.teams.length === 0
        ? '<div class="empty" style="padding:20px"><i class="ti ti-users"></i><p>Aucune équipe inscrite</p></div>'
        : state.teams.map((t, i) => `
          <div class="team-item">
            <div class="team-num">${i + 1}</div>
            <div class="team-info">
              <div class="team-name">${t.player1} / ${t.player2}</div>
              ${t.level ? `<div class="team-level">${t.level}</div>` : ''}
            </div>
            ${state.adminMode ? `<button class="btn btn-danger btn-sm" onclick="doDeleteTeam('${t.id}')"><i class="ti ti-trash"></i></button>` : ''}
          </div>`).join('')
      }
    </div>
  `
}

// ─── POOLS PAGE ───────────────────────────────────────────────────────────────
function renderPoolsPage() {
  if (!state.tournament || state.tournament.status === 'registration') {
    document.getElementById('content').innerHTML = '<div class="empty"><i class="ti ti-grid-dots"></i><p>Les poules seront générées<br>par l\'organisateur</p></div>'
    return
  }

  const poolNames = [...new Set(state.teams.map(t => t.pool_name).filter(Boolean))].sort()
  if (!poolNames.length) { document.getElementById('content').innerHTML = '<div class="empty"><i class="ti ti-grid-dots"></i><p>Aucune poule disponible</p></div>'; return }

  const tabsHTML = `
    <div class="tabs">
      <button class="tab active" id="tab-standings" onclick="switchTab('standings')">Classements</button>
      <button class="tab" id="tab-matches" onclick="switchTab('matches')">Matchs</button>
    </div>
  `

  const standingsHTML = poolNames.map(pName => {
    const poolTeams = state.teams.filter(t => t.pool_name === pName)
    const poolMatchs = state.poolMatches.filter(m => m.pool_name === pName)
    const ranked = rankPoolTeams(poolTeams, poolMatchs)
    return `
      <div class="poule-card">
        <div class="poule-header">Poule ${pName} <span class="badge badge-blue">${poolTeams.length} équipes</span></div>
        <table class="standings-table">
          <thead><tr><th>#</th><th>Équipe</th><th>J</th><th>G</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
            ${ranked.map((t, i) => `
              <tr class="${i < 2 ? 'qualified' : ''}">
                <td class="rank">${i + 1}</td>
                <td class="team-cell">${t.player1.split(' ')[0]}/${t.player2.split(' ')[0]}</td>
                <td>${t.w + t.l}</td>
                <td>${t.w}</td>
                <td>${t.l}</td>
                <td style="color:${t.gf - t.ga >= 0 ? 'var(--success)' : 'var(--danger)'}">${t.gf - t.ga >= 0 ? '+' : ''}${t.gf - t.ga}</td>
                <td class="pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
  }).join('')

  const matchesHTML = poolNames.map(pName => {
    const poolMatchs = state.poolMatches.filter(m => m.pool_name === pName)
    return `
      <div class="poule-card">
        <div class="poule-header">Poule ${pName}</div>
        ${poolMatchs.map(m => `
          <div class="match-row">
            <div class="match-team">
              ${m.team1?.player1?.split(' ')[0] || '?'}<br>
              <small style="color:var(--text2)">${m.team1?.player2?.split(' ')[0] || ''}</small>
            </div>
            <div class="score-wrap">
              <input class="score-input" type="number" min="0" max="9" value="${m.score1 ?? ''}" placeholder="-"
                ${!state.adminMode ? 'readonly' : `onchange="doUpdatePoolScore('${m.id}', this.value, '${m.score2 ?? ''}')"`}>
              <span class="score-sep">–</span>
              <input class="score-input" type="number" min="0" max="9" value="${m.score2 ?? ''}" placeholder="-"
                ${!state.adminMode ? 'readonly' : `onchange="doUpdatePoolScore('${m.id}', '${m.score1 ?? ''}', this.value)"`}>
            </div>
            <div class="match-team right">
              ${m.team2?.player1?.split(' ')[0] || '?'}<br>
              <small style="color:var(--text2)">${m.team2?.player2?.split(' ')[0] || ''}</small>
            </div>
          </div>`).join('')}
      </div>`
  }).join('')

  document.getElementById('content').innerHTML = `
    <div class="section-title"><i class="ti ti-grid-dots"></i> Poules</div>
    ${tabsHTML}
    <div id="tab-content-standings">${standingsHTML}</div>
    <div id="tab-content-matches" style="display:none">${matchesHTML}</div>
  `
}

function switchTab(tab) {
  document.getElementById('tab-standings').classList.toggle('active', tab === 'standings')
  document.getElementById('tab-matches').classList.toggle('active', tab === 'matches')
  document.getElementById('tab-content-standings').style.display = tab === 'standings' ? 'block' : 'none'
  document.getElementById('tab-content-matches').style.display = tab === 'matches' ? 'block' : 'none'
}
window.switchTab = switchTab

// ─── BRACKET PAGE ─────────────────────────────────────────────────────────────
function renderBracketPage() {
  if (!state.bracketMatches.length) {
    document.getElementById('content').innerHTML = '<div class="empty"><i class="ti ti-tournament"></i><p>La phase finale démarrera<br>après les poules</p></div>'
    return
  }

  const rounds = []
  const maxRound = Math.max(...state.bracketMatches.map(m => m.round_index))
  for (let r = 0; r <= maxRound; r++) {
    const ms = state.bracketMatches.filter(m => m.round_index === r).sort((a, b) => a.match_index - b.match_index)
    if (ms.length) rounds.push({ name: ms[0].round_name, matches: ms })
  }

  const roundsHTML = rounds.map(round => `
    <div class="bracket-round">
      <div class="round-header">${round.name}</div>
      <div class="bracket-slots">
        ${round.matches.map(m => {
          const t1 = m.team1
          const t2 = m.team2
          const isTbd1 = !t1
          const isTbd2 = !t2
          return `
          <div class="bracket-match-box">
            <div class="b-team ${m.played && m.winner === 1 ? 'winner' : m.played ? 'loser' : isTbd1 ? 'tbd' : ''}">
              <span class="b-name">${isTbd1 ? 'À déterminer' : t1.player1.split(' ')[0] + '/' + t1.player2.split(' ')[0]}</span>
              ${state.adminMode && !isTbd1 && !isTbd2
                ? `<input class="score-input" type="number" min="0" max="9" value="${m.score1 ?? ''}" placeholder="-" style="width:30px;padding:3px" onchange="doUpdateBracketScore('${m.id}', this.value, '${m.score2 ?? ''}')">`
                : `<span class="b-score" style="color:${m.winner===1?'var(--accent)':'var(--text3)'}">${m.score1 ?? '—'}</span>`}
            </div>
            <div class="b-team ${m.played && m.winner === 2 ? 'winner' : m.played ? 'loser' : isTbd2 ? 'tbd' : ''}">
              <span class="b-name">${isTbd2 ? 'À déterminer' : t2.player1.split(' ')[0] + '/' + t2.player2.split(' ')[0]}</span>
              ${state.adminMode && !isTbd1 && !isTbd2
                ? `<input class="score-input" type="number" min="0" max="9" value="${m.score2 ?? ''}" placeholder="-" style="width:30px;padding:3px" onchange="doUpdateBracketScore('${m.id}', '${m.score1 ?? ''}', this.value)">`
                : `<span class="b-score" style="color:${m.winner===2?'var(--accent)':'var(--text3)'}">${m.score2 ?? '—'}</span>`}
            </div>
          </div>`
        }).join('')}
      </div>
    </div>
  `).join('')

  document.getElementById('content').innerHTML = `
    <div class="section-title"><i class="ti ti-tournament"></i> Phase finale</div>
    <div class="bracket-container">
      <div class="bracket-rounds">${roundsHTML}</div>
    </div>
  `
}

// ─── RANKING PAGE ─────────────────────────────────────────────────────────────
function renderRankingPage() {
  const finalRound = Math.max(...(state.bracketMatches.map(m => m.round_index).concat([-1])))
  const finalMatch = state.bracketMatches.find(m => m.round_index === finalRound && m.match_index === 0)

  if (!finalMatch || !finalMatch.played) {
    document.getElementById('content').innerHTML = '<div class="empty"><i class="ti ti-trophy"></i><p>Le palmarès sera disponible<br>après la finale</p></div>'
    return
  }

  const winner = finalMatch.winner === 1 ? finalMatch.team1 : finalMatch.team2
  const second = finalMatch.winner === 1 ? finalMatch.team2 : finalMatch.team1

  const semiRound = finalRound - 1
  const semiMatches = state.bracketMatches.filter(m => m.round_index === semiRound)
  const thirds = semiMatches.map(m => m.played ? (m.winner === 1 ? m.team2 : m.team1) : null).filter(Boolean)
  const third = thirds[0] || null

  document.getElementById('content').innerHTML = `
    <div class="section-title"><i class="ti ti-trophy"></i> Palmarès</div>
    <div class="card" style="text-align:center">
      <div style="font-family:var(--font);font-size:11px;color:var(--text2);letter-spacing:1px;text-transform:uppercase;margin-bottom:16px">Résultats finaux</div>
      <div class="podium-wrap">
        ${second ? `
        <div class="podium-col">
          <div class="podium-box silver"><div class="podium-rank silver">2</div></div>
          <div class="podium-label">
            <div class="podium-team-name">${second.player1.split(' ')[0]}<br>${second.player2.split(' ')[0]}</div>
            <span class="badge" style="background:rgba(192,192,192,.12);color:var(--silver);border:1px solid rgba(192,192,192,.25);margin-top:4px">Finaliste</span>
          </div>
        </div>` : ''}
        ${winner ? `
        <div class="podium-col">
          <div class="podium-box gold"><div class="podium-rank gold">1</div></div>
          <div class="podium-label">
            <div class="podium-team-name" style="color:var(--gold)">${winner.player1.split(' ')[0]}<br>${winner.player2.split(' ')[0]}</div>
            <span class="badge badge-gold" style="margin-top:4px">🏆 Vainqueur</span>
          </div>
        </div>` : ''}
        ${third ? `
        <div class="podium-col">
          <div class="podium-box bronze"><div class="podium-rank bronze">3</div></div>
          <div class="podium-label">
            <div class="podium-team-name">${third.player1.split(' ')[0]}<br>${third.player2.split(' ')[0]}</div>
            <span class="badge" style="background:rgba(205,127,50,.12);color:var(--bronze);border:1px solid rgba(205,127,50,.25);margin-top:4px">3e place</span>
          </div>
        </div>` : ''}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Classement général</div>
      ${state.teams.map((t, i) => `
        <div class="team-item">
          <div class="team-num" style="background:${i===0?'var(--gold)':i===1?'var(--silver)':i===2?'var(--bronze)':'var(--bg4)'};color:${i<3?'#0a0f1e':'var(--text)'}">${i+1}</div>
          <div class="team-info">
            <div class="team-name">${t.player1} / ${t.player2}</div>
            ${t.level ? `<div class="team-level">${t.level}</div>` : ''}
          </div>
          <span class="badge badge-green">${t.pts ?? 0} pts</span>
        </div>`).join('')}
    </div>
  `
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

async function doCreateTournament() {
  const name = document.getElementById('t-name')?.value.trim()
  const date = document.getElementById('t-date')?.value
  const location = document.getElementById('t-loc')?.value.trim()
  if (!name) { toast('⚠ Entrez un nom'); return }
  const code = generateAdminCode()
  try {
    const t = await createTournament({ name, date: date || null, location: location || null, admin_code: code })
    state.adminMode = true
    state.adminCode = code
    await loadTournament(t.id)
    toast('✓ Tournoi créé ! Code admin : ' + code)
    alert(`Tournoi créé !\n\nVotre code organisateur : ${code}\n\nNotez-le précieusement — il vous permet de saisir les scores.`)
  } catch (e) { toast('Erreur : ' + e.message) }
}
window.doCreateTournament = doCreateTournament

async function doJoinTournament() {
  const id = document.getElementById('t-join')?.value.trim()
  if (!id) { toast('⚠ Entrez un ID'); return }
  await loadTournament(id)
}
window.doJoinTournament = doJoinTournament

function toggleAdmin() {
  if (!state.adminMode) {
    const code = prompt('Entrez votre code organisateur :')
    if (!code) return
    if (code.toUpperCase() !== state.tournament?.admin_code?.toUpperCase()) {
      toast('❌ Code incorrect')
      return
    }
  }
  state.adminMode = !state.adminMode
  renderHomePage()
  toast(state.adminMode ? '✓ Mode organisateur activé' : 'Mode lecture activé')
}
window.toggleAdmin = toggleAdmin

async function doAddTeam() {
  const p1 = document.getElementById('p1')?.value.trim()
  const p2 = document.getElementById('p2')?.value.trim()
  const level = document.getElementById('lvl')?.value
  if (!p1 || !p2) { toast('⚠ Entrez les 2 joueurs'); return }
  if (state.teams.length >= 64) { toast('Maximum 64 équipes'); return }
  try {
    await addTeam({ tournament_id: state.tournamentId, player1: p1, player2: p2, level: level || null })
    document.getElementById('p1').value = ''
    document.getElementById('p2').value = ''
    document.getElementById('lvl').value = ''
    state.teams = await getTeams(state.tournamentId)
    renderRegisterPage()
    toast('✓ ' + p1.split(' ')[0] + ' / ' + p2.split(' ')[0] + ' inscrit !')
  } catch (e) { toast('Erreur : ' + e.message) }
}
window.doAddTeam = doAddTeam

async function doDeleteTeam(id) {
  if (!confirm('Supprimer cette équipe ?')) return
  await deleteTeam(id)
  state.teams = await getTeams(state.tournamentId)
  renderRegisterPage()
  toast('Équipe supprimée')
}
window.doDeleteTeam = doDeleteTeam

async function doGeneratePools() {
  if (state.teams.length < 4) { toast('⚠ Minimum 4 équipes requises'); return }
  if (!confirm(`Générer les poules pour ${state.teams.length} équipes ?`)) return
  try {
    const pools = buildPools(state.teams)
    // Assigner les équipes à leurs poules
    for (const pool of pools) {
      for (const team of pool.teams) {
        await assignTeamPool(team.id, pool.name)
      }
    }
    // Créer les matchs
    const matches = buildPoolMatches(pools)
    for (const m of matches) {
      await insertPoolMatch({ tournament_id: state.tournamentId, ...m })
    }
    await updateTournamentStatus(state.tournamentId, 'pools')
    await loadTournament(state.tournamentId)
    toast('✓ ' + pools.length + ' poules générées !')
    showPage('pools')
  } catch (e) { toast('Erreur : ' + e.message) }
}
window.doGeneratePools = doGeneratePools

async function doUpdatePoolScore(matchId, s1, s2) {
  const v1 = parseInt(s1), v2 = parseInt(s2)
  if (isNaN(v1) || isNaN(v2)) return
  await updatePoolMatch(matchId, v1, v2)
  state.poolMatches = await getPoolMatches(state.tournamentId)
  renderPoolsPage()
}
window.doUpdatePoolScore = doUpdatePoolScore

async function doGenerateBracket() {
  if (state.tournament.status !== 'pools') { toast('⚠ Finissez les poules d\'abord'); return }
  if (!confirm('Lancer la phase finale ?')) return
  try {
    // Récupérer les qualifiés (top 2 de chaque poule)
    const poolNames = [...new Set(state.teams.map(t => t.pool_name).filter(Boolean))].sort()
    const qualifiers = []
    poolNames.forEach(pName => {
      const poolTeams = state.teams.filter(t => t.pool_name === pName)
      const poolMatchs = state.poolMatches.filter(m => m.pool_name === pName)
      const ranked = rankPoolTeams(poolTeams, poolMatchs)
      if (ranked[0]) qualifiers.push(ranked[0])
      if (ranked[1]) qualifiers.push(ranked[1])
    })
    const rounds = buildBracket(qualifiers)
    for (const round of rounds) {
      for (const m of round.matches) {
        await insertBracketMatch({ tournament_id: state.tournamentId, ...m })
      }
    }
    await updateTournamentStatus(state.tournamentId, 'bracket')
    await loadTournament(state.tournamentId)
    toast('✓ Phase finale lancée — ' + qualifiers.length + ' qualifiés !')
    showPage('bracket')
  } catch (e) { toast('Erreur : ' + e.message) }
}
window.doGenerateBracket = doGenerateBracket

async function doUpdateBracketScore(matchId, s1, s2) {
  const v1 = parseInt(s1), v2 = parseInt(s2)
  if (isNaN(v1) || isNaN(v2)) return
  const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : null
  if (!winner) return
  await updateBracketMatch(matchId, v1, v2, winner)

  // Propager le vainqueur au prochain tour
  const m = state.bracketMatches.find(x => x.id === matchId)
  if (m) {
    const nextRoundIdx = m.round_index + 1
    const nextMatchIdx = Math.floor(m.match_index / 2)
    const nextMatch = state.bracketMatches.find(x => x.round_index === nextRoundIdx && x.match_index === nextMatchIdx)
    if (nextMatch) {
      const winnerTeamId = winner === 1 ? m.team1_id : m.team2_id
      const field = m.match_index % 2 === 0 ? 'team1_id' : 'team2_id'
      await updateBracketTeam(nextMatch.id, field, winnerTeamId)
    }
  }

  state.bracketMatches = await getBracketMatches(state.tournamentId)
  renderBracketPage()
}
window.doUpdateBracketScore = doUpdateBracketScore

function copyLink() {
  const url = `${location.origin}/?t=${state.tournamentId}`
  navigator.clipboard.writeText(url).then(() => toast('✓ Lien copié !'))
}
window.copyLink = copyLink

function toast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('show'), 2400)
}

// ─── START ────────────────────────────────────────────────────────────────────
init()
