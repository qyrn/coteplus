# Alerte paquets

Spec de la fonction "Alerte paquets". Relevé du 2 octobre 2026, fait uniquement sur les fichiers locaux de `reference/`.

Objectif : prévenir le joueur quand son stock de paquets est plein (ou atteint un seuil), pour ne perdre aucune régénération. Ça doit marcher même onglet du site fermé.

Règle de base : l'extension lit et notifie. Elle n'ouvre rien, n'appelle jamais `/api/packs/open`, `/api/packs/grace`, ni aucune requête POST.

## 1. Ce que fait le site côté client

### Constantes de régénération

Elles sont dans un module partagé.

`0zk0wzl15-vto.js` :
```js
e.s(["PACK_REGEN_PERIOD_MINUTES",0,10,"PACK_REGEN_PERIOD_MS",0,6e5,
     "PACK_REGEN_PERIOD_PRO_MINUTES",0,3,"PACK_REGEN_PERIOD_PRO_MS",0,18e4])
```

Donc 10 min (600 000 ms) en normal, 3 min (180 000 ms) en Pro.

### Stock maximum

Le 10 est écrit en dur dans la page `/pulls`, pas dans une constante.

`0wsn99n12v4d_.js` :
```js
if(null===eF||eF>=10||!eV)return;
```
```js
children:o?.packs_remaining??0 ... children:" / 10" ... "paquets disponibles"
```

Le compte à rebours s'arrête dès que le stock vaut 10 ou plus. Le site ne compte donc rien au delà de 10.

### D'où viennent les champs du profil

Sur `/pulls`, le profil (avec `packs_remaining`, `packs_last_regen_at`, `is_pro`) vient de la RPC Supabase `sync_profile_packs`.

`0wsn99n12v4d_.js` :
```js
eE=(0,n.useCallback)(async()=>{ ... let{data:e}=await K.rpc("sync_profile_packs",{user_id:X}),
t=Array.isArray(e)?e[0]:e;return t?((0,O.syncIsProCache)(t.is_pro),u(t),f(!1),t) ...
```

Ailleurs, la barre de navigation lit le profil via `get_my_profile`, mais ne se sert que du solde de wikibidous et des rôles.

`0zk0wzl15-vto.js` :
```js
async function t(e){let{data:t,error:r}=await e.rpc("get_my_profile");return r||!t?null:t}
e.s(["fetchMyProfile",0,t])
```
`0ulf0g4nvno~r.js` :
```js
let e=await (0,D.fetchMyProfile)(N);"number"==typeof e?.wikibidous_balance&&g(e.wikibidous_balance)
```

On ne sait pas si `get_my_profile` renvoie aussi les champs de paquets. Aucun code client ne les lit à cet endroit.

Point important : `rpc()` de supabase-js envoie un POST par défaut. Le GET n'existe que si on passe `{get:true}`.

`0dya-sj8ypjmp.js` :
```js
rpc(e,t={},{head:r=!1,get:s=!1,count:i}={}){ ... r||s?(a=r?"HEAD":"GET" ...
```

Les deux RPC du site sont donc des POST. L'extension ne doit appeler ni l'une ni l'autre.

### La régénération est calculée côté serveur

Le client ne fait qu'afficher un compte à rebours. Quand il arrive à zéro, il redemande le profil au serveur, avec un recul exponentiel (1 s puis doublement, plafonné à 60 s).

`0wsn99n12v4d_.js` :
```js
let e=eB?c.PACK_REGEN_PERIOD_PRO_MS:c.PACK_REGEN_PERIOD_MS,t=Z(eE),r=()=>{
let r=new Date(new Date(eV).getTime()+e).getTime()-Date.now();
if(!Number.isFinite(r)||r<=0){ez("Prêt !"),t();return}
r>e&&!eq.current&&(eq.current=!0,t());
let a=Math.min(r,e) ...
```
```js
function Z(e){let t=1e3,r=0;return()=>{let a=Date.now();a<r||(r=a+t,t=Math.min(2*t,6e4),e())}}
```

Ce qu'on en tire :
- prochain paquet = `packs_last_regen_at` + période
- le client n'incrémente jamais le stock lui même, c'est `sync_profile_packs` qui le fait
- si le temps restant dépasse une période (horloge locale en retard), le client force une resynchro

### Ce qui modifie le stock

