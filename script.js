/******************************************************************************
 * ClickMoney — script.js
 * Versão demo: Clique, Bolsa simulada, Propriedades, Carros, Criptos, Mineração,
 * Loja, Prestígio, Conquistas e Leaderboard Local (localStorage).
 *
 * Para produção: ajustar TICK_INTERVAL (em segundos) para 1800 (30 min).
 ******************************************************************************/

/* ============ CONFIG ============ */
const DEBUG = true;
let TICK_INTERVAL = DEBUG ? 30 : 1800; // segundos (30s debug, 1800s = 30min produção)
const TAX_ON_SALE = 0.02; // 2% imposto
const RARE_EVENT_CHANCE = 0.005; // 0.5% chance de variação grande
const SAVE_KEY = 'clickmoney_save_v1';
const LEADER_KEY = 'clickmoney_leaderboard_v1';
const PRESTIGE_THRESHOLD = 10_000_000_000; // 10B default

/* ============ ESTADO DO JOGO ============ */
let state = {
  balance: 500,               // saldo inicial para teste
  clickValue: 1,             // valor por clique
  hourlyIncome: 0,            // renda por hora
  prestigeLevel: 0,           // nível de prestigio
  prestigeMultiplier: 1.0,       // multiplicador por prestigio
  assets: {
    properties: {}, // id -> {qty}
    cars: {},
    miners: {},
    cryptos: {} // symbol -> {qty, avgPrice}
  },
  market: {
    stocks: [],  // list of {id, name, price, change24h, change7d}
    cryptos: [], // list of {symbol, name, price, change24h, change7d}
  },
  upgrades: {},
  achievements: {},
  createdAt: Date.now(),
  lastTickAt: Date.now()
};

/* ============ UTILITÁRIOS ============ */
function fmt(n){
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}
function rand(min,max){ return Math.random()*(max-min)+min; }
function now(){ return Date.now(); }

/* ============ DADOS INICIAIS (pode mover para data/assets.json) ============ */
const INITIAL_PROPERTIES = [
  {id:'prop_mag1', name:'Casa Simples — Magé', price:80000, rentPercent:0.30, location:'Magé'},
  {id:'prop_apt1', name:'Flat — Lisboa', price:1100000, rentPercent:0.30, location:'Lisboa'},
  {id:'prop_du1', name:'Cobertura Luxo — Dubai Marina', price:1200000000, rentPercent:0.30, location:'Dubai'},
  // gerar automaticamente até 50 (preenchimento)
];
const INITIAL_CARS = [
  {id:'car_pop1', name:'Popular 1.0 Flex', price:8000, hourlyPercent:0.01},
  {id:'car_super1', name:'Supercar V12', price:2800000, hourlyPercent:0.035},
  // adicionar mais...
];
const INITIAL_MINERS = [
  {id:'miner_basic', name:'Rig Básico — 4 GPUs', price:2000, hash:50, energyPerHour:1.2, hourlyRevenue:5},
  {id:'miner_pro', name:'Rig Pro — 12 GPUs', price:12000, hash:400, energyPerHour:8, hourlyRevenue:60},
];
const EXCHANGES = [
  "Nova Iorque Stonk Exchanz","Nasdrak","Bz3 MegaBolsa","Londrina Stonk Market",
  "TokioX","ShangHigh Stonks","HonKongue Market","EuroNexxus"
];

// Criptomoedas reais (nomes/símbolos)
const CRYPTOS = [
  {symbol:'BTC', name:'Bitcoin', price:30000},
  {symbol:'ETH', name:'Ethereum', price:1800},
  {symbol:'USDT', name:'Tether', price:1},
  {symbol:'BNB', name:'BNB', price:300},
  {symbol:'XRP', name:'XRP', price:0.5},
  {symbol:'USDC', name:'USDC', price:1},
  {symbol:'ADA', name:'Cardano', price:0.4},
  {symbol:'SOL', name:'Solana', price:20},
  {symbol:'DOGE', name:'Dogecoin', price:0.07},
  {symbol:'TRX', name:'Tron', price:0.06},
];

