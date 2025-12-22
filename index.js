const http = require('http');
const { GameDig } = require('gamedig');

const CONFIG = {
    host: '46.174.49.29',
    port: 27204,
    webPort: process.env.PORT || 3000, // Добавил фоллбэк на 3000 для локальных тестов
    refreshRate: 5000 // 5 секунд (в мс для JS)
};

// Генератор фавикона (SVG -> Base64)
function getFavicon(color) {
    const uniqueId = Date.now(); // Уникальный ID заставляет браузер перерисовать иконку
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 100 100" id="${uniqueId}">
        <circle cx="50" cy="50" r="50" fill="${color}"/>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Функция получения и форматирования данных (возвращает объект)
async function getServerData() {
    try {
        const state = await GameDig.query({
            type: 'counterstrike16',
            host: CONFIG.host,
            port: CONFIG.port,
            maxAttempts: 2,
            socketTimeout: 2000
        });
        const hasPlayers = state.players.length > 0;
        const iconColor = hasPlayers ? '#2d43d4' : '#666666';
        
        // Формируем текстовый блок
        let text = '';
        text += `Server:  ${state.name}\n`;
        text += `IP:      ${state.connect}\n`;
        text += `Map:     ${state.map}\n`;
        text += `Players: ${state.players.length} / ${state.maxplayers}\n`;
        text += `Ping:    ${state.ping} ms\n`;
        text += `--------------------------------------\n`;

        if (hasPlayers) {
            const sorted = state.players.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.time || 0) - (a.time || 0));
            
            text += `№   FRAGS    TIME    NICKNAME\n`;
            sorted.forEach((p, i) => {
                const rawScore = (p.raw.score ?? 0);
                const rawTime = (p.raw.time ?? 0);
                const num = (i + 1).toString().padEnd(4);
                const score = rawScore.toString().padEnd(9);
                const hours = Math.floor(rawTime / 3600);
                const mins = Math.floor((rawTime % 3600) / 60);
                const timeStr = `${hours}h ${mins}m`.padEnd(8);
                const safeName = p.name || '<подключение>'; 
                text += `${num}${score}${timeStr}${safeName}\n`;
            });
        } else {
            text += `На сервере никого нет :(\n`;
        }
        return {
            success: true,
            title: `${state.players.length} players : ${state.map}`,
            favicon: getFavicon(iconColor),
            content: text
        };

    } catch (e) {
        return {
            success: false,
            title: "OFFLINE",
            favicon: getFavicon('#c22d22'),
            content: `СЕРВЕР НЕДОСТУПЕН\nОшибка: ${e.message}`
        };
    }
}

const server = http.createServer(async (req, res) => {
    // 1. API Endpoint: Отдает только данные (JSON)
    if (req.url === '/api/status') {
        const data = await getServerData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(data));
    }

    // 2. Главная страница: Отдает статический HTML с JS-скриптом
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

        const initialIcon = getFavicon('#333'); 
        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Загрузка...</title>
            <link id="fav" rel="icon" href="${initialIcon}" type="image/svg+xml">
            <style>
                body { margin: 0; background: #111; color: #eee; font-family: Consolas, monospace; }
                pre { padding: 2.8vw;; margin: 0; white-space: pre-wrap; font-size: 2.8vw; }
            </style>
        </head>
        <body>
            <pre id="info">Загрузка данных...</pre>

            <script>
                async function update() {
                    try {
                        // Запрашиваем данные у нашего же сервера
                        const response = await fetch('/api/status');
                        const data = await response.json();

                        // Обновляем текст
                        document.getElementById('info').textContent = data.content;
                        
                        // Обновляем заголовок вкладки
                        document.title = data.title;

                        // Обновляем иконку
                        document.getElementById('fav').href = data.favicon;

                    } catch (err) {
                        console.error('Ошибка обновления:', err);
                    }
                }

                // Запустить сразу при загрузке
                update();
                
                // Запускать каждые X секунд
                setInterval(update, ${CONFIG.refreshRate});
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
