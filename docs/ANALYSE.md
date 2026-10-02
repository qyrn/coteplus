# Analyse de wiki-masters.com

Relevé du 2 octobre 2026. Les sources brutes sont dans `reference/` (ignoré par git).

## Le jeu

Jeu de cartes à collectionner basé sur Wikipédia FR. Chaque carte = un article réel.

- Rareté selon la fréquentation de l'article, attaque selon la longueur, défense selon la qualité
- 6 raretés : C (Commun), PC (Peu Commun), R (Rare), SR (Super Rare), UR (Ultra Rare), L (Légendaire)
- Monnaie : les wikibidous
- Paquets de 5 cartes, stock max 10, 1 paquet régénéré toutes les 10 min (3 min en Pro)
- Pro (Stripe sur le web, IAP sur mobile) : regen plus rapide, 10 enchères simultanées au lieu de 5, paquet Pro quotidien
- Duels quiz tirés de ses propres cartes, parties multijoueur (3 à 300 joueurs, 15 questions, 15 s par question)
- Échanges, marché aux enchères, guildes, amis, messages privés, succès, classement, vitrines (10 galeries de 4 cartes)

## Stack technique

- Next.js (App Router, Turbopack), hébergé sur Vercel
- Supabase : auth, Postgres via REST, Realtime
- Cloudflare Turnstile pour la vérification humaine
- Capacitor : la même base de code tourne en app iOS/Android
- Tailwind CSS, polices Outfit et Inter, thème sombre (fond `#0c0d0c`, accent `#34d399`)
- Couleurs de rareté exposées en variables CSS : `--color-rarity-c|pc|r|sr|ur|l`
- Images des cartes servies directement par Wikimedia (`upload.wikimedia.org`, `thumb.wikimedia.org`)

## Routes de l'app

Publiques : `/signup`, `/login`, `/verify-email`, `/rules`, `/terms`

Connecté : `/pulls`, `/collection`, `/global-collection` (`?wm=themes` pour les familles), `/trades`, `/marketplace`, `/marketplace/[id]`, `/profile`, `/guild`, `/friends`, `/dms`, `/battle`, `/battle/duels/[id]`, `/achievements`, `/leaderboard`, `/settings`

## API interne (`/api/*`)

| Domaine | Endpoints |
|---|---|
| Paquets | `packs/open`, `packs/grace`, `packs/special`, `packs/pro-daily` |
| Collection | `my-collection`, `my-collection/stats`, `user-cards/{id}/discard`, `user-cards/bulk-discard` |
| Cartes | `cards`, `cards/{id}/web`, `cards/{id}/image-report`, `image-reports/mine` |
| Marché | `marketplace`, `marketplace/mine`, `marketplace/cards/{id}/sales` |
| Échanges | `trades`, `trades/{id}`, `trades?active=1` |
| Social | `friends`, `friends/{id}`, `friends/search`, `friends/accept-all`, `chat`, `chat/{id}` |
| Guildes | `guilds`, `guilds/home`, `guilds/members`, `guilds/chat`, `guilds/wishlist`, `guilds/wishlist/donate`, `guilds/leaderboard`, `guilds/zevent-standings`, `guilds/join/leave/invite/kick/transfer-leadership` |
| Jeu | `battles`, `battles/{id}`, `parties`, `achievements/check`, `achievements/claim`, `showcase`, `showcase/gallery` |
| Compte | `account`, `profile/{username}`, `profile/{username}/collection`, `notifications`, `wikibidous`, `reports`, `appeals` |
| Paiement | `checkout`, `billing/portal`, `iap/verify` |
| Sécurité | `human-check`, `auth/log-security-event`, `auth/post-confirmation`, `auth/signup-check`, `auth/username-available` |

Tables Supabase lues côté client : `profiles`, `cards`, `user_cards`, `tags`, `user_card_tags`, `wishlist_items`, `achievements`, `user_achievements`, `chat_messages`, `user_push_tokens`.

Canaux Realtime : `notifications:{id}`, `profile:{id}`, `chat:{a,b}`, `dms-list`, `chat-trades`, `guild-chat`, `guild-members`, `friendships-*`.

## Anti-triche

- Règle 3 des règles communautaires : interdit les bots, scripts, macros et tout outil qui joue, ouvre des paquets, échange ou interagit à la place du joueur. Interdit aussi l'interception du trafic pour obtenir un avantage
- `packs/open` peut répondre `human_verification_required`, ce qui déclenche un Turnstile
- Le client envoie des événements à `auth/log-security-event`
- Notification `admin_cheat_warning` côté serveur, signalement "Triche" disponible pour les joueurs

Conséquence pour notre extension : rester sur de l'affichage, de l'organisation et de l'information. Jamais d'action automatique à la place du joueur.

## Extension existante : "WikiMasters - Prix moyen collection" (kzfamily)

Déjà installée dans le Chrome de l'utilisateur, v4.27.7, code dans `reference/kzfamily-4.27.7/`.

Fonctions : prix moyens (collection, paquets, marché), récap et stats de paquets, ouverture automatique, mode compact, outils d'échange, classement, actions groupées sur la collection, familles de cartes (via Wikidata), images de remplacement pour les cartes sans image.

Points faibles relevés :
- JavaScript brut, environ 450 Ko de JS et 100 Ko de CSS injectés sur chaque page du site
- Plus de 1300 clés `wm_avg_v3_*` dans le localStorage du site, sans nettoyage
- Bouton "Ouvrir automatiquement" : contraire à la règle 3, risque de sanction pour l'utilisateur
- Lien sponsorisé injecté dans l'interface du jeu
