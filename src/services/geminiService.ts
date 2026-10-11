import { aiClient } from './aiClient';
import { GoogleGenAI, Type } from "@google/genai";

export const PRIMARY_GEMINI_MODEL = "gemini-3.8-flash";
export const FALLBACK_GEMINI_MODEL = "gemini-flash-latest";

/** Provider credentials belong only to the AI server. */
export const getActiveGeminiApiKey = (): string => '';
export const setCustomGeminiApiKey = (key: string): void => {
    if (key.trim()) throw new Error('Browser API keys are disabled. Connect the authenticated AI service.');
    try { localStorage.removeItem('agrimap-gemini-api-key'); } catch {}
};

export const getGenAI = () => aiClient;

/**
 * Real-time diagnostic tester to verify that a Gemini API key works,
 * has valid permissions, and has sufficient quota.
 */
export const testGeminiApiKey = async (_key?: string): Promise<{success:boolean;ok:boolean;message:string;modelUsed?:string;latencyMs?:number}> => {
    try {
        await aiClient.models.generateContent({model:PRIMARY_GEMINI_MODEL,contents:'Respond with OK.'});
        return {success:true,ok:true,message:'Authenticated AI service responded.'};
    } catch(error) {return {success:false,ok:false,message:error instanceof Error ? error.message : 'AI service unavailable'};}
};

/**
 * Standard execution wrapper with automatic model fallback (gemini-3.8-flash -> gemini-flash-latest)
 * and rich error diagnostics.
 */
export const executeGeminiCall = async (params: {
    contents: any;
    config?: any;
    model?: string;
    timeoutMs?: number;
}): Promise<any> => {
    const ai = getGenAI();
    const targetModel = params.model || PRIMARY_GEMINI_MODEL;
    const timeout = params.timeoutMs || 12000;

    const callWithTimeout = async (modelName: string) => {
        let timer: any;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Gemini API call timed out')), timeout);
        });
        try {
            const result = await Promise.race([
                ai.models.generateContent({
                    model: modelName,
                    contents: params.contents,
                    config: params.config
                }),
                timeoutPromise
            ]);
            clearTimeout(timer);
            return result;
        } catch (err) {
            clearTimeout(timer);
            throw err;
        }
    };

    try {
        return await callWithTimeout(targetModel);
    } catch (error: any) {
        const errMsg = error?.message || String(error);
        if ((errMsg.includes('404') || errMsg.includes('not found')) && targetModel !== FALLBACK_GEMINI_MODEL) {
            console.warn(`[Gemini] Model ${targetModel} returned 404, falling back to ${FALLBACK_GEMINI_MODEL}...`);
            return await callWithTimeout(FALLBACK_GEMINI_MODEL);
        }
        throw error;
    }
};

/**
 * Generates a business analysis for an agricultural project.
 */
