import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useGoogleMaps from "../hooks/useGoogleMaps";

const LocationInput = ({ setOrigin, setDestination }) => {
  const google = useGoogleMaps();
  const originRef = useRef(null);
  const destinationRef = useRef(null);
  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);
  const [hasOriginValue, setHasOriginValue] = useState(false);
  const [hasDestinationValue, setHasDestinationValue] = useState(false);

  useEffect(() => {
    if (
      google &&
      google.places &&
      originRef.current &&
      destinationRef.current
    ) {
      const originAutocomplete = new google.places.PlaceAutocompleteElement();
      originAutocompleteRef.current = originAutocomplete;
      originRef.current.appendChild(originAutocomplete);

      const destinationAutocomplete =
        new google.places.PlaceAutocompleteElement();
      destinationAutocompleteRef.current = destinationAutocomplete;
      destinationRef.current.appendChild(destinationAutocomplete);

      originAutocomplete.addEventListener("gmp-select", async (e) => {
        const place = e.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });
        setOrigin({
          name: place.displayName,
          address: place.formattedAddress,
          description: place.formattedAddress,
          location: {
            lat: place.location.lat(),
            lng: place.location.lng(),
          },
        });
        setHasOriginValue(true);
        
        // Auto-focus the destination input after selecting origin
        setTimeout(() => {
          const destInput = destinationAutocomplete.querySelector('input');
          if (destInput) {
            destInput.focus();
          }
        }, 100);
      });

      destinationAutocomplete.addEventListener("gmp-select", async (e) => {
        const place = e.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });
        setDestination({
          name: place.displayName,
          address: place.formattedAddress,
          description: place.formattedAddress,
          location: {
            lat: place.location.lat(),
            lng: place.location.lng(),
          },
        });
        setHasDestinationValue(true);
      });

      // Listen for input changes to show/hide clear buttons
      const originInput = originAutocomplete.querySelector('input');
      const destInput = destinationAutocomplete.querySelector('input');
      
      if (originInput) {
        originInput.addEventListener('input', (e) => {
          const hasValue = e.target.value.length > 0;
          setHasOriginValue(hasValue);
          if (!hasValue) {
            setOrigin(null);
          }
        });
      }
      
      if (destInput) {
        destInput.addEventListener('input', (e) => {
          const hasValue = e.target.value.length > 0;
          setHasDestinationValue(hasValue);
          if (!hasValue) {
            setDestination(null);
          }
        });
      }
    }
  }, [google, setOrigin, setDestination]);

  return (
    <div className="space-y-6">
      <div>
        <label
          className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1"
          htmlFor="start-location"
        >
          Starting Location
        </label>
        <div ref={originRef} className={`w-full ${!hasOriginValue ? 'hide-clear-button' : ''}`} />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-muted-light dark:text-muted-dark mb-1"
          htmlFor="end-location"
        >
          End Location
        </label>
        <div ref={destinationRef} className={`w-full ${!hasDestinationValue ? 'hide-clear-button' : ''}`} />
      </div>
    </div>
  );
};

export default LocationInput;