| Action | Effet côté client | Preuve (`0wsn99n12v4d_.js`) |
|---|---|---|
| Ouvrir un paquet | `packs_remaining` remplacé, `packs_last_regen_at` aussi s'il est renvoyé | `u(e=>e?{...e,packs_remaining:t.packs_remaining,..."string"==typeof t.packs_last_regen_at?{packs_last_regen_at:...` |
| Grâce VIP (stock à 0) | les deux champs remplacés | `fetch("/api/packs/grace",{method:"POST"}) ... packs_remaining:t.packs_remaining,packs_last_regen_at:t.packs_last_regen_at` |
| Recharge payante (Stripe ou App Store) | resynchro complète | `"Paiement confirmé ! Vos paquets ont été rechargés."` |
| Passage en Pro | resynchro complète, période qui change | `"Bienvenue en PRO ! Régénération 3 min + pack quotidien."` |
| Paquet spécial, pack Pro du jour | ne touchent pas `packs_remaining` | `/api/packs/special` et `/api/packs/pro-daily` ne mettent à jour que cartes et `next_available_at` |
| Sanction | blocage via `activity_blocked_until` ou `packs_blocked_until` | `eL=!!o&&!!(e=o.activity_blocked_until??o.packs_blocked_until??null)&&...` |

### Le site n'a aucune alerte "paquets pleins"

Le site a une infra de Web Push (service worker `/sw.js`, clé VAPID, `/api/push/web-subscription`) et du push natif Capacitor (`user_push_tokens`).

`0.7iei4a7u_29.js` :
```js
let i="/api/push/web-subscription"; ... navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"})
```

Mais aucun type de notification ne parle de paquets. Liste complète des types affichés :

`0ulf0g4nvno~r.js` : `admin_cheat_warning`, `admin_sanction`, `battle_accepted`, `battle_invite`, `chat_message`, `friend_request`, `guild_invite`, `guild_join`, `marketplace_auction_midpoint_nudge`, `marketplace_auction_sold`, `marketplace_auction_unsold`, `marketplace_auction_won`, `marketplace_outbid`, `marketplace_wishlist_listed`, `trade_accepted`, `trade_countered`, `trade_declined`, `trade_offer`.

La seule chaîne "packs" liée aux achats est un produit App Store : `let t="10_packs_refill"` (`0zk0wzl15-vto.js`).

### L'extension concurrente ne le fait pas non plus

kzfamily ne suit pas le stock. Elle ouvre les paquets sur une minuterie aléatoire.

`features/packs.js` (ligne 458) : "l'extension attend aléatoirement entre 20 et 100 minutes puis utilise « Tout ouvrir »".

Pour lire les données, elle remplace `window.fetch` et `XMLHttpRequest`, et copie les en-têtes des requêtes Supabase (dont `Authorization`).

`bridge/intercept.js` :
```js
window.fetch = (...args) => { try { captureSupabaseRequest(args[0], args[1] || {}); ...
```
`bridge/core.js` :
```js
supabaseRequestTemplate = { url: String(url), headers };
```

C'est exactement ce qu'on ne veut pas faire.

## 2. Source de données retenue

### Un seul relevé suffit

Avec trois valeurs, on calcule tout localement :
- `s` = stock actuel
- `prochain` = instant du prochain paquet
- `p` = période (600 000 ms ou 180 000 ms selon Pro)

Formules :
- `plein_a = prochain + (10 - s - 1) * p` si `s < 10`
- `seuil_a = prochain + (N - s - 1) * p` si `s < N`
- stock estimé à l'instant `t` : `min(10, s + 1 + floor((t - prochain) / p))` si `t >= prochain`, sinon `s`

Ensuite, `chrome.alarms` avec un `when` absolu. Zéro requête réseau, zéro sondage.

Hypothèse à confirmer : le serveur avance `packs_last_regen_at` d'une période à chaque paquet régénéré (régénération paresseuse). Le comportement du client va dans ce sens, mais le code SQL de `sync_profile_packs` n'est pas visible.

### Quand il faut relire

