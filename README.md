# Çalışma Planı

Günlük çalışma planını **kendisi kuran** telefon uygulaması.
Ne çalışacağını bir kere havuza giriyorsun, gün tipini (okul var / okul yok) ve
saat aralığını söylüyorsun — uygulama saat saat programı çıkarıyor.
Blokları tikledikçe konfeti patlıyor, seri sayacı ilerliyor.

Kurulum gerektirmeyen bir **PWA**: telefonda tarayıcıdan açıp "Ana ekrana ekle"
dediğinde ikonla açılır, internet olmadan da çalışır.

## Ekranlar

**Bugün** — gün tipini seç, saat aralığını gir, plan bir tıkla kurulur.
Her blok tek dokunuşla tiklenir; ilerleme halkası, "şu anki blok" vurgusu,
gün bitince kutlama ekranı ve seri (🔥) sayacı.

**Görevler** — çalışma havuzu. Ders, ne çalışacağın, miktar (sayfa / test / soru /
konu / dakika), son tarih ve öncelik. Bir blok tiklenince ilgili görevin kalan
miktarı otomatik düşer; görev bitene kadar her gün plana girmeye devam eder.

**Denemeler** — deneme netlerini gir (doğru/yanlış yazınca net kendi hesaplanır),
net gelişim grafiğini gör ve verilerinden çıkan tavsiyeleri oku.

**Ayarlar** — dersler ve renkleri, blok/mola süreleri, yemek saati, gün tiplerinin
varsayılan saatleri, blok başına iş hızların, haftanın planlayıcısını yükleme,
yedek al/geri yükle.

## Haftanın planlayıcısı

`data/hafta.json`, rehberlik planlama defterindeki haftalık işleri tutar.
Ayarlar → **"Haftanın planlayıcısını yükle"** butonu bu dosyadaki görevleri havuza
ekler; aynı ders + başlık + tarih üçlüsü zaten varsa tekrar eklemez, yani butona
iki kere basmak zarar vermez.

Her hafta yeni planlayıcı yazıldığında bu dosyayı güncellemek yeterli — görevleri
tek tek elle girmeye gerek kalmaz. Dosya biçimi:

```json
{ "gorevler": [
  { "ders": "Kimya", "baslik": "Mol", "miktar": 3, "birim": "test",
    "tarih": "2026-10-07", "oncelik": 0 }
] }
```

`birim`: sayfa · test · soru · konu · adet · dk  |  `oncelik`: 0 normal, 1 yüksek, 2 acil
(acil işler günün en fazla %60'ını kapar ve rezervde önce gelir).
Dosyada olmayan bir ders adı geçerse uygulama o dersi kendisi oluşturur.

## Plan motoru nasıl çalışıyor?

Elle yapılan programların mantığı koda döküldü:

1. **Teslimi yakın ve önceliği yüksek işler öne gelir.** Bugün/yarın teslim olanlar
   ve "Acil" işaretliler günün en fazla %60'ını kapar.
2. **Kalan bloklar sırayla herkese dağıtılır** — gün tek derse kilitlenmez,
   her dersten bir şey girer.
3. **Büyük görev parçalara bölünür ve güne yayılır.** 80 sayfalık kitap tek blokta
   değil, günün içine serpiştirilmiş 20'şer sayfalık bloklar halinde gelir.
4. **Aynı ders arka arkaya iki blok gelmez** — başka seçenek kalmadıysa gelir.
5. **Molalar otomatik:** her bloktan sonra kısa mola, yemek saatinde uzun mola.
6. **Günün kuyruğundaki kısa blokta iş miktarı da küçülür** (30 dakikalık bloğa
   20 sayfa değil 13 sayfa yazılır).
7. **Sığmayanlar** ayrı listelenir ve yarınki planda öne alınır.

Tavsiyeler de aynı şekilde kurallı: son denemen önceki denemelerin ortalamasıyla
karşılaştırılır, ham puana oranla en zayıf ders, en çok düşen ve en çok yükselen
ders ile yanlış oranın çıkarılır.

> **Not:** Uygulamada yapay zekâ çağrısı yok — dolayısıyla API anahtarı, hesap ya da
> internet gerekmiyor. Her şey telefonun içinde hesaplanır.

## Telefonda kullanma

1. Uygulamayı yayına al (aşağıdaki GitHub Pages adımları).
2. Telefondan adresi aç.
3. **Android / Chrome:** menü → "Uygulamayı yükle"
   **iPhone / Safari:** paylaş → "Ana Ekrana Ekle"

## GitHub Pages ile yayına alma

Depo sayfasında **Settings → Pages → Source: Deploy from a branch** →
branch `main`, klasör `/ (root)` → **Save**. Birkaç dakika sonra:

```
https://batuhan7722.github.io/dersprogram/
```

## Yerelde çalıştırma

```bash
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000
```

## Dosyalar

```
index.html              ekranlar ve formlar
css/style.css           tasarım, açık/koyu tema
js/store.js             veri modeli, kayıt, yardımcılar
js/planner.js           plan motoru + deneme analizi
js/fx.js                konfeti ve kutlama efektleri
js/app.js               ekranlar, olaylar, akış
data/hafta.json         o haftanın planlayıcı defteri verisi
manifest.webmanifest    uygulama kimliği
sw.js                   çevrimdışı önbellek
```

Dış kütüphane ve derleme adımı yok — saf HTML/CSS/JS.
Veriler sadece telefonun tarayıcısında (`localStorage`) saklanır, hiçbir yere gönderilmez.
