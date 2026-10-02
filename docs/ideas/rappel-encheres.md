# Rappel d'enchères

Spec de la fonction "Suivre une enchère". Relevé fait le 2 octobre 2026, uniquement à partir des fichiers de `reference/`. Aucune requête au site, aucun navigateur.

## L'idée en une phrase

Le joueur marque une enchère avec "Suivre". L'extension liste ses enchères suivies, triées par heure de fin, et l'avertit N minutes avant la fin par une notification système, même onglet fermé. Un clic sur la notification ouvre `/marketplace/{id}`. Le joueur enchérit lui-même, sur la page du site.

## Limite fixée par les règles du site

Règle 3 de `reference/page_rules.html` :

- `Interdiction d'utiliser des bots, des scripts, des macros [...] ou tout outil visant à jouer, ouvrir des paquets, échanger ou interagir à votre place.`
- `Pas de modification, de rétro-ingénierie ou d'interception du trafic du Service pour obtenir un avantage.`

Conséquences pour cette fonction :

1. Aucune mise automatique, aucun "sniping", aucun montant pré-rempli, aucun bouton "Enchérir" ajouté par l'extension.
2. Pas de patch de `window.fetch` ou de `XMLHttpRequest` pour lire les réponses du site. C'est ce que fait kzfamily (`bridge/intercept.js` : `window.fetch = (...args) => { ... response.clone().json().then(emitMarketplaceDetail)`), et c'est précisément de l'interception de trafic.
3. Aucune ouverture d'onglet ni rafraîchissement de page sans clic du joueur.

## Ce que le site expose

### Routes et identifiant d'enchère

- Liste : `/marketplace`. Détail : `/marketplace/{id}`.
- L'id est un UUID. kzfamily le valide ainsi (`features/core.js`) : `/^\/marketplace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i`.
- Les liens de la liste pointent vers le détail. `0_lp-jz0hzlqg.js` : ``href:`/marketplace/${e.id}` ``.

### Liste : `GET /api/marketplace`

Source : `0_lp-jz0hzlqg.js`, page `/marketplace`.

Paramètres envoyés :

```
new URLSearchParams({page:String(e),limit:String(50),sort:D,...!C.current&&{mine:"1"}})
t.set("q",T) ... t.append("rarity",e)
```

- `page`, `limit` (50), `sort` parmi `recent`, `price_asc`, `price_desc`, `ending_soon`, `q` (recherche), `rarity` (répétable), `mine=1` au premier chargement.
- Tri "Fin imminente" : `{value:"ending_soon",label:"Fin imminente"}`.

Champs de réponse lus par le site :

```
m(t.auctions??[]),N(!0===t.hasMore) ...
selling:t.selling??e.selling,bidding:t.bidding??e.bidding,won:t.won??e.won,history:t.history??e.history
t.maxConcurrentAuctions ... t.mine&&(C.current=!0)
```

Donc `{ auctions, hasMore, mine, selling, bidding, won, history, maxConcurrentAuctions }`. Les quatre listes `mine` alimentent les onglets "Mes ventes", "Mes enchères", "Gagnées", "Historique".

La page ne charge rien si l'utilisateur n'est pas connecté : `if(!c){o(!1),J.current=!1;return}` (avec `c=(0,r.useUserId)()`).

### Objet enchère

Champs utilisés par la carte d'enchère (`0_lp-jz0hzlqg.js`) :

| Champ | Preuve |
|---|---|
| `id` | ``id:`marketplace-auction-${e.id}` `` |
| `card` (objet carte complet) | `if(!k.card)return null` puis `card:k.card` |
| `end_at` (ISO, heure de fin) | `endAt:k.end_at` et `new Date(e.end_at).getTime()` |
| `current_bid` | `null!==k.current_bid&&null!==k.current_bidder_id?k.current_bid:k.base_amount` |
| `current_bidder_id` | idem, et `e.current_bidder_id===c?"leading":"outbid"` |
| `base_amount` (mise de départ) | idem |
| `status` | `"active"===e.status` |
| `seller.username` | `["Vendu par ",k.seller.username]` |
| `owned` (carte déjà possédée) | `owned:e.owned??!1` |

