declare module 'google-tts-api' {
  const googleTTS: (text: string, lang?: string, speed?: number, timeout?: number) => Promise<string>;
  export default googleTTS;
}