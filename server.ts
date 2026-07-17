import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features will be disabled.");
}

// 1. Prioritize Tasks & Projects
app.post("/api/ai/prioritize", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "Service AI indisponible (clé API manquante)." });
  }

  const { items, context } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Données invalides. Un tableau d'éléments est requis." });
  }

  try {
    const prompt = `Tu es un assistant expert en productivité et méthodologies Agile.
Analyse les projets et/ou tâches ci-dessous et fournis une recommandation de priorisation stratégique en fonction de leur impact et de leur urgence.
Contexte utilisateur supplémentaire : ${context || "Aucun contexte particulier."}

Éléments à analyser :
${JSON.stringify(items, null, 2)}

Réponds strictement en format JSON contenant un tableau 'prioritizedItems'. Chaque élément doit avoir :
- id: l'ID d'origine de l'élément
- priorityScore: un score de priorité de 1 à 10 (10 étant le plus élevé/critique)
- recommendedPriority: 'low', 'medium', 'high', ou 'urgent'
- rationale: une explication concise et motivante en français (max 2 phrases) expliquant pourquoi cette priorité est recommandée.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prioritizedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  priorityScore: { type: Type.INTEGER },
                  recommendedPriority: { type: Type.STRING },
                  rationale: { type: Type.STRING }
                },
                required: ["id", "priorityScore", "recommendedPriority", "rationale"]
              }
            }
          },
          required: ["prioritizedItems"]
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("Erreur lors de la priorisation IA :", error);
    res.status(500).json({ error: "Impossible de prioriser les éléments : " + error.message });
  }
});

// 2. Breakdown Long-Term Project
app.post("/api/ai/breakdown", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "Service AI indisponible (clé API manquante)." });
  }

  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Le titre du projet est requis." });
  }

  try {
    const prompt = `Tu es un coach en gestion de projet de classe mondiale.
Aide-moi à découper mon projet à long terme suivant en étapes concrètes :
Titre : ${title}
Description : ${description || "Pas de description fournie."}

Génère :
1. Une liste de jalons à long terme (milestones) avec un délai indicatif en jours à partir d'aujourd'hui (par exemple : 7, 15, 30 jours).
2. Une liste de tâches quotidiennes initiales et immédiatement actionnables pour démarrer le projet.

Réponds strictement en format JSON contenant :
- suggestedMilestones: tableau d'objets avec 'title' et 'targetOffsetDays'
- suggestedTasks: tableau d'objets avec 'title', 'description' et 'priority' ('low', 'medium', 'high')

Explications rédigées en français.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedMilestones: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  targetOffsetDays: { type: Type.INTEGER }
                },
                required: ["title", "targetOffsetDays"]
              }
            },
            suggestedTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ["title", "description", "priority"]
              }
            }
          },
          required: ["suggestedMilestones", "suggestedTasks"]
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("Erreur lors du découpage IA :", error);
    res.status(500).json({ error: "Impossible de découper le projet : " + error.message });
  }
});

// 3. Draft WhatsApp Message
app.post("/api/ai/draft-whatsapp", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "Service AI indisponible (clé API manquante)." });
  }

  const { type, data } = req.body;
  if (!type || !data) {
    return res.status(400).json({ error: "Données manquantes pour générer le message." });
  }

  try {
    let prompt = "";
    if (type === "daily_plan") {
      prompt = `Génère un message WhatsApp motivant et structuré en français pour résumer mon planning quotidien d'aujourd'hui.
Utilise des émojis pertinents, des puces claires et des caractères gras pour la lisibilité.
Données d'aujourd'hui :
${JSON.stringify(data, null, 2)}`;
    } else if (type === "reminder") {
      prompt = `Génère un rappel WhatsApp poli mais impactant en français pour une échéance importante.
Utilise des émojis de sablier/alerte, mets en gras la date limite et propose de l'actionner.
Données du rappel :
${JSON.stringify(data, null, 2)}`;
    } else {
      prompt = `Génère une mise à jour de projet motivante en français pour mon équipe ou pour moi-même, à envoyer par WhatsApp.
Utilise des émojis et un format dynamique.
Données :
${JSON.stringify(data, null, 2)}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ draft: response.text || "" });
  } catch (error: any) {
    console.error("Erreur de rédaction WhatsApp IA :", error);
    res.status(500).json({ error: "Impossible de rédiger le message : " + error.message });
  }
});

// Serve frontend through Vite in dev or static files in production
async function setupServer() {
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
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

setupServer();
