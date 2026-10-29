/**
 * Mailer service — sends transactional emails via OVH SMTP using nodemailer.
 *
 * Credentials are hard-coded per project requirement (the OVH mailbox
 * `motoscoot_password_reset_protoco@spadadibattaglia.com` is dedicated to
 * password-reset transactional sends only).
 *
 * Environment overrides (optional, for local dev):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME
 *   FRONTEND_URL  → used to build the password-reset link.
 */
const nodemailer = require('nodemailer');

// ---- OVH SMTP credentials (hard-coded, as requested) ----
const SMTP_HOST = process.env.SMTP_HOST || 'ssl0.ovh.net';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || 'motoscoot_password_reset_protoco@spadadibattaglia.com';
const SMTP_PASS = process.env.SMTP_PASS || 'Dadouhibou2025';
const FROM_NAME = process.env.SMTP_FROM_NAME || 'MotoScoot';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // SSL on 465, STARTTLS otherwise
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

// Verify SMTP on startup (non-blocking, with retries)
let smtpVerified = false;
async function verifySMTPWithRetry(attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      await transporter.verify();
      smtpVerified = true;
      // eslint-disable-next-line no-console
      console.log(`[mailer] ✅ SMTP verified (${SMTP_HOST}:${SMTP_PORT}, user=${SMTP_USER})`);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[mailer] ⚠️ SMTP verify failed (attempt ${i + 1}/${attempts}): ${err.message}`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  // eslint-disable-next-line no-console
  console.error('[mailer] ❌ SMTP could not be verified after retries — emails will fail until SMTP is reachable.');
}
verifySMTPWithRetry().catch((e) => console.error('[mailer] fatal verify error:', e));

function isSMTPVerified() {
  return smtpVerified;
}

// ---- HTML template: password reset ----
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resetPasswordTemplate({ link, name }) {
  const safeName = escapeHtml(name || '');
  const safeLink = escapeHtml(link);
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,';
  const subject = 'Réinitialisation de votre mot de passe MotoScoot';
  const logoUrl = 'https://www.magma-studio.tn/portfolio2/moto/Logo/logo-white.svg';
  const year = new Date().getFullYear();

  // Inline-styled, table-based layout for maximum email-client compatibility
  // (Gmail, Outlook, Apple Mail, Yahoo). The visual identity mirrors the app:
  // orange gradient hero (#ff6a00 → #ff8a3d), rounded card, bold sans-serif.
  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;line-height:1px;color:#f5f6f8;">
      Réinitialisez votre mot de passe MotoScoot en un clic. Lien valable 1 heure.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <!-- Header / brand band -->
            <tr>
              <td style="background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);padding:32px 32px 28px;text-align:center;">
                <img src="${logoUrl}" alt="Moto-Scoot.tn" height="32" style="height:32px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />
                <div style="font-size:13px;color:#ffffff;opacity:0.92;margin-top:10px;letter-spacing:0.4px;text-transform:uppercase;font-weight:600;">
                  La marketplace moto en Tunisie
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 36px 8px;">
                <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">
                  Réinitialiser votre mot de passe
                </h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">${greeting}</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                  Vous avez demandé la réinitialisation de votre mot de passe MotoScoot.
                  Cliquez sur le bouton ci-dessous pour en choisir un nouveau&nbsp;:
                </p>

                <!-- CTA button -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 28px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);box-shadow:0 6px 16px rgba(255,106,0,0.28);">
                      <a href="${safeLink}"
                         style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                        Réinitialiser mon mot de passe
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Plain-link fallback -->
                <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#64748b;">
                  Le bouton ne fonctionne pas&nbsp;? Copiez-collez ce lien dans votre navigateur&nbsp;:
                </p>
                <p style="margin:0 0 28px;font-size:13px;line-height:1.5;word-break:break-all;">
                  <a href="${safeLink}" style="color:#ff6a00;text-decoration:underline;font-weight:600;">${safeLink}</a>
                </p>

                <!-- Security notice -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;line-height:1.55;color:#9a3412;">
                      🔒 Pour votre sécurité, ce lien expire dans <strong>1&nbsp;heure</strong>.
                      Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet
                      e-mail&nbsp;— votre mot de passe restera inchangé.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#0f172a;padding:24px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:13px;color:#cbd5e1;font-weight:600;">
                  Moto-Scoot.tn
                </p>
                <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Achetez et vendez votre moto, scooter ou quad en toute confiance.
                </p>
                <p style="margin:12px 0 0;font-size:11px;color:#64748b;letter-spacing:0.4px;">
                  © ${year} MotoScoot — Tous droits réservés
                </p>
              </td>
            </tr>
          </table>

          <!-- Anti-spoofing hint -->
          <p style="max-width:600px;margin:16px auto 0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.5;">
            Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}

Vous avez demandé la réinitialisation de votre mot de passe MotoScoot.

Ouvrez ce lien pour en choisir un nouveau (valable 1 heure) :
${link}

Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail —
votre mot de passe restera inchangé.

— L'équipe MotoScoot
https://moto-scoot.tn`;

  return { subject, html, text };
}

