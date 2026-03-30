import { EmailClient } from '@azure/communication-email';

const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '';
const senderAddress = process.env.AZURE_EMAIL_SENDER || 'accelerate@wadhwanifoundation.org';

// Log email config status on startup
console.log(`[EmailService] Initialized — connection string configured: ${!!connectionString}, sender: ${senderAddress}`);

let emailClient: EmailClient | null = null;

function getEmailClient(): EmailClient {
    if (!emailClient) {
        if (!connectionString) {
            console.error('[EmailService] AZURE_COMMUNICATION_CONNECTION_STRING is NOT set. Email will not work.');
            throw new Error('AZURE_COMMUNICATION_CONNECTION_STRING is not configured');
        }
        console.log('[EmailService] Creating Azure EmailClient...');
        emailClient = new EmailClient(connectionString);
    }
    return emailClient;
}

export async function sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    plainText?: string
): Promise<void> {
    console.log(`[EmailService] Attempting to send email to: ${to}, subject: "${subject}"`);

    const client = getEmailClient();

    const message = {
        senderAddress,
        content: {
            subject,
            html: htmlBody,
            plainText: plainText || '',
        },
        recipients: {
            to: [{ address: to }],
        },
    };

    const EMAIL_TIMEOUT_MS = 30000;
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Email send timed out after ${EMAIL_TIMEOUT_MS / 1000}s`)), EMAIL_TIMEOUT_MS)
    );

    try {
        const poller = await Promise.race([client.beginSend(message), timeoutPromise]);
        console.log(`[EmailService] Email send initiated for ${to}, polling for result...`);
        const result = await Promise.race([poller.pollUntilDone(), timeoutPromise]);
        console.log(`[EmailService] Email to ${to} — status: ${result.status}, id: ${result.id}`);
        if (result.status !== 'Succeeded') {
            console.error(`[EmailService] Email to ${to} did not succeed. Status: ${result.status}, Error: ${JSON.stringify(result.error)}`);
        }
    } catch (error: any) {
        console.error(`[EmailService] Failed to send email to ${to}:`, {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        });
        throw error;
    }
}

export async function sendPanelInvitationEmail(
    toEmail: string,
    founderName: string,
    ventureName: string
): Promise<void> {
    const subject = `Wadhwani Accelerate ${ventureName} : Invitation to Panel Discussion`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Wadhwani Accelerate</h1>
        </div>
        <div class="content">
            <p>Hi ${founderName},</p>
            <p>We're excited to take the next step with you.</p>
            <p>You will soon be invited to a meeting with our panelists to discuss your business and growth plans. This will be an opportunity for you to share more about your venture and the growth opportunity you are looking to pursue.</p>
            <p>Our team will reach out shortly with the proposed timeline and details for scheduling the discussion. Please keep an eye on your inbox!</p>
            <p>We look forward to the conversation.</p>
            <p>Best regards,<br>Team Wadhwani Accelerate</p>
        </div>
        <div class="footer">
            <p>&copy; Wadhwani Foundation. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const plainText = `Hi ${founderName},

We're excited to take the next step with you.

You will soon be invited to a meeting with our panelists to discuss your business and growth plans. This will be an opportunity for you to share more about your venture and the growth opportunity you are looking to pursue.

Our team will reach out shortly with the proposed timeline and details for scheduling the discussion. Please keep an eye on your inbox!

We look forward to the conversation.

Best regards,
Team Wadhwani Accelerate`;

    await sendEmail(toEmail, subject, htmlBody, plainText);
}

export async function sendWelcomeEmail(
    toEmail: string,
    founderName: string,
    ventureName: string
): Promise<void> {
    const subject = `Welcome to Wadhwani Accelerate, ${ventureName}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Wadhwani Accelerate</h1>
        </div>
        <div class="content">
            <p>Hi ${founderName},</p>
            <p>Thank you for applying for the Wadhwani Accelerate Program! We've received your application and will review your details shortly.</p>
            <p>Keep an eye on your inbox—we'll notify you of any updates or next steps soon.</p>
            <p>Best regards,<br>Team Wadhwani Accelerate</p>
        </div>
        <div class="footer">
            <p>&copy; Wadhwani Foundation. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const plainText = `Hi ${founderName},

Thank you for applying for the Wadhwani Accelerate Program! We've received your application and will review your details shortly.

Keep an eye on your inbox—we'll notify you of any updates or next steps soon.

Best regards,
Team Wadhwani Accelerate`;

    await sendEmail(toEmail, subject, htmlBody, plainText);
}

