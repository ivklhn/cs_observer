const http = require('http');
const { GameDig } = require('gamedig');

const CONFIG = {
    host: '46.174.49.29', // Только IP адрес
    port: 27204,          // Только Порт (цифрами)
    webPort: process.env.PORT,
    refreshRate: 10
};

function getFavicon(color) {
    const uniqueId = Date.now();
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 100 100" id="${uniqueId}">
        <circle cx="50" cy="50" r="50" fill="${color}"/>
    </svg>`;
    const b64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${b64}`;
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    try {
        const state = await GameDig.query({
            type: 'counterstrike16',
            host: CONFIG.host,
            port: CONFIG.port,
            maxAttempts: 3,
            socketTimeout: 3000
        });

        const hasPlayers = state.players.length > 0;
        // Зеленый (#2ecc71) или Красный (#e74c3c)
        const iconColor = hasPlayers ? '#2ecc71' : '#e74c3c'; 
        const faviconUrl = getFavicon(iconColor);

        let html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>${state.players.length} players</title>
            <link rel="icon" href="${faviconUrl}" type="image/svg+xml">
            <meta http-equiv="refresh" content="${CONFIG.refreshRate}">
            <style>
                body { margin: 0; background: #111; color: #eee; font-family: Consolas, monospace; font-size: 14px; }
                pre { padding: 20px; margin: 0; white-space: pre-wrap; }
            </style>
        </head>
        <body>
        <pre>`;
        
        html += `СЕРВЕР:  ${state.name}\n`;
        html += `АДРЕС:   ${state.connect}\n`;
        html += `КАРТА:   ${state.map}\n`;
        html += `ИГРОКИ:  ${state.players.length} / ${state.maxplayers}\n`;
        html += `ПИНГ:    ${state.ping} ms\n`;
        html += `----------------------------------------\n`;

        if (hasPlayers) {
            const sorted = state.players.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.time || 0) - (a.time || 0));

            html += `№   ФРАГИ   ВРЕМЯ    НИКНЕЙМ\n`;
            sorted.forEach((p, i) => {
                const rawScore = (p.score !== undefined && p.score !== null) ? p.score : 0;
                const rawTime = (p.time !== undefined && p.time !== null) ? p.time : 0;
                const num = (i + 1).toString().padEnd(3);
                const score = rawScore.toString().padEnd(7);
                const hours = Math.floor(rawTime / 3600);
                const mins = Math.floor((rawTime % 3600) / 60);
                const timeStr = `${hours}ч ${mins}м`.padEnd(8);
                const safeName = (p.name || '<подключение>').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                html += `${num} ${score} ${timeStr} ${safeName}\n`;
            });
        } else {
            html += `На сервере никого нет :(\n`;
        }
        html += `</pre></body></html>`;
        res.end(html);

    } catch (e) {
        // Серый цвет (#95a5a6)
        const errorIcon = getFavicon('#95a5a6');
        let html = `<!DOCTYPE html>
        <html>
        <head>
            <title>OFFLINE</title>
            <link rel="icon" href="${errorIcon}" type="image/svg+xml">
            <meta http-equiv="refresh" content="5">
            <style>body { background: #111; color: #e74c3c; font-family: monospace; padding: 20px; }</style>
        </head>
        <body>
        <h3>СЕРВЕР НЕДОСТУПЕН</h3>
        <pre>${e.message}</pre>
        </body></html>`;
        res.end(html);
    }
});

server.listen(CONFIG.webPort, () => {
    console.log(`Мониторинг работает: http://localhost:${CONFIG.webPort}`);
});