/**
 * Send the password-reset email.
 * Throws on SMTP failure — the caller decides whether to swallow or surface
 * the error. For the public forgot-password endpoint we swallow to avoid
 * leaking user-existence info.
 */
async function sendPasswordResetEmail({ to, name, link }) {
  const { subject, html, text } = resetPasswordTemplate({ link, name });
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
  return info;
}

// ---- HTML template: welcome (post-signup) ----
function welcomeTemplate({ name, siteUrl }) {
  const safeName = escapeHtml(name || '');
  const greeting = safeName ? `Bienvenue ${safeName} 👋` : 'Bienvenue sur MotoScoot 👋';
  const subject = 'Bienvenue sur MotoScoot — votre compte est prêt 🎉';
  const logoUrl = 'https://www.magma-studio.tn/portfolio2/moto/Logo/logo-white.svg';
  const home = (siteUrl || 'https://www.moto-scoot.tn').replace(/\/+$/, '');
  const depositUrl = `${home}/deposer-une-annonce`;
  const searchUrl = `${home}/recherche`;
  const dashboardUrl = `${home}/tableau-de-bord`;
  const year = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;line-height:1px;color:#f5f6f8;">
      Votre compte MotoScoot est prêt. Déposez votre première annonce gratuitement.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">

            <!-- Header / brand band -->
            <tr>
              <td style="background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);padding:32px 32px 28px;text-align:center;">
                <img src="${logoUrl}" alt="Moto-Scoot.tn" height="32" style="height:32px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />
                <div style="font-size:13px;color:#ffffff;opacity:0.92;margin-top:10px;letter-spacing:0.4px;text-transform:uppercase;font-weight:600;">
                  La marketplace moto en Tunisie
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:36px 36px 8px;">
                <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">
                  ${greeting}
                </h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">
                  Merci d'avoir rejoint MotoScoot — la plus grande communauté de passionnés de
                  deux-roues en Tunisie. Votre compte est créé et prêt à l'emploi.
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                  Voici quelques pistes pour bien démarrer&nbsp;:
                </p>

                <!-- Feature list -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="40" valign="top" style="font-size:22px;line-height:1;">🏍️</td>
                          <td valign="top" style="font-size:14px;line-height:1.5;color:#0f172a;">
                            <strong style="color:#0f172a;">Déposez votre première annonce</strong><br/>
                            <span style="color:#64748b;font-size:13px;">Vendez votre moto, scooter ou quad en quelques minutes — c'est gratuit.</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="40" valign="top" style="font-size:22px;line-height:1;">🔎</td>
                          <td valign="top" style="font-size:14px;line-height:1.5;color:#0f172a;">
                            <strong style="color:#0f172a;">Trouvez la perle rare</strong><br/>
                            <span style="color:#64748b;font-size:13px;">Filtrez par marque, modèle, prix et région partout en Tunisie.</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="40" valign="top" style="font-size:22px;line-height:1;">💬</td>
                          <td valign="top" style="font-size:14px;line-height:1.5;color:#0f172a;">
                            <strong style="color:#0f172a;">Échangez en toute confiance</strong><br/>
                            <span style="color:#64748b;font-size:13px;">Messagerie intégrée, profils vérifiés et avis pour acheter sans stress.</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- CTA primary -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 12px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);box-shadow:0 6px 16px rgba(255,106,0,0.28);">
                      <a href="${escapeHtml(depositUrl)}"
                         style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                        Déposer ma première annonce
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- CTA secondary -->
                <p style="margin:0 0 28px;text-align:center;font-size:13px;color:#64748b;">
                  ou&nbsp;
                  <a href="${escapeHtml(searchUrl)}" style="color:#ff6a00;text-decoration:none;font-weight:600;">parcourir les annonces</a>
                  &nbsp;·&nbsp;
                  <a href="${escapeHtml(dashboardUrl)}" style="color:#ff6a00;text-decoration:none;font-weight:600;">accéder à mon espace</a>
                </p>

                <!-- Tip box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;line-height:1.55;color:#9a3412;">
                      💡 <strong>Astuce&nbsp;:</strong> complétez votre profil (photo, ville, téléphone)
                      pour que les acheteurs vous contactent plus facilement.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#0f172a;padding:24px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:13px;color:#cbd5e1;font-weight:600;">
                  Moto-Scoot.tn
                </p>
                <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Achetez et vendez votre moto, scooter ou quad en toute confiance.
                </p>
                <p style="margin:12px 0 0;font-size:11px;color:#64748b;letter-spacing:0.4px;">
                  © ${year} MotoScoot — Tous droits réservés
                </p>
              </td>
            </tr>
          </table>

          <p style="max-width:600px;margin:16px auto 0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.5;">
            Vous recevez cet e-mail car un compte a été créé avec cette adresse sur Moto-Scoot.tn.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}

