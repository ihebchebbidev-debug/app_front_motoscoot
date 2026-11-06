# Page d'une marque des fiches techniques : audit et critique

**Date :** 6 novembre 2026. **Page :** `/fiches-techniques/<marque>` (`components/TechSpecsModels.tsx`). Analyse **en lecture seule**, aucun code modifié.

**Méthode :** deux analyses indépendantes, puis une synthèse.
- **A — revue de design :**
  - lecture du code ;
  - essais sur le site en ligne avec SYM (9 modèles), Yamaha (3) et Honda (1), du téléphone à l'ordinateur.
- **B — mesures :**
  - détecteur Impeccable ;
  - contraste, tailles des zones à toucher, focus clavier ;
  - poids des images, chargement, décalages de la page, référencement.
- **Précautions :** envois (POST) et requêtes partielles bloqués, publicités masquées, aucune connexion.

**Captures (dans ce dossier) :**

| Fichier | Ce qu'elle montre |
|---|---|
| `tablette-768-debordement.png` | la page qui déborde sur tablette |
| `cartes-768-chevauchement.png` | les libellés des cartes qui se chevauchent |
| `telephone-390.png` | le premier écran sur téléphone |
| `telephone-filtres.png` | le panneau des filtres sur téléphone |
| `telephone-apres-retour.png` | la page après un retour depuis une fiche |
| `ordinateur-1440.png` | le premier écran sur ordinateur |

---

## 1. Comment la page fonctionne
- **Données :** la page charge tous les modèles de la marque d'un coup. Il n'y a pas de pagination.
  - **Requête en double :** la marque est demandée deux fois au chargement (`/tech-specs/brands/sym`, puis `/SYM`).
- **Recherche :** elle se fait dans la page, sans aucune requête, sur tous les champs. Par exemple « 689 » ou « 73 ch » fonctionnent, avec les mots trouvés surlignés. **C'est le point fort de la page.**
- **Filtres :** Type de moto, Année, Cylindrée.
  - **Sur ordinateur,** ce sont 3 menus et une recherche.
  - **Sur téléphone,** deux boutons, « Plus récentes » et « Filtres », ouvrent le même panneau.
  - **Aucun filtre n'est gardé dans l'adresse de la page.**
- **Carte d'un modèle :** toute la carte est un lien vers la fiche. Elle contient :
  - une photo et un badge avec l'année ;
  - le nom ;
  - le prix ;
  - cylindrée, puissance et couple ;
  - un bouton orange « Fiche technique ».
- **Pour Google :** le serveur prépare un texte utile, par exemple « SYM : 9 modèles, de 125 à 399 cm³, prix du neuf de 5 850 à 24 000 DT », avec la liste des modèles. **Ce texte est caché aux visiteurs.**

---

## 2. Ce qui fonctionne
- **La recherche** dans tous les champs, avec les unités comprises et les mots trouvés surlignés.
- **Une base technique solide :**
  - chaque carte est un vrai lien (clavier, Google, nouvel onglet) ;
  - la page ne bouge pas pendant le chargement (CLS 0) ;
  - le premier contenu s'affiche en 1,1 à 1,9 s ;
  - un message d'erreur avec bouton « Réessayer » ;
  - une page 404 propre pour une marque inconnue ;
  - les données pour Google sont présentes avant le JavaScript.
- **Les cartes** sont les mêmes que celles des guides de prix, et les photos gardent un cadre fixe.

---

## 3. Problèmes, par gravité

### 🔴 Graves (P1)
1. **La page déborde sur tablette et petit ordinateur (768 à 1279 px).**
   - **Ce qu'on voit :** la page défile de côté de **285 px à 768 px** (iPad tenu droit) et de **193 px à 1024 px**. Le champ de recherche sort de l'écran.
   - **Dans les cartes :**
     - les cartes ne font que 141 à 173 px de large ;
     - les libellés se chevauchent (« CYLINDRÉEPUISSANCECOUPLE ») ;
     - les noms et les valeurs sont coupés.
   - **Cause :** des largeurs fixes dans la barre de filtres (`FilterBar.tsx:187, 220, 233` : 200 + 140 + 140 px, et une recherche de 400 à 500 px qui refuse de rétrécir), plus une grille à 4 colonnes dès 768 px.
   - **Correction :**
     - recherche flexible, menus sans largeur fixe, ou la barre « téléphone » jusqu'à 1024 px ;
     - grille à 2 colonnes, puis 3, puis 4 selon la largeur.
