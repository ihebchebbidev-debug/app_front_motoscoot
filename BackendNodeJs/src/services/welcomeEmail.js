'use strict';

// Welcome presentation is independent of SMTP configuration. Reuse the
// established transport and sender so signup delivery settings stay unchanged.
const { transporter, _internals: { FROM_NAME, SMTP_USER } } = require('./mailer');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function welcomeTemplate({ name, siteUrl }) {
  const memberName = String(name || '').trim() || 'Membre Moto-Scoot';
  const safeMemberName = escapeHtml(memberName);
  const plainGreeting = name ? `Bonjour ${name},` : 'Bonjour,';
  const greeting = escapeHtml(plainGreeting);
  const subject = 'Bienvenue sur Moto-Scoot.tn — votre inscription est confirmée';
  const home = (siteUrl || 'https://www.moto-scoot.tn').replace(/\/+$/, '');
  const depositUrl = `${home}/deposer-une-annonce`;
  const searchUrl = `${home}/annonces`;
  const dashboardUrl = `${home}/mon-compte`;
  const techSpecsUrl = `${home}/fiches-techniques`;
  const year = new Date().getFullYear();
  const heroDesktopUrl = 'https://www.moto-scoot.tn/images/email-community-background-desktop.jpg';
  const heroMobileUrl = 'https://www.moto-scoot.tn/images/email-community-background-mobile.jpg';

  // The pass is a personalised welcome treatment for the existing account.
  // Text, member name and every action stay live HTML when images are blocked.
  // Responsive JPEG backgrounds have a solid-colour fallback and Outlook VML.
  // Text is never baked into the artwork; no external font or script.
  const html = `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${subject}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office"><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt;mso-table-rspace:0pt; }
    table { border-collapse:collapse; }
    img { border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    @media only screen and (max-width:620px) {
      .email-shell { padding:16px 10px!important; }
      .email-content { padding-left:24px!important;padding-right:24px!important; }
      .email-title { font-size:46px!important;line-height:47px!important;letter-spacing:-1.8px!important; }
      .email-copy { font-size:16px!important;line-height:25px!important; }
      .email-pass-content { padding-left:20px!important;padding-right:20px!important; }
      .email-member-name { font-size:27px!important;line-height:34px!important; }
      .email-button { display:block!important;padding:17px 12px!important;font-size:19px!important;line-height:24px!important; }
      .email-row-number { width:30px!important; }
    }
    @media only screen and (max-width:480px) {
      .email-hero { height:1120px!important;background-image:url('${heroMobileUrl}')!important;background-position:center bottom!important;background-size:cover!important; }
      .email-footer-column, .email-footer-bottom { display:block!important;width:auto!important;padding:0!important;border:0!important;text-align:left!important; }
      .email-footer-links { padding-top:24px!important; }
      .email-footer-credit { padding-top:8px!important; }
      .email-header-caption { display:none!important; }
      .email-pass-label { font-size:9px!important;letter-spacing:0!important; }
      .email-pass-logo { width:132px!important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eae9e5;color:#151719;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;font-size:1px;line-height:1px;mso-hide:all;">Votre inscription est confirmée. Votre compte est prêt ! Découvrez votre pass de membre Moto-Scoot.tn.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eae9e5">
    <tr><td class="email-shell" align="center" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0c0e" style="max-width:600px;background:#0b0c0e;">
        <tr><td class="email-hero" height="1140" valign="top" bgcolor="#0b0c0e" background="${heroDesktopUrl}" style="height:1140px;vertical-align:top;background-color:#0b0c0e;background-image:url('${heroDesktopUrl}');background-repeat:no-repeat;background-position:center bottom;background-size:cover;">
          <!--[if mso]><v:rect fill="true" stroke="false" style="width:600px;height:1140px;"><v:fill type="frame" src="${heroDesktopUrl}" color="#0b0c0e"/><v:textbox inset="0,0,0,0"><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td class="email-content" style="padding:24px 48px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><a href="${escapeHtml(home)}"><img src="https://www.moto-scoot.tn/images/logo-email-white.png" alt="moto-scoot.tn" width="190" height="24" style="display:block;width:190px;max-width:100%;height:auto;" /></a></td>
            <td class="email-header-caption" align="right" style="color:#a9adb4;font-size:9px;line-height:16px;font-weight:700;letter-spacing:1.6px;text-align:right;">COMMUNAUTÉ<br />DEUX-ROUES · TUNISIE</td>
          </tr></table>
        </td></tr>
        <tr><td class="email-content" style="padding:20px 48px 0;">
          <p style="margin:0 0 14px;color:#E65400;font-size:10px;line-height:18px;font-weight:700;letter-spacing:2px;">LA PASSION NOUS RASSEMBLE</p>
          <h1 class="email-title" style="margin:0 0 18px;color:#ffffff;font-size:56px;line-height:56px;font-weight:800;letter-spacing:-3px;">Bienvenue.</h1>
          <p style="margin:0 0 8px;color:#f3f3f1;font-size:15px;line-height:24px;">${greeting}</p>
          <p class="email-copy" style="margin:0 0 10px;color:#ffffff;font-size:16px;line-height:26px;"><strong>Votre inscription est confirmée. Votre compte est prêt !</strong></p>
          <p class="email-copy" style="margin:0;color:#b9bcc3;font-size:16px;line-height:26px;">Voici votre pass de membre : vous faites désormais partie de la communauté Moto-Scoot.tn.</p>
        </td></tr>
        <tr><td class="email-content" style="padding:22px 48px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f2ec" style="background:#f4f2ec;border:1px solid #e3dfd5;border-radius:14px;border-collapse:separate;">
            <tr><td class="email-pass-content" style="padding:24px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td><img class="email-pass-logo" src="https://www.moto-scoot.tn/images/logo-email-color.png" alt="Moto-Scoot.tn" width="158" height="20" style="display:block;width:158px;max-width:100%;height:auto;" /></td>
                <td class="email-pass-label" align="right" style="color:#595d62;font-size:9px;line-height:16px;font-weight:700;letter-spacing:1.4px;text-align:right;">PASS PERSONNEL</td>
              </tr></table>
              <p style="margin:28px 0 5px;color:#676b70;font-size:10px;line-height:16px;letter-spacing:1.3px;">MEMBRE DE LA COMMUNAUTÉ</p>
              <p class="email-member-name" dir="auto" style="margin:0 0 24px;color:#17191b;font-size:32px;line-height:38px;font-weight:700;letter-spacing:-1px;overflow-wrap:anywhere;word-break:break-word;">${safeMemberName}</p>
            </td></tr>
            <tr><td class="email-pass-content" style="padding:18px 28px 22px;border-top:1px dashed #c6c3bb;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td width="60%" valign="top" style="width:60%;vertical-align:top;">
                  <p style="margin:0 0 4px;color:#676b70;font-size:9px;line-height:15px;letter-spacing:1.2px;">UNIVERS</p>
                  <p style="margin:0;color:#25282b;font-size:13px;line-height:20px;font-weight:700;">Motos &amp; scooters</p>
                </td>
                <td width="40%" align="right" valign="top" style="width:40%;text-align:right;vertical-align:top;">
                  <p style="margin:0 0 4px;color:#676b70;font-size:9px;line-height:15px;letter-spacing:1.2px;">TERRITOIRE</p>
                  <p style="margin:0;color:#25282b;font-size:13px;line-height:20px;font-weight:700;">Tunisie</p>
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="email-content" style="padding:24px 48px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#E65400" style="background:#E65400;border-radius:7px;mso-padding-alt:17px 18px;">
            <a class="email-button" href="${escapeHtml(dashboardUrl)}" style="display:block;border:1px solid #E65400;border-radius:7px;padding:17px 18px;color:#ffffff;font-size:20px;line-height:24px;font-weight:700;text-align:center;">Entrer dans mon univers &rarr;</a>
          </td></tr></table>
          <p style="margin:14px 0 36px;color:#ffffff;font-size:12px;line-height:20px;text-align:center;">Votre compte est prêt. Faites comme chez vous.</p>
        </td></tr>
          </table>
          <!--[if mso]></v:textbox></v:rect><![endif]-->
        </td></tr>
        <tr><td class="email-content" bgcolor="#f6f5f1" style="padding:36px 48px 16px;background:#f6f5f1;">
          <h2 style="margin:0 0 26px;color:#17191b;font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.8px;">Votre prochain chapitre.</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td class="email-row-number" width="40" valign="top" style="width:40px;padding:3px 0 22px;color:#a24a1e;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:22px;vertical-align:top;">01</td>
              <td style="padding:0 0 22px;">
                <h3 style="margin:0 0 6px;color:#17191b;font-size:17px;line-height:25px;">Une envie de changement ?</h3>
                <p class="email-copy" style="margin:0;color:#60646b;font-size:14px;line-height:23px;">Trouvez votre prochain deux-roues parmi les annonces, partout en Tunisie.</p>
                <a href="${escapeHtml(searchUrl)}" style="display:inline-block;padding:12px 0;color:#9a3d0b;font-size:14px;line-height:24px;font-weight:700;">Explorer les annonces &rarr;</a>
              </td>
            </tr>
            <tr>
              <td class="email-row-number" width="40" valign="top" style="width:40px;padding:23px 0 22px;border-top:1px solid #deded8;color:#a24a1e;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:22px;vertical-align:top;">02</td>
              <td style="padding:20px 0 22px;border-top:1px solid #deded8;">
                <h3 style="margin:0 0 6px;color:#17191b;font-size:17px;line-height:25px;">Un modèle en tête ?</h3>
                <p class="email-copy" style="margin:0;color:#60646b;font-size:14px;line-height:23px;">Consultez les caractéristiques, les équipements et les prix des motos et scooters neufs en Tunisie pour choisir le modèle qui vous correspond.</p>
                <a href="${escapeHtml(techSpecsUrl)}" style="display:inline-block;padding:12px 0;color:#9a3d0b;font-size:14px;line-height:24px;font-weight:700;">Consulter les fiches techniques &rarr;</a>
              </td>
            </tr>
            <tr>
              <td class="email-row-number" width="40" valign="top" style="width:40px;padding:23px 0 0;border-top:1px solid #deded8;color:#a24a1e;font-family:Consolas,'Courier New',monospace;font-size:12px;line-height:22px;vertical-align:top;">03</td>
              <td style="padding:20px 0 0;border-top:1px solid #deded8;">
                <h3 style="margin:0 0 6px;color:#17191b;font-size:17px;line-height:25px;">Une histoire à transmettre ?</h3>
                <p class="email-copy" style="margin:0;color:#60646b;font-size:14px;line-height:23px;">Offrez une nouvelle route à votre moto ou votre scooter. Votre annonce standard est gratuite.</p>
                <a href="${escapeHtml(depositUrl)}" style="display:inline-block;padding:12px 0;color:#9a3d0b;font-size:14px;line-height:24px;font-weight:700;">Déposer mon annonce &rarr;</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="email-content" bgcolor="#f6f5f1" style="padding:8px 48px 36px;background:#f6f5f1;">
          <p style="margin:0;color:#17191b;font-size:14px;line-height:23px;font-weight:700;">À bientôt sur Moto-Scoot.<br /><span style="color:#60646b;font-weight:400;">L’équipe Moto-Scoot.tn</span></p>
        </td></tr>
        <tr><td class="email-content" bgcolor="#0b0c0e" style="padding:30px 48px 24px;background:#0b0c0e;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;"><tr>
            <td class="email-footer-column" width="50%" valign="top" style="width:50%;padding:0 20px 0 0;vertical-align:top;">
              <a href="${escapeHtml(home)}"><img src="https://www.moto-scoot.tn/images/logo-email-white.png" alt="moto-scoot.tn" width="180" height="23" style="display:block;width:180px;max-width:100%;height:auto;" /></a>
              <p style="margin:15px 0 0;color:#b9bcc3;font-size:12px;line-height:21px;">Une passion commune.<br />Des routes à partager.</p>
            </td>
            <td class="email-footer-column email-footer-links" width="50%" valign="top" style="width:50%;padding:0 0 0 20px;border-left:1px solid #313236;vertical-align:top;">
              <p style="margin:0 0 8px;color:#ff9a63;font-size:10px;line-height:18px;font-weight:700;letter-spacing:1.2px;">À VOS CÔTÉS</p>
              <a href="mailto:contact@moto-scoot.tn" style="display:inline-block;padding:10px 0;color:#ededeb;font-size:12px;line-height:24px;">contact@moto-scoot.tn</a><br />
              <a href="tel:+21621719109" style="display:inline-block;padding:10px 0;color:#b9bcc3;font-size:12px;line-height:24px;">21 719 109</a>
            </td>
          </tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr><td style="padding-top:8px;border-top:1px solid #313236;">
            <p style="margin:0;font-size:11px;line-height:24px;">
              <a href="${escapeHtml(home)}/conditions" style="display:inline-block;padding:10px 0;color:#b9bcc3;">Conditions générales</a>&nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="${escapeHtml(home)}/mentions-legales" style="display:inline-block;padding:10px 0;color:#b9bcc3;">Confidentialité</a>&nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="${escapeHtml(home)}/faq" style="display:inline-block;padding:10px 0;color:#b9bcc3;">FAQ</a>
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td class="email-footer-bottom" valign="top" style="padding:4px 12px 0 0;color:#b9bcc3;font-size:10px;line-height:18px;">© ${year} Moto-Scoot.tn<br />Tous droits réservés.</td>
              <td class="email-footer-bottom email-footer-credit" align="right" valign="top" style="padding:4px 0 0;color:#b9bcc3;font-size:10px;line-height:18px;text-align:right;">Réalisé par<br /><a href="https://magma-studio.tn" style="color:#ff9a63;">magma-studio.tn</a></td>
            </tr></table>
          </td></tr></table>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p style="max-width:504px;margin:20px auto 0;color:#62666b;font-size:11px;line-height:18px;text-align:center;">Vous recevez cet e-mail à la suite de votre inscription sur Moto-Scoot.tn.</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `${plainGreeting}

BIENVENUE.
Votre inscription est confirmée. Votre compte est prêt !
Voici votre pass de membre : vous faites désormais partie de la communauté Moto-Scoot.tn.

VOTRE PASS PERSONNEL MOTO-SCOOT
Membre de la communauté : ${memberName}
Univers : Motos et scooters
Territoire : Tunisie

Votre compte est prêt. Faites comme chez vous.
Entrer dans mon univers : ${dashboardUrl}

VOTRE PROCHAIN CHAPITRE

01 — Une envie de changement ?
Trouvez votre prochain deux-roues parmi les annonces, partout en Tunisie.
Explorer les annonces : ${searchUrl}

02 — Un modèle en tête ?
Consultez les caractéristiques, les équipements et les prix des motos et scooters
neufs en Tunisie pour choisir le modèle qui vous correspond.
Consulter les fiches techniques : ${techSpecsUrl}

03 — Une histoire à transmettre ?
Offrez une nouvelle route à votre moto ou votre scooter. Votre annonce standard est gratuite.
Déposer mon annonce : ${depositUrl}

À bientôt sur Moto-Scoot.
L’équipe Moto-Scoot.tn

Contact : contact@moto-scoot.tn — 21 719 109
Conditions générales : ${home}/conditions
Confidentialité : ${home}/mentions-legales
FAQ : ${home}/faq
Réalisé par https://magma-studio.tn

© ${year} Moto-Scoot.tn
Vous recevez cet e-mail à la suite de votre inscription sur Moto-Scoot.tn.`;

  return { subject, html, text };
}


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


module.exports = { sendWelcomeEmail, _internals: { welcomeTemplate } };
