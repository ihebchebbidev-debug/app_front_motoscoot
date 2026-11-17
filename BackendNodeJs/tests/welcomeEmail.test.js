const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the production welcome service with an in-memory transport: never connect to SMTP.
const deliveries = [];
const context = {
  module: { exports: {} },
  process: { env: {} },
  console: { log() {}, warn() {}, error() {} },
  require(name) {
    assert.equal(name, './mailer');
    return {
      transporter: { sendMail: async (message) => { deliveries.push(message); return { messageId: 'test' }; } },
      _internals: { FROM_NAME: 'Moto-Scoot.tn', SMTP_USER: 'sender@example.com' },
    };
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/welcomeEmail.js'), 'utf8'), context);
const mailer = context.module.exports;
const { welcomeTemplate } = mailer._internals;

test('welcome template escapes names in HTML and keeps readable plain text', () => {
  const name = '<img src=x onerror=alert(1)> & Amine';
  const { html, text } = welcomeTemplate({ name });
  assert.ok(!html.includes(name));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; Amine'));
  assert.ok(text.includes(`Bonjour ${name},`));
  assert.ok(welcomeTemplate({}).html.includes('Bonjour,'));
});

test('welcome actions retain their destination in HTML and plain text', () => {
  const { html, text } = welcomeTemplate({ siteUrl: 'https://preview.example///' });
  for (const route of ['/deposer-une-annonce', '/annonces', '/mon-compte', '/fiches-techniques']) {
    const url = `https://preview.example${route}`;
    assert.ok(html.includes(`href="${url}"`));
    assert.ok(text.includes(url));
  }
});

test('welcome delivery includes both versions and the configured recipient', async () => {
  await mailer.sendWelcomeEmail({ to: 'recipient@example.com', name: 'Amine' });
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].to, 'recipient@example.com');
  assert.ok(deliveries[0].html.includes('Bonjour Amine,'));
  assert.ok(deliveries[0].text.includes('Bonjour Amine,'));
  assert.equal(deliveries[0].subject, 'Bienvenue sur Moto-Scoot.tn — votre inscription est confirmée');
});

test('welcome branding uses official logos and site footer destinations', () => {
  const { html, text } = welcomeTemplate({});
  for (const logo of ['logo-email-color.png', 'logo-email-white.png']) {
    assert.ok(html.includes(`https://www.moto-scoot.tn/images/${logo}`));
    // Email clients receive PNGs rather than externally linked SVGs.
    const image = fs.readFileSync(path.join(__dirname, '../../public/images', logo));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  for (const route of ['/conditions', '/mentions-legales', '/faq']) {
    assert.ok(html.includes(`href="https://www.moto-scoot.tn${route}"`));
    assert.ok(text.includes(`https://www.moto-scoot.tn${route}`));
  }
  assert.ok(html.includes('mailto:contact@moto-scoot.tn'));
  assert.ok(html.includes('tel:+21621719109'));
});

test('welcome introduces technical sheets in both email versions', () => {
  const { html, text } = welcomeTemplate({});
  assert.ok(html.includes('Consulter les fiches techniques'));
  assert.ok(text.includes('Consulter les fiches techniques'));
  for (const version of [html, text]) {
    assert.match(version, /caractéristiques, les équipements et les prix des motos et scooters\s+neufs en Tunisie/);
  }
});

test('personal welcome pass and entry action remain readable without images', () => {
  const { html, text } = welcomeTemplate({ name: 'Amine Ben Salah' });
  const withoutImages = html.replace(/<img\b[^>]*>/gi, '');
  for (const content of [withoutImages, text]) {
    assert.ok(content.includes('Amine Ben Salah'));
    assert.ok(content.includes('Entrer dans mon univers'));
    assert.ok(content.includes('https://www.moto-scoot.tn/mon-compte'));
  }
  assert.ok(withoutImages.includes('PASS PERSONNEL'));
  assert.ok(withoutImages.includes('MEMBRE DE LA COMMUNAUTÉ'));
  assert.ok(welcomeTemplate({}).html.includes('Membre Moto-Scoot'));
  assert.ok(!/<script\b|<form\b|<iframe\b/i.test(html));
});

test('responsive email backgrounds use compressed JPEGs and an Outlook fallback', () => {
  const { html } = welcomeTemplate({});
  for (const [version, budget] of [['desktop', 300000], ['mobile', 150000]]) {
    const filename = `email-community-background-${version}.jpg`;
    const bytes = fs.readFileSync(path.join(__dirname, '../../public/images', filename));
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
    assert.equal(bytes.subarray(-2).toString('hex'), 'ffd9');
    assert.ok(bytes.length < budget, `${version} image exceeds its email budget`);
    assert.ok(html.includes(`https://www.moto-scoot.tn/images/${filename}`));
  }
  assert.ok(html.includes('<v:fill type="frame"'));
  assert.ok(html.includes('bgcolor="#0b0c0e" background='));
  // Classic Outlook cannot nest a VML button inside a VML background.
  assert.ok(!html.includes('<v:roundrect'));
  assert.ok(!html.includes('email-community-hero.jpg'));
});

test('welcome confirms the registration clearly in both email versions', () => {
  const { html, text, subject } = welcomeTemplate({ name: 'Amine' });
  for (const version of [html, text]) {
    assert.ok(version.includes('Votre inscription est confirmée. Votre compte est prêt !'));
    assert.ok(version.includes('Voici votre pass de membre : vous faites désormais partie de la communauté Moto-Scoot.tn.'));
    assert.ok(!/Vous êtes des nôtres|Du premier scooter|Bienvenue dans l’univers/i.test(version));
  }
  assert.ok(subject.includes('votre inscription est confirmée'));
  assert.match(html, /<h1\b[^>]*>Bienvenue\.<\/h1>/);
});

test('both signup flows use the dedicated welcome service', () => {
  for (const filename of ['authController.js', 'authExtraController.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/controllers', filename), 'utf8');
    assert.ok(source.includes("const { sendWelcomeEmail } = require('../services/welcomeEmail');"));
    assert.ok(!source.match(/const \{[^}]*sendWelcomeEmail[^}]*\} = require\('\.\.\/services\/mailer'\)/));
  }
});