/* populações auxiliares para propriedades/carros automaticamente para chegar a 50 props e 30 carros */
function fillInitialLists(){
  // propriedades: já temos 3 — vamos replicar com variações
  const cities = ["Magé","Lisboa","Dubai","São Paulo","Rio","Paris","Milão","Madri","Toronto","Sydney"];
  while(INITIAL_PROPERTIES.length < 50){
    const id = 'prop_gen_' + INITIAL_PROPERTIES.length;
    const city = cities[INITIAL_PROPERTIES.length % cities.length];
    const base = 50000 + INITIAL_PROPERTIES.length * 50000;
    INITIAL_PROPERTIES.push({
      id,
      name: `Imóvel ${INITIAL_PROPERTIES.length} — ${city}`,
      price: base,
      rentPercent: 0.15 + (Math.random()*0.2), // 15% a 35%/h (variável)
      location: city
    });
  }

  while(INITIAL_CARS.length < 30){
    const id = 'car_gen_' + INITIAL_CARS.length;
    const price = 5000 + INITIAL_CARS.length * 8000;
    INITIAL_CARS.push({
      id,
      name: `Carro ${INITIAL_CARS.length}`,
      price,
      hourlyPercent: (0.005 + Math.random()*0.045) // 0.5% a 5%
    });
  }
}
fillInitialLists();

/* ============ MARKET SIMULATOR ============ */
function initMarket(){
  state.market.stocks = [];
  for(let i=0;i<24;i++){
    const p = 50 + Math.random()*200;
    state.market.stocks.push({
      id:'stk'+i,
      name: `${EXCHANGES[i % EXCHANGES.length]} - Act${i}`,
      price: p,
      change24h: 0,
      change7d: 0
    });
  }
  state.market.cryptos = CRYPTOS.map(c => ({
    symbol: c.symbol,
    name: c.name,
    price: c.price,
    change24h: 0,
    change7d: 0
  }));
}

/* Aplica variação no tick */
function marketTick(){
  const rnd = Math.random();
  state.market.stocks.forEach(a => {
    let p = rand(0.002, 0.012);
    if (Math.random() < RARE_EVENT_CHANCE) p = 0.03;
    if (Math.random() < 0.5) p = -p;
    a.price = Math.max(0.0001, a.price * (1+p));
    // atualizações simples (acumular como proxy)
    a.change24h = (a.change24h * 0.9) + p*100;
    a.change7d = (a.change7d * 0.98) + p*100;
  });
  state.market.cryptos.forEach(c => {
    let p = rand(0.004, 0.018); // crypto mais volátil
    if (Math.random() < RARE_EVENT_CHANCE) p = 0.06;
    if (Math.random() < 0.5) p = -p;
    c.price = Math.max(0.00001, c.price * (1+p));
    c.change24h = (c.change24h * 0.9) + p*100;
    c.change7d = (c.change7d * 0.98) + p*100;
  });
}

