# Page « Fiches techniques » (liste des marques) sur téléphone : analyse UI/UX

**Date :** 6 novembre 2026. **Page :** `/fiches-techniques` (`components/TechSpecsBrands.tsx`). **Mesuré sur le site en ligne** à 390 × 844 px, au doigt.
**Méthode :** lecture du code et mesures dans le navigateur, sans rien envoyer au site. Analyse en lecture seule, aucun code modifié.

**Captures (dans ce dossier) :**

| Fichier | Ce qu'elle montre |
|---|---|
| `marques-telephone-premier-ecran.png` | le premier écran |
| `marques-telephone-page-entiere.png` | la page entière |
| `marques-telephone-panneau-filtres.png` | ce qu'il y a derrière le bouton « Filtres » |

## Ce que voit le visiteur
1. **Le haut :** le fil d'Ariane, puis le titre « Fiches Techniques ».
2. **Un gros bouton noir « Filtres ».**
3. **« MARQUES POPULAIRES » :** 6 logos sur 2 colonnes.
4. **« TOUTES LES MARQUES » :** les 13 marques. **Les 6 « populaires » y reviennent toutes.**
5. **Le pied de page.**

**En chiffres :**
- la page fait 3 913 px de haut ;
- **le premier écran ne montre que 2 marques** (SYM, Peugeot) ;
- il faut défiler environ 2 500 px pour voir les 13 marques.

## Ce qui fonctionne
- **La page ne bouge pas au chargement** (CLS 0), et le premier contenu s'affiche en 1,4 s (le logo Teyin).
- **Les marques sont de vrais liens**, et les logos sont propres et homogènes.
- **Le fil d'Ariane** a son bouton de 44 px, et le titre est visible.

## Analyse (format avant / après)

| Avant | Après | Pourquoi |
| --- | --- | --- |
| La recherche est cachée derrière **« Filtres »**. Ce bouton ouvre un panneau « **Trier et Filtrer** » qui ne contient… **qu'un champ de recherche** et « APPLIQUER ». | **Un champ « Rechercher une marque ou un modèle… » visible** sous le titre (48 px, texte 16 px). Plus de bouton « Filtres » sur cette page. | 2 touchers pour atteindre la seule action utile. Le panneau promet un tri et des filtres qu'il n'a pas. |
| Les menus **« Importateur »** et **« Pays »** sont écrits dans le code mais **jamais affichés**. La liste des importateurs est quand même téléchargée à chaque visite. | Les afficher, si on les veut, dans le champ ou dans un vrai panneau ; sinon, retirer le code et la requête. | Du code mort et une requête pour rien. |
| **« Marques populaires »** affiche 6 marques, qui **reviennent toutes** dans « Toutes les marques » (13 au total). Cela ajoute environ 650 px pour du doublon. | Avec 13 marques, **une seule grille** de toutes les marques. Ou bien les populaires en une **ligne horizontale** de petites pastilles qu'on fait défiler du doigt. | Le doublon double le défilement et fait douter : « est-ce la même liste ? ». |
| **Tuiles de 163 × 155 px**, logo de 115 px, et beaucoup de vide : 40 px entre un titre et sa grille, 96 px entre deux sections. **2 marques par écran.** | **3 colonnes**, logo de 64 à 72 px, nom en dessous, tuile d'environ 110 px de haut, sur un fond légèrement teinté ou avec un fin cadre. **9 à 12 marques par écran.** | On parcourt une liste : la densité et la lecture d'un coup d'œil comptent plus que la taille des logos. |
| **Aucun retour à l'appui** sur une marque. Seul existe un agrandissement au survol (`group-hover:scale-105`), qui reste « collé » après un toucher. | `active:scale-[0.97]` et un fond plus soutenu à l'appui. Le survol réservé aux souris (`@media (hover: hover)`). | Une tuile doit répondre au doigt tout de suite. Sinon l'interface semble ne pas avoir entendu. |
| **Chaque tuile apparaît au défilement** en 700 ms : `transition-all`, glissement de 32 px, décalage entre tuiles. Rien pour « Réduire les animations ». | Pas d'animation sur une grille qu'on parcourt souvent. Sinon 200 ms en `ease-out`, opacité et 8 px seulement, et rien en mouvement réduit. | Au-delà de 300 ms, une interface paraît lente. `transition-all` anime aussi des propriétés inutiles. Les tuiles arrivent en retard sous le doigt. |
| Titres **« MARQUES POPULAIRES »** et **« TOUTES LES MARQUES »** en 24 px, graisse 900, majuscules, lettres serrées. | **« Toutes les marques »** en casse normale, 20 px, graisse 800. | Les majuscules très grasses crient et se lisent moins bien. Le titre de page porte déjà la hiérarchie. |
| Compteur **« 13 MARQUES »** en 12 px, gris `#9096a2`, contraste **2,97:1**. | « 13 marques » en 14 px gris-600, contraste supérieur à 4,5:1, à côté du titre. | Illisible pour beaucoup de visiteurs (minimum 4,5:1). |
| Le nom de la marque est en majuscules espacées (« QJ MOTOR »), et aucune information ne l'accompagne. | Le nom en casse normale, et **« 9 modèles »** en dessous. | Le nombre aide à choisir et montre que la tuile mène à quelque chose. |
| Le sous-titre (« Caractéristiques officielles et prix du neuf… ») est **caché sur téléphone**. | Une ligne courte sous le titre : « Prix du neuf et caractéristiques des modèles vendus en Tunisie ». | Sur téléphone, rien ne dit ce que contient la page avant de défiler. |
| Aucune marque trouvée : texte gris pâle en majuscules, dans un grand cadre en pointillés de 128 px de marge. | Un message court en gris foncé, avec un bouton « Effacer la recherche ». | Le visiteur doit savoir quoi faire, et pouvoir lire le message. |

## Priorités proposées (une PR chacune, avec ton accord)
1. **Recherche visible** à la place du bouton « Filtres » (plus de panneau vide), et suppression du code mort Importateur / Pays et de sa requête.
2. **Une grille compacte de 3 colonnes**, sans le doublon « populaires » (ou populaires en ligne horizontale), avec retour à l'appui et « N modèles » sous chaque marque.
3. **Mouvement :** plus d'apparition lente des tuiles au défilement, et respect de « Réduire les animations ».
4. **Lisibilité :** titres en casse normale, compteur lisible, sous-titre court sur téléphone, message « aucune marque » utile.
