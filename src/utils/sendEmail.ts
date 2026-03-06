import { Bindings } from 'hono/types';
import nodemailer from 'nodemailer';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
        filename: string;
        path?: string;
        content?: string | Buffer;
        contentType?: string;
    }>;
}

const verificationEmail = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f6f8fa; margin:0; padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f6f8fa; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="400" cellpadding="0" cellspacing="0" style="background: #fff; border-radius: 8px; box-shadow:0 2px 8px rgba(0,0,0,0.05); padding: 32px;">
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <img src="https://cdn.discordapp.com/icons/1427259865121820716/e3910bfbd02e15187b799375106378c8.png?size=96" alt="Logo" width="48" height="48" style="display:block;">
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="font-size: 22px; color: #333; font-weight: bold; padding-bottom: 12px;">
                            Verification Code
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="font-size: 16px; color: #555; padding-bottom: 24px;">
                            Hello <%= username %>,<br>
                            Here is your verification code to access your account:
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding-bottom: 24px;">
                            <div style="background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 6px; padding: 16px; display: inline-block;">
                                <span style="font-size: 32px; font-weight: bold; color: #495057; letter-spacing: 4px; font-family: 'Courier New', monospace;">
                                    <%= verificationCode %>
                                </span>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="font-size: 14px; color: #666; padding-bottom: 16px;">
                            This code expires in <strong>10 minutes</strong>.
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="font-size:12px; color:#aaa; padding-top:32px; border-top: 1px solid #e9ecef;">
                            If you didn't request this code, you can safely ignore this email.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`

/** 
 * env should include:
 * EMAIL_HOST: string;
 * EMAIL_PORT: number;
 * EMAIL_SECURE: boolean; // true for 465, false for other ports
 * EMAIL_USER: string;
 * EMAIL_PASSWORD: string;
 * EMAIL_FROM: string;
 * ENVIRONMENT: 'development' | 'production';
 * EMAIL_TLS_INSECURE?: 'true' | 'false'; // set to 'true' to ignore TLS certificate errors
 */

// Create transporter with OVH SSL configuration
const createTransporter = (env: Bindings) => {
    // Build the transport configuration dynamically.  On some runtimes
    // (notably Cloudflare Workers) the underlying SMTP transport does not
    // implement the `tls.rejectUnauthorized` option; passing it leads to the
    // "options.rejectUnauthorized option is not implemented" error.  The
    // option is mainly useful when dealing with self-signed certificates, so
    // rather than hard‑coding it we only include it when explicitly required
    // via an environment variable.
    const transportConfig: any = {
        host: env.EMAIL_HOST as string,
        port: env.EMAIL_PORT as number,
        secure: env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: env.EMAIL_USER as string,
            pass: env.EMAIL_PASSWORD as string,
        },
    };

    // enable debugging/logging in development
    if (env.ENVIRONMENT === 'development') {
        transportConfig.debug = true;
        transportConfig.logger = true;
    }

    // if the caller really wants to ignore invalid TLS certificates they can
    // set EMAIL_TLS_INSECURE="true" in their env.  We don't apply this by
    // default because the option isn't supported everywhere.
    if (env.EMAIL_TLS_INSECURE === 'true') {
        transportConfig.tls = {
            rejectUnauthorized: false,
        };
    }

    return nodemailer.createTransport(transportConfig);
};

export const sendEmail = async (options: EmailOptions, env: Bindings): Promise<void> => {
    try {
        const transporter = createTransporter(env);

        // Verify connection configuration
        await transporter.verify();
        console.log('SMTP server is ready to take our messages');

        const mailOptions = {
            from: env.EMAIL_FROM as string,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            cc: Array.isArray(options.cc) ? options.cc.join(', ') : options.cc,
            bcc: Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc,
            attachments: options.attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
    } catch (error) {
        console.error('Failed to send email:', error);
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Helper function for sending simple text emails
export const sendSimpleEmail = async (
    to: string | string[],
    subject: string,
    message: string,
    env: Bindings
): Promise<void> => {
    return sendEmail({
        to,
        subject,
        text: message,
    }, env);
};

// Helper function for sending HTML emails
export const sendHtmlEmail = async (
    to: string | string[],
    subject: string,
    html: string,
    env: Bindings,
    text?: string,
): Promise<void> => {
    return sendEmail({
        to,
        subject,
        html,
        text,
    }, env);
};

// Helper function for sending emails with attachments
export const sendEmailWithAttachments = async (
    to: string | string[],
    subject: string,
    message: string,
    attachments: Array<{
        filename: string;
        path?: string;
        content?: string | Buffer;
        contentType?: string;
    }>,
    env: Bindings
): Promise<void> => {
    return sendEmail({
        to,
        subject,
        text: message,
        attachments,
    }, env);
};

// Helper function for sending emails with lightweight templates.  The
// templates live in the `mails/` directory and may contain expressions
// of the form `<%= some.path %>`; only simple property access is
// supported.  We deliberately avoid any library that compiles a string
// into code because the Workers runtime forbids that.
export const sendTemplateEmail = async (
    to: string | string[],
    subject: string,
    templateName: string,
    templateData: Record<string, any> = {},
    env: Bindings
): Promise<void> => {
    try {
        // fetch the template file as a bundled asset; relative path from this
        // module to wherever `mails/` lives in the source tree.  When
        // wrangler/esbuild bundles the worker the file is included as a
        // static asset and `fetch` works at runtime.
        if (templateName === 'verificationCode') {
            // If the template is the verification code, use the hardcoded template string
            const html = verificationEmail.replace(/<%=\s*([\w\.]+)\s*%>/g, (_, key) => {
                const value = key.split('.').reduce((o: { [x: string]: any; }, k: string | number) => (o ? o[k] : ''), templateData);
                return value == null ? '' : String(value);
            }
            );
            return sendEmail({
                to,
                subject,
                html,
            }, env);
        } else {
            throw new Error(`Unknown email template: ${templateName}`);
        }
    } catch (error) {
        console.error('Failed to render template or send email:', error);
        throw new Error(`Failed to send template email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};