import {Storage} from '@google-cloud/storage';
import vision from '@google-cloud/vision';
import {NextRequest, NextResponse} from 'next/server';
import {translate} from '@vitalets/google-translate-api';
import FuzzySet from 'fuzzyset.js';
import {GoogleGenerativeAI} from "@google/generative-ai";

const storage = new Storage({
    credentials: {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL ?? '',
        private_key: process.env.GCP_PRIVATE_KEY ?? '',
    },
    projectId: process.env.GCP_PROJECT_ID ?? ''
});
const bucketName = 'fitri-user-image';
const visionClient = new vision.ImageAnnotatorClient({
    credentials: {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL ?? '',
        private_key: process.env.GCP_PRIVATE_KEY ?? '',
    },
    projectId: process.env.GCP_PROJECT_ID ?? ''
});

const apiKey = process.env.GEMINI_API ?? '';
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const nonHalalIngredients: string[] = [
    "pig", "pork", "ham", "bacon", "lard", "sow", "swine",
    "hog", "boar", "suckling pig", "pork chop", "pork loin",
    "chorizo", "salami", "prosciutto", "mortadella",
    "capicola", "pancetta", "guanciale", "gelatin", "gelatine", "rennet",
    "carmine", "E441", "E120", "enzymes", "lipase", "trypsin", "rennin",
    "pepsin", "alkohol", "alcohol", "beer", "wine", "whiskey", "vodka",
    "gin", "rum", "brandy", "tequila", "cider", "sake", "mirin",
    "darah", "blood", "black pudding", "blood sausage", "dwaejigogi", "babi", "donji", "yugsu","sul","porkfat", "ethanol", "red pepper powder", "vanilla extract", "vanilin extract", "glycerin", "glycerol", "dongmulseong" ,
    "yuji", "tallow", "marshmellow", "broth", "glyceride", "hogleather", "jelly", "sow milk", "adenosine 5' monophospate", "carmine color", "cochineal color", "confectionary color",
    "cytidene 5'- monophosphate", "disodium uridine 5'- monophosphate", "erythritol", "fermented cider", "hard cider", "red pepper", "inosito 5'- monophosphate", "l-cysteine", "nucleotides", "rainbow sprinkles",
    "sherry wine", "sovent extracted modified lecithin", "soya sauce", "surimi", "vanilla bean specks", "wine vinegar", "yeast extract from brewer yeast", "edible bone phosphate", "acid casein", "beer batters",
    "beer flavor", "brewer's yeast extract", "confectionary glaze", "rosemary extract", "soya sauce (naturally brewed)"
];

const fuzzySet = FuzzySet(nonHalalIngredients);

// async function translateToEnglish(source: string, targetLanguage = 'en'): Promise<string> {
//     const { text } = await translate(source, { to: targetLanguage });
//     return text;
// }

async function translateToEnglish(source: string, targetLanguage = 'en'): Promise<string> {
    const result = await translate(source, { to: targetLanguage });

    // Ambil bahasa sumber dari properti `raw.src`
    const detectedLanguage = result.raw?.src;

    if (detectedLanguage !== 'ko') {
        const error = new Error('Translation is only allowed for Korean text.');
        (error as any).statusCode = 400; // Tandai error dengan status 400
        throw error;
    }

    return result.text;
}


