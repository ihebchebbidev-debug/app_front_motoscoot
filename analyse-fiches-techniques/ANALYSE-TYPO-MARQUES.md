# Page « Fiches techniques » (liste des marques) sur téléphone : typographie et tailles de texte

**Date :** 6 novembre 2026. **Page :** `/fiches-techniques` (`components/TechSpecsBrands.tsx`).
**Mesures :**
- **page normale :** chaque style de texte relevé sur le site en ligne, à 390 px de large. Valeurs du navigateur, contraste calculé sur le fond réel ;
- **état « recherche » :** valeurs relevées dans le code.

Analyse en lecture seule, aucun code modifié.

**Grille :** *The Details of UI Typography* (WWDC 2020) :
- l'espacement des lettres dépend de la taille ;
- l'interligne diminue quand le texte grandit ;
- la hiérarchie se construit avec la taille, la graisse et l'interligne ensemble ;
- le texte doit suivre la taille réglée sur le téléphone (Dynamic Type).

## 1. Ce qu'il y a aujourd'hui

### Page normale (mesuré en ligne)
| Texte | Taille | Graisse | Interligne | Espacement | Casse | Couleur | Contraste |
|---|---|---|---|---|---|---|---|
| Fil d'Ariane « Accueil » | 13 px | 500 | 20 px | 0 | normale | gris-600 | 7,2:1 ✅ |
| Fil d'Ariane, page actuelle | 13 px | 600 | 20 px | 0 | normale | gris-900 | 16,5:1 ✅ |
| **Titre « Fiches Techniques »** (h1) | 32 px | **900** | 1,1 | −0,02 em | normale | gris-900 | ✅ |
| **« MARQUES POPULAIRES »**, « TOUTES LES MARQUES » (h2) | 24 px | **900** | 1,33 | **−0,04 em** | **MAJUSCULES** | gris-900 | ✅ |
| **Compteur « 13 MARQUES »** | **12 px** | 700 | 16 px | **+0,1 em** | **MAJUSCULES** | **gris-400** | **2,8:1 ❌** |
| **Nom de marque** (« SYM », « QJ MOTOR ») | 13 px | **900** | 1,5 | +0,05 em | **MAJUSCULES** | gris-900 | ✅ |
| Champ de recherche | 16 px | 500 | — | 0 | — | — | ✅ |

### État « recherche » (relevé dans le code, `TechSpecsBrands.tsx`)
| Texte | Valeur dans le code | Remarque |
|---|---|---|
| « MODÈLES CORRESPONDANTS » (h2) | 18 px, graisse 900, majuscules, lettres resserrées | même défaut que les autres h2 |
| Compteur « 3 FICHES » | 12 px, majuscules, gris-400 | même défaut que « 13 MARQUES » |
| Nom du modèle | 13 px, graisse 900 | trop gras pour une ligne de liste |
| Détails (année · cc · ch) | **11 px**, gris-500 | trop petit, gris tout juste suffisant |
| Étiquette de catégorie | **9 px** | sous le seuil de lecture |
| « Aucun modèle ne correspond… » | 14 px, **gris-400 en italique** | contraste 2,8:1 ❌ |
| « Affichage des 12 premiers résultats… » | 12 px, gris-500 | — |

## 2. Ce qu'un designer Apple y voit

**1. Tout est en graisse 900.**
- C'est le cas du titre, des titres de section, des noms de marque et des noms de modèle.
- Quand tout est au maximum, plus rien ne ressort : la hiérarchie ne vient plus que de la taille.
- Apple construit la hiérarchie avec **taille, graisse et interligne ensemble**. Un titre à 800, une section à 700, un libellé à 600 et un texte à 400–500 donnent quatre niveaux nets.

**2. Des majuscules resserrées.**
- « MARQUES POPULAIRES » est en majuscules **et** avec un espacement négatif (−0,04 em). Les lettres se touchent presque (voir la capture du premier écran).
- Règle Apple : l'espacement dépend de la taille *et* de la casse.
  - Un grand texte en minuscules se resserre un peu, autour de −0,01 à −0,02 em.
  - Des majuscules ont besoin d'**air** : environ +0,02 à +0,06 em.
- Ici, on cumule les deux erreurs. En casse normale, le problème disparaît.

