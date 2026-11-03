# Hotel Manager

Aplicație web pentru managementul unui hotel: camere, rezervări și oaspeți. Construită cu **Node.js**, **Express** și **MySQL**.

## Funcționalități
- Panou cu grad de ocupare, sosiri/plecări de azi și venit lunar
- Camere cu status (liberă, ocupată, curățenie, mentenanță) editabil
- Rezervări cu verificare de suprapunere, calcul automat al totalului, check-in / check-out / anulare (tranzacție SQL)
- Oaspeți cu căutare după nume sau email

## Rulare
1. Instalează Node.js 18+ și MySQL 8+
2. `npm install`
3. `mysql -u root -p < db/schema.sql` (creează baza `hotel` și date de test)
4. `cp .env.example .env` și completează parola MySQL
5. `npm start` și deschide http://localhost:3000

## API
| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/api/stats` | statistici generale |
| GET / PATCH | `/api/rooms`, `/api/rooms/:id` | listă camere / schimbă status |
| GET / POST | `/api/guests` | listă (cu `?q=`) / adaugă oaspete |
| GET / POST | `/api/bookings` | listă / creează rezervare |
| PATCH | `/api/bookings/:id` | `checked_in`, `checked_out`, `cancelled` |

## Idei de extins
Autentificare staff, facturi PDF, calendar de disponibilitate, rapoarte, plăți.
