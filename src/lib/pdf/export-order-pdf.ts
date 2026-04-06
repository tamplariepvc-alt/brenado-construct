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

function drawWrappedLines(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  align: "left" | "right" = "left",
  lineHeight = 4
) {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let currentY = y;

  for (const line of lines) {
    doc.text(line, x, currentY, { align });
    currentY += lineHeight;
  }

  return currentY;
}

function drawPartyBox(
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
  width: number
) {
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(x, y, width, 30, 2, 2);

  let cursorY = y + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(title, x + 3, cursorY);

  cursorY += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(party.name, x + 3, cursorY);

  cursorY += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  doc.text(`Reg. Com.: ${party.regNo}`, x + 3, cursorY);
  cursorY += 4;

  doc.text(`CUI: ${party.fiscalCode}`, x + 3, cursorY);
  cursorY += 4;

  cursorY = drawWrappedLines(
    doc,
    `Adresa: ${party.address}`,
    x + 3,
    cursorY,
    width - 6,
    "left",
    4
  );

  drawWrappedLines(
    doc,
    `Email: ${party.email}`,
    x + 3,
    cursorY,
    width - 6,
    "left",
    4
  );
}

export async function exportOrderPdf(data: OrderPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  const logo = await loadImage("/logo.png");

  if (logo) {
    doc.addImage(logo, "PNG", margin, 10, 50, 28);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(1, 150, 255);
  doc.text("COMANDA FURNIZOR", pageWidth / 2, 42, { align: "center" });

  doc.setDrawColor(230, 230, 230);
  doc.line(margin, 48, pageWidth - margin, 48);

  const boxY = 54;
  const boxWidth = 86;
  const gap = 8;

  drawPartyBox(doc, "VANZATOR", SELLER, margin, boxY, boxWidth);
  drawPartyBox(
    doc,
    "CUMPARATOR",
    BUYER,
    margin + boxWidth + gap,
    boxY,
    boxWidth
  );

  const infoY = 84;

  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(margin, infoY, pageWidth - margin * 2, 16, 2, 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);

  doc.text(`Nr.comanda: ${data.orderNumber}`, margin + 4, infoY + 6);
  doc.text(`Data: ${data.orderDate}`, pageWidth - margin - 4, infoY + 6, {
    align: "right",
  });

  doc.text(`Santier: ${data.projectName || "-"}`, margin + 4, infoY + 12);
  doc.text(`Creat de: ${data.creatorName}`, pageWidth - margin - 4, infoY + 12, {
    align: "right",
  });

  autoTable(doc, {
    startY: infoY + 22,
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
      cellPadding: 2.5,
      textColor: [40, 40, 40],
      lineColor: [230, 230, 230],
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
      2: { cellWidth: 72 },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY || 130;

  const totalsX = pageWidth - 72;
  const totalsY = finalY + 8;
  const totalsW = 60;
  const rowH = 7;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(225, 225, 225);
  doc.roundedRect(totalsX, totalsY, totalsW, 26, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);

  doc.text("Subtotal", totalsX + 3, totalsY + 6);
  doc.text(`${data.subtotal.toFixed(2)} lei`, totalsX + totalsW - 3, totalsY + 6, {
    align: "right",
  });

  doc.text("TVA 21%", totalsX + 3, totalsY + 6 + rowH);
  doc.text(
    `${data.vatTotal.toFixed(2)} lei`,
    totalsX + totalsW - 3,
    totalsY + 6 + rowH,
    { align: "right" }
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(1, 150, 255);
  doc.text("Total", totalsX + 3, totalsY + 6 + rowH * 2);
  doc.text(
    `${data.totalWithVat.toFixed(2)} lei`,
    totalsX + totalsW - 3,
    totalsY + 6 + rowH * 2,
    { align: "right" }
  );

  doc.save(`comanda-${data.orderNumber}.pdf`);
}