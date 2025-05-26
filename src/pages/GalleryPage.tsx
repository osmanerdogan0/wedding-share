import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import Gallery from "react-photo-gallery";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";

import LightGallery from "lightgallery/react";
import lgVideo from "lightgallery/plugins/video";

// import styles
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";

// If you want you can use SCSS instead of css
import "lightgallery/scss/lightgallery.scss";
import "lightgallery/scss/lg-zoom.scss";
import "lightgallery/css/lg-video.css";
// import plugins if you need
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";

export default function GalleryPage() {
  const { eventId } = useParams();
  const [mediaList, setMediaList] = useState<
    { src: string; width: number; height: number }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const onInit = () => {
    console.log("lightGallery has been initialized");
  };
  const loadImageSize = (
    url: string
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
    });
  };
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, "events", eventId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("Data: ", data);
          setEventName(data.eventName || ""); // eventName yoksa boş string ata
        } else {
          console.log("Event bulunamadı!");
        }
      } catch (error) {
        console.error("Event verisi alınırken hata:", error);
      }
    };

    fetchEvent();
    const fetchMedia = async () => {
      setLoading(true);
      const q = query(
        collection(db, "events", eventId, "media"),
        where("visibility", "==", "public"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const promises = snapshot.docs.map(async (doc) => {
        const data = doc.data();
        if (!data.url) return null;

        if (data.type === "image") {
          try {
            const size = await loadImageSize(data.url);
            return {
              src: data.url,
              type: "image",
              width: size.width,
              height: size.height,
              senderName: data.senderName,
            };
          } catch (err) {
            console.error("Görsel boyutu alınamadı:", err);
            return null;
          }
        } else if (data.type === "video") {
          // Video için sabit boyut döndür
          return {
            thumbnail: data.thumbnail,
            src: data.url,
            type: "video",
            width: 1280,
            height: 720,
            senderName: data.senderName,
          };
        }

        return null;
      });

      const results = await Promise.all(promises);
      setMediaList(results.filter(Boolean));
      setLoading(false);
    };

    fetchMedia();
    console.log("mediaList:", mediaList);
  }, [eventId]);

  return (
    <div style={{ padding: 20 }}>
      <h1
        className="text-4xl text-center mb-8 text-black"
        style={{ fontFamily: "'Ms Madi', cursive" }}
      >
        {eventName}
      </h1>

      {loading === true && (
        <div className="flex flex-col items-center justify-center min-h-[150px]">
          <div
            className={`
      animate-spin
      rounded-full
      border-4
      border-t-4
      border-pink-500
      border-t-transparent
      w-8 h-8
    `}
          />
          <p className="text-2xl text-center mt-4 text-black">Yükleniyor</p>
        </div>
      )}

      {mediaList.length === 0 && loading === false && (
        <p className="text-2xl text-center mb-8 text-black">
          Henüz herkese açık bir medya yüklenmemiş.
        </p>
      )}
      <LightGallery
        onInit={onInit}
        speed={500}
        plugins={[lgThumbnail, lgZoom, lgVideo]}
        elementClassNames="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
      >
        {mediaList.map((media, index) =>
          media.type === "image" ? (
            <a
              key={index}
              href={media.src}
              data-sub-html={`<h4>Gönderen: ${
                media.senderName || "Anonim"
              }</h4>`}
              className="block w-full aspect-square overflow-hidden rounded-lg"
            >
              <img
                src={media.src}
                alt=""
                className="w-full h-full object-cover rounded-lg cursor-pointer"
              />
            </a>
          ) : (
            <a
              key={index}
              data-lg-size="1280-720"
              data-sub-html={`<h4>Gönderen: ${
                media.senderName || "Anonim"
              }</h4>`}
              data-video={JSON.stringify({
                source: [
                  {
                    src: media.src,
                    type: "video/mp4",
                  },
                ],
                attributes: {
                  preload: false,
                  controls: true,
                },
              })}
              className="block w-full aspect-square overflow-hidden rounded-lg"
            >
              <img
                src={media.thumbnail}
                alt="video"
                className="w-full h-full object-cover rounded-lg cursor-pointer"
              />
            </a>
          )
        )}
      </LightGallery>
    </div>
  );
}
