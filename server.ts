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

async function startServer() {
  const app = express();
  const PORT = 3000;

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
3. Classify into exactly one of these expense categories: 'Food & Dining', 'Travel', 'Lodging', 'Office Supplies', 'Electronics', 'Utilities', 'Entertainment', or 'Other'.
4. Extract the date in YYYY-MM-DD standard format. If the year is not printed but the month and day is shown, assume the current year is 2026.
5. Extract standard three-letter ISO currency code (USD, EUR, GBP, CAD, AUD, etc.).
6. Output raw OCR lines or handwritten details in the 'rawNotes' field.
7. Extract all individual line items (products, services, dishes, tickets, items bought) with their descriptions/names, quantity (default to 1 if not explicitly found), and price (individual line item price) in the 'items' array.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          imagePart,
          { text: "Strictly parse the merchant receipt and populate the JSON response matching the required schema properties." },
        ],
        config: {
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
                  },
                  required: ["name", "price"],
                },
              },
            },
            required: ["vendor", "amount", "tax", "category", "date", "currency", "rawNotes", "items"],
          },
        },
      });

      const textOutput = response.text;
      if (!textOutput) {
        throw new Error("No response string returned from Gemini API.");
      }

      // Safe JSON parse
      const extractedContent = JSON.parse(textOutput.trim());
      return res.json(extractedContent);
    } catch (err: any) {
      console.error("AI Extractor failed:", err);
      return res.status(500).json({ error: err?.message || "Internal server error occurred while analyzing receipt." });
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
