# Chiro Vreugdeland Website Documentatie

Deze documentatie beschrijft de installatie, configuratie en het beheer van de Chiro Vreugdeland website.

## 1. Technische Stack
Het project is gebouwd met:
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite (via Sequelize ORM)
- **Templating:** EJS
- **Styling:** Custom CSS & Bootstrap 5

## 2. Installatie

Zorg dat [Node.js](https://nodejs.org/) is geïnstalleerd op de server.

1. **Project downloaden/clonen**
2. **Afhankelijkheden installeren:**
   ```bash
   npm install
   ```

## 3. Configuratie (.env)

Maak een `.env` bestand aan in de hoofdmap van het project. Hierin komen gevoelige instellingen.
Voorbeeld inhoud:

```env
PORT=3000
SESSION_SECRET=een_lang_willekeurig_geheim
EMAIL_PASSWORD=jouw_outlook_wachtwoord
```

- `PORT`: De poort waarop de server draait (standaard 3000).
- `SESSION_SECRET`: Gebruikt voor het beveiligen van adminsessies.
- `EMAIL_PASSWORD`: Het wachtwoord van het `Chiromeeuwen@outlook.com` account voor het contactformulier.

## 4. Starten van de Applicatie

Om de server te starten:

```bash
npm start
```
Of direct via Node:
```bash
node server.js
```

De website is nu bereikbaar via `http://localhost:3000` (of de ingestelde poort).

## 5. Admin Beheer (Command Line)

Omdat er geen "registratie" knop is op de website (voor veiligheid), moeten admins via de server-console (terminal) worden beheerd.

### Admin Toevoegen
```bash
node scripts/manage_admin.js add <gebruikersnaam> <wachtwoord>
```
*Voorbeeld:* `node scripts/manage_admin.js add hoofdleiding chiro123`

### Admin Verwijderen
```bash
node scripts/manage_admin.js remove <gebruikersnaam>
```

## 6. Functionaliteiten voor de Admin

Eenmaal ingelogd op `/auth/login`, heeft de admin toegang tot:

- **Pagina's Bewerken:** Teksten aanpassen op Home, Praktisch, Afdelingen, etc.
- **Leiding Beheer:**
  - Toevoegen/verwijderen van leiding.
  - Automatische indeling in groepen (kleuren).
  - Automatische carousel weergave bij >4 leiding per groep.
- **Kalender Beheer:** Toevoegen van activiteiten. Verlopen activiteiten verdwijnen automatisch van de publieke lijst.
- **Bestanden & Foto's:**
  - Uploaden van afbeeldingen naar de server.
  - Krijg direct HTML-code (`<img src="...">`) om in teksten te plakken.

## 7. Mappenstructuur

- `/config`: Database en paspoort configuratie.
- `/controllers`: Logica van de applicatie (wat gebeurt er als je een pagina opvraagt).
- `/models`: Database definities (User, Leader, Event, PageContent).
- `/public`: Statische bestanden (CSS, JS, geüploade afbeeldingen).
- `/routes`: URL definities.
- `/views`: De HTML/EJS templates van de pagina's.
- `/scripts`: Beheertools (zoals admin aanmaken).

## 8. Veiligheid & Backups

Het is belangrijk om regelmatig backups te maken van de website data.

### Automatische Backup Maken
Er is een ingebouwd commando om direct een volledige backup te maken van de database én alle geüploade bestanden.

```bash
npm run backup
```

Dit script:
1. Maakt een map `backups/` aan (als die nog niet bestaat).
2. Maakt daarin een submap met de datum en tijd (bijv. `backup-2023-10-25-T14-30-00`).
3. Kopieert `database.sqlite`, `sessions.sqlite` en de map `public/uploads` naar deze veilige locatie.

Het is aan te raden om de inhoud van de `backups/` map af en toe te downloaden naar een externe harde schijf of cloudopslag.

- **Database:** De data zit in `database.sqlite`.
- **Afbeeldingen:** De uploads zitten in `public/uploads/`.
- **Wachtwoorden:** Wachtwoorden worden veilig gehasht (versleuteld) opgeslagen.
