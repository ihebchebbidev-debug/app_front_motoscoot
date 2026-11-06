# Fil d'Ariane et bouton retour sur téléphone : audit et critique

**Date :** 6 novembre 2026. **Périmètre :** téléphone uniquement (≤ 767 px), mode clair. Analyse **en lecture seule**, aucun code modifié.

**Méthode :** deux analyses indépendantes, puis une synthèse.
- **A, revue de design :**
  - lecture des 24 fichiers concernés ;
  - 22 pages du site en ligne, à 390, 360 et 320 px, au doigt.
- **B, mesures :**
  - tailles, couleurs, contraste, structure pour les lecteurs d'écran ;
  - destination du bouton retour ;
  - détecteur Impeccable.

Pendant les essais, tous les envois (POST) et les requêtes partielles étaient bloqués, les publicités masquées, et aucune connexion n'a été faite.

**Planches comparatives** (dans ce dossier) :
- `planche-390-fil-ariane.png` : la zone du fil d'Ariane sur 19 pages ;
- `planche-320-fil-ariane.png` : la même zone sur un petit téléphone ;
- `planche-390-premier-ecran.png` : le premier écran de chaque page ;
- `mesures-390.png` : la planche de l'analyse B.

---

## 1. Ce qui existe aujourd'hui

**Il n'y a pas de composant commun.** Le fil d'Ariane et sa flèche sont **recopiés à la main dans 22 fichiers**, ce qui a produit trois familles.

| Famille | Pages | Bouton retour | Texte du fil | Position sous l'en-tête (72 px) |
|---|---|---|---|---|
| **A, compacte** (11 pages) | fiche annonce, article, guide, garage, FAQ, mentions légales, sécurité, CGU, cookies, plan du site, favoris | **30 × 30 px**, coins 8 px, flèche 16 px | **11 px** | 24 px (annonce) ; 40–48 px (article, guide, garage) ; **271–351 px** (FAQ et pages légales, sous le grand bandeau orange) |
| **A′, dans l'en-tête de liste** (2 pages) | Annonces, Garages | 30 × 30 px, **placé dans le fil**, après le titre et le nombre | 11 px | **143–157 px**, sous le titre H1 |
| **B, « Hero »** (7 pages) | Actualités, Conseils, Fiches techniques, page de marque, fiche technique d'un modèle, Comparateur, prix Scooter 125 | **44 × 44 px**, coins 16 px, flèche 18 px | **12 px** | 24 px |
| **Aucun** | Contact, À propos | — | — | — |

### Ce qu'un visiteur remarque en passant d'une page à l'autre
- **La flèche change de taille et de forme :** 30 px aux coins serrés d'un côté, 44 px aux coins arrondis de l'autre.
- **Le texte change de taille :** 11 ou 12 px.
- **Le fil change de place :** collé sous l'en-tête, ou 300 px plus bas sous le bandeau, ou après le titre.
- **Le bord gauche saute :** 16 px sur l'article, le guide et le garage, contre 24 px ailleurs.
- **La dernière étape n'est pas toujours la page actuelle :**
  - « Honda » sur une annonce ;
  - « SYM » sur la fiche d'un modèle SYM, alors que le modèle n'apparaît pas ;
  - « Tunisie », une étape qui ne mène nulle part, sur une fiche garage.
- **Les noms ne correspondent pas au menu :** « Mag' » au lieu de « Actualités », « Conseils » au lieu de « Entretien & Conseil ».
- **Une étape manque parfois :** la page d'une marque et les prix Scooter 125 sautent « Fiches techniques ».

### Où mène la flèche
| Pages | Destination |
|---|---|
| 13 pages (listes, FAQ, pages légales, Actualités, Conseils, Fiches techniques, Comparateur…) | **toujours l'accueil**, exactement comme le mot « Accueil » juste à côté |
| Fiche annonce | **la recherche d'où l'on vient**, filtres compris. C'est très bien fait. |
| Article, guide | **la page précédente du navigateur** : venant de l'accueil, on y retourne |
| Garage, marque, modèle, Scooter 125 | la page parente, fixe |

**La même flèche fait donc trois choses différentes**, et rien ne l'indique.

---

## 2. Mesures

### Contraste
| Élément | Couleur | Contraste | Seuil |
|---|---|---|---|
| « Accueil » et les étapes intermédiaires | gris `#9096a2` sur `#f7f8f8` | **2,8:1** ❌ | 4,5:1 |
| Petite maison devant « Accueil » | même gris | **2,8:1** ❌ | 3:1 |
| Chevrons « › » | `#c6cbd2` | 1,5:1 (décoratif, toléré) | — |
| Page actuelle | `#161a22`, gras 800 | 16,4:1 ✅ | — |
| Flèche du bouton | `#384252` sur blanc | 10,2:1 ✅ | — |
| **Bord du bouton** | `#f1f2f4` sur `#f7f8f8` | **1,05:1** : invisible, seule l'ombre dessine le bouton | — |

