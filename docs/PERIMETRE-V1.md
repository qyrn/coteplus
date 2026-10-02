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

- Badge de prix moyen sur toutes les cartes affichées, où qu'elles soient sur le site (collection, toutes les cartes, marché, paquets, échanges, profils, guilde, vitrines, messages)
- Exception : aucune info ajoutée sur les routes de bataille (`/battle`, duels, parties), pour ne pas toucher au jeu en cours
- Bonnes affaires sur le marché : écart de chaque enchère avec le prix moyen ("−35 % vs moyenne") et tri par écart
- Source : `GET /api/marketplace/cards/{id}/sales?scope=summary`, champ `summary[rareté].average`
- Chargement à l'apparition à l'écran, pas de chargement global au démarrage
- Totaux par côté dans un échange (prix moyens plus wikibidous)
- Récap de valeur d'un paquet ouvert

### Lot 2 : paquets

- Alerte stock plein : badge sur l'icône, notification au seuil choisi, alarmes posées à partir d'une seule lecture de `/pulls`
- Drop rate : répartition des raretés tirées, lue sur l'écran de révélation, stockée par compte, remise à zéro possible

### Lot 3 : marché et enchères

- Étoile "Suivre" sur le marché, suivi automatique des enchères où le joueur a misé
- Popup "Mes enchères suivies" triée par fin
- Rappel 5 min avant la fin par défaut, pas de délai sous 1 min
- Zéro requête : heure de fin lue dans le DOM
- Bilan du marché : gains des ventes, dépenses des achats, prix obtenu comparé au prix moyen, à partir de l'historique du marché

### Lot 4 : collection

- Copie locale de la collection, synchronisée sur clic, coût affiché avant
- Export CSV (séparateur `;`, BOM, protection contre l'injection de formules) et JSON
- Vue tableau avec filtres et tris absents du site (ATK, DEF, doublons, date d'obtention)
- Filtre "Non possédées" sur `/global-collection`
- Valeur de la collection dans le temps : total et détail par rareté enregistrés à chaque synchro, courbe dans le popup
- Garde-fou avant défausse : avertissement si la carte est le dernier exemplaire, en favori, ou vaut nettement plus aux enchères que le wikibidou rendu. Le joueur confirme ou annule lui-même
- "Meilleures ventes" : cartes de la collection classées par prix moyen, avec le nombre de ventes récentes (liquidité), le nombre d'exemplaires et un repère "doublon" pour vendre sans perdre la carte. Aucun bouton de mise en vente : le joueur vend depuis le site

### Lot 5 : échanges

- Évaluer une offre reçue : impact sur la collection, valeur de chaque côté, différence avec l'offre précédente pour une contre-offre
- Comparer avec un ami : mes doublons qu'il n'a pas, ses doublons qui me manquent
- Proposition d'échange équilibré affichée comme une liste à cocher, que le joueur reproduit lui-même dans le site
- Souhaits de la guilde face à mes doublons : "X cherche telle carte, tu l'as en double". Le don se fait depuis le site

### Lot 6 : confort

- Mode compact, bouton Wikipédia, masquage ATK et DEF
- Son quand le compteur de notifications du site augmente
- Images de remplacement pour les cartes sans image (Wikidata, Commons)
- Familles de cartes avec import et export
- Restyle "full-art" des cartes (désactivable)
- Copie d'une carte en PNG

## Hors v1

- Synchronisation des réglages entre appareils

## Points vérifiés sur une vraie session

Détails dans `ANALYSE.md`.

- `snapshot_rarity` : présent dans les échanges et les enchères, absent de la collection
- `/api/my-collection/stats` : `{total, rarityCounts, tagOptions}`
- Prolongation d'enchère : une mise dans les 10 dernières secondes ajoute 60 secondes. Un rappel 5 min avant la fin n'est pas concerné
- Collection d'un non-ami : lisible, même format que la sienne

Reste à vérifier : le compte à rebours de `/pulls` après une ouverture depuis un stock plein (10/10). Le joueur ouvre un paquet lui-même et relève le compte à rebours affiché juste après.