/* ============ COMPRAS / VENDAS ============ */
function buyProperty(id){
  const prop = INITIAL_PROPERTIES.find(p => p.id===id);
  if(!prop) return alert("Propriedade inválida");
  if(state.balance < prop.price) return alert("Saldo insuficiente");
  state.balance -= prop.price;
  state.assets.properties[id] = (state.assets.properties[id]||0) + 1;
  recalcIncome();
  checkAchievements();
  save();
}
function buyCar(id){
  const car = INITIAL_CARS.find(c => c.id===id);
  if(!car) return alert("Carro inválido");
  if(state.balance < car.price) return alert("Saldo insuficiente");
  state.balance -= car.price;
  state.assets.cars[id] = (state.assets.cars[id]||0)+1;
  recalcIncome();
  checkAchievements();
  save();
}
function buyMiner(id){
  const m = INITIAL_MINERS.find(x => x.id===id);
  if(!m) return alert("Miner inválido");
  if(state.balance < m.price) return alert("Saldo insuficiente");
  state.balance -= m.price;
  state.assets.miners[id] = (state.assets.miners[id]||0)+1;
  recalcIncome();
  save();
}
function buyCrypto(symbol, qty){
  const c = state.market.cryptos.find(x=>x.symbol===symbol);
  if(!c) return alert("Crypto inválida");
  const total = c.price * qty;
  if(state.balance < total) return alert("Saldo insuficiente");
  state.balance -= total;
  const pos = state.assets.cryptos[symbol] || {qty:0, avg:0};
  const newQty = pos.qty + qty;
  const newAvg = (pos.qty*pos.avg + total)/newQty;
  state.assets.cryptos[symbol] = {qty:newQty, avg:newAvg};
  save();
}
function sellCrypto(symbol, qty){
  const pos = state.assets.cryptos[symbol];
  if(!pos || pos.qty < qty) return alert("Posição insuficiente");
  const c = state.market.cryptos.find(x=>x.symbol===symbol);
  const total = c.price * qty;
  const tax = total * TAX_ON_SALE;
  const received = total - tax;
  pos.qty -= qty;
  if(pos.qty === 0) delete state.assets.cryptos[symbol];
  state.balance += received;
  recalcIncome();
  save();
}
function sellProperty(id){
  const q = state.assets.properties[id] || 0;
  if(q<=0) return alert("Você não possui essa propriedade");
  const prop = INITIAL_PROPERTIES.find(p => p.id===id);
  const total = prop.price * q;
  const tax = total * TAX_ON_SALE;
  state.balance += (total - tax);
  delete state.assets.properties[id];
  recalcIncome();
  save();
}
function sellCar(id){
  const q = state.assets.cars[id] || 0;
  if(q<=0) return alert("Você não possui esse carro");
  const car = INITIAL_CARS.find(c => c.id===id);
  const total = car.price * q;
  const tax = total * TAX_ON_SALE;
  state.balance += (total - tax);
  delete state.assets.cars[id];
  recalcIncome();
  save();
}

/* ============================================================
   SISTEMA SIMPLES DE COMPRA / VENDA DE AÇÕES (prompt)
   ============================================================ */

   function promptBuyStock(stockId) {
    const asset = state.market.stocks.find(function(s){ return s.id === stockId; });
    if (!asset) return alert("Ativo inválido");

    const qty = parseInt(prompt(
        "Comprar quantas ações?\n\n" +
        asset.name + "\n" +
        "Preço atual: $" + fmt(asset.price) + "\n", "1"
    ));

    if (!qty || qty <= 0) return;

    const total = asset.price * qty;

    if (state.balance < total) {
        return alert("Saldo insuficiente!");
    }

    // descontar saldo
    state.balance -= total;

    // criar estrutura se necessário
    if (!state.assets) state.assets = {};
    if (!state.assets.stocks) state.assets.stocks = {};
    if (!state.assets.stocks[stockId]) {
        state.assets.stocks[stockId] = { qty: 0, avg: asset.price };
    }

    const pos = state.assets.stocks[stockId];

    // recalcular preço médio
    const newQty = pos.qty + qty;
    pos.avg = (pos.qty * pos.avg + total) / newQty;
    pos.qty = newQty;

    save();
    renderAll();
    alert("Compra realizada: " + qty + " ações!");
}

function promptSellStock(stockId) {
    const asset = state.market.stocks.find(function(s){ return s.id === stockId; });
    if (!asset) return alert("Ativo inválido");

    if (!state.assets || !state.assets.stocks || !state.assets.stocks[stockId]) {
        return alert("Você não possui esta ação.");
    }

    const pos = state.assets.stocks[stockId];

    const qty = parseInt(prompt(
        "Vender quantas ações?\n\n" +
        asset.name + "\n" +
        "Preço atual: $" + fmt(asset.price) + "\n" +
        "Você possui: " + pos.qty + "\n", "1"
    ));

    if (!qty || qty <= 0) return;
    if (qty > pos.qty) return alert("Você não possui tantas ações!");

    const total = asset.price * qty;
    const tax = total * TAX_ON_SALE;
    const received = total - tax;

    pos.qty -= qty;
    if (pos.qty <= 0) delete state.assets.stocks[stockId];

    state.balance += received;

    save();
    renderAll();

    alert("Venda realizada! Você recebeu $" + fmt(received));
}