**3. Trop de capitales.**
- Titres de section, compteur, noms de marque, étiquettes : quatre familles de textes en MAJUSCULES sur un seul écran.
- Les capitales se lisent plus lentement : on perd la forme des mots, et toutes les lettres ont la même hauteur.
- Elles « crient », et elles masquent la vraie écriture des marques (« QJ MOTOR » au lieu de « QJ Motor », « CFMOTO »…).

**4. Les petits textes sont trop petits ou trop pâles.**
- Le compteur fait 12 px, en gris-400, à **2,8:1**.
- Dans la recherche, les détails font 11 px et l'étiquette **9 px**.
- Apple descend rarement sous 12–13 px pour un texte qu'on doit lire, et un texte secondaire reste au-dessus de 4,5:1 (gris-600, pas gris-400).

**5. L'échelle n'en est pas une.**
- Sur un même écran on trouve 9, 11, 12, 13, 14, 16, 18, 24 et 32 px, sans rapport régulier entre eux.
- Une échelle courte et régulière (rapport ≈ 1,25) se lit comme un système : 32 → 20 → 16 → 14 → 12.

**6. Des pixels fixes partout.**
- Les tailles sont écrites en pixels (`text-[13px]`, `text-[11px]`…). Quand le visiteur agrandit le texte dans les réglages de son téléphone, la page ne suit pas.
- Les tailles de Tailwind (`text-sm`, `text-base`…) sont en `rem` et suivent ce réglage.

**7. Ce qui est déjà juste :**
- l'espacement négatif du grand titre (−0,02 em à 32 px), et son interligne serré (1,1) ;
- le champ de recherche en 16 px, donc pas de zoom sur iPhone ;
- le fil d'Ariane en 13 px, gris-600 (7:1).

## 3. Échelle proposée (téléphone)

| Rôle | Aujourd'hui | Proposé (classes Tailwind, en rem) |
|---|---|---|
| Titre de page (h1) | 32 px / 900, −0,02 em | **`text-[2rem]` (32 px) / 800**, interligne 1,1, `tracking-[-0.02em]` |
| Titre de section (h2) « Toutes les marques » | 24 px / 900, MAJUSCULES, −0,04 em | **`text-xl` (20 px) / 700, casse normale**, interligne 1,25, `tracking-[-0.01em]` |
| Compteur « 13 marques » | 12 px / 700, MAJUSCULES, gris-400 (2,8:1) | **`text-sm` (14 px) / 500, gris-600 (7:1)**, chiffres alignés (`tabular-nums`), à côté du titre |
| Champ de recherche | 16 px / 500 | inchangé (16 px, pas de zoom iPhone) |
| Nom de marque (tuile) | 13 px / 900, MAJUSCULES, +0,05 em | **`text-sm` (14 px) / 600**, écrit comme la marque (« QJ Motor », « SYM »), espacement 0 |
| Nombre de modèles sous la marque (à venir) | — | **`text-xs` (12 px) / 500, gris-600** |
| Recherche : nom du modèle | 13 px / 900 | **`text-[15px]` / 600** |
| Recherche : détails (année · cc · ch) | 11 px, gris-500 | **`text-[13px]` / 400, gris-600** |
| Recherche : étiquette de catégorie | 9 px | **`text-[11px]` / 600**, casse normale |
| Messages d'aide (« aucun modèle… ») | 14 px, gris-400 italique | **`text-sm` / 400, gris-600**, sans italique |

**Résultat :**
- **5 tailles** (32 · 20 · 16 · 14 · 12, plus 15 et 13 dans les lignes de recherche) ;
- **4 graisses** (800 · 700 · 600 · 400–500) ;
- **plus de majuscules** pour le texte courant ;
- **chaque texte à 4,5:1 ou plus** ;
- **les tailles en `rem`**, qui suivent le réglage du téléphone.

## 4. Pour aller plus loin (à décider)
- **Unifier** cette échelle avec les autres pages de fiches techniques (page d'une marque, fiche d'un modèle). Elles utilisent les mêmes titres en 900 et en majuscules.
- La police **Inter** est bien choisie (lisible, chiffres nets). L'activer avec `font-feature-settings: "cv11", "ss01"` donnerait des chiffres plus lisibles dans les cylindrées et les prix ; c'est optionnel.