async function runCleaner(input: string) {
    const parts = [
        {text: "Please remove unnecessary word in food commposition, and extract only food composition."},
        {text: "input: Food Type Miso contents G raw material name and content purified water, soybean, sun salt, wheat, alcohol, alcohol, long -sized soybean, wheat containing expiration date, mold, and day of packaging, leaded polyethylene inner, container polypropylene, lactation 제조원 및 판매원 샘표식품 주식회사 본사 서울시 중구 충무로 공장 충청북도 영동군 용산면 용심로 반품 및 교환처 본사 및 구입처 본 제품은 소비자 기본법의 일반적 소비자 분쟁해결 기준에 의거, 교환 등 보상을 받을 수 있습니다 사용 및 보관시 주의사항 Please keep the direct sunlight at room temperature and keep it refrigerated after opening. Poe is burdened SGS by Supplier Plastic PP container, lid, label PP lead paper"},
        {text: "output: purified water, soybean, sun salt, wheat, alcohol, alcohol, long -sized soybean, wheat"},
        {text: "input: Contents G CJ Premial Snow White Ribs Seasoned Ribs Seasoned Ribs Seasoned Yeonmu -eup Jukbon Gil Foods Report Non -Eup Status Report Number Consumer Number Consumer Low room temperature storage, and after opening, refrigerated in the refrigerator, container glass Amino acid surface -to -soybeans, brewing, brewing, brewed, brewed, brewed, soybeans, refined stations, sugar, other fructose, bafure pear domestic, vitamin C, purified water, onion pure Chinese, minced garlic apple pure apple Paemit, Caramel Soldier III, Pepper Pepper, Pepper Primulates, Mountain Controls, Zantan Sword, Citrus Extract"},
        {text: "output: glass Amino acid surface -to -soybeans, brewing, brewed, soybeans, refined stations, sugar, other fructose, bafure pear domestic, vitamin C, purified water, onion pure Chinese, minced garlic apple pure apple Paemit, Caramel Soldier III, Pepper, Pepper Primulates, Mountain Controls, Zantan Sword, Citrus Extract"},
        {text: "input: PEACH PEACH BON MAT HAICHED with Peach Sacs Juice RP Peach Each week, Fi, Chungnam -gu, Cheonan -si, Chungnam -gu, Cheon -gu, Gyeongbuk COE Consumption Economic Dogs Dogs Economic Water, Dangrup, Grape Granal Chinese, Grape Located Italy Asan, Mixed Contents Grape Grape Juice Restorous Standards, Citric acid, Synthetic Fragrance Vine If the variable Pyeongchang is damaged or the contents are altered, do not drink it. Please do not drink it after opening. Senior Products Exchange Customer Counseling Office and Each Purchasing Products can be exchanged or compensated by the FTC notice. It is manufactured in the contents that natural and the environment is beautifully charged nitrogen cleansing www tbcokr As it is KCAL standard, it may vary depending on the amount of calories required rawberry onbon This is an extract of Haital Crushed Strawberry Ju ML Spessifikasi M Kode Barang rp dlatte"},
        {text: "output: Water, Dangrup, Grape Granal Chinese, Grape Located Italy Asan, Mixed Contents Grape Grape Juice Restorous Standards, Citric acid, Synthetic Fragrance Vine"},
        {text: "input: Crispy Bada MOA Sea Spicy Badamoa CRISPY S Product name spicy flavored blue stone jaccaly 35g of content 43 of Kim Ja ban domestic jade oil 100 of the eyes of Oksu san foreign US Lazil Russia etc 32 red pepper powder Vietnamsan 10 sugar 6 fields INA 3 raw material name China taste salt 90 of refined salt domestic Lglutam And content sodium flavors 99  5 lods 005  5 005Guanylic acid inathasonate 2 sesame oil foreign India Niger Oh Pakistan etc 2 sesame seeds foreign India Nigeria Pakistan etc 2 Manufacturer and Salesman Daeyang Food Co Ltd 36 Hanam daero Hanam si Gyeonggi do 36 Sangsangok dong Item report number 2006034513128 Packaging material polyethylene inner Consumer Counseling Office 0317952982 S p ri"},
        {text: "output: Domestic jade oil 100%, red pepper powder (Vietnam) 32%, sugar 10%, flavored salt (refined salt 90%, sodium L-glutamate 99.5%, guanylic acid 0.5%), sesame oil (India, Nigeria, Pakistan) 2%, sesame seeds (India, Nigeria, Pakistan) 2%"},
        {text: "input: Container and packaging material PP Inner pavement PET tray caution Do not eat harmlessness in the human body Consumer Counseling Office 042 6280725 Homepage wwwsgkimcokr  How to store Avoid direct sunlight and moisture places to keep them in a cool and well ventilated place to feel the taste and fragrance of Kim  This product is turbulent milk buckwheat peanuts soybeans wheat mackerel crab shrimp peach tomato sulfur walnuts chicken beef pork squid It is manufactured in manufacturing facilities such as shellfish including oysters abalone mussels and pine nuts  This product is made by processing raw materials obtained from the sea Shrimp crab seaweed and shellfish can be mixed  Return and exchange This product can be exchanged or compensated by purchasing units or distributors in accordance with the Fair Trade Commissions notice of dispute resolution there is 1399 without a certificate of illegal and bad food"},
        {text: "output: milk, buckwheat, peanuts, soybeans, wheat, mackerel, crab, shrimp, peach, tomato, sulfur, walnuts, chicken, beef, pork, squid, oysters, abalone, mussels, pine nuts, seaweed"},
        {text: "input: Open Wondertok Shooting Stor Choco Stick Chocolate shooting star Product name chocolate stick shooting star Food type chocolate products Manufacturer and Salesman Sunyoung Food Co Ltd Expiration date  154g of contents until separate notation date Confectionery wheat US Australian acid sugar shorting palm oil Malaysia Corn starch foreign Russia Hungary Serbia Hydrogen ammonium sodium hydrogen carbonate semi chocolate I 2944 plant maintenance I Raw material name palm nuclear lighting oil Malaysia sugar oil domestic cocoe male 872 Mt Mulis syrup lactose associate chocolate II 15 sugar vegetable maintenance farm nuclearization Malaysia Yucheong domestic 968 of coco aggregates Singapore Plantic maintenance It contains wheat milk soybeans"},
        {text: "output: wheat, sugar, palm oil, corn starch, ammonium, sodium hydrogen carbonate, semi chocolate, syrup, lactose, chocolate, vegetable oil, coco aggregates, milk, soybeans"},
        {text: "input: Product name Peanut Food type chocolate products Manufacturer and Salesman Sunyoung Food Co Ltd Until the expiration date Content Raw material name Certain ingredients 54g Confectionery Flour US Australia Australians sugar shorting palm oil Malaysia Corn starch foreign Russia Hungary Serbia Hydrogen Ammonium sodium hydrogen carbonate associate chocolate I Malaysia sugar cocoal Latvia Coco Agun Singapore Maintenance II fried peanuts 100peanuts Argentina associate chocolate Sugar processed maintenance palm nuclear coordinate malaysia Coco Agal Singapore maintenance of processing I Contains wheat milk soybeans peanuts 40cocoe powder 194fried peanuts  Courage packaging Material Packaging Polypropylene inner Item report number 201304490131 This product is manufactured in the same manufacturing facilities as a product using walnuts This product may be replaced or refunded for justifiable consumer damage in accordance with the Consumer Dispute Resolution Criteria under the Basic Consumer Basic Law Please avoid direct sunlight and moisture places  French food reporting 1399 without country number Customer Satisfaction Room 0416227723  Return and exchange location Headquarters and purchase place"},
        {text: "output: Flour, sugar, shortening palm oil, corn starch, hydrogen ammonium sodium hydrogen carbonate, chocolate, sugar, cocoa, fried peanuts, wheat, milk, soybeans, cocoa powder."},
        {text: "input: Ch Stoire She initi  Sandwichs fundamental 2 BELT sandwich I know the taste New Scramble  Sausage SAUSAGE Sandwich Together POUBL S Bacon Fast Stop D 28 its good  Fundamentals Sandwich 195g 377 kcal W 3300 PLA  The usage is made of disassembled biodegradable raw material PLA After removing the container sticker please discard it with general garbage Fall Tuna Even today no worry 00015g lettuce 1026 897egg 74 egg heating products 769battery bacon 769of tomatoes One in the morning Beef red pepper paste"},
        {text: "output: Tuna, lettuce, egg, bacon, tomatoes, beef, red pepper paste"},
        {text: "input: LOTTE Ice Suwonhani Image photo Seed hotteok taste 170 3 10 10 29 6 Frozen Products Ice Milk 6Opposition 90ml 170 KCAL KCAL SMG 338 238 30 Total content per 90ml 13 088 4 3 19g 10mg 2g 028 198 Milk peanuts soybeans eggs contain 12glutinous rice powder 2of seed hot rice cake dogs 40sunflower seeds calorium carbohydrate sugars  Mill peach tomato walnuts pork can be mixed and denied and bad food reporting is 1399 httpwwwtoteconfcokr Me Recipient fee burden 0800246060 1 daily nutritional standard  is 200kcal standard so it may vary depending on the required calories of individuals Distribution Salesman Lotte Confectionery Co Ltd 25Manufacturer Hongyoung Food Co Ltd Hongyoung Food Co Ltd Storage Single item and Exchange Place Purchasing Shop and Headquarters  Damage Compensation according to the Basic Consumer Law  Manufacturing date Full mark Yeon Mon Sun  Cap material inner Polyethylene  container pin material polystyrene Mulis syrup glutinous rice domestic acid sugar non jet jeidang black party oligo free products processed butter Germany Netherlands mixed milk powder foreign Dutch Canada Germany etc Sunflower seeds sunflower seeds US peanut coating sectors peanuts stir fried stir fried black sesame black sesame Chinese Locost bean gum Tamarin de Gum Karagiannan emulsifier 1 cinnamon powder emulsifier refined salt Anato pigs  Lotte Confectionery Open  Its already frozen so do not freeze again after thawing Other"},
        {text: "output: Milk, peanuts, soybeans, eggs, glutinous rice powder, seed hot rice cake, sunflower seeds, carbohydrate, sugars, peach, tomato, walnuts, pork, syrup, acid sugar, black sesame, locust bean gum, tamarind gum, carrageenan, emulsifier, cinnamon powder, refined salt, anatto."},
        {text: "input: "+ input},
        {text: "output: "},
    ];

    const result = await model.generateContent({
        contents: [{ role: "user", parts }],
        generationConfig,
    });

    return result.response.text()
}
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Konversi file ke Buffer untuk upload langsung ke Google Cloud Storage
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = `${Date.now()}-${file.name}`;

        // Upload file ke Google Cloud Storage dari buffer
        const fileUpload = storage.bucket(bucketName).file(fileName);
        await fileUpload.save(buffer, { contentType: file.type });

        // URL GCS untuk akses gambar
        const fileUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

        // OCR menggunakan Google Vision API
        const [result] = await visionClient.textDetection(fileUrl);
        const ocrText = result.textAnnotations?.[0]?.description || '';

        // Terjemahkan teks OCR ke bahasa Inggris
        const translatedText = await translateToEnglish(ocrText);

        const cleanedText = translatedText
            .replace(/\s+/g, ' ')  // Mengganti multiple whitespace (termasuk \n) dengan satu spasi
            .replace(/[^\w\s]/g, '') // Menghapus karakter yang bukan huruf/angka/spasi
            .trim(); // Menghapus spasi di awal/akhir

        const geminiText = await runCleaner(cleanedText)

        // Deteksi bahan non-halal
        const detected: { word: string; match: string; score: number }[] = [];
        const words = geminiText.split(/\s+/);
        words.forEach(word => {
            if (word.length < 3) return;

            const match = fuzzySet.get(word);

            if (match && match.length > 0) {
                const [score, matchedWord] = match[0];
                console.log(`Matching "${word}" → Best match: "${matchedWord}" (Score: ${score})`);

                if (score >= 0.80) {
                    console.log(`✅ DETECTED: "${word}" -> "${matchedWord}" (Score: ${score})`);
                    detected.push({ word, match: matchedWord, score });
                } else {
                    console.log(`❌ NOT DETECTED: Score too low or invalid`);
                }
            } else {
                console.log(`❌ NO MATCH FOUND for "${word}"`);
            }
        });

        const joinedWords = words.join(' '); // Menggabungkan kata-kata menjadi satu string
        const phrases = joinedWords.split(/,\s*/); // Split kata-kata menjadi array berdasarkan koma

        phrases.forEach(phrase => {
            const match = fuzzySet.get(phrase);

            if (match && match.length > 0) {
                const [score, matchedPhrase] = match[0];
                console.log(`Matching "${phrase}" → Best match: "${matchedPhrase}" (Score: ${score})`);

                if (score >= 0.80) {
                    console.log(`✅ DETECTED: "${phrase}" -> "${matchedPhrase}" (Score: ${score})`);
                    detected.push({ word: phrase, match: matchedPhrase, score });
                } else {
                    console.log(`❌ NOT DETECTED: Score too low or invalid`);
                }
            } else {
                console.log(`❌ NO MATCH FOUND for "${phrase}"`);
            }
        });


        return NextResponse.json({
            ocrText,
            // translatedText,
            cleanedText,
            geminiText,
            detectedNonHalal: detected,
            imageUrl: fileUrl,
        });
    } catch (error) {
        if ((error as any).statusCode === 400) {
            return NextResponse.json({ error: (error as Error).message }, { status: 400 });
        }
        return NextResponse.json({ error: `An error occurred: ${(error as Error).message}` }, { status: 500 });
    }
}
