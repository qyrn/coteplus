# Périmètre de la v1

Synthèse de `ANALYSE.md`, `kzfamily-inventory.md` et des specs de `docs/ideas/`.

L'extension remplace kzfamily : elle couvre toutes ses fonctions autorisées, et le joueur désinstalle kzfamily. L'extension ne touche pas aux autres extensions installées.

## Principe

L'extension lit, range et affiche. Elle ne joue jamais à la place du joueur.

Exclu pour de bon :
- ouvrir des paquets (un par un, "Tout ouvrir" ou auto) ;
- passer la vérification humaine ;
- miser, mettre en vente, défausser ;
- créer, accepter, refuser un échange, ou pré-remplir un formulaire du site ;
- remplacer `fetch` ou `XMLHttpRequest` dans la page ;
- appeler Supabase directement ;
- injecter un lien sponsorisé.

## Stack

- WXT 0.21, Manifest V3, Chrome et Firefox
- TypeScript strict, Biome, Vitest, pnpm
- Content script dans le monde isolé uniquement, aucun script injecté dans la page
- Background (service worker sous Chrome) pour les alarmes, les notifications et le badge
- Popup pour les panneaux, page d'options pour les réglages
- Stockage : `chrome.storage.local`, jamais le `localStorage` du site

## Accès aux données

Ordre de préférence :
1. Ce qui est affiché dans le DOM.
2. Une requête `GET` de l'extension vers l'API du site, avec la session du joueur, déclenchée par une action du joueur ou par l'affichage d'une page.

Toutes les requêtes passent par une seule file :
- 2 requêtes en parallèle au maximum ;
- pause entre deux requêtes ;
- arrêt et nouvel essai plus tard sur une erreur 429 ou 5xx ;
- cache avec durée de vie, 24 h pour les prix.

Le DOM ne contient aucun id de carte. Le lien entre une carte affichée et ses données se fait par le titre (`h3`), normalisé.

## Fonctions de la v1, par lot

### Lot 0 : socle

- Projet WXT, lint, typecheck, tests, build Chrome et Firefox
- Réglages typés, appliqués sans recharger la page
- Détection des changements de route de l'app Next.js
- Repérage des cartes dans le DOM (titre, rareté via `glow-*`, shiny)
- File de requêtes et cache

### Lot 1 : prix moyens

- Badge de prix moyen sur toutes les cartes affichées : `/collection`, `/global-collection` (liste et carte ouverte), `/marketplace` (liste et détail), écran de révélation de `/pulls`, échanges
- Source : `GET /api/marketplace/cards/{id}/sales?scope=summary`, champ `summary[rareté].average`
- Chargement à l'apparition à l'écran, pas de chargement global au démarrage
- Totaux par côté dans un échange (prix moyens plus wikibidous)
- Récap de valeur d'un paquet ouvert

### Lot 2 : paquets

- Alerte stock plein : badge sur l'icône, notification au seuil choisi, alarmes posées à partir d'une seule lecture de `/pulls`
- Drop rate : répartition des raretés tirées, lue sur l'écran de révélation, stockée par compte, remise à zéro possible

### Lot 3 : rappel d'enchères

- Étoile "Suivre" sur le marché, suivi automatique des enchères où le joueur a misé
- Popup "Mes enchères suivies" triée par fin
- Rappel 5 min avant la fin par défaut, pas de délai sous 1 min
- Zéro requête : heure de fin lue dans le DOM

### Lot 4 : collection

- Copie locale de la collection, synchronisée sur clic, coût affiché avant
- Export CSV (séparateur `;`, BOM, protection contre l'injection de formules) et JSON
- Vue tableau avec filtres et tris absents du site (ATK, DEF, doublons, date d'obtention)
- Filtre "Non possédées" sur `/global-collection`
- "Meilleures ventes" : cartes de la collection classées par prix moyen, avec le nombre de ventes récentes (liquidité), le nombre d'exemplaires et un repère "doublon" pour vendre sans perdre la carte. Aucun bouton de mise en vente : le joueur vend depuis le site

### Lot 5 : échanges

- Évaluer une offre reçue : impact sur la collection, valeur de chaque côté, différence avec l'offre précédente pour une contre-offre
- Comparer avec un ami : mes doublons qu'il n'a pas, ses doublons qui me manquent
- Proposition d'échange équilibré affichée comme une liste à cocher, que le joueur reproduit lui-même dans le site

### Lot 6 : confort

- Mode compact, bouton Wikipédia, masquage ATK et DEF
- Son quand le compteur de notifications du site augmente
- Images de remplacement pour les cartes sans image (Wikidata, Commons)
- Familles de cartes avec import et export
- Restyle "full-art" des cartes (désactivable)
- Copie d'une carte en PNG

## Hors v1

- Synchronisation des réglages entre appareils

## Points à vérifier sur une vraie session

À faire en lecture seule, compte connecté, avant de coder les lots concernés :
- présence de `snapshot_rarity` dans `/api/trades` et `/api/my-collection` ;
- contenu exact de `/api/my-collection/stats` ;
- prolongation d'une enchère après une mise tardive ;
- comportement de `packs_last_regen_at` après une ouverture ;
- réponse de `/api/profile/{pseudo}/collection` pour un non-ami.
