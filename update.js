const { GameDig } = require('gamedig');
const fs = require('fs');
const CONFIG = { host: '46.174.49.29', port: 27204 };

const fmtTime = s => `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
const favicon = (col, txt) => {
  const sz = String(txt).length > 1 ? 55 : 75;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${col}"/><text x="50%" y="55%" text-anchor="middle" dominant-baseline="central" font-size="${sz}" font-family="sans-serif" fill="#fff" font-weight="bold">${txt}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

async function run() {
  try {
    const s = await GameDig.query({ type: 'counterstrike16', ...CONFIG, maxAttempts: 2, socketTimeout: 2000 });
    const p = s.players.length, m = s.maxplayers;
    const c = p===0 ? '#52525b' : p>=m ? '#ca8a04' : '#16a34a';
    const data = {
      online: true, server: { map: s.map, ping: s.ping, players: p, maxPlayers: m, connect: s.connect },
      playersList: s.players.sort((a,b)=>(b.raw?.score||0)-(a.raw?.score||0)).map(p=>({name:p.name||'Unknown',score:p.raw?.score||0,time:fmtTime(p.raw?.time||0)})),
      favicon: favicon(c, p), title: `[${p}/${m}] ${s.map}`
    };
    fs.writeFileSync('status.json', JSON.stringify(data, null, 2));
  } catch (e) {
    fs.writeFileSync('status.json', JSON.stringify({ online: false, error: e.message, favicon: favicon('#dc2626','!'), title: 'OFFLINE' }));
  }
}
run();