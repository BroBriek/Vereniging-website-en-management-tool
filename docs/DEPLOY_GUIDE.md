# Handleiding: ChiroSite Deployen naar IONOS VPS met GoDaddy Domein

Deze gids legt uit hoe je jouw Node.js/Express applicatie (met SQLite database) online zet op een IONOS VPS server, gekoppeld aan een GoDaddy domeinnaam.

## Stap 1: Voorbereiding

1.  Zorg dat je project op een online Git repository staat (bijv. **GitHub** of GitLab). Dit is de makkelijkste manier om je code op de server te krijgen.
    *   *Let op:* Zorg dat `database.sqlite`, `sessions.sqlite` en de map `public/uploads` (behalve .gitkeep) in je `.gitignore` staan. Je wilt geen lokale test-data of test-database naar de server pushen. De server maakt zijn eigen database aan.

## Stap 2: Server & Domein Regelen

1.  **IONOS:**
    *   Ga naar Ionos en huur een **VPS Linux** (Virtual Private Server).
    *   Kies als besturingssysteem **Ubuntu 22.04** of **24.04**.
    *   Na aankoop krijg je een **IP-adres** (bijv. `123.45.67.89`) en een **root wachtwoord**.

2.  **GoDaddy:**
    *   Log in bij GoDaddy en ga naar **DNS Management** voor jouw domein.
    *   Zoek het **A Record** met naam `@`.
    *   Wijzig de **Value** (waarde) naar het IP-adres van je IONOS VPS.
    *   Sla op. (Het kan soms een uurtje duren voor dit werkt).

## Stap 3: Inloggen op je Server

Open je terminal (op je eigen computer) en log in op je nieuwe server:

```bash
ssh root@123.45.67.89
# Vervang 123.45.67.89 door jouw IONOS IP-adres.
# Typ 'yes' als er om een fingerprint wordt gevraagd.
# Voer je wachtwoord in (je ziet geen sterretjes tijdens het typen).
```

## Stap 4: Server Installatie

Voer de volgende commando's één voor één uit op de server om Node.js en andere tools te installeren.

```bash
# 1. Update de server software
apt update && apt upgrade -y

# 2. Installeer curl en git
apt install curl git -y

# 3. Installeer Node.js (versie 18 of hoger)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# 4. Controleer of het gelukt is
node -v 
# (Dit moet versie v18... of hoger aangeven)
```

## Stap 5: Project Downloaden & Installeren

```bash
# 1. Ga naar de map voor websites
cd /var/www

# 2. Clone je project (vervang de URL door jouw GitHub URL)
git clone https://github.com/JOUW_NAAM/ChiroSite.git

# 3. Ga de map in
cd ChiroSite

# 4. Installeer alle benodigdheden
npm install

# 5. Maak de database en uploads map klaar
# Omdat SQLite en Uploads naar de schijf schrijven, moet de map bestaan
mkdir -p public/uploads
```

## Stap 6: Configuratie (.env)

Je moet je geheime instellingen op de server zetten.

```bash
# Maak een nieuw .env bestand
nano .env
```

Plak hierin je productie-instellingen (gebruik rechtermuisknop om te plakken):

```env
PORT=3000
SESSION_SECRET=KiesHierEenHeelLangMoeilijkWachtwoordDatNiemandRaadt
EMAIL_PASSWORD=JouwEchteWachtwoord
NODE_ENV=production
```

*   Druk op `CTRL + X` om af te sluiten.
*   Druk op `Y` om te bevestigen.
*   Druk op `Enter` om op te slaan.

## Stap 7: Applicatie Starten met PM2

PM2 is een programma dat zorgt dat je site blijft draaien, ook als de server crasht of herstart.

```bash
# 1. Installeer PM2
npm install -g pm2

# 2. Start je applicatie
pm2 start server.js --name "chirosite"

# 3. Zorg dat PM2 opstart als de server reboot
pm2 startup
# (Kopieer en plak het commando dat PM2 nu in het scherm toont!)

# 4. Sla de huidige lijst op
pm2 save
```

Je app draait nu op poort 3000! Maar... poort 3000 is meestal dicht voor de buitenwereld. We gaan dit openzetten via Nginx.

## Stap 8: Nginx (Reverse Proxy) Instellen

Nginx vangt bezoekers op die naar je domein gaan en stuurt ze door naar je Node app.

```bash
# 1. Installeer Nginx
apt install nginx -y

# 2. Maak een configuratie bestand
nano /etc/nginx/sites-available/chirosite
```

Plak de volgende configuratie erin (vervang `jouwdomein.com` door jouw echte domeinnaam!):

```nginx
server {
    listen 80;
    server_name jouwdomein.com www.jouwdomein.com;

    # Upload limiet verhogen (voor foto's)
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

*   Sla op met `CTRL + X`, `Y`, `Enter`.

Activeer de site:
```bash
# Link het bestand
ln -s /etc/nginx/sites-available/chirosite /etc/nginx/sites-enabled/

# Test op fouten
nginx -t

# Herstart Nginx
systemctl restart nginx
```

Je site zou nu bereikbaar moeten zijn via `http://jouwdomein.com`!

## Stap 9: Admin Aanmaken

Omdat je net een nieuwe (lege) database hebt op de server, moet je nog een admin aanmaken.

```bash
# Zorg dat je in de map /var/www/ChiroSite zit
node scripts/manage_admin.js add jouwadminnaam jouwwachtwoord
```

## Stap 10: Beveiligen met HTTPS (SSL)

Gratis slotje (groen vinkje) voor je site.

```bash
# 1. Installeer Certbot
apt install certbot python3-certbot-nginx -y

# 2. Vraag certificaat aan
certbot --nginx -d jouwdomein.com -d www.jouwdomein.com
```

*   Vul je email in.
*   Ga akkoord met de voorwaarden.
*   Kies optie `2` (Redirect) als erom gevraagd wordt, zodat iedereen automatisch naar HTTPS gaat.

**Klaar! Je site staat nu veilig online.**

---

## Updates uitvoeren in de toekomst

Als je later wijzigingen maakt aan de site en deze naar GitHub pusht, update je de server zo:

1.  Log in via SSH.
2.  Ga naar de map: `cd /var/www/ChiroSite`
3.  Haal updates binnen: `git pull`
4.  Installeer eventuele nieuwe packages: `npm install`
5.  Herstart de app: `pm2 restart chirosite`
