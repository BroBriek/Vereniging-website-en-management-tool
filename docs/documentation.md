# Chiro Vreugdeland Website Documentatie

Deze documentatie beschrijft de installatie, configuratie en het beheer van de Chiro Vreugdeland website.

## 1. Technische Stack
Het project is gebouwd met:
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite (via Sequelize ORM)
- **Templating:** EJS
- **Styling:** Custom CSS & Bootstrap 5
- **Containerisatie:** Docker (optioneel)

## 2. Installatie

### Lokale installatie
Zorg dat [Node.js](https://nodejs.org/) is geïnstalleerd op de server.

1. **Project downloaden/clonen**
2. **Afhankelijkheden installeren:**
   ```bash
   npm install
   ```

### Docker installatie
Het project kan ook via Docker gedraaid worden:
```bash
docker-compose up -d --build
```

## 3. Configuratie (.env)

Maak een `.env` bestand aan in de hoofdmap van het project. Hierin komen gevoelige instellingen.
Voorbeeld inhoud:

```env
PORT=3000
SESSION_SECRET=een_lang_willekeurig_geheim

# Organisatie
ORG_NAME=Chiro Vreugdeland
ORG_FULL_NAME=Chiro Vreugdeland Meeuwen
ORG_LOCATION=Meeuwen

# E-mail (SMTP)
SMTP_HOST=smtp.voorbeeld.be
SMTP_PORT=587
SMTP_USER=info@voorbeeld.be
SMTP_PASS=jouw_wachtwoord
CONTACT_EMAIL=contact@voorbeeld.be
```

- `PORT`: De poort waarop de server draait (standaard 3000).
- `SESSION_SECRET`: Gebruikt voor het beveiligen van adminsessies.
- `ORG_NAME`: De naam van de vereniging.
- `SMTP_USER` & `SMTP_PASS`: De inloggegevens van het e-mailaccount voor het verzenden van e-mails.
- `CONTACT_EMAIL`: Het e-mailadres waarop contactberichten en wekelijkse updates worden ontvangen.

## 4. Starten en Updaten

### Starten
```bash
npm start
```

### Updaten
Gebruik de meegeleverde scripts voor veilig updaten:
- `./update.sh`: Volledige update inclusief database migraties en docker rebuild.
- `./softUpdate.sh`: Snelle update zonder docker rebuild.
- `./downgrade.sh`: Terugrollen naar de vorige versie (indien backup aanwezig).

## 5. Admin Beheer (Command Line)

### Admin Toevoegen (Eerste keer)
```bash
node scripts/manage_admin.js add Admin <wachtwoord>
```

### Extra Admins/Leiding Toevoegen
Je kan extra admins of leiding toevoegen via het **Admin Dashboard**.
Of via de command line:
```bash
node scripts/manage_admin.js add <gebruikersnaam> <wachtwoord>
```

## 6. Functionaliteiten voor de Admin

### 6.1 Dashboard & Instellingen
- **Registratie Toggle:** Zet inschrijvingen op de site aan of uit met één klik.
- **Navigatie Beheer:** Verberg of toon specifieke pagina's in het menu.
- **Thema Kleuren:** Pas de kleuren van de website aan via de instellingen.
- **Site Opties:** Schakel het contactformulier uit, beheer games zichtbaarheid, etc.

### 6.2 Inschrijvingen (Ledenbeheer)
- **Overzicht & Filters:** Filter op werkjaar, zoek op naam of sorteer de lijst.
- **Export:** Exporteer naar Excel (voor ledenlijsten) of PDF (voor kampboekjes).
- **Periodebeheer:** Start eenvoudig een nieuw werkjaar. Oude gegevens blijven bewaard in het archief.
- **Email Tool:** Verzend gepersonaliseerde e-mails naar specifieke groepen (leden, leiding, of alles) van een bepaald werkjaar.

### 6.3 Spelendatabank
- **Beheer:** Voeg spelen toe met uitleg, benodigdheden, intensiteit en tags.
- **Media:** Upload bijlages (PDF, afbeeldingen) bij spelen.
- **Zoeken:** Uitgebreide zoekfunctie op tags, groepen en intensiteit.

### 6.4 Financiële Tool
- **Structuur:** Werk met mappen (bv. "Kamp 2024") en transacties.
- **Status:** Houd bij of items al betaald zijn.
- **Export:** Genereer Excel-overzichten per map of van alle openstaande (niet-betaalde) items.

### 6.5 Formulieren & Custom Pagina's
- **Form Builder:** Maak complexe formulieren met verschillende veldtypes.
- **Eetdag Export:** Speciale functie voor eetdagen om bestellingen direct op printbare briefjes (3 per A4) te exporteren.
- **Custom Pages:** Bouw eigen informatieve pagina's met een visuele editor, inclusief banners en navbar-integratie.

### 6.6 GDPR & Veiligheid
- **Gegevensverwijdering:** Ingebouwde tools om oude inschrijvingen en persoonlijke data veilig te verwijderen conform de privacywetgeving.
- **Afbeeldingen:** Automatische compressie van geüploade afbeeldingen om opslagruimte te besparen.

## 7. Backups

Het systeem maakt regelmatig backups, maar je kunt ze ook handmatig triggeren.

### Handmatige Backup
```bash
npm run backup
```

Dit script kopieert de database en alle uploads naar de map `backups/` met een tijdstempel.

# Gebruikersbeheer & Groepen Handleiding

In het ChiroSite systeem is het beheer van gebruikers en hun toegang tot specifieke delen van het "Leidingshoekje" (de feed) gestructureerd via **Gebruikers** en **Groepen**.

## 1. Rollen en Rechten

Er zijn drie hoofdrollen in het systeem:

*   **Admin:**
    *   Heeft volledige toegang tot alle onderdelen van het systeem.
    *   **Gebruikersbeheer:** Aanmaken, bewerken en verwijderen van alle accounts (behalve het onzichtbare hoofdaccount).
    *   **Onderhoud & Veiligheid:** Toegang tot database-tools, bestandsbeheer op de server, logs en backups.
    *   **Inschrijvingen:** Volledig beheer van inschrijvingsperiodes, bewerken en verwijderen van inschrijvingen.
    *   **Financiën:** Toegang tot de financiële tool.
    *   **Groepen:** Beheer van de verschillende "Leidingshoekjes".
    *   **Communicatie:** Verzenden van e-mails via de e-mail tool.
*   **Media:**
    *   Heeft toegang tot de meeste content-beheer functies, maar geen systeem-kritieke instellingen.
    *   **Pagina's:** Bewerken van de teksten op de publieke pagina's (Home, Praktisch, Afdelingen, etc.).
    *   **Leiding:** Beheer van de leidingsinfo voor de publieke site.
    *   **Kalender:** Toevoegen en wijzigen van activiteiten.
    *   **Bestanden:** Uploaden en beheren van afbeeldingen en documenten in de upload-manager.
    *   **Formulieren:** Volledig beheer van de form-builder (formulieren maken, antwoorden bekijken en exporteren).
    *   *Opmerking: Media-gebruikers hebben GEEN toegang tot gebruikersbeheer, onderhoudstools, financiën of inschrijvingsbeheer.*
*   **Member (Lid/Leiding):**
    *   Heeft enkel toegang tot de groepen (Leidingshoekjes) die specifiek aan hen zijn toegewezen.
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
