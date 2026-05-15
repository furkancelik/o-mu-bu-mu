# o mu bu mu?

İkili görsel oylama oyunu. Yönetici resim yükler, paylaşım linki oluşur; ziyaretçiler turnuvayı oynar, akıllı bir algoritma her resmi adil şekilde gösterip galibi süzer.

## Yığın

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- GraphQL Yoga API + Mongoose
- MongoDB (lokal veya Atlas)
- Cloudinary (resim depolama + on-the-fly transformation)
- Cookie tabanlı admin auth (`jose` ile imzalı JWT)

## Lokal kurulum

```bash
cp .env.example .env.local       # değerleri doldur
npm install
npm run dev
```

Açılan adres: <http://localhost:3000> (3000 doluysa Next otomatik 3001'e geçer).

Yönetici paneli: <http://localhost:3000/admin/login> — `.env.local`'daki `ADMIN_PASSWORD` ile gir.

## Yayına alma (Netlify + Atlas + Cloudinary)

### 1. MongoDB Atlas (ücretsiz)

1. <https://www.mongodb.com/cloud/atlas/register> hesap aç
2. **Create free cluster** (M0, AWS / Frankfurt veya en yakın bölge)
3. **Network Access** → Add IP → `0.0.0.0/0` (Netlify IP'leri dinamik)
4. **Database Access** → kullanıcı oluştur, parolayı sakla
5. **Connect → Drivers** → connection string'i kopyala
   - Şekil: `mongodb+srv://USER:PASS@cluster.xxx.mongodb.net/omubumu?retryWrites=true&w=majority`

### 2. Cloudinary (ücretsiz)

1. <https://cloudinary.com/users/register_free> hesap aç
2. Dashboard'da **Cloud name**, **API Key**, **API Secret** üçünü kopyala

### 3. Netlify

1. Repoyu GitHub'a push et
2. <https://app.netlify.com/start> → repoyu seç
3. Build command otomatik gelir (`netlify.toml`'dan okur), elleme
4. **Site settings → Environment variables** kısmında şunları ekle:

   | Anahtar | Değer |
   |---|---|
   | `MONGODB_URI` | Atlas connection string |
   | `ADMIN_PASSWORD` | İstediğin parola |
   | `AUTH_SECRET` | `openssl rand -hex 32` çıktısı |
   | `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
   | `CLOUDINARY_API_KEY` | Cloudinary api key |
   | `CLOUDINARY_API_SECRET` | Cloudinary api secret |

5. **Deploy site** → birkaç dakika sonra yayında

### 4. İlk admin girişi

Yayına çıktıktan sonra: `https://<site-adın>.netlify.app/admin/login` — `ADMIN_PASSWORD` ile giriş yap.

## Mimari notları

- **Eşleştirme algoritması** (`src/lib/matchmaking.ts`): 3 fazlı hibrit Elo.
  1. *Keşif* — her resim eşit gösterilene kadar
  2. *Sıralama* — Elo'su yakın resimler eşleşir
  3. *Final* — top 4 → top 2 → tek galip
- **Server component'ler** Mongoose'a doğrudan gider (`src/lib/data.ts`), GraphQL HTTP round-trip yok.
- **Client component'ler** GraphQL'i HTTP üzerinden çağırır.
- **Admin auth** middleware ile `/admin/*` rotalarını korur; GraphQL admin mutation'ları context.isAdmin kontrolüyle ayrıca korunur.
- **Oturum state'i** sunucuda saklanır (`VoteSession` koleksiyonu); kullanıcının tarayıcısında sadece `sessionKey` localStorage'da tutulur.
