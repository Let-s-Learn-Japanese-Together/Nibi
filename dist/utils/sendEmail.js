"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTemplateEmail = exports.sendEmailWithAttachments = exports.sendHtmlEmail = exports.sendSimpleEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
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
`;
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
const createTransporter = (env) => {
    // Build the transport configuration dynamically.  On some runtimes
    // (notably Cloudflare Workers) the underlying SMTP transport does not
    // implement the `tls.rejectUnauthorized` option; passing it leads to the
    // "options.rejectUnauthorized option is not implemented" error.  The
    // option is mainly useful when dealing with self-signed certificates, so
    // rather than hard‑coding it we only include it when explicitly required
    // via an environment variable.
    const transportConfig = {
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT,
        secure: env.EMAIL_SECURE === "true", // true for 465, false for other ports
        auth: {
            user: env.EMAIL_USER,
            pass: env.EMAIL_PASSWORD,
        },
    };
    // enable debugging/logging in development
    if (env.ENVIRONMENT === "development") {
        transportConfig.debug = true;
        transportConfig.logger = true;
    }
    // if the caller really wants to ignore invalid TLS certificates they can
    // set EMAIL_TLS_INSECURE="true" in their env.  We don't apply this by
    // default because the option isn't supported everywhere.
    if (env.EMAIL_TLS_INSECURE === "true") {
        transportConfig.tls = {
            rejectUnauthorized: false,
        };
    }
    return nodemailer_1.default.createTransport(transportConfig);
};
const sendEmail = async (options, env) => {
    try {
        const transporter = createTransporter(env);
        // Verify connection configuration
        await transporter.verify();
        const mailOptions = {
            from: env.EMAIL_FROM,
            to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            cc: Array.isArray(options.cc) ? options.cc.join(", ") : options.cc,
            bcc: Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc,
            attachments: options.attachments,
        };
        const info = await transporter.sendMail(mailOptions);
    }
    catch (error) {
        console.error("Failed to send email:", error);
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
};
exports.sendEmail = sendEmail;
// Helper function for sending simple text emails
const sendSimpleEmail = async (to, subject, message, env) => {
    return (0, exports.sendEmail)({
        to,
        subject,
        text: message,
    }, env);
};
exports.sendSimpleEmail = sendSimpleEmail;
// Helper function for sending HTML emails
const sendHtmlEmail = async (to, subject, html, env, text) => {
    return (0, exports.sendEmail)({
        to,
        subject,
        html,
        text,
    }, env);
};
exports.sendHtmlEmail = sendHtmlEmail;
// Helper function for sending emails with attachments
const sendEmailWithAttachments = async (to, subject, message, attachments, env) => {
    return (0, exports.sendEmail)({
        to,
        subject,
        text: message,
        attachments,
    }, env);
};
exports.sendEmailWithAttachments = sendEmailWithAttachments;
// Helper function for sending emails with lightweight templates.  The
// templates live in the `mails/` directory and may contain expressions
// of the form `<%= some.path %>`; only simple property access is
// supported.  We deliberately avoid any library that compiles a string
// into code because the Workers runtime forbids that.
const sendTemplateEmail = async (to, subject, templateName, templateData = {}, env) => {
    try {
        // fetch the template file as a bundled asset; relative path from this
        // module to wherever `mails/` lives in the source tree.  When
        // wrangler/esbuild bundles the worker the file is included as a
        // static asset and `fetch` works at runtime.
        if (templateName === "verificationCode") {
            // If the template is the verification code, use the hardcoded template string
            const html = verificationEmail.replace(/<%=\s*([\w\.]+)\s*%>/g, (_, key) => {
                const value = key
                    .split(".")
                    .reduce((o, k) => (o ? o[k] : ""), templateData);
                return value == null ? "" : String(value);
            });
            return (0, exports.sendEmail)({
                to,
                subject,
                html,
            }, env);
        }
        else {
            throw new Error(`Unknown email template: ${templateName}`);
        }
    }
    catch (error) {
        console.error("Failed to render template or send email:", error);
        throw new Error(`Failed to send template email: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
};
exports.sendTemplateEmail = sendTemplateEmail;
