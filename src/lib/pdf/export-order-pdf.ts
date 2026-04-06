import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type OrderPdfItem = {
  article_code?: string | null;
  article_name: string;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type OrderPdfData = {
  orderNumber: string;
  projectName: string;
  orderDate: string;
  creatorName: string;
  subtotal: number;
  vatTotal: number;
  totalWithVat: number;
  items: OrderPdfItem[];
};

// 🔵 DATE FIRMA (MODIFICĂ CU ALE TALE)
const SELLER = {
  name: "BRENADO FOR HOUSE SRL",
  regNo: "J2020000393160",
  fiscalCode: "42311924",
  address: "str. Craiovei, nr. 28 A, Galicea Mare, Dolj",
  email: "for-house@brenado.ro",
};

// 🔵 CUMPĂRĂTOR (momentan fix)
const BUYER = {
  name: "BRENADO SRL",
  regNo: "J2017000063160",
  fiscalCode: "36931450",
  address: "str. Teilor, nr. 8, Galicea Mare, Dolj",
  email: "office@brenado.ro",
};

export async function exportOrderPdf(data: OrderPdfData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // 🟦 LOGO
  try {
    const res = await fetch("/logo.png");
    const blob = await res.blob();
    const reader = new FileReader();

    const logoData = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    doc.addImage(logoData, "PNG", margin, 10, 30, 15);
  } catch {}

  // 🔵 TITLU CENTRAL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(1, 150, 255);
  doc.text("COMANDĂ FURNIZOR", pageWidth / 2, 18, {
    align: "center",
  });

  let y = 32;

  // 🔵 VANZATOR (stanga)
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("VÂNZĂTOR", margin, y);

  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  doc.text(SELLER.name, margin, y); y += 4;
  doc.text(`Reg. Com.: ${SELLER.regNo}`, margin, y); y += 4;
  doc.text(`CUI: ${SELLER.fiscalCode}`, margin, y); y += 4;
  doc.text(`Adresă: ${SELLER.address}`, margin, y); y += 4;
  doc.text(`Tel: ${SELLER.phone}`, margin, y); y += 4;
  doc.text(`Email: ${SELLER.email}`, margin, y);

  // 🔵 CUMPARATOR (dreapta)
  let rightY = 32;
  const rightX = pageWidth - margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CUMPĂRĂTOR", rightX, rightY, { align: "right" });

  rightY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(BUYER.name, rightX, rightY, { align: "right" }); rightY += 4;
  doc.text(`Reg. Com.: ${BUYER.regNo}`, rightX, rightY, { align: "right" }); rightY += 4;
  doc.text(`CUI: ${BUYER.fiscalCode}`, rightX, rightY, { align: "right" }); rightY += 4;
  doc.text(`Adresă: ${BUYER.address}`, rightX, rightY, { align: "right" }); rightY += 4;
  doc.text(`Tel: ${BUYER.phone}`, rightX, rightY, { align: "right" }); rightY += 4;
  doc.text(`Email: ${BUYER.email}`, rightX, rightY, { align: "right" });

  // 🔵 TABEL
  autoTable(doc, {
    startY: Math.max(y + 10, rightY + 10),
    margin: { left: margin, right: margin },
    head: [["Nr.", "Cod", "Denumire", "UM", "Qty", "P.U.", "Val."]],
    body: data.items.map((item, index) => [
      index + 1,
      item.article_code || "-",
      item.article_name,
      item.unit || "-",
      item.quantity,
      item.unit_price.toFixed(2),
      item.line_total.toFixed(2),
    ]),
    styles: {
      fontSize: 9,
    },
    headStyles: {
      fillColor: [1, 150, 255],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // 🔵 TOTALURI
  doc.setFontSize(10);
  doc.text(`Subtotal: ${data.subtotal.toFixed(2)} lei`, margin, finalY);
  doc.text(`TVA 21%: ${data.vatTotal.toFixed(2)} lei`, margin, finalY + 6);

  doc.setFont("helvetica", "bold");
  doc.text(
    `Total: ${data.totalWithVat.toFixed(2)} lei`,
    margin,
    finalY + 12
  );

  doc.save(`comanda-${data.orderNumber}.pdf`);
}