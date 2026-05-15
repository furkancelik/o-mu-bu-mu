# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Komutlar

```bash
npm run dev      # Turbopack ile dev server (3000 doluysa otomatik 3001)
npm run build    # Production build — TypeScript ve route validation çalıştırır
npm run lint     # ESLint
npm run start    # Production server (build sonrası)
```

Test komutu/framework yok. TypeScript ve lint check'i `npm run build`'in parçasıdır; lokal doğrulama için `npx tsc --noEmit` + `npm run lint` yeterli.

## Yığın notları

- **Next.js 16** — App Router, React 19, Tailwind v4 (`@import "tailwindcss"`, config dosyası yok), Turbopack default. `node_modules/next/dist/docs/` içindeki rehberlere bak; eski Next.js bilgisine güvenme.
- **GraphQL Yoga 5** — `src/app/api/graphql/route.ts` üzerinden Next.js route handler olarak servis edilir. Yoga'nın TypeScript generic'leri katı — context'i `createYoga({...})` çağrısındaki `context` callback'in return type'ı üzerinden çıkarır, generic vermeye çalışma.
- **Mongoose 9** — `src/lib/db.ts` global cache singleton; her serverless function invocation'ında yeni bağlantı kurmaz.
- **Cloudinary** — resim depolama. `src/lib/cloudinary.ts` ile lazy config.
- **jose** — admin JWT cookie imzalama.

## Mimari

### İki yollu veri okuma — Server component'ler vs client component'ler

- **Server component sayfaları doğrudan Mongoose'a gider** (`src/lib/data.ts`'teki `listGames`, `getGameBySlug`, `getAnalytics`, `getSessionState`). Sebep: lokalde Next dev portu değişebilir (3000 doluysa 3001) ve serverless ortamda internal HTTP fetch port discovery yapamaz. Server component'ten **asla** `gql()` ile `/api/graphql`'e fetch yapma.
- **Client component'ler GraphQL'i HTTP üzerinden çağırır** (`src/lib/gql-client.ts`'teki `gql()`). Yeni resolver/mutation ekledikten sonra sadece client tarafı bunu kullansın; server component için `lib/data.ts`'e karşılık gelen fonksiyon eklemek gerekebilir.

Resolvers (`src/lib/graphql/resolvers.ts`) ve `lib/data.ts` arasında bilinçli bir duplikasyon var. Bir entity'nin okumasını değiştirirken her iki dosyada da güncellemek gerekir.

### Eşleştirme algoritması

`src/lib/matchmaking.ts` — saf, durumsuz, oturum state'inden alıp yeni state döner. 3 fazlı hibrit Elo:

1. **Discovery** — her resim `minAppearances = max(2, ceil(log2(N)))` kez gösterilene kadar dengeli eşleştirme
2. **Ranking** — Elo'su yakın resimleri eşleştir, en bilgilendirici karşılaşmalar
3. **Final** — top 4 → top 2 → tek galip mini turnuvası

Son K (= `antiRepeatWindow`) turda gösterilen çift tekrarlanmaz (faz değişiminde fallback olarak gelebilir). Her resmin oturum içi Elo'su `kFactor=32` ile günceller; `Game.images[].elo` global ortalama ise `submitVote` resolver'ında daha yumuşak `k=16` ile güncellenir (tek kullanıcının global puanları büyük oynatmasını engellemek için).

### Oturum durumu

`VoteSession` koleksiyonu sunucuda tutulur, ana state alanları:
- `eloState: Map<imageId, number>` — bu oturuma özel Elo
- `appearances: Map<imageId, number>`
- `history: [{imageA, imageB, winner, round}]`
- `phase`, `totalRounds`

İstemcide sadece `sessionKey` (nanoid 16) `localStorage`'da tutulur (`omubumu:session:{slug}`). Sayfa yenilemede aynı oturuma devam edilir; bitince temizlenir. Her ziyaretçi kendi oturumunu yapar — başkasının seçimi seninkini etkilemez.

### Yetkilendirme

- `/admin/*` rotaları `src/proxy.ts` (Next.js 16'da `middleware.ts` yerine `proxy.ts`) ile korumalı. **Export adı `proxy`** olmalı, `middleware` değil. Proxy fonksiyonu `/admin/login`'i içeride bypass eder.
- GraphQL'de admin mutation'ları (`createGame`, `updateGame`, `addImages`, `deleteImage`, `deleteGame`) resolver başında `requireAdmin(ctx)` çağırır. Defense-in-depth — middleware bypass edilse bile mutation 401 döner. Yeni admin mutation eklerken `requireAdmin(ctx)` çağırmayı unutma.
- Auth state'i `omubumu_admin` HS256 cookie'sinde (14 gün). Server component'lerde `getAdminFromCookies()`, GraphQL context'inde `getAdminFromRequest(request)` ile okunur.
- **`src/lib/auth.ts`'i client component'lerden import etme** — `next/headers`'i kullanıyor, server-only. Async server component'ten Header gibi alt component'ler çağırılırken aynı kural geçerli.

### Resim upload akışı

`/api/upload`:
1. `getAdminFromRequest(req)` ile cookie kontrolü, yoksa 401
2. `multipart/form-data` parse, MIME + boyut + sayı limitleri (max 30 dosya/istek, 10MB/dosya)
3. Her dosya base64 data URI'ye çevrilip Cloudinary'ye `omubumu/` klasörüne yüklenir
4. `{ url, fileName, width, height }[]` döner

New Game oluştururken: client önce `/api/upload`'a dosyaları gönderir, dönen URL'leri `createGame` mutation'ına geçer. **Dosyalar `public/uploads/`'a yazılmaz** — Netlify serverless filesystem ephemeral.

### Modeller

- `Game` — `slug` (unique), `images: [{_id, url, fileName, elo, wins, losses, appearances}]` (gömülü), `totalSessions`, `totalVotes`
- `VoteSession` — `gameId`, `sessionKey`, `eloState` ve `appearances` Map olarak, `history` array, `phase`, `finalWinnerId`, `finishedAt`
- `Vote` — atomik oy kaydı, analitik için (head-to-head matrisi vs.)

`deleteImage` mutation'ı bir resmi sildiğinde **o resme atıfta bulunan tüm `Vote` kayıtlarını da temizler** ve mümkünse eski lokal disk dosyasını da siler. Analitik tutarlılığı için bu cleanup zorunlu.

## Deploy

Hosting Netlify üzerinden, build CLI ile manuel tetikleniyor (auto-deploy GitHub bağlantısı henüz kurulmadı):

```bash
netlify deploy --build --prod --message "..."
```

`netlify.toml` build komutunu ve `@netlify/plugin-nextjs`'i ayarlar. Env vars Netlify dashboard'unda set'tir; lokal `.env.local`'a karşılık gelir. `.env.example` template referans.

DB MongoDB Atlas (free tier), resim Cloudinary (free tier). Atlas'ta Network Access `0.0.0.0/0` açık olmalı — Netlify IP'leri dinamik.

## Dil

UI ve hata mesajları Türkçe. Kod kommentleri çoğunlukla Türkçe; teknik terimler İngilizce kalır.
