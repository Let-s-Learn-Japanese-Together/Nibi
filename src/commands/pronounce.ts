import googleTTS from "google-tts-api";
import { Bindings } from "hono/types";
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import { Command } from "../types/command";
import { InteractionResponse } from "../types/InteractionResponse";
import { Interaction } from "./../types/Interaction";

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

let kuroshiro: Kuroshiro | null = null;

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
const KUROMOJI_DICT_URL = "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/";

async function initKuroshiro() {
  if (!kuroshiro) {
    kuroshiro = new Kuroshiro();
    // pass the CDN location so that the browser loader knows where to fetch the
    // dictionary archives from.  The trailing slash is required.
    await kuroshiro.init(
      new KuromojiAnalyzer({ dictPath: KUROMOJI_DICT_URL } as {
        dictPath: string;
      }),
    );
  }
  return kuroshiro;
}

function romajiToHiragana(romaji: string): string {
  const romajiToKana: { [key: string]: string } = {
    a: "あ",
    i: "い",
    u: "う",
    e: "え",
    o: "お",
    ka: "か",
    ki: "き",
    ku: "く",
    ke: "け",
    ko: "こ",
    ga: "が",
    gi: "ぎ",
    gu: "ぐ",
    ge: "げ",
    go: "ご",
    sa: "さ",
    shi: "し",
    su: "す",
    se: "せ",
    so: "そ",
    za: "ざ",
    ji: "じ",
    zu: "ず",
    ze: "ぜ",
    zo: "ぞ",
    ta: "た",
    chi: "ち",
    tsu: "つ",
    te: "て",
    to: "と",
    da: "だ",
    de: "で",
    do: "ど",
    na: "な",
    ni: "に",
    ぬ: "ぬ",
    ne: "ね",
    no: "の",
    ha: "は",
    hi: "ひ",
    fu: "ふ",
    he: "へ",
    ho: "ほ",
    ba: "ば",
    bi: "び",
    bu: "ぶ",
    be: "べ",
    bo: "ぼ",
    pa: "ぱ",
    pi: "ぴ",
    pu: "ぷ",
    pe: "ぺ",
    po: "ぽ",
    ma: "ま",
    mi: "み",
    mu: "む",
    me: "め",
    mo: "も",
    ya: "や",
    yu: "ゆ",
    yo: "よ",
    ra: "ら",
    ri: "り",
    ru: "る",
    re: "れ",
    ro: "ろ",
    wa: "わ",
    wo: "を",
    n: "ん",
  };

  let result = "";
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

function isRomaji(text: string): boolean {
  return /^[a-zA-Z\s\-']+$/.test(text);
}

async function getHiraganaForTTS(text: string): Promise<string> {
  try {
    const kuro = await initKuroshiro();

    let sourceText = text;

    if (isRomaji(text)) {
      sourceText = romajiToHiragana(text);
    }

    const hiragana = await kuro.convert(sourceText, { to: "hiragana" });
    return hiragana;
  } catch (error) {
    console.error("Kuroshiro conversion error:", error);
    throw error;
  }
}

async function generateGoogleTTS(text: string): Promise<Buffer | null> {
  try {
    const url = await googleTTS(text, "ja", 1);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer;
  } catch (error) {
    console.error("Google TTS generation error:", error);
    return null;
  }
}

async function generateTTS(text: string): Promise<Buffer | null> {
  try {
    const formData = new URLSearchParams();
    formData.append("text", text.replace(" ", ""));
    formData.append("speaker", "3");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch("https://api.tts.quest/v3/voicevox/synthesis", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("VOICEVOX API error response:", errorText);
      return await generateGoogleTTS(text);
    }

    const data = (await response.json()) as VoiceVoxResponse;

    if (!data.success) {
      return await generateGoogleTTS(text);
    }

    const statusUrl = data.audioStatusUrl;
    const mp3Url = data.mp3DownloadUrl;

    let isReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isReady && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(statusUrl);
      if (statusResponse.ok) {
        const statusData =
          (await statusResponse.json()) as VoiceVoxStatusResponse;
        isReady = statusData.isAudioReady;
      } else {
        console.error(`Status check failed: ${statusResponse.status}`);
      }

      attempts++;
    }

    if (!isReady) {
      return await generateGoogleTTS(text);
    }

    const audioResponse = await fetch(mp3Url);
    if (!audioResponse.ok) {
      return await generateGoogleTTS(text);
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer;
  } catch (error) {
    console.error("VOICEVOX TTS generation error:", error);
    return await generateGoogleTTS(text);
  }
}

async function uploadToDiscord(
  audioBuffer: Buffer,
  channelId: string,
  isMP3: boolean = true,
  env: Bindings,
): Promise<string> {
  const filename = isMP3 ? "voice-message.mp3" : "voice-message.ogg";
  const contentType = isMP3 ? "audio/mpeg" : "audio/ogg";

  const attachmentRequest = {
    files: [
      {
        filename: filename,
        file_size: audioBuffer.length,
        id: "0",
      },
    ],
  };

  const attachmentResponse = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/attachments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${env.BOT_TOKEN}`,
      },
      body: JSON.stringify(attachmentRequest),
    },
  );

  if (!attachmentResponse.ok) {
    const errorText = await attachmentResponse.text();
    throw new Error(
      `Attachment request failed: ${attachmentResponse.status} - ${errorText}`,
    );
  }

  const attachmentData =
    (await attachmentResponse.json()) as DiscordAttachmentResponse;
  if (!attachmentData.attachments || !attachmentData.attachments[0]) {
    throw new Error("No attachment data returned from Discord API.");
  }
  const uploadUrl = attachmentData.attachments[0].upload_url;
  const uploadFilename = attachmentData.attachments[0].upload_filename;

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!uploadResponse.ok) {
    throw new Error(`File upload failed: ${uploadResponse.status}`);
  }

  return uploadFilename;
}

function generateWaveform(durationSecs: number): string {
  const maxSamples = 400;
  const samples = Math.min(maxSamples, Math.floor(durationSecs * 50));
  const waveform = new Array(samples)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256));
  return Buffer.from(waveform).toString("base64");
}

async function sendVoiceMessage(
  channelId: string,
  uploadFilename: string,
  durationSecs: number,
  waveformB64: string,
  isMP3: boolean = true,
  env: Bindings,
) {
  const filename = isMP3 ? "voice-message.mp3" : "voice-message.ogg";

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${env.BOT_TOKEN}`,
      },
      body: JSON.stringify({
        flags: 8192,
        attachments: [
          {
            id: "0",
            filename: filename,
            uploaded_filename: uploadFilename,
            duration_secs: durationSecs,
            waveform: waveformB64,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Voice message failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

const pronounce: Command = {
  data: {
    name: "pronounce",
    description: "Generate Japanese TTS audio for text",
    options: [
      {
        type: 3,
        name: "text",
        description: "Text to pronounce (romaji, hiragana, katakana, or kanji)",
        required: true,
      },
    ],
  },

  async execute(
    interaction: Interaction,
    env: Bindings,
  ): Promise<InteractionResponse> {
    const textOption = interaction.data?.options?.find(
      (opt: Record<string, unknown>) => opt.name === "text",
    );
    const text = (textOption?.value as string) || "";

    try {
      const cleanText = text
        .trim()
        .replace(
          /[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBFa-zA-Z0-9\s]/g,
          "",
        );

      const hiraganaText = await getHiraganaForTTS(cleanText);

      const limitedText = hiraganaText.substring(0, 100);

      const audioBuffer = await generateTTS(limitedText);

      if (audioBuffer) {
        const isMP3 =
          audioBuffer.subarray(0, 3).toString("hex") === "494433" ||
          audioBuffer.subarray(0, 2).toString("hex") === "fff3" ||
          audioBuffer.subarray(0, 2).toString("hex") === "fffb";

        const uploadFilename = await uploadToDiscord(
          audioBuffer,
          interaction.channel.id,
          isMP3,
          env,
        );
        const durationSecs = Math.max(
          1,
          Math.floor(audioBuffer.length / 16000),
        );
        const waveformB64 = generateWaveform(durationSecs);

        await sendVoiceMessage(
          interaction.channel.id,
          uploadFilename,
          durationSecs,
          waveformB64,
          isMP3,
          env,
        );
        return {
          type: 4,
          data: {
            content: `${interaction.member.user.username}, here is the pronunciation for "${text}"`,
          },
        };
      } else {
        return {
          type: 4,
          data: {
            content:
              "❌ Impossible de générer l'audio TTS avec VOICEVOX et Google TTS.",
            flags: 64,
          },
        };
      }
    } catch (error) {
      console.error("Command execution error:", error);
      return {
        type: 4,
        data: {
          content: "❌ Une erreur s'est produite lors du traitement.",
          flags: 64,
        },
      };
    }
  },
};

export default pronounce;
