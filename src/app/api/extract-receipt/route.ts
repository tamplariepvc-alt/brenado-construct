import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Lipseste OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const body = await req.json();
    const imageUrl = body?.imageUrl as string | undefined;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Lipseste imageUrl." },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Extragi date dintr-un bon fiscal din Romania. " +
                "Raspunde strict conform schemei JSON. " +
                "Nu inventa valori. Daca un camp nu este clar, foloseste sir gol pentru text si 0 pentru numere. " +
                "Normalizeaza data in format YYYY-MM-DD daca este vizibila clar. " +
                "Extrage fiecare produs/material pe linie separata. " +
                "Valorile numerice trebuie sa fie numere, nu text.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Analizeaza acest bon fiscal si extrage: data, furnizor, numar document, total fara TVA, total cu TVA, observatii si lista de articole.",
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "auto",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              document_type: { type: "string" },
              document_date: { type: "string" },
              supplier: { type: "string" },
              document_number: { type: "string" },
              total_without_vat: { type: "number" },
              total_with_vat: { type: "number" },
              notes: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    item_name: { type: "string" },
                    quantity: { type: "number" },
                    unit_price: { type: "number" },
                    line_total: { type: "number" },
                  },
                  required: [
                    "item_name",
                    "quantity",
                    "unit_price",
                    "line_total",
                  ],
                },
              },
            },
            required: [
              "document_type",
              "document_date",
              "supplier",
              "document_number",
              "total_without_vat",
              "total_with_vat",
              "notes",
              "items",
            ],
          },
        },
      },
    });

    const outputText = response.output_text;
    const parsed = JSON.parse(outputText);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("extract-receipt error:", error);
    return NextResponse.json(
      { error: "A aparut o eroare la extragerea datelor din bon." },
      { status: 500 }
    );
  }
}