export async function sendSelectionWelcomeEmail(
    toEmail: string,
    founderName: string,
    ventureName: string,
    programCategory: string,
    loginUrl: string
): Promise<void> {
    const subject = `Welcome to Wadhwani Accelerate | ${ventureName}`;
    const programLabel = programCategory.charAt(0).toUpperCase() + programCategory.slice(1);

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.7; color: #333; margin: 0; padding: 0; }
        .container { max-width: 650px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 28px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; background-color: #f9fafb; }
        .phase-title { font-weight: bold; color: #1a365d; margin-top: 20px; margin-bottom: 6px; }
        .login-box { background-color: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .login-box a { color: #4338ca; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Wadhwani Accelerate</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Program: ${programLabel}</p>
        </div>
        <div class="content">
            <p>Hi ${founderName},</p>

            <p>Congratulations on being selected for <strong>Wadhwani Accelerate</strong>, our highly selective growth program designed for ventures ready to unlock their next phase of scale through focused, execution-led support.</p>

            <p>Wadhwani Accelerate is a <strong>12-month growth execution platform</strong> that supports ventures in identifying, validating, and executing one high-impact growth idea. The program brings together experienced Venture Partners, domain and functional experts, and structured growth sprints to help founders move from intent to outcomes with speed and clarity.</p>

            <p>The program will commence shortly, with the first month focused on alignment, prioritization, and execution readiness.</p>

            <p class="phase-title">Month 1: Business Context &amp; Growth Alignment</p>
            <p>You will be assigned a dedicated Venture Partner, a seasoned expert who will work closely with you through a series of structured discussions (virtual or in-person). These initial conversations will focus on understanding your business context, growth ambitions, and key gaps. While the first part of the engagement is exploratory, the primary objective is to converge on one clear growth idea that can meaningfully move the needle for your business.</p>

            <p class="phase-title">Growth Idea Commitment &amp; Sprint Direction</p>
            <p>In the second phase, you and your Venture Partner will jointly prioritize this shortlisted growth idea and align on the specific growth sprint(s) required to pursue it. This stage focusses on achieving clear agreement on what will be executed, what success looks like, and the level of commitment required. Ventures are expected to demonstrate clarity and readiness to proceed at this stage.</p>

            <p class="phase-title">Sprint-Based Execution (12-Week Cycles)</p>
            <p>Following alignment, execution begins through structured 12-week growth sprints. Depending on the growth idea, this may include targeted expert engagements, bootcamps, or focused advisory support. Wadhwani Accelerate will actively support selected high-impact sprint components, while enabling founders to self-execute others, ensuring both momentum and long-term capability building.</p>

            <p>Throughout the program, ventures are expected to commit clearly to the agreed growth direction, actively engage in execution, and track progress against defined outcomes.</p>

            <p>We look forward to partnering with you on this journey and supporting your venture as you work towards meaningful, scalable growth.</p>

            <p><strong>Welcome aboard,</strong><br>Team Wadhwani Accelerate</p>
        </div>
        <div class="footer">
            <p>&copy; Wadhwani Foundation. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const plainText = `Hi ${founderName},

Congratulations on being selected for Wadhwani Accelerate, our highly selective growth program designed for ventures ready to unlock their next phase of scale through focused, execution-led support.

Wadhwani Accelerate is a 12-month growth execution platform that supports ventures in identifying, validating, and executing one high-impact growth idea. The program brings together experienced Venture Partners, domain and functional experts, and structured growth sprints to help founders move from intent to outcomes with speed and clarity.

The program will commence shortly, with the first month focused on alignment, prioritization, and execution readiness.

Month 1: Business Context & Growth Alignment
You will be assigned a dedicated Venture Partner, a seasoned expert who will work closely with you through a series of structured discussions (virtual or in-person). These initial conversations will focus on understanding your business context, growth ambitions, and key gaps. While the first part of the engagement is exploratory, the primary objective is to converge on one clear growth idea that can meaningfully move the needle for your business.

Growth Idea Commitment & Sprint Direction
In the second phase, you and your Venture Partner will jointly prioritize this shortlisted growth idea and align on the specific growth sprint(s) required to pursue it. This stage focusses on achieving clear agreement on what will be executed, what success looks like, and the level of commitment required. Ventures are expected to demonstrate clarity and readiness to proceed at this stage.

Sprint-Based Execution (12-Week Cycles)
Following alignment, execution begins through structured 12-week growth sprints. Depending on the growth idea, this may include targeted expert engagements, bootcamps, or focused advisory support. Wadhwani Accelerate will actively support selected high-impact sprint components, while enabling founders to self-execute others, ensuring both momentum and long-term capability building.

Throughout the program, ventures are expected to commit clearly to the agreed growth direction, actively engage in execution, and track progress against defined outcomes.

We look forward to partnering with you on this journey and supporting your venture as you work towards meaningful, scalable growth.

Welcome aboard,
Team Wadhwani Accelerate`;

    await sendEmail(toEmail, subject, htmlBody, plainText);
}

export async function sendSelfserveEmail(
    toEmail: string,
    founderName: string,
    ventureName: string
): Promise<void> {
    const subject = `Update on Your Application to Wadhwani Foundation Accelerate Program`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
        .content ul { margin: 10px 0; padding-left: 20px; }
        .content li { margin-bottom: 8px; }
        .cta-button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Wadhwani Accelerate</h1>
        </div>
        <div class="content">
            <p>Dear ${founderName},</p>
            <p>Thank you for applying to the Wadhwani Foundation program and for taking the time to share your entrepreneurial journey with us. We appreciate the intent, effort, and commitment reflected in your application.</p>
            <p>After a detailed review, we would like to invite you to take the next step by joining <strong>Wadhwani LiftOff AI</strong>&mdash;a curated, founder-focused platform designed to support entrepreneurs as they sharpen their ideas, strengthen execution, and build readiness for growth-oriented programs within the Wadhwani ecosystem.</p>
            <p>LiftOff AI is selectively recommended to founders who demonstrate the drive to build thoughtfully and move forward with clarity. The platform offers:</p>
            <ul>
                <li>AI-powered guidance and founder tools to support informed, data-driven decision-making</li>
                <li>Access to a comprehensive digital library covering core startup and business fundamentals</li>
                <li>Mentor Connect support, enabling you to seek insights and guidance from experienced mentors within the ecosystem</li>
            </ul>
            <p>We encourage you to activate your access and begin immediately by visiting:</p>
            <p style="text-align: center;"><a href="https://wadhwaniliftoff.ai" class="cta-button">Visit Wadhwani LiftOff AI</a></p>
            <p>Engaging with LiftOff AI will help you build momentum and position yourself strongly as your venture evolves.</p>
            <p>Wishing you focused execution and steady progress ahead.</p>
            <p>Thanks,<br>Team Wadhwani Accelerate</p>
        </div>
        <div class="footer">
            <p>&copy; Wadhwani Foundation. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const plainText = `Dear ${founderName},

Thank you for applying to the Wadhwani Foundation program and for taking the time to share your entrepreneurial journey with us. We appreciate the intent, effort, and commitment reflected in your application.

After a detailed review, we would like to invite you to take the next step by joining Wadhwani LiftOff AI — a curated, founder-focused platform designed to support entrepreneurs as they sharpen their ideas, strengthen execution, and build readiness for growth-oriented programs within the Wadhwani ecosystem.

LiftOff AI is selectively recommended to founders who demonstrate the drive to build thoughtfully and move forward with clarity. The platform offers:

- AI-powered guidance and founder tools to support informed, data-driven decision-making
- Access to a comprehensive digital library covering core startup and business fundamentals
- Mentor Connect support, enabling you to seek insights and guidance from experienced mentors within the ecosystem

We encourage you to activate your access and begin immediately by visiting:
https://wadhwaniliftoff.ai

Engaging with LiftOff AI will help you build momentum and position yourself strongly as your venture evolves.

Wishing you focused execution and steady progress ahead.

Thanks,
Team Wadhwani Accelerate`;

    await sendEmail(toEmail, subject, htmlBody, plainText);
}
