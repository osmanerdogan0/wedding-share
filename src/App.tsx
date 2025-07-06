import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import GalleryPage from "./pages/GalleryPage";
import MemoryUploadPage from "./pages/MemoryBookPage";
import MemoryDisplayPage from "./pages/MemoryDisplayPage";
import VoiceDisplayPage from "./pages/VoiceDisplayPage";
import VoiceUploadPage from "./pages/VoiceUploadPage";
import AdminMemoryUploadPage from "./pages/admin/AdminMemoryDisplayPage";
import AdminGalleryPage from "./pages/admin/AdminGalleryPage";
import AdminVoiceUploadPage from "./pages/admin/AdminVoiceUploadPage";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:eventId" element={<UploadPage />} />
        <Route path="/:eventId/gallery" element={<GalleryPage />} />
        <Route path="/:eventId/memoryUpload" element={<MemoryUploadPage />} />
        <Route path="/:eventId/memoryDisplay" element={<MemoryDisplayPage />} />
        <Route path="/:eventId/voiceDisplay" element={<VoiceDisplayPage />} />
        <Route path="/:eventId/voiceUpload" element={<VoiceUploadPage />} />

        <Route
          path="/:eventId/adminMemory"
          element={<AdminMemoryUploadPage />}
        />
        <Route path="/:eventId/adminGallery" element={<AdminGalleryPage />} />
        <Route path="/:eventId/adminVoice" element={<AdminVoiceUploadPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
