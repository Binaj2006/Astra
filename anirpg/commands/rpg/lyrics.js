/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           AniRPG — /lyrics                           ║
 * ║  Fetch song lyrics via Genius API                    ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Env: GENIUS_TOKEN=your_genius_client_access_token
 * Get free token: https://genius.com/api-clients
 *
 * Usage: /lyrics <song name> [artist]
 */

'use strict';

const https = require('https');

const COOLDOWNS   = new Map();
const COOLDOWN_MS = 15_000;

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'AniRPG/1.0', ...headers }, timeout: 10_000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function searchGenius(query, token) {
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=5`;
  const res = await httpsGet(url, { Authorization: `Bearer ${token}` });
  return res?.response?.hits || [];
}

// Scrape lyrics from Genius page (no extra deps)
async function scrapeLyrics(geniusUrl) {
  return new Promise((resolve, reject) => {
    const req = https.get(geniusUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15_000 }, (res) => {
      let html = '';
      res.on('data', (c) => (html += c));
      res.on('end', () => {
        // Extract from data-lyrics-container divs
        const matches = [...html.matchAll(/data-lyrics-container[^>]+>([\s\S]*?)<\/div>/g)];
        if (!matches.length) return reject(new Error('Could not parse lyrics'));

        let text = matches.map(m => m[1])
          .join('\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\[([^\]]+)\]/g, '\n[$1]\n') // section headers
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        resolve(text);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Lyrics page timeout')); });
  });
}

module.exports = {
  name:        'lyrics',
  aliases:     ['lyric', 'song'],
  description: 'Fetch song lyrics',
  usage:       '/lyrics <song name> [- artist]',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const token  = process.env.GENIUS_TOKEN;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '🎵 *Lyrics Fetcher*',
          '',
          '📌 Usage: /lyrics <song name>',
          '💡 Examples:',
          '  /lyrics Moonlight Sonata',
          '  /lyrics Alone Marshmello',
          '  /lyrics Levitate twenty one pilots',
          '',
          token ? '' : '⚠️ GENIUS_TOKEN not set — results may be limited.',
        ].filter(l => l !== undefined).join('\n'),
      }, { quoted: msg });
    }

    if (!token) {
      return sock.sendMessage(chatId, {
        text: '❌ Lyrics feature requires a Genius API token.\nSet GENIUS_TOKEN in your .env file.\nGet one free at: https://genius.com/api-clients',
      }, { quoted: msg });
    }

    // Cooldown
    const last = COOLDOWNS.get(sender) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Lyrics cooldown: ${wait}s remaining.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    const query = args.join(' ');

    await sock.sendMessage(chatId, {
      text: `🔍 Searching for: _${query}_...`,
    }, { quoted: msg });

    try {
      const hits = await searchGenius(query, token);
      if (!hits.length) {
        return sock.sendMessage(chatId, {
          text: `❌ No results found for: _${query}_\n\nTry adding the artist name.`,
        }, { quoted: msg });
      }

      const hit    = hits[0].result;
      const title  = hit.full_title;
      const url    = hit.url;
      const artist = hit.primary_artist?.name || 'Unknown';

      await sock.sendMessage(chatId, {
        text: `🎵 *${title}*\n👤 ${artist}\n\n⬇️ Fetching lyrics...`,
      }, { quoted: msg });

      const rawLyrics = await scrapeLyrics(url);

      // WhatsApp has a ~65k char limit; trim if needed
      const MAX = 3000;
      const lyrics = rawLyrics.length > MAX
        ? rawLyrics.slice(0, MAX) + `\n\n... _(truncated — full lyrics at Genius)_\n🔗 ${url}`
        : rawLyrics;

      const output = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎵 *${title}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        '',
        lyrics,
        '',
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔗 ${url}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n');

      return sock.sendMessage(chatId, { text: output }, { quoted: msg });

    } catch (err) {
      console.error('❌ Lyrics error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Could not fetch lyrics.\n🔧 ${err.message}`,
      }, { quoted: msg });
    }
  },
};
