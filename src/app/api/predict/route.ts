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
    "babi", "pig", "pork", "ham", "bacon", "lard", "sow", "swine",
    "hog", "boar", "suckling pig", "pork chop", "pork loin",
    "chorizo", "salami", "prosciutto", "mortadella",
    "capicola", "pancetta", "guanciale", "gelatin", "gelatine", "rennet",
    "carmine", "E441", "E120", "enzymes", "lipase", "trypsin", "rennin",
    "pepsin", "alkohol", "alcohol", "beer", "wine", "whiskey", "vodka",
    "gin", "rum", "brandy", "tequila", "cider", "sake", "mirin",
    "darah", "blood", "black pudding", "blood sausage"
];

const fuzzySet = FuzzySet(nonHalalIngredients);

async function translateToEnglish(source: string, targetLanguage = 'en'): Promise<string> {
    const { text } = await translate(source, { to: targetLanguage });
    return text;
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


        return NextResponse.json({
            ocrText,
            // translatedText,
            cleanedText,
            geminiText,
            detectedNonHalal: detected,
            imageUrl: fileUrl,
        });
    } catch (error) {
        return NextResponse.json({ error: `An error occurred: ${(error as Error).message}` }, { status: 500 });
    }
}
