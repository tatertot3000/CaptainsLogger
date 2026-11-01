# Captain's Logger — Windows 11 Installation & Setup Guide

This guide walks you through setting up and running **Captain's Logger** on a **Windows 11** PC from scratch, including installing **Node.js**, setting up the project dependencies, running the application, and installing it as an offline desktop application.

---

## Table of Contents
1. [Step 1: Install Node.js on Windows 11](#step-1-install-nodejs-on-windows-11)
2. [Step 2: Install Git for Windows (Recommended)](#step-2-install-git-for-windows-recommended)
3. [Step 3: Get the Captain's Logger Codebase](#step-3-get-the-captains-logger-codebase)
4. [Step 4: Install Project Dependencies](#step-4-install-project-dependencies)
5. [Step 5: Launch the Application](#step-5-launch-the-application)
6. [Step 6: Install as a Standalone Windows Desktop App (PWA)](#step-6-install-as-a-standalone-windows-desktop-app-pwa)
7. [Step 7: Accessing from a Phone or Tablet on the Boat (Local Wi-Fi)](#step-7-accessing-from-a-phone-or-tablet-on-the-boat-local-wi-fi)
8. [Troubleshooting Common Windows Issues](#troubleshooting-common-windows-issues)

---

## Step 1: Install Node.js on Windows 11

Captain's Logger requires **Node.js (version 18 or higher, version 20+ LTS recommended)** and **npm**.

Choose either **Method A (Easiest)** or **Method B (PowerShell)**:

### Method A: Official Installer (Recommended for beginners)
1. Open your web browser and navigate to the official Node.js website:
   👉 **[https://nodejs.org](https://nodejs.org)**
2. Click the button labeled **"LTS (Recommended for Most Users)"** to download the Windows Installer (`.msi`).
3. Run the downloaded installer file.
4. Step through the installation wizard:
   - Accept the license agreement.
   - Keep the default installation directory (usually `C:\Program Files\nodejs\`).
   - On the "Tools for Native Modules" screen, you can leave the box unchecked (Captain's Logger uses pure web dependencies).
   - Click **Install**, and approve the Windows User Account Control prompt.
5. Click **Finish**.

### Method B: Windows Package Manager (`winget`)
If you prefer the command line:
1. Open **Windows Terminal** or **PowerShell** (press `Win + X` and select **Terminal**).
2. Run:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```
3. Restart your terminal window after the installation completes.

### Verify Node.js and npm Installation
Open a **new** Windows Terminal or PowerShell window and verify both tools:
```powershell
node -v
npm -v
```
You should see version outputs such as `v20.x.x` or `v22.x.x` for Node, and `10.x.x` for npm.

---

## Step 2: Install Git for Windows (Recommended)

Git allows you to easily clone the repository and pull future updates.

### Method A: Command Line (`winget`)
In your terminal, run:
```powershell
winget install Git.Git
```

### Method B: Official Installer
Download and run the installer from 👉 **[https://git-scm.com/download/win](https://git-scm.com/download/win)**.

---

## Step 3: Get the Captain's Logger Codebase

1. Open **Windows Terminal** or **PowerShell**.
2. Navigate to your desired working directory (e.g. `C:\git` or `C:\Users\<YourUser>\Documents`):
   ```powershell
   # Example: create and enter a projects directory
   mkdir C:\git
   cd C:\git
   ```
3. Clone the repository:
   ```powershell
   git clone https://github.com/<your-username>/CaptainsLogger.git
   cd CaptainsLogger
   ```
   *(Alternatively, if you received the project as a `.zip` archive, extract it and navigate inside the folder using `cd path\to\CaptainsLogger`)*.

---

## Step 4: Install Project Dependencies

Inside the project directory (`CaptainsLogger`), run:

```powershell
npm install
```

This will download and install the required packages (React, Vite, Lucide Icons, Tailwind CSS, TypeScript, and the PWA plugin) into the `node_modules` folder.

---

## Step 5: Launch the Application

Start the local development server:

```powershell
npm run dev
```

You will see output similar to:
```text
  VITE v6.0.5  ready in 280 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

Open your web browser (Chrome, Edge, Brave, or Firefox) and visit:
👉 **[http://localhost:5173](http://localhost:5173)**

The Captain's Logger app is now running locally on your PC!

---

## Step 6: Install as a Standalone Windows Desktop App (PWA)

Captain's Logger is built as a Progressive Web App (PWA). You can install it directly to Windows so that it appears in your Start Menu, Taskbar, and runs in an app window without browser tabs or address bars:

### In Microsoft Edge or Google Chrome:
1. Open **`http://localhost:5173`** in Edge or Chrome.
2. In the right side of the address bar, look for the **Install** icon:
   - In **Edge**: A monitor icon with a down arrow, or click `...` Menu > **Apps** > **Install Captain's Logger**.
   - In **Chrome**: An install computer icon, or click `⋮` Menu > **Save and share** > **Install Captain's Logger**.
3. Click **Install**.
4. Check **Pin to taskbar** or **Pin to Start** if desired.

Now you can launch **Captain's Logger** just like any native Windows desktop application!

---

## Step 7: Accessing from a Phone or Tablet on the Boat (Local Wi-Fi)

If your laptop is connected to your boat's router or hotspot, you can access Captain's Logger from your phone or tablet:

1. Launch Vite with the `--host` flag:
   ```powershell
   npm run dev -- --host
   ```
2. Vite will display a **Network** URL, for example:
   ```text
   ➜  Network: http://192.168.1.120:5173/
   ```
3. On your phone or tablet connected to the same Wi-Fi, open your mobile browser and go to that IP address (e.g., `http://192.168.1.120:5173`).
4. On Android (Chrome) or iPhone (Safari), tap **Add to Home Screen** to install the mobile app version.

---

## Troubleshooting Common Windows Issues

### 1. `scripts cannot be loaded because running scripts is disabled on this system` (ExecutionPolicy Error)
If PowerShell refuses to run `npm` or local commands due to Windows execution policies:
1. Open PowerShell and run:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
2. Type `Y` to confirm.

### 2. `node: command not found` after installing Node.js
If PowerShell does not recognize `node` immediately after installation:
- Close all open PowerShell / Command Prompt windows and open a new one so Windows reloads the system `PATH`.
- If it still fails, check that `C:\Program Files\nodejs\` is listed in your User/System Environment Variables under `PATH`.

### 3. Port `5173` is already in use
If another process is using port 5173, Vite will automatically offer the next port (e.g. `5174`), or you can specify a custom port:
```powershell
npm run dev -- --port 3000
```

### 4. Windows Defender Firewall prompt
When you run `npm run dev -- --host`, Windows Defender Firewall may display a pop-up asking for permission. Check the box for **Private networks** and click **Allow access** so other devices on your boat's Wi-Fi can connect.

---

## Available Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts the fast local development server on `http://localhost:5173`. |
| `npm run dev -- --host` | Exposes the server on your local network for phones and tablets. |
| `npm run build` | Compiles TypeScript and creates an optimized production build in `dist/`. |
| `npm run preview` | Runs a local web server serving the production `dist/` build. |

