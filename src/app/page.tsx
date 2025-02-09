'use client'
import React, {useState} from "react";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Progress} from "@/components/ui/progress";
import {UploadCloud} from "lucide-react";

export default function Home() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setResult(null); // Reset result sebelum upload baru

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/predict", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Server error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error("Upload failed:", error);
            setResult({ error: "Failed to process the file. Please try again later." });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100">
            <img src="/usu.png" alt="Logo" className="w-24 h-24 mb-4" />
            <h1 className="text-3xl font-bold text-black mb-6 text-center">
                Halal Food Detection Using OCR & Fuzzy String Matching
            </h1>
            <Card className="w-full max-w-4xl p-8 bg-white shadow-lg rounded-2xl">
                <CardContent className="space-y-6 text-center">
                    <Label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 p-8">
                        <UploadCloud className="w-14 h-14 text-gray-500" />
                        <span className="mt-2 text-sm text-gray-500">Click to upload an image</span>
                        <Input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                    </Label>
                    {file && <p className="text-sm text-gray-600">Selected: {file.name}</p>}
                    <Button onClick={handleUpload} disabled={!file || loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? "Processing..." : "Upload & Analyze"}
                    </Button>
                    {loading && <Progress className="w-full" value={50} />}
                    {result?.error && (
                        <div className="mt-4 p-4 bg-red-100 text-red-600 rounded-md">
                            {result.error}
                        </div>
                    )}

                    {result && (
                        <div className="mt-8 text-left bg-gray-50 p-6 rounded-lg shadow-md">
                            <div className={`mb-4 text-center text-lg font-bold rounded p-3 ${
                                result.detectedNonHalal.length > 0 ? 'bg-red-300' : 'bg-green-300'
                            }`}>
                                {result.detectedNonHalal.length > 0 ? (
                                    <span className="text-red-600">HARAM</span>
                                ) : (
                                    <span className="text-green-600">HALAL</span>
                                )}
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Analysis Results</h2>
                            <div className="space-y-3">
                                <p className="text-sm text-gray-700"><strong>OCR:</strong> {result.ocrText}</p>
                                <p className="text-sm text-gray-700"><strong>Cleaned Text:</strong> {result.geminiText}</p>
                                <p className="text-sm text-gray-700 font-semibold">Detected Ingredients:</p>
                                <ul className="list-disc list-inside text-sm text-red-600 bg-white p-4 rounded-md shadow-sm">
                                    {result.detectedNonHalal.length > 0 ? (
                                        result.detectedNonHalal.map((item: any, index: number) => (
                                            <li key={index}>{item.word} (Matched: {item.match}, Score: {item.score.toFixed(2)})</li>
                                        ))
                                    ) : (
                                        <li className="text-green-600">No non-halal ingredients detected</li>
                                    )}
                                </ul>
                                <div className="flex justify-center mt-4">
                                    <img src={result.imageUrl} alt="Uploaded" className="w-full max-w-md rounded-lg shadow-md" />
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}