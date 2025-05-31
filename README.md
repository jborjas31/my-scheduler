# 📅 My Daily Scheduler

A modern, responsive web application for personal task scheduling and productivity management. Built with vanilla JavaScript, Firebase, and designed as a Progressive Web App (PWA).

![App Preview](docs/images/app-preview.png)

## ✨ Features

- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🔄 **Real-time Sync** - Data synced across all your devices
- 🌙 **Cross-midnight Tasks** - Support for tasks that span midnight
- ⚡ **Offline Support** - Works offline with PWA capabilities
- 🎯 **Priority System** - Fixed (cannot skip) vs Flexible tasks
- 📊 **Smart Dashboard** - Shows current, upcoming, and overdue tasks
- 🕐 **Visual Timeline** - Intuitive time-based task visualization
- ✅ **Task Management** - Add, edit, complete, and delete tasks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Firebase project set up

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jborjas31/my-scheduler.git
   cd my-scheduler
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:5173`

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run deploy` - Deploy to GitHub Pages
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── js/           # JavaScript modules
├── css/          # Stylesheets
├── assets/       # Images, icons, etc.
├── index.html    # Main HTML file
├── manifest.json # PWA manifest
└── service-worker.js # Service worker for offline support
```

## 🔥 Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Get your config object from Project Settings
4. Update your `.env` file with the configuration values

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📱 PWA Installation

The app can be installed on your device:

1. **Desktop**: Click the install button in the address bar
2. **Mobile**: Use "Add to Home Screen" from your browser menu

## 🎨 Customization

### Themes
- Edit CSS custom properties in `src/css/style.css`
- Modify the color scheme in the `:root` selector

### Time Range
- Adjust `SCHEDULE_START_HOUR` and `SCHEDULE_END_HOUR` in `script.js`

## 🚀 Deployment

### GitHub Pages (Automatic)

1. Push changes to the `main` branch
2. Run `npm run deploy`
3. Your app will be available at `https://yourusername.github.io/my-scheduler/`

### Manual Deployment

1. Build the project: `npm run build`
2. Upload the `dist/` folder to your hosting provider

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Bug Reports & Feature Requests

Please use the [GitHub Issues](https://github.com/yourusername/my-scheduler/issues) page to report bugs or request features.

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

## 🙏 Acknowledgments

- Firebase for backend services
- Vite for build tooling
- The web development community for inspiration

---

⭐ If you find this project useful, please consider giving it a star!