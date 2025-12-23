const http = require('http');
const { GameDig } = require('gamedig');

const CONFIG = {
    host: '46.174.49.29',
    port: 27204,
    webPort: process.env.PORT || 3000,
    refreshRate: 5000 // 5 секунд
};

/**
 * Генератор фавикона (SVG -> Base64)
 * Брутальный квадратный стиль. Максимальный размер цифр.
 */
function getFavicon(color, text) {
    const uniqueId = Date.now();
    const strText = String(text);
    const isDouble = strText.length > 1;
    
    // Если 2 цифры - шрифт 55, если 1 цифра - шрифт 75 (максимально крупно)
    const fontSize = isDouble ? 55 : 75;
    // Тонкая подстройка вертикали, чтобы цифры стояли ровно по центру
    const yPos = isDouble ? "53%" : "55%"; 
    
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 100 100" id="${uniqueId}">
        <rect width="100" height="100" fill="${color}"/>
        <text x="50%" y="${yPos}" text-anchor="middle" dominant-baseline="central" 
              font-family="Arial, sans-serif" font-weight="900" font-size="${fontSize}" fill="white">
            ${strText}
        </text>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Форматирование времени (секунды -> чч:мм)
 */
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`; // Более компактный формат
}

/**
 * Получение данных с игрового сервера
 */
async function getServerData() {
    try {
        const state = await GameDig.query({
            type: 'counterstrike16',
            host: CONFIG.host,
            port: CONFIG.port,
            maxAttempts: 2,
            socketTimeout: 2000
        });

        const playerCount = state.players.length;
        const maxPlayers = state.maxplayers;
        
        // Сортировка: Фраги (убыв.) -> Время (убыв.)
        const sortedPlayers = state.players
            .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.time || 0) - (a.time || 0))
            .map(p => ({
                name: p.name || 'Unknown',
                score: p.raw.score || 0,
                time: formatTime(p.raw.time || 0)
            }));

        // Цвет: Зеленый если есть места, Желтый если фулл, Серый если 0
        let statusColor = '#000000'; // Черный фон по дефолту для иконки
        if (playerCount > 0) statusColor = '#16a34a'; // Green
        if (playerCount >= maxPlayers) statusColor = '#ca8a04'; // Yellow/Orange
        if (playerCount === 0) statusColor = '#52525b'; // Grey

        return {
            online: true,
            server: {
                name: state.name,
                connect: state.connect,
                map: state.map,
                ping: state.ping,
                players: playerCount,
                maxPlayers: maxPlayers
            },
            playersList: sortedPlayers,
            favicon: getFavicon(statusColor, playerCount),
            title: `[${playerCount}/${maxPlayers}] ${state.map}`
        };

    } catch (e) {
        return {
            online: false,
            error: e.message,
            favicon: getFavicon('#dc2626', '!'), // Red
            title: "OFFLINE"
        };
    }
}

const server = http.createServer(async (req, res) => {
    // --- API ENDPOINT ---
    if (req.url === '/api/status') {
        const data = await getServerData();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        });
        return res.end(JSON.stringify(data));
    }

    // --- FRONTEND ---
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        
        const initialIcon = getFavicon('#333', '?');

        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>CONNECTING...</title>
            <link id="fav" rel="icon" href="${initialIcon}" type="image/svg+xml">
            <style>
                :root {
                    --bg: #050505;
                    --panel: #111;
                    --border: #333;
                    --text: #eee;
                    --text-dim: #666;
                    --accent: #22c55e; /* Acid Green */
                    --danger: #ef4444;
                    --font-mono: "Consolas", "Monaco", "Courier New", monospace;
                }
                
                * { box-sizing: border-box; }
                
                body {
                    margin: 0;
                    padding: 20px;
                    background: var(--bg);
                    color: var(--text);
                    font-family: var(--font-mono);
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .container { width: 100%; max-width: 600px; }

                /* BRUTAL CARD STYLE */
                .panel {
                    background: var(--panel);
                    border: 2px solid var(--border);
                    margin-bottom: 20px;
                    padding: 0;
                }

                .panel-header {
                    background: var(--border);
                    color: #fff;
                    padding: 8px 15px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .status-indicator {
                    width: 12px; height: 12px; background: #555; display: inline-block; margin-right: 8px;
                }
                .status-indicator.on { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
                .status-indicator.off { background: var(--danger); box-shadow: 0 0 8px var(--danger); }

                .panel-body { padding: 20px; }

                /* GRID INFO */
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .info-item label { display: block; color: var(--text-dim); font-size: 0.8rem; margin-bottom: 5px; text-transform: uppercase; }
                .info-item span { font-size: 1.4rem; font-weight: bold; display: block; border-bottom: 2px solid var(--border); padding-bottom: 5px;}

                /* IP SECTION */
                .ip-box {
                    display: flex;
                    border: 2px solid var(--border);
                    background: #000;
                }
                .ip-text {
                    flex-grow: 1;
                    padding: 12px;
                    font-size: 1.1rem;
                    align-self: center;
                }
                .copy-btn {
                    background: var(--border);
                    color: #fff;
                    border: none;
                    border-left: 2px solid var(--border);
                    padding: 0 20px;
                    cursor: pointer;
                    font-family: inherit;
                    font-weight: bold;
                    text-transform: uppercase;
                    transition: all 0.1s;
                }
                .copy-btn:hover { background: var(--text); color: #000; }
                .copy-btn:active { background: var(--accent); color: #000; }

                /* TABLE STYLE */
                table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                th {
                    text-align: left;
                    color: var(--text-dim);
                    text-transform: uppercase;
                    padding: 10px;
                    border-bottom: 2px solid var(--border);
                    font-size: 0.75rem;
                }
                td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #222;
                    border-right: 1px solid #222;
                }
                td:last-child { border-right: none; }
                tr:last-child td { border-bottom: none; }
                
                /* Columns */
                .col-idx { width: 40px; color: var(--text-dim); text-align: center; }
                .col-name { 
                    font-weight: bold; 
                    max-width: 150px;
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                }
                .col-score { text-align: right; color: var(--accent); font-weight: bold; width: 80px; }
                .col-time { text-align: right; color: var(--text-dim); width: 80px; font-size: 0.8rem; }

                /* UTILS */
                .hidden { display: none !important; }
                .text-center { text-align: center; }
                .msg-box { padding: 40px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; }
                
                a.tg-link {
                    color: var(--text-dim);
                    text-decoration: none;
                    border: 1px solid var(--border);
                    padding: 10px 20px;
                    display: inline-block;
                    margin-top: 20px;
                    transition: 0.2s;
                }
                a.tg-link:hover { border-color: var(--accent); color: var(--accent); }

            </style>
        </head>
        <body>
            <div class="container">
                
                <!-- SERVER PANEL -->
                <div class="panel">
                    <div class="panel-header">
                        <span id="sv-name">LOADING...</span>
                        <div id="status-dot" class="status-indicator"></div>
                    </div>
                    <div class="panel-body">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Map</label>
                                <span id="sv-map">--</span>
                            </div>
                            <div class="info-item">
                                <label>Players</label>
                                <span id="sv-players">--/--</span>
                            </div>
                        </div>

                        <div class="ip-box">
                            <div class="ip-text" id="sv-ip">...</div>
                            <button class="copy-btn" onclick="copyIp()">COPY</button>
                        </div>
                    </div>
                </div>

                <!-- PLAYERS PANEL -->
                <div id="players-panel" class="panel hidden">
                    <div class="panel-header">Scoreboard</div>
                    <table cellspacing="0">
                        <thead>
                            <tr>
                                <th class="col-idx">#</th>
                                <th>Name</th>
                                <th class="col-score">Frags</th>
                                <th class="col-time">Time</th>
                            </tr>
                        </thead>
                        <tbody id="players-body"></tbody>
                    </table>
                </div>

                <div id="msg-box" class="panel msg-box text-center hidden"></div>

                <a href="https://t.me/cs_poolday" class="tg-link">>>> T.ME/CS_POOLDAY</a>
            </div>

            <script>
                const UI = {
                    name: document.getElementById('sv-name'),
                    dot: document.getElementById('status-dot'),
                    map: document.getElementById('sv-map'),
                    players: document.getElementById('sv-players'),
                    ip: document.getElementById('sv-ip'),
                    pPanel: document.getElementById('players-panel'),
                    tbody: document.getElementById('players-body'),
                    msg: document.getElementById('msg-box'),
                    fav: document.getElementById('fav')
                };

                let currentIp = '';

                function createCell(text, className) {
                    const td = document.createElement('td');
                    td.textContent = text;
                    if (className) td.className = className;
                    return td;
                }

                async function fetchStatus() {
                    try {
                        const res = await fetch('/api/status');
                        const data = await res.json();
                        render(data);
                    } catch (err) {
                        renderOffline();
                    } finally {
                        setTimeout(fetchStatus, ${CONFIG.refreshRate});
                    }
                }

                function render(data) {
                    document.title = data.title;
                    UI.fav.href = data.favicon;

                    if (!data.online) {
                        renderOffline(data.error);
                        return;
                    }

                    // Server Info
                    UI.name.textContent = data.server.name;
                    UI.dot.className = 'status-indicator on';
                    UI.map.textContent = data.server.map;
                    UI.players.textContent = \`\${data.server.players} / \${data.server.maxPlayers}\`;
                    UI.ip.textContent = data.server.connect;
                    currentIp = data.server.connect;

                    // Players
                    UI.tbody.innerHTML = '';
                    
                    if (data.playersList.length > 0) {
                        UI.pPanel.classList.remove('hidden');
                        UI.msg.classList.add('hidden');

                        data.playersList.forEach((p, index) => {
                            const tr = document.createElement('tr');
                            tr.appendChild(createCell(index + 1, 'col-idx'));
                            tr.appendChild(createCell(p.name, 'col-name'));
                            tr.appendChild(createCell(p.score, 'col-score'));
                            tr.appendChild(createCell(p.time, 'col-time'));
                            UI.tbody.appendChild(tr);
                        });
                    } else {
                        UI.pPanel.classList.add('hidden');
                        UI.msg.textContent = 'SERVER IS EMPTY';
                        UI.msg.classList.remove('hidden');
                    }
                }

                function renderOffline(errorMsg) {
                    UI.name.textContent = 'CONNECTION LOST';
                    UI.dot.className = 'status-indicator off';
                    UI.pPanel.classList.add('hidden');
                    UI.msg.textContent = 'SERVER OFFLINE';
                    UI.msg.classList.remove('hidden');
                }

                function copyIp() {
                    if (!currentIp) return;
                    navigator.clipboard.writeText(currentIp).then(() => {
                        const btn = document.querySelector('.copy-btn');
                        const originalText = btn.textContent;
                        btn.textContent = 'COPIED';
                        btn.style.background = '#22c55e';
                        btn.style.color = '#000';
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.style.background = '';
                            btn.style.color = '';
                        }, 1000);
                    });
                }

                fetchStatus();
            </script>
        </body>
        </html>`;
        
        return res.end(html);
    }

    res.writeHead(404);
    res.end();
});

server.listen(CONFIG.webPort, () => {
    console.log(`Мониторинг запущен на порту ${CONFIG.webPort}`);
});
