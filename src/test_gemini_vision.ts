import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.FIREBASE_API_KEY || "";
console.log("Clave API para Gemini:", apiKey ? "Presente" : "Ausente");

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 1x1 transparent red pixel base64 for testing API connectivity
    const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    const result = await model.generateContent([
      "Analiza esta imagen. ¿Contiene elementos generados por IA o es una prueba? Responde brevemente.",
      {
        inlineData: {
          mimeType: "image/png",
          data: sampleBase64,
        },
      },
    ]);

    console.log("Respuesta Gemini Vision:", result.response.text());
  } catch (err: any) {
    console.error("Error al probar Gemini Vision:", err.message);
  }
}

testGemini();