Le champ s'appelle `end_at`, pas `ends_at`. Aucun champ "nombre de mises" n'apparaît dans les chunks téléchargés. Le "7 offres" de la page d'accueil est une maquette statique (`033.ky6t6s0~i.js` : `children:"7 offres"`).

La carte (`0qevgzlhsm_i8.js`) affiche le titre dans un `h3` : `"h3",{ref:es,className:ey,style:N,children:G.wikipedia_title}`. La rareté donne une classe : `{C:"glow-c",PC:"glow-pc",R:"glow-r",SR:"glow-sr",...}`.

### Statuts et libellés

`auctionPriceLabel` dans `0_lp-jz0hzlqg.js` :

```
case"settled_sold":r=...?"Achetée pour":"Vendue pour";break;
case"settled_unsold":r="Non vendue";break;
case"cancelled":r="Annulée"
```

Statuts connus : `active`, `settled_sold`, `settled_unsold`, `cancelled`. Une enchère est considérée vivante si `"active"===e.status&&new Date(e.end_at).getTime()>t`. La liste refiltre toutes les 30 s : `setInterval(()=>ee(e=>e+1),3e4)`.

### Compte à rebours

Même fichier, composant `622801` :

```
r>0?`${r}j ${n}h`:n>0?`${n}h ${a.toString().padStart(2,"0")}m`:a>0?`${a}m ${s...}s`:`${s}s`
m=v?a(j):`Se termine dans ${a(j)}`
let S=j>0&&j<3e5
```

- Format compact (liste) : `1h 05m`, `12m 03s`, `45s`, `Terminée`.
- Format long : `Se termine dans 1h 05m`. La liste n'utilise que le compact, le format long sert donc ailleurs, très probablement sur la page détail.
- Le texte passe en ambre sous 5 minutes (`j<3e5`).
- Le calcul se fait avec l'horloge locale : `function s(){return Date.now()}`.

### Détail : `GET /api/marketplace/{id}`

Le chunk de la page `/marketplace/[id]` n'est pas dans `reference/site-chunks/`. La forme vient de kzfamily (`bridge/core.js`, `emitMarketplaceDetail`) :

```
const auction = json?.auction;
const id = auction?.card_id || card?.id;
rarity: auction?.snapshot_rarity || card?.rarity
```

Réponse : `{ auction: { id, card_id, snapshot_rarity, card: { id, wikipedia_title, rarity, image_url, wikipedia_url }, ... } }`. Les autres champs (`end_at`, `status`, `current_bid`...) sont probablement les mêmes que dans la liste. À confirmer.

### Autres endpoints du marché

- `GET /api/marketplace/mine` : `t.sellingCount??0` et `t.maxConcurrentAuctions` (`0fp~uhc83_2bd.js`). Ne sert qu'au vendeur.
- `GET /api/marketplace/cards/{id}/sales?scope=summary` : `o(a.summary??{})`, résumé par rareté (`0fp~uhc83_2bd.js`).
- `GET /api/marketplace/cards/{id}/sales` : `x(n.sales??[])`, items avec `settled_at`, `final_price`, `rarity`. Réservé Pro : `"pro_required"===n.code` (`0~r~p2xs9m7lk.js`).
- `POST /api/marketplace` (mise en vente) : `body:JSON.stringify({card_id:f,base_amount:M,duration_minutes:y})`, réponse `r.auction_id`, ou `"human_verification_required"===r.code` (`0fp~uhc83_2bd.js`).

### Durées possibles d'une enchère

`0fp~uhc83_2bd.js` :

```
[{label:"10 min",minutes:10},{label:"30 min",minutes:30},{label:"1 h",minutes:60},
 {label:"3 h",minutes:180},{label:"6 h",minutes:360},{label:"12 h",minutes:720}]
```

