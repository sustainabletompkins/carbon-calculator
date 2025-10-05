import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import useGoogleMaps from "../hooks/useGoogleMaps";

const LocationInput = ({ setOrigin, setDestination }) => {
  const google = useGoogleMaps();
  const originRef = useRef(null);
  const destinationRef = useRef(null);

  useEffect(() => {
    if (
      google &&
      google.places &&
      originRef.current &&
      destinationRef.current
    ) {
      const originAutocomplete = new google.places.PlaceAutocompleteElement();
      originRef.current.appendChild(originAutocomplete);

      const destinationAutocomplete =
        new google.places.PlaceAutocompleteElement();
      destinationRef.current.appendChild(destinationAutocomplete);

      originAutocomplete.addEventListener("gmp-select", async (e) => {
        const place = e.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });
        setOrigin({
          name: place.displayName,
          address: place.formattedAddress,
          location: {
            lat: place.location.lat(),
            lng: place.location.lng(),
          },
        });
      });

      destinationAutocomplete.addEventListener("gmp-select", async (e) => {
        const place = e.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });
        setDestination({
          name: place.displayName,
          address: place.formattedAddress,
          location: {
            lat: place.location.lat(),
            lng: place.location.lng(),
          },
        });
      });
    }
  }, [google, setOrigin, setDestination]);

  return (
    <div className="flex items-center space-x-4">
      <div ref={originRef} className="w-full" />
      <ArrowRight className="text-gray-400" />
      <div ref={destinationRef} className="w-full" />
    </div>
  );
};

export default LocationInput;
