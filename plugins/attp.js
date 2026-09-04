const { spawn } = require("child_process");
const sharp = require("sharp");

// 🛡️ RAM Optimization: Sharp Cache & Concurrency Lock (Heroku Safety)
sharp.cache(false);
sharp.concurrency(1);

// 🛠️ FFmpeg Finder
let ffmpegBin = "ffmpeg";
try {
    ffmpegBin = require("ffmpeg-static");
} catch (e1) {
    try {
        ffmpegBin = require("@ffmpeg-installer/ffmpeg").path;
    } catch (e2) {
        ffmpegBin = "ffmpeg";
    }
}

// 🛠️ Helper Functions
function escapeXml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getFontSize(text) {
    if (text.length <= 6) return 74;
    if (text.length <= 10) return 62;
    if (text.length <= 16) return 50;
    if (text.length <= 24) return 40;
    return 32;
}

// 🖼️ Frame Generator (Optimized)
async function makeFrame(text, index, totalFrames) {
    const colors = ["#ff1744", "#ffea00", "#00e676", "#00b0ff", "#d500f9", "#ff9100"];
    const color = colors[index % colors.length];
    const shadow = colors[(index + 2) % colors.length];
    const fontSize = getFontSize(text);
    const safeText = escapeXml(text);

    const angle = (index / totalFrames) * Math.PI * 2;
    const y = 256 + Math.sin(angle) * 35;
    const scale = 1 + Math.sin(angle) * 0.08;

    const svg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="none"/>
  <g transform="translate(256 ${y}) scale(${scale})">
    <text x="0" y="0"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="900"
      stroke="${shadow}"
      stroke-width="10"
      paint-order="stroke"
      fill="${color}">${safeText}</text>
    <text x="0" y="0"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="900"
      stroke="#ffffff"
      stroke-width="3"
      paint-order="stroke"
      fill="${color}">${safeText}</text>
  </g>
</svg>`;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

// 🎬 Animated WebP Generator (Memory-Safe Direct Streaming)
async function createAttpSticker(text) {
    const totalFrames = 20; // 20 Frames is optimal for high quality & low RAM

    return new Promise((resolve, reject) => {
        const args = [
            "-hide_banner",
            "-loglevel", "error",
            "-f", "image2pipe",
            "-framerate", "12",
            "-vcodec", "png",
            "-i", "pipe:0",
            "-loop", "0",
            "-vf", "scale=512:512:flags=lanczos,format=rgba",
            "-lossless", "0",
            "-compression_level", "6",
            "-q:v", "60",
            "-f", "webp",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBin, args, {
            stdio: ["pipe", "pipe", "pipe"]
        });

        const outputChunks = [];
        const errorChunks = [];

        const timeout = setTimeout(() => {
            try { ffmpeg.kill("SIGKILL"); } catch (_) {}
            reject(new Error("ATTP render timeout වුණා."));
        }, 30 * 1000);

        // 🛡️ Prevent Process-Level EPIPE Crash if FFmpeg closes pipe early
        ffmpeg.stdin.on("error", (_) => {});

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timeout);
            reject(err.code === "ENOENT" ? new Error("FFmpeg System එකේ සොයාගත නොහැක.") : err);
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timeout);

            const output = Buffer.concat(outputChunks);
            const errorText = Buffer.concat(errorChunks).toString("utf8");

            if (code !== 0) {
                reject(new Error(errorText || `FFmpeg failed with code ${code}`));
                return;
            }

            if (!output || output.length < 500) {
                reject(new Error("Sticker output එක empty වුණා."));
                return;
            }

            resolve(output);
        });

        // 🚀 Directly Generate & Pipe Frames On-The-Fly (Zero RAM Retention)
        (async () => {
            try {
                for (let i = 0; i < totalFrames; i++) {
                    if (ffmpeg.stdin.writable) {
                        const frameBuffer = await makeFrame(text, i, totalFrames);
                        ffmpeg.stdin.write(frameBuffer);
                    }
                }
                if (ffmpeg.stdin.writable) {
                    ffmpeg.stdin.end();
                }
            } catch (err) {
                try { ffmpeg.kill("SIGKILL"); } catch (_) {}
                reject(err);
            }
        })();
    });
}

// 🚀 Main Plugin Export
module.exports = {
    name: "attp_sticker",
    category: 5, // 👈 Category 5 (Tools & Edits)
    description: "Convert text to an animated color sticker",
    commands: ["attp", "animatedtext"], // 👈 Conflict වෙන ttp කමාන්ඩ් එක අයින් කළා

    handler: async ({ socket, msg, sender, command, args }) => {
        try {
            let text = args.join(" ").trim();
            
            if (!text) {
                const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMsg) {
                    text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
                }
            }

            if (!text) {
                return await socket.sendMessage(sender, { 
                    text: `✍️ *Text එකක් දෙන්න මචං.*\n\n*උදා:*\n.${command} sadew mini\n\n> *𝗦𝗮𝗱𝗲𝘄-𝗠𝗶𝗻𝗶 𝗕𝘆 𝗦𝗮𝗱𝗲𝘄 𝗥𝗮𝘀𝗵𝗺𝗶𝗸𝗮 𝜗𝜚⋆*` 
                }, { quoted: msg });
            }

            if (text.length > 30) {
                return await socket.sendMessage(sender, { text: "❌ *Text එක දිග වැඩියි මචං. අකුරු 30 කට අඩුවෙන් දෙන්න.*" }, { quoted: msg });
            }

            await socket.sendMessage(sender, { react: { text: "🎨", key: msg.key } });

            // ස්ටිකර් එක Generate කිරීම
            const stickerBuffer = await createAttpSticker(text);

            // ස්ටිකර් එක යැවීම
            await socket.sendMessage(sender, {
                sticker: stickerBuffer
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error("ATTP command error:", err);
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            
            const errMsg = `❌ *ATTP sticker එක හදාගන්න බැරි වුණා මචං.*\n\nහේතුව: ${err.message}`;
            await socket.sendMessage(sender, { text: errMsg }, { quoted: msg });
        }
    }
};