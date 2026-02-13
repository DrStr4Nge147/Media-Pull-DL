# 📥 Media-Pull DL

> A powerful, sleek, and high-performance media downloader built on top of `yt-dlp` and powered by Electron.

Media-Pull DL provides a premium, intuitive interface for downloading media from hundreds of supported websites. Whether you're grabbing a single video or managing a massive download queue, Media-Pull DL handles it with ease, providing real-time terminal feedback and a comprehensive download history.

---

## ✨ Key Features

*   🚀 **High-Speed Downloads**: Leveraging the power of `yt-dlp`.
*   📊 **Queue Management**: Easily manage multiple downloads in a dedicated queue.
*   📜 **Download History**: Keep track of all your past downloads, successful or failed.
*   💻 **Terminal Output**: Real-time progress and logs directly in the app.
*   🛠️ **Automatic Updates**: Built-in version checking for the `yt-dlp` core.
*   📦 **Portable Build**: Distributable as a standalone Windows executable.

---

## 🛠️ Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (Latest LTS recommended)
*   [yt-dlp](https://github.com/yt-dlp/yt-dlp) (The app will attempt to manage this in the `bin/` folder)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/DrStr4Nge147/Media-Pull-DL.git
    cd Media-Pull-DL
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

### Development

Run the application in development mode with live reloading:

```bash
npm run dev
```

---

## 🚀 Building & Deployment

### Build for Electron (Windows)

To create a portable executable for Windows:

```bash
npm run build:electron
```

The output will be generated in the `dist_electron/` directory as a portable `.exe` file.

---

## 📁 Project Structure

*   `src/` - React frontend components and logic.
*   `electron/` - Electron main process and IPC handlers.
*   `bin/` - Contains the `yt-dlp.exe` binary.
*   `public/` - Static assets like logos and icons.

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<p align="center">Made with ❤️ for the community.</p>
