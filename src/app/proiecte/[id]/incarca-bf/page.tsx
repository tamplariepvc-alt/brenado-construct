"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  beneficiary: string | null;
  project_location?: string | null;
};

type ReceiptItem = {
  item_name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

const createEmptyItem = (): ReceiptItem => ({
  item_name: "",
  quantity: "",
  unit_price: "",
  line_total: "",
});

export default function IncarcaBFPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [project, setProject] = useState<Project | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");

  const [receiptDate, setReceiptDate] = useState("");
  const [supplier, setSupplier] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [totalWithoutVat, setTotalWithoutVat] = useState("");
  const [totalWithVat, setTotalWithVat] = useState("");
  const [notes, setNotes] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");

  const [items, setItems] = useState<ReceiptItem[]>([createEmptyItem()]);
  
  

  useEffect(() => {
    const loadProject = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, beneficiary, project_location")
        .eq("id", projectId)
        .single();

      if (error || !data) {
        router.push("/proiecte");
        return;
      }

      setProject(data as Project);
      setLoading(false);
    };

    loadProject();
  }, [projectId, router]);
  
  const applyExtractedData = (data: any) => {
  setReceiptDate(data.document_date || "");
  setSupplier(data.supplier || "");
  setDocumentNumber(data.document_number || "");
  setTotalWithoutVat(
    data.total_without_vat ? String(data.total_without_vat) : ""
  );
  setTotalWithVat(data.total_with_vat ? String(data.total_with_vat) : "");
  setNotes(data.notes || "");

  if (Array.isArray(data.items) && data.items.length > 0) {
    setItems(
      data.items.map((item: any) => ({
        item_name: item.item_name || "",
        quantity:
          item.quantity !== undefined && item.quantity !== null
            ? String(item.quantity)
            : "",
        unit_price:
          item.unit_price !== undefined && item.unit_price !== null
            ? String(item.unit_price)
            : "",
        line_total:
          item.line_total !== undefined && item.line_total !== null
            ? String(item.line_total)
            : "",
      }))
    );
  }
};

