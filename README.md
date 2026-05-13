# HF Task Manager

A lightweight, browser-based task tracker built for the **HF** game development project. Tracks tasks, bugs, and progress across team members with real-time cloud sync via Firebase Firestore.

## Features

- **Dashboard** — Overview with progress bars, category breakdowns, and team workload
- **Task Board** — Grouped by category with inline subtasks, sorting, and search
- **Cloud Sync** — All data persisted to Firebase Firestore in real-time
- **Dark / Light Theme** — Toggleable with `T` key or button
- **Keyboard Shortcuts** — `N` new task, `/` search, `D` toggle dashboard, `Esc` close panels
- **Undo Delete** — 5-second undo window after deleting a task
- **Export CSV** — One-click export of all tasks
- **Mobile Responsive** — Sidebar collapses into hamburger menu on small screens

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no build tools)
- Firebase Firestore (via CDN ESM imports)
- Google Fonts: Syne + JetBrains Mono

## Usage

Open `index.html` in any modern browser. No server or build step required.

## Project Structure

```
index.html   — App shell and markup
styles.css   — Full design system (dark/light themes, responsive)
app.js       — Application logic, Firebase integration, rendering
```
