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
- **Inschrijvingen:**
  - **Overzicht & Zoeken:** Bekijk inschrijvingen per werkjaar (via het archief in de zijbalk) of zoek op naam/email.
  - **Beheer Periodes:** Start eenvoudig een nieuw inschrijvingsjaar via de knop "Nieuwe Periode".
  - **Export:** Exporteer ledenlijsten naar Excel of PDF (per jaar of volledig archief).
- **Danger Zone:**
  - **Maak Backup:** Handmatige trigger voor systeembackup.
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
3. Kopieert `database.sqlite`, `sessions.sqlite` en de map `public/uploads` naar deze locatie.# Gebruikersbeheer & Groepen Handleiding

In het ChiroSite systeem is het beheer van gebruikers en hun toegang tot specifieke delen van het "Leidingshoekje" (de feed) gestructureerd via **Gebruikers** en **Groepen**.

## 1. Rollen en Rechten

Er zijn twee hoofdrollen in het systeem:

*   **Admin:**
    *   Heeft toegang tot **alle** groepen en feeds.
    *   Kan gebruikers aanmaken, bewerken en verwijderen.
    *   Kan groepen beheren.
    *   Kan de website instellingen en content beheren.
*   **Member (Lid/Leiding):**
    *   Heeft enkel toegang tot de groepen die specifiek aan hen zijn toegewezen.
    *   Kan berichten plaatsen en reageren in hun toegewezen groepen.

## 2. Gebruikers Aanmaken

Gebruikers worden aangemaakt via het Admin Dashboard.

1.  Ga naar het **Admin Dashboard**.
2.  Klik op **"Gebruikers Beheer"**.
3.  Onder "Nieuwe Gebruiker Aanmaken":
    *   Vul de **Gebruikersnaam** in.
    *   Vul het **Wachtwoord** in.
    *   Kies de **Rol** (Admin of Member).
4.  Klik op **"Aanmaken"**.

**Automatische Groepstoewijzing:**
Wanneer een nieuwe gebruiker (rol 'member') wordt aangemaakt, wordt deze automatisch toegevoegd aan de **laatst aangemaakte groep** (meestal het leidingshoekje van het huidige jaar).

## 3. Groepen Beheren en Toewijzen

Groepen (Feed Groups) zijn de verschillende "hoeken" of feeds, bijvoorbeeld per werkjaar ("Leidingshoekje 2024-2025") of voor specifieke comités.

### Een Groep Aanmaken
1.  Ga naar **Admin Dashboard** > **"Beheer Leidingshoekjes"**.
2.  Vul de **Naam** in (bv. "Leidingshoekje").
3.  (Optioneel) Vul het **Jaar** in (bv. "2024").
4.  Klik op **"Aanmaken"**.

### Gebruikers Toevoegen aan Groepen
Om een gebruiker toegang te geven tot specifieke groepen:

1.  Ga naar **Admin Dashboard** > **"Gebruikers Beheer"**.
2.  Zoek de gebruiker in de lijst.
3.  Klik op het **potlood-icoontje** (bewerken) naast de gebruiker.
4.  Je ziet nu een lijst van alle beschikbare groepen.
5.  **Vink de vakjes aan** voor de groepen waartoe deze gebruiker toegang mag hebben.
6.  Klik op **"Gebruiker Bijwerken"**.

> **Belangrijk voor Admins:**
> Als je een gebruiker de rol **'admin'** geeft, verdwijnt de optie om groepen te selecteren. Dit komt omdat **admins automatisch toegang hebben tot alle pagina's en groepen**. Je hoeft hen dus niet handmatig aan elke groep toe te voegen.

## 4. Foutmeldingen voor Gebruikers

Als een gebruiker inlogt maar aan **geen enkele groep** is gekoppeld (en geen admin is), krijgen ze een specifieke melding te zien in plaats van de feed:

> *"Oei! Je hoofdleiding heeft je precies niet zo graag want je zit in nog geen groep. Vraag dit eens eventjes na bij hun."*

Dit is een indicatie dat de admin vergeten is de gebruiker aan de juiste groep te koppelen of dat de automatische toewijzing niet van toepassing was.
