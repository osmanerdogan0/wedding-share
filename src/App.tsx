
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import GalleryPage from "./pages/GalleryPage";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:eventId" element={<UploadPage />} />
        <Route path="/:eventId/gallery" element={<GalleryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
