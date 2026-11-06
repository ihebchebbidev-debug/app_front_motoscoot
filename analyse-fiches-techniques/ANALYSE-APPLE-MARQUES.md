# Page « Fiches techniques » (liste des marques) sur téléphone : regard d'un designer Apple

**Date :** 6 novembre 2026. **Page :** `/fiches-techniques` (`components/TechSpecsBrands.tsx`). **Mesuré sur le site en ligne** à 390 × 844 px, au doigt.
**Méthode :** lecture du code et mesures dans le navigateur, sans rien envoyer au site. Analyse en lecture seule, aucun code modifié.

**Grille de lecture :**
- *Designing Fluid Interfaces* : réponse immédiate, mouvement, interruption ;
- les 8 principes d'Apple : but, contrôle, responsabilité, familiarité, flexibilité, simplicité, soin, plaisir ;
- l'orientation (« Où suis-je ? Où aller ? Qu'y a-t-il ? »), la typographie, le mouvement réduit.

Les captures sont dans ce dossier : `marques-telephone-*.png`. Voir aussi `ANALYSE-MARQUES-TELEPHONE.md` (lecture « design engineering »).

## Verdict
**La page fait une seule chose : choisir une marque parmi 13.** Un designer Apple la jugerait sur une question : « combien de temps entre l'arrivée et le toucher sur la bonne marque ? ».

Aujourd'hui, la réponse est **trop long, et sans réponse au doigt** :
- **la page cache sa seule action** : la recherche est derrière « Filtres » ;
- **elle montre 2 marques par écran** ;
- **elle répète 6 marques sur 13** ;
- **un toucher sur une marque ne produit aucun retour visible.**

## Ce qui est déjà au niveau
| Principe | Sur la page |
|---|---|
| **Soin** | Logos homogènes et nets. La page ne bouge pas au chargement (CLS 0), et le premier contenu s'affiche en 1,4 s. |
| **Orientation** | Fil d'Ariane avec un bouton de 44 px, titre visible : on sait où l'on est et comment revenir. |
| **Matière** | L'en-tête fixe est translucide (blanc à 95 % + flou de 12 px) : le contenu passe dessous sans être coupé net. |

## Ce qu'un designer Apple corrigerait