2. **Le bouton « Plus récentes » sur téléphone ne trie rien.**
   - **Le défaut :** c'est le bouton le plus visible de la page. Il ouvre le même panneau que « Filtres », qui ne contient aucun tri.
   - **Correction :** soit le retirer, soit (mieux) en faire un vrai tri : prix croissant ou décroissant, cylindrée, puissance. Le prix est le premier critère de l'acheteur.
3. **La carte ne montre pas ce qui décide l'achat, et elle manque de contraste.**
   - **Absent de la carte, alors que l'API le fournit :**
     - disponible en Tunisie ou pas ;
     - le vendeur (par exemple « Megacycle · Sousse ») ;
     - le poids.
   - **Aucune indication de permis** (50 cc, 125 cc, au-delà).
   - **Les prix absents** (« En arrivage », « Prochainement », « Prix pas encore annoncé ») ont exactement **le style d'un prix**.
   - **Contraste insuffisant :**

     | Élément | Contraste |
     |---|---|
     | Prix orange | **3,7:1** |
     | Bouton orange | 3,7:1 |
     | Badge de l'année | 3,4:1, en 9 px |
     | Libellés « CYLINDRÉE… » | **3,0:1**, en 8 à 10 px |

   - **Valeurs coupées :** « 9.3 kW (12.6 ch) à 8000 tr/min ».
   - **« 9000DT »** se lit collé à cause d'un espacement trop serré.
   - **Correction :**
     - prix en gris foncé ou orange foncé, plus grand ;
     - une étiquette neutre « Disponible en Tunisie / En arrivage / Prix non annoncé » ;
     - une ligne cc · ch · kg, avec le permis ;
     - le vendeur ;
     - plus de bouton orange par carte, puisque toute la carte est déjà un lien.

### 🟠 Importants (P2)
4. **Tout est perdu au retour d'une fiche.**
   - **Le défaut :** on ouvre un modèle, on revient, et on retombe **en haut de la page, filtres effacés**.
   - **Correction :**
     - garder les filtres et la recherche dans l'adresse ;
     - restaurer la position au retour ;
     - ne remonter en haut que si l'on change de marque.
5. **Des filtres qui mènent à 0, sans nombre ni bouton pour tout effacer.**
   - **Les types sont une liste fixe :** pour SYM, qui ne fait que des scooters, **5 types sur 6 donnent 0**. Une partie de ces types ne peut même jamais rien trouver (erreur de correspondance dans le code).
   - **Cylindrée :** les tranches « 125-560 » et « 560-1300 » ne correspondent pas aux permis.
   - **Honda (1 modèle)** affiche quand même 3 menus et une recherche.
   - **Il manque aussi :**
     - « Réinitialiser » quand il n'y a aucun résultat ;
     - le nombre de filtres actifs sur le bouton « Filtres ».
   - **Le bouton « Appliquer »** n'applique rien : les filtres s'appliquent déjà en direct.
   - **Correction :**
     - options tirées des modèles de la marque, avec leur nombre ;
     - pas de filtres en dessous d'environ 5 modèles ;
     - « Voir N modèles » au lieu d'« Appliquer ».
6. **Sur téléphone, impossible de comparer.**
   - **Le défaut :** une carte fait environ 470 px de haut, donc il faut 4 300 px pour voir les 9 SYM, sans résumé.
   - **Correction :**
     - cartes en ligne plus compactes ;
     - un résumé en tête, avec le texte déjà prêt pour Google : « 9 modèles · 5 850 – 24 000 DT · 125-399 cm³ » ;
     - un accès au Comparateur.

### 🟢 Mineurs (P3)
- **« Disponible en Tunisie » est invisible :** `?available_in_tunisia=true` ne montre qu'1 modèle Yamaha sur 3, sans le dire ni permettre de changer.
- **Le haut de la page :**
  - photo de motocross générique, la même pour une marque de scooters ;
  - le logo de la marque est prévu dans le code mais jamais affiché ;
  - la photo de ce haut de page est téléchargée sur téléphone (57 Ko) alors qu'elle n'y est pas visible.