Le détecteur Impeccable relève les mêmes 2,8:1 sur les pages annonce et FAQ. Dans le code, il ne trouve rien, car il lit mal les fichiers React.

### Tailles à toucher (recommandation : 44 px)
| Élément | Taille | Verdict |
|---|---|---|
| Bouton retour, famille A (11 pages + Annonces et Garages) | **30 × 30 px** | ❌ |
| Bouton retour, famille B | 44 × 44 px | ✅ |
| Liens du fil (« Accueil », « Annonces »…) | **16 à 18 px de haut** | ❌ |

### Typographie
- **Étapes :** 11 ou 12 px, graisse 500, sans majuscules.
- **Page actuelle :** 11 ou 12 px, graisse 800.
- **Le saut est énorme :** juste en dessous, le titre de la page fait 24 à 32 px en graisse 800 ou 900. Rien entre les deux.
- **Ce sont les plus petits textes du site,** et les plus pâles.
- **Casse mélangée :** « Fiches Techniques », « Mentions Légales » (Majuscule À Chaque Mot) dans le fil, mais « Fiches techniques SYM » dans le titre.

### Petits téléphones (320 px)
- **Les fils à 4 étapes débordent :** garage, guide et article sont coupés net au bord de l'écran, sans « … ».
- **Sur la fiche d'un modèle,** « Fiches Techniques » passe sur 2 lignes et « SYM » devient « S… ».

