declare module 'kuroshiro' {
  import { Analyzer } from 'kuroshiro-analyzer-kuromoji';
  export default class Kuroshiro {
    init(analyzer: Analyzer): Promise<void>;
    convert(text: string, options?: { to?: 'hiragana' | 'katakana' | 'romaji' }): Promise<string>;
  }
}