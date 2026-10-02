# Aide aux échanges : spécification v1

Relevé fait le 2 octobre 2026 à partir des bundles de `reference/site-chunks/` et du code de `reference/kzfamily-4.27.7/`. Aucune requête réseau, aucun navigateur. Les extraits cités sont minifiés : les noms de variables courts (`e`, `r`, `t`) n'ont pas de sens propre.

## En bref

1. L'extension lit les collections (la mienne, celle d'un ami) et l'historique des échanges, puis affiche des comparaisons et des estimations.
2. Elle ne crée, n'accepte, ne contre et ne refuse jamais un échange. Elle ne remplit pas non plus la modale d'échange du site.
3. Trois fonctions v1, par ordre de priorité : évaluer une offre reçue, comparer mes doublons avec les manques d'un ami (et l'inverse), proposer un échange équilibré sous forme de liste à reproduire à la main.
4. Le serveur fournit déjà les drapeaux utiles (`owned_by_peer`, `owned_by_viewer`, filtres de souhaits). Les doublons, eux, doivent être calculés côté extension en regroupant les lignes par `card.id`.
5. La valeur d'une carte vient du résumé de ventes `/api/marketplace/cards/{id}/sales?scope=summary` (moyenne, dernière vente, nombre de ventes par rareté).

## La ligne rouge

Règle 3 du site (`reference/page_rules.html`) :

> Interdiction d'utiliser des bots, des scripts, des macros, des émulateurs automatisés ou tout outil visant à jouer, ouvrir des paquets, échanger ou interagir à votre place.
> Pas de modification, de rétro-ingénierie ou d'interception du trafic du Service pour obtenir un avantage.

Règle 8 : « Ne perturbez pas le Service (surcharge, attaques, contournement des limites techniques). »

Ce que l'extension fait :
- requêtes `GET` sur les mêmes endpoints que le site, uniquement après un clic de l'utilisateur, avec un débit limité ;
- affichage dans un panneau à elle (Shadow DOM), à côté des éléments du site ;
- surlignage visuel de cartes déjà affichées par le site ;
- copie d'un titre dans le presse-papiers sur clic.

