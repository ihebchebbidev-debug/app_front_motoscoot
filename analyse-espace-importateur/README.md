# Espace importateur : plan enregistré (20 novembre 2026)

Branche de travail : `feat/espace-importateur`. Rien n'est encore codé : ce dossier garde le plan pour la reprise.

- Plan complet avec les maquettes : [PLAN-ESPACE-IMPORTATEUR.html](PLAN-ESPACE-IMPORTATEUR.html) (à ouvrir dans un navigateur)
- Même page en ligne (privée) : https://claude.ai/artifact/How7W2XaD3Jag5kYhdynVd

## Les deux étapes

1. **Le bilan de la semaine par e-mail.** Chaque lundi à 9 h (heure de Tunis), chaque importateur abonné qui a un e-mail reçoit ses chiffres de la semaine passée (appels, WhatsApp, devis, comparaisons) et ses demandes de devis. L'envoi part de devis@moto-scoot.tn.
2. **L'espace importateur, en lecture seule.** Il est à l'adresse `/espace-importateur`, avec trois onglets : Chiffres, Devis et Abonnement. Il a le même look que « Mon compte » et réutilise les composants du tiroir « Rapport » de l'admin.

L'étape 3 viendra plus tard : l'importateur gère lui-même ses contacts, le statut de ses devis et ses prix.

## Décisions du propriétaire (20 novembre 2026)

| Question | Décision |
|---|---|
| Rythme du bilan | Chaque lundi à 9 h, pour la semaine précédente (lundi à dimanche) |
| Noms et coordonnées des demandeurs dans l'e-mail | Oui |
| Bilan envoyé même sans aucun contact | Oui, avec une phrase claire |
| Personnes par importateur | Jusqu'à 3 |
| Après la fin de l'abonnement | 30 jours de lecture, puis seulement l'onglet Abonnement |
| Copie de chaque bilan à Moto-Scoot | Oui, en copie cachée (`QUOTE_ADMIN_TO`) |

## Ordre de travail

| # | Qui | Quoi |
|---|---|---|
| 1 | PR serveur | Le moteur du bilan : modèle d'e-mail, calcul de la semaine, script `report:weekly`, table `importer_report_sends` (migration 042), aperçu et envoi manuel côté admin, tests |
| 2 | Iheb | Déploie le serveur et ajoute la tâche cron système `0 9 * * 1 … TZ=Africa/Tunis npm run report:weekly`, une seule fois et hors PM2 |
| 3 | PR back-office | Les boutons « Aperçu de l'e-mail » et « Envoyer maintenant », la ligne « Dernier bilan envoyé », le prochain envoi affiché dans la synthèse |
| 4 | Propriétaire | Vérifie l'aperçu, puis laisse partir le premier lundi |
| 5 | PR serveur | Les accès à l'espace : table `importer_members` (migration 043, 3 personnes maximum), vérification que le compte appartient bien à l'importateur, routes `/api/importer/me/*`, invitation par e-mail, effacement des coordonnées des devis après 12 mois (`quotes:purge`), tests d'isolement entre importateurs |
| 6 | Iheb | Déploie le serveur, vérifie `FRONT_URL`, ajoute la tâche cron d'effacement |
| 7 | PR back-office | La partie « Accès à l'espace » dans la fiche importateur : inviter, voir la dernière visite, retirer |
| 8 | PR site | Les écrans de l'espace, les états particuliers, l'entrée dans le menu du compte et la nouvelle phrase de consentement (« transmises à l'importateur X ») |
| 9 | Propriétaire | Teste avec le compte de test MotoScoot, puis invite SODIV |

## À reprendre

- Commencer par la PR 1, en partant de `origin/main`. Prévoir une PR par élément, que le propriétaire fusionne lui-même.
- Chaque PR contient une section « Vérification SEO ». L'espace est en `noindex`, absent du sitemap et chargé seulement quand on l'ouvre.
- Avant d'ouvrir l'espace aux vrais importateurs : vérifier s'il faut faire une déclaration à l'INPDP (loi organique 2004-63).
