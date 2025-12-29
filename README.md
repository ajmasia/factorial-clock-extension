# Factorial Clock - Browser Extension

> Automate your weekly time tracking in Factorial with intelligent schedule generation

Modern browser extension that generates realistic weekly work schedules and applies them directly to Factorial's time tracking system.

[![Version](https://img.shields.io/badge/version-0.1.3-blue.svg)](https://github.com/ajmasia/factorial-clock-extension)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![Made with React](https://img.shields.io/badge/Made%20with-React-61dafb.svg)](https://reactjs.org/)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF.svg)](https://vitejs.dev/)

## What is this?

Factorial Clock is a browser extension that helps you manage your weekly work schedules in Factorial. Instead of manually entering your clock-in/clock-out times every day, this extension generates realistic weekly schedules with natural variance and applies them automatically.

### Key Features

- **Smart Schedule Generation**: Creates realistic weekly schedules with random variance
- **Flexible Configuration**: Customize work hours, days, clock-in times, and lunch breaks
- **Split Shifts Support**: Handle schedules with lunch breaks (morning + afternoon shifts)
- **Exception Management**: Define holidays, vacations, and special work weeks
- **History Tracking**: View and manage previously generated schedules
- **One-Click Application**: Apply entire weekly schedules to Factorial instantly

## How It Works

1. **Configure your preferences** - Set your weekly hours, work days, and time ranges
2. **Generate a schedule** - The extension creates a realistic weekly schedule with natural variance
3. **Review the preview** - Check daily times and total hours before applying
4. **Apply to Factorial** - One click sends the entire schedule to Factorial via their API

The extension uses Factorial's GraphQL API to create shifts directly in your account, handling both continuous and split shifts automatically.

## Installation

### For Development/Testing

1. **Clone the repository**
   ```bash
   git clone https://github.com/ajmasia/factorial-clock-extension.git
   cd factorial-clock-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```
   This creates a `dist/` folder with the compiled extension.

4. **Load in your browser**

   #### Chrome / Edge / Brave
   1. Open `chrome://extensions/`
   2. Enable "Developer mode" (toggle in top right)
   3. Click "Load unpacked"
   4. Select the `dist/` folder
   5. The extension icon appears in your toolbar

   #### Firefox
   1. Open `about:debugging`
   2. Click "This Firefox"
   3. Click "Load Temporary Add-on"
   4. Select `dist/manifest.json`
   5. The extension icon appears in your toolbar

## Usage

### First Time Setup

1. Click the extension icon in your toolbar
2. Go to the **Config** tab
3. Configure your settings:
   - Weekly hours target (e.g., 40h)
   - Work days (Monday-Friday by default)
   - Clock-in time range (e.g., 07:00-07:30)
   - Lunch preferences (for split shifts)
   - Employee ID (found in Factorial)
4. Click **Save Configuration**

### Generating Schedules

1. Go to the **Generate** tab
2. Select the week you want to schedule
3. Click **Generate Schedule**
4. Review the preview:
   - Daily clock-in/clock-out times
   - Lunch breaks (if using split shifts)
   - Total weekly hours
5. Click **Apply to Factorial** to create the shifts

### Managing Exceptions

Use the **Exceptions** tab to define:
- **Holidays** - Days you don't work
- **Vacations** - Date ranges you're away
- **Special Weeks** - Weeks with different hour requirements
- **Sick Leave** - Days you were sick

These are automatically excluded when generating schedules.

### Viewing History

The **History** tab shows all previously applied schedules with:
- Week dates and total hours
- When it was applied
- Detailed daily breakdown
- Option to delete entries

## Publishing to Chrome Web Store

### Prerequisites

- Google account with Chrome Web Store developer access ($5 one-time fee)
- All extension assets (icons, screenshots, descriptions)
- Privacy policy URL (if collecting user data)

### Steps

1. **Prepare the production build**
   ```bash
   npm run build
   ```

2. **Create a ZIP file**
   ```bash
   cd dist
   zip -r ../factorial-clock-extension.zip .
   cd ..
   ```

3. **Go to Chrome Web Store Developer Dashboard**
   - Visit: https://chrome.google.com/webstore/devconsole
   - Sign in with your Google account
   - Pay the $5 developer fee (if first time)

4. **Create a new item**
   - Click "New Item"
   - Upload `factorial-clock-extension.zip`
   - Wait for upload to complete

5. **Fill in store listing details**
   - **Name**: Factorial Clock
   - **Summary**: Automate weekly time tracking in Factorial
   - **Description**: (Detailed description of features)
   - **Category**: Productivity
   - **Language**: English (and others if needed)

6. **Add assets**
   - **Icon**: 128x128px (use `src/assets/icons/icon128.png`)
   - **Screenshots**: At least 1 screenshot (1280x800 or 640x400)
   - **Promotional tile**: 440x280px (optional but recommended)

7. **Set privacy settings**
   - Declare permissions usage
   - Add privacy policy URL (if applicable)
   - Confirm data handling practices

8. **Submit for review**
   - Click "Submit for review"
   - Review typically takes 1-3 business days
   - You'll receive email notification when approved

### Publishing Updates

1. Build new version with updated version number in `manifest.json`
2. Create new ZIP file
3. Go to your item in the dashboard
4. Click "Upload updated package"
5. Submit for review

**Note**: Updates are also reviewed but typically faster than initial submission.

## Development

### Project Structure

```
factorial-clock-extension/
├── src/
│   ├── popup/              # React UI components
│   │   ├── pages/          # Main pages (Generate, Config, etc.)
│   │   ├── components/     # Reusable components
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   ├── background/         # Service worker
│   ├── content/            # Content script for Factorial API
│   ├── lib/                # Utilities (scheduler logic)
│   ├── assets/             # Icons and static assets
│   └── styles/             # CSS/Tailwind styles
├── manifest.json           # Extension manifest
├── vite.config.js          # Build configuration
└── package.json            # Dependencies
```

### Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Chrome Extension APIs** - Storage, cookies, messaging
- **date-fns** - Date manipulation
- **Factorial GraphQL API** - Shift creation

### Development Commands

```bash
# Install dependencies
npm install

# Development mode (watch mode)
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

### Making Changes

1. Make your changes in `src/`
2. Run `npm run build` to rebuild
3. Reload the extension in browser:
   - Go to `chrome://extensions/`
   - Click the reload icon on the extension card
4. Test your changes in the popup

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This extension is not officially affiliated with or endorsed by Factorial. It's an independent tool created to automate time tracking workflows. Use at your own discretion and ensure compliance with your company's time tracking policies.

## Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/ajmasia/factorial-clock-extension/issues)
- **Documentation**: Check the code comments and inline documentation

---

Made with ❤️ for developers who automate their workflows
