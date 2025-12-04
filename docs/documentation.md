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

De hoofd-administrator ('Admin') is een speciaal account dat niet zichtbaar is in de gebruikerslijst op het dashboard. Dit account kan niet verwijderd worden via de website.

### Admin Toevoegen (Eerste keer)
```bash
node scripts/manage_admin.js add Admin <wachtwoord>
```
*Opmerking:* De gebruiker 'Admin' is speciaal en wordt verborgen in de GUI.

### Extra Admins/Leiding Toevoegen
Je kan extra admins of leiding toevoegen via het **Admin Dashboard** op de website.
Of via de command line:
```bash
node scripts/manage_admin.js add <gebruikersnaam> <wachtwoord>
```

### Admin Verwijderen
```bash
node scripts/manage_admin.js remove <gebruikersnaam>
```

## 6. Functionaliteiten voor de Admin

Eenmaal ingelogd op `/auth/login`, heeft de admin toegang tot:

- **Leidingshoekje:**
  - Een interne feed voor alle leiding.
  - Plaats berichten, polls en formulieren.
  - Upload documenten (PDF, Word).
- **Gebruikers Beheer:**
  - Beheer accounts voor andere leiding en admins.
  - *Let op: Het hoofdaccount 'Admin' is hier onzichtbaar.*
- **Pagina's Bewerken:** Teksten aanpassen op Home, Praktisch, Afdelingen, etc.
- **Leiding Beheer:**
  - Toevoegen/verwijderen van leiding info voor de publieke site.
- **Kalender Beheer:** Toevoegen van activiteiten.
- **Bestanden & Foto's:**
  - Uploaden van afbeeldingen naar de server.
- **Inschrijvingen:** Bekijk en exporteer ledenlijst naar Excel.
- **Danger Zone:**
  - **Maak Backup:** Handmatige trigger voor systeembackup.
  - **Reset Ledenlijst:** Verwijdert alle inschrijvingen.
  - **Reset Website:** Verwijdert alle content (teksten, events, leden, inschrijvingen) én alle geüploade media.

## 7. Mappenstructuur

- `/config`: Database en paspoort configuratie.
- `/controllers`: Logica van de applicatie.
- `/models`: Database definities.
- `/public`: Statische bestanden.
- `/routes`: URL definities.
- `/views`: De HTML/EJS templates.
- `/scripts`: Beheertools.

## 8. Veiligheid & Backups

Het is belangrijk om regelmatig backups te maken.

### Automatische Backup Maken
```bash
npm run backup
```

Dit script:
1. Maakt een map `backups/` aan.
2. Maakt daarin een submap met de datum en tijd.
3. Kopieert `database.sqlite`, `sessions.sqlite` en de map `public/uploads` naar deze locatie.