Durée par défaut : `useState)(60)`. Une enchère dure donc au plus 12 h. Limite de ventes simultanées : `"MAX_CONCURRENT_AUCTIONS_PRO",0,10,"MAX_CONCURRENT_AUCTIONS_REGULAR",0,5` (`0zk0wzl15-vto.js`).

### Endpoint de mise : inconnu

Aucune requête de mise dans les chunks téléchargés : la recherche de `/bid`, `Enchérir`, `mise minimum` ne donne rien hors libellés. L'URL, le pas minimal et les messages d'erreur restent inconnus. Ce n'est pas bloquant : l'extension n'appelle jamais cet endpoint.

### Prolongation anti-snipe : non prouvée

Aucun champ du type `extended`, `anti_snipe`, `soft_close` dans les chunks. Seul indice : le compte à rebours remet à zéro son drapeau "terminé" quand `endAt` change (`(0,n.useEffect)(i,o)` avec `i=()=>{N.current=!1}` et `o=[p]`). Le composant prévoit donc qu'une heure de fin change sans démontage, mais cela peut aussi venir d'un simple rechargement.

Point clé pour la spec : une prolongation ne peut que repousser la fin. Une heure de fin périmée produit donc un rappel en avance, jamais en retard. Voir la section sur le rafraîchissement.

### Notifications du site liées au marché

`0ulf0g4nvno~r.js` :

```
marketplace_outbid:"Surenchéri",marketplace_auction_won:"Enchère gagnée",
marketplace_auction_sold:"Carte vendue",marketplace_auction_unsold:"Enchère terminée",
marketplace_auction_midpoint_nudge:"Enchère sans mise",marketplace_wishlist_listed:"Liste de souhaits"
```

- Charge utile : `t.auction_id`, `t.card_title`, `t.message`. Lien : ``t.auction_id?`/marketplace/${t.auction_id}`:"/marketplace"`` (`0.7iei4a7u_29.js`).
- `midpoint_nudge` vise le vendeur (enchère sans mise à mi-parcours).
- Arrivée en temps réel par ``.channel(`notifications:${w}`,{config:{private:!0}})``.
- Le site gère déjà le Web Push via son propre service worker (`navigator.serviceWorker.register("/sw.js",...)`, `enableWebPush`, `0.7iei4a7u_29.js`). Texte d'invitation : `notifications pour vos échanges, enchères et combats`.

Aucune notification "fin imminente" n'existe. Le joueur est prévenu quand il est surenchéri ou qu'il gagne, pas avant la fin d'une enchère qu'il regarde sans avoir misé.

### Fonction "suivre" existante côté site

Aucune pour les enchères. Ce qui s'en approche :

- Onglet "Mes enchères" (`bidding`), limité aux enchères où le joueur a déjà misé, avec badge `"Vous menez"` ou `"Surenchéri"`.
- Liste de souhaits par carte (table `wishlist_items`, `10-~5dwf8ta~s.js` : `r.from("wishlist_items").delete().eq("user_id",er).eq("card_id",e.id)`), qui déclenche `marketplace_wishlist_listed` à la mise en vente.
- Les "favoris" (`starred`) concernent les cartes possédées, pas les enchères (`14yi4kchm5v2m.js` : `{value:"starred",label:"Favoris"}`).

## Points d'ancrage dans le DOM

### Page liste `/marketplace`

Chaque enchère, dans tous les onglets, est rendue ainsi (`0_lp-jz0hzlqg.js`) :

```
(0,t.jsx)("div",{id:`marketplace-auction-${e.id}`,children:(0,t.jsx)(x,{auction:e,href:`/marketplace/${e.id}`, ...
```

Puis dans `x` : `u.default,{prefetch:!1,href:C,...,className:"card-frame block p-3 w-[172px] md:w-[184px] ..."`.

