# 🎮 GameHub24
> **Your Ultimate Real-Time Multiplayer Gaming Destination**

### [Play now](https://gamehub24.pages.dev)

![GameHub Banner](https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop)

**GameHub** is a cutting-edge web platform that brings friends together through seamless real-time gaming experiences. Built with modern web technologies, it offers a sleek, dark-themed interface where players can create rooms, chat, and compete in classic board games or relax with watch parties.

---

## ✨ Key Features

### 🕹️ Diverse Game Library
- **Chess**:
  - **Single Player**: Challenge our advanced Stockfish AI with varying difficulty levels.
  - **Multiplayer**: Classic 1v1 matches with move validation, history, and captured piece tracking.
- **Caro (Gomoku)**: The ultimate test of strategy on a boundless board. Win by connecting 5 in a row!
- **Tic Tac Toe**: The classic game, reimagined with a modern UI.
- **YouTube Watch Party**: Synchronized video playback to watch content together in real-time.

### 🌐 Powerful Multiplayer System
- **Real-Time Interaction**: Instant updates for moves, chat, and room status using **Socket.IO**.
- **Room Management**:
  - Create **Public** rooms to meet new players.
  - Create **Private** password-protected rooms for friends.
- **Live Chat**: Integrated lobby and in-room chat systems with typing indicators and presence detection.
- **Smart Hosting**: Automatic host assignment and transfer ensure the game always goes on.

### 🎨 Premium User Experience
- **Glassmorphism Design**: A stunning, translucent UI with blur effects and neon accents.
- **OLED Dark Mode**: Deep blacks and vibrant purples designed for prolonged gaming sessions.
- **Responsive & Adaptive**: Flawless experience across desktop, tablet, and mobile devices.
- **Global Alerts**: Beautiful, non-intrusive notification system for game events and errors.

---

## 🛠️ Technology Stack

GameHub is engineered for performance and scalability using the latest industry standards.

| Component | Tech Stack |
| :--- | :--- |
| **Frontend** | **React 19**, **TypeScript**, **Vite** |
| **Styling** | **Tailwind CSS 4** (Utility-first), **Lucide React** (Icons) |
| **State Management** | **Zustand** (Global State) |
| **Real-Time** | **Socket.IO Client** & **Server** |
| **Engine** | **Stockfish.js** (Chess Engine) |
| **Routing** | **React Router** (HashRouter for broad compatibility) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Quick Install

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/gamehub.git
cd gamehub

# 2. Install Client + Server
cd client && npm i && cd .. && cd server && npm i
```

### Running the Application

**1. Start the Backend Server**
```bash
cd server
npm run dev
# Server runs on http://localhost:3001
```

**2. Start the Frontend Client**
```bash
cd client
npm run dev
# Client runs on http://localhost:5173
```

---

## 📦 Deployment

### Frontend (GitHub Pages / Vercel)
The client is optimized for static hosting.
```bash
cd client
npm run build
# Deploy the 'built/' folder + file 'index.html'
```
*Note: The app uses `HashRouter` and relative paths (`./`) to ensure compatibility with subdirectory deployments like GitHub Pages.*

### Backend (Railway / Render / Fly.io)
Deploy the Node.js server to any platform supporting WebSockets.
- set `CLIENT_URL` environment variable to your frontend domain (CORS).
- set `PORT` (defaults to 3001).

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <p>Built with ❤️ by Hoang Tran</p>
</div>