/* ============ RENDA PASSIVA E BALANCEAMENTO ============ */
function recalcIncome(){
  let hourly = 0;
  // propriedades
  Object.entries(state.assets.properties).forEach(([id,qty])=>{
    const p = INITIAL_PROPERTIES.find(x=>x.id===id);
    if(!p) return;
    hourly += (p.price * p.rentPercent) * qty;
  });
  // carros
  Object.entries(state.assets.cars).forEach(([id,qty])=>{
    const c = INITIAL_CARS.find(x=>x.id===id);
    if(!c) return;
    hourly += (c.price * c.hourlyPercent) * qty;
  });
  // miners (simples: hourlyRevenue * qty)
  Object.entries(state.assets.miners).forEach(([id,qty])=>{
    const m = INITIAL_MINERS.find(x=>x.id===id);
    if(!m) return;
    hourly += (m.hourlyRevenue) * qty;
  });
  // cryptos não dão renda passiva por hora (a menos que queira staking)
  state.hourlyIncome = hourly * state.prestigeMultiplier;
}

/* Aplica renda por tick */
function applyPassiveIncome(tickSeconds){
  const incomeThisTick = state.hourlyIncome * (tickSeconds / 3600);
  state.balance += incomeThisTick;
}

/* ============ PRESTIGE ============ */
function doPrestige(){
  if(state.balance < PRESTIGE_THRESHOLD) return alert(`Você precisa de ${fmt(PRESTIGE_THRESHOLD)} para prestigiar.`);
  // ganhar 5% permanente por nível
  state.prestigeLevel += 1;
  state.prestigeMultiplier = 1 + state.prestigeLevel * 0.05;
  // Reset parcial: limpar inventário, mas manter upgrades especiais se quiser — aqui limpa exceto prestige
  state.assets = {properties:{}, cars:{}, miners:{}, cryptos:{}};
  state.balance = 0;
  recalcIncome();
  save();
  alert(`Prestígio realizado! Nível: ${state.prestigeLevel} • Mult x${state.prestigeMultiplier.toFixed(2)}`);
}

/* ============ CONQUISTAS ============ */
const ACHIEVEMENTS = [
  {id:'first_click', title:'Primeiro Clique', check: s => s.createdAt && true},
  {id:'first_million', title:'Primeiro Milhão', check: s => s.balance >= 1_000_000},
  {id:'magnata_dubai', title:'Magnata de Dubai', check: s => (s.assets.properties['prop_du1'] || 0) >= 1},
  {id:'crypto_hoarder', title:'HODLer', check: s => Object.values(s.assets.cryptos || {}).reduce((a,b)=>a+(b.qty||0),0) >= 100},
];
function checkAchievements(){
  ACHIEVEMENTS.forEach(a=>{
    if(!state.achievements[a.id] && a.check(state)){
      state.achievements[a.id] = {unlockedAt: Date.now()};
      alert(`Conquista desbloqueada: ${a.title}`);
    }
  });
}

/* ============ LEADERBOARD LOCAL ============ */
function leaderboardSubmit(name){
  const board = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]');
  board.push({name, score: state.balance, at: Date.now()});
  board.sort((a,b)=>b.score-a.score);
  localStorage.setItem(LEADER_KEY, JSON.stringify(board.slice(0,50))); // top50
}

