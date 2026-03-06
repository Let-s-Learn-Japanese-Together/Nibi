import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import translate from 'google-translate-api-x';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

// Cache pour éviter trop d'appels API
const translationCache = new Map<string, any>();

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

async function detectAndTranslate(word: string, targetLang: 'ja' | 'fr' | 'en' = 'ja', allowedSourceLangs?: string[]) {
  const cacheKey = `${word}-${targetLang}`;
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  
  try {
    const result = await translate(word, { to: targetLang });
    
    // Si on a des langues autorisées et que la langue détectée n'est pas dedans
    if (allowedSourceLangs && !allowedSourceLangs.includes(result.from.language.iso)) {
      // Forcer la langue à 'en' par défaut si non détectée correctement
      const forcedLang = allowedSourceLangs.includes('fr') && isFrenchWord(word) ? 'fr' : 'en';
      return {
        original: word,
        translated: result.text,
        detectedLang: forcedLang,
        confidence: 0.7 // Confidence réduite car forcée
      };
    }
    
    const translation = {
      original: word,
      translated: result.text,
      detectedLang: result.from.language.iso,
      confidence: result.from.language.didYouMean ? 0.8 : 1.0
    };
    
    translationCache.set(cacheKey, translation);
    return translation;
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

// Fonction simple pour détecter des mots français communs
function isFrenchWord(word: string): boolean {
  const frenchWords = [
    'bonjour', 'bonsoir', 'salut', 'merci', 'oui', 'non', 'chat', 'chien', 
    'eau', 'feu', 'maison', 'voiture', 'rouge', 'bleu', 'vert', 'noir', 
    'blanc', 'jaune', 'grand', 'petit', 'bon', 'mauvais', 'nouveau', 'vieux',
    'homme', 'femme', 'enfant', 'père', 'mère', 'frère', 'sœur', 'ami',
    'temps', 'jour', 'nuit', 'matin', 'soir', 'année', 'mois', 'semaine'
  ];
  
  // Vérification des caractères accentués français
  const hasAccents = /[àâäéèêëïîôöùûüÿç]/i.test(word);
  
  return frenchWords.includes(word.toLowerCase()) || hasAccents;
}

// Fonction pour romaniser le japonais à partir d'hiragana
function toRomaji(hiraganaText: string): string {
  const kanaToRomaji: { [key: string]: string } = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo', 'ん': 'n',
    'っ': '', // petit tsu (sera géré spécialement)
    'ー': '-', // allongement
    ' ': ' ' // espace
  };
  
  let result = '';
  const chars = hiraganaText.split('');
  
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const nextChar = chars[i + 1];
    
    // Gestion du petit tsu (っ) - double la consonne suivante
    if (char === 'っ' && nextChar) {
      const nextRomaji = kanaToRomaji[nextChar];
      if (nextRomaji) {
        result += nextRomaji.charAt(0); // Ajouter la première lettre de la consonne
      }
    } else if (char !== undefined && char in kanaToRomaji) {
      result += kanaToRomaji[char];
    } else if (char !== undefined) {
      result += char; // Garder les caractères non mappés
    }
  }
  
  return result;
}

