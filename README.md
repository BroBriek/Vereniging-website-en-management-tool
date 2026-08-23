# Vereniging Website- en Management Tool

Dit project is een op maat gemaakte webapplicatie, specifiek ontwikkeld voor de behoeften van **één bepaalde vereniging**. Het primaire doel is het stroomlijnen van interne processen, met een focus op het efficiënt beheren van ledengegevens, het plannen van evenementen en het faciliteren van communicatie binnen de vereniging.

**Belangrijke opmerking:** Hoewel de functionaliteit nuttig kan zijn voor diverse verenigingen, is deze applicatie **niet ontworpen als een algemeen, schaalbaar verenigingsplatform**. De huidige architectuur en implementatie zijn sterk afgestemd op de specifieke eisen van de beoogde gebruiker. Met gerichte aanpassingen zou het echter wel als basis kunnen dienen voor andere verenigingen.

## Functies

*   **Ledenbeheer**: Registratie, overzicht en beheer van ledeninformatie.
*   **Evenementenplanning**: Kalenderfunctie en beheer van evenementen.
*   **Interne Communicatie**: Berichtensysteem/feed (indien geïmplementeerd).
*   **Financieel overzicht**: Beheer van inkomsten en uitgaven (indien geïmplementeerd).
*   **Contentbeheer**: Eenvoudige aanpassing van statische pagina's.

## Installatie Instructies

Om de applicatie lokaal te draaien, volg je de onderstaande stappen:

1.  **Kloon de repository:**
    ```bash
    git clone https://github.com/BroBriek/Vereniging-website-en-management-tool.git
    cd Vereniging-website-en-management-tool
    ```

2.  **Installeer afhankelijkheden:**
    ```bash
    npm install
    ```

3.  **Database Initialisatie:**
    Dit project gebruikt SQLite als standaard database. De database zal automatisch worden gesynchroniseerd (en gealterd indien nodig) bij het opstarten van de applicatie. Er is geen handmatige migratie nodig voor de initiële setup.

4.  **Omgevingsvariabelen instellen:**
    Maak een `.env` bestand aan in de root van het project en voeg de volgende variabelen toe (pas de waarden aan indien nodig):
    ```env
    PORT=3000
    SESSION_SECRET=uw_geheime_sessie_sleutel # VERPLICHT! Verander deze naar een unieke, sterke sleutel
    
    # Organisatie
    ORG_NAME=Mijn Vereniging
    ORG_FULL_NAME=Mijn Vereniging Gemeente
    ORG_LOCATION=Gemeente
    
    # E-mail (SMTP)
    SMTP_HOST=smtp.voorbeeld.be
    SMTP_PORT=587
    SMTP_USER=info@voorbeeld.be
    SMTP_PASS=uw_smtp_wachtwoord
    CONTACT_EMAIL=contact@voorbeeld.be # Het adres waarop je contactberichten en updates wilt ontvangen
    ```
    *   **`PORT`**: De poort waarop de server draait.
    *   **`SESSION_SECRET`**: Een willekeurige string die gebruikt wordt om sessies te versleutelen. **Essentieel voor beveiliging.**
    *   **`ORG_NAME`**: De naam van de vereniging.
    *   **`SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`**: SMTP instellingen voor het verzenden van e-mails.
    *   **`CONTACT_EMAIL`**: Het e-mailadres waarop contactberichten en wekelijkse updates worden ontvangen.

5.  **Start de applicatie:**
    ```bash
    node server.js
    ```
    De applicatie is nu beschikbaar via `http://localhost:3000` (of de poort die je in `.env` hebt ingesteld).

## Docker Deployment

Deze applicatie kan eenvoudig in Docker worden uitgevoerd met de meegeleverde `Dockerfile` en `docker-compose.yml`.

1.  Maak een `.env` bestand aan op basis van `.env.example`.
2.  Zorg dat de volgende mappen aanwezig zijn op de host:
    ```bash
    mkdir -p public/uploads public/feed_uploads public/game_uploads
    ```
3.  Start de container:
    ```bash
    docker compose up --build -d
    ```
4.  Stoppen:
    ```bash
    docker compose down
    ```

> De database (`database.sqlite`) en de uploads-mappen worden via bind mounts buiten de container gehouden. Dit betekent dat je bestaande data bewaard blijft en dat de container opnieuw kan worden opgebouwd zonder verlies.

## Configuratie Vereisten

*   **Node.js**: Zorg ervoor dat Node.js (LTS-versie aanbevolen) op je systeem is geïnstalleerd.
*   **NPM**: Wordt samen met Node.js geïnstalleerd.
*   **Database**: SQLite wordt standaard gebruikt, wat geen aparte installatie vereist. Voor productieomgevingen kan dit worden aangepast naar een robuustere database zoals PostgreSQL of MySQL, wat wel extra configuratie vereist in `config/database.js`.

## Gebruik van Kernfuncties

### 1. Account Aanmaken (Admin)
Na de eerste opstart kun je via de `/register` route in de browser een initiële admin-gebruiker aanmaken. Dit account krijgt automatisch beheerdersrechten. Log daarna in via `/auth/login`.

### 2. Ledenregistratie
Navigeer naar `/inschrijven` (of de publieke registratiepagina). Leden kunnen hier hun gegevens invullen. Deze gegevens zijn vervolgens zichtbaar en beheerbaar via het admin-dashboard onder 'Inschrijvingen'.

### 3. Evenementen Beheren
Log in als beheerder en ga naar het admin-dashboard (`/admin`). Hier kun je evenementen toevoegen, bewerken of verwijderen die op de publieke kalender (`/kalender`) verschijnen.

### 4. Pagina Content Aanpassen
Via het admin-dashboard kun je statische pagina's (zoals 'Home', 'Praktisch', 'Afdelingen') bewerken. Dit gebeurt door naar `/admin/page/{pagina_slug}` te navigeren en de content aan te passen.

### 5. Excel Export
In het admin-dashboard, onder 'Inschrijvingen', is er een optie om de huidige ledenlijst te exporteren naar een Excel-bestand.

---
