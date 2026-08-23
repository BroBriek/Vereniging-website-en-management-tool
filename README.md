# Vereniging Website- en Management Tool

Een complete, moderne webapplicatie en beheertool ontworpen voor jeugdbewegingen en verenigingen. Het platform combineert een publieke website met een krachtig intern beheerpaneel voor ledenadministratie, evenementenplanning, financiën, communicatie en meer.

> ℹ️ **Disclaimer:** Dit project is oorspronkelijk gemaakt voor onze Chiro en kan dus nog sporen bevatten van onze Chiro (vooral in containernamen, bestandsnamen, etc.). Dit kan je altijd naar eigen wens aanpassen of maak gerust een fork van dit project.

---

## Inhoudsopgave

- [Functies](#functies)
- [Installatie & Lokale Setup](#installatie--lokale-setup)
- [Aanpassen voor jouw Vereniging (.env)](#aanpassen-voor-jouw-vereniging-env)
- [Kleurenschema & Thema Instellen](#kleurenschema--thema-instellen)
- [Standaard Admin Account](#standaard-admin-account)
- [Docker Deployment](#docker-deployment)
- [Ingebouwde Wiki & Help Documentatie](#ingebouwde-wiki--help-documentatie)

---

## Functies

* **Ledenbeheer**: Online inschrijvingen, medische fiches, automatische e-mailbevestigingen en Excel-export.
* **Evenementen & Kalender**: Beheer publieke en interne activiteiten met iCal-synchronisatie.
* **Leidingsportaal & Feed**: Exclusief intern platform voor leiding met groepen, posts, reacties en 'Quote van de maand'.
* **Aangepaste Pagina's & Formulieren**: Flexibele content builder voor dynamische pagina's en custom inschrijvings-/enquêteformulieren.
* **Financieel Overzicht**: Inkomsten en uitgaven bijhouden per evenement of categorie.
* **Spelendatabank & Kampboekje**: Tools voor leiding om spelen en kampvoorbereidingen te beheren.
* **E-mail & Notificaties**: Ingebouwde bulk-email tool, automatische logmonitoring en Web Push-notificaties.

---

## Installatie & Lokale Setup

Volg onderstaande stappen om de applicatie lokaal te installeren en te starten:

### 1. Kloon de repository
```bash
git clone https://github.com/BroBriek/Vereniging-website-en-management-tool.git
cd Vereniging-website-en-management-tool
```

### 2. Installeer de afhankelijkheden
```bash
npm install
```

### 3. Configureer het `.env` bestand
Kopieer het voorbeeldbestand en vul jouw specifieke instellingen in:
```bash
cp .env.example .env
```

### 4. Database Seeden & Initialiseren
De database (SQLite) synchroniseert automatisch bij het opstarten. Voer het seed-script uit om de standaard instellingen, pagina's en het initiële admin-account klaar te zetten:
```bash
node scripts/seed.js
```

### 5. Start de applicatie
```bash
npm start
# of
node server.js
```
De website is nu bereikbaar via `http://localhost:3000` (of de poort die je in `.env` hebt geconfigureerd).

---

## Aanpassen voor jouw Vereniging (.env)

Alle referenties naar de specifieke vereniging, contactadressen en serverconfiguraties kunnen eenvoudig worden aangepast in het `.env` bestand zonder dat je de broncode hoeft te wijzigen.

Hieronder vind je een overzicht en uitleg van alle beschikbare omgevingsvariabelen:

```env
# ==========================================
# Basis Server & Beveiliging
# ==========================================
PORT=3000
APP_URL=http://localhost:3000
SESSION_SECRET=kies_hier_een_lange_willekeurige_geheime_zin_minimaal_32_tekens

# ==========================================
# Organisatiegegevens & Adres
# ==========================================
ORG_NAME="Mijn Vereniging"
ORG_FULL_NAME="Mijn Vereniging Gemeente"
ORG_LOCATION="Gemeente"
ORG_ADDRESS_STREET="Straatnaam 123"
ORG_POSTAL_CODE="1000"
ORG_ADDRESS_REGION="Provincie"
ORG_COUNTRY="België"
ORG_FACEBOOK_URL="https://www.facebook.com/jouwvereniging"
ORG_KEYWORDS="jeugdbeweging, activiteiten, vereniging"

# ==========================================
# E-mail & Contactadressen
# ==========================================
CONTACT_EMAIL="contact@jouwvereniging.be"
ADMIN_EMAIL="admin@jouwvereniging.be"
MAIL_FROM="noreply@jouwvereniging.be"

# ==========================================
# SMTP Mailserver Instellingen
# ==========================================
SMTP_HOST=smtp.voorbeeld.be
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@voorbeeld.be
SMTP_PASS=uw_smtp_wachtwoord

# ==========================================
# Optioneel: Push Notificaties & Anti-spam
# ==========================================
VAPID_PUBLIC_KEY=uw_vapid_public_key
VAPID_PRIVATE_KEY=uw_vapid_private_key
RECAPTCHA_SITE_KEY=uw_recaptcha_site_key
RECAPTCHA_SECRET_KEY=uw_recaptcha_secret_key
```

### Uitleg van de Variabelen:

#### 🌐 Basis & Beveiliging
* **`PORT`**: De netwerkpoort waarop de webapplicatie luistert (standaard `3000`).
* **`APP_URL`**: De volledige basis-URL van de website (bijv. `https://www.jouwvereniging.be` of lokaal `http://localhost:3000`). Wordt o.a. gebruikt voor links in gegenereerde e-mails.
* **`SESSION_SECRET`**: Een willekeurige, geheime sleutel waarmee gebruikerssessies en cookies cryptografisch worden beveiligd. *(Essentieel: gebruik een unieke, sterke waarde in productie!)*

#### 🏢 Organisatiegegevens & Weergave
* **`ORG_NAME`**: De korte roepnaam van de vereniging (bijv. *Chiro Sellewie*). Deze wordt getoond in het navigatiemenu, e-mailtitels en paginaknoppen.
* **`ORG_FULL_NAME`**: De officiële, volledige benaming (bijv. *Chiro Sellewie Deerlijk*). Wordt gebruikt in de voettekst (footer) en SEO-metadata.
* **`ORG_LOCATION`**: De gemeente/stad van de vereniging (bijv. *Deerlijk*).
* **`ORG_ADDRESS_STREET`**, **`ORG_POSTAL_CODE`**, **`ORG_ADDRESS_REGION`**, **`ORG_COUNTRY`**: De fysieke adresgegevens van het lokaal/de vereniging, getoond op de contactpagina en in gestructureerde zoekmachinedata (Schema.org).
* **`ORG_FACEBOOK_URL`**: De link naar de officiële Facebook- of sociale media-pagina van de organisatie.
* **`ORG_KEYWORDS`**: Zoektermen en tags voor zoekmachineoptimalisatie (SEO).

#### 📬 E-mailadressen & Rollen
* **`CONTACT_EMAIL`**: Het e-mailadres waar berichten van bezoekers via het publieke **contactformulier** en contactaanvragen naartoe worden gestuurd.
* **`ADMIN_EMAIL`**: Het e-mailadres dat **kritieke systeemfoutmeldingen**, serverwaarschuwingen en automatische logmonitor-alerts ontvangt bij eventuele problemen.
* **`MAIL_FROM`**: Het afzenderadres dat zichtbaar is voor ontvangers van automatische mails (zoals inschrijvingsbevestigingen en formuliernotificaties).

#### ✉️ SMTP Mailserver
* **`SMTP_HOST`**: Het adres van de uitgaande mailserver van je host of provider (bijv. `smtp.mijndomein.nl` of `smtp.gmail.com`).
* **`SMTP_PORT`**: De poort voor SMTP (gebruikelijk `587` voor TLS of `465` voor SSL).
* **`SMTP_SECURE`**: Zet op `true` bij poort 465 (SSL), of `false` bij poort 587 (STARTTLS).
* **`SMTP_USER`** & **`SMTP_PASS`**: De inloggegevens om via de mailserver e-mails te mogen versturen.

#### 🔔 Push Notificaties & Beveiliging (Optioneel)
* **`VAPID_PUBLIC_KEY`** & **`VAPID_PRIVATE_KEY`**: Sleutels voor Web Push browsernotificaties (te genereren via `npx web-push generate-vapid-keys`).
* **`RECAPTCHA_SITE_KEY`** & **`RECAPTCHA_SECRET_KEY`**: Google reCAPTCHA v2/v3 sleutels om het contactformulier te beschermen tegen spam bots.

---

## Kleurenschema & Thema Instellen

Zodra de applicatie is opgezet, kun je de visuele stijl en het kleurenschema van de website direct naar wens aanpassen:

1. Log in als beheerder (`/auth/login`).
2. Ga naar het Admin Dashboard en navigeer naar **Site Instellingen** (`/admin/settings`).
3. Onder de sectie **Thema Kleuren** kun je de gewenste kleuren selecteren met de color picker of door een hex-kleurcode in te voeren:
   * **Primair (Hoofdkleur)**
   * **Secundair (Accentkleur)**
   * **Accentkleur**
   * **Neutrale kleur**
   * **Achtergrondkleur**
   * **Tekstkleur**
4. Sla de instellingen op; de gehele website past zich direct automatisch aan aan de nieuwe kleuren.

---

## Standaard Admin Account

Na het uitvoeren van `node scripts/seed.js` is het standaard beheerdersaccount beschikbaar:

* **Gebruikersnaam:** `admin`
* **Wachtwoord:** `admin`

Inloggen doe je via `http://localhost:3000/auth/login`.

> ⚠️ **Beveiligingswaarschuwing:** Verander dit standaard wachtwoord **onmiddellijk** na de eerste aanmelding!  
> Dit kan via **Account Instellingen** (`/account/settings`) of via de command line:
> ```bash
> node scripts/manage_admin.js update-password admin <nieuw_veilig_wachtwoord>
> ```

---

## Docker Deployment

De applicatie kan eenvoudig via Docker worden gedeployed met de meegeleverde `Dockerfile` en `docker-compose.yml`:

### 1. Omgevingsbestand klaarzetten
Maak een `.env` bestand aan op basis van `.env.example` en configureer je instellingen:
```bash
cp .env.example .env
```

### 2. Mappen en bestanden aanmaken op de host
Zorg dat de vereiste upload-mappen aanwezig zijn op het hostsysteem:
```bash
mkdir -p public/uploads public/feed_uploads public/game_uploads backups
```

### 3. Container starten
Bouw het image en start de container op de achtergrond:
```bash
docker compose up --build -d
```

### 4. Database Seeden in Docker
Nadat de container draait, voer je het seed-script uit **binnen** de container om de initiële data en het standaard admin-account aan te maken:
```bash
docker compose exec chiro-app node scripts/seed.js
```
*(Of rechtstreeks via de containernaam: `docker exec -it chirosite node scripts/seed.js`)*

### 5. Admin Wachtwoord Wijzigen in Docker (Aanbevolen)
Je kunt het wachtwoord van de admin direct wijzigen via de container:
```bash
docker compose exec chiro-app node scripts/manage_admin.js update-password admin <nieuw_veilig_wachtwoord>
```

### Container Beheer
* **Logs bekijken:**
  ```bash
  docker compose logs -f chiro-app
  ```
* **Container stoppen:**
  ```bash
  docker compose down
  ```

*De SQLite-database (`database.sqlite`), sessies en de uploads-mappen blijven via bind mounts permanent bewaard op het hostsysteem.*

---

## Ingebouwde Wiki & Help Documentatie

Voor uitgebreide instructies over het gebruik van alle onderdelen van de website is er een complete, interactieve **Wiki & Help-pagina** ingebouwd in het beheerpaneel.

Zodra je bent ingelogd als beheerder (of leiding met de juiste rechten), vind je in het Admin Dashboard onder **Help & Documentatie** (of via `/admin/info`) gedetailleerde handleidingen over onder andere:
* **Ledenbeheer & Inschrijvingen**: Statusbeheer, medische fiches en Excel exports.
* **Evenementen & Agenda**: Kalenderitems toevoegen en beheren.
* **Custom Pages & Pagina Beheer**: Zelf pagina's ontwerpen en het navigatiemenu aanpassen.
* **Formulieren Builder**: Zelf interactieve formulieren en enquêtes samenstellen.
* **Financieel Beheer**: Inkomsten/uitgaven structureren en beheren.
* **E-mail Tool & Notificaties**: Mails uitsturen naar groepen en notificaties beheren.
* **Beveiliging, Backups & Systeemonderhoud**: Backups downloaden en herstellen.

Raadpleeg `/admin/info` binnen de applicatie voor een volledig overzicht van alle mogelijkheden en workflows!
