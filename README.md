# Ders Programı

Haftalık ders programı, ödev takibi ve ders notları için telefon uygulaması.
Kurulum gerektirmeyen bir **PWA** (web uygulaması): telefonda tarayıcıdan açıp
"Ana ekrana ekle" dediğinde normal bir uygulama gibi ikonla açılır ve
internet olmadan da çalışır.

## Özellikler

- **Bugün** — günün dersleri, şu anki ders ve kalan süre, sıradaki ders, yaklaşan ödevler
- **Hafta** — saat ızgaralı haftalık program, bugünün sütunu ve "şu an" çizgisi işaretli
- **Ödev** — ödev/not listesi, teslim tarihi, geciken ödevler kırmızı
- **Düzenle** — dersleri uygulama içinden ekle/değiştir/sil (kod düzenlemeye gerek yok)
- Her derse not yazılabilir (ders kartına dokun)
- JSON olarak yedek alma ve geri yükleme
- Açık/koyu tema, telefonun ayarına göre otomatik

Veriler yalnızca telefonun tarayıcısında (`localStorage`) saklanır; hiçbir yere
gönderilmez. Telefon veya tarayıcı değiştirirken **Düzenle → Yedek al**.

## Telefonda kullanma

1. Uygulamayı yayına al (aşağıdaki GitHub Pages adımları).
2. Telefondan adresi aç.
3. **Android / Chrome:** menü → "Uygulamayı yükle" veya "Ana ekrana ekle"
   **iPhone / Safari:** paylaş butonu → "Ana Ekrana Ekle"

## GitHub Pages ile yayına alma

Depo sayfasında **Settings → Pages → Source: Deploy from a branch** →
branch `main`, klasör `/ (root)` → **Save**.
Birkaç dakika içinde şu adreste yayına girer:

```
https://batuhan7722.github.io/dersprogram/
```

## Yerelde çalıştırma

Service worker'ın çalışması için dosyayı çift tıklamak yerine bir sunucu gerekir:

```bash
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000
```

## Dosyalar

```
index.html              ekranlar ve formlar
css/style.css           tasarım, açık/koyu tema
js/app.js               tüm uygulama mantığı (bağımlılık yok)
manifest.webmanifest    uygulama adı, ikonlar, tam ekran ayarı
sw.js                   çevrimdışı önbellek
icons/                  uygulama ikonları
```

Hiçbir dış kütüphane ya da derleme adımı yok — saf HTML/CSS/JS.
