import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { Command } from '../types/command';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import fetch from 'node-fetch';
import googleTTS from 'google-tts-api';
import { config } from '../config';

// Define types for API responses
interface VoiceVoxResponse {
  success: boolean;
  audioStatusUrl: string;
  mp3DownloadUrl: string;
}

interface VoiceVoxStatusResponse {
  isAudioReady: boolean;
}

interface DiscordAttachmentResponse {
  attachments: Array<{
    upload_url: string;
    upload_filename: string;
  }>;
}

// Instance de Kuroshiro pour la conversion des kanjis
let kuroshiro: any = null;

// Initialiser Kuroshiro
async function initKuroshiro() {
  if (!kuroshiro) {
    kuroshiro = new Kuroshiro();
    await kuroshiro.init(new KuromojiAnalyzer());
  }
  return kuroshiro;
}

// Fonction pour convertir le romaji en hiragana
function romajiToHiragana(romaji: string): string {
  const romajiToKana: { [key: string]: string } = {
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
      const substr = text.substr(i, len);
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

// Fonction pour détecter si un texte est en romaji
function isRomaji(text: string): boolean {
  return /^[a-zA-Z\s\-']+$/.test(text);
}

// Fonction pour obtenir le texte hiragana pour le TTS
async function getHiraganaForTTS(text: string): Promise<string> {
  try {
    const kuro = await initKuroshiro();

    let sourceText = text;

    // Si c'est du romaji, le convertir en hiragana d'abord
    if (isRomaji(text)) {
      sourceText = romajiToHiragana(text);
    }

    // Convertir en hiragana
    const hiragana = await kuro.convert(sourceText, { to: 'hiragana' });
    return hiragana;
  } catch (error) {
    console.error('Kuroshiro conversion error:', error);
    throw error;
  }
}

// Fonction pour générer l'audio TTS avec Google TTS (fallback)
async function generateGoogleTTS(text: string): Promise<Buffer | null> {
  try {
    console.log(`Generating Google TTS for text: "${text}"`);

    const url = await googleTTS(text, 'ja', 1);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.buffer();
    console.log(`Google TTS audio downloaded, buffer size: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error('Google TTS generation error:', error);
    return null;
  }
}

// Fonction pour générer l'audio TTS avec VOICEVOX (avec fallback Google TTS)
async function generateTTS(text: string): Promise<Buffer | null> {
  try {
    console.log(`Generating TTS for text: "${text}"`);

    // Essayer d'abord VOICEVOX
    console.log('Trying VOICEVOX API first...');

    // Étape 1: Demander la synthèse vocale (format form-data comme dans la doc)
    const formData = new URLSearchParams();
    formData.append('text', text.replace(' ', ''));
    formData.append('speaker', '3');

    console.log('Sending form data with text:', text);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

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
    } finally {
      clearTimeout(timeout);
    }

    console.log(`TTS API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VOICEVOX API error response:', errorText);
      console.log('VOICEVOX failed, falling back to Google TTS...');
      return await generateGoogleTTS(text);
    }

    const data = await response.json() as VoiceVoxResponse;
    console.log('TTS API response data:', data);

    if (!data.success) {
      console.log('VOICEVOX synthesis failed, falling back to Google TTS...');
      return await generateGoogleTTS(text);
    }

    // Étape 2: Attendre que l'audio soit prêt
    const statusUrl = data.audioStatusUrl;
    const mp3Url = data.mp3DownloadUrl;

    console.log(`Status URL: ${statusUrl}`);
    console.log(`MP3 URL: ${mp3Url}`);

    // Vérifier le statut jusqu'à ce que l'audio soit prêt
    let isReady = false;
    let attempts = 0;
    const maxAttempts = 30; // Maximum 30 secondes d'attente

    while (!isReady && attempts < maxAttempts) {
      console.log(`Checking status, attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde

      const statusResponse = await fetch(statusUrl);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json() as VoiceVoxStatusResponse;
        console.log('Status data:', statusData);
        isReady = statusData.isAudioReady;
      } else {
        console.error(`Status check failed: ${statusResponse.status}`);
      }

      attempts++;
    }

    if (!isReady) {
      console.log('VOICEVOX synthesis timeout, falling back to Google TTS...');
      return await generateGoogleTTS(text);
    }

    console.log('Audio is ready, downloading...');

    // Étape 3: Télécharger l'audio
    const audioResponse = await fetch(mp3Url);
    if (!audioResponse.ok) {
      console.log('VOICEVOX audio download failed, falling back to Google TTS...');
      return await generateGoogleTTS(text);
    }

    const buffer = await audioResponse.buffer();
    console.log(`VOICEVOX audio downloaded, buffer size: ${buffer.length} bytes`);
    return buffer;

  } catch (error) {
    console.error('VOICEVOX TTS generation error:', error);
    console.log('VOICEVOX completely failed, falling back to Google TTS...');
    return await generateGoogleTTS(text);
  }
}

// Fonction pour uploader un fichier vers Discord
async function uploadToDiscord(audioBuffer: Buffer, channelId: string, isMP3: boolean = true): Promise<string> {
  // Étape 1: Demander une URL d'upload
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
      'Authorization': `Bot ${config.discord.token}`,
    },
    body: JSON.stringify(attachmentRequest),
  });

  if (!attachmentResponse.ok) {
    const errorText = await attachmentResponse.text();
    throw new Error(`Attachment request failed: ${attachmentResponse.status} - ${errorText}`);
  }

  const attachmentData = await attachmentResponse.json() as DiscordAttachmentResponse;
  if (!attachmentData.attachments || !attachmentData.attachments[0]) {
    throw new Error('No attachment data returned from Discord API.');
  }
  const uploadUrl = attachmentData.attachments[0].upload_url;
  const uploadFilename = attachmentData.attachments[0].upload_filename;

  // Étape 2: Upload le fichier vers l'URL fournie
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: audioBuffer,
  });

  if (!uploadResponse.ok) {
    throw new Error(`File upload failed: ${uploadResponse.status}`);
  }

  return uploadFilename;
}

// Fonction pour générer une waveform factice
function generateWaveform(durationSecs: number): string {
  // Discord limite la waveform à 400 caractères max
  const maxSamples = 400;
  const samples = Math.min(maxSamples, Math.floor(durationSecs * 50)); // 50 samples par seconde max
  const waveform = new Array(samples).fill(0).map(() => Math.floor(Math.random() * 256));
  return Buffer.from(waveform).toString('base64');
}

// Fonction pour envoyer un message vocal via l'API REST
async function sendVoiceMessage(
  channelId: string,
  uploadFilename: string,
  durationSecs: number,
  waveformB64: string,
  isMP3: boolean = true
) {
  const filename = isMP3 ? 'voice-message.mp3' : 'voice-message.ogg';

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bot ${config.discord.token}`,
    },
    body: JSON.stringify({
      flags: 8192, // Voice message flag
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

const pronounce_cmd: Command = {
  data: new SlashCommandBuilder()
    .setName('pronounce')
    .setDescription('Generate Japanese TTS audio for text')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Text to pronounce (romaji, hiragana, katakana, or kanji)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Différer la réponse immédiatement pour éviter l'expiration
    await interaction.deferReply();

    const text = interaction.options.getString('text', true);
    console.log(`Processing pronunciation request for: "${text}"`);

    try {
      // Nettoyer le texte (supprimer les caractères non-japonais problématiques)
      const cleanText = text.trim().replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBFa-zA-Z0-9\s]/g, '');
      console.log(`Cleaned text: "${cleanText}"`);

      // Convertir le texte en hiragana pour le TTS
      const hiraganaText = await getHiraganaForTTS(cleanText);
      console.log(`Hiragana text: "${hiraganaText}"`);

      // Limiter la longueur du texte (l'API peut avoir des limites)
      const limitedText = hiraganaText.substring(0, 100); // Limite à 100 caractères
      console.log(`Limited text: "${limitedText}"`);

      // Générer l'audio TTS (avec fallback automatique)
      const audioBuffer = await generateTTS(limitedText);

      if (audioBuffer) {
        // Détecter le format (VOICEVOX = MP3, Google TTS = OGG/MP3)
        const isMP3 = audioBuffer.subarray(0, 3).toString('hex') === '494433' || // ID3 tag
          audioBuffer.subarray(0, 2).toString('hex') === 'fff3' ||   // MP3 frame sync
          audioBuffer.subarray(0, 2).toString('hex') === 'fffb';     // MP3 frame sync

        console.log(`Audio format detected: ${isMP3 ? 'MP3' : 'OGG'}`);

        // Upload le fichier sur Discord
        const uploadFilename = await uploadToDiscord(audioBuffer, interaction.channelId, isMP3);

        // Estimer la durée (approximative)
        const durationSecs = Math.max(1, Math.floor(audioBuffer.length / 16000));

        // Générer une waveform factice
        const waveformB64 = generateWaveform(durationSecs);

        // Répondre avec le message d'information
        await interaction.editReply(`${interaction.user.username}, here is the pronunciation for "${text}"`);

        // Envoyer le message vocal dans le canal
        await sendVoiceMessage(
          interaction.channelId,
          uploadFilename,
          durationSecs,
          waveformB64,
          isMP3
        );

      } else {
        await interaction.editReply('❌ Impossible de générer l\'audio TTS avec VOICEVOX et Google TTS.');
      }

    } catch (error) {
      console.error('Command execution error:', error);
      await interaction.editReply('❌ Une erreur s\'est produite lors du traitement.');
    }
  },
};

export default pronounce_cmd;