- **Images trop lourdes :** servies en 800 à 1200 px pour un cadre de 280 px. Les 9 images SYM pèsent 457 Ko.
- **Panneau de filtres sur téléphone :**
  - pastilles de 38 px de haut, croix de 36 px sans nom ;
  - Échap ne le ferme pas, le focus clavier reste derrière ;
  - une pastille de type ferme le panneau, mais pas celles d'année ou de cylindrée.
- **Ordinateur, structure et focus :**
  - menus sans nom pour les lecteurs d'écran, focus presque invisible ;
  - texte d'exemple de la recherche à 2,8:1 ;
  - titres H1 puis H3 directement, sans H2 ;
  - une zone principale (`main`) dans une autre.
- **Données incohérentes :**
  - « cc », « CC » et « cm³ » mélangés ;
  - « 10 900 » sans « DT » chez Peugeot ;
  - catégories en anglais.
- **Code :** imports inutiles, dont une ligne d'import vide laissée par mon nettoyage de la PR #80 (sans effet).

---

## 4. Notes heuristiques (0 à 4)
| Heuristique | Note | Raison |
|---|---|---|
| Visibilité de l'état | 2 | pas de nombre de résultats, ni de filtres actifs ; disponibilité invisible |
| Correspondance avec le monde réel | 2 | tranches de cylindrée hors permis, catégories en anglais, prix absent écrit de 3 façons |
| Contrôle et liberté | 1 | pas de « tout effacer », filtres et position perdus au retour |
| Cohérence et standards | 2 | faux tri ; carte différente de celle des annonces ; squelette de chargement d'un autre type de carte |
| Prévention des erreurs | 1 | choix menant à 0, sans nombre |
| Reconnaissance plutôt que rappel | 2 | filtres cachés sur téléphone sans état ; comparer oblige à retenir des chiffres sur 4 300 px |
| Flexibilité et efficacité | 2 | recherche excellente ; pas de tri, pas d'accès au comparateur |
| Esthétique et sobriété | 2 | propre, mais 9 boutons orange en concurrence avec 9 prix orange |
| Aide face aux erreurs | 2 | « Réessayer » : bien ; aucun résultat sans solution |
| Aide et documentation | 2 | rien sur « prix du neuf » ni sur qui vend ; le texte utile est caché |
| **Total** | **18 / 40** | **Faible : la base technique est bonne, la présentation ne sert pas l'acheteur** |

**Verdict :** la page reprend le modèle générique du site (bandeau orange avec une photo de motocross, cartes blanches, petits libellés en majuscules, un bouton orange par carte). Rien n'y dit « SYM » ni « acheteur de scooter en Tunisie ». Les filtres sont dimensionnés pour des centaines de modèles, alors qu'une marque en compte 1 à 9.

---

## 5. Corrections proposées (une PR par ligne)
1. 🔴 **Tablette et petit ordinateur :**
   - plus de débordement ;
   - grille à 2, 3 puis 4 colonnes selon la largeur ;
   - cartes lisibles.
2. 🔴 **Le faux tri sur téléphone :** le retirer, ou en faire un vrai tri (prix, cylindrée, puissance).
3. 🔴 **La carte :**
   - prix lisible ;
   - étiquette de disponibilité ;
   - cc · ch · kg avec le permis ;
   - le vendeur ;
   - plus de bouton orange.
4. 🟠 **Retour depuis une fiche :** filtres et position gardés.
5. 🟠 **Filtres utiles :**
   - options tirées des modèles, avec leur nombre ;
   - « Réinitialiser » ;
   - pas de filtres sous 5 modèles.
6. 🟠 **Résumé en tête de page** (le texte déjà prêt pour Google) et accès au Comparateur.
7. 🟢 **Finitions :**
   - logo de la marque dans le haut de page ;
   - photo du haut de page non téléchargée sur téléphone ;
   - images à la bonne taille ;
   - panneau de filtres accessible ;
   - une seule requête au lieu de deux ;
   - code nettoyé.