- Sélecteur : `div[id^="marketplace-auction-"]`. L'id d'enchère est la fin de l'attribut `id`. Le lien enfant `a[href^="/marketplace/"]` sert de contrôle.
- Titre : `h3` dans la carte.
- Rareté : classe `glow-*` de la carte.
- Heure de fin : `span` dont le texte correspond au format compact. Classe `tabular-nums`.
- Prix affiché : nombre formaté `toLocaleString("fr-FR")`. Le séparateur de milliers fr-FR est une espace fine insécable : retirer tout ce qui n'est pas un chiffre avant de parser.
- Libellé de prix : `Mise actuelle`, `Mise de départ`, `Vendue pour`, `Achetée pour`, `Non vendue`, `Annulée`.
- Vendeur : `p` qui commence par `Vendu par `.
- Onglet "Mes enchères" : badge `Vous menez` ou `Surenchéri`.

Où poser le bouton "Suivre" : dans le `div#marketplace-auction-{id}`, après le lien, jamais dedans. Un bouton dans un `<a>` est du HTML invalide et le clic déclencherait la navigation. Pour le placer en coin de carte, une règle CSS de l'extension `[id^="marketplace-auction-"]{position:relative}` suffit.

Le bouton "Charger la suite" ajoute des cartes sans recharger : un `MutationObserver` sur `main` doit réinjecter, avec un attribut `data-` pour rester idempotent. React peut aussi recréer les nœuds au changement d'onglet.

### Page détail `/marketplace/{id}`

Le chunk manque, donc ancrages à valider :

- Id : depuis `location.pathname`, avec la regex UUID ci-dessus.
- Titre : un `h1` égal au titre de la carte. kzfamily s'y accroche (`features/price-ui.js` : `[...document.querySelectorAll('h1')].find((el) => normalizeTitle(el.textContent) === normalizeTitle(meta.title))`). Attention, la liste a aussi un `h1` ("Marché") : tester la route d'abord.
- Heure de fin : `span.tabular-nums` au texte `Se termine dans ...` (format long, probable).
- Bouton "Suivre" : à côté du `h1`.

### Navigation interne

Next.js change de page sans recharger. Le content script doit être déclaré sur `https://www.wiki-masters.com/*` (hôte utilisé par kzfamily dans son `manifest.json`) et réagir aux changements d'URL avec l'événement `wxt:locationchange` de WXT.

## Flux de données

### Sources possibles pour l'heure de fin

| Source | Requête réseau | Précision | Limites |
|---|---|---|---|
| A. Texte du compte à rebours dans le DOM | Aucune | À la seconde sous 1 h, à la minute au-delà | Approché, lu seulement quand la page est ouverte |
| B. `sessionStorage["marketplace_list_v3"]` | Aucune | `end_at` exact | Présent seulement sur la page détail, après un clic depuis la liste |
| C. `GET /api/marketplace/{id}` depuis l'extension | Une | Exact, avec statut | Demande la session du joueur, ajoute du trafic |
| D. Patch de `fetch` pour lire les réponses du site | Aucune en plus | Exact | Interception du trafic : refusé |

Preuve pour B (`0_lp-jz0hzlqg.js`) : au clic sur une carte, `onBeforeNavigate:()=>es(e.id)` écrit `sessionStorage.setItem(g,JSON.stringify(t))` avec `g="marketplace_list_v3"` et `browse:f`, `mine:$`. La clé est supprimée au retour sur la liste (`sessionStorage.removeItem(g)`). Le content script lit le même `sessionStorage` que la page. Le suffixe `_v3` changera un jour : lecture opportuniste, avec repli sur A.

### Recommandation

Mode par défaut : zéro requête. Sources A et B uniquement.

Pourquoi c'est suffisant :

1. L'heure de fin ne peut que reculer (prolongation) ou l'enchère disparaître (annulation). Une donnée périmée donne un rappel trop tôt, jamais trop tard.
2. Lire le DOM au format `1h 05m` sous-estime le temps restant d'au plus une minute. Même effet : rappel légèrement en avance.
3. Après le rappel, le joueur est sur la page et voit le vrai compte à rebours du site.

Le coût d'une donnée périmée est un rappel pour une enchère annulée ou prolongée. Le joueur clique et voit `Annulée` ou le nouveau délai.

