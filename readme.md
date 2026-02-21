# PILLAR - Dynamic Island for Windows

<div align="center">
  <img src="public/pillar.svg" alt="PILLAR Logo" width="120" height="120">
  
  **A sleek, Dynamic Island-style system overlay for Windows**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Tauri](https://img.shields.io/badge/Tauri-2.0+-blue.svg)](https://tauri.app/)
  [![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6.svg)](https://www.typescriptlang.org/)
</div>

## ✨ Features

- **Dynamic Island-style overlay** positioned at the top-center of your screen
- **Always-on-top transparent window** that feels native to Windows
- **Smooth animations** powered by Motion and React
- **Near-zero resource usage** when idle
- **Smart positioning** that adapts to display changes and fullscreen apps
- **Reliable interaction model** - overlay remains clickable for consistent hover/expand behavior
- **Built with Tauri** for a lightweight, secure desktop application

## 🚀 Quick Start

### Prerequisites

- Windows 10/11
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://rustup.rs/) (for Tauri backend)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pillar-dynamic-island.git
   cd pillar-dynamic-island
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

4. **Build for production**
   ```bash
   npm run tauri build
   ```

The built application will be available in the `src-tauri/target/release/bundle/` directory.

## 🛠️ Development

### Project Structure

```
pillar-dynamic-island/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Main application component
├── src-tauri/             # Tauri Rust backend
├── public/                # Static assets
└── scripts/               # Build scripts
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run tauri dev` - Run Tauri app in development
- `npm run tauri build` - Build Tauri app for production
- `npm run icons` - Generate application icons

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Motion
- **Backend**: Tauri 2.0 (Rust)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with PostCSS

## 🎯 How It Works

PILLAR creates a borderless, transparent overlay window that:

1. **Positions itself** at the top-center of your primary display
2. **Stays idle** with minimal resource usage
3. **Expands on hover** to reveal content
4. **Responds to system events** like display changes and fullscreen apps
5. **Auto-hides** during fullscreen applications or games

### Window Behavior

- ✅ Borderless and transparent
- ✅ Always on top
- ✅ Hidden from taskbar and Alt+Tab
- ✅ DPI-aware and GPU-accelerated
- ✅ Consistently clickable for hover/expand interactions
- ✅ Repositions on display changes

## 🔧 Configuration

The application behavior can be configured through the Tauri configuration file (`src-tauri/tauri.conf.json`):

```json
{
  "app": {
    "windows": [
      {
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false
      }
    ]
  }
}
```

### Prism AI (Groq) setup

Prism AI uses the Groq API from the Tauri backend. Set the API key **in the same terminal** where you run the app (or set it before `npm run tauri build` to embed it in the .exe):

```powershell
$env:GROQ_API_KEY = "your_groq_api_key_here"
npm run tauri dev
```

If the key is missing, the app will show: *"GROQ_API_KEY is not set. Set it before building or running PILLAR."*

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Apple's Dynamic Island design
- Built with [Tauri](https://tauri.app/) for cross-platform desktop apps
- Icons and animations powered by [Motion](https://motion.dev/)

---

<div align="center">
  Made with ❤️ for the Windows community
</div>