Merci d'avoir rejoint MotoScoot — la marketplace moto en Tunisie.
Votre compte est créé et prêt à l'emploi.

Pour bien démarrer :
• Déposer une annonce : ${depositUrl}
• Parcourir les annonces : ${searchUrl}
• Mon espace : ${dashboardUrl}

Astuce : complétez votre profil (photo, ville, téléphone) pour augmenter
vos chances de vendre vite.

— L'équipe MotoScoot
https://moto-scoot.tn`;

  return { subject, html, text };
}

/**
 * Send the welcome email after a successful signup.
 * Errors are intentionally NOT rethrown by callers — a failed welcome email
 * must never block account creation.
 */
async function sendWelcomeEmail({ to, name, siteUrl }) {
  const { subject, html, text } = welcomeTemplate({ name, siteUrl });
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
  return info;
}

// ---- HTML template: email verification ----
function verificationTemplate({ name, link }) {
  const safeName = escapeHtml(name || '');
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,';
  const subject = 'Confirmez votre adresse e-mail — MotoScoot';
  const logoUrl = 'https://www.magma-studio.tn/portfolio2/moto/Logo/logo-white.svg';
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-top:24px;">
  <div style="background:linear-gradient(135deg,#ff6a00,#ff8a3d);padding:28px 32px;text-align:center;">
    <img src="${logoUrl}" alt="MotoScoot" height="36" style="height:36px;display:inline-block;">
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:22px;margin:0 0 16px;color:#1a1a1a;">Confirmez votre e-mail</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#444;">${greeting}</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#444;">
      Pour activer toutes les fonctionnalités de votre compte MotoScoot, veuillez confirmer votre adresse e-mail
      en cliquant sur le bouton ci-dessous. Ce lien est valable pendant 24 heures.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#ff6a00,#ff8a3d);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Confirmer mon e-mail
      </a>
    </div>
    <p style="font-size:13px;line-height:1.6;color:#888;margin:0 0 8px;">
      Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
    </p>
    <p style="font-size:12px;word-break:break-all;color:#ff6a00;margin:0;">${link}</p>
  </div>
  <div style="background:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#888;">
    Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.<br>
    — L'équipe MotoScoot
  </div>
</div></body></html>`;
  const text = `${greeting}\n\nConfirmez votre e-mail MotoScoot en ouvrant ce lien (valable 24h) :\n${link}\n\n— L'équipe MotoScoot`;
  return { subject, html, text };
}