Option désactivée par défaut : "Vérifier avant le rappel". Une seule requête `GET /api/marketplace/{id}` depuis l'arrière-plan, au moment du rappel, jamais en boucle. Elle corrige l'heure de fin, détecte l'annulation et donne la mise actuelle. Si la réponse n'est pas `200` (joueur déconnecté par exemple), le rappel part avec les données locales. Cette option reste à valider face à la règle 3 (voir questions ouvertes).

### Modèle de stockage

`chrome.storage.local`, via `storage.defineItem` de WXT.

```ts
type Rarity = "C" | "PC" | "R" | "SR" | "UR" | "L";
type AuctionStatus = "active" | "settled_sold" | "settled_unsold" | "cancelled" | "unknown";
type EndAtSource = "dom-minute" | "dom-second" | "session-cache" | "api";

interface FollowedAuction {
  auctionId: string;
  cardTitle: string;
  rarity: Rarity | null;
  endAt: number;
  endAtSource: EndAtSource;
  lastKnownPrice: number | null;
  lastKnownPriceLabel: string | null;
  status: AuctionStatus;
  followedAt: number;
  updatedAt: number;
  firedReminderMinutes: number[];
}

interface ReminderSettings {
  reminderMinutes: number[];
  soundEnabled: boolean;
  persistentNotification: boolean;
  verifyBeforeReminder: boolean;
  purgeEndedAfterHours: number | null;
}
```

Clés : `local:followedAuctions` (`Record<string, FollowedAuction>`) et `local:reminderSettings`. Pas de cardId nécessaire en v1.

Règle de fusion quand une nouvelle lecture arrive : garder la source la plus précise (`api` > `session-cache` > `dom-second` > `dom-minute`). À précision égale, garder la plus récente. Une heure de fin plus tardive d'au moins une minute venant d'une source fiable remplace toujours l'ancienne (prolongation) et vide `firedReminderMinutes` pour les délais pas encore atteints.

### Planification

Une seule alarme, `next-reminder`, calée sur le prochain rappel dû parmi toutes les enchères suivies.

1. À chaque changement de `followedAuctions` ou de réglages (`storage.onChanged`), l'arrière-plan recalcule le prochain instant `endAt - délai` encore à venir et non tiré, puis recrée l'alarme avec `when`.
2. Quand l'alarme sonne : traiter tous les rappels dus, regrouper ceux qui tombent ensemble, envoyer, noter les délais tirés, recalculer.
3. Au démarrage (`runtime.onStartup`) et à l'installation (`runtime.onInstalled`) : recalculer. Chrome indique que les alarmes peuvent être effacées au redémarrage du navigateur.

Une alarme unique évite le plafond d'alarmes actives de Chrome et les doublons quand plusieurs onglets écrivent.

### Quand rafraîchir l'heure de fin

En mode zéro requête :

- À chaque affichage d'une carte suivie dans la liste (lecture DOM, gratuite).
- À chaque ouverture de la page détail d'une enchère suivie (DOM et `sessionStorage`).
- Jamais en tâche de fond.

Avec "Vérifier avant le rappel" :

- Une requête au moment où le rappel doit partir.
- Si `endAt` a reculé : pas de notification, replanifier.
- Si `status` n'est plus `active` : pas de notification, passer l'enchère en "Terminées".
- Pas de seconde requête pour la même enchère et le même délai.

## Différences Chrome et Firefox

| Sujet | Chrome (MV3) | Firefox (MV3) |
|---|---|---|
| Arrière-plan | Service worker, sans DOM | Page d'événements (`background.scripts`), avec DOM. WXT génère le bon format par cible |
| Délai minimal d'alarme | 30 s depuis Chrome 120 (1 min avant) | À vérifier sur la version visée. Viser 1 min comme plancher |
| Persistance des alarmes | Peuvent disparaître au redémarrage | Ne survivent pas au redémarrage |
| Type de notification | `basic`, `image`, `list`, `progress` | N'utiliser que `basic` |
| Boutons dans la notification | Oui | Non |
| `requireInteraction` | Oui | À vérifier dans la table MDN, prévoir l'absence |
| `silent` | Oui | À vérifier, prévoir l'absence |
| Clic sur la notification | `notifications.onClicked` | Pareil |
| Son personnalisé | Document offscreen, raison `AUDIO_PLAYBACK` | `Audio` directement dans la page d'arrière-plan. Pas d'API offscreen |
| `iconUrl` | Obligatoire pour `basic` | Recommandé |