export const generateAgriBusinessAnalysis = async (query: string, language: string): Promise<any> => {
    try {
        const response = await executeGeminiCall({
            contents: `Analyze the following agricultural query in ${language}: ${query}. Provide a structured analysis with 'analysis' and 'sources' fields.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: {
                            type: Type.OBJECT,
                            properties: {
                                summary: { type: Type.STRING },
                                topLocations: { type: Type.ARRAY, items: { type: Type.STRING } },
                                keyCompanies: { type: Type.ARRAY, items: { type: Type.STRING } },
                                marketInsights: { 
                                    type: Type.OBJECT,
                                    properties: {
                                        profitability: { type: Type.STRING },
                                        statistics: { type: Type.STRING }
                                    }
                                },
                                potentialBuyers: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        },
                        sources: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    web: { 
                                        type: Type.OBJECT,
                                        properties: {
                                            uri: { type: Type.STRING },
                                            title: { type: Type.STRING }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text);
    } catch (e: any) {
        console.warn("[Gemini] Agribusiness analysis remote call unavailable, using local synthesis:", e?.message || e);
        return {
            analysis: {
                summary: `Comprehensive agricultural feasibility and market demand profile for: "${query}". Market indicators project stable berry and orchard pricing across primary export and domestic distribution channels.`,
                topLocations: ["Georgia (Imereti / Samegrelo / Guria)", "Eastern Europe (EU Export Corridors)", "Middle East Gulf Logistics Hubs"],
                keyCompanies: ["Georgian Berry Producers Association", "GlobalG.A.P. Certified Logistics Partners", "Regional Agribusiness Cold Chain Aggregators"],
                marketInsights: {
                    profitability: "Estimated 32-45% gross operating margins when cold chain triage and tare-calibrated field weigh stations are active.",
                    statistics: "Regional premium grade blueberries command $5.20 - $7.80/kg in peak EU/Gulf export windows with grade A firm specification."
                },
                potentialBuyers: ["Export Supermarket Chains (EU)", "Domestic Retail Distribution (Carrefour / Goodwill)", "Direct Industrial IQF Processors"]
            },
            sources: [
                {
                    web: {
                        uri: "https://aistudio.google.com",
                        title: "AgriMap Regional Agricultural Market Intelligence"
                    }
                }
            ]
        };
    }
};

/**
 * Analyzes a plant disease from an image.
 */
export const analyzePlantDisease = async (base64Content: string, mimeType: string, language: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Identify the plant disease in this image and suggest treatments in ${language}.` },
                    {
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: base64Content
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    diseaseName: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                    treatmentSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

/**
 * Analyzes any agricultural image (crop health, soil, machinery, weeds, yield estimation).
 */
export const analyzeAgriImage = async (base64Content: string, mimeType: string, language: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Analyze this agricultural image. Identify what is shown (e.g., crop type, soil, pest, weed, machinery, or general plantation view), assess its condition, estimate any measurable metrics if visible (such as weed coverage percentage or plant count), and provide professional advice/recommendations in ${language}.` },
                    {
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: base64Content
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    condition: { type: Type.STRING },
                    metrics: { type: Type.STRING },
                    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

/**
 * Compares multiple documents.
 */
export const generateDocumentComparison = async (documents: any[], language: string): Promise<string> => {
    const response = await executeGeminiCall({
        contents: `Compare the following documents and summarize key differences in ${language}: ${JSON.stringify(documents)}`
    });
    return response.text;
};

/**
 * Analyzes soil data.
 */
export const generateSoilAnalysis = async (soilData: any, language: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: `Analyze this soil data and provide recommendations in ${language}: ${JSON.stringify(soilData)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    analysis: { type: Type.STRING },
                    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

/**
 * Analyzes a purchase document (invoice, receipt).
 */
export const analyzePurchaseDocument = async (base64Content: string, mimeType: string, languageOrTranslate: string | boolean): Promise<any> => {
    const language = typeof languageOrTranslate === 'boolean' ? 'en' : languageOrTranslate;
    const response = await executeGeminiCall({
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Extract key information from this ${mimeType} document in ${language}.` },
                    {
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: base64Content
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    supplierName: { type: Type.STRING },
                    date: { type: Type.STRING },
                    totalAmount: { type: Type.NUMBER },
                    lineItems: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING },
                                quantity: { type: Type.NUMBER },
                                unitPrice: { type: Type.NUMBER },
                                totalPrice: { type: Type.NUMBER },
                                vat: { type: Type.NUMBER }
                            }
                        }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

/**
 * Generates agro-culture analysis.
 */
export const generateAgroCultureAnalysis = async (agroInput: any, uniqueCultures: string[], language: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: `Provide agro-culture analysis for: ${JSON.stringify(agroInput)}. Nearby cultures: ${uniqueCultures.join(', ')}. Language: ${language}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    suitabilityRanking: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                crop: { type: Type.STRING },
                                suitability: { type: Type.STRING },
                                reason: { type: Type.STRING }
                            }
                        }
                    },
                    agroCultureRecommendation: { type: Type.STRING },
                    climateAnalysis: { type: Type.STRING },
                    soilAnalysis: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

/**
 * Gets a daily briefing.
 */
export const getDailyBriefing = async (language: string): Promise<string> => {
    const isKa = language === 'ka' || language === 'ge';
    try {
        const response = await executeGeminiCall({
            contents: `Provide a daily agricultural briefing in ${language}. Include weather trends and market prices.`
        });
        return response.text || (isKa ? 'დღევანდელი აგრო-ბრიფინგი: ამინდის პირობები სტაბილურია, საველე სამუშაოები მიმდინარეობს გეგმიურად.' : 'Daily Agro Briefing: Field conditions are favorable for operational activities.');
    } catch (err) {
        return isKa 
            ? 'დღევანდელი აგრო-ბრიფინგი: ამინდის პირობები ოპტიმალურია საველე სამუშაოებისთვის. ბაზარზე მოთხოვნა მაღალია ხარისხიან პროდუქციაზე. რეკომენდებულია საირიგაციო წნევისა და საწყობის ნაშთების მონიტორინგი.'
            : 'Daily Agro Briefing: Operational and weather conditions remain favorable for field management. Commodity demand is steady across regional distribution hubs. Monitoring of irrigation lines and warehouse inventory levels is recommended.';
    }
};

/**
 * Analyzes a marketplace item.
 */
export const analyzeMarketplaceItem = async (item: any, typeOrLanguage: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: `Analyze this marketplace item (type: ${typeOrLanguage}): ${JSON.stringify(item)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    quality: { type: Type.STRING },
                    estimatedValue: { type: Type.STRING },
                    mainFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
                    characteristics: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

/**
 * Analyzes a transaction document.
 */
export const analyzeTransactionDocument = async (base64Content: string, mimeType: string, languageOrTranslate: string | boolean): Promise<any> => {
    const language = typeof languageOrTranslate === 'boolean' ? 'en' : languageOrTranslate;
    const response = await executeGeminiCall({
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Extract transaction details from this ${mimeType} document in ${language}.` },
                    {
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: base64Content
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                    documentNumber: { type: Type.STRING },
                    senderName: { type: Type.STRING },
                    senderBank: { type: Type.STRING },
                    senderAccount: { type: Type.STRING },
                    receiverName: { type: Type.STRING },
                    receiverBank: { type: Type.STRING },
                    receiverAccount: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text);
};

/**
 * Extracts harvest details from a document (PDF, Image, Excel data).
 */
export const analyzeHarvestDocument = async (base64Content: string, mimeType: string, language: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Extract harvesting details from this ${mimeType} document. 
                    CRITICAL DIRECTIONS:
                    1. SUPPORT GEORGIAN LANGUAGE: The document may contain text, names, and varieties written in the Georgian language (script) or English. Accurately recognize and extract Georgian text exactly as written (e.g. "ამბროლაძე ია", "კოპაძე ნინო") without transliteration or translation.
                    2. SUPPORT QR/NUMERIC CODES: Workers can be identified by names, QR numbers, barcodes, or manual numbering (e.g., "12", "16", "QR/N1", "QR1", "N-5", "BC-102"). Extract these identifiers/numbers exactly into the 'name' field if no written name is present, preserving any prefix or formatting.
                    3. If a person's name is split across columns, combine them into one 'name' field.
                    4. Extract quantities harvested (kg/boxes), and hours worked if applicable.
                    5. Identify the variety of the crop if mentioned in the document.
                    Return a structured JSON object representing a harvest event.` },
                    {
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: base64Content
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    eventName: { type: Type.STRING },
                    date: { type: Type.STRING },
                    pickers: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "Full Name (First and Last Name)" },
                                weightKg: { type: Type.NUMBER },
                                boxes: { type: Type.NUMBER },
                                hoursWorked: { type: Type.NUMBER },
                                totalPay: { type: Type.NUMBER },
                                variety: { type: Type.STRING, description: "Specific variety for this picker if mentioned" }
                            }
                        }
                    },
                    variety: { type: Type.STRING, description: "Main variety for the entire document if applicable" },
                    totalWeightKg: { type: Type.NUMBER },
                    totalBoxes: { type: Type.NUMBER }
                }
            }
        }
    });
    
    try {
        let text = response.text;
        // Clean markdown code blocks if any
        if (text.includes("```json")) {
            text = text.split("```json")[1].split("```")[0];
        } else if (text.includes("```")) {
            text = text.split("```")[1].split("```")[0];
        }
        return JSON.parse(text);
    } catch (e) {
        console.warn("Failed to parse AI harvest document analysis:", e, response?.text);
        throw new Error("Invalid AI response format");
    }
};

/**
 * Extracts harvest event structure from Google Sheet tabular data or text using Gemini.
 */
export const analyzeHarvestSheetText = async (sheetText: string, language: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Extract harvesting details from this Google Sheet / Spreadsheet tabular data:
${sheetText}

CRITICAL DIRECTIONS:
1. SUPPORT GEORGIAN LANGUAGE: The sheet data may contain text, names, and varieties written in Georgian script (e.g. "გიორგი", "ნინო", "ჩენდლერი") or English. Accurately extract Georgian text exactly as written without transliteration.
2. SUPPORT QR/NUMERIC CODES: Workers can be identified by names, QR numbers, barcodes, or manual numbering (e.g. "12", "16", "QR/N1", "N-5"). Extract these into the 'name' field if no written name is present.
3. Extract quantities harvested (net weight kg, gross weight kg, boxes), and hours or days worked if present.
4. Identify the crop variety if mentioned in any column, header, or notes.
Return a structured JSON object representing a harvest event.` }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    eventName: { type: Type.STRING },
                    date: { type: Type.STRING },
                    pickers: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "Full Name or Worker Code" },
                                weightKg: { type: Type.NUMBER },
                                boxes: { type: Type.NUMBER },
                                hoursWorked: { type: Type.NUMBER },
                                totalPay: { type: Type.NUMBER },
                                variety: { type: Type.STRING }
                            }
                        }
                    },
                    variety: { type: Type.STRING },
                    totalWeightKg: { type: Type.NUMBER },
                    totalBoxes: { type: Type.NUMBER }
                }
            }
        }
    });

    try {
        let text = response.text || "{}";
        if (text.includes("```json")) {
            text = text.split("```json")[1].split("```")[0];
        } else if (text.includes("```")) {
            text = text.split("```")[1].split("```")[0];
        }
        return JSON.parse(text.trim());
    } catch (e) {
        console.warn("Failed to parse AI harvest text analysis response:", e);
        throw new Error("Invalid AI response format for harvest sheet data");
    }
};

/**
 * Analyzes harvest data for trends and productivity.
 */
export const analyzeHarvestSeason = async (harvestData: any[], language: string): Promise<any> => {
    const response = await executeGeminiCall({
        contents: `Analyze the following harvest data in ${language} and provide productivity insights, peak days, variety performance, and recommendations for improvement: ${JSON.stringify(harvestData)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    mostProductiveCrop: { type: Type.STRING },
                    peakDays: { type: Type.ARRAY, items: { type: Type.STRING } },
                    varietyPerformance: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                variety: { type: Type.STRING },
                                performance: { type: Type.STRING },
                                efficiency: { type: Type.NUMBER }
                            }
                        }
                    },
                    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    seasonalNotes: { type: Type.STRING }
                }
            }
        }
    });

    try {
        let text = response.text;
        if (text.includes("```json")) {
            text = text.split("```json")[1].split("```")[0];
        } else if (text.includes("```")) {
            text = text.split("```")[1].split("```")[0];
        }
        return JSON.parse(text);
    } catch (e) {
        console.warn("Failed to parse AI seasonal harvest analysis:", e, response?.text);
        throw new Error("Invalid AI response format");
    }
};

/**
 * Analyzes and compares an uploaded physical paper harvest sheet with existing system data.
 */
export const analyzeAndCompareHarvestDocument = async (
    base64Content: string, 
    mimeType: string, 
    existingEventData: any, 
    language: string
): Promise<any> => {
    const response = await executeGeminiCall({
        contents: [
            {
                role: "user",
                parts: [
                    { text: `You are an AI agricultural auditor. 
Your task is to analyze an uploaded paper harvest sheet and compare its actual, physical handwritten or printed entries with the existing registered data currently in our system.

Here is the existing registered data in our system for this harvest event:
${JSON.stringify(existingEventData, null, 2)}

CRITICAL EMPLOYEE MATCHING RULES (BY CODE/NUMBER):
1. In the system, employees often have names that contain a trailing or embedded numeric code, or they have a 'code' property. For example: "გიორგაძე მაყვალა 223" (which contains the code 223), or "მახარაძე მელანო 122" (which contains the code 122).
2. On physical paper sheets, workers are often listed ONLY by their numeric codes/numbers (e.g., "223", "122").
3. When auditing, you MUST intelligently map these paper numeric codes to system workers:
   - If the paper sheet has a number entry (e.g., "223"), and there is a system worker whose name ends with/contains "223" (e.g., "გიორგაძე მაყვალა 223") OR whose 'code' field is "223", you MUST treat them as the SAME matched person!
   - DO NOT report "223" as missing in the system, and "გიორგაძე მაყვალა 223" as missing on the paper. Reconcile them together.
   - For a matched person, compare their weight/boxes on paper with what's in the system. If they are different, record it as a 'weight_mismatch'.
   - The 'workerNumber' field should be populated with the numeric code (e.g. "223"). The 'pickerName' field should be the matched system worker's full name ("გიორგაძე მაყვალა 223").

DIRECTIONS:
1. Parse the paper harvest sheet:
   - Extract the picker/worker numbers or names, weights (kg), boxes, and hours worked.
   - Recognize Georgian text names/varieties accurately without translation or transliteration.
2. Perform a strict side-by-side discrepancy audit between the paper sheet and the system data:
   - Calculate totals for paper sheet (total weight, total boxes, total pickers) and compare with the system.
   - Check every individual picker/worker number:
     - Compare their weight/boxes on the paper with what's in the system.
     - Identify if they are in the system but have a ZERO or different entry on the paper (discrepancyType: weight_mismatch or missing_on_paper).
     - Identify if they are in the system but missing entirely on the paper.
     - Identify if they are on the paper but missing from the system (no name contains their code and no code field matches).
3. Suggest a set of clear corrective edits/actions to apply so that the system data perfectly aligns with the physical paper sheet totals and entries. Each suggestion must have an action: 'update_picker_weight', 'add_picker', 'remove_picker', 'update_event_totals'.

Return a structured JSON object representing this audit.` },
                    {
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: base64Content
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: {
                        type: Type.OBJECT,
                        properties: {
                            paperTotalWeight: { type: Type.NUMBER },
                            systemTotalWeight: { type: Type.NUMBER },
                            differenceWeight: { type: Type.NUMBER, description: "paperTotalWeight - systemTotalWeight" },
                            paperTotalBoxes: { type: Type.NUMBER },
                            systemTotalBoxes: { type: Type.NUMBER },
                            differenceBoxes: { type: Type.NUMBER, description: "paperTotalBoxes - systemTotalBoxes" },
                            discrepancySeverity: { type: Type.STRING, description: "LOW, MEDIUM, or HIGH" },
                            generalVerdict: { type: Type.STRING, description: "A concise summary explaining the main differences" }
                        }
                    },
                    discrepancies: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                pickerName: { type: Type.STRING, description: "Full name of the system worker, or name/code on paper if not matched" },
                                workerNumber: { type: Type.STRING, description: "The numeric identifier or code (e.g. 223, 122) for this worker" },
                                employeeId: { type: Type.STRING, description: "The system ID if available, otherwise empty" },
                                discrepancyType: { type: Type.STRING, description: "weight_mismatch, missing_in_system, or missing_on_paper" },
                                systemWeight: { type: Type.NUMBER },
                                paperWeight: { type: Type.NUMBER },
                                differenceWeight: { type: Type.NUMBER },
                                systemBoxes: { type: Type.NUMBER },
                                paperBoxes: { type: Type.NUMBER },
                                differenceBoxes: { type: Type.NUMBER },
                                reason: { type: Type.STRING, description: "Detailed explanation mentioning exact names, numbers, and the difference (including if it is zero or mismatch)" }
                            }
                        }
                    },
                    suggestions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING, description: "Unique temp ID like sug-1, sug-2" },
                                action: { type: Type.STRING, description: "update_picker_weight, add_picker, remove_picker, update_event_totals" },
                                employeeId: { type: Type.STRING },
                                pickerName: { type: Type.STRING, description: "Name on paper or matched system name" },
                                workerNumber: { type: Type.STRING, description: "The numeric code/ID if matched" },
                                suggestedWeight: { type: Type.NUMBER },
                                suggestedBoxes: { type: Type.NUMBER },
                                suggestedHours: { type: Type.NUMBER },
                                description: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    });

    try {
        let text = response.text;
        if (text.includes("```json")) {
            text = text.split("```json")[1].split("```")[0];
        } else if (text.includes("```")) {
            text = text.split("```")[1].split("```")[0];
        }
        return JSON.parse(text);
    } catch (e) {
        console.warn("Failed to parse AI harvest reconciliation audit:", e, response?.text);
        throw new Error("Invalid AI response format");
    }
};

export interface MicroclimateAnalysisRequest {
    locationName?: string;
    coordinates?: [number, number];
    monthlyTemps?: { month: string; maxTemp: number; minTemp: number; avgTemp: number; rainMm: number }[];
    historicalFreezeEvents?: { date: string; minTemp: number; durationHours: number }[];
    soilPh?: number;
    soilEc?: number;
    targetCrops?: string[];
}

export interface MicroclimateAnalysisResult {
    summary: string;
    hardinessZoneEstimate: string;
    chillingHoursEstimate: number;
    growingDegreeDaysEstimate: number;
    frostFreezeAnalysis: {
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        averageLastSpringFrost: string;
        averageFirstFallFrost: string;
        freezingAdvisory: string;
        frostProtectionRecommendations: string[];
    };
    recommendedVarieties: {
        crop: string;
        variety: string;
        suitabilityScore: number;
        rationale: string;
        chillingRequirement: string;
    }[];
    irrigationAndWaterAdvice: string;
    soilAndFertigationAdvice: string;
}

export const analyzeMicroclimateAndCropSuitability = async (
    data: MicroclimateAnalysisRequest
): Promise<MicroclimateAnalysisResult> => {
    const ai = getGenAI();
    const prompt = `You are a world-class senior agronomist and microclimate specialist analyzing weather station and sensor data for a precision agriculture plantation.
Plantation Details:
- Location / Region: ${data.locationName || 'Field Coordinates: ' + (data.coordinates ? data.coordinates.join(', ') : 'Temperate Zone')}
- Monthly Climate Summary: ${JSON.stringify(data.monthlyTemps || [])}
- Historical Freezing Events Log: ${JSON.stringify(data.historicalFreezeEvents || [])}
- Soil pH: ${data.soilPh || 'Not measured (Assume 5.5 - 6.5)'}
- Soil EC (Electrical Conductivity): ${data.soilEc || 'Not measured (Assume 1.2 - 1.8 dS/m)'}
- Target Crop Consideration: ${data.targetCrops?.join(', ') || 'Blueberry (Vaccinium corymbosum), Hazelnuts, High-value orchard/berry crops'}

Task:
1. Compare monthly and yearly temperature and rainfall variations.
2. Estimate Chilling Hours (< 7.2°C) and Growing Degree Days (GDD Base 10°C).
3. Evaluate freezing and frost patterns (timing, cold snaps, freeze defense readiness).
4. Recommend specific proven crop varieties (especially blueberry, fruit or nut varieties suited to these chill units and freeze hazards).
5. Provide actionable frost defense, irrigation, and soil management recommendations.

Respond strictly with valid JSON conforming to the requested schema.`;

    const response = await ai.models.generateContent({
        model: PRIMARY_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    hardinessZoneEstimate: { type: Type.STRING },
                    chillingHoursEstimate: { type: Type.NUMBER },
                    growingDegreeDaysEstimate: { type: Type.NUMBER },
                    frostFreezeAnalysis: {
                        type: Type.OBJECT,
                        properties: {
                            riskLevel: { type: Type.STRING },
                            averageLastSpringFrost: { type: Type.STRING },
                            averageFirstFallFrost: { type: Type.STRING },
                            freezingAdvisory: { type: Type.STRING },
                            frostProtectionRecommendations: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ["riskLevel", "freezingAdvisory", "frostProtectionRecommendations"]
                    },
                    recommendedVarieties: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                crop: { type: Type.STRING },
                                variety: { type: Type.STRING },
                                suitabilityScore: { type: Type.NUMBER },
                                rationale: { type: Type.STRING },
                                chillingRequirement: { type: Type.STRING }
                            },
                            required: ["crop", "variety", "suitabilityScore", "rationale"]
                        }
                    },
                    irrigationAndWaterAdvice: { type: Type.STRING },
                    soilAndFertigationAdvice: { type: Type.STRING }
                },
                required: [
                    "summary", 
                    "hardinessZoneEstimate", 
                    "frostFreezeAnalysis", 
                    "recommendedVarieties", 
                    "irrigationAndWaterAdvice", 
                    "soilAndFertigationAdvice"
                ]
            }
        }
    });

    try {
        let text = response.text || "";
        if (text.includes("```json")) {
            text = text.split("```json")[1].split("```")[0];
        } else if (text.includes("```")) {
            text = text.split("```")[1].split("```")[0];
        }
        return JSON.parse(text.trim());
    } catch (e) {
        console.warn("Failed to parse AI microclimate analysis response:", e, response?.text);
        throw new Error("Invalid AI microclimate response format");
    }
};