- après une ouverture de paquet (sur le site web ou sur l'app mobile)
- après une grâce VIP ou une recharge payante
- quand le statut Pro change (abonnement ou expiration)
- à la fin d'une sanction
- au changement de compte

Les paquets spéciaux et le pack Pro du jour ne demandent pas de relecture.

### Option A, retenue : lire l'écran de `/pulls`

Un content script sur `https://www.wiki-masters.com/pulls*` lit ce que le joueur voit déjà :
- le stock : le nombre avant `" / 10"` dans le bloc "paquets disponibles"
- le compte à rebours : le texte `m:ss` après "Prochain dans" (ou "Prêt !")
- le statut Pro : présence du bloc "Pack PRO du jour", rendu seulement si `o?.is_pro&&!eL` (`0wsn99n12v4d_.js`)
- la sanction : présence du texte "Sanction anti-triche active"

En complément pour Pro, la page émet un événement DOM à chaque synchro. Un content script peut l'écouter sans toucher au réseau.

`0zk0wzl15-vto.js` :
```js
l="wikimasters:is-pro-changed" ... "syncIsProCache",0,function(e){s=e,n=Date.now(),window.dispatchEvent(new CustomEvent(l,{detail:e}))}
```

Dernier indice Pro : un compte à rebours supérieur à 3:00 prouve que le compte n'est pas Pro.

Calcul à partir de l'écran : `prochain = maintenant + compte_à_rebours`. Précision à la seconde, suffisante.

Avantages :
- aucune requête, aucun jeton, aucune permission `cookies`
- pas de patch de `fetch`, donc pas d'"interception du trafic"
- tant que `/pulls` reste ouvert, le site se resynchronise lui même à chaque paquet, et l'écran suit

Limites :
- il faut passer sur `/pulls` au moins une fois après chaque action faite ailleurs (app mobile surtout)
- dépend des textes de l'interface, à surveiller à chaque mise à jour du site

Règles d'implémentation :
- `MutationObserver` limité au bloc du stock
- le compte à rebours change chaque seconde : n'envoyer au background que si le stock change ou si `prochain` bouge de plus de 2 s
- ignorer "Prêt !" et attendre la valeur suivante

### Option B, écartée en v1 : un GET depuis le background

Le site stocke la session Supabase dans un cookie géré par `@supabase/ssr` 0.9.0.

`0dya-sj8ypjmp.js` :
```js
const o=`sb-${a.hostname.split(".")[0]}-auth-token`
```
```js
let rA="base64-"; ... cookieEncoding:s?.cookieEncoding??"base64url" ... "X-Client-Info":"supabase-ssr/0.9.0 createB...
```
```js
function rT(e,t,r){let s=r??3180, ... name:`${e}.${r}`
```

Avec le projet `cyrxjeppjqsxxjayfrur`, le cookie s'appelle `sb-cyrxjeppjqsxxjayfrur-auth-token`. Il est découpé en `.0`, `.1`… au delà de 3180 caractères encodés. Sa valeur commence par `base64-` puis contient la session JSON en base64url.

Un GET possible serait `/rest/v1/profiles?select=packs_remaining,packs_last_regen_at,is_pro&id=eq.<uid>` avec `apikey` et `Authorization: Bearer`. Le site lit déjà sa propre ligne de `profiles` (`from("profiles").select("is_pro").eq("id",t)` dans `0zk0wzl15-vto.js`), mais on ignore si ces colonnes sont lisibles.

Pourquoi on l'écarte :
- il faut la permission `cookies` et manipuler le jeton de session du joueur
- le jeton d'accès expire. Le rafraîchir demande un POST sur `/auth/v1/token`, qui fait tourner le refresh token et peut déconnecter le site
- la requête ne vient pas du site, elle est repérable côté serveur
- la règle 3 interdit "l'interception du trafic pour obtenir un avantage". Lire le cookie d'auth s'en approche trop

### Option C, refusée : lire les réponses réseau

Patcher `fetch` dans la page pour lire la réponse de `sync_profile_packs`, comme kzfamily. C'est de l'interception de trafic au sens de la règle 3. `webRequest` ne lit pas les corps de réponse sous Chrome, et `filterResponseData` sous Firefox reste de l'interception. Refusé.

### Meilleure solution à long terme

Demander au développeur du site un type de notification "paquets pleins". L'infra Web Push existe déjà, et le serveur connaît la vraie valeur.

## 3. Différences Chrome et Firefox

À revérifier dans la doc officielle au moment de coder.

| Sujet | Chrome (MV3) | Firefox (MV3) |
|---|---|---|
| Fond | service worker, arrêté quand il est inactif | page d'événements (`background.scripts`), avec DOM |
| `alarms` | période minimale de 30 s depuis Chrome 120. Les alarmes peuvent disparaître au redémarrage du navigateur | minimum à vérifier. Persistance au redémarrage à vérifier |
| Alarme manquée (veille) | déclenchée au réveil | à vérifier |
| `notifications` | types `basic`, `image`, `list`, `progress`, boutons, `requireInteraction`, `silent` | `basic` seulement à notre connaissance, pas de boutons. `silent` à vérifier |
| Badge | `action.setBadgeText`, `setBadgeBackgroundColor`, `setBadgeTextColor` | mêmes fonctions via `browser.action` |
| Son | pas d'audio dans le service worker : document `offscreen` avec la raison `AUDIO_PLAYBACK`, permission `offscreen` | pas d'`offscreen`. `new Audio()` marche dans la page d'événements |
| Permissions d'hôte | accordées à l'installation | optionnelles par défaut en MV3 : prévoir une demande explicite |

Conséquences pour la conception :
- tout l'état vit dans `storage.local`, jamais en mémoire
- au `runtime.onStartup` et à l'`onInstalled`, recalculer et reposer les alarmes depuis l'état
- nos alarmes tombent toutes les 3 ou 10 min au plus serré, donc la période minimale ne pose pas de problème
- le son passe par une petite couche : `offscreen` sous Chrome, `Audio` direct sous Firefox. Si on joue notre son, demander une notification `silent` là où c'est supporté, pour éviter deux sons
- sous Windows, l'assistant de concentration peut masquer les notifications système. Le badge reste le repère fiable

## 4. Proposition UX pour la v1

### Badge

- texte : stock estimé (`0` à `10`)
- couleur neutre sous le seuil, couleur d'accent du site (`#34d399`) au seuil ou plein
- `?` si l'état est inconnu (jamais lu, déconnecté, sanction)
- mise à jour par une alarme "tic" posée à chaque `prochain`, puis toutes les `p` jusqu'au plein. Aucune alarme quand le stock est plein

### Notification

Une seule par cycle, avec un identifiant fixe pour remplacer la précédente.

- Seuil atteint : titre "Paquets disponibles", texte "Tu as environ 8 paquets sur 10. Plein vers 14 h 30."
- Plein : titre "Stock de paquets plein", texte "10 paquets t'attendent. La régénération est en pause tant que tu n'en ouvres pas."
- Plein détecté en retard (veille, heures calmes) : "Stock plein depuis 14 h 30 environ."

Le mot "environ" reste, car la valeur est estimée.

Un clic ouvre ou met au premier plan un onglet `/pulls`. Il n'ouvre rien d'autre. Le site fait alors sa propre synchro, ce qui recale l'extension.

### Réglages

1. Alertes activées (oui par défaut)
2. Seuil : de 1 à 10 (10 par défaut, soit "plein")
3. Son : oui ou non (non par défaut)
4. Heures calmes : début et fin, plage qui peut passer minuit. Rien pendant la plage. Si le seuil tombe dedans, une notification à la fin de la plage, si le stock estimé y est toujours
5. Badge affiché : oui ou non

Le popup montre aussi l'état lu : stock, prochain paquet, Pro détecté ou non, date du dernier relevé.

### Cas limites

- **Plusieurs onglets** : chaque onglet `/pulls` envoie ses relevés. Le background garde le plus récent par horodatage et ignore les doublons
- **App mobile** : un paquet ouvert sur téléphone n'est pas vu. L'extension surestime alors le stock. D'où le "environ" et l'affichage de la date du dernier relevé
- **Déconnexion** : visite de `/login` ou `/signup`, ou `/pulls` sans bloc de stock. On efface l'état, badge `?`, alarmes supprimées. Un changement de compte passe forcément par là
- **Décalage d'horloge** : le site et l'extension utilisent la même horloge locale. L'erreur est donc la même que celle du compte à rebours affiché par le site. On ne corrige pas en v1
- **Fin du Pro** : on ne connaît pas la date d'expiration. Si le Pro tombe, l'alerte arrive trop tôt jusqu'au prochain passage sur `/pulls`. Le bloc "Pack PRO du jour" absent ou un compte à rebours au dessus de 3:00 corrige l'état
- **Sanction** : texte "Sanction anti-triche active" présent : aucune alerte, badge `?`
- **Stock au delà de 10** : traité comme plein, comme le site (`eF>=10`)
- **Chrome et Firefox installés tous les deux** : deux alertes possibles. On le signale dans l'aide, sans plus

### Permissions demandées

`storage`, `alarms`, `notifications`, `offscreen` (Chrome seulement), et l'hôte `https://www.wiki-masters.com/*` pour le content script et la recherche d'onglet au clic. Pas de `cookies`, pas d'hôte Supabase.

## Questions ouvertes

1. Le serveur avance-t-il bien `packs_last_regen_at` d'une période par paquet ? Sinon la formule du plein est fausse. À vérifier en observant `/pulls` sur deux cycles
2. Quand le stock repasse sous 10 après une ouverture, l'ancre repart-elle de l'instant d'ouverture ? Le client accepte un `packs_last_regen_at` dans la réponse de `/api/packs/open`, ce qui le laisse penser
3. Au passage Pro vers normal, comment le serveur traite-t-il le temps déjà écoulé ?
4. La régénération continue-t-elle pendant une sanction ?
5. Le développeur du site accepterait-il d'ajouter une notification "paquets pleins" à son Web Push ? Ce serait plus fiable que toute extension

## Vérifié sur une session réelle

Le 3 octobre 2026 : après une ouverture depuis un stock plein (10/10), le compte à rebours affiche environ 10 min. La régénération repart du moment de l'ouverture. Tant que le stock reste à 10/10, aucun temps n'est accumulé.
