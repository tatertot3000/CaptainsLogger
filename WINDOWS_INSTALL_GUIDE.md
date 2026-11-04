# Captain's Logger — Windows Installation & Setup Guide

This guide covers setting up and running **Captain's Logger** on a Windows PC, including installing **Node.js**, setting up dependencies, running the local server, and accessing the app from phones or tablets on your boat's local network.

---

## Table of Contents
1. [Step 1: Install Node.js](#step-1-install-nodejs)
2. [Step 2: Install Git](#step-2-install-git)
3. [Step 3: Download Captain's Logger](#step-3-download-captains-logger)
4. [Step 4: Install Dependencies](#step-4-install-dependencies)
5. [Step 5: Run the Application](#step-5-run-the-application)
6. [Step 6: Run in an App Window on Windows](#step-6-run-in-an-app-window-on-windows)
7. [Step 7: Connect Phones & Tablets over Boat Wi-Fi](#step-7-connect-phones--tablets-over-boat-wi-fi)
8. [Troubleshooting](#troubleshooting)

---

## Step 1: Install Node.js

Captain's Logger requires **Node.js (version 20+ LTS recommended)** and **npm**.

### Option A: Official Installer
1. Go to **[https://nodejs.org](https://nodejs.org)**.
2. Download the **LTS** Windows Installer (`.msi`).
3. Run the installer, accept default settings, and complete the setup.

### Option B: Windows Package Manager (`winget`)
In PowerShell:
```powershell
winget install OpenJS.NodeJS.LTS
```
Restart your terminal after installation.

### Verify Installation
Open a new PowerShell window and run:
```powershell
node -v
npm -v
```
You should see version numbers (e.g. `v20.x.x` or `v22.x.x` for Node, and `10.x.x` for npm).

---

## Step 2: Install Git

Git is used to clone the repository and pull updates.

In PowerShell:
```powershell
winget install Git.Git
```
*(Or download the installer from [https://git-scm.com/download/win](https://git-scm.com/download/win)).*

---

## Step 3: Download Captain's Logger

1. Open PowerShell and navigate to your preferred directory:
   ```powershell
   mkdir C:\git
   cd C:\git
   ```
2. Clone the repository:
   ```powershell
   git clone https://github.com/tatertot3000/CaptainsLogger.git
   cd CaptainsLogger
   ```

---

## Step 4: Install Dependencies

Inside the `CaptainsLogger` folder, run:

```powershell
npm install
```

---

## Step 5: Run the Application

Start the local server:

```powershell
npm run dev
```

Open your browser (Chrome, Edge, or Firefox) and navigate to:  
👉 **[http://localhost:5173](http://localhost:5173)**

---

## Step 6: Run in an App Window on Windows

To run Captain's Logger in its own clean window without browser tabs or address bars:

### In Microsoft Edge or Google Chrome:
1. Open **`http://localhost:5173`**.
2. Look for the install/app icon in the address bar:
   - In **Edge**: Click the monitor icon with down arrow, or click `...` Menu > **Apps** > **Install Captain's Logger**.
   - In **Chrome**: Click the install icon, or click `⋮` Menu > **Save and share** > **Install Captain's Logger**.
3. Click **Install**. You can pin the shortcut to your Windows Taskbar or Start Menu.

---

## Step 7: Connect Phones & Tablets over Boat Wi-Fi

If your laptop is connected to your boat's router or hotspot, you can load Captain's Logger onto phones and tablets:

1. Start Vite with the `--host` flag:
   ```powershell
   npm run dev -- --host
   ```
2. Vite displays your local IP address:
   ```text
   ➜  Network: http://192.168.1.120:5173/
   ```
3. On your phone or tablet connected to the same Wi-Fi, open your browser and navigate to that address (e.g. `http://192.168.1.120:5173`).

---

## Troubleshooting

### 1. `scripts cannot be loaded because running scripts is disabled`
If PowerShell blocks running `npm` commands:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
Press `Y` to confirm.

### 2. `node: command not found`
Restart your PowerShell window so Windows reloads the system `PATH`. Verify that `C:\Program Files\nodejs\` is in your user or system environment `PATH`.

### 3. Port 5173 is already in use
Specify a different port:
```powershell
npm run dev -- --port 3000
```

### 4. Windows Firewall Prompt
When running `npm run dev -- --host`, Windows Firewall may ask for permission. Select **Private networks** and click **Allow access** so other devices on your boat's network can connect.

---

## Available Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts the local dev server on `http://localhost:5173`. |
| `npm run dev -- --host` | Exposes the server to phones and tablets on your local network. |
| `npm run build` | Compiles the production bundle into `dist/`. |
| `npm run build:demo` | Compiles demo build with sample vessel data and logs. |
| `npm run preview` | Serves the production build locally. |
