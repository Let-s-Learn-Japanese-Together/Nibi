"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const google_tts_api_1 = __importDefault(require("google-tts-api"));
const kuroshiro_1 = __importDefault(require("kuroshiro"));
const kuroshiro_analyzer_kuromoji_1 = __importDefault(require("kuroshiro-analyzer-kuromoji"));
let kuroshiro = null;
// To work inside Cloudflare Workers we cannot rely on filesystem access for the
// kuromoji dictionary.  When the project is bundled the `browser` field in
// kuromoji's package.json swaps the Node loader for the browser loader which
// uses `XMLHttpRequest`.  The worker runtime doesn't provide that global, so
// we polyfill it above in `src/utils/polyfills`.
//
// The browser loader also expects the dictionary files to be accessible via
// HTTP, so we point it at a public CDN.  This avoids having to package the
// large dictionary payload inside the worker at build time.
//
// When running purely in Node (without the bundle) the analyzer would use the
// Node loader and ignore the URL, so specifying a remote path is harmless.
const KUROMOJI_DICT_URL = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';
async function initKuroshiro() {
    if (!kuroshiro) {
        kuroshiro = new kuroshiro_1.default();
        // pass the CDN location so that the browser loader knows where to fetch the
        // dictionary archives from.  The trailing slash is required.
        await kuroshiro.init(new kuroshiro_analyzer_kuromoji_1.default({ dictPath: KUROMOJI_DICT_URL }));
    }
    return kuroshiro;
}
function romajiToHiragana(romaji) {
    const romajiToKana = {
        'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
        'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
        'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
        'sa': 'さ', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
        'za': 'ざ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
        'ta': 'た', 'chi': 'ち', 'tsu': 'つ', 'te': 'て', 'to': 'と',
        'da': 'だ', 'de': 'で', 'do': 'ど',
        'na': 'な', 'ni': 'に', 'ぬ': 'ぬ', 'ne': 'ね', 'no': 'の',
        'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
        'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
        'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
        'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
        'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',
        'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
        'wa': 'わ', 'wo': 'を', 'n': 'ん'
    };
    let result = '';
    let i = 0;
    const text = romaji.toLowerCase();
    while (i < text.length) {
        let found = false;
        for (let len = 3; len >= 1; len--) {
            const substr = text.slice(i, i + len);
            if (romajiToKana[substr]) {
                result += romajiToKana[substr];
                i += len;
                found = true;
                break;
            }
        }
        if (!found) {
            result += text[i];
            i++;
        }
    }
    return result;
}
function isRomaji(text) {
    return /^[a-zA-Z\s\-']+$/.test(text);
}
async function getHiraganaForTTS(text) {
    try {
        const kuro = await initKuroshiro();
        let sourceText = text;
        if (isRomaji(text)) {
            sourceText = romajiToHiragana(text);
        }
        const hiragana = await kuro.convert(sourceText, { to: 'hiragana' });
        return hiragana;
    }
    catch (error) {
        console.error('Kuroshiro conversion error:', error);
        throw error;
    }
}
async function generateGoogleTTS(text) {
    try {
        console.log(`Generating Google TTS for text: "${text}"`);
        const url = await (0, google_tts_api_1.default)(text, 'ja', 1);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`Google TTS audio downloaded, buffer size: ${buffer.length} bytes`);
        return buffer;
    }
    catch (error) {
        console.error('Google TTS generation error:', error);
        return null;
    }
}
async function generateTTS(text) {
    try {
        console.log(`Generating TTS for text: "${text}"`);
        const formData = new URLSearchParams();
        formData.append('text', text.replace(' ', ''));
        formData.append('speaker', '3');
        console.log('Sending form data with text:', text);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        let response;
        try {
            response = await fetch('https://api.tts.quest/v3/voicevox/synthesis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
                signal: controller.signal,
            });
        }
        finally {
            clearTimeout(timeout);
        }
        console.log(`TTS API response status: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('VOICEVOX API error response:', errorText);
            console.log('VOICEVOX failed, falling back to Google TTS...');
            return await generateGoogleTTS(text);
        }
        const data = await response.json();
        console.log('TTS API response data:', data);
        if (!data.success) {
            console.log('VOICEVOX synthesis failed, falling back to Google TTS...');
            return await generateGoogleTTS(text);
        }
        const statusUrl = data.audioStatusUrl;
        const mp3Url = data.mp3DownloadUrl;
        console.log(`Status URL: ${statusUrl}`);
        console.log(`MP3 URL: ${mp3Url}`);
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 30;
        while (!isReady && attempts < maxAttempts) {
            console.log(`Checking status, attempt ${attempts + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const statusResponse = await fetch(statusUrl);
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('Status data:', statusData);
                isReady = statusData.isAudioReady;
            }
            else {
                console.error(`Status check failed: ${statusResponse.status}`);
            }
            attempts++;
        }
        if (!isReady) {
            console.log('VOICEVOX synthesis timeout, falling back to Google TTS...');
            return await generateGoogleTTS(text);
        }
        console.log('Audio is ready, downloading...');
        const audioResponse = await fetch(mp3Url);
        if (!audioResponse.ok) {
            console.log('VOICEVOX audio download failed, falling back to Google TTS...');
            return await generateGoogleTTS(text);
        }
        const arrayBuffer = await audioResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`VOICEVOX audio downloaded, buffer size: ${buffer.length} bytes`);
        return buffer;
    }
    catch (error) {
        console.error('VOICEVOX TTS generation error:', error);
        console.log('VOICEVOX completely failed, falling back to Google TTS...');
        return await generateGoogleTTS(text);
    }
}
async function uploadToDiscord(audioBuffer, channelId, isMP3 = true, env) {
    const filename = isMP3 ? 'voice-message.mp3' : 'voice-message.ogg';
    const contentType = isMP3 ? 'audio/mpeg' : 'audio/ogg';
    const attachmentRequest = {
        files: [{
                filename: filename,
                file_size: audioBuffer.length,
                id: '0'
            }]
    };
    const attachmentResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/attachments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${env.BOT_TOKEN}`,
        },
        body: JSON.stringify(attachmentRequest),
    });
    if (!attachmentResponse.ok) {
        const errorText = await attachmentResponse.text();
        throw new Error(`Attachment request failed: ${attachmentResponse.status} - ${errorText}`);
    }
    const attachmentData = await attachmentResponse.json();
    if (!attachmentData.attachments || !attachmentData.attachments[0]) {
        throw new Error('No attachment data returned from Discord API.');
    }
    const uploadUrl = attachmentData.attachments[0].upload_url;
    const uploadFilename = attachmentData.attachments[0].upload_filename;
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType,
        },
        body: new Uint8Array(audioBuffer),
    });
    if (!uploadResponse.ok) {
        throw new Error(`File upload failed: ${uploadResponse.status}`);
    }
    return uploadFilename;
}
function generateWaveform(durationSecs) {
    const maxSamples = 400;
    const samples = Math.min(maxSamples, Math.floor(durationSecs * 50));
    const waveform = new Array(samples).fill(0).map(() => Math.floor(Math.random() * 256));
    return Buffer.from(waveform).toString('base64');
}
async function sendVoiceMessage(channelId, uploadFilename, durationSecs, waveformB64, isMP3 = true, env) {
    const filename = isMP3 ? 'voice-message.mp3' : 'voice-message.ogg';
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${env.BOT_TOKEN}`,
        },
        body: JSON.stringify({
            flags: 8192,
            attachments: [
                {
                    id: '0',
                    filename: filename,
                    uploaded_filename: uploadFilename,
                    duration_secs: durationSecs,
                    waveform: waveformB64,
                },
            ],
        }),
    });
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Voice message failed: ${response.status} - ${errorText}`);
    }
    return response.json();
}
const pronounce = {
    data: {
        name: 'pronounce',
        description: 'Generate Japanese TTS audio for text',
        options: [
            {
                type: 3,
                name: 'text',
                description: 'Text to pronounce (romaji, hiragana, katakana, or kanji)',
                required: true
            }
        ]
    },
    async execute(interaction, env) {
        const textOption = interaction.data?.options?.find((opt) => opt.name === 'text');
        const text = textOption?.value || '';
        console.log(`Processing pronunciation request for: "${text}"`);
        try {
            const cleanText = text.trim().replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBFa-zA-Z0-9\s]/g, '');
            console.log(`Cleaned text: "${cleanText}"`);
            const hiraganaText = await getHiraganaForTTS(cleanText);
            console.log(`Hiragana text: "${hiraganaText}"`);
            const limitedText = hiraganaText.substring(0, 100);
            console.log(`Limited text: "${limitedText}"`);
            const audioBuffer = await generateTTS(limitedText);
            if (audioBuffer) {
                const isMP3 = audioBuffer.subarray(0, 3).toString('hex') === '494433' ||
                    audioBuffer.subarray(0, 2).toString('hex') === 'fff3' ||
                    audioBuffer.subarray(0, 2).toString('hex') === 'fffb';
                console.log(`Audio format detected: ${isMP3 ? 'MP3' : 'OGG'}`);
                const uploadFilename = await uploadToDiscord(audioBuffer, interaction.channel.id, isMP3, env);
                const durationSecs = Math.max(1, Math.floor(audioBuffer.length / 16000));
                const waveformB64 = generateWaveform(durationSecs);
                await sendVoiceMessage(interaction.channel.id, uploadFilename, durationSecs, waveformB64, isMP3, env);
                return { type: 4, data: { content: `${interaction.member.user.username}, here is the pronunciation for "${text}"` } };
            }
            else {
                return { type: 4, data: { content: '❌ Impossible de générer l\'audio TTS avec VOICEVOX et Google TTS.', flags: 64 } };
            }
        }
        catch (error) {
            console.error('Command execution error:', error);
            return { type: 4, data: { content: '❌ Une erreur s\'est produite lors du traitement.', flags: 64 } };
        }
    },
};
exports.default = pronounce;
