import dictionary from './commands/dictionnary';
import emojiManagment from './commands/emojiManagment';
import hello from './commands/hello';
import info from './commands/info';
import listServerEmojis from './commands/listServerEmojis';
import ping from './commands/ping';
import pronounce from './commands/pronounce';
import sendVerificationCode from './commands/sendVerificationCode';
import { Command } from './types/command';


export async function handle(commandName: 'dictionnary' | 'emoji-management' | 'hello' | 'info' | 'list-server-emojis' | 'ping' | 'pronounce' | 'send-verification-code'): Promise<Command> {
    // const { execute } = await import(process.cwd() + `/commands/${commandName}.ts`);
    // return execute;
    switch (commandName) {
        case 'dictionnary':
            return dictionary;
        case 'emoji-management':
            return emojiManagment;
        case 'list-server-emojis':
            return listServerEmojis;
        case 'ping':
            return ping;
        case 'hello':
            return hello;
        case 'info':
            return info;
        case 'pronounce':
            return pronounce;
        case 'send-verification-code':
            return sendVerificationCode;
        default:
            throw new Error(`No handler found for command: ${commandName}`);
    }
}