async function sendVerificationEmail({ to, name, link }) {
  const { subject, html, text } = verificationTemplate({ name, link });
  return transporter.sendMail({
    from: `"${FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

// ---- HTML template: new message notification ----
function newMessageTemplate({ recipientName, senderName, messagePreview, listingTitle, conversationUrl }) {
  const safeRecipient = escapeHtml(recipientName || '');
  const safeSender = escapeHtml(senderName || 'Un utilisateur');
  const safePreview = escapeHtml(messagePreview || '').slice(0, 300);
  const safeListing = escapeHtml(listingTitle || '');
  const safeUrl = escapeHtml(conversationUrl);
  const greeting = safeRecipient ? `Bonjour ${safeRecipient},` : 'Bonjour,';
  const subject = `💬 Nouveau message de ${safeSender} sur MotoScoot`;
  const logoUrl = 'https://www.magma-studio.tn/portfolio2/moto/Logo/logo-white.svg';
  const year = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;line-height:1px;color:#f5f6f8;">
      Vous avez reçu un nouveau message de ${safeSender} sur MotoScoot.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);padding:32px 32px 28px;text-align:center;">
                <img src="${logoUrl}" alt="Moto-Scoot.tn" height="32" style="height:32px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />
                <div style="font-size:13px;color:#ffffff;opacity:0.92;margin-top:10px;letter-spacing:0.4px;text-transform:uppercase;font-weight:600;">
                  Nouveau message reçu
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 36px 8px;">
                <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">
                  💬 ${safeSender} vous a envoyé un message
                </h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">${greeting}</p>
                ${safeListing ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">À propos de l'annonce&nbsp;: <strong style="color:#0f172a;">${safeListing}</strong></p>` : ''}

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-left:4px solid #ff6a00;border-radius:8px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.55;color:#0f172a;font-style:italic;">
                      "${safePreview}"
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 28px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);box-shadow:0 6px 16px rgba(255,106,0,0.28);">
                      <a href="${safeUrl}"
                         style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                        Répondre au message
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">
                  Vous pouvez aussi accéder à votre messagerie depuis votre tableau de bord.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#0f172a;padding:24px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:13px;color:#cbd5e1;font-weight:600;">Moto-Scoot.tn</p>
                <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Achetez et vendez votre moto, scooter ou quad en toute confiance.
                </p>
                <p style="margin:12px 0 0;font-size:11px;color:#64748b;letter-spacing:0.4px;">
                  © ${year} MotoScoot — Tous droits réservés
                </p>
              </td>
            </tr>
          </table>
          <p style="max-width:600px;margin:16px auto 0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.5;">
            Vous recevez cet e-mail car quelqu'un vous a écrit sur MotoScoot.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}

${safeSender} vous a envoyé un nouveau message sur MotoScoot${safeListing ? ` à propos de "${safeListing}"` : ''}.

"${safePreview}"

Répondre : ${conversationUrl}

— L'équipe MotoScoot`;

  return { subject, html, text };
}

/**
 * Send a "new message received" email notification.
 * Errors must be swallowed by callers — failed notifications must never block
 * the actual message-send pipeline.
 */