| Avant | Après proposé | Pourquoi (principe Apple) |
|---|---|---|
| Toucher une marque : **aucun retour**. Le surlignage du navigateur est coupé pour tout le site (`-webkit-tap-highlight-color: transparent`), et la tuile n'a pas d'état « appuyé ». Seul l'agrandissement au survol existe, et il reste collé après un toucher. | **Retour dès que le doigt se pose** : la tuile se réduit légèrement (0,97) et son fond s'assombrit, en 100 ms. Le survol est réservé aux souris. | **Réponse** : le retour commence à l'appui, pas au relâchement. Sans lui, l'interface « n'a pas entendu ». |
| La seule action de la page, **chercher**, est derrière « Filtres ». Ce bouton ouvre « **Trier et Filtrer** », qui ne contient qu'un champ de recherche et « APPLIQUER ». | **Un champ de recherche visible** sous le titre, comme la recherche de Réglages ou de Contacts. Il filtre en direct, avec un bouton « Effacer » intégré. | **But et simplicité** : montrer d'abord le chemin courant. Un panneau qui promet un tri et des filtres absents trahit la confiance (**familiarité**). |
| **6 marques « populaires » répétées** dans « Toutes les marques » (13). Environ 650 px de doublon. | **Une seule liste**. S'il faut mettre des marques en avant, une **ligne horizontale** de petites pastilles qu'on fait défiler du doigt, au-dessus de la liste. | **Simplicité** : chaque élément doit mériter sa place. Le doublon oblige à se demander « est-ce la même liste ? ». |
| **2 marques par écran** : tuiles de 163 × 155 px, logo de 115 px, 96 px de vide entre les sections. | **3 colonnes**, logo de 64 à 72 px, tuile d'environ 110 px. **9 à 12 marques par écran**, donc presque toute l'offre d'un coup d'œil. | **Orientation** (« Qu'y a-t-il ? ») : avec 13 marques, on doit voir l'ensemble sans chercher. |
| Chaque tuile **apparaît en glissant** de 32 px en 700 ms au défilement (`transition-all`), avec un décalage entre tuiles. **Le réglage « Réduire les animations » n'est pas respecté.** | **Pas d'animation d'entrée sur une liste qu'on parcourt.** S'il en faut une : opacité et 8 px en 200 ms, et un simple fondu en mouvement réduit. | **Réponse et accessibilité du mouvement** : le contenu doit être là quand le doigt arrive. Un mouvement lent sous un défilement rapide semble en retard. |
| Titres **« MARQUES POPULAIRES »** en 24 px, graisse 900, majuscules, lettres **resserrées** (-0,96 px). Les lettres se touchent presque. | **« Toutes les marques »** en casse normale, 20 px, graisse 700–800, espacement 0 ou légèrement négatif. | **Typographie** : l'espacement dépend de la taille *et* de la casse. Les majuscules demandent de l'air ; resserrées, elles s'écrasent. La hiérarchie vient de la graisse et de la taille, pas des capitales. |
| Compteur **« 13 MARQUES »** en 12 px, gris pâle (contraste **2,97:1**), en majuscules. | « **13 marques** » en 14 px gris foncé (au moins 4,5:1), collé au titre. | **Soin et accessibilité** : un chiffre utile doit se lire. |
| Le nom de la marque est seul, en majuscules espacées (« QJ MOTOR »). | Le nom en casse normale, et **« 9 modèles »** dessous. | **Des libellés précis plutôt que génériques** : le nombre dit ce qu'il y a derrière la tuile (« Qu'y a-t-il ? »). |
| Le sous-titre (« Caractéristiques officielles et prix du neuf… ») est **caché sur téléphone**. | Une ligne courte sous le titre : « Prix du neuf et caractéristiques des modèles vendus en Tunisie. » | **Orientation** : dès l'arrivée, savoir ce que la page apporte. |
| Les menus **Importateur** et **Pays** sont écrits dans le code mais **jamais affichés**, et la liste des importateurs est **téléchargée quand même**. | Les proposer pour de bon (« Par importateur », « Par pays », en option de second niveau), ou retirer le code et la requête. | **But** : décider ce qu'on ne construit pas. Un réglage invisible coûte sans servir. |
| Aucune marque trouvée : texte gris pâle en majuscules, dans un grand cadre en pointillés. | « Aucune marque pour « xyz » », en gris foncé, avec un bouton **Effacer la recherche**. | **Retour d'erreur** : dire ce qui s'est passé et quoi faire. |
| Le texte est en pixels fixes (titre 32 px, noms 13 px), pensé à taille unique. | Des tailles en `rem`, pour que la page suive la taille de texte réglée sur le téléphone. | **Flexibilité** (Dynamic Type) : respecter la taille de texte choisie par chacun. |

## Priorités proposées (une PR chacune, avec ton accord)
1. **Réponse au toucher et recherche visible :**
   - retour immédiat à l'appui sur chaque marque ;
   - champ de recherche à la place de « Filtres » ;
   - « Effacer la recherche » quand il n'y a aucun résultat.
2. **Une seule liste dense :**
   - 3 colonnes, sans le doublon (ou les populaires en ligne horizontale) ;
   - « N modèles » sous chaque marque ;
   - le compteur lisible.
3. **Mouvement :** plus d'entrée lente des tuiles, et « Réduire les animations » respecté.
4. **Typographie et textes :**
   - titres en casse normale, avec un espacement adapté ;
   - sous-titre court sur téléphone ;
   - tailles en `rem` ;
   - Importateur et Pays proposés ou retirés.
