import { useEffect, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

setOptions({
  key: "AIzaSyB5FKv-bUndJIx7zRFJw8sPXzjVqhRof0M", // TODO: Replace with your API key
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