/* ============ SALVAMENTO ============ */
function save(){
  state.lastTickAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
function load(){
  const s = localStorage.getItem(SAVE_KEY);
  if(s){
    try{
      const parsed = JSON.parse(s);
      state = {...state, ...parsed};
      // ensure fields exist
      state.assets = state.assets || {properties:{}, cars:{}, miners:{}, cryptos:{}, stocks:{}};
      state.market = state.market || {stocks:[],cryptos:[]};
    }catch(e){
      console.error("Erro ao carregar save", e);
    }
  }
  initMarket();
  recalcIncome();
  renderAll();
}
function resetSave(confirmClear=false){
  if(confirmClear && !confirm("Deseja realmente resetar todo o progresso?")) return;
  localStorage.removeItem(SAVE_KEY);
  load();
  alert("Save resetado.");
}

/* ============ UI / RENDER ============ */
const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

function renderAll(){
  updateTopBar();
  renderTab(activeTab || 'market');
  renderTickerTimer();
}

/* Top bar */
function updateTopBar(){
  $('#saldoDisplay').textContent = fmt(state.balance);
  $('#rendaDisplay').textContent = fmt(state.hourlyIncome) + '/h';
  $('#clickValue').textContent = fmt(state.clickValue * state.prestigeMultiplier);
}

/* Ticker timer */
function renderTickerTimer(){
  // compute remaining time until next tick from lastTickAt
  const elapsed = (Date.now() - (state.lastTickAt || Date.now())) / 1000;
  const rem = Math.max(0, TICK_INTERVAL - (elapsed % TICK_INTERVAL));
  const mm = String(Math.floor(rem/60)).padStart(2,'0');
  const ss = String(Math.floor(rem%60)).padStart(2,'0');
  $('#tickTimer').textContent = `${mm}:${ss}`;
}

/* Tabs */
let activeTab = 'market';
function registerTabClicks(){
  $$('.tab').forEach(b=>{
    b.addEventListener('click', ()=> {
      $$('.tab').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      activeTab = b.dataset.tab;
      renderTab(activeTab);
    });
  });
}
function renderTab(tab){
  const el = $('#content');
  if(tab === 'market'){ renderMarket(el); return; }
  if(tab === 'properties'){ renderProperties(el); return; }
  if(tab === 'cars'){ renderCars(el); return; }
  if(tab === 'crypto'){ renderCrypto(el); return; }
  if(tab === 'mining'){ renderMining(el); return; }
  if(tab === 'shop'){ renderShop(el); return; }
  if(tab === 'achievements'){ renderAchievements(el); return; }
  if(tab === 'leaderboard'){ renderLeaderboard(el); return; }
  if(tab === 'settings'){ renderSettings(el); return; }
  el.innerHTML = '<p>Em breve...</p>';
}

/* Market UI */
function renderMarket(el){
  let html = "<h2>Bolsa — ativos</h2>";
  html += "<table class='table'><thead><tr><th>Ativo</th><th>Preço</th><th>Δ24h</th><th>Δ7d</th><th>Posição</th><th>Ações</th></tr></thead><tbody>";

  state.market.stocks.forEach(function(s){
      const pos = (state.assets.stocks && state.assets.stocks[s.id]) ? state.assets.stocks[s.id].qty : 0;

      html += "<tr>";
      html += "<td>" + s.name + "</td>";
      html += "<td>" + fmt(s.price) + "</td>";
      html += "<td class='small'>" + ((s.change24h || 0).toFixed(2)) + "%</td>";
      html += "<td class='small'>" + ((s.change7d || 0).toFixed(2)) + "%</td>";
      html += "<td class='small'>" + pos + "</td>";

      // Botões: usamos aspas escapadas para onclick (seguro dentro de string)
      html += "<td class='small'>"
           + "<button class='btn' onclick=\"promptBuyStock('" + s.id + "')\">Comprar</button> "
           + "<button class='btn' onclick=\"promptSellStock('" + s.id + "')\">Vender</button>"
           + "</td>";

      html += "</tr>";
  });

  html += "</tbody></table><hr>";
  // cryptos
  html += `<h3>Criptomoedas</h3><table class="table"><thead><tr><th>Moeda</th><th>Preço</th><th>Δ24h</th><th>Posição</th><th>Ações</th></tr></thead><tbody>`;
  state.market.cryptos.forEach(c=>{
    const pos = state.assets.cryptos[c.symbol] || {qty:0, avg:0};
    html += `<tr>
      <td>${c.symbol} — ${c.name}</td>
      <td>${fmt(c.price)}</td>
      <td class="small">${(c.change24h||0).toFixed(2)}%</td>
      <td class="small">${pos.qty || 0}</td>
      <td class="small">
        <button class="btn" onclick="promptBuyCrypto('${c.symbol}')">Comprar</button>
        <button class="btn" onclick="promptSellCrypto('${c.symbol}')">Vender</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* Properties UI */
function renderProperties(el){
  let html = `<h2>Propriedades</h2>`;
  html += `<p class="small">Propriedades geram aluguel por hora (ex.: 30% do valor/h para alguns itens — balanceamento neste demo).</p>`;
  html += `<table class="table"><thead><tr><th>Nome</th><th>Preço</th><th>Renda/h</th><th>Você</th><th>Ações</th></tr></thead><tbody>`;
  INITIAL_PROPERTIES.forEach(p=>{
    const myQty = state.assets.properties[p.id] || 0;
    html += `<tr>
      <td>${p.name}</td>
      <td>${fmt(p.price)}</td>
      <td>${((p.price * p.rentPercent) || 0).toFixed(0)}/h</td>
      <td class="small">${myQty}</td>
      <td class="small">
        <button class="btn" onclick="buyProperty('${p.id}')">Comprar</button>
        ${ myQty>0 ? `<button class="btn" onclick="sellProperty('${p.id}')">Vender Tudo</button>` : '' }
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* Cars UI */
function renderCars(el){
  let html = `<h2>Carros</h2><table class="table"><thead><tr><th>Nome</th><th>Preço</th><th>Renda/h</th><th>Você</th><th>Ações</th></tr></thead><tbody>`;
  INITIAL_CARS.forEach(c=>{
    const myQty = state.assets.cars[c.id] || 0;
    html += `<tr>
      <td>${c.name}</td>
      <td>${fmt(c.price)}</td>
      <td>${(c.price * c.hourlyPercent).toFixed(0)}/h</td>
      <td class="small">${myQty}</td>
      <td class="small">
        <button class="btn" onclick="buyCar('${c.id}')">Comprar</button>
        ${ myQty>0 ? `<button class="btn" onclick="sellCar('${c.id}')">Vender Tudo</button>` : '' }
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* Crypto UI */
function renderCrypto(el){
  let html = `<h2>Criptomoedas</h2>`;
  html += `<p class="small">Compre barato, venda caro. Imposto ${TAX_ON_SALE*100}% nas vendas.</p>`;
  html += `<table class="table"><thead><tr><th>Moeda</th><th>Preço</th><th>Você</th><th>Ações</th></tr></thead><tbody>`;
  state.market.cryptos.forEach(c=>{
    const pos = state.assets.cryptos[c.symbol] || {qty:0, avg:0};
    html += `<tr>
      <td>${c.symbol}</td>
      <td>${fmt(c.price)}</td>
      <td>${pos.qty || 0} @ ${pos.avg ? fmt(pos.avg) : '-'}</td>
      <td><button class="btn" onclick="promptBuyCrypto('${c.symbol}')">Comprar</button> <button class="btn" onclick="promptSellCrypto('${c.symbol}')">Vender</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* Mining UI */
function renderMining(el){
  let html = `<h2>Mineração</h2><p class="small">Rigs geram renda por hora (hash fictício). Custos de energia simulados no price balance.</p>`;
  html += `<table class="table"><thead><tr><th>Nome</th><th>Preço</th><th>Renda/h</th><th>Você</th><th>Ações</th></tr></thead><tbody>`;
  INITIAL_MINERS.forEach(m=>{
    const myQty = state.assets.miners[m.id] || 0;
    html += `<tr>
      <td>${m.name}</td>
      <td>${fmt(m.price)}</td>
      <td>${fmt(m.hourlyRevenue)}/h</td>
      <td>${myQty}</td>
      <td><button class="btn" onclick="buyMiner('${m.id}')">Comprar</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* Shop UI (upgrades) */
function renderShop(el){
  let html = `<h2>Loja / Upgrades</h2><p class="small">Upgrades afetam clicks, rendimento, custos.</p>`;
  html += `<div class="row"><div class="card" style="flex:1">
    <h3>Upgrade: Clicker Manual</h3>
    <p class="small">Aumenta ganho por clique +1</p>
    <button class="btn" onclick="buyUpgrade('clicker1', 100)">Comprar — $100</button>
  </div>
  <div class="card" style="flex:1">
    <h3>Upgrade: Sistema de Reinvest</h3>
    <p class="small">+10% renda passiva</p>
    <button class="btn" onclick="buyUpgrade('reinvest1', 1000)">Comprar — $1.000</button>
  </div></div>`;
  el.innerHTML = html;
}

/* Achievements UI */
function renderAchievements(el){
  let html = `<h2>Conquistas</h2><div>`;
  ACHIEVEMENTS.forEach(a=>{
    const unlocked = state.achievements[a.id];
    html += `<div class="card" style="margin-bottom:8px">
      <strong>${a.title}</strong> — ${unlocked ? '✅' : '❌'}
      <div class="small">${unlocked ? 'Desbloqueado em ' + new Date(unlocked.unlockedAt).toLocaleString() : 'Ainda não'}</div>
    </div>`;
  });
  html += `</div>`;
  el.innerHTML = html;
}

/* Leaderboard UI */
function renderLeaderboard(el){
  const board = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]');
  let html = `<h2>Leaderboard Local</h2><div class="small">Salve seu nome com seu saldo atual.</div>
    <div style="margin:8px 0">
      <input id="leaderName" placeholder="Seu nome..." />
      <button class="btn" onclick="submitLeader()">Salvar</button>
    </div>`;
  html += `<table class="table"><thead><tr><th>#</th><th>Nome</th><th>Saldo</th><th>Data</th></tr></thead><tbody>`;
  board.forEach((r,i)=>{
    html += `<tr><td>${i+1}</td><td>${r.name}</td><td>${fmt(r.score)}</td><td class="small">${new Date(r.at).toLocaleDateString()}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}
function submitLeader(){
  const name = document.getElementById('leaderName').value || 'Anon';
  leaderboardSubmit(name);
  renderTab('leaderboard');
}

/* Settings UI */
function renderSettings(el){
  let html = `<h2>Configurações</h2>
    <div class="card">
      <div class="small">Tick (debug)</div>
      <div><strong>${TICK_INTERVAL}s</strong> (mude em script.js para produção)</div>
      <div style="margin-top:8px"><button class="btn" onclick="toggleDebug()">Alternar debug</button></div>
    </div>`;
  el.innerHTML = html;
}
function toggleDebug(){ alert('Mudar manualmente no script - DEBUG flag.'); }

/* ============ INTERAÇÕES (prompts e upgrades) ============ */
function promptBuyCrypto(symbol){
  const qty = parseFloat(prompt(`Quantidade de ${symbol} para comprar? (ex: 0.1)`,'1'));
  if(isNaN(qty) || qty <= 0) return;
  buyCrypto(symbol, qty);
  renderAll();
}
function promptSellCrypto(symbol){
  const qty = parseFloat(prompt(`Quantidade de ${symbol} para vender?`,'1'));
  if(isNaN(qty) || qty <= 0) return;
  sellCrypto(symbol, qty);
  renderAll();
}
function buyUpgrade(key, price){
  if(state.balance < price) return alert('Saldo insuficiente');
  state.balance -= price;
  state.upgrades[key] = (state.upgrades[key]||0)+1;
  // efeitos
  if(key === 'clicker1') state.clickValue += 1;
  if(key === 'reinvest1') {
    state.prestigeMultiplier += 0.10; // exemplo
    recalcIncome();
  }
  save();
  renderAll();
}

/* ============ TICK / LOOP PRINCIPAL ============ */
function gameTick(){
  // 1) market tick
  marketTick();
  // 2) aplicar renda por tick
  applyPassiveIncome(TICK_INTERVAL);
  // 3) recalc income & achievements & save
  recalcIncome();
  checkAchievements();
  save();
  renderAll();
}

/* Forçar tick (QA) */
function forceTick(){
  gameTick();
  alert('Tick forçado.');
}

/* CLIQUE */
document.getElementById('clickBtn').addEventListener('click', ()=>{
  state.balance += state.clickValue * state.prestigeMultiplier;
  checkAchievements();
  renderAll();
  save();
});

/* Início: load e loop */
load();
registerTabClicks();
updateTopBar();

// timer visual
setInterval(renderTickerTimer, 1000);

// tick automático usando TICK_INTERVAL
setInterval(()=>{
  gameTick();
}, TICK_INTERVAL * 1000);

/* ============ Inicializações finais ============ */
function promptBuyDefault(){
  // dar itens iniciais grátis para testes (opcional)
}
