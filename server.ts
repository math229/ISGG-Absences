import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import nodemailer, { type Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Transporter cache
let cachedTransporter: Transporter | null = null;

function getMailTransporter(): { transporter: Transporter; user: string } | null {
  if (cachedTransporter) {
    const user = (process.env.SMTP_USER || process.env.MAIL_USER || 'isggabsence@gmail.com').trim();
    return { transporter: cachedTransporter, user };
  }

  const user = (process.env.SMTP_USER || process.env.MAIL_USER || 'isggabsence@gmail.com').trim();
  const rawPass = (process.env.SMTP_PASS || process.env.MAIL_PASS || 'ywwb obxz ukft iqaj').trim();
  // Google fournit les mots de passe d'application avec des espaces (ex: "ywwb obxz ukft iqaj")
  const pass = rawPass.replace(/\s+/g, '');

  let host = (process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.gmail.com').trim();
  const portEnv = process.env.SMTP_PORT || process.env.MAIL_PORT || '465';

  if (user && pass) {
    const finalHost = host || 'smtp.gmail.com';
    const port = Number(portEnv) || (finalHost === 'smtp.gmail.com' ? 465 : 587);

    cachedTransporter = nodemailer.createTransport({
      host: finalHost,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
    return { transporter: cachedTransporter, user };
  }

  return null;
}

// API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Send Institutional Email
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, code, purpose, recipientName, role } = req.body;

    if (!to || !code) {
      return res.status(400).json({
        success: false,
        error: 'Destinataire (to) et code OTP requis.',
      });
    }

    const cleanTo = String(to).trim().toLowerCase();
    const cleanCode = String(code).trim();
    const formattedRole = role === 'ADMIN' ? 'Directeur' : (role === 'SURVEILLANT' ? 'Surveillant' : 'Membre du Personnel');
    const greetingName = recipientName ? `Bonjour ${recipientName},` : 'Bonjour,';

    const purposeTitle = purpose === 'PASSWORD_RESET' 
      ? 'Réinitialisation de votre mot de passe'
      : 'Vérification de votre compte institutionnel';

    const purposeInstruction = purpose === 'PASSWORD_RESET'
      ? 'Vous avez demandé la réinitialisation du mot de passe de votre compte institutionnel ISGG.'
      : `Vous avez initié la création de votre compte en tant que ${formattedRole} sur la plateforme de suivi des présences de l'ISGG.`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISGG - Code de Sécurité</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 28px 32px; text-align: left; border-bottom: 4px solid #ea580c; }
    .header-logo { color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; }
    .header-logo span { color: #ea580c; }
    .header-sub { color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .content { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .message { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .code-box { background: #fff7ed; border: 2px dashed #ea580c; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .code-label { font-size: 11px; font-weight: 700; color: #9a3412; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
    .code-number { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #ea580c; letter-spacing: 8px; }
    .warning { background: #f1f5f9; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 20px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">ISGG <span>ABSENCES</span></div>
      <div class="header-sub">Institut Supérieur de Génie Civil et de Gestion</div>
    </div>
    <div class="content">
      <div class="greeting">${greetingName}</div>
      <div class="message">
        ${purposeInstruction}
        <br><br>
        Pour confirmer votre adresse email et certifier la sécurité de votre accès, veuillez utiliser le code officiel de vérification ci-dessous :
      </div>
      
      <div class="code-box">
        <div class="code-label">Code de Vérification Officiel</div>
        <div class="code-number">${cleanCode}</div>
      </div>

      <div class="warning">
        <strong>Important :</strong> Ce code est strictement personnel et confidentiel. Il est valable pendant <strong>10 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce message ou contacter immédiatement la Direction des Études de l'ISGG.
      </div>
    </div>
    <div class="footer">
      Direction des Systèmes d'Information &bull; ISGG Calavi, Bénin<br>
      Ce message a été généré automatiquement par la plateforme officielle ISGG.
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
ISGG ABSENCES - Institut Supérieur de Génie Civil et de Gestion
${purposeTitle}

${greetingName}

${purposeInstruction}

VOTRE CODE DE VÉRIFICATION OFFICIEL : ${cleanCode}

Ce code est valable pendant 10 minutes.
Ne le transmettez à personne.

Direction des Études - ISGG Calavi, Bénin
    `.trim();

    const mailConfig = getMailTransporter();

    if (mailConfig) {
      const senderFrom = process.env.SMTP_FROM || `"ISGG Institut Supérieur de Génie civil et de Gestion" <${mailConfig.user}>`;
      try {
        const info = await mailConfig.transporter.sendMail({
          from: senderFrom,
          to: cleanTo,
          subject: subject || `[ISGG] Votre code de sécurité officiel : ${cleanCode}`,
          text: textContent,
          html: htmlContent,
        });

        console.log(`[SMTP] Email expédié à ${cleanTo} avec succès. MessageId: ${info.messageId}`);
        return res.json({
          success: true,
          delivered: true,
          messageId: info.messageId,
          destination: cleanTo,
          message: `L'email officiel contenant votre code à 6 chiffres a été expédié avec succès à ${cleanTo}.`,
        });
      } catch (smtpErr: any) {
        console.error('[SMTP] Échec de transmission SMTP:', smtpErr);
        return res.status(200).json({
          success: true,
          delivered: false,
          warning: 'SMTP_CONFIG_ERROR',
          smtpError: smtpErr?.message || 'Erreur d\'authentification ou de connexion au serveur SMTP.',
          destination: cleanTo,
          message: `La connexion au serveur SMTP a échoué (${smtpErr?.message || 'vérifiez vos identifiants SMTP'}).`,
        });
      }
    }

    // Si pas de transporteur SMTP configuré (ex: variables pas encore renseignées dans Settings)
    console.log(`[EMAIL-SERVICE] Aucun serveur SMTP configuré. Email pour ${cleanTo} avec code OTP: ${cleanCode}`);
    return res.json({
      success: true,
      delivered: false,
      warning: 'SMTP_NOT_CONFIGURED',
      destination: cleanTo,
      message: `Attention : Les identifiants SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) n'ont pas encore été renseignés dans les Paramètres du projet.`,
    });
  } catch (error) {
    console.error('[API Send-Email] Erreur lors de l\'envoi:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'acheminement de l\'email institutionnel.',
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