async function sendNewMessageEmail({ to, recipientName, senderName, messagePreview, listingTitle, conversationUrl }) {
  const { subject, html, text } = newMessageTemplate({
    recipientName, senderName, messagePreview, listingTitle, conversationUrl
  });
  return transporter.sendMail({
    from: `"${FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

// ---- HTML template: listing approved by moderation ----
function listingApprovedTemplate({ recipientName, listingTitle, listingUrl, dashboardUrl }) {
  const safeName = escapeHtml(recipientName || '');
  const safeListing = escapeHtml(listingTitle || 'votre annonce');
  const safeUrl = escapeHtml(listingUrl || dashboardUrl || 'https://www.moto-scoot.tn');
  const safeDashUrl = escapeHtml(dashboardUrl || 'https://www.moto-scoot.tn/tableau-de-bord');
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,';
  const subject = `✅ Votre annonce "${safeListing}" est en ligne sur MotoScoot`;
  const logoUrl = 'https://www.magma-studio.tn/portfolio2/moto/Logo/logo-white.svg';
  const year = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;line-height:1px;color:#f5f6f8;">
      Bonne nouvelle ! Votre annonce ${safeListing} a été validée et est désormais visible par tous les acheteurs.
    </span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);padding:32px 32px 28px;text-align:center;">
                <img src="${logoUrl}" alt="Moto-Scoot.tn" height="32" style="height:32px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />
                <div style="font-size:13px;color:#ffffff;opacity:0.95;margin-top:10px;letter-spacing:0.4px;text-transform:uppercase;font-weight:600;">
                  Annonce validée
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 36px 8px;">
                <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">
                  🎉 Votre annonce est en ligne&nbsp;!
                </h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">${greeting}</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#334155;">
                  Bonne nouvelle&nbsp;: votre annonce <strong style="color:#0f172a;">${safeListing}</strong> a été validée par notre équipe de modération et est désormais visible par tous les acheteurs sur MotoScoot.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:8px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.55;color:#166534;">
                      ✅ Statut&nbsp;: <strong>Active &amp; publiée</strong><br/>
                      Vous recevrez un e-mail à chaque message reçu de la part d'un acheteur.
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 20px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);box-shadow:0 6px 16px rgba(255,106,0,0.28);">
                      <a href="${safeUrl}"
                         style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                        Voir mon annonce
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">
                  Gérez votre annonce, vos messages et vos statistiques depuis
                  <a href="${safeDashUrl}" style="color:#ff6a00;font-weight:600;text-decoration:none;">votre tableau de bord</a>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#0f172a;padding:24px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:13px;color:#cbd5e1;font-weight:600;">Moto-Scoot.tn</p>
                <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;line-height:1.5;">
                  Achetez et vendez votre moto, scooter ou quad en toute confiance.
                </p>
                <p style="margin:12px 0 0;font-size:11px;color:#64748b;letter-spacing:0.4px;">
                  © ${year} MotoScoot — Tous droits réservés
                </p>
              </td>
            </tr>
          </table>
          <p style="max-width:600px;margin:16px auto 0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.5;">
            Vous recevez cet e-mail car votre annonce vient d'être validée sur MotoScoot.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}

Bonne nouvelle : votre annonce "${safeListing}" a été validée et est désormais en ligne sur MotoScoot.

Voir votre annonce : ${listingUrl || dashboardUrl || 'https://www.moto-scoot.tn'}
Tableau de bord : ${dashboardUrl || 'https://www.moto-scoot.tn/tableau-de-bord'}

— L'équipe MotoScoot`;

  return { subject, html, text };
}

// ---- HTML template: listing rejected by moderation ----
function listingRejectedTemplate({ recipientName, listingTitle, reason, dashboardUrl }) {
  const safeName = escapeHtml(recipientName || '');
  const safeListing = escapeHtml(listingTitle || 'votre annonce');
  const safeReason = escapeHtml(reason || '').slice(0, 500);
  const safeDashUrl = escapeHtml(dashboardUrl || 'https://www.moto-scoot.tn/tableau-de-bord');
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,';
  const subject = `Votre annonce "${safeListing}" n'a pas pu être publiée`;
  const logoUrl = 'https://www.magma-studio.tn/portfolio2/moto/Logo/logo-white.svg';
  const year = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);padding:32px 32px 28px;text-align:center;">
                <img src="${logoUrl}" alt="Moto-Scoot.tn" height="32" style="height:32px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />
                <div style="font-size:13px;color:#ffffff;opacity:0.95;margin-top:10px;letter-spacing:0.4px;text-transform:uppercase;font-weight:600;">
                  Annonce non publiée
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 36px 8px;">
                <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">
                  Votre annonce n'a pas été validée
                </h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">${greeting}</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#334155;">
                  Après vérification par notre équipe de modération, votre annonce <strong style="color:#0f172a;">${safeListing}</strong> n'a pas pu être publiée sur MotoScoot.
                </p>

                ${safeReason ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.55;color:#7f1d1d;">
                      <strong style="display:block;margin-bottom:6px;">Motif du refus&nbsp;:</strong>
                      ${safeReason}
                    </td>
                  </tr>
                </table>` : ''}

                <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                  Vous pouvez modifier votre annonce et la soumettre à nouveau. Pensez notamment à&nbsp;:
                </p>
                <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;line-height:1.7;color:#475569;">
                  <li>Fournir un titre clair et précis (marque, modèle, année).</li>
                  <li>Ajouter au moins 3 photos nettes du véhicule réel.</li>
                  <li>Indiquer un prix cohérent et la localisation exacte.</li>
                  <li>Respecter nos règles de publication (pas de coordonnées dans le texte, contenu approprié).</li>
                </ul>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 20px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);box-shadow:0 6px 16px rgba(255,106,0,0.28);">
                      <a href="${safeDashUrl}"
                         style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                        Modifier mon annonce
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">
                  Une question&nbsp;? Répondez à cet e-mail, notre équipe vous accompagne.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#0f172a;padding:24px 32px;text-align:center;">
                <p style="margin:0 0 6px;font-size:13px;color:#cbd5e1;font-weight:600;">Moto-Scoot.tn</p>
                <p style="margin:12px 0 0;font-size:11px;color:#64748b;letter-spacing:0.4px;">
                  © ${year} MotoScoot — Tous droits réservés
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}

Votre annonce "${safeListing}" n'a pas pu être publiée sur MotoScoot.${safeReason ? `\n\nMotif : ${safeReason}` : ''}

Vous pouvez la modifier et la soumettre à nouveau depuis votre tableau de bord :
${dashboardUrl || 'https://www.moto-scoot.tn/tableau-de-bord'}

— L'équipe MotoScoot`;

  return { subject, html, text };
}

/**
 * Send "your listing was approved" notification.
 * Errors are swallowed by callers — a failed mail must never block moderation.
 */
async function sendListingApprovedEmail({ to, recipientName, listingTitle, listingUrl, dashboardUrl }) {
  const { subject, html, text } = listingApprovedTemplate({ recipientName, listingTitle, listingUrl, dashboardUrl });
  return transporter.sendMail({
    from: `"${FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

/**
 * Send "your listing was rejected" notification.
 * Errors are swallowed by callers — a failed mail must never block moderation.
 */
async function sendListingRejectedEmail({ to, recipientName, listingTitle, reason, dashboardUrl }) {
  const { subject, html, text } = listingRejectedTemplate({ recipientName, listingTitle, reason, dashboardUrl });
  return transporter.sendMail({
    from: `"${FROM_NAME}" <${SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
}

/* ============================================================
 * Compact shared shell used by the newer templates below
 * (call requests, similar listings, newsletter, boost confirm).
 * Mirrors the orange-gradient hero + rounded card layout used
 * by the legacy templates above so all emails feel like they
 * come from the same brand. Kept inline (no template engine)
 * to maximize email-client compatibility.
 * ============================================================ */
function brandedShell({ subject, eyebrow, preheader, bodyHtml, footerExtraHtml = '' }) {
  const logoUrl = 'https://www.magma-studio.tn/portfolio2/moto/Logo/logo-white.svg';
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;line-height:1px;color:#f5f6f8;">${escapeHtml(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
<tr><td style="background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 100%);padding:32px 32px 28px;text-align:center;">
<img src="${logoUrl}" alt="Moto-Scoot.tn" height="32" style="height:32px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;"/>
<div style="font-size:13px;color:#ffffff;opacity:0.95;margin-top:10px;letter-spacing:0.4px;text-transform:uppercase;font-weight:600;">${escapeHtml(eyebrow || '')}</div>
</td></tr>
<tr><td style="padding:32px;">${bodyHtml}</td></tr>
<tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #eef0f3;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;">
${footerExtraHtml}
&copy; ${year} Moto-Scoot.tn — La marketplace moto en Tunisie<br/>
<a href="https://www.moto-scoot.tn" style="color:#ff6a00;text-decoration:none;">www.moto-scoot.tn</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

/* ---------------- Call request (demande d'appel) ---------------- */
function callRequestTemplate({ recipientName, requesterName, requesterPhone, message, listingTitle, listingUrl }) {
  const safeName = escapeHtml(recipientName || '');
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,';
  const subject = `📞 Demande de rappel pour "${listingTitle || 'votre annonce'}"`;
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0f172a;">Nouvelle demande de rappel</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#374151;">${greeting}</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#374151;">
      Un acheteur potentiel souhaite que vous le rappeliez au sujet de votre annonce
      <strong>${escapeHtml(listingTitle || '')}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #ffd9b8;border-radius:12px;padding:18px 20px;margin:0 0 22px;">
      <tr><td style="font-size:14px;color:#1a1a1a;line-height:1.7;">
        <strong>Nom :</strong> ${escapeHtml(requesterName || 'Non précisé')}<br/>
        <strong>Téléphone :</strong> <a href="tel:${escapeHtml(requesterPhone || '')}" style="color:#ff6a00;text-decoration:none;font-weight:700;">${escapeHtml(requesterPhone || 'Non fourni')}</a>
        ${message ? `<br/><br/><strong>Message :</strong><br/>${escapeHtml(message)}` : ''}
      </td></tr>
    </table>
    ${listingUrl ? `<p style="text-align:center;margin:24px 0 0;">
      <a href="${escapeHtml(listingUrl)}" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;">Voir l'annonce</a>
    </p>` : ''}
  `;
  const text = `Demande de rappel\n\n${greeting}\n\nUn acheteur souhaite que vous le rappeliez au sujet de "${listingTitle}".\n\nNom: ${requesterName || 'Non précisé'}\nTéléphone: ${requesterPhone || 'Non fourni'}\n${message ? `\nMessage: ${message}\n` : ''}\n${listingUrl ? `Annonce: ${listingUrl}` : ''}`;
  return { subject, html: brandedShell({ subject, eyebrow: 'Demande de rappel', preheader: `Un acheteur souhaite être rappelé pour ${listingTitle}`, bodyHtml: body }), text };
}

async function sendCallRequestEmail(opts) {
  const { to } = opts;
  const { subject, html, text } = callRequestTemplate(opts);
  return transporter.sendMail({ from: `"${FROM_NAME}" <${SMTP_USER}>`, to, subject, html, text });
}

/* ---------------- Similar listings digest ---------------- */
function similarListingsTemplate({ recipientName, listings = [], unsubscribeUrl }) {
  const safeName = escapeHtml(recipientName || '');
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,';
  const count = listings.length;
  const subject = count === 1
    ? `🔔 Une nouvelle annonce qui pourrait vous intéresser`
    : `🔔 ${count} nouvelles annonces qui pourraient vous intéresser`;
  const cards = listings.slice(0, 6).map((l) => `
    <tr><td style="padding:0 0 14px;">
      <a href="${escapeHtml(l.url || '#')}" style="display:block;text-decoration:none;color:inherit;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #eef0f3;border-radius:12px;overflow:hidden;">
          <tr>
            ${l.image ? `<td width="120" style="vertical-align:middle;"><img src="${escapeHtml(l.image)}" alt="" width="120" style="display:block;width:120px;height:90px;object-fit:cover;"/></td>` : ''}
            <td style="padding:12px 16px;vertical-align:middle;">
              <div style="font-size:15px;font-weight:700;color:#0f172a;margin:0 0 4px;">${escapeHtml(l.title || '')}</div>
              ${l.price ? `<div style="font-size:14px;font-weight:700;color:#ff6a00;">${escapeHtml(String(l.price))} TND</div>` : ''}
              ${l.location ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(l.location)}</div>` : ''}
            </td>
          </tr>
        </table>
      </a>
    </td></tr>`).join('');
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0f172a;">Nouveautés sélectionnées pour vous</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#374151;">${greeting}<br/>D'après vos favoris et recherches, voici ce qui vient d'arriver sur MotoScoot.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
    <p style="text-align:center;margin:24px 0 0;">
      <a href="https://www.moto-scoot.tn" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;">Voir toutes les annonces</a>
    </p>`;
  const footer = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Se désabonner de ces alertes</a><br/>`
    : '';
  const text = `${greeting}\n\nNouveautés MotoScoot:\n\n${listings.map(l => `- ${l.title}${l.price ? ` — ${l.price} TND` : ''}\n  ${l.url || ''}`).join('\n')}\n`;
  return { subject, html: brandedShell({ subject, eyebrow: 'Annonces similaires', preheader: subject, bodyHtml: body, footerExtraHtml: footer }), text };
}

async function sendSimilarListingsEmail(opts) {
  const { to } = opts;
  const { subject, html, text } = similarListingsTemplate(opts);
  return transporter.sendMail({ from: `"${FROM_NAME}" <${SMTP_USER}>`, to, subject, html, text });
}

/* ---------------- Newsletter broadcast ---------------- */
function newsletterTemplate({ subject, contentHtml, preheader, unsubscribeUrl }) {
  const body = `<div style="font-size:15px;line-height:1.6;color:#1a1a1a;">${contentHtml || ''}</div>`;
  const footer = unsubscribeUrl
    ? `Vous recevez cet email car vous êtes abonné à la newsletter Moto-Scoot.<br/><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Se désabonner</a><br/>`
    : '';
  return { subject, html: brandedShell({ subject, eyebrow: 'Newsletter', preheader: preheader || subject, bodyHtml: body, footerExtraHtml: footer }) };
}

async function sendNewsletterEmail({ to, subject, contentHtml, preheader, unsubscribeUrl }) {
  const { html } = newsletterTemplate({ subject, contentHtml, preheader, unsubscribeUrl });
  return transporter.sendMail({ from: `"${FROM_NAME}" <${SMTP_USER}>`, to, subject, html });
}

/* ---------------- Boost confirmation ---------------- */
function boostConfirmationTemplate({ recipientName, listingTitle, pack, days, endsAt, amount, listingUrl }) {
  const safeName = escapeHtml(recipientName || '');
  const greeting = safeName ? `Bonjour ${safeName},` : 'Bonjour,';
  const subject = `🚀 Boost activé : "${listingTitle || 'votre annonce'}"`;
  const endsAtFr = endsAt ? new Date(endsAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const packLabel = ({ featured: 'Featured', top: 'Top liste', urgent: 'Urgent', spotlight: 'Spotlight' })[pack] || pack || 'Boost';
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0f172a;">Votre boost est actif 🚀</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#374151;">${greeting}<br/>Votre annonce <strong>${escapeHtml(listingTitle || '')}</strong> bénéficie maintenant d'une visibilité maximale.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #ffd9b8;border-radius:12px;padding:18px 20px;margin:0 0 22px;">
      <tr><td style="font-size:14px;color:#1a1a1a;line-height:1.8;">
        <strong>Pack :</strong> ${escapeHtml(packLabel)}<br/>
        <strong>Durée :</strong> ${escapeHtml(String(days))} jours<br/>
        ${endsAtFr ? `<strong>Expire le :</strong> ${escapeHtml(endsAtFr)}<br/>` : ''}
        ${amount ? `<strong>Montant :</strong> ${escapeHtml(String(amount))} TND` : ''}
      </td></tr>
    </table>
    ${listingUrl ? `<p style="text-align:center;margin:24px 0 0;">
      <a href="${escapeHtml(listingUrl)}" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;">Voir mon annonce boostée</a>
    </p>` : ''}`;
  const text = `${greeting}\n\nVotre annonce "${listingTitle}" est boostée.\nPack: ${packLabel}\nDurée: ${days} jours${endsAtFr ? `\nExpire le: ${endsAtFr}` : ''}${amount ? `\nMontant: ${amount} TND` : ''}\n${listingUrl || ''}`;
  return { subject, html: brandedShell({ subject, eyebrow: 'Boost activé', preheader: `Pack ${packLabel} actif pendant ${days} jours`, bodyHtml: body }), text };
}

async function sendBoostConfirmationEmail(opts) {
  const { to } = opts;
  const { subject, html, text } = boostConfirmationTemplate(opts);
  return transporter.sendMail({ from: `"${FROM_NAME}" <${SMTP_USER}>`, to, subject, html, text });
}

module.exports = {
  transporter,
  isSMTPVerified,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendNewMessageEmail,
  sendListingApprovedEmail,
  sendListingRejectedEmail,
  sendCallRequestEmail,
  sendSimilarListingsEmail,
  sendNewsletterEmail,
  sendBoostConfirmationEmail,
  _internals: { resetPasswordTemplate, welcomeTemplate, verificationTemplate, newMessageTemplate, listingApprovedTemplate, listingRejectedTemplate, callRequestTemplate, similarListingsTemplate, newsletterTemplate, boostConfirmationTemplate, SMTP_USER, SMTP_HOST, SMTP_PORT, FROM_NAME },
};
