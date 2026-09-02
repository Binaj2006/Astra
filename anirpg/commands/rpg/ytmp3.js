/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           AniRPG — /ytmp3                            ║
 * ║  YouTube audio download via yt-dlp                   ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Requires: yt-dlp installed on server (free, no API key)
 * Install:  pip install yt-dlp  OR  apt install yt-dlp
 *
 * Usage: /ytmp3 <youtube url or search query>
 */

'use strict';

const { execFile } = require('child_process');
const fs           = require('fs');
const path         = require('path');
const os           = require('os');

const COOLDOWNS  = new Map();
const COOLDOWN_MS = 60_000; // 1 min per user
const MAX_DURATION_S = 600; // 10 min max

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', args, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

async function getInfo(query) {
  // If it's not a URL, treat as a search
  const isUrl = /^https?:\/\//i.test(query);
  const target = isUrl ? query : `ytsearch1:${query}`;

  const raw = await runYtDlp([
    '--print', '%(title)s|||%(duration)s|||%(uploader)s|||%(id)s',
    '--no-playlist',
    '--no-warnings',
    target,
  ]);

  const [title, duration, uploader, id] = raw.split('|||');
  return { title, duration: parseInt(duration, 10), uploader, id, url: `https://youtu.be/${id}` };
}

module.exports = {
  name:        'ytmp3',
  aliases:     ['yt', 'youtube', 'ytaudio'],
  description: 'Download YouTube audio and send as voice note',
  usage:       '/ytmp3 <url or search query>',
  category:    'utility',

  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: [
          '🎵 *YouTube Audio Downloader*',
          '',
          '📌 Usage: /ytmp3 <url or search>',
          '',
          '💡 Examples:',
          '  /ytmp3 https://youtu.be/dQw4w9WgXcQ',
          '  /ytmp3 Alone by Marshmello',
          '  /ytmp3 Solo Leveling OST',
          '',
          '⚠️ Max duration: 10 minutes',
        ].join('\n'),
      }, { quoted: msg });
    }

    // Cooldown
    const last = COOLDOWNS.get(sender) || 0;
    const elapsed = Date.now() - last;
    if (elapsed < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return sock.sendMessage(chatId, {
        text: `⏳ YouTube cooldown: ${wait}s remaining.`,
      }, { quoted: msg });
    }

    COOLDOWNS.set(sender, Date.now());
    const query = args.join(' ');

    await sock.sendMessage(chatId, {
      text: `🔍 *Searching YouTube...*\n📝 Query: _${query}_`,
    }, { quoted: msg });

    let info;
    try {
      info = await getInfo(query);
    } catch (err) {
      return sock.sendMessage(chatId, {
        text: `❌ Could not find: _${query}_\n\nTry a more specific search or paste a direct YouTube URL.`,
      }, { quoted: msg });
    }

    if (info.duration > MAX_DURATION_S) {
      return sock.sendMessage(chatId, {
        text: `❌ Video too long (${Math.floor(info.duration / 60)} min).\nMax allowed: 10 minutes.`,
      }, { quoted: msg });
    }

    const mins = Math.floor(info.duration / 60);
    const secs = info.duration % 60;

    await sock.sendMessage(chatId, {
      text: [
        `🎵 *Found: ${info.title}*`,
        `👤 ${info.uploader}  |  ⏱️ ${mins}:${String(secs).padStart(2, '0')}`,
        '',
        '⬇️ Downloading...',
      ].join('\n'),
    }, { quoted: msg });

    // Download to temp dir
    const tmpDir  = os.tmpdir();
    const outPath = path.join(tmpDir, `anirpg_yt_${Date.now()}.mp3`);

    try {
      await runYtDlp([
        info.url,
        '--no-playlist',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '128K',
        '--output', outPath,
        '--no-warnings',
      ]);

      if (!fs.existsSync(outPath)) {
        throw new Error('Output file not created');
      }

      const stat    = fs.statSync(outPath);
      const sizeMB  = (stat.size / 1024 / 1024).toFixed(1);

      if (stat.size > 64 * 1024 * 1024) {
        throw new Error('File too large to send (>64MB)');
      }

      await sock.sendMessage(chatId, {
        audio:    fs.readFileSync(outPath),
        mimetype: 'audio/mpeg',
        ptt:      false,
        fileName: `${info.title}.mp3`,
      }, { quoted: msg });

      await sock.sendMessage(chatId, {
        text: `✅ *${info.title}*\n📦 ${sizeMB} MB  |  🔗 ${info.url}`,
      });

    } catch (err) {
      console.error('❌ yt-dlp error:', err.message);
      return sock.sendMessage(chatId, {
        text: `❌ Download failed.\n🔧 ${err.message}\n\nMake sure yt-dlp is installed on the server.`,
      }, { quoted: msg });
    } finally {
      try { fs.unlinkSync(outPath); } catch (_) {}
    }
  },
};
