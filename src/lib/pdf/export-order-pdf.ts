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

const SELLER = {
  name: "BRENADO FOR HOUSE SRL",
  regNo: "J2020000393160",
  fiscalCode: "42311924",
  address: "str. Craiovei, nr. 28 A, Galicea Mare, Dolj",
  email: "for-house@brenado.ro",
};

const BUYER = {
  name: "BRENADO SRL",
  regNo: "J2017000063160",
  fiscalCode: "36931450",
  address: "str. Teilor, nr. 8, Galicea Mare, Dolj",
  email: "office@brenado.ro",
};

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawPartyBlock(
  doc: jsPDF,
  title: string,
  party: {
    name: string;
    regNo: string;
    fiscalCode: string;
    address: string;
    email: string;
  },
  x: number,
  y: number,
  width: number,
  align: "left" | "right"
) {
  const textX = align === "left" ? x : x + width;
  const normalAlign = { align } as { align: "left" | "right" };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(title, textX, y, normalAlign);

  let cursorY = y + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(party.name, textX, cursorY, normalAlign);
  cursorY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  doc.text(`Reg. Com.: ${party.regNo}`, textX, cursorY, normalAlign);
  cursorY += 4;
  doc.text(`CUI: ${party.fiscalCode}`, textX, cursorY, normalAlign);
  cursorY += 4;

  const addressLines = doc.splitTextToSize(`Adresă: ${party.address}`, width);
  doc.text(addressLines, textX, cursorY, normalAlign);
  cursorY += addressLines.length * 3.8;

  const emailLines = doc.splitTextToSize(`Email: ${party.email}`, width);
  doc.text(emailLines, textX, cursorY, normalAlign);
  cursorY += emailLines.length * 3.8;

  return cursorY;
}

export async function exportOrderPdf(data: OrderPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const logo = await loadImage("/logo.png");

  const leftColX = margin;
  const rightColX = 120;
  const blockWidth = 76;

  if (logo) {
    doc.addImage(logo, "PNG", margin, 10, 32, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(1, 150, 255);
  doc.text("COMANDA FURNIZOR", pageWidth / 2, 22, { align: "center" });

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, 32, pageWidth - margin, 32);

  const leftY = 42;
  const rightY = 42;

  const sellerEndY = drawPartyBlock(
    doc,
    "VANZATOR",
    SELLER,
    leftColX,
    leftY,
    blockWidth,
    "left"
  );

  const buyerEndY = drawPartyBlock(
    doc,
    "CUMPARATOR",
    BUYER,
    rightColX,
    rightY,
    blockWidth,
    "right"
  );

  const detailsY = Math.max(sellerEndY, buyerEndY) + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  doc.text(`Nr. comandă: ${data.orderNumber}`, margin, detailsY);
  doc.text(`Șantier: ${data.projectName}`, 70, detailsY);
  doc.text(`Data: ${data.orderDate}`, 145, detailsY);
  doc.text(`Creată de: ${data.creatorName}`, margin, detailsY + 5);

  autoTable(doc, {
    startY: detailsY + 10,
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
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.4,
      textColor: [40, 40, 40],
      lineColor: [225, 225, 225],
      lineWidth: 0.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: [1, 150, 255],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 26 },
      2: { cellWidth: 68 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || detailsY + 40;

  const totalsX = pageWidth - 74;
  const totalsY = finalY + 8;
  const totalsW = 60;
  const rowH = 7;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(totalsX, totalsY, totalsW, 26, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);

  doc.text("Subtotal", totalsX + 3, totalsY + 6);
  doc.text(`${data.subtotal.toFixed(2)} lei`, totalsX + totalsW - 3, totalsY + 6, {
    align: "right",
  });

  doc.text("TVA 21%", totalsX + 3, totalsY + 6 + rowH);
  doc.text(`${data.vatTotal.toFixed(2)} lei`, totalsX + totalsW - 3, totalsY + 6 + rowH, {
    align: "right",
  });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(1, 150, 255);
  doc.text("Total", totalsX + 3, totalsY + 6 + rowH * 2);
  doc.text(`${data.totalWithVat.toFixed(2)} lei`, totalsX + totalsW - 3, totalsY + 6 + rowH * 2, {
    align: "right",
  });

  doc.save(`comanda-${data.orderNumber}.pdf`);
}