import { GoogleGenAI, Type } from "@google/genai";

export async function extractParcelInfo(base64Image: string) {
  // Use custom global injected by Vite or process.env
  // @ts-ignore
  let apiKey = typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : (process.env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY);
  
  // Fallback to Vite env if process.env fails
  if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY") {
    apiKey = (import.meta as any).env.VITE_CUSTOM_GEMINI_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  }

  // Clean up the key just in case user added quotes or spaces
  if (apiKey) {
    apiKey = apiKey.replace(/['"]/g, '').trim();
  }
  
  // Validasi kunci: Mesti ada, bukan placeholder, dan panjang yang munasabah
  if (!apiKey || apiKey === "undefined" || apiKey === "MY_GEMINI_API_KEY" || apiKey.length < 10) {
    const debugStr = apiKey ? `${apiKey.substring(0, 5)}... (${apiKey.length})` : String(apiKey);
    throw new Error(`API Key Gemini tidak sah atau belum di-set (Nilai: ${debugStr}). Sila pastikan anda telah masukkan API Key yang betul dalam menu 'Secrets' dengan nama GEMINI_API_KEY.`);
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Extract mime type and data
  const mimeType = base64Image.split(';')[0].split(':')[1] || "image/jpeg";
  const base64Data = base64Image.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `You are a courier assistant in Malaysia. Extract the recipient's name, delivery address and tracking number from this shipping label (AWB). 
              Rules:
              1. The name should be the RECIPIENT'S name (Penerima).
              2. The address should be the RECIPIENT'S address.
              3. Include the full address including Postcode, City, and State.
              4. The tracking number is usually a long alphanumeric string (e.g., JNT123, SPX123, MY123).
              5. Return ONLY a JSON object.`,
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipientName: {
              type: Type.STRING,
              description: "Recipient's full name"
            },
            address: { 
              type: Type.STRING,
              description: "Full recipient delivery address"
            },
            trackingNumber: { 
              type: Type.STRING,
              description: "Courier tracking number"
            },
          },
          required: ["recipientName", "address", "trackingNumber"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Tiada teks dikesan dalam gambar.");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    throw error;
  }
}

// Real geocoding using Google Maps Geocoding API
export async function getCoordinates(address: string) {
  // Use custom global injected by Vite
  // @ts-ignore
  let googleMapsKey = typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '';
  
  if (!googleMapsKey || googleMapsKey === "undefined") {
    googleMapsKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "";
  }

  if (googleMapsKey) {
    try {
      const query = encodeURIComponent(address);
      // components=country:MY restricts the search to Malaysia
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&components=country:MY&key=${googleMapsKey}`);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        return {
          lat: data.results[0].geometry.location.lat,
          lng: data.results[0].geometry.location.lng,
        };
      } else {
        console.warn("Google Maps Geocoding API error:", data.status, data.error_message);
      }
    } catch (error) {
      console.error("Google Maps Geocoding error:", error);
    }
  } else {
    console.warn("GOOGLE_MAPS_API_KEY tidak dijumpai. Sila masukkan dalam menu Secrets. Menggunakan OpenStreetMap sebagai ganti sementara.");
  }

  // Fallback to OpenStreetMap if Google Maps fails or key is missing
  try {
    let cleanAddress = address
      .replace(/No\./gi, '')
      .replace(/Jalan/gi, 'Jln')
      .trim();

    const query = encodeURIComponent(cleanAddress);
    
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=my&limit=1`, {
      headers: {
        'Accept-Language': 'ms,en-US;q=0.7,en;q=0.3'
      }
    });
    
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error("OSM Geocoding error:", error);
  }

  // Fallback if address not found by any API
  console.warn("Address not found by geocoder, using fallback coordinates");
  const baseLat = 3.1390;
  const baseLng = 101.6869;
  return {
    lat: baseLat + (Math.random() - 0.5) * 0.05,
    lng: baseLng + (Math.random() - 0.5) * 0.05,
  };
}
