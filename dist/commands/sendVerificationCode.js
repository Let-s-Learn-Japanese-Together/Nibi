"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seededCode = seededCode;
const databaseUtils_1 = require("../utils/databaseUtils");
const sendEmail_1 = require("../utils/sendEmail");
function seededCode(email) {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = (hash * 31 + email.charCodeAt(i)) % 1000000;
    }
    return 100000 + (hash % 900000);
}
const sendVerificationCode = {
    data: {
        name: "send-verification-code",
        description: "Send you a verification code through your mailbox to confirm this is you",
        options: [
            {
                type: 3,
                name: "email",
                description: "The email address to send the verification code to",
                required: true,
            },
        ],
    },
    async execute(interaction, env) {
        const DatabaseUtilsInstance = new databaseUtils_1.DatabaseUtils({
            SUPABASE_URL: env["SUPABASE_URL"],
            SUPABASE_ANON_KEY: env["SUPABASE_ANON_KEY"],
        });
        if (!interaction.data.options) {
            return {
                type: 4,
                data: { content: "Email option is required." },
            };
        }
        const emailOption = interaction.data.options.find((o) => o.name === "email");
        const email = emailOption?.value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                type: 4,
                data: {
                    content: "Please provide a valid email address.",
                    ephemeral: true,
                },
            };
        }
        const verificationCode = seededCode(email + env.EMAIL_HASH);
        await (0, sendEmail_1.sendTemplateEmail)(email, "Your Verification Code", "verificationCode", {
            username: interaction.member.user.global_name ||
                interaction.member.user.username,
            verificationCode: verificationCode.toString(),
        }, env).catch((error) => {
            console.error("Error sending verification code email:", error);
        });
        // Open a modal to ask the user to enter the verification code
        return {
            type: 9,
            data: {
                custom_id: "verify_code_modal:" + email,
                title: "Enter Verification Code",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "verification_code_input",
                                style: 1,
                                label: "Verification Code",
                                placeholder: "Enter the code sent to your email",
                                required: true,
                                min_length: 6,
                                max_length: 6,
                            },
                        ],
                    },
                ],
            },
        };
    },
};
exports.default = sendVerificationCode;