// Fonction améliorée pour convertir en hiragana et katakana avec support des kanjis
async function getKanaForms(text: string): Promise<{ hiragana: string; katakana: string }> {
  try {
    const kuro = await initKuroshiro();
    
    // Convertir en hiragana
    const hiragana = await kuro.convert(text, { to: 'hiragana' });
    
    // Convertir en katakana
    const katakana = await kuro.convert(text, { to: 'katakana' });
    
    return { hiragana, katakana };
  } catch (error) {
    console.error('Kuroshiro conversion error:', error);
    
    // Fallback sur l'ancienne méthode si Kuroshiro échoue
    const hiraganaMap: { [key: string]: string } = {
      'ア': 'あ', 'イ': 'い', 'ウ': 'う', 'エ': 'え', 'オ': 'お',
      'カ': 'か', 'キ': 'き', 'ク': 'く', 'ケ': 'け', 'コ': 'こ',
      'ガ': 'が', 'ギ': 'ぎ', 'グ': 'ぐ', 'ゲ': 'げ', 'ゴ': 'ご',
      'サ': 'さ', 'シ': 'し', 'ス': 'す', 'セ': 'せ', 'ソ': 'そ',
      'ザ': 'ざ', 'ジ': 'じ', 'ズ': 'ず', 'ゼ': 'ぜ', 'ゾ': 'ぞ',
      'タ': 'た', 'チ': 'ち', 'ツ': 'つ', 'テ': 'て', 'ト': 'と',
      'ダ': 'だ', 'ヂ': 'ぢ', 'ヅ': 'づ', 'デ': 'で', 'ド': 'ど',
      'ナ': 'な', 'ニ': 'に', 'ヌ': 'ぬ', 'ネ': 'ね', 'ノ': 'の',
      'ハ': 'は', 'ヒ': 'ひ', 'フ': 'ふ', 'ヘ': 'へ', 'ホ': 'ほ',
      'バ': 'ば', 'ビ': 'び', 'ブ': 'ぶ', 'ベ': 'べ', 'ボ': 'ぼ',
      'パ': 'ぱ', 'ピ': 'ぴ', 'プ': 'ぷ', 'ペ': 'ぺ', 'ポ': 'ぽ',
      'マ': 'ま', 'ミ': 'み', 'ム': 'む', 'メ': 'め', 'モ': 'も',
      'ヤ': 'や', 'ユ': 'ゆ', 'ヨ': 'よ',
      'ラ': 'ら', 'リ': 'り', 'ル': 'る', 'レ': 'れ', 'ロ': 'ろ',
      'ワ': 'わ', 'ヰ': 'ゐ', 'ヱ': 'ゑ', 'ヲ': 'を', 'ン': 'ん'
    };
    
    const katakanaMap: { [key: string]: string } = {
      'あ': 'ア', 'い': 'イ', 'う': 'ウ', 'え': 'エ', 'お': 'オ',
      'か': 'カ', 'き': 'キ', 'く': 'ク', 'け': 'ケ', 'こ': 'コ',
      'が': 'ガ', 'ぎ': 'ギ', 'ぐ': 'グ', 'げ': 'ゲ', 'ご': 'ゴ',
      'さ': 'サ', 'し': 'シ', 'す': 'ス', 'せ': 'セ', 'そ': 'ソ',
      'ざ': 'ザ', 'じ': 'ジ', 'ず': 'ズ', 'ぜ': 'ゼ', 'ぞ': 'ゾ',
      'た': 'タ', 'ち': 'チ', 'つ': 'ツ', 'て': 'テ', 'と': 'ト',
      'だ': 'ダ', 'ぢ': 'ヂ', 'づ': 'ヅ', 'で': 'デ', 'ど': 'ド',
      'な': 'ナ', 'に': 'ニ', 'ぬ': 'ヌ', 'ね': 'ネ', 'の': 'ノ',
      'は': 'ハ', 'ひ': 'ヒ', 'ふ': 'フ', 'へ': 'ヘ', 'ほ': 'ホ',
      'ば': 'バ', 'び': 'ビ', 'ぶ': 'ブ', 'べ': 'ベ', 'ボ': 'ボ',
      'ぱ': 'パ', 'ぴ': 'ピ', 'ぷ': 'プ', 'ぺ': 'ペ', 'ぽ': 'ポ',
      'ま': 'マ', 'み': 'ミ', 'む': 'ム', 'め': 'メ', 'も': 'モ',
      'や': 'ヤ', 'ゆ': 'ユ', 'よ': 'ヨ',
      'ら': 'ラ', 'り': 'リ', 'る': 'ル', 'れ': 'レ', 'ろ': 'ロ',
      'わ': 'ワ', 'ゐ': 'ヰ', 'ゑ': 'ヱ', 'を': 'ヲ', 'ん': 'ン'
    };
    
    let hiragana = '';
    let katakana = '';
    
    for (const char of text) {
      hiragana += hiraganaMap[char] || char;
      katakana += katakanaMap[char] || char;
    }
    
    return { hiragana, katakana };
  }
}

function getLanguageFlag(langCode: string): string {
  const flags: { [key: string]: string } = {
    'ja': '🇯🇵',
    'fr': '🇫🇷',
    'en': '🇺🇸'
  };
  return flags[langCode] || '🌐';
}