### Structure (lecteurs d'écran, clavier, Google)
- **Les étapes sont de simples textes cliquables :** le clavier ne peut pas les atteindre, et Google ne les suit pas. Seule la fiche d'un modèle utilise de vrais liens.
- **Il manque la structure attendue pour un fil d'Ariane :**
  - pas de liste ;
  - pas de « page actuelle » annoncée ;
  - un nom (« Fil d'ariane ») sur 2 pages seulement.
- **Le bouton s'appelle « Retour »** sans dire où il mène, et n'a pas de repère de focus propre.
- **Sur les 7 pages « Hero », le fil apparaît en fondu** et glisse de 32 px : la navigation bouge au chargement.

---

## 3. Ce qui fonctionne
- **La page actuelle se distingue bien :** noir, gras, 16,4:1. Les chevrons restent discrets, et l'orange est réservé aux actions.
- **La famille B montre déjà la bonne voie :**
  - un bouton de 44 px sur écran tactile ;
  - sur la fiche d'un modèle, de vrais liens que Google suit.
- **Le retour depuis une annonce** ramène exactement à la recherche d'origine (filtres et page), avec des solutions de repli si on arrive directement.
- **Aucun débordement horizontal** de la page, de 320 à 390 px.

---

## 4. Problèmes, par gravité

### 🔴 Graves (P1)
1. **Texte illisible et cibles trop petites.**
   - **Le défaut :**
     - « Accueil » et les étapes sont à **2,8:1** de contraste, en 11 px ;
     - les liens font 16 px de haut ;
     - la flèche fait **30 px** sur 13 pages.
   - **Correction :**
     - étapes en `text-gray-600` (7:1), en 13 px ;
     - zone de toucher de 44 px de haut pour chaque lien et pour le retour.
2. **Trois versions différentes du même élément.**
   - **Ce qui change d'une page à l'autre :**
     - la taille du bouton : 30 ou 44 px ;
     - la taille du texte : 11 ou 12 px ;
     - la position : 4 hauteurs différentes ;
     - le bord gauche : 16 ou 24 px.
   - **Correction :** **un seul composant** `FilAriane`, utilisé par toutes les pages, à la place des 22 copies. C'est aussi ce qui évitera que ça diverge à nouveau.
3. **Le fil raconte une fausse hiérarchie.**
   - **Ce qui est faux :**
     - « Honda » comme page actuelle d'une annonce ;
     - « SYM » à la place du modèle ;
     - « Tunisie » qui ne mène nulle part ;
     - « Mag' » ;
     - « Fiches techniques » qui manque sur les pages de marque.
   - **Correction :** de vraies pages parentes, et la page actuelle en dernier, avec les noms du menu. Par exemple :
     - Accueil › Annonces › Africa Twin CRF1000 ;
     - Accueil › Fiches techniques › SYM › ADX 300 ;
     - Accueil › Actualités › {titre}.

### 🟠 Importants (P2)
4. **La flèche et « Accueil » font la même chose côte à côte,** sur 13 pages. Et selon la page, la flèche fait trois choses différentes.
   - **Correction recommandée sur téléphone :** remplacer flèche + fil par **un seul lien « ← Annonces »** (le nom de la page parente).
     - Il mène toujours au parent visible. Sur l'annonce, il garde le retour à la recherche.
     - Le geste « retour » du téléphone s'occupe déjà de l'historique.
     - Le fil complet reste sur ordinateur.
   - **Variante si tu veux garder le fil sur téléphone :** supprimer la flèche, et raccourcir le milieu du fil quand il ne tient pas.
5. **Le fil est au mauvais endroit.**
   - **Sur Annonces et Garages,** il arrive **après** le titre.
   - **Sur la FAQ et les pages légales,** il est **300 px plus bas**, sous le bandeau orange.
   - **Sur 4 pages « Hero »,** le titre H1 est caché sur téléphone : c'est le fil en 12 px qui sert de titre.
   - **Correction :** toujours **juste sous l'en-tête**, avant le titre, et le titre toujours visible.
6. **Débordement à 320 px.**
   - **Le défaut :** les fils longs sont coupés au bord de l'écran.
   - **Correction :** la page actuelle prend la place qui reste et finit par « … ». En dessous de 360 px, les étapes du milieu se replient en « … ».

### 🟢 Mineurs (P3)
- **De vrais liens** à la place des textes cliquables (clavier, Google).
- **La structure des fils d'Ariane** pour les lecteurs d'écran : liste, page actuelle annoncée, nom « Fil d'Ariane ».
- **Un nom de bouton qui dit où il mène :** « Retour à Annonces ».
- **Pas d'animation d'entrée** sur la navigation (pages « Hero »).
- **Un vrai bord ou fond pour le bouton**, au lieu d'une ombre seule ; ou pas de cadre du tout avec la proposition « ← Annonces ».
- **Rien ne réagit à l'appui :** seule une couleur au survol existe, qui ne sert à rien au doigt.
- **Casse :** « Fiches techniques », « Mentions légales », en casse normale comme les titres.
- **Titres cachés :** sur l'article et le guide, le vrai titre H1 est caché sur téléphone et remplacé par un bloc sans rôle de titre.

### Hors sujet, mais trouvé pendant l'analyse
- **`/plan-du-site` affiche « Page introuvable » (erreur 404) sur le site en ligne.** `vercel.json:145` envoie l'adresse vers `/plan-du-site/index.html`, un fichier qui ne semble pas exister. À corriger avec ton accord, car ce fichier règle les adresses de tout le site.

---

## 5. Notes heuristiques (0 à 4)
| Heuristique | Note | Raison |
|---|---|---|
| Visibilité de l'état | 2 | page actuelle bien marquée, mais parfois c'est la marque (Honda, SYM) ; titres coupés à 100–150 px |
| Correspondance avec le monde réel | 2 | « Mag' », « Tunisie », noms différents du menu |
| Contrôle et liberté | 2 | un retour existe partout, celui de l'annonce est excellent ; mais trois comportements sous la même flèche |
| Cohérence et standards | 1 | 3 familles, 2 tailles de bouton, 2 tailles de texte, 4 positions, 2 marges |
| Prévention des erreurs | 3 | l'annonce garde la recherche, l'édition protège les changements non enregistrés |
| Reconnaissance plutôt que rappel | 2 | étapes manquantes, la flèche ne dit pas où elle va |
| Flexibilité et efficacité | 2 | les étapes pourraient servir de raccourcis, mais elles font 16 px et ne sont pas des liens |
| Esthétique et sobriété | 2 | flèche + Accueil en double, fil 300 px sous un bandeau |
| Aide face aux erreurs | n/a | pas d'état d'erreur dans cet élément |
| Aide et documentation | n/a | ne s'applique pas à la navigation |
| **Total** | **16 / 32** (50 %) | **Moyen : la bonne idée est là, l'exécution est éparpillée** |

---

## 6. Proposition : une seule spécification pour téléphone
- **Où :** juste sous l'en-tête, 16 px d'espace, avant le titre. Bord gauche aligné sur le contenu (24 px).
- **Variante recommandée, « ← Parent » :**
  - un lien de 44 px de haut, flèche 18 px, texte 14 px semi-gras gris foncé (`text-gray-700`) ;
  - fond gris clair à l'appui, sans cadre ;
  - il mène au parent : « ← Annonces », « ← SYM », « ← Actualités ».
- **Variante « fil » (si tu préfères le garder) :**
  - 13 px, étapes en `text-gray-600` (7:1), page actuelle en `text-gray-900` semi-gras ;
  - chevrons de 14 px ;
  - « Accueil » écrit, sans l'icône maison ;
  - chaque lien haut de 44 px ;
  - page actuelle tronquée avec « … ».
- **Pour les deux variantes :**
  - de vrais liens ;
  - nom « Fil d'Ariane » ;
  - page actuelle annoncée ;
  - aucune animation.