Ce qu'elle ne fait jamais :
- `POST /api/trades`, `PATCH /api/trades/{id}`, ou tout autre appel en écriture ;
- clic simulé, saisie simulée, `dispatchEvent` sur un élément du site ;
- monkeypatch de `window.fetch` pour lire les réponses du site (kzfamily le fait dans `bridge/core.js`, ce qui ressemble à de « l'interception du trafic ») ;
- lecture du jeton d'auth Supabase.

### Pré-remplir la modale d'échange : non

La modale du site accepte des cartes présélectionnées, mais seulement via des props React internes :

`0tpqxkgbnq21..js` : `function({friendUsername:e,friendProfileId:t,preselectedFriendCard:l,preselectedFriendCards:d,parentTradeId:u,preselectedMyCards:x=ee,preselectedMyWikibidous:m=0,preselectedFriendWikibidous:v=0,onClose:w,onSent:k})`

Pour s'en servir, l'extension devrait soit cliquer à la place du joueur sur les cartes de la grille (interaction automatisée, règle 3 alinéa 1), soit injecter du code dans le monde de la page pour appeler ce composant ou modifier l'état React (modification du Service, règle 3 alinéa 3). Les deux options franchissent la ligne. Recommandation ferme : ne pas pré-remplir, même partiellement, même le champ wikibidous. L'extension s'arrête à une liste à cocher et à un surlignage ; le joueur clique lui-même.

Point d'attention : le site place une vérification humaine sur l'envoi et l'acceptation des échanges (`"human_verification_required"===e.code` après `POST /api/trades` et après `PATCH`). C'est un signal clair que les échanges automatisés sont surveillés.

## Fonctionnement actuel de /trades

### Page /trades

Chunk : `0f3.i7kafhjm7.js`.

- Un seul appel au chargement : `let e=await fetch("/api/trades");e.ok&&k((await e.json()).trades??[])`.
- Trois onglets calculés côté client à partir de la même liste :
  - Reçues : `e.recipient_id===C&&"pending"===e.status`
  - Envoyées : `e.initiator_id===C&&"pending"===e.status`
  - Historique : `function P(e){return"pending"!==e.status}`
- Bouton « Proposer un échange » : ouvre « Choisir un ami » (liste tirée de `/api/friends`, filtrée sur `"accepted"===e.status`), puis la modale de création.
- Statuts et libellés : `C={pending:"En attente",accepted:"Accepté",declined:"Refusé",cancelled:"Annulé",countered:"Contre-offre faite",expired:"Expiré"}`.
- Actions sur une offre reçue en attente : Accepter, Contre-offre, Refuser. Sur une offre envoyée en attente : « Annuler l'offre ». Toutes passent par `` fetch(`/api/trades/${e.id}`,{method:"PATCH",...,body:JSON.stringify({action:r})}) `` avec `r` parmi `accept`, `decline`, `cancel`.
- Modale « Détail de l'échange » : affiche les deux côtés en cartes complètes, aucune autre donnée.

### Forme d'un échange (GET /api/trades)

Réponse : `{ trades: Trade[] }`. Champs lus par le site (`0f3.i7kafhjm7.js`, `0glsn_q4kqq2b.js`) :

| Champ | Usage relevé |
|---|---|
| `id` | clé, URL du PATCH |
| `status` | `pending`, `accepted`, `declined`, `cancelled`, `countered`, `expired` |
| `initiator_id`, `recipient_id` | sens de l'offre |
| `initiator`, `recipient` | objets profil : `id`, `username`, `avatar_url`, `avatar_pos_x`, `avatar_pos_y` |
| `items[]` | `user_card_id`, `card_id`, `offered_by`, `card` (objet carte avec `wikipedia_title`, `rarity`, image) |
| `initiator_wikibidous`, `recipient_wikibidous` | montants, `?? 0` côté client |
| `parent_trade_id` | présent sur une contre-offre (`e.parent_trade_id?...children:"Contre-offre"`) |
| `created_at` | date affichée |

Répartition des cartes par côté : `U=(e.items??[]).filter(e=>e.offered_by===t)` (les miennes), `T=(e.items??[]).filter(e=>e.offered_by===L)` (celles de l'autre).

Variantes :
- `GET /api/trades?active=1` : utilisé pour savoir quelles cartes sont déjà engagées (`buildPendingTradeCardMap`, voir plus bas).
- `GET /api/trades/{id}` : aucune lecture trouvée dans les bundles. Seul le `PATCH` existe côté client. Pour un échange précis, on filtre la liste.
- `GET /api/chat/{peerId}` renvoie aussi les échanges avec ce joueur : `d(r.messages??[]),m(r.trades??[])` (`0glsn_q4kqq2b.js`).

kzfamily lit en plus `item.snapshot_rarity` sur les items (`bridge/core.js` : `rarity: item?.snapshot_rarity || card?.rarity`). Le site, lui, n'utilise que `card.rarity`. À vérifier en conditions réelles.

### Modale de création

Chunk : `0tpqxkgbnq21..js` (module `273271`), ouverte depuis `/trades`, `/friends`, la page de guilde, la fiche d'une carte du catalogue et le fil de messages.

Deux onglets : « Mes cartes » et « Cartes de {pseudo} ». Pour chacun :
- recherche texte (au moins 3 caractères), filtre rareté, filtre étiquette, filtre souhaits ;
- pagination par 50 : `rB=Math.max(1,Math.ceil(U/50))` ;
- clic sur une carte = ajout à la sélection ; clic sur une carte sélectionnée = retrait.

Badges affichés par le site :
- dans mes cartes : « Possédée par {pseudo} » quand `owned_by_peer` est vrai ;
- dans ses cartes : « Possédée » quand `owned_by_viewer` est vrai.

Garde-fous côté client avant l'envoi :
- `"Sélectionnez au moins une carte ou des wikibidous à échanger"` ;
- `eq.length+eD.length>100` : 100 cartes au plus, deux côtés confondus ;
- `e2>1e4||e5>1e4` : 10 000 wikibidous au plus par joueur ;
- `e2>e6` : solde insuffisant (solde lu sur `/api/wikibidous`, champ `balance`).

Verrou des cartes déjà engagées. Une carte dont le `card_id` figure dans une de mes offres en attente est grisée, toutes copies confondues :

`02yxms5qtflzx.js` : `buildPendingTradeCardMap ... if("pending"!==n.status||!n.items)continue; ... if(l.offered_by!==t)continue; ... r.set(l.card_id,[i])`

Côté ami, le serveur renvoie directement la liste : `e_(new Set(e.pendingTradeCardIds??[]))`.

### Corps de POST /api/trades

`0tpqxkgbnq21..js` :

```
let e=[...eq.map(e=>({user_card_id:e,card_id:rb(eJ,e),offered_by:rx})),
       ...eD.map(e=>({user_card_id:e,card_id:rb(eY,e),offered_by:t}))],
r=await fetch("/api/trades",{method:"POST",headers:{"Content-Type":"application/json",...(0,j.wikiCalendarTzFetchHeaders)()},
  body:JSON.stringify({recipient_id:t,items:e,initiator_wikibidous:e2,recipient_wikibidous:e5,parent_trade_id:u??void 0})})
```

Donc :

```
{
  recipient_id: string,          // id profil de l'autre joueur
  items: { user_card_id, card_id, offered_by }[],
  initiator_wikibidous: number,  // ce que j'offre
  recipient_wikibidous: number,  // ce que je demande
  parent_trade_id?: string       // seulement pour une contre-offre
}
```

Les cartes sont désignées par `user_card_id` (une copie précise), pas seulement par `card_id`. Documenté ici pour comprendre le modèle, jamais pour l'appeler.

### Contre-offres

- Bouton « Contre-offre » sur une offre reçue : ouvre la même modale avec `parentTradeId:e.id` et la sélection de l'offre d'origine déjà en place (`preselectedMyCards:V,preselectedFriendCards:B,preselectedMyWikibidous:M,preselectedFriendWikibidous:D`).
- L'envoi est un nouveau `POST /api/trades` avec `parent_trade_id`. L'offre d'origine passe vraisemblablement au statut `countered` (libellé « Contre-offre faite »).
- Quand une carte présélectionnée n'a pas de `user_card_id`, le site la cherche par titre (`/api/my-collection?page=0&stats=0&q={titre}`) et prévient si plusieurs raretés existent : « il peut exister en plusieurs raretés ».

## Lire les collections et les listes de souhaits

### Ma collection : GET /api/my-collection

Paramètres (helper `appendMyCollectionFilterParams`, `02yxms5qtflzx.js`) : `sort` (`rarity`, `name`, `starred`, `added`), `q`, `rarity` (répétable), `tag_id`, `untagged=1`, `wishlisted_by={pseudo}`, `page` (base 0), `stats=0|1`.

Paramètre propre à la modale d'échange : `r.set("owned_by",e)` avec `e` = pseudo de l'ami. Chaque ligne revient alors avec `owned_by_peer` : `eU(e=>E(e,r,e=>e.owned_by_peer))`.

Réponse : `{ collection: UserCard[] }`. Total et étiquettes via `/api/my-collection/stats` (`total`, `tagOptions`).

Forme d'une ligne `UserCard` (helper `Y` de `0tpqxkgbnq21..js` et vitrine de `0h28z-agxfm9k.js`) : `id` (= `user_card_id`), `user_id`, `card_id`, `count`, `starred`, `obtained_at`, `snapshot_rarity`, `snapshot_atk`, `snapshot_def`, `is_shiny`, `tags`, `card`.

La rareté réelle d'une copie est celle du snapshot :

`02yxms5qtflzx.js` : `effectiveCardListItem ... rarity:e.snapshot_rarity??t.rarity,atk:e.snapshot_atk??t.atk,def:e.snapshot_def??t.def,is_shiny:!0===e.is_shiny`

### Collection d'un autre joueur : GET /api/profile/{username}/collection

Uniquement dans la modale d'échange (`0tpqxkgbnq21..js`) :

```
r.set("page",String(ex-1)),r.set("sort","rarity"),1===ex?r.set("stats","1"):r.set("stats","0"),
ep&&r.set("q",ep), ...r.append("rarity",e), ey&&r.set("tag_id",ey),
e$&&r.set("wishlisted_by_me","1"), r.set("pending","1");
fetch(`/api/profile/${encodeURIComponent(e)}/collection?${r.toString()}`)
```

Réponse : `collection[]` (lignes avec `owned_by_viewer`), `total`, `pendingTradeCardIds[]`, `tagOptions[]` (`id`, `user_id`, `name`, `color`, `created_at`, `cardCount`). Pagination par 50 : `rO=Math.max(1,Math.ceil(ed/50))`.

Le chunk de la page `/profile/{username}` n'est pas dans `reference/`. La route existe (liens `` `/profile/${a}` `` dans `0v1y5348bj_nk.js`, `` `/profile/${e.profile.username}?from=guild` `` dans `02xn_euij_-f2.js`) mais son contenu et ses appels sont inconnus.

### Amis et membres de guilde

- `GET /api/friends` → `{ friendships[], counts? }`. Chaque amitié : `status` (`accepted`, `pending`), `requester_id`, `addressee_id`, `requester`, `addressee` (profils `id`, `username`, `avatar_url`, `avatar_pos_x`, `avatar_pos_y`). L'ami = `r.requester_id===e?r.addressee:r.requester` (`0f3.i7kafhjm7.js`).
- `GET /api/guilds/members?limit=50&offset={n}` → `members[]` (`user_id`, `profile`), `total`, `has_more`. La page de guilde ouvre aussi la modale d'échange (`02xn_euij_-f2.js` : `friendUsername:ey.username,friendProfileId:ey.id`), donc un membre de guilde est un partenaire possible.

### Listes de souhaits

Liste personnelle : table Supabase `wishlist_items` (`user_id`, `card_id`), écrite par le catalogue (`10-~5dwf8ta~s.js` : `r.from("wishlist_items").insert({user_id:er,card_id:e.id})`). Pour la lire, pas besoin de Supabase :
- mes cartes que l'ami souhaite : `/api/my-collection?wishlisted_by={pseudo}` ;
- ses cartes que je souhaite : `/api/profile/{pseudo}/collection?wishlisted_by_me=1` ;
- mes souhaits complets : `/api/cards?wishlist=1`, ou `wishlistCardIds` dans la réponse de `/api/cards`.

Souhait de guilde : un seul souhait par membre (`PUT /api/guilds/wishlist` avec `{card_id}`), lu via `GET /api/guilds/home` → `wishlist[]` avec `card`, `username`, `is_self`, `can_donate`, `owned_copy_ids`, `recipient_received_today`, plus `my_wishlist`. C'est un signal utile (« ce membre cherche cette carte et tu en as une copie »), mais le don passe par un autre circuit (`/api/guilds/wishlist/donate`) que l'extension ne touche pas.

### Catalogue : qui possède quoi

`GET /api/cards` renvoie déjà, page par page : `ownedCardIds`, `friendOwners` (par `card_id`, liste de `{id, username}`), `friendPendingOfferKeys` (clés `"{friendId}:{cardId}"`), `wishlistCardIds`, `rarityCounts`. Le site affiche « Possédée » et le pseudo du premier ami propriétaire. Source intéressante pour une v2 (« qui parmi mes amis a cette carte ? »).

## Comment identifier un doublon

Il n'existe pas de compteur fiable côté serveur. Constats :
- `owned_copies` n'apparaît que dans la réponse de `packs/open` (`0wsn99n12v4d_.js` : `w(t.owned_copies??null)`).
- Chaque ligne de `user_cards` est une copie physique avec son propre `id`, sa rareté figée (`snapshot_rarity`) et son éventuel `is_shiny`.
- La page collection calcule le nombre de copies en comptant les lignes chargées qui partagent le même `card.id` : `count:e.filter(e=>e.card.id===eo.card.id).length` (`14yi4kchm5v2m.js`). Ce calcul ne porte que sur la page affichée (50 lignes), donc il sous-estime quand les copies sont sur des pages différentes.
- La défausse confirme le modèle : « Vous en avez ${m}. Un exemplaire sera retiré définitivement. »

Définition retenue pour l'extension :
- regrouper toutes les lignes de la collection complète par `card_id` ;
- `copies(card_id)` = nombre de lignes ;
- garder une copie « à conserver » par `card_id` : la plus haute rareté effective, puis `is_shiny`, puis `starred` ;
- les autres copies sont des « doubles échangeables », sauf exclusions (voir cas limites).

La notion de possession utilisée par le site pour « Possédée » est au niveau `card_id`, pas au niveau (carte, rareté) : `E(e,r,t)` ajoute `a.card?.id`. Une carte en R ne complète donc pas « autre chose » qu'une carte en SR du même article. L'extension suit la même règle pour « manque à l'ami ».

## Estimer la valeur d'une carte

### Sources disponibles

1. Résumé de ventes, accessible à tous (utilisé dans la modale « Mettre aux enchères », `0~73pc-5lk-eg.js`) :

   `` fetch(`/api/marketplace/cards/${e}/sales?scope=summary`) ... o(a.summary??{}) ... n?.[a] `` puis affichage de `i.count`, `i.latest`, `i.average`.

   Forme : `{ summary: { [rarity]: { count, latest, average } } }`. kzfamily lit en plus un éventuel `wikipedia_title` à la racine.

2. Historique complet, réservé au Pro (`0~r~p2xs9m7lk.js`) : `GET /api/marketplace/cards/{id}/sales` → `{ sales: [{ rarity, settled_at, final_price }] }`, ou erreur `"pro_required"===n.code`. Pas nécessaire en v1.

3. Enchères en cours (`/api/marketplace`, champ `current_bid`) : un prix demandé, pas un prix payé. Non retenu.

4. Plancher : défausser une carte rapporte 1 wikibidou (`0_myzl748rjvi.js` : `" 1 wikibidou"`). Aucune carte ne vaut moins dans les faits.

La table `RARITY_CONFIG` (`033.ky6t6s0~i.js`) contient un champ `multiplier` (C 0,25 à L 1), mais aucun usage trouvé dans les bundles. Ne pas s'en servir comme prix.

### Règle de valeur proposée

Pour une copie (card_id, rareté effective) :
- si le résumé a au moins une vente pour cette rareté : valeur = `average`, avec `latest` et `count` affichés à côté ;
- sinon : « sans prix », avec en indication la médiane des moyennes déjà en cache pour cette rareté, marquée « estimation par rareté » ;
- jamais 0 par défaut, jamais additionné en silence dans un total.

Indice de confiance par carte, affiché par une pastille : nombre de ventes (`count`). Les seuils (faible, moyen, bon) sont à fixer après observation de vraies données ; aucune valeur n'est proposée ici.

Les wikibidous d'un échange comptent pour leur valeur faciale.

Le résumé ne distingue pas les cartes brillantes (`is_shiny`, seulement en L). Une copie brillante est signalée « valeur probablement sous-estimée ».

## Ancrages DOM

Aucun attribut `data-*` exploitable sur les cartes ou les échanges (recherche sur tous les chunks). Les ancrages reposent sur des textes, des `aria-label`, des `title` et des classes Tailwind. Ils sont fragiles : chaque ancrage doit échouer sans casser la page (pas d'injection si l'élément n'est pas trouvé).

### Page /trades (`0f3.i7kafhjm7.js`)

| Élément | Sélecteur proposé |
|---|---|
| Titre de page | `h1` dont le texte est « Échanges » |
| Bouton de création | `button` contenant « Proposer un échange » |
| Onglets | `button` dont le texte commence par « Reçues », « Envoyées », « Historique » |
| Carte d'un échange | `.card-frame` qui contient `button[aria-label="Voir le détail de l'échange"]` |
| Contrepartie | `span` « De {pseudo} » ou « À {pseudo} » dans ce bloc |
| Puces de cartes | `span[title]` avec style `--color-rarity-*`, texte « R · Titre » (titre tronqué, titre complet dans `title`) |
| Boutons d'action | « Accepter », « Contre-offre », « Refuser », « Annuler l'offre » : ne jamais les toucher ni les recouvrir |
| Modale détail | portail sous `body`, `h2` « Détail de l'échange » |

Associer un bloc DOM à un échange de l'API : le site rend la liste filtrée de l'onglet actif dans l'ordre de l'API (`g.map(e=>(0,r.jsx)(z,{trade:e,...},e.id))`). On peut donc appliquer le même filtre que le site sur notre propre `GET /api/trades` et associer par index, puis vérifier que les titres des puces correspondent. En cas d'écart, ne rien afficher plutôt que d'afficher la mauvaise évaluation. kzfamily fait un score heuristique (titres et pseudos) dans `features/trades.js` (`tradeMatchScore`) ; l'index validé par les titres est plus simple.

Emplacement de notre bloc : en dernier enfant du `.card-frame`, après la rangée d'actions. Un bouton discret « Évaluer » qui déplie le panneau.

### Modale de création (`0tpqxkgbnq21..js`, portail sous `body`)

| Élément | Sélecteur proposé |
|---|---|
| Racine | `div.fixed.inset-0` contenant un `h2` qui commence par « Échanger avec » ou « Contre-offre avec » |
| Pseudo de l'ami | `h2 > span` (classe accent) |
| Résumé de sélection | texte « Moi : N cartes » et « {pseudo} : N cartes » |
| Onglets | boutons « Mes cartes » et « Cartes de {pseudo} » |
| Carte de la grille | `button` contenant le composant carte, titre dans un `h3` (`("h3",{...children:G.wikipedia_title})`, chunk `0qevgzlhsm_i8.js`) |
| Carte sélectionnée | même bouton, avec la classe `border-[var(--color-accent)]` et l'icône Check |
| Badges | `span[title="Dans ta collection"]`, `span[title^="Déjà dans la collection de"]` |
| Boutons de pied | « Annuler », « Envoyer l'offre », « Envoyer la contre-offre » : ne jamais les toucher |

Usage : surligner (contour) les boutons dont le `h3` correspond à une carte de la suggestion active, et afficher à côté de la modale une liste à cocher. Le surlignage ne couvre que la page visible de la grille (50 cartes) : la liste indique donc aussi le titre exact, avec un bouton « Copier » pour le coller dans la recherche de la modale.

### Page /friends (`0v1y5348bj_nk.js`)

- Ligne d'ami : `a[href^="/profile/"]` (pseudo dans l'URL).
- Bouton d'échange du site : `button[title="Proposer un échange"]`.
- Ancrage : un bouton « Comparer » à côté, qui ouvre le panneau de l'extension (pas la modale du site).

### Page de guilde (`02xn_euij_-f2.js`)

Liens `a[href^="/profile/"][href$="?from=guild"]`. Même bouton « Comparer » en v1.1.

## Fonctions v1, par ordre de priorité

### 1. Évaluer une offre reçue

Pourquoi en premier : peu de requêtes, valeur immédiate, protège contre les offres déséquilibrées (règle 6 du site sur les échanges honnêtes). kzfamily affiche déjà un total de prix par côté ; l'apport ici est l'impact sur ma collection.

UX, sur `/trades`, dans chaque offre en attente (reçue ou envoyée) :
- bouton « Évaluer » qui déplie un panneau en deux colonnes « Je donne » et « Je reçois » ;
- par carte : titre, rareté, valeur (moyenne, dernière vente, nombre de ventes), et des étiquettes :
  - côté « Je donne » : « dernière copie », « en favori », « brillante », « dans ta liste de souhaits » ;
  - côté « Je reçois » : « nouvelle pour toi », « tu l'as déjà (N copies) », « dans ta liste de souhaits » ;
- total par côté, en séparant le total des cartes avec prix et le nombre de cartes sans prix ;
- écart en wikibidous et en pourcentage du côté le plus gros ;
- pour une contre-offre (`parent_trade_id` présent et parent trouvé dans la liste) : « Ce qui a changé » (cartes ajoutées, retirées, montant modifié) par rapport à l'offre parente.

Le panneau ne contient aucun bouton d'action. Pas de « verdict » du type « accepte » : seulement des faits et un écart chiffré.

Flux de données :
1. `GET /api/trades` une fois à l'ouverture de la page par l'extension (pas d'interception de celle du site).
2. Pour chaque `card_id` distinct des offres affichées : résumé de ventes, depuis le cache sinon réseau.
3. Possession : depuis l'instantané de ma collection s'il est récent. Sinon, pour chaque carte de l'offre, `GET /api/my-collection?q={titre}&page=0&stats=0` (même requête que le site pour les contre-offres), puis filtre sur `card.id`.

Coût : 1 requête pour la liste, plus 1 par carte sans prix en cache, plus 1 par carte si l'instantané de collection est absent. Uniquement sur clic « Évaluer », jamais sur toutes les offres d'un coup.

### 2. Comparer avec un ami

UX : panneau latéral ouvert depuis « Comparer » (page amis) ou depuis la modale de création (bouton accroché au `h2`). Quatre listes :
- « Mes doubles qui lui manquent » ;
- « Ses doubles qui me manquent » ;
- « Mes cartes dans sa liste de souhaits » ;
- « Ses cartes dans ma liste de souhaits ».

Chaque liste est triée par rareté puis par valeur, filtrable par rareté, avec la valeur estimée et un compteur.

Flux de données :
- Mode rapide (par défaut) :
  - `GET /api/my-collection?wishlisted_by={pseudo}` (toutes les pages, souvent une seule) ;
  - `GET /api/profile/{pseudo}/collection?wishlisted_by_me=1&pending=1` (idem).
  Donne les deux listes de souhaits sans scanner les collections entières.
- Mode complet (bouton « Analyser toute la collection ») :
  - `GET /api/my-collection?owned_by={pseudo}&sort=rarity&stats=0&page=k` pour toutes les pages : mes doubles se calculent par regroupement, et `owned_by_peer` dit directement si l'ami possède la carte ;
  - `GET /api/profile/{pseudo}/collection?sort=rarity&pending=1&page=k` pour toutes les pages : ses doubles par regroupement, `owned_by_viewer` dit si je la possède, `pendingTradeCardIds` donne ses cartes engagées.
- Résumés de ventes seulement pour les cartes affichées dans les listes, au fil du défilement.

Coût du mode complet : `ceil(N/50)` requêtes pour ma collection de N copies, `ceil(M/50)` pour la sienne, plus 1 requête de stats par côté pour connaître le total et afficher une barre de progression. Le coût est annoncé avant de lancer (« environ X requêtes »), calculé à partir du total.

### 3. Proposer un échange équilibré

S'appuie sur la fonction 2. Produit une proposition que le joueur reproduit à la main dans la modale du site.

Algorithme (déterministe, explicable) :
1. Candidats « je donne » : mes doubles échangeables que l'ami ne possède pas (`owned_by_peer` faux), hors exclusions.
2. Candidats « je reçois » : ses doubles que je ne possède pas (`owned_by_viewer` faux), hors `pendingTradeCardIds`.
3. Priorité aux cartes présentes dans une liste de souhaits, puis aux paires de même rareté.
4. Appariement glouton : pour chaque carte reçue, la carte donnée de valeur la plus proche, même rareté d'abord.
5. Si l'écart total dépasse la tolérance choisie par le joueur, tenter d'ajouter une seule carte du côté léger ; sinon afficher l'écart restant en wikibidous, à titre indicatif.
6. Taille limitée par un réglage (cartes par côté) ; rester sous la limite du site de 100 cartes au total.
7. Les cartes sans prix ne servent pas à équilibrer : elles peuvent apparaître, marquées, mais l'écart affiché ne les compte pas.

UX :
- carte de suggestion : deux colonnes, valeurs, écart, raisons (« dans sa liste de souhaits », « lui manque ») ;
- bouton « Ouvrir l'échange avec {pseudo} » : un simple lien vers `/trades`. Le joueur clique lui-même sur « Proposer un échange », choisit l'ami ; pas de clic simulé ;
- quand la modale est ouverte avec le bon pseudo dans le `h2`, l'extension affiche la liste à cocher à côté et surligne les cartes visibles qui en font partie ;
- les cases se cochent quand le joueur sélectionne la carte dans la modale (lecture de l'état visuel : contour accent et icône Check), jamais l'inverse ;
- bouton « Copier le message » : un texte court décrivant la proposition, à coller dans les messages privés si le joueur veut négocier avant.

Les réglages par défaut (tolérance d'écart, taille maximale) sont à décider après tests sur de vraies collections.

## Coût réseau, débit et cache

Débit :
- toutes les requêtes passent par une file unique de l'extension ;
- 2 requêtes en parallèle au plus, avec un délai entre deux départs (kzfamily va jusqu'à 3 : `MAX_CONCURRENT = 3` dans `features/core.js`) ;
- arrêt immédiat de la file sur 401 (session expirée), 429, ou toute réponse contenant `human_verification_required` ;
- sur 504 (le site affiche « La recherche a pris trop de temps »), une seule nouvelle tentative différée, puis abandon ;
- rien au chargement de page sans action du joueur, sauf la liste des échanges sur `/trades` (une requête).

Cache, dans `browser.storage.local` (stockage de l'extension, pas le `localStorage` du site où kzfamily laisse plus de 1300 clés) :

| Donnée | Clé | Durée de vie | Invalidation |
|---|---|---|---|
| Résumé de ventes | `card_id` | 24 h (même valeur que kzfamily : `CACHE_TTL = 24 * 60 * 60 * 1000`) | bouton « Rafraîchir les prix » |
| Instantané de ma collection | mon `user_id` | courte, à fixer en test | échange passé à `accepted` dans notre `GET /api/trades`, bouton « Actualiser » |
| Instantané de la collection d'un ami | `user_id` + pseudo de l'ami | courte, à fixer en test | bouton « Actualiser » |
| Liste des échanges | aucune | pas de cache | relue à chaque visite de `/trades` |

Taille : plafonner le cache des prix (éviction des entrées les plus anciennes) et purger les instantanés d'amis non consultés depuis longtemps.

Identité du joueur : prendre `user_id` sur une ligne de `/api/my-collection`. Ne jamais lire le jeton Supabase.

Horodatage visible : chaque liste affiche « données du {heure} » et un bouton « Actualiser ».

## Cas limites

1. Même article en plusieurs raretés : regroupement par `card_id`, on garde la copie de rareté la plus haute ; les autres sont des doubles, mais leur valeur est celle de leur propre rareté.
2. Copies exclues des doubles échangeables : `starred`, `is_shiny`, `card_id` engagé dans une de mes offres en attente (même verrou que le site, au niveau `card_id`). Étiquettes « à garder » : option pour exclure une étiquette choisie par le joueur.
3. Carte en vente aux enchères ou en vitrine : on ne sait pas si elle reste dans `/api/my-collection` ni si le serveur refuse de l'échanger. À vérifier ; en attendant, la suggestion peut échouer à l'envoi, et c'est le site qui le dira.
4. Profil privé (`is_public` dans `0h28z-agxfm9k.js`) : la collection d'un ami peut être refusée. Afficher l'erreur du serveur, ne pas réessayer.
5. Collection modifiée entre l'instantané et l'échange (paquet ouvert, autre échange accepté) : l'horodatage et le bouton « Actualiser » couvrent ce cas ; le site revalide de toute façon à l'envoi.
6. Cartes sans aucune vente : « sans prix », jamais comptées comme 0.
7. Marché peu fourni : une seule vente peut fausser la moyenne. La pastille de confiance l'indique.
8. Titres de moins de 3 caractères : la recherche de la modale ne se lance pas (« Saisis au moins 3 caractères »). Le bouton « Copier » reste utile mais le joueur devra filtrer par rareté.
9. Plusieurs cartes au même titre (homonymes Wikipédia, cartes distinctes) : toujours comparer par `card_id`, jamais par titre seul ; le surlignage dans la modale compare titre et rareté.
10. Offres expirées ou contrées pendant la lecture : l'évaluation se cale sur le statut renvoyé et n'affiche rien pour une offre qui n'est plus `pending`.
11. Application mobile (Capacitor) : hors portée, l'extension ne tourne que sur le web.
12. Changement de DOM après une mise à jour du site : chaque ancrage est optionnel, le panneau latéral reste utilisable sans aucune injection.

## Ce qui existe déjà chez kzfamily

`features/trades.js` :
- « Valeur des échanges » : bouton « Valeurs » sur chaque offre de `/trades`, total des prix moyens par côté (résumé de ventes), wikibidous inclus, nombre de cartes sans prix ;
- « Prévisualisation complète des cartes » : remplace les puces tronquées par des mini-cartes ;
- association DOM ↔ échange par score sur les titres et pseudos ;
- données obtenues en lisant les réponses de `/api/trades` via un `fetch` remplacé (`bridge/core.js`, `isTradesApi`).

Ce qui manque chez eux et que cette spec apporte : impact sur la collection (dernière copie, déjà possédée, souhaits), diff de contre-offre, comparaison doublons et manques, suggestion d'échange.

À ne pas reproduire : le monkeypatch de `fetch`, le stockage dans le `localStorage` du site, et la logique de délais « humains » autour de la vérification dans `features/packs.js` (`uiResponseProfile`, `humanDelay`, `acknowledgedChecks`), qui sert à automatiser un comportement que le site cherche à vérifier.

## Hors périmètre v1

- « Qui a cette carte ? » sur le catalogue, à partir de `friendOwners` de `/api/cards`.
- Aide sur le souhait de guilde (« tu as un double de la carte demandée par X »).
- Panneau dans le fil de messages privés (`0glsn_q4kqq2b.js`), où les échanges apparaissent aussi.
- Historique de mes échanges acceptés avec valeur estimée au moment de l'échange.

## Questions ouvertes

1. Le site tolère-t-il un scan complet d'une collection d'ami (toutes les pages) ? Rien dans les règles ne l'interdit explicitement, mais la règle 8 parle de surcharge. Faut-il demander l'avis de l'équipe du jeu avant la sortie ?
2. Les items de `GET /api/trades` portent-ils la rareté figée de la copie (`snapshot_rarity`, comme le suppose kzfamily) ou la rareté actuelle de la carte ? À vérifier sur une vraie réponse, sinon l'évaluation peut se tromper de rareté.
3. Une carte mise aux enchères ou placée en vitrine reste-t-elle dans `/api/my-collection` et peut-elle être proposée en échange ?
4. `/api/profile/{pseudo}/collection` répond-il pour un non-ami, ou pour un profil privé ? Le chunk de la page `/profile/{pseudo}` manque dans `reference/`.
5. Le paramètre `pending=1` limite-t-il `pendingTradeCardIds` aux échanges avec moi, ou à tous ses échanges en attente ?
6. Quel délai avant le statut `expired` ? Utile pour afficher « expire dans… » sur l'évaluation.
7. Le champ `count` d'une ligne `UserCard` est-il toujours 1 (une ligne par copie) ? Le site le recalcule lui-même, ce qui le laisse penser.
