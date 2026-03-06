# Discord Interaction Bot (Hono + Wrangler)

Ce projet montre comment créer un **bot Discord qui fonctionne uniquement avec des commandes slash** et un endpoint d'interaction.
La logique est déployée en tant que _Cloudflare Worker_ via **Wrangler**, et le serveur HTTP est géré par le framework **Hono**. Un exemple d'accès à Supabase est aussi fourni pour stocker des données si nécessaire.

---

## 🛠️ Prérequis

- Node.js 18+ / npm
- [Wrangler 3+](https://developers.cloudflare.com/workers/tooling/wrangler)
- Un compte Discord et une application/bot configurée
- (optionnel) Un projet Supabase si vous souhaitez utiliser un stockage de données gratuit


## 📁 Structure du projet

```
Nibi/
├─ src/
│  ├─ index.ts            # point d'entrée Worker/Hono
│  └─ register-commands.ts# utilitaire pour enregistrer les slash commands
├─ dist/                 # compilé par TypeScript
├─ package.json
├─ tsconfig.json
├─ wrangler.toml
├─ .env.example
└─ README.md
```

---

## 🚀 Installation

```bash
cd path/to/Nibi
npm install
```

Créez un fichier `.env` (ou utilisez wrangler secrets, voir plus bas) et définissez les variables suivantes :

```ini
PUBLIC_KEY=...
BOT_TOKEN=...
APP_ID=...

# configuration de l'envoi d'e‑mails (utilisé par la commande `sendVerificationCode`)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false            # true pour 465
EMAIL_USER=username
EMAIL_PASSWORD=password
EMAIL_FROM="noreply@example.com"
# facultatif : ignore les certificats TLS invalides (voir code)
EMAIL_TLS_INSECURE=false

# si vous utilisez Supabase :
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

Note : `PUBLIC_KEY` est la clé publique de l'application Discord utilisée pour vérifier les signatures d'interaction.

### 🔐 Variables d'environnement

> ℹ️ **Table `kv` requise**
> Le code utilise Supabase comme simple clé/valeur dans une table `kv` (`key text PRIMARY KEY, value jsonb`).
> Si vous voyez une erreur du type "Could not find the table 'public.kv'", créez la table
> manuellement via le SQL suivant :
>
> ```sql
> create table if not exists public.kv (
>   key text primary key,
>   value jsonb
> );
> ```
>
> Vous pouvez exécuter cette commande dans l'interface SQL de Supabase ou via
> le CLI. Les helpers du projet attrapent l'absence de table et retournent
> `null`, mais le schéma doit exister pour les écritures.
>
> **Contrôle d'accès (RLS)** : les nouvelles tables Supabase ont le
> _row level security_ activé par défaut, ce qui empêche toute écriture
> via la clé anon. Pour que le bot puisse mettre à jour `kv` vous devez soit :
>
> ```sql
> -- désactiver RLS :
> alter table public.kv disable row level security;
>
> -- ou bien autoriser explicitement la clé anon :
> alter table public.kv enable row level security;
> create policy anon_rw on public.kv for all using (true);
> ```
>
> Sans cette configuration, les appels `writeJson` échoueront avec
> `new row violates row-level security policy for table "kv"`. Le helper
> affiche désormais un message d'avertissement si l'erreur survient.


### 🔐 Variables d'environnement

- **Wrangler secrets** (recommandé pour la production) : 
  ```bash
  wrangler secret put PUBLIC_KEY
  wrangler secret put BOT_TOKEN
  wrangler secret put APP_ID
  wrangler secret put SUPABASE_URL
  wrangler secret put SUPABASE_ANON_KEY
  ```

- Les variables listées dans `wrangler.toml` sous `[vars]` sont visibles en clair dans le dépôt ; évitez de les y stocker.

---

## 🧩 Enregistrement des commandes (slash commands)

Les définitions de slash commands sont désormais stockées dans le dossier `src/commands` (un fichier par commande).

Le script `src/register-commands.ts` charge dynamiquement tous les fichiers du dossier `src/commands` :

```bash
npm run register-commands
```

Ajoutez simplement un nouveau fichier TypeScript exportant un objet `Command` (voir `src/commands/hello.ts` comme exemple) pour que le script de registration le prenne en compte. Ces modules ne sont **pas exécutés** dans le worker.

Le code qui s’exécute dans Cloudflare est défini dans `src/command-handlers.ts`. Chaque entrée est une fonction qui reçoit l’objet d’interaction brut et doit renvoyer un **payload JSON** conforme à l’API Discord (type 4 pour réponse). C’est ici que vous utiliserez `databaseUtils` et d’autres utilitaires orientés HTTP.

```ts
// exemple extrait de command-handlers.ts
export const commandHandlers = {
  hello: async (interaction) => {
    const user = interaction.data.options?.find(o=>o.name==='user')?.value;
    return { type: 4, data: { content: `Salut ${user||'anon'}` } };
  },
  // ...
};
```

La séparation permet au worker de rester léger et sans dépendance à `discord.js`.

---

## 📡 Développement local

```bash
npm run build         # compile TypeScript
npm run dev           # démarre le worker local (wrangler)
```

Une fois la commande `dev` lancée, vous aurez une URL temporaire (ou `http://localhost:8787`) vers laquelle Discord doit envoyer les interactions.

Assurez-vous de copier l'URL fournie et de la mettre comme **URL de callback** dans la section "Interactions Endpoint" de votre application Discord.

> ⚠️ *Discord validera l'endpoint à chaque demande en envoyant un PING.*

---

## 📦 Déploiement

```bash
npm run build
npm run deploy
```

Après déploiement, mettez l'URL fournie par Wrangler dans la configuration d'application Discord.

---

## 📖 Exemple de gestion d'interaction

Le fichier `src/index.ts` illustre la vérification de signature, la réponse au PING et un handler basique pour le slash command `hello`. Vous pouvez les adapter selon vos besoins :

```ts
switch (name) {
  case 'hello':
    return c.json({ type: 4, data: { content: 'Bonjour !' } });
  // ...
}
```

Ajoutez aussi des appels à Supabase via `supabase` si vous avez besoin de stocker des données.

---

## 🤖 Tâches périodiques via GitHub Actions

Le code de l'ancien bot contenait plusieurs *daemons* qui tournaient en continu à l'aide de `discord.js` : gestion du rôle "verified", attribution de rôles de base et vérification des graduations sur Google Sheets.
Dans la nouvelle version nous pouvons extraire cette logique dans des *actions GitHub* qui s'exécutent sur un horaire et communiquent avec l'API Discord via `fetch` (le package `discord.js` n'est pas nécessaire). Les scripts TypeScript sont placés dans `src/daemons-gh` et trois workflows sont fournis :

| Workflow | Fichier | Cron par défaut |
|----------|---------|----------------|
| manage_verified_role | `.github/workflows/manage_verified_role.yml` | toutes les 5 min |
| verify_graduations | `.github/workflows/verify_graduations.yml` | toutes les 15 min |
| default_role_giver | `.github/workflows/default_role_giver.yml` | chaque heure |

### Configuration requise

1. **Secrets GitHub**
   - `BOT_TOKEN` – token du bot Discord
   - `GUILD_ID` – id du serveur
   - `SUPABASE_URL` et `SUPABASE_ANON_KEY` (si vous utilisez Supabase pour stocker les listes `users` / `lessons`)
   - `CHAT_CHANNEL_ID` (pour `verifyGraduations`), `VERIFIED_ROLE_ID`, `STAFF_ROLE_ID`, `NORMAL_ROLE_ID`, `GRAD_ROLE_ID`, `BOT_ROLE_ID` peuvent être ajoutés pour surcharger les valeurs par défaut.

2. Les workflows font un `pnpm install` puis utilisent `ts-node` pour lancer les scripts.

3. Vous pouvez déclencher manuellement chaque action depuis l'onglet *Actions* de GitHub (`workflow_dispatch`).


## 📌 Notes

- **Interaction endpoint uniquement** : ce bot n’utilise **aucun WebSocket** et ne recevra donc **pas d’événements presence, messages, etc.**. Tout se passe via les commandes slash.
- Si vous n’avez pas besoin de stockage, vous pouvez supprimer la dépendance @supabase/supabase-js et l’utilisation correspondante.
- Wrangler 3+ compile automatiquement TypeScript vers JavaScript ; l’exemple utilise le dossier `dist`.

---

🎉 Vous êtes prêt à construire un bot Discord avec des slash commands hébergé par Cloudflare Workers ! Bonne programmation.
