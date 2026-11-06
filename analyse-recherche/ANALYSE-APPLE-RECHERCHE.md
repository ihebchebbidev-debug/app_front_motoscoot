# Barre de recherche de l'accueil : regard Apple et équipe UX/UI

**Date :** 6 novembre 2026. Base : `main` (PR #69 à #72 en ligne). La PR #73 (couleurs et typographie) est prise en compte, mais elle n'est pas encore mergée. Analyse en lecture seule.

**Grille utilisée :**
- *Designing Fluid Interfaces* : réponse, mouvement interruptible, cohérence spatiale, panneaux ;
- les 8 principes d'Apple : but, contrôle, responsabilité, familiarité, flexibilité, simplicité, soin, plaisir ;
- l'orientation (« où suis-je, où aller ») et l'accessibilité du mouvement.

## Verdict
Après les PR #69 à #73, la barre est **juste** :
- elle ne déborde plus, les listes passent au-dessus de tout et le nombre de résultats est honnête ;
- elle est lisible, et un champ vide se distingue d'un champ rempli.

Un designer Apple ne s'arrêterait plus à « ça marche ». Il s'arrêterait à **« comment ça se touche »**. Les listes s'ouvrent comme des fenêtres web, pas comme des panneaux de téléphone : elles apparaissent sans direction, disparaissent sans transition, ne se ferment pas d'un geste, et le clavier surgit avant qu'on ait choisi de taper.

## Ce qui est déjà au niveau
| Principe | Dans la barre |
|---|---|
| **Retour d'état** | « Rechercher (6) » donne le nombre de résultats **avant** de lancer la recherche, et il suit chaque choix (PR #70). |
| **Responsabilité** | La position n'est demandée **qu'au toucher de « Autour de moi »**, au bon moment, pour une raison claire. |
| **Simplicité par dépendance** | Marques et villes ne listent que ce qui existe dans les annonces, avec leur nombre. Changer de catégorie remet la marque et le modèle à zéro. |
| **Contrôle** | Chaque choix s'efface d'une croix ; Échap ferme ; toucher le fond ferme. |
| **Soin (après #71–#73)** | Plus de débordement de 320 à 1440 px, 0 texte sous le contraste minimum, et un champ vide distinct d'un champ rempli. |

## Ce qu'un designer Apple corrigerait

| Avant | Après proposé | Pourquoi (principe Apple) |
|---|---|---|
| Sur téléphone, la liste apparaît en **glissant de 20 px en 0,6 s**, puis **disparaît d'un coup** | La feuille **monte depuis le bas de l'écran** (`translateY(100%)` → 0, environ 300 ms, courbe « tiroir » `cubic-bezier(0.32, 0.72, 0, 1)`) et **redescend** à la fermeture | **Cohérence spatiale** : ce qui monte du bas y retourne. Une sortie instantanée après une entrée animée fait « cassé ». |
| On ne peut fermer qu'avec la croix ou le fond | **Poignée** en haut de la feuille et **glisser vers le bas pour fermer**, au doigt (1:1), fermeture selon la vitesse du geste | **Manipulation directe et interruptibilité** : c'est le geste attendu d'une feuille sur iPhone et Android. |
| Sur ordinateur, chaque liste est une **fenêtre au milieu de l'écran**, avec voile et flou, même pour 8 prix | **Menu sous le champ**, qui part du champ (`transform-origin: top`), sans voile | **Ancrage à la source** : le menu sort de ce qu'on a cliqué. Le voile est réservé aux tâches qui doivent couper le reste. |
| Marque et Modèle : **le clavier s'ouvre aussitôt** (`autoFocus`) et cache la moitié de la liste sur téléphone | Sur téléphone, la liste s'affiche **sans clavier** ; le champ de recherche s'ouvre quand on le touche. Sur ordinateur, on garde le focus direct. | **Contrôle** : on choisit souvent dans la liste sans taper. **Flexibilité** : toucher et pointeur n'ont pas les mêmes attentes. |
| Toucher un champ ne donne **aucun retour** avant l'ouverture | Léger fond gris **à l'appui** (`:active`), puis l'ouverture | **Réponse** : le retour commence à l'appui, pas au relâchement. |
| La croix d'effacement fait **18 px** | Zone de toucher de **44 px** autour de la croix (sans changer son dessin) | **Gestes** : les petites cibles font rater, et le doigt ouvre la liste au lieu d'effacer. |
| Les animations des listes **ignorent « Réduire les animations »** | Simple fondu de 150 ms dans ce cas | **Accessibilité du mouvement.** |
| Le blocage du défilement passe par `body { overflow: hidden }` | Blocage compatible iPhone (la page ne défile plus sous la feuille) | **Soin** : sur Safari iOS, la page bouge encore sous un panneau ouvert. |
| « **Neuf** » ressemble à un onglet mais **quitte la page** | Un lien explicite « Motos neuves → », ou un vrai onglet qui filtre | **Familiarité** : un onglet change le contenu sur place ; un lien emmène ailleurs. |
| « Autour de moi » refusé : **rien ne se passe** | Message : « Position non disponible. Autorisez la localisation ou choisissez une ville. » | **Retour d'erreur** : dire ce qui s'est passé et quoi faire. |
| Le nombre de résultats s'affiche sur téléphone et tablette, **pas sur ordinateur** | « Rechercher · 6 annonces » aussi sur ordinateur, ou le nombre sous la barre | **Cohérence** : la même information au même endroit, quel que soit l'écran. |

## Question de produit (à décider)
- **Pas de recherche par mot.** On ne peut pas taper « Tmax 2019 » ou « scooter 125 Sousse ». Les grandes places de marché (Leboncoin, AutoScout24, Avito) proposent un champ libre en tête. C'est une **décision de produit**, pas un défaut de dessin. La page de résultats a déjà un filtre `search` côté serveur ; il manque seulement le champ.

## Priorités proposées (une PR par ligne)
1. **Feuille de choix « à la iPhone » sur téléphone** : montée depuis le bas, poignée, glisser vers le bas pour fermer, sortie animée, mouvement réduit, défilement bloqué sur iPhone.
2. **Ordinateur : menu sous le champ** au lieu d'une fenêtre centrée.
3. **Clavier non imposé sur téléphone**, retour à l'appui, croix de 44 px.
4. **Nombre de résultats sur ordinateur**, message si « Autour de moi » est refusé, « Neuf » en lien explicite.
5. *(Décision produit)* **Champ de recherche par mot.**
