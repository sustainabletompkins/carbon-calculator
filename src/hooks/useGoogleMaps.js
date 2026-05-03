import { useEffect, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

setOptions({
  key: import.meta.env.VITE_GOOGLE_API_KEY,
  version: "weekly",
});

const useGoogleMaps = () => {
  const [google, setGoogle] = useState(null);

  useEffect(() => {
    const loadGoogleMaps = async () => {
      const maps = await importLibrary("maps");
      const places = await importLibrary("places");
      const routes = await importLibrary("routes");
      setGoogle({ maps, places, routes });
    };

    loadGoogleMaps();
  }, []);

  return google;
};

export default useGoogleMaps;
