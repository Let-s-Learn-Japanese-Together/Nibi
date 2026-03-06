import ejs from 'ejs';
import nodemailer from 'nodemailer';
import path from 'path';
import { config } from '../config';

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

// Create transporter with OVH SSL configuration
const createTransporter = () => {
    return nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure, // true for 465, false for other ports
        auth: {
            user: config.email.user,
            pass: config.email.password,
        },
        tls: {
            // Do not fail on invalid certificates
            rejectUnauthorized: false,
        },
        debug: config.environment === 'development',
        logger: config.environment === 'development',
    });
};

export const sendEmail = async (options: EmailOptions): Promise<void> => {
    try {
        const transporter = createTransporter();

        // Verify connection configuration
        await transporter.verify();
        console.log('SMTP server is ready to take our messages');

        const mailOptions = {
            from: config.email.from,
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
    message: string
): Promise<void> => {
    return sendEmail({
        to,
        subject,
        text: message,
    });
};

// Helper function for sending HTML emails
export const sendHtmlEmail = async (
    to: string | string[],
    subject: string,
    html: string,
    text?: string
): Promise<void> => {
    return sendEmail({
        to,
        subject,
        html,
        text,
    });
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
    }>
): Promise<void> => {
    return sendEmail({
        to,
        subject,
        text: message,
        attachments,
    });
};

// Helper function for sending emails with EJS templates
export const sendTemplateEmail = async (
    to: string | string[],
    subject: string,
    templateName: string,
    templateData: Record<string, any> = {}
): Promise<void> => {
    try {
        // Construct template path
        const templatePath = path.join(process.cwd(), 'mails', `${templateName}.ejs`);
        
        // Render the EJS template
        const html = await ejs.renderFile(templatePath, templateData);
        
        // Send the email with rendered HTML
        return sendEmail({
            to,
            subject,
            html,
        });
    } catch (error) {
        console.error('Failed to render template or send email:', error);
        throw new Error(`Failed to send template email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};