// Fonction pour détecter si un texte est en romaji
function isRomaji(text: string): boolean {
  return /^[a-zA-Z\s\-']+$/.test(text);
}

// Fonction pour convertir le romaji en hiragana (pour la conversion inverse)
function romajiToHiragana(romaji: string): string {
  const romajiToKana: { [key: string]: string } = {
    'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
    'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
    'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
    'sa': 'さ', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
    'za': 'ざ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
    'ta': 'た', 'chi': 'ち', 'tsu': 'つ', 'te': 'て', 'to': 'と',
    'da': 'だ', 'de': 'で', 'do': 'ど',
    'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
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
    
    // Essayer les combinaisons de 3 caractères d'abord, puis 2, puis 1
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

// Fonction pour préparer le texte japonais pour la traduction
async function prepareJapaneseForTranslation(word: string): Promise<string> {
  // Si c'est du romaji, le convertir en hiragana d'abord
  if (isRomaji(word)) {
    return romajiToHiragana(word);
  }
  
  // Si c'est déjà en japonais (hiragana, katakana, kanji), le retourner tel quel
  return word;
}

const dictionary_cmd: Command = {
  data: new SlashCommandBuilder()
    .setName('dictionary')
    .setDescription('Translate words between French, English and Japanese')
    .addSubcommand(subcommand =>
      subcommand
        .setName('to-japanese')
        .setDescription('Translate French or English word to Japanese with romaji')
        .addStringOption(option =>
          option.setName('word')
            .setDescription('French or English word to translate to Japanese')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('from-japanese')
        .setDescription('Translate from Japanese to French or English')
        .addStringOption(option =>
          option.setName('word')
            .setDescription('Japanese word (hiragana, katakana, kanji, or romaji)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('target')
            .setDescription('Target language')
            .setRequired(true)
            .addChoices(
              { name: 'French 🇫🇷', value: 'fr' },
              { name: 'English 🇺🇸', value: 'en' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    
    try {
      if (subcommand === 'to-japanese') {
        const word = interaction.options.getString('word', true);
        // Limiter la détection aux langues françaises et anglaises seulement
        const result = await detectAndTranslate(word, 'ja', ['fr', 'en']);
        
        if (!result) {
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Translation Error')
            .setDescription('Unable to translate the word. Please try again.');
          
          await interaction.editReply({ embeds: [embed] });
          return;
        }
        
        // Vérifier que la langue détectée est bien français ou anglais
        if (!['fr', 'en'].includes(result.detectedLang)) {
          const embed = new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle('⚠️ Language not supported')
            .setDescription('This command only supports French and English words.')
            .addFields({
              name: 'Detected language',
              value: result.detectedLang.toUpperCase(),
              inline: true
            });
          
          await interaction.editReply({ embeds: [embed] });
          return;
        }
        
        const kanaForms = await getKanaForms(result.translated);
        const romaji = toRomaji(kanaForms.hiragana);
        const sourceFlag = getLanguageFlag(result.detectedLang);
        
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🇯🇵 Translation to Japanese')
          .addFields(
            {
              name: `${sourceFlag} Original`,
              value: `${word} (${result.detectedLang.toUpperCase()})`,
              inline: false
            },
            {
              name: '🇯🇵 Japanese (Kanji)',
              value: result.translated,
              inline: true
            },
            {
              name: 'ひ Hiragana',
              value: kanaForms.hiragana,
              inline: true
            },
            {
              name: 'カ Katakana',
              value: kanaForms.katakana,
              inline: true
            },
            {
              name: '📝 Romaji',
              value: romaji,
              inline: false
            }
          )
          .setFooter({ text: `Confidence: ${(result.confidence * 100).toFixed(0)}%` })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
      } else if (subcommand === 'from-japanese') {
        const word = interaction.options.getString('word', true);
        const target = interaction.options.getString('target', true);
        
        // Préparer le mot japonais pour la traduction
        const preparedWord = await prepareJapaneseForTranslation(word);
        
        // Traduire vers la langue cible
        const result = await detectAndTranslate(preparedWord, target as 'fr' | 'en');
        
        if (!result) {
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Translation Error')
            .setDescription('Unable to translate the word. Please try again.');
          
          await interaction.editReply({ embeds: [embed] });
          return;
        }
        
        const targetFlag = getLanguageFlag(target);
        
        // Obtenir toutes les formes japonaises à partir du mot original
        let kanaForms: { hiragana: string; katakana: string };
        let displayWord = word;
        
        if (isRomaji(word)) {
          // Si l'entrée était en romaji, utiliser la conversion
          const hiraganaFromRomaji = romajiToHiragana(word);
          kanaForms = await getKanaForms(hiraganaFromRomaji);
          displayWord = hiraganaFromRomaji; // Afficher la forme hiragana comme "original"
        } else {
          // Si l'entrée était déjà en japonais, l'utiliser directement
          kanaForms = await getKanaForms(word);
        }
        
        const romaji = toRomaji(kanaForms.hiragana);
        
        const embed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle(`${targetFlag} Translation from Japanese`)
          .addFields(
            {
              name: '🇯🇵 Input',
              value: `${word} ${isRomaji(word) ? '(Romaji)' : ''}`,
              inline: true
            },
            // {
            //   name: 'ひ Hiragana',
            //   value: kanaForms.hiragana,
            //   inline: true
            // },
            // {
            //   name: 'カ Katakana',
            //   value: kanaForms.katakana,
            //   inline: true
            // },
            // {
            //   name: '📝 Romaji',
            //   value: romaji,
            //   inline: true
            // },
            {
              name: `${targetFlag} Translation`,
              value: result.translated,
              inline: true
            }
          )
          .setFooter({ text: `Target: ${target.toUpperCase()}` })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Command execution error:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription('An error occurred while processing your request.');
      
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default dictionary_cmd;