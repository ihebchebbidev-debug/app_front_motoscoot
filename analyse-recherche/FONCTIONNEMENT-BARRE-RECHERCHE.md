# Barre de recherche de l'accueil : fonctionnement, filtres et critique

**Date :** 6 novembre 2026. Composants : `components/search/SearchBar.tsx` et `ChoiceSheet.tsx`, version en ligne, `main` @ 3930995, avec les PR #69 à #75. Analyse **en lecture seule** : aucun code modifié.

**Méthode :** deux analyses indépendantes, puis une synthèse.
- **A — revue de design :** lecture du code, parcours réels sur le site à 1440, 1000, 768 et 390 px.
- **B — mesures :** détecteur Impeccable, tailles et noms des commandes, contraste, clavier, requêtes, débordements.
- **Contrôle direct :** j'ai moi-même vérifié l'API en ligne et le code du serveur (`BackendNodeJs`).
- **Précautions :** tous les envois (POST) et requêtes partielles étaient bloqués, les publicités masquées, aucune connexion.
- **Contexte :** il n'y a que **6 annonces en ligne**.
  - Types : 3 motos, 3 scooters, aucun quad, aucun accessoire.
  - Marques : Yamaha (2), Honda, Kymco, SYM et Voge (1 chacune).

---

## 1. Pourquoi « Modèle » affiche tout

**Sans marque choisie,** la liste des modèles n'est pas tirée des annonces. Elle vient du **catalogue de référence**, celui que l'admin remplit pour les fiches techniques.
- La barre appelle `/reference/models` sans aucune marque (`SearchBar.tsx:217`), et le serveur renvoie **les 138 modèles du catalogue, toutes marques confondues**.
- La recherche des « vrais » modèles (ceux des annonces) ne se lance **qu'une fois une marque choisie** (`useAvailableSearchOptions.ts:21`).
- **La catégorie n'est jamais prise en compte.** Avec « Scooter », on voit encore « 1290 Super Duke R » (une grosse moto KTM), « test 450MT » et des antivols.
- **Les noms apparaissent sans leur marque** : « 350D », « AK 550 ».
- **Aucun de ces 138 noms n'est écrit exactement comme dans les annonces.** Les vendeurs écrivent par exemple « Yamaha Neo's », « sym magic 110 rr », « DINK-R ». Choisir un modèle sans marque donne donc presque toujours **0 annonce**.
- Le message prévu « Choisissez d'abord une marque » **n'apparaît jamais**, parce que le catalogue n'est jamais vide.

**Avec une marque choisie,** la liste est bien filtrée. Avec Honda, elle ne montre que « Africa Twin CRF1000 DCT », la seule Honda en vente. **Deux failles restent :**
- **Liste vide → retour au catalogue.** Si la marque n'a aucune annonce dans la catégorie choisie, la barre affiche **tout le catalogue de cette marque** (`SearchBar.tsx:244-248`). Exemple : Scooter + Honda propose Africa Twin 1100, CB500F, CB650R, Forza 125 et PCX 125, qui mènent tous à 0 annonce (capture `scooter-honda-modeles-catalogue.png`).
- **Pendant le chargement,** la liste peut montrer un instant les modèles de la marque précédente.

**La même cause touche les marques :** la liste des marques ne respecte pas la catégorie.
- **Le serveur retire exprès des filtres** avant de compter. Dans `BackendNodeJs/src/controllers/listingsController.js:282`, la fonction des compteurs efface **la marque, le type, la ville, le modèle, l'état et le vendeur pro**. Seuls le prix, l'année et le mot-clé restent.
- **Vérifié sur l'API en ligne :** `facets`, `?type=Scooter`, `?governorate=Sousse` et `?type=Scooter&brand=Yamaha` donnent exactement la même réponse, 6 annonces.
- **Conséquences :**
  - avec « Scooter », on voit Honda (1), SYM (1) et Voge (1), alors que ces trois annonces sont des **motos** : chacune donne 0 ;
  - « Quad » propose Yamaha (2), qui donne 0 ;
  - **les nombres affichés à côté des marques comptent tous les types.**
- **Le même défaut** fausse les nombres de la page « Annonces » (voir `analyse-filtres/ANALYSE-FILTRES.md`).

---

## 2. Comment fonctionne la barre, champ par champ