Clic sur la notification :

1. Chercher un onglet déjà sur `https://www.wiki-masters.com/marketplace/{id}` (`tabs.query` par URL, autorisé grâce à la permission d'hôte).
2. S'il existe : l'activer et donner le focus à sa fenêtre.
3. Sinon : ouvrir un nouvel onglet. Ne pas détourner un onglet du site déjà ouvert sur une autre page (le joueur peut être en plein duel).
4. Fermer la notification.

Son : la notification système joue déjà le son de l'OS. Le son de l'extension est un supplément. Sur Chrome, le passer avec `silent: true` pour éviter deux sons. Le fichier audio est embarqué dans l'extension, rien n'est chargé de l'extérieur. kzfamily synthétise son carillon en Web Audio (`features/extra-tools.js`), ce qui évite un fichier mais se joue dans la page du site, donc seulement onglet ouvert.

Windows : le mode "Ne pas déranger" et l'assistant de concentration masquent les toasts. Le prévoir dans l'aide des réglages.

Permissions : `storage`, `alarms`, `notifications`, `offscreen` (Chrome seulement), hôte `https://www.wiki-masters.com/*`.

## Expérience utilisateur v1

### Sur le site

- Bouton étoile "Suivre" sous chaque carte de la liste, dans tous les onglets actifs (Parcourir, Mes enchères). Pas sur "Gagnées" ni "Historique".
- Même bouton à côté du titre sur la page détail.
- États : "Suivre" ou "Suivie". Infobulle avec l'heure du prochain rappel, par exemple "Rappel à 21 h 40".
- Si aucun délai configuré n'est encore atteignable (il reste 3 min pour un rappel à 5 min) : l'enchère est suivie quand même et l'infobulle dit "Trop tard pour un rappel".

### Suivi automatique des enchères où le joueur a misé

Décision de l'utilisateur : toute enchère sur laquelle il a misé est suivie automatiquement, sans clic sur l'étoile.

Détection sans requête réseau :
- À chaque affichage de l'onglet "Mes enchères" (`bidding`), chaque carte présente est ajoutée au suivi avec la source `auto-bid`.
- Sur la page détail, quand la mise du joueur est confirmée à l'écran (badge `Vous menez`), l'enchère est ajoutée au suivi.

Règles :
- Une enchère `auto-bid` se comporte comme une enchère suivie à la main : mêmes rappels, même panneau.
- "Ne plus suivre" sur une enchère `auto-bid` la place dans une liste d'exclusion, pour qu'elle ne revienne pas à la prochaine visite de l'onglet.
- Limite connue : une mise faite depuis l'app mobile n'est détectée qu'à la prochaine visite de l'onglet "Mes enchères" sur le web.

### Panneau "Mes enchères suivies" (popup de l'icône)

- Deux sections : "En cours" triée par fin la plus proche, "Terminées".
- Ligne : titre, pastille de rareté, compte à rebours local, dernier prix connu avec son libellé, lien "Ouvrir", bouton "Ne plus suivre".
- Mention "heure approchée" quand la source est `dom-minute`.
- Pas de champ de montant, pas de bouton "Enchérir".
- Badge sur l'icône : nombre d'enchères suivies en cours.

### Notification

- Titre : `Enchère bientôt terminée`.
- Texte : `« Titre de la carte » se termine dans 5 min. Mise actuelle : 1 240 wikibidous.` (prix seulement si connu).
- Plusieurs rappels au même moment : une seule notification, `3 enchères suivies se terminent dans 5 min`, clic vers `/marketplace`.
- Identifiant de notification = id d'enchère, pour remplacer plutôt qu'empiler.

## Réglages

| Réglage | Valeurs | Défaut proposé |
|---|---|---|
| Délais de rappel | Choix multiple parmi 1, 2, 5, 10, 15, 30, 60 min | 5 min, le seuil où le site passe le compte à rebours en ambre |
| Son de l'extension | Oui ou non | Non |
| Notification persistante | Oui ou non (Chrome seulement) | Non |
| Vérifier avant le rappel | Oui ou non | Non |
| Retirer les terminées | Après 1 h, après 24 h, jamais | Après 24 h |
| Bouton "Suivre" sur le site | Oui ou non | Oui |
| Suivre automatiquement mes mises | Oui ou non | Oui |

Pas de délai sous 1 minute : l'outil ne doit pas servir de métronome pour miser à la dernière seconde.

## Cas limites

1. **Enchère terminée** : quand `endAt` est passé, la ligne passe en "Terminées" sans notification. Le résultat exact reste `unknown` jusqu'à une lecture DOM des libellés `Achetée pour`, `Vendue pour`, `Non vendue`, `Annulée`.
2. **Enchère annulée** : invisible en mode zéro requête. Le rappel part, le joueur voit `Annulée` sur le site. Le mode vérification l'évite.
3. **Prolongation par mise tardive** : l'ancienne heure fait partir le rappel en avance. Une nouvelle lecture (DOM ou requête) recale `endAt` et réarme les délais non atteints.
4. **Surenchère** : le site envoie déjà `marketplace_outbid` et le Web Push. L'extension ne double pas cette alerte. Elle peut afficher `Surenchéri` dans le panneau si le badge a été lu dans l'onglet "Mes enchères".
5. **Navigateur fermé ou PC en veille** : rien ne part. Au réveil ou au démarrage, une alarme en retard est traitée. Si la fin est passée : pas de notification. Si la fin est encore à venir : une notification avec le temps réellement restant.
6. **Plusieurs onglets** : seul l'arrière-plan planifie. Les content scripts écrivent dans le stockage et écoutent `storage.onChanged` pour mettre à jour leurs boutons. Pas de doublon possible avec l'alarme unique et l'id de notification par enchère.
7. **Décalage d'horloge** : le site calcule aussi le temps restant avec `Date.now()` local. En lisant le DOM, on retombe sur le même `end_at` que le site, avec le même décalage. Le rappel reste cohérent avec ce que le joueur voit. En mode vérification, l'en-tête HTTP `Date` peut servir à mesurer l'écart si besoin.
8. **Beaucoup d'enchères suivies** : une alarme unique, une entrée de stockage par enchère, purge des terminées. Pas de plafond nécessaire en v1.
9. **Rappels simultanés** : regroupés en une notification.
10. **Joueur déconnecté** : la liste ne s'affiche pas (`if(!c){...return}`), donc pas de bouton. Les rappels déjà planifiés partent quand même.
11. **Changement de compte** : la liste suivie appartient au profil navigateur, pas au compte du jeu. Acceptable en v1.
12. **Structure du site modifiée** : si le sélecteur `div[id^="marketplace-auction-"]` ou le format du compte à rebours change, le bouton disparaît sans erreur visible. Les enchères déjà suivies restent dans le panneau.

## Ce que l'extension ne fera jamais

- Miser, pré-remplir un montant, proposer un montant "conseillé".
- Ouvrir un onglet ou recharger une page sans clic.
- Interroger le site en boucle.
- Lire les réponses réseau du site par interception.

## Questions ouvertes

1. Le site prolonge-t-il une enchère après une mise tardive ? Le chunk de `/marketplace/[id]` manque dans `reference/`. Le récupérer confirmerait la règle et les champs exacts du détail.
2. L'option "Vérifier avant le rappel" (une requête `GET /api/marketplace/{id}` par rappel) est-elle acceptable vis-à-vis de la règle 3, ou faut-il rester en zéro requête strict ?
3. Le domaine sans `www` sert-il aussi le jeu ? kzfamily ne déclare que `https://www.wiki-masters.com/*`.
4. Le panneau doit-il aussi exister dans la page `/marketplace`, en plus du popup ?
