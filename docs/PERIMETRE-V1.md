# Périmètre de la v1

Synthèse de `ANALYSE.md`, `kzfamily-inventory.md` et des specs de `docs/ideas/`.

L'extension remplace kzfamily : elle couvre toutes ses fonctions autorisées, et le joueur désinstalle kzfamily. L'extension ne touche pas aux autres extensions installées.

## Principe

L'extension lit, range et affiche. Elle ne joue jamais à la place du joueur. Sa seule écriture : les étiquettes de la collection, posées uniquement quand le joueur clique « Appliquer » après avoir vu le détail.

Exclu pour de bon :
- ouvrir des paquets (un par un, "Tout ouvrir" ou auto) ;
- passer la vérification humaine ;
- miser, mettre en vente, défausser ;
- créer, accepter, refuser un échange, ou pré-remplir un formulaire du site ;
- remplacer `fetch` ou `XMLHttpRequest` dans la page ;
- appeler Supabase directement, sauf pour le classement auto (lecture de la collection et des étiquettes, pose et retrait des étiquettes qu'il gère) ;
- conserver ou transmettre la session du joueur : elle est lue dans le cookie au moment du clic, puis oubliée ;
- injecter un lien sponsorisé.

## Limite anti-automatisation du site

Constaté le 3 octobre 2026 : après environ 1 300 requêtes de prix en quelques minutes (bouton "Charger tous les prix", retiré depuis), le site répond 403 avec le message "Trop de requêtes automatisées. L'automatisation n'est pas autorisée" et un code qui commence par `automation`.

Règles qui en découlent :
- aucun chargement en masse, quel que soit le bouton ou le réglage ;
- au plus 2 requêtes en parallèle, 400 ms entre deux requêtes ;
- au premier 403 `automation`, toutes les requêtes vers le site sont suspendues une heure, dans tous les onglets ;
- les fonctions qui portent sur toute la collection (meilleures ventes, valeur totale) n'utilisent que les prix déjà en cache, obtenus en naviguant normalement.

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
3. Pour le classement auto seulement : l'API REST Supabase du site, avec la clé publique trouvée dans ses scripts et la session lue dans le cookie `sb-<projet>-auth-token`. La collection entière se lit en 4 requêtes de 1 000 lignes envoyées ensemble, au lieu de 77 pages de l'API du site. Les écritures partent par lots de 500 ajouts ou 100 retraits.

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
- Popup "Mes enchères suivies" triée par fin. Une enchère terminée disparaît du popup sauf si elle est gagnée (ou encore en tête, le temps que le site confirme)
- Rappel 5 min avant la fin par défaut, pas de délai sous 1 min
- Zéro requête : heure de fin lue dans le DOM
- Souhait vers enchères : quand le joueur ajoute une carte à sa liste de souhaits (bouton "Ajouter à la liste de souhaits"), l'extension attend que le site confirme l'ajout (le bouton passe à "Retirer de la liste de souhaits"), puis ouvre `/marketplace` avec un panneau listant les enchères en cours de cette carte. Les enchères dont le prix à payer est le plus bas par rapport au prix moyen de leur rareté sont encadrées. Si aucune enchère n'existe, le panneau le dit. Réglage pour désactiver la redirection
- Source : `GET /api/marketplace?page=1&limit=50&sort=recent&q={titre}`, filtré sur `card_id`, prix à payer = `effective_bid` ou, à défaut, `current_bid` puis `base_amount`, comparé au prix moyen de `snapshot_rarity`
- Bilan du marché : gains des ventes, dépenses des achats, prix obtenu comparé au prix moyen, à partir de l'historique du marché

### Lot 4 : collection

- Copie locale de la collection, synchronisée sur clic, coût affiché avant
- Export CSV (séparateur `;`, BOM, protection contre l'injection de formules) et JSON
- Vue tableau avec filtres et tris absents du site (ATK, DEF, doublons, date d'obtention)
- Filtre "Non possédées" sur `/global-collection`
- Valeur de la collection dans le temps : total et détail par rareté enregistrés à chaque synchro, courbe dans le popup
- Garde-fou avant défausse : avertissement si la carte est le dernier exemplaire, en favori, ou vaut nettement plus aux enchères que le wikibidou rendu. Le joueur confirme ou annule lui-même
- "Meilleures ventes" : cartes de la collection classées par prix moyen déjà en cache (aucun chargement en masse), avec le nombre de ventes récentes (liquidité), le nombre d'exemplaires et un repère "doublon" pour vendre sans perdre la carte. Aucun bouton de mise en vente : le joueur vend depuis le site
- Classement auto en étiquettes, depuis un panneau de `/collection` : #Doublon sur tous les exemplaires d'une carte possédée plusieurs fois, #À vendre au-dessus d'une cote réglable (100 W par défaut, jamais sur un favori, rien si la cote n'est pas en cache), et un groupe par catégorie Wikipédia (#Personnes, #Lieux, #Œuvres, #Nature, #Espace, #Sport, #Homonymie). Aperçu obligatoire avant d'appliquer. Seules ces étiquettes sont ajoutées ou retirées, celles du joueur ne sont jamais touchées. Pas d'étiquette par rareté : le site trie et filtre déjà par rareté

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

- Paquets : après une ouverture depuis un stock plein (10/10), le compte à rebours repart de zéro au moment de l'ouverture (environ 10 min, relevé par le joueur le 3 octobre 2026). Le temps passé à 10/10 est donc perdu, ce qui justifie l'alerte "stock plein"
