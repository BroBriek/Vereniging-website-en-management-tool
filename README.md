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

4.  **Organisatie Instellen (BELANGRIJK):**
    Gebruik de interactieve setup tool om uw Chiro organisatie in te stellen:
    ```bash
    node scripts/setup-organization.js
    ```
    Dit script begeleidt u door alle instellingen (naam, adres, domein, kleuren, etc.) en genereert automatisch uw `.env` bestand.
    
    **Alternatief (handmatig):** Maak een `.env` bestand aan in de root van het project. Voor alle beschikbare instellingen, zie `docs/ORGANIZATION_SETUP.md`.

5.  **Start de applicatie:**
    ```bash
    node server.js
    ```
    De applicatie is nu beschikbaar via `http://localhost:3000` (of de poort die je in `.env` hebt ingesteld).

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

Gemaakt met ❤️ voor de vereniging.