| Champ | D'où viennent les choix | Filtré par les annonces ? | Effet sur les autres champs |
|---|---|---|---|
| **Occasion / Neuf** | — | — | « Occasion » ne change rien ; « Neuf » **quitte la page** vers les fiches techniques |
| **Catégorie** (Moto, Scooter, Quad, Accessoires) | catégories de l'admin | **Non** : Quad et Accessoires sont proposés à 0 annonce | remet Marque et Modèle à zéro |
| **Marque** (avec recherche) | marques du catalogue pour la catégorie, croisées avec les compteurs du serveur | **À moitié** : le croisement ignore la catégorie (voir § 1) ; pendant un chargement, **les 99 marques du catalogue**, dont « test » et « Autre » | remet Modèle à zéro |
| **Modèle** (avec recherche) | sans marque : **catalogue entier (138)** ; avec marque : modèles des annonces de la marque, sinon catalogue de la marque | **Seulement avec une marque** | — |
| **Prix max** | liste fixe : 2 000 à 100 000 TND | Non (pas de nombre) | — |
| **Année** (« Année min. ») | liste fixe : 25 ans, de 2026 à 2002 | Non | — |
| **Où ça ?** | « Autour de moi », puis les villes dont le **gouvernorat** a une annonce | **Au niveau du gouvernorat seulement** : 20 villes proposées, 15 sans annonce (La Marsa, Carthage…) | — |
| **Rechercher (N)** | nombre calculé comme la page de résultats | — | **N exact** dans tous les essais (6, 3, 1, 0…) ; affiché **seulement sous 1024 px** |

**Branche « Accessoires » :**
- **Les deux premiers champs changent de rôle :** Marque devient « Articles » (11 types : casque, gants…), et Modèle devient « Marque », inactif tant qu'aucun article n'est choisi.
- **Rien n'y est filtré par les annonces :** les 11 articles et les 14 marques de casques mènent tous à 0 aujourd'hui.
- **L'article choisi n'est pas un filtre :** il est envoyé comme **mot-clé** (« Casque »).
- **Année reste affichée,** alors que la page de résultats la cache pour les accessoires.

**« Rechercher » envoie** : catégorie, mot-clé (article), marque, modèle, ville, « autour de moi », prix max et année min. Sur la page de résultats :
- **la ville** devient le filtre « gouvernorat ». Le serveur cherche aussi dans la ville, donc ça marche ;
- **« Autour de moi »** redemande la position et trie par distance dans un rayon de 50 km. Si la position est refusée, on obtient toute la Tunisie ;
- **le texte tapé dans la recherche Marque ou Modèle mais pas choisi est perdu.** Pourtant, il reste affiché dans le champ : « Hon » reste écrit, alors qu'aucun filtre Marque n'est appliqué ;
- **la colonne de filtres de la page de résultats ne sait pas afficher** le modèle ni la ville venant de l'accueil. Les pastilles disent « Booster 5 » et « Ras Jebel », mais les menus disent « Tous les modèles » et « Toutes les villes » (capture `resultats-modele-ville-non-affiches.png`).

