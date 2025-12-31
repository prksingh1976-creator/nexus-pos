import { GoogleGenAI, Type } from "@google/genai";
import { Product, Customer, Transaction } from "../types";

// Note: In a production app, the API Key should not be exposed in frontend code directly if possible,
// or should be restricted. For this demo, we assume process.env.API_KEY is available.

const getAiClient = () => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateBusinessInsight = async (
  inventory: Product[],
  transactions: Transaction[],
  customers: Customer[]
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Gemini API Key not configured.";

  // Summarize data to avoid token limits and focus on key metrics
  const inventorySummary = inventory.map(p => `${p.name} ${p.variant ? `(${p.variant})` : ''} [${p.seller}] (${p.category}) - Stock: ${p.stock}`).join('\n');
  const recentSales = transactions.slice(0, 20).map(t => `Sale: ${t.total}`).join('\n');
  const creditSummary = customers.filter(c => c.balance > 0).map(c => `${c.name}: owes ${c.balance}`).join('\n');

  const prompt = `
    Act as a senior retail business analyst for a shop in India. Analyze the following shop data and provide 3 short, actionable bullet points for the shop owner to improve profit or efficiency. Focus on restock needs, best-performing brands/sellers, credit risks, or inventory efficiency.

    Inventory Snapshot:
    ${inventorySummary}

    Recent Transactions (Last 20):
    ${recentSales}

    Outstanding Customer Credit:
    ${creditSummary}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI Service unavailable. Please check your API key.";
  }
};

export const suggestRestock = async (inventory: Product[]): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "Gemini API Key not configured.";

    const lowStockItems = inventory.filter(i => i.stock < i.minStockLevel);
    
    if (lowStockItems.length === 0) return "Stock levels look healthy! No immediate restock recommendations.";

    const prompt = `
      The following items are low in stock:
      ${lowStockItems.map(i => `- ${i.name} ${i.variant ? `(${i.variant})` : ''} by ${i.seller} [${i.category}] (Current: ${i.stock}, Min: ${i.minStockLevel})`).join('\n')}

      Suggest a priority list for restocking and a brief reason why based on general retail logic (e.g., brand popularity, urgency).
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response.text || "No specific advice generated.";
    } catch (error) {
       console.error("Gemini Error:", error);
       return "Error generating restock advice.";
    }
};

export const parseInvoiceImage = async (base64Image: string): Promise<Partial<Product>[]> => {
    const ai = getAiClient();
    if (!ai) return [];

    const prompt = `
        Analyze the image of this invoice/bill (likely from an Indian store). Extract the list of products.
        For each product, identify:
        - Product Name (without the size)
        - Variant / Size (e.g., 500ml, 1kg, Large). Extract strictly if available.
        - Seller / Brand / Company Name (e.g. Nestle, Samsung). If unknown, guess based on product or use 'General'.
        - Quantity (as Stock)
        - Price (or Cost, if listed, prioritize Cost). Note: Prices are in INR (₹).
        - Category (Guess a general category like Groceries, Electronics, Clothing, etc. based on the name)

        Return the data as a JSON array of objects with keys: name, variant, seller, stock, cost, category.
        If cost is found, set price to cost * 1.2. If only price is found, set cost to price * 0.8.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            variant: { type: Type.STRING },
                            seller: { type: Type.STRING },
                            stock: { type: Type.NUMBER },
                            cost: { type: Type.NUMBER },
                            price: { type: Type.NUMBER },
                            category: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const jsonString = response.text;
        if (!jsonString) return [];
        return JSON.parse(jsonString);

    } catch (error) {
        console.error("Gemini Vision Error:", error);
        return [];
    }
};

export const askAppHelp = async (userQuestion: string): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "AI Key missing.";

    const context = `
        You are the friendly support assistant for the 'Nexus POS' web application.
        
        Here is how the app works:
        
        1. **Inventory**: 
           - Users add products manually or by scanning invoice images (AI extracts data). 
           - Products are grouped by Name (e.g., "Milk" shows 500ml and 1L variants together).
           - "Smart Restock" suggests what to buy.
        
        2. **POS (Point of Sale)**:
           - Users tap items to add to cart.
           - Support for Cash, Store Credit (Customer Account), and UPI (QR Code generation).
           - Custom charges (Tax, fees) can be toggled.
        
        3. **Customers**:
           - Users track customer balances (Credit/Udhaar).
           - You can "Settle Debt" (Customer pays you) or "Lend/Add Credit" (Customer buys on credit).
        
        4. **Settings**:
           - Users can set their Shop Name, UPI ID (for QR codes), and Theme (Dark/Light).
           - Tax/Charge rules (e.g., GST 5%) can be created here.

        Rules:
        - Answer the user's question simply and directly based on the features above.
        - If the feature doesn't exist (e.g., Barcode scanner hardware integration), say it's not supported yet.
        - Keep answers short (under 50 words) unless detailed steps are needed.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `${context}\n\nUser Question: ${userQuestion}`,
        });
        return response.text || "I couldn't understand that, sorry.";
    } catch (error) {
        return "Support AI is currently offline.";
    }
};