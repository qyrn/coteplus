# Collection plus pratique : spécification v1

Relevé fait le 2 octobre 2026 sur les fichiers locaux uniquement : bundles du site dans `reference/site-chunks/`, extension kzfamily dans `reference/kzfamily-4.27.7/`. Aucune requête n'a été faite vers le site ou Supabase.

Les extraits de code sont cités sous la forme `fichier : extrait`. Les bundles sont minifiés, les noms de variables (`e`, `t`, `r`…) ne veulent rien dire.

## 1. Cadre et limites

- Règle 3 du site : pas d'outil qui joue, ouvre des paquets, échange ou interagit à la place du joueur. Pas d'interception du trafic pour obtenir un avantage.
- Règle 8 du site : ne pas perturber le service (« surcharge, attaques, contournement des limites techniques »). Source : `reference/page_rules.html`.
- Conséquences pour cette fonctionnalité :
  - uniquement des requêtes `GET` en lecture, lancées par un clic du joueur, jamais en tâche de fond ;
  - aucune écriture : pas de favori, pas d'étiquette, pas de défausse, pas d'ajout à la liste de souhaits depuis l'extension ;
  - pas de réécriture de `window.fetch` ni de `XMLHttpRequest` dans la page (kzfamily le fait dans `bridge/intercept.js`, c'est la zone grise « interception du trafic ») ;
  - pas d'appel direct à l'API REST Supabase (kzfamily recopie les en-têtes capturés du site pour interroger `/rest/v1/cards`, voir `bridge/themes.js` et `bridge/families.js`) ;
  - chaque action coûteuse affiche son nombre de requêtes avant de partir, et va à un rythme limité.

## 2. Ce que le site propose déjà

### 2.1 Page `/collection` (chunk `14yi4kchm5v2m.js`)

| Fonction | Détail | Preuve |
|---|---|---|
| Recherche | Titre ou catégorie, 3 caractères minimum, délai de 300 ms | `placeholder:"Rechercher par titre ou catégorie..."` et `"Saisis au moins 3 caractères pour lancer la recherche"` |
| Filtre rareté | Plusieurs raretés à la fois, puces L, UR, SR, R, PC, C | `let I=["L","UR","SR","R","PC","C"]` |
| Filtre étiquette | Une seule étiquette, ou « Sans étiquette » | `{value:"",label:"Toutes les étiquettes"}`, `{value:E,label:"Sans étiquette"}` |
| Tri | Rareté, Nom, Favoris, Date d'ajout | `let F=[{value:"rarity",label:"Rareté"},{value:"name",label:"Nom"},{value:"starred",label:"Favoris"},{value:"added",label:"Date d'ajout"}]` |
| Pagination | 50 cartes par page, boutons Précédent / Suivant | `eX=Math.ceil(N/50)` et `children:"← Précédent"` |
| Favori | Étoile sur chaque carte, écrit dans `user_cards.starred` | `ez.from("user_cards").update({starred:!e.starred}).eq("id",e.id)` |
| Mode sélection | Sélection de la page, étiqueter, retirer une étiquette, défausser | `"Tout sélectionner (page)"`, `"Étiqueter"`, `fetch("/api/user-cards/bulk-discard"` |
| Gestion des étiquettes | Créer, renommer, recolorer | `ez.from("tags").update({name:t}).eq("id",e.id)` |
| Échange en attente | Badge sur les cartes engagées dans un échange | `fetch("/api/trades?active=1")` puis `pendingTradeLabel:r?"Échange en attente"` |

Ce qui manque sur `/collection` :

- pas de tri par ATK ou DEF (il existe sur `/global-collection`, pas ici) ;
- pas de filtre « favoris seulement » : le tri Favoris les met en tête, sans filtrer ;
- une seule étiquette à la fois, pas de combinaison ET / OU, pas d'exclusion ;
- pas de filtre shiny, doublons, catégorie exacte, période d'obtention ;
- pas d'export ;
- chaque exemplaire est une entrée séparée. Le nombre d'exemplaires affiché dans la fiche ne compte que la page courante : `count:e.filter(e=>e.card.id===eo.card.id).length` (`e` est la liste de la page) ;
- les filtres ne sont pas dans l'URL : aucun `useSearchParams` ni `router.push` dans le chunk. Un rechargement les perd.

### 2.2 Page `/global-collection` (chunk `10-~5dwf8ta~s.js`)

| Fonction | Détail | Preuve |
|---|---|---|
| Titre | « Collection Globale », « Toutes les cartes existantes dans le jeu » | `children:"Collection Globale"` |
| Compteurs par rareté | Affichés hors recherche | `children:L[e]??0` avec `L` = `rarityCounts` |
| Recherche | 3 caractères minimum, lancée par Entrée ou bouton | `onKeyDown:e=>{"Enter"===e.key&&…en()}` |
| Tri | Rareté, Nom, ATK, DEF | `h=[{value:"rarity",…},{value:"name",…},{value:"atk",…},{value:"def",…}]` |
| Filtre rareté | Plusieurs à la fois | `e.append("rarity",r)` |
| Liste de souhaits | Filtre et ajout / retrait depuis la fiche | `t.set("wishlist","1")`, `r.from("wishlist_items").insert({user_id:er,card_id:e.id})` |
| Badge « Possédée » | Sur les cartes du catalogue déjà possédées | `title:"Dans ta collection",children:"Possédée"` |
| Amis propriétaires | Pseudo du premier ami qui possède la carte, `+N` | `r[0].username,r.length>1?\` +${r.length-1}\`` |
| Cache | Réponses gardées dans `sessionStorage`, préfixe `gc_v11_`, sauf liste de souhaits | `let p="gc_v11_"` et `sessionStorage.setItem(p+e,JSON.stringify(t))` |

Point clé sur la taille du catalogue. Le site affiche lui-même, en mode recherche : `"Recherche active : pas de décompte par rareté ni de total exact (évite de parcourir des millions de lignes)."` Le catalogue se compte donc en millions de lignes selon le site. On ne connaît pas le chiffre exact hors ligne : il s'affiche en tête de page (`(S??0).toLocaleString("fr-FR")," cartes"`).

Il n'existe pas de filtre « non possédées ».

### 2.3 Autres endroits liés

- Fiche carte (chunk `0_myzl748rjvi.js`) : `"Q-Score : ",r.q_score`, `"Exemplaires : ",m`, `"Vues (30j) : ",r.pageviews`, lien Wikipédia `href:r.wikipedia_url`.
- « Toile » (fonction Lab, même chunk) : graphe des cartes liées à un article, avec un mode « mes cartes » et un mode catalogue. Appel `fetch(\`/api/cards/${e.id}/web?${a}\`)`, champs `total` et `ownedTotal`, nœuds avec `copies`. Message `"Aucune carte de votre collection n’est liée à cet article."`. C'est déjà une forme de « cartes manquantes autour d'un article ».
- Page échanges (chunk `0tpqxkgbnq21..js`) : marque les cartes du partenaire que je possède déjà (`owned_by_viewer`) et les miennes qu'il possède (`owned_by_peer`).

### 2.4 Ce que kzfamily couvre déjà

- `features/collection-bulk.js` : chargement des prix moyens par rareté et classement « Plus chères ». Aucun export, aucune vue doublons.
- `features/theme-tracker.js` + `bridge/families.js` : page « Familles » sur `/global-collection?wm=themes`. Le joueur crée un ensemble de cartes, l'extension vérifie lesquelles il possède et cherche les manquantes sur le marché (`'Marché des cartes manquantes'`, `'Rechercher toutes les manquantes'`).
- `bridge/collection.js` : charge toute la collection page par page (`MAX_COLLECTION_PAGES = 200`), dédoublonne par carte. Commentaire utile : `// Chaque exemplaire est une entrée distincte avec count = 1.`
- `bridge/themes.js` : tente de télécharger le catalogue via Supabase, 1000 lignes par page, 80 pages au plus (`CATALOGUE_PAGE_SIZE = 1000`, `MAX_CATALOGUE_PAGES = 80`). Le résultat est marqué incomplet au-delà.

À ne pas refaire : les « Familles » (manquantes dans un ensemble choisi à la main) et les prix.

## 3. API et données

Toutes les routes `/api/*` sont appelées sans en-tête d'authentification, donc par cookie de session : `fetch(\`/api/my-collection?${t.toString()}\`)` (chunk `14yi4kchm5v2m.js`). Une requête `GET` même origine avec `credentials: "include"` suffit.

### 3.1 `GET /api/my-collection`

Construction des paramètres, partagée par toutes les pages (chunk `02yxms5qtflzx.js`) :

```
t.sort&&e.set("sort",t.sort),t.q&&e.set("q",t.q),t.rarities)for(let r of t.rarities)e.append("rarity",r);
return t.tagId&&e.set("tag_id",t.tagId),t.untagged&&e.set("untagged","1"),t.wishlistedBy&&e.set("wishlisted_by",t.wishlistedBy)
```

| Paramètre | Valeurs | Source |
|---|---|---|
| `page` | entier, commence à 0 | `t.set("page",String(el))` |
| `stats` | `0` ou `1` | `t.set("stats","0")` |
| `sort` | `rarity`, `name`, `starred`, `added` | liste `F` de la page collection |
| `q` | texte, 3 caractères minimum côté interface | voir 2.1 |
| `rarity` | répétable : `rarity=L&rarity=UR` | `e.append("rarity",r)` |
| `tag_id` | id d'étiquette | idem |
| `untagged` | `1` | idem |
| `wishlisted_by` | pseudo : mes cartes que ce joueur souhaite | idem, utilisé en échange |
| `owned_by` | pseudo : marque mes cartes que ce joueur possède | `r.set("owned_by",e)` (chunk `0tpqxkgbnq21..js`) |

Réponse : `{ collection: [...] }`. Avec `stats=1`, kzfamily lit aussi `total` et `tagOptions` (`fetchJsonRetry('/api/my-collection?sort=rarity&page=0&stats=1'` puis `json?.tagOptions`).

Forme d'une entrée, reconstruite par le site lui-même (chunk `0h28z-agxfm9k.js`) :

```
{id:t.user_card.id,user_id:"",card_id:…,count:1,starred:!1,obtained_at:"",snapshot_rarity:…,snapshot_atk:…,snapshot_def:…,is_shiny:…,card:…}
```

Plus `tags` (liste `{id,name,color}`), lue par le composant carte : `Q.slice(0,…).map(e=>…children:e.name},e.id)`. Plus `owned_by_peer` quand `owned_by` est fourni.

Normalisation appliquée par le site (chunk `02yxms5qtflzx.js`) :

```
effectiveCardListItem: {...t,rarity:e.snapshot_rarity??t.rarity,atk:e.snapshot_atk??t.atk,def:e.snapshot_def??t.def,is_shiny:!0===e.is_shiny}
```

Donc deux raretés coexistent : celle figée à l'obtention (`snapshot_rarity`) et celle de la carte aujourd'hui (`card.rarity`). Le site affiche la première.

Champs de `card` lus quelque part dans le client : `id`, `wikipedia_title`, `wikipedia_url`, `category`, `rarity`, `atk`, `def`, `image_url`, `hide_image`, `pageviews`, `q_score`. `summary` est lu à part dans Supabase. La présence de `pageviews` et `q_score` dans la réponse de `/api/my-collection` reste à vérifier sur une vraie réponse.

Erreurs gérées par le site : 401 (session expirée), 504 (recherche trop longue). Preuve : `401===a.status?…:504===a.status?"La recherche a pris trop de temps.`

### 3.2 `GET /api/my-collection/stats`

Mêmes filtres que ci-dessus, sans `page`. Réponse lue par le site :

- `total` : nombre ou chaîne numérique, converti par `collectionTotalFromPayload` (`if("number"==typeof e)return …;let t=Number(e)`) ;
- `tagOptions` : `{id,user_id,name,color,created_at,cardCount}` (chunk `0tpqxkgbnq21..js` : `e.tagOptions.map(e=>({id:e.id,user_id:e.user_id,name:e.name,color:e.color,created_at:e.created_at,cardCount:e.cardCount}))`).

`total` compte les exemplaires, pas les cartes distinctes, puisque chaque exemplaire est une entrée.

Aucun décompte par rareté n'est lu par le site. kzfamily en cherche un à l'aveugle (`json.rarityCounts, json.rarity_counts, json.rarities, …`). Méthode sûre : 6 appels `stats` avec `rarity=X`, un par rareté.

### 3.3 `GET /api/cards` (catalogue)

Paramètres (chunk `10-~5dwf8ta~s.js`) :

```
t.set("page",String(e.page)),e.search&&t.set("q",e.search),…t.append("rarity",r);
return t.set("sort",e.sortField),e.wishlistFilter&&t.set("wishlist","1"),`/api/cards?${t.toString()}`
```

`sort` : `rarity`, `name`, `atk`, `def`. Page de 50 (`Math.ceil((S??0)/50)`).

Réponse :

| Champ | Sens | Preuve |
|---|---|---|
| `cards` | cartes de la page | `j(s.cards??[])` |
| `total` | total hors recherche, peut être une chaîne | `Number(s.total??0)` |
| `searchHasMore` | page suivante disponible en recherche | `C(!0===s.searchHasMore)` |
| `rarityCounts` | `{L,UR,SR,R,PC,C}` | `$(…s.rarityCounts…)` |
| `ownedCardIds` | ids de la page que je possède | `z(new Set(s.ownedCardIds??[]))` |
| `wishlistCardIds` | ids de la page dans ma liste de souhaits | `e.wishlistCardIds??[]` |
| `friendOwners` | `{cardId: [{id, username}]}` | `R(s.friendOwners??{})` |
| `friendPendingOfferKeys` | clés `ami:carte` | `r.has(\`${e}:${t}\`)` |

En mode `wishlist=1`, `cards` contient la liste de souhaits elle-même : `return t?(e.cards??[]).map(e=>e.id):e.wishlistCardIds??[]`.

### 3.4 `GET /api/profile/{username}/collection`

Paramètres (chunk `0tpqxkgbnq21..js`) :

```
r.set("page",String(ex-1)),r.set("sort","rarity"),1===ex?r.set("stats","1"):r.set("stats","0"),ep&&r.set("q",ep),… r.append("rarity",e);
ey&&r.set("tag_id",ey),e$&&r.set("wishlisted_by_me","1"),r.set("pending","1")
```

Réponse : `collection` (entrées avec `owned_by_viewer`), `total`, `pendingTradeCardIds`, `tagOptions`. Le profil peut être privé (`is_public` modifiable par `PATCH /api/profile/{username}`, chunk `0h28z-agxfm9k.js`).

### 3.5 Tables Supabase lues ou écrites par le client

| Table | Requête dans le client | Chunk |
|---|---|---|
| `user_cards` | `.select("id, card_id, starred, is_shiny, user_card_tags(tag:tags(*))").eq("user_id",eq).in("card_id",t)` | `0wsn99n12v4d_.js` (paquets) |
| `user_cards` | `.update({starred:!e.starred}).eq("id",e.id)` | `14yi4kchm5v2m.js` |
| `cards` | `.select("summary").eq("id",r.id).single()` | `0_myzl748rjvi.js` |
| `tags` | `.select("*").eq("user_id",e_).order("name",{ascending:!0})` | `14yi4kchm5v2m.js` |
| `tags` | `.insert({user_id,name,color})`, `.update({name})`, `.update({color})` | `14yi4kchm5v2m.js` |
| `user_card_tags` | `.upsert(t,{onConflict:"user_card_id,tag_id",…})`, `.delete(…).in("user_card_id",t.slice(a,a+100))` | `14yi4kchm5v2m.js` |
| `wishlist_items` | `.insert({user_id:er,card_id:e.id})`, `.delete().eq("user_id",er).eq("card_id",e.id)` | `10-~5dwf8ta~s.js` |

Colonnes connues : `user_cards(id, user_id, card_id, starred, is_shiny, obtained_at, snapshot_rarity, snapshot_atk, snapshot_def)`, `tags(id, user_id, name, color, created_at)`, `user_card_tags(user_card_id, tag_id)`, `wishlist_items(user_id, card_id)`. Aucun `select` sur `wishlist_items` côté client : la liste passe par `/api/cards?wishlist=1`.

L'extension n'utilise aucune de ces tables directement. Les routes `/api/*` donnent les mêmes données.

## 4. Cartes manquantes : ce qui est faisable

Il n'existe aucun point d'accès qui renvoie « tout le catalogue » ou « tout ce qui me manque ». Le catalogue se parcourt par pages de 50 et le site parle de « millions de lignes ». Une liste complète des manquantes coûterait donc un nombre de requêtes de l'ordre du catalogue divisé par 50. C'est hors de question (règle 8).

La seule voie réaliste : calculer les manquantes dans un périmètre réduit, choisi par le joueur.

| Périmètre | Source | Requêtes | Verdict |
|---|---|---|---|
| Page affichée de `/global-collection` | Badge « Possédée » dans le DOM | 0 | Faisable tout de suite |
| Pages déjà vues pendant la session | `sessionStorage` du site, clés `gc_v11_/api/cards?…`, champ `ownedCardIds` | 0 | Faisable, partiel par nature |
| Ma liste de souhaits | `/api/cards?wishlist=1&page=N` + `ownedCardIds` | 1 par tranche de 50 souhaits | Faisable, peu coûteux |
| Une rareté haute (L, UR) | `/api/cards?rarity=L&sort=name&page=N` | `rarityCounts.L / 50`, arrondi au-dessus | Faisable si le compteur est petit. Le compteur est lisible dans l'en-tête de `/global-collection` avant de lancer |
| Une recherche (`q`, 3 caractères ou plus) | `/api/cards?q=…&page=N` jusqu'à `searchHasMore=false` | inconnu à l'avance | Faisable avec plafond de pages |
| Collection d'un ami | `/api/profile/{u}/collection?page=N`, entrées avec `owned_by_viewer=false` | `total / 50` | Faisable si le profil est public |
| Toutes les raretés basses (C, PC) | idem rareté | trop élevé | Refusé |

Possession : on se fie à `ownedCardIds` renvoyé avec chaque page. Si la copie locale de la collection existe (voir 6.1), on peut aussi croiser par `card_id`, sans requête de plus.

Doublon avec l'existant : la « Toile » du site couvre les cartes liées à un article, les « Familles » de kzfamily couvrent les ensembles faits main. Notre angle : souhaits, raretés hautes, recherche, ami.

## 5. Rendu des cartes dans le DOM

Composant carte : chunk `0qevgzlhsm_i8.js` (module `204043`, même composant dans `0tg2ma5uteqrv.js`).

Ce qu'il n'y a pas :

- aucun attribut `data-*` sur les cartes (recherche `"data-` dans tous les chunks : seulement `data-nimg`, `data-loaded-src`, `data-precedence`, Recharts) ;
- aucun lien `<a>` vers une carte : la racine est un `div` avec `onClick` (`(0,t.jsxs)("div",{onClick:X,onPointerMove:em,…className:eh`) ;
- aucun id de carte ou d'exemplaire dans le DOM. La `key` React (`e.id`) n'apparaît pas dans le HTML.

Points d'ancrage utilisables :

| Élément | Sélecteur | Preuve | Stabilité |
|---|---|---|---|
| Zone principale | `main` | `document.querySelector("main")` dans les pages | Bonne |
| Racine d'une carte | `div.glow-c`, `.glow-pc`, `.glow-r`, `.glow-sr`, `.glow-ur`, `.glow-l`, ou `.glow-shiny.shiny-card` | `let f={C:"glow-c",PC:"glow-pc",R:"glow-r",SR:"glow-sr",UR:"glow-ur",L:"glow-l"}` et `en?"glow-shiny shiny-card isolate":f[G.rarity]` | Bonne : classes métier, définies dans `10lgwo5k.khvv.css` (`.glow-l{box-shadow:…}`) |
| Titre | `h3` dans la racine | `(0,t.jsx)("h3",{ref:es,className:ey,…children:G.wikipedia_title})` | Bonne. Texte complet, coupé seulement visuellement par `line-clamp-2` |
| Rareté | classe `glow-*`, ou texte du badge `div.absolute.top-2.left-2` | `children:G.rarity` | Classe : bonne. Badge : classes Tailwind, moyenne |
| Shiny | `.shiny-card` ou `.shiny-badge` | `en=!0===G.is_shiny&&"L"===G.rarity` | Bonne. Shiny n'existe que pour L |
| Catégorie | premier `p` après le `h3` | `G.category&&…(0,t.jsx)("p",…children:G.category})` | Moyenne |
| Image | `img[crossorigin="anonymous"]`, `src` = `image_url` | `src:o,alt:u?d.SENSITIVE_LABELS.veilTitle:c,…crossOrigin:"anonymous"…unoptimized:!0` | Moyenne. `alt` vaut un libellé de voile si l'image est sensible : ne pas s'en servir comme titre |
| ATK / DEF | dernière ligne, nombres au format `fr-FR` | `G.atk.toLocaleString("fr-FR")` | Moyenne. Enlever les espaces insécables avant de convertir |
| Étiquettes | `span.rounded-full.border-solid` dans la carte, 2 au plus en taille `sm`, puis `+N` | `Q.slice(0,"sm"===er||"xs"===er?2:3)` | Faible : liste tronquée |
| Favori | bouton dans `div.absolute.top-2.right-2`, `aria-label` « Ajouter aux favoris » ou « Retirer des favoris » | `"aria-label":e.starred?"Retirer des favoris":"Ajouter aux favoris"` | Bonne (libellé accessible) |
| Possédée (catalogue) | `span[title="Dans ta collection"]` | `title:"Dans ta collection",children:"Possédée"` | Bonne |
| Amis (catalogue) | `span[title]` contenant les pseudos séparés par des virgules | `title:r.map(e=>e.username).join(", ")` | Moyenne |
| Échange en attente | texte « Échange en attente » | `pendingTradeLabel:r?"Échange en attente"` | Moyenne |
| Titre de page | `h1` dont le texte est « Collection » ou « Collection Globale » | `children:"Collection"` | Moyenne (texte en français) |
| Contrôles | boutons `aria-label` « Trier la collection », « Filtrer par étiquette », « Trier les cartes » | `ariaLabel:"Trier la collection"` | Bonne |
| Pagination | texte « Page X / Y » | `children:["Page ",el+1," / ",eX]` | Moyenne |

Thème : le site a un thème clair (`html.light .card-frame{…}`) et un thème sombre. Les variables `--color-surface`, `--color-border`, `--color-accent`, `--color-rarity-*` sont définies sur la racine. Elles traversent un Shadow DOM, donc notre interface peut les reprendre.

Rattacher une carte du DOM à une donnée : par le titre normalisé (`h3`), plus la rareté pour lever les rares ambiguïtés. Pas besoin de lire les internes React (`__reactProps$…`), qui demanderaient un script dans le monde de la page.

Navigation : Next.js App Router, changements de page sans rechargement. Il faut écouter les changements d'URL (`wxt:locationchange` dans WXT) et un `MutationObserver` sur `main`, car React remplace les nœuds à chaque changement de page ou de filtre.

## 6. Fonctionnalités v1, par ordre de priorité

### 6.1 Copie locale de la collection (socle)

Ce n'est pas une fonction visible, mais les trois suivantes en dépendent.

Flux :

1. Le joueur clique « Synchroniser » (voir 6.2).
2. Appel `GET /api/my-collection/stats?sort=added` : on obtient `total` (exemplaires).
3. Affichage du coût avant de lancer : « 1 + total / 50 requêtes, arrondi au-dessus ».
4. Boucle `GET /api/my-collection?sort=added&page=N&stats=0`, une requête à la fois, pause entre deux (proposition : 1 seconde), arrêt possible.
5. Dédoublonnage par `id` d'exemplaire. Comparaison du nombre obtenu avec `total`. Écart : on garde le résultat et on affiche « collection modifiée pendant la synchro, relancer ».
6. Écriture dans `browser.storage.local`.

Format stocké par exemplaire (noms courts, une ligne par exemplaire) :

| Champ | Origine |
|---|---|
| `userCardId` | `id` |
| `cardId` | `card_id` ou `card.id` |
| `title` | `card.wikipedia_title` |
| `rarity` | `snapshot_rarity ?? card.rarity` |
| `currentRarity` | `card.rarity` |
| `atk`, `def` | `snapshot_atk ?? card.atk`, idem DEF |
| `shiny` | `is_shiny === true` |
| `starred` | `starred` |
| `tags` | ids d'étiquettes, les noms et couleurs sont stockés une fois à part |
| `obtainedAt` | `obtained_at` |
| `category`, `wikipediaUrl`, `imageUrl` | `card.*` |

Contrôle de fraîcheur, 1 requête : à l'ouverture du panneau, appel `stats` sans filtre. Si `total` diffère de la copie, bandeau « Collection modifiée depuis la dernière synchro ». Pas de resynchronisation automatique.

Clé de stockage par compte : `collection:v1:{userId}`. Le `user_id` est présent dans chaque entrée de la réponse. Deux comptes sur le même navigateur ne se mélangent pas.

### 6.2 Export CSV et JSON

Besoin : aucune exportation sur le site (recherche de `csv`, `export`, `Télécharger` dans les chunks : seulement la bibliothèque Supabase).

Où : sur `/collection`, un bouton « Outils » à côté de « Sélectionner », dans la rangée du `h1`. Il ouvre un panneau latéral à droite (Shadow DOM, couleurs reprises des variables du site). Le panneau a trois onglets : Exporter, Vue tableau, Manquantes.

Onglet Exporter :

- état de la copie locale : date, nombre d'exemplaires, nombre de cartes distinctes ;
- bouton « Synchroniser » avec le coût en requêtes, barre de progression, bouton Arrêter ;
- choix du format : CSV ou JSON ;
- choix de la granularité : un exemplaire par ligne, ou une carte par ligne avec une colonne « exemplaires » ;
- option « appliquer les filtres de la vue tableau » ;
- bouton « Télécharger ».

Le CSV :

- séparateur `;`, encodage UTF-8 avec BOM, pour une ouverture directe dans Excel en français ;
- colonnes : titre, rareté, rareté actuelle, shiny, ATK, DEF, catégorie, favori, étiquettes (séparées par `|`), obtenue le, exemplaires, URL Wikipédia, id carte, id exemplaire ;
- protection contre l'injection de formule : toute cellule qui commence par `=`, `+`, `-`, `@`, tabulation ou retour chariot est préfixée d'une apostrophe. Les titres viennent de Wikipédia et le joueur choisit ses noms d'étiquettes, ces valeurs ne sont pas sûres.

Le JSON : `{ format: "wikimasters-collection", version: 1, exportedAt, total, items: [...] }`, mêmes champs que le stockage.

Téléchargement : `Blob` + lien `download` créé par le script de contenu. Pas de permission `downloads` nécessaire.

Coût : 0 requête si la copie locale existe, sinon celui de la synchro.

### 6.3 Vue tableau avec filtres et tris avancés

Pourquoi un tableau et pas un filtre sur la grille du site : la grille ne montre que 50 exemplaires venus du serveur. Masquer des cartes dans la page donnerait des pages à moitié vides et des résultats faux. Le tableau travaille sur la copie locale entière.

Où : onglet « Vue tableau » du panneau, extensible en plein écran au-dessus de `main`.

Filtres, en plus de ceux du site :

- texte sur titre et catégorie, dès 1 caractère, sans accent ni casse (même normalisation que `normalizeCardSearchText` du site : `e.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase()`) ;
- raretés multiples ;
- étiquettes multiples avec ET / OU, et exclusion ;
- favoris seulement ;
- shiny seulement ;
- doublons seulement (2 exemplaires ou plus), avec le nombre exact sur toute la collection ;
- rareté changée depuis l'obtention (`rarity` différent de `currentRarity`) ;
- période d'obtention (du, au) ;
- ATK et DEF minimum / maximum.

Tris : titre, rareté, ATK, DEF, ATK + DEF, date d'obtention, nombre d'exemplaires, catégorie. Tri secondaire par titre.

Colonnes : miniature (image Wikimedia déjà chargée par le site), titre, rareté (pastille aux couleurs `--color-rarity-*`), ATK, DEF, exemplaires, étiquettes, obtenue le, lien Wikipédia.

En-tête du tableau : compte des exemplaires et des cartes distinctes, ventilé par rareté. Ces chiffres viennent de la copie locale, 0 requête.

Action sur une ligne : ouvrir l'article Wikipédia, copier le titre. Rien d'autre. Pour agir sur la carte, le joueur la cherche dans la grille du site (bouton « Copier le titre » pour coller dans la recherche).

Mémoire des filtres : dernière combinaison gardée dans `browser.storage.local` (`collection:view:v1`).

Rendu : liste virtualisée si la collection est grande, pour ne pas créer des milliers de lignes dans le DOM.

### 6.4 Masquer les possédées sur `/global-collection`

Où : une puce « Non possédées » ajoutée à la fin de la rangée des puces de rareté, même style que « Liste de souhaits ». Un compteur à droite : « 12 non possédées sur cette page ».

Fonctionnement : on masque (`display: none` via une classe ajoutée) les racines de carte qui contiennent `span[title="Dans ta collection"]`. Un `MutationObserver` réapplique après chaque changement de page.

Coût : 0 requête.

Limite affichée : « filtre appliqué à la page affichée uniquement ». Le site pagine par 50 côté serveur, on ne peut pas remplir la page avec d'autres cartes.

### 6.5 Listes de manquantes par périmètre

Où : onglet « Manquantes » du panneau.

Périmètres proposés, dans cet ordre :

1. **Liste de souhaits** : souhaits que je ne possède pas encore. Source `/api/cards?wishlist=1&sort=name&page=N`. On garde les cartes absentes de `ownedCardIds`.
2. **Rareté** : L ou UR seulement en v1. Le coût s'affiche avant de lancer, calculé avec `rarityCounts` lu dans l'en-tête de `/global-collection` ou dans le `sessionStorage` du site. Sans compteur connu, le bouton reste désactivé.
3. **Recherche** : un mot-clé de 3 caractères ou plus. Pages successives tant que `searchHasMore` vaut `true`, avec un plafond de pages (proposition : 20), puis « résultats tronqués ».
4. **Collection d'un ami** : pseudo à saisir. Source `/api/profile/{u}/collection`, on garde `owned_by_viewer` à faux. Erreur claire si le profil est privé.

Résultat : même tableau que 6.3 (titre, rareté, ATK, DEF, lien Wikipédia), plus pour les souhaits la colonne « amis qui l'ont » tirée de `friendOwners`. Export CSV / JSON du résultat avec le même code que 6.2.

Lecture gratuite d'abord : avant toute requête, l'onglet lit les clés `gc_v11_*` du `sessionStorage` du site (accessible au script de contenu, même origine). Il propose « X cartes non possédées déjà vues pendant cette session ». La liste de souhaits n'y est jamais (`e.wishlistFilter?null:…`), c'est voulu par le site.

## 7. Cache

| Donnée | Emplacement | Clé | Durée | Invalidation |
|---|---|---|---|---|
| Copie de la collection | `browser.storage.local` | `collection:v1:{userId}` | pas d'expiration | bouton Synchroniser, bandeau si `total` change |
| Étiquettes (nom, couleur) | `browser.storage.local` | dans le même objet | idem | idem |
| Résultat d'un périmètre « manquantes » | `browser.storage.local` | `missing:v1:{userId}:{périmètre}:{paramètres}` | proposition : 24 h | bouton Relancer, date affichée |
| Préférences de la vue | `browser.storage.local` | `collection:view:v1` | pas d'expiration | aucune |
| Compteurs par rareté du catalogue | lus à la volée | aucune | non stocké | relus à chaque visite |

Pourquoi pas de durée sur la collection : la copie reste juste tant que le joueur n'ouvre pas de paquet, n'échange pas, ne défausse pas. Le contrôle `stats` à 1 requête détecte le changement mieux qu'une durée fixe.

Pas de `localStorage` du site : kzfamily y laisse plus de 1300 clés (voir `docs/ANALYSE.md`). Tout va dans le stockage de l'extension.

Taille : `storage.local` est limité à 10 Mo dans Chrome sans la permission `unlimitedStorage`. À mesurer sur une vraie collection avant de choisir entre format compact, `unlimitedStorage` ou IndexedDB.

## 8. Découpage WXT proposé

Un fichier, une responsabilité :

- `entrypoints/collection.content/index.ts` : script de contenu sur `https://www.wiki-masters.com/*`, aiguille selon l'URL ;
- `src/collection/api-client.ts` : appels `GET` typés, rythme limité, arrêt, gestion 401 / 429 / 504 ;
- `src/collection/collection-sync.ts` : synchro page par page, dédoublonnage, contrôle du total ;
- `src/collection/collection-store.ts` : lecture / écriture dans `storage.local` ;
- `src/collection/card-filters.ts` : filtres et tris purs, testables sans navigateur ;
- `src/collection/export-csv.ts` et `src/collection/export-json.ts` ;
- `src/collection/missing-scan.ts` : périmètres de manquantes ;
- `src/collection/site-session-cache.ts` : lecture des clés `gc_v11_*` ;
- `src/collection/dom-anchors.ts` : tous les sélecteurs du chapitre 5 au même endroit ;
- `src/collection/ui/` : panneau, tableau, puce « Non possédées ».

Types stricts pour les réponses, validés à l'exécution (le site peut changer un champ sans prévenir) : toute entrée invalide est ignorée et comptée, pas devinée.

## 9. Cas limites

- Pas connecté : 401, message « reconnecte-toi sur le site », arrêt de la synchro.
- 504 : le site le connaît déjà sur la recherche. Une nouvelle tentative avec attente croissante, puis arrêt.
- 429 : respecter `Retry-After` s'il est présent, sinon arrêt.
- Collection modifiée pendant la synchro (paquet ouvert dans un autre onglet) : dédoublonnage par id d'exemplaire, comparaison au total, bandeau.
- Sens du tri `added` (récent en premier ou non) inconnu : si les nouvelles cartes arrivent en tête, elles décalent les pages pendant la synchro. Le contrôle du total le détecte.
- `snapshot_rarity`, `snapshot_atk`, `snapshot_def` à `null` (anciens exemplaires) : repli sur `card.*`, comme le site.
- Shiny : seulement en L (`"L"===G.rarity`). Un `is_shiny` sur une autre rareté est gardé tel quel dans l'export.
- Image masquée (`hide_image`) ou sensible (flou, `alt` remplacé) : on garde `image_url` dans l'export, on ne l'affiche pas en miniature si `hide_image` est vrai.
- Titres avec caractères spéciaux, guillemets, points-virgules : échappement CSV standard plus protection anti-formule.
- `total` renvoyé en chaîne : conversion comme `collectionTotalFromPayload`.
- Page du site rafraîchie par « tirer pour actualiser » (`onRefresh:eP`) : le `MutationObserver` réinjecte la puce et le bouton.
- Thème clair : interface testée avec `html.light`.
- Carte en échange en attente : signalée dans le tableau si la synchro en a l'info, sinon rien. Pas d'appel `/api/trades` en v1.
- Firefox : vérifier qu'un `fetch` absolu vers `https://www.wiki-masters.com/api/...` depuis le script de contenu envoie bien les cookies de session. Sinon passer par `content.fetch` (spécifique Firefox).

## 10. Questions ouvertes

1. Volume acceptable : une synchro complète coûte `1 + total / 50` requêtes. Faut-il un plafond dur (et lequel), ou seulement l'affichage du coût et une pause entre requêtes ?
2. La réponse réelle de `/api/my-collection` contient-elle `pageviews`, `q_score`, `wikipedia_url` dans `card` ? Le client les lit dans la fiche, mais rien ne prouve qu'ils viennent de cette route. À vérifier sur une vraie réponse, par le joueur, dans les outils réseau du navigateur.
3. `/api/my-collection/stats` renvoie-t-il un décompte par rareté ? Le client ne le lit pas. Sinon on paie 6 appels `stats` filtrés.
4. Sens du tri `added` et stabilité de l'ordre entre deux pages.
5. Lecture du `sessionStorage` du site (`gc_v11_*`) : acceptable vis-à-vis de la règle 3 ? Ce n'est pas une interception réseau, mais c'est une lecture de données internes du site.
6. Taille réelle d'une grosse collection une fois stockée : suffit-il de `storage.local`, ou faut-il `unlimitedStorage` / IndexedDB ?
7. Faut-il coordonner avec kzfamily, déjà installée chez l'utilisateur ? Les deux extensions injecteraient des éléments sur `/collection` et `/global-collection`.