**Selon l'écran :**
- **Téléphone :** une feuille qui monte du bas (PR #74).
- **À partir de 768 px :** un menu sous le champ (PR #75).
- **Disposition des champs :** les uns sous les autres sur téléphone, sur 2 ou 3 lignes sur tablette, une seule ligne à partir de 1280 px.

---

## 3. Ce qui fonctionne
- **Le nombre du bouton est juste.** Il utilise exactement le même calcul que la page de résultats, et les deux nombres concordent dans les 7 parcours testés (6, 3, 0, 1, 1, 1, 1).
- **Les listes sont solides sur tous les écrans :**
  - feuille au doigt sur téléphone, page bloquée derrière, pas de zoom forcé sur iPhone ;
  - menu ancré sur ordinateur, qui passe au-dessus du champ s'il manque de place ;
  - Échap rend le focus au champ ;
  - les listes passent au-dessus de l'en-tête et du bandeau cookies.
- **Contraste et débordement :**
  - tous les textes de la barre dépassent 4,5:1 (PR #73) ;
  - aucun débordement horizontal de 320 à 1440 px ;
  - aucune erreur dans la console.
- **Les remises à zéro en cascade évitent les combinaisons incohérentes :** changer de catégorie efface la marque, changer de marque efface le modèle.

---

## 4. Problèmes, par gravité

### 🔴 Graves
1. **Sur tablette, le bouton « Rechercher » est coupé.**
   - **Le défaut :** le haut de l'accueil a une hauteur fixe sur tablette (`Hero.tsx:13`, `md:h-[50vh]` avec `overflow-hidden`), alors que la carte de recherche y prend 3 lignes.
   - **À 768 × 1024** (iPad tenu droit), la zone orange s'arrête à 512 px et le bouton commence à 503 : il est presque entièrement caché (capture `tablette-768-bouton-coupe.png`).
   - **À 1000 × 800,** il est **entièrement caché**.
   - **Le badge « 6 annonces en ligne »** chevauche aussi le logo.
   - **Pourquoi la PR #71 ne l'a pas vu :** je l'avais vérifiée sur une page de test **sans ce bandeau**. C'est mon oubli.
   - **Correction :** laisser la zone grandir avec la carte (`md:h-auto md:min-h-[50vh]`, et l'équivalent en `lg`).
2. **Des choix mènent à 0 annonce.**
   - **Ce qui est proposé à tort :**
     - « Modèle » sans marque propose 138 modèles ;
     - « Scooter » propose des marques qui n'ont que des motos ;
     - Quad et Accessoires sont proposés sans annonce ;
     - 15 villes sur 20 n'ont aucune annonce ;
     - quand une marque n'a rien dans la catégorie, le catalogue de cette marque revient.
   - **Correction côté site :**
     - avec si peu d'annonces, tirer catégories, marques, modèles et villes **des annonces elles-mêmes**, en une seule requête ;
     - cacher les catégories vides ;
     - sans marque, proposer les vrais modèles avec leur marque (« Yamaha Booster 5 ») ;
     - supprimer le retour au catalogue, ou afficher « Aucune annonce pour l'instant » ;
     - ne lister que les villes qui ont des annonces.
   - **Correction côté serveur** (`BackendNodeJs`, à faire avec ton accord, puis à déployer sur l'API) : chaque compteur ne retire **que son propre filtre**. Le compteur des marques respecte alors la catégorie, celui des catégories respecte la marque, et ainsi de suite.
3. **La page de résultats contredit ce qu'on a choisi.**
   - **Le défaut :** les pastilles montrent « Booster 5 » et « Ras Jebel », mais les menus Modèle et Lieu disent « Tous les modèles » et « Toutes les villes ». On croit que le filtre n'a pas été appliqué.
   - **Correction :**
     - toujours inclure la valeur active dans les menus de la page de résultats ;
     - construire « Lieu » à partir des gouvernorats et des villes des annonces.

### 🟠 Importants
4. **Le nombre de résultats est invisible sur ordinateur, et « (0) » n'explique rien.**
   - **Ce qui manque :** à partir de 1024 px, le bouton dit seulement « Rechercher ». Pendant un nouveau calcul, l'ancien nombre reste affiché sans signe d'attente. À 0, rien n'aide à corriger.
   - **Correction :**
     - « Voir 3 annonces » à toutes les tailles ;
     - un état « … » pendant le calcul ;
     - à 0, « Aucune annonce : retirez la marque » avec un bouton ;
     - une annonce vocale pour les lecteurs d'écran.
5. **Ce qui est affiché n'est pas ce qui est cherché.**
   - **Texte non choisi :** du texte tapé mais non choisi (« Hon », « zzz ») reste affiché, alors qu'il est ignoré.
   - **« Autour de moi » refusé :** la feuille se ferme **sans aucun message** (capture `telephone-position-refusee.png`).
   - **Correction :**
     - à la fermeture, remettre le champ à la valeur choisie, ou choisir automatiquement la seule correspondance ;
     - si la position est refusée : « Position non disponible : autorisez la localisation ou choisissez une ville », et garder la liste ouverte.
6. **Clavier et lecteurs d'écran.**
   - **Ouverture :** sur ordinateur, seul le texte du champ ouvre la liste, ce qui couvre 24 à 33 % du cadre. **Un clic dans le haut du cadre ne fait rien.**
   - **Après un choix au clavier,** le focus se perd en haut de la page.
   - **Navigation dans la liste :**
     - sur tablette, la touche Tab n'atteint jamais les options ;
     - sur téléphone, le focus reste derrière la feuille ;
     - **aucune flèche ne fonctionne**, nulle part.
   - **Ce que disent les lecteurs d'écran :**
     - ils annoncent « Marque », jamais « Marque, Honda » ;
     - les choix ne sont pas annoncés comme des options sélectionnées ;
     - le champ de recherche de la feuille n'a pas de nom.
   - **Petites cibles :** la croix d'effacement fait 18 px, la flèche 20 px, le « Fermer » de la feuille 32 px.
   - **Correction :**
     - tout le cadre du champ ouvre la liste ;
     - flèches haut et bas dans la liste ;
     - focus rendu au champ après un choix ;
     - nom accessible « Marque : Honda » ;
     - rôles « option » et « sélectionné » ;
     - cibles de 44 px.

### 🟢 Mineurs
- **« Neuf »** ressemble à un onglet mais emmène vers les fiches techniques.
- **Unité :** « TND » ici, « DT » sur la page de résultats et partout ailleurs.
- **Champs remplis sans nom :** une fois remplis, ils perdent leur nom. « 2019 » : année minimum ? exacte ?
- **Libellés incohérents :** « Que cherchez-vous ? » s'affiche « Catégorie », « Année min. » s'affiche « Année ».
- **« Où ça ? (Ville, région...) »** ne propose aucune région, utilise trois points au lieu de « … », et n'a pas de recherche pour 20 villes.
- **La marque « test »** apparaît dans les listes du catalogue.
- **L'année maximale de la page de résultats** est fixée à 2026 dans le code et cassera en 2027.
- **Le serveur plafonne à 100 annonces** la requête des modèles, sans prévenir (elle en demande 200).
- **Au chargement de l'accueil,** les 138 modèles sont téléchargés d'office, même si personne n'ouvre « Modèle ».
- **Détecteur Impeccable :**
  - 0 alerte dans le code ;
  - sur la page en ligne, une seule alerte concerne la barre : « carte dans une carte » pour les cadres des champs, ce qui est voulu ici ;
  - les autres alertes (orange sur blanc, badge en 10 px) sont ailleurs sur la page.

---

## 5. Notes heuristiques (0 à 4)
| Heuristique | Note | Raison |
|---|---|---|
| Visibilité de l'état | 2 | nombre absent sur ordinateur, ancien nombre sans attente, refus de position silencieux |
| Correspondance avec le monde réel | 2 | modèles sans marque, villes rangées par gouvernorat invisible, TND/DT |
| Contrôle et liberté | 3 | croix par champ, remises à zéro cohérentes ; pas de « tout effacer », « Neuf » quitte la page |
| Cohérence et standards | 1 | vocabulaire différent de la page de résultats ; pastilles et menus qui se contredisent ; « Marque » change de sens avec Accessoires |
| Prévention des erreurs | 1 | beaucoup de choix proposés mènent à 0 ; texte tapé qui semble appliqué mais ne l'est pas |
| Reconnaissance plutôt que rappel | 2 | nom perdu une fois rempli ; modèles sans marque |
| Flexibilité et efficacité | 2 | recherche dans Marque et Modèle ; pas de mot-clé libre, pas de recherche de ville, pas de flèches |
| Esthétique et sobriété | 3 | propre ; 6 champs et 2 onglets, c'est lourd pour 6 annonces |
| Aide face aux erreurs | 1 | « (0) » sans raison ni solution ; refus de position sans rien |
| Aide et documentation | 2 | quelques messages de liste vide, presque jamais visibles |
| **Total** | **19 / 40** | **Faible : la mécanique est solide, mais les listes promettent plus que ce qui existe** |

**Verdict :** c'est la carte de recherche classique des sites d'annonces (Leboncoin, AutoScout24). Elle convient à la tâche, sans être générique au point de nuire. Mais rien n'y parle de l'acheteur tunisien de deux-roues :
- pas de repère « 125 cc » ni « sans permis » ;
- la marque passe avant le budget, tous les champs pèsent pareil ;
- et surtout, **les listes viennent du catalogue des fiches techniques et non des annonces** : la barre promet plus que ce qui est en vente.

---

## 6. Corrections proposées (une PR par ligne)
1. 🔴 **Tablette : le bouton n'est plus coupé** (hauteur du haut de l'accueil). Petit et sûr.
2. 🔴 **Listes tirées des annonces (site) :**
   - catégories vides cachées ;
   - marques selon la catégorie ;
   - modèles réels avec leur marque, même sans marque choisie ;
   - plus de retour au catalogue ;
   - villes avec annonces.
3. 🔴 **Compteurs du serveur justes** (`BackendNodeJs`, avec ton accord, puis déploiement de l'API). Ce point corrige aussi la page « Annonces ».
4. 🔴 **Page de résultats :** les menus Modèle et Lieu affichent la valeur venue de l'accueil.
5. 🟠 **Nombre sur ordinateur, état d'attente, aide à 0, message si la position est refusée, texte non choisi nettoyé.**
6. 🟠 **Clavier et lecteurs d'écran :**
   - tout le cadre ouvre la liste ;
   - flèches ;
   - focus rendu ;
   - « Marque : Honda » ;
   - cibles de 44 px.
7. 🟢 **Cohérence :**
   - DT partout ;
   - « Neuf » en lien explicite ;
   - libellés alignés ;
   - « Année min. » visible ;
   - marque « test » retirée du catalogue (admin).
