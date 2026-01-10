import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { initSocket, connectSocket } from "./services/socket";
import loadable from "@loadable/component";
import "./App.css";

const Lobby = loadable(() => import("./pages/Lobby"), {
  fallback: <div>Loading Lobby...</div>,
});
const Room = loadable(() => import("./pages/Room"), {
  fallback: <div>Loading Room...</div>,
});
const AlertModal = loadable(() => import("./components/AlertModal"));

function App() {
  useEffect(() => {
    // Initialize and connect socket on app mount
    initSocket();
    connectSocket();
  }, []);

  return (
    <HashRouter>
      <AlertModal />
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
