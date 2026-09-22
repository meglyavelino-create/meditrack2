# MediTrack 2

A medication tracking web app with Firebase Realtime Database and ESP32 dose-status integration.

## Dose status ownership

- The web app creates a new scheduled dose with `status: pending`.
- The web app reads dose status in realtime.
- The web app does not change an existing dose's `status` or `updatedAt`.
- ESP32 is responsible for changing `pending` to `taken` or `missed` and writing `updatedAt`.

## Planned stack

- Next.js
- TypeScript
- Tailwind CSS
- Firebase Authentication
- Firebase Realtime Database