const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0] || null;
  setImageFile(file);
  setUploadedImageUrl("");
  setExtractionError("");

  if (!file) {
    setImagePreview("");
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  setImagePreview(objectUrl);

  setUploadingImage(true);

  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `${projectId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("bonuri-fiscale")
    .upload(fileName, file, {
      upsert: false,
    });

  if (uploadError) {
    setUploadingImage(false);
    alert(`Eroare la incarcarea imaginii: ${uploadError.message}`);
    return;
  }

  const { data } = supabase.storage
    .from("bonuri-fiscale")
    .getPublicUrl(fileName);

  const publicUrl = data.publicUrl;
  setUploadedImageUrl(publicUrl);
  setUploadingImage(false);

  setIsExtracting(true);

  try {
    const res = await fetch("/api/extract-receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl: publicUrl }),
    });

    const parsed = await res.json();

    if (!res.ok) {
      setExtractionError(parsed.error || "Nu s-au putut extrage datele.");
      setIsExtracting(false);
      return;
    }

    applyExtractedData(parsed);
  } catch (error) {
    setExtractionError("A aparut o eroare la analiza AI.");
  } finally {
    setIsExtracting(false);
  }
};

  const uploadImageToStorage = async () => {
    if (!imageFile) return "";

    setUploadingImage(true);

    const fileExt = imageFile.name.split(".").pop() || "jpg";
    const fileName = `${projectId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("bonuri-fiscale")
      .upload(fileName, imageFile, {
        upsert: false,
      });

    if (uploadError) {
      setUploadingImage(false);
      alert(`Eroare la incarcarea imaginii: ${uploadError.message}`);
      return "";
    }

    const { data } = supabase.storage
      .from("bonuri-fiscale")
      .getPublicUrl(fileName);

    const publicUrl = data.publicUrl;
    setUploadedImageUrl(publicUrl);
    setUploadingImage(false);

    return publicUrl;
  };

  const updateItem = (
    index: number,
    field: keyof ReceiptItem,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const computedItemsTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + Number(item.line_total || 0);
    }, 0);
  }, [items]);

  const handleSave = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (!receiptDate) {
      alert("Completeaza data bonului.");
      return;
    }

    if (!supplier.trim()) {
      alert("Completeaza furnizorul.");
      return;
    }

    if (!documentNumber.trim()) {
      alert("Completeaza numarul documentului.");
      return;
    }

    const validItems = items.filter(
      (item) =>
        item.item_name.trim() ||
        Number(item.quantity || 0) > 0 ||
        Number(item.unit_price || 0) > 0 ||
        Number(item.line_total || 0) > 0
    );

    if (validItems.length === 0) {
      alert("Adauga cel putin un material.");
      return;
    }

    setSaving(true);

    let imageUrl = uploadedImageUrl;

    if (imageFile && !uploadedImageUrl) {
      imageUrl = await uploadImageToStorage();
      if (!imageUrl) {
        setSaving(false);
        return;
      }
    }

    const { data: receiptData, error: receiptError } = await supabase
      .from("fiscal_receipts")
      .insert({
        project_id: projectId,
        uploaded_by: user.id,
        receipt_image_url: imageUrl || null,
        receipt_date: receiptDate,
        supplier: supplier.trim(),
        document_number: documentNumber.trim(),
        total_without_vat: Number(totalWithoutVat || 0),
        total_with_vat: Number(totalWithVat || 0),
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (receiptError || !receiptData) {
      alert(`Eroare la salvarea bonului: ${receiptError?.message || ""}`);
      setSaving(false);
      return;
    }

    const itemRows = validItems.map((item) => ({
      receipt_id: receiptData.id,
      item_name: item.item_name.trim(),
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      line_total: Number(item.line_total || 0),
    }));

    const { error: itemsError } = await supabase
      .from("fiscal_receipt_items")
      .insert(itemRows);

    if (itemsError) {
      alert(`Eroare la salvarea materialelor: ${itemsError.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Bonul fiscal a fost salvat.");
    router.push("/proiecte");
  };

  if (loading) {
    return <div className="p-6">Se incarca proiectul...</div>;
  }

  if (!project) {
    return <div className="p-6">Proiectul nu a fost gasit.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Incarca BF</h1>
            <p className="text-sm text-gray-600">
              Proiect: <span className="font-semibold">{project.name}</span>
            </p>
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Inapoi
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Imagine bon fiscal</h2>

            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3"
            />

            {imagePreview && (
              <div className="mt-4">
                <img
                  src={imagePreview}
                  alt="Preview bon fiscal"
                  className="max-h-[420px] rounded-xl border border-gray-200"
                />
				
				{uploadingImage && (
  <p className="mt-3 text-sm font-medium text-[#0196ff]">
    Se incarca imaginea...
  </p>
)}

{isExtracting && (
  <p className="mt-3 text-sm font-medium text-purple-700">
    AI analizeaza bonul si completeaza automat datele...
  </p>
)}

{extractionError && (
  <p className="mt-3 text-sm font-medium text-red-600">
    {extractionError}
  </p>
)}
				
              </div>
            )}

            <p className="mt-3 text-xs text-gray-500">
              In pasul urmator legam aici extractia AI din poza.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-lg font-semibold">Date bon fiscal</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Numar document
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Furnizor
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Total fara TVA
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalWithoutVat}
                  onChange={(e) => setTotalWithoutVat(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Total cu TVA
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalWithVat}
                  onChange={(e) => setTotalWithVat(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Observatii
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Materiale bon</h2>

              <button
                type="button"
                onClick={addItem}
                className="rounded-lg bg-[#0196ff] px-4 py-2 text-sm font-semibold text-white"
              >
                + Adauga material
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">
                      Material {index + 1}
                    </p>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Sterge
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="md:col-span-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Denumire material
                      </label>
                      <input
                        type="text"
                        value={item.item_name}
                        onChange={(e) =>
                          updateItem(index, "item_name", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Cantitate
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Pret unitar
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(index, "unit_price", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Total linie
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.line_total}
                        onChange={(e) =>
                          updateItem(index, "line_total", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-3"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-800">
                Total materiale: {computedItemsTotal.toFixed(2)} lei
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploadingImage}
              className="w-full rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {saving || uploadingImage ? "Se salveaza..." : "Salveaza BF"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
            >
              Renunta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}