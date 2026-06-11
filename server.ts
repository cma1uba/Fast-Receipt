/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = String(error?.message || error?.statusText || error);
    const status = error?.status || error?.statusCode || (error?.error && error?.error?.code);
    
    // Check for user location not supported error immediately to avoid useless retries
    if (
      errorStr.toLowerCase().includes("location") && 
      (errorStr.toLowerCase().includes("supported") || errorStr.toLowerCase().includes("restrict"))
    ) {
      throw new Error("Your user location or deployment region is not supported by the Gemini API key. Ensure your Google account and keys are from a supported country, or try connecting through a supported server location.");
    }

    const isTransient =
      errorStr.includes("503") ||
      errorStr.includes("UNAVAILABLE") ||
      errorStr.includes("high demand") ||
      errorStr.includes("429") ||
      errorStr.includes("RESOURCE_EXHAUSTED") ||
      errorStr.includes("ResourceExhausted") ||
      status === 503 ||
      status === 429;

    if (retries > 0 && isTransient) {
      console.warn(`Transient Gemini API error encountered (${errorStr}, Status: ${status}). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2 + Math.random() * 200);
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Increase payload limit for sending base64 photos
  app.use(express.json({ limit: "15mb" }));

  // Extraction endpoint (Stateless OCR & parsing)
  app.post("/api/extract", async (req, res) => {
    try {
      const { base64Image, mimeType } = req.body;
      if (!base64Image || !mimeType) {
        return res.status(400).json({ error: "Missing base64Image or mimeType in request body." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.status(500).json({
          error: "Gemini API key is not configured in environment secrets. Please configure GEMINI_API_KEY in the Settings > Secrets menu."
        });
      }

      // Initialize the official Google Gen AI Client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      };

      const systemPrompt = `You are an expert OCR and financial data extractor specialized in extracting structured receipt metadata.
Your task is to review the image and extract the receipt fields under strict rules:
1. Complete deep OCR. Locate text that is handwritten, scribbled, faded, crumpled, or blurry.
2. If a customer scribbled notes (e.g., tipping cash, write-ins, or explanations), incorporate these handwritten elements into the extraction. High precision total/notes over regular printed text in case of edits.
3. Classify the main receipt into exactly one of these expense categories: 'Food & Dining', 'Travel', 'Lodging', 'Office Supplies', 'Electronics', 'Utilities', 'Entertainment', or 'Other'.
4. Extract the date in YYYY-MM-DD standard format. If the year is not printed but the month and day is shown, assume the current year is 2026.
5. Extract standard three-letter ISO currency code (USD, EUR, GBP, CAD, AUD, etc.).
6. Output raw OCR lines or handwritten details in the 'rawNotes' field.
7. Extract all individual line items (products, services, dishes, tickets, items bought) with their descriptions/names, quantity (default to 1 if not explicitly found), price (individual line item price), and detect their item-specific category (exactly one of: 'Food & Dining', 'Travel', 'Lodging', 'Office Supplies', 'Electronics', 'Utilities', 'Entertainment', or 'Other') in the 'items' array.`;

      const generateConfig = {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendor: { type: Type.STRING, description: "The name of the vendor/merchant, capitalized and cleansed." },
            amount: { type: Type.NUMBER, description: "The total amount of the transaction, parsed as a decimal/number." },
            tax: { type: Type.NUMBER, description: "The sales tax amount extracted, or 0 if missing." },
            category: {
              type: Type.STRING,
              description: "Must be exactly one of: Food & Dining, Travel, Lodging, Office Supplies, Electronics, Utilities, Entertainment, or Other",
            },
            date: { type: Type.STRING, description: "Transaction date in format YYYY-MM-DD." },
            currency: { type: Type.STRING, description: "ISO 3-letter currency code (e.g. USD, EUR, GBP, CAD)." },
            rawNotes: { type: Type.STRING, description: "Handwritten notes, blurry item details, annotations, or custom margin corrections transcribed perfectly." },
            items: {
              type: Type.ARRAY,
              description: "List of itemized products or services purchased.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Description or product name." },
                  quantity: { type: Type.NUMBER, description: "Optional quantity, default to 1 if unspecified." },
                  price: { type: Type.NUMBER, description: "Item total cost or unit cost." },
                  category: {
                    type: Type.STRING,
                    description: "Must be exactly one of: Food & Dining, Travel, Lodging, Office Supplies, Electronics, Utilities, Entertainment, or Other",
                  },
                },
                required: ["name", "price", "category"],
              },
            },
          },
          required: ["vendor", "amount", "tax", "category", "date", "currency", "rawNotes", "items"],
        },
      };

      let response;
      try {
        response = await retryWithBackoff(() =>
          ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
              imagePart,
              { text: "Strictly parse the merchant receipt and populate the JSON response matching the required schema properties." },
            ],
            config: generateConfig,
          })
        );
      } catch (primaryErr: any) {
        console.warn("Primary model gemini-3.5-flash failed or experienced high demand. Trying fallback model gemini-3.1-flash-lite...", primaryErr);
        // Fallback with retry and backoff on gemini-3.1-flash-lite
        try {
          response = await retryWithBackoff(() =>
            ai.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: [
                imagePart,
                { text: "Strictly parse the merchant receipt and populate the JSON response matching the required schema properties." },
              ],
              config: generateConfig,
            }),
            2 // 2 retries for fallback
          );
        } catch (fallbackErr: any) {
          console.error("All models and retries exhausted.", fallbackErr);
          throw new Error("Receipt parsing helper is temporarily experiencing high API demand. Please try again in a few seconds.");
        }
      }

      const textOutput = response.text;
      if (!textOutput) {
        throw new Error("No response string returned from Gemini API.");
      }

      // Safe JSON parse
      const extractedContent = JSON.parse(textOutput.trim());
      return res.json(extractedContent);
    } catch (err: any) {
      console.error("AI Extractor failed:", err);
      let errMsg = err?.message || "Internal server error occurred while analyzing receipt.";
      if (
        errMsg.toLowerCase().includes("location") && 
        (errMsg.toLowerCase().includes("supported") || errMsg.toLowerCase().includes("restrict"))
      ) {
        errMsg = "The Gemini API returned a location restriction error. Your current IP location, Google AI Studio key region, or server hosting region is not supported by Google Gemini. Please ensure you are using a Gemini API key created with a Google account profile from a supported region, or route your connection through a supported server location/VPN.";
      }
      return res.status(500).json({ error: errMsg });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started in ${process.env.NODE_ENV || "development"} mode on http://0.0.0.0:${PORT}`);
  });
}

startServer();
