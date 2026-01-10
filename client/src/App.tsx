import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { initSocket, connectSocket } from "./services/socket";
import loadable from "@loadable/component";
import "./App.css";

const Lobby = loadable(() => import("./pages/Lobby"), {
  fallback: <div>Loading Lobby...</div>,
});
const Room = loadable(() => import("./pages/Room"), {
  fallback: <div>Loading Room...</div>,
});

function App() {
  useEffect(() => {
    // Initialize and connect socket on app mount
    initSocket();
    connectSocket();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
