/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           AniRPG — /pinterest                        ║
 * ║  Fetch images from Pinterest search (no API key)     ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Usage: /pinterest <search query>
 * Sends up to 5 images as a collage / individual messages
 */

'use strict';

const https   = require('https');
const COOLDOWNS   = new Map();
const COOLDOWN_MS = 20_000;

// Scrape Pinterest search page for image URLs (no key needed)
function searchPinterest(query) {
  return new Promise((resolve, reject) => {
    const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          Accept: 'text/html',
        },
        timeout: 15_000,
      },
      (res) => {
        let html = '';
        res.on('data', (c) => (html += c));
        res.on('end', () => {
          // Pinterest embeds JSON data in a script tag
          const match = html.match(/__PWS_DATA__\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
          if (!match) {
            // Fallback: extract image URLs directly from og:image meta or src attrs
            const imgs = [...html.matchAll(/https:\/\/i\.pinimg\.com\/[^"'\s]+\.jpg/g)]
              .map(m => m[0])
              .filter((v, i, a) => a.indexOf(v) === i)
              .slice(0, 6);
            return resolve(imgs);
          }
          try {
            const data = JSON.parse(match[1]);
            const results = data?.props?.initialReduxState?.pins || {};
            const imgs = Object.values(results)
              .map(pin => pin?.images?.orig?.url || pin?.images?.['736x']?.url)
              .filter(Boolean)
              .slice(0, 6);
            resolve(imgs);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Pinterest request timed out')); });
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15_000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Image fetch timeout')); });
  });
}

module.exports = {
  name:        'pinterest',
  aliases:     ['pin', 'pins'],
  description: 'Fetch images from Pinterest',
  usage:       '/pinterest <search query>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '📌 *Pinterest Image Search*',
          '',
          '📌 Usage: /pinterest <query>',
          '💡 Examples:',
          '  /pinterest anime aesthetic wallpaper',
          '  /pinterest Solo Leveling fanart',
          '  /pinterest cute cats',
        ].join('\n'),
      }, { quoted: msg });
    }

    // Cooldown
    const last = COOLDOWNS.get(sender) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return sock.sendMessage(chatId, { text: `⏳ Pinterest cooldown: ${wait}s remaining.` }, { quoted: msg });
    }
    COOLDOWNS.set(sender, Date.now());

    const query = args.join(' ');

    await sock.sendMessage(chatId, {
      text: `📌 Searching Pinterest for: _${query}_...`,
    }, { quoted: msg });

    let imageUrls;
    try {
      imageUrls = await searchPinterest(query);
    } catch (err) {
      return sock.sendMessage(chatId, {
        text: `❌ Pinterest search failed.\n🔧 ${err.message}`,
      }, { quoted: msg });
    }

    if (!imageUrls || imageUrls.length === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ No images found for: _${query}_\n\nTry a different search term.`,
      }, { quoted: msg });
    }

    // Send up to 4 images
    const toSend = imageUrls.slice(0, 4);
    let sent = 0;

    for (const url of toSend) {
      try {
        const buffer = await fetchBuffer(url);
        await sock.sendMessage(chatId, {
          image:    buffer,
          caption:  sent === 0 ? `📌 Pinterest: _${query}_ (${toSend.length} results)` : '',
          mimetype: 'image/jpeg',
        });
        sent++;
        if (sent < toSend.length) await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error('⚠️ Pinterest image send error:', err.message);
      }
    }

    if (sent === 0) {
      return sock.sendMessage(chatId, {
        text: `❌ Found results but could not download images for: _${query}_`,
      }, { quoted: msg });
    }
